import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictError, UnauthorizedError, ValidationError } from '../../src/errors.js';
import { AuthService } from '../../src/services/AuthService.js';

function serviceWith(auth) {
  return new AuthService(() => ({ auth }));
}

const claims = (value) => ({ getClaims: async () => ({ data: { claims: value }, error: null }) });

describe('AuthService.authenticate', () => {
  it('accepts a token that belongs to a signed in user', async () => {
    const service = serviceWith(claims({ sub: 'user-1', role: 'authenticated' }));

    assert.deepEqual(await service.authenticate('jwt'), { id: 'user-1', accessToken: 'jwt' });
  });

  it('rejects the public anon key, which is a validly signed token with no user', async () => {
    const service = serviceWith(claims({ role: 'anon' }));

    assert.equal(await service.authenticate('anon-key'), null);
  });

  it('rejects a token that has the right role but no subject', async () => {
    const service = serviceWith(claims({ role: 'authenticated' }));

    assert.equal(await service.authenticate('jwt'), null);
  });

  it('rejects a token that fails verification', async () => {
    const service = serviceWith({
      getClaims: async () => ({ data: null, error: { code: 'invalid_jwt' } }),
    });

    assert.equal(await service.authenticate('forged'), null);
  });
});

describe('AuthService sign in and sign up', () => {
  const session = {
    access_token: 'at',
    refresh_token: 'rt',
    expires_in: 3600,
    user: { id: 'user-1' },
  };

  it('returns the session on a good sign in', async () => {
    const service = serviceWith({ signInWithPassword: async () => ({ data: { session }, error: null }) });

    assert.deepEqual(await service.signIn('a@b.co', 'secret123'), {
      accessToken: 'at',
      refreshToken: 'rt',
      expiresIn: 3600,
      user: { id: 'user-1', accessToken: 'at' },
    });
  });

  it('gives the same message for a wrong password as for an unknown email', async () => {
    const service = serviceWith({
      signInWithPassword: async () => ({ data: {}, error: { code: 'invalid_credentials' } }),
    });

    await assert.rejects(service.signIn('a@b.co', 'wrong'), (error) => {
      assert.ok(error instanceof UnauthorizedError);
      assert.equal(error.message, 'Invalid email or password');
      return true;
    });
  });

  it('tells a user who has not confirmed their email to do so', async () => {
    const service = serviceWith({
      signInWithPassword: async () => ({ data: {}, error: { code: 'email_not_confirmed' } }),
    });

    await assert.rejects(service.signIn('a@b.co', 'secret123'), /Confirm your email/);
  });

  it('returns no session when sign up needs email confirmation', async () => {
    const service = serviceWith({ signUp: async () => ({ data: { session: null }, error: null }) });

    assert.equal(await service.signUp('a@b.co', 'secret123'), null);
  });

  it('turns sign up failures into client errors', async () => {
    const failWith = (code, message = 'nope') =>
      serviceWith({ signUp: async () => ({ data: {}, error: { code, message } }) }).signUp('a@b.co', 'secret123');

    await assert.rejects(failWith('weak_password', 'Password is too easy to guess'), ValidationError);
    await assert.rejects(failWith('user_already_exists'), ConflictError);
  });

  it('returns null when a refresh token is no longer valid', async () => {
    const service = serviceWith({
      refreshSession: async () => ({ data: { session: null }, error: { code: 'refresh_token_not_found' } }),
    });

    assert.equal(await service.refresh('old'), null);
  });
});
