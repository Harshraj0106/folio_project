import { ConflictError, RateLimitError, UnauthorizedError, ValidationError } from '../errors.js';

export class AuthService {
  #anonymousClient;

  /** @param {() => import('@supabase/supabase-js').SupabaseClient} anonymousClient */
  constructor(anonymousClient) {
    this.#anonymousClient = anonymousClient;
  }

  /** @returns {Promise<Session | null>} null when the project requires email confirmation first */
  async signUp(email, password) {
    const { data, error } = await this.#anonymousClient().auth.signUp({ email, password });
    if (error) throw translateSignUpError(error);
    return data.session ? toSession(data.session) : null;
  }

  async signIn(email, password) {
    const { data, error } = await this.#anonymousClient().auth.signInWithPassword({ email, password });
    if (error) throw translateSignInError(error);
    return toSession(data.session);
  }

  /** @returns {Promise<Session | null>} null when the refresh token is invalid or already used */
  async refresh(refreshToken) {
    const { data, error } = await this.#anonymousClient().auth.refreshSession({
      refresh_token: refreshToken,
    });
    return error || !data.session ? null : toSession(data.session);
  }

  /** @returns {Promise<{ id: string, accessToken: string } | null>} */
  async authenticate(accessToken) {
    const { data, error } = await this.#anonymousClient().auth.getClaims(accessToken);
    if (error || !data) return null;

    const { sub, role } = data.claims;
    // The public anon key is itself a validly signed token, so the role has to be checked.
    if (!sub || role !== 'authenticated') return null;
    return { id: sub, accessToken };
  }

  async signOut(refreshToken) {
    const client = this.#anonymousClient();
    const { error } = await client.auth.refreshSession({ refresh_token: refreshToken });
    if (!error) await client.auth.signOut({ scope: 'local' });
  }
}

function toSession(session) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
    user: { id: session.user.id, accessToken: session.access_token },
  };
}

function translateSignInError(error) {
  if (error.code === 'invalid_credentials') return new UnauthorizedError('Invalid email or password');
  if (error.code === 'email_not_confirmed') {
    return new UnauthorizedError('Confirm your email address before signing in');
  }
  return error;
}

function translateSignUpError(error) {
  switch (error.code) {
    case 'weak_password':
      return new ValidationError(error.message);
    case 'user_already_exists':
      return new ConflictError('An account with this email already exists');
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return new RateLimitError();
    default:
      return error;
  }
}

/**
 * @typedef {object} Session
 * @property {string} accessToken
 * @property {string} refreshToken
 * @property {number} expiresIn seconds until the access token expires
 * @property {{ id: string, accessToken: string }} user
 */
