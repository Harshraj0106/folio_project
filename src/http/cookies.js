const ACCESS_COOKIE = 'folio_at';
const REFRESH_COOKIE = 'folio_rt';
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Tokens only ever live in httpOnly cookies, so page scripts can't read them.
// SameSite=Strict keeps browsers from attaching them to requests started by other sites.
export class SessionCookies {
  #options;

  constructor({ secure }) {
    this.#options = { httpOnly: true, sameSite: 'strict', secure, path: '/api' };
  }

  read(req) {
    return {
      accessToken: req.cookies?.[ACCESS_COOKIE],
      refreshToken: req.cookies?.[REFRESH_COOKIE],
    };
  }

  write(res, session) {
    res.cookie(ACCESS_COOKIE, session.accessToken, {
      ...this.#options,
      maxAge: session.expiresIn * 1000,
    });
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...this.#options,
      maxAge: REFRESH_MAX_AGE_MS,
    });
  }

  clear(res) {
    res.clearCookie(ACCESS_COOKIE, this.#options);
    res.clearCookie(REFRESH_COOKIE, this.#options);
  }
}
