export class ApiError extends Error {
  constructor({ status, code, message, details }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ApiClient {
  portfolio(signal) {
    return this.#request('GET', '/api/portfolio', { signal });
  }

  addHolding(holding) {
    return this.#request('POST', '/api/holdings', { body: holding });
  }

  addHoldings(holdings) {
    return this.#request('POST', '/api/holdings/bulk', { body: holdings });
  }

  updateHolding(id, changes) {
    return this.#request('PATCH', `/api/holdings/${id}`, { body: changes });
  }

  removeHolding(id) {
    return this.#request('DELETE', `/api/holdings/${id}`);
  }

  signUp(email, password) {
    return this.#request('POST', '/api/auth/signup', { body: { email, password } });
  }

  signIn(email, password) {
    return this.#request('POST', '/api/auth/signin', { body: { email, password } });
  }

  signOut() {
    return this.#request('POST', '/api/auth/signout');
  }

  async #request(method, path, { body, signal } = {}) {
    let response;
    try {
      response = await fetch(path, {
        method,
        signal,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new ApiError({
        status: 0,
        code: 'network_error',
        message: 'Could not reach the server. Check your connection.',
      });
    }

    if (response.status === 204) return null;

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiError({
        status: response.status,
        code: payload?.error?.code ?? 'unknown_error',
        message: payload?.error?.message ?? 'Something went wrong. Try again.',
        details: payload?.error?.details,
      });
    }
    return payload;
  }
}
