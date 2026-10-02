import { UnauthorizedError } from '../errors.js';

// Accepts a valid access token, or quietly swaps the refresh token for a new
// session when the access token has expired.
export function createAuthenticator({ authService, cookies }) {
  return async function authenticate(req, res, next) {
    const { accessToken, refreshToken } = cookies.read(req);

    const user = accessToken ? await authService.authenticate(accessToken) : null;
    if (user) {
      req.user = user;
      return next();
    }

    const session = refreshToken ? await authService.refresh(refreshToken) : null;
    if (!session) {
      cookies.clear(res);
      throw new UnauthorizedError();
    }

    cookies.write(res, session);
    req.user = session.user;
    next();
  };
}
