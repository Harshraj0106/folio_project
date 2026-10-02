import { ApiError } from './api.js';

const MODES = {
  signin: {
    title: 'Sign in',
    submit: 'Sign in',
    prompt: 'New to Folio?',
    switchTo: 'Create an account',
    autocomplete: 'current-password',
  },
  signup: {
    title: 'Create your account',
    submit: 'Create account',
    prompt: 'Already have an account?',
    switchTo: 'Sign in',
    autocomplete: 'new-password',
  },
};

export class AuthView {
  #section = document.getElementById('auth-view');
  #form = document.getElementById('auth-form');
  #title = document.getElementById('auth-title');
  #submit = document.getElementById('auth-submit');
  #message = document.getElementById('auth-message');
  #hint = document.getElementById('password-hint');
  #prompt = document.getElementById('auth-switch-text');
  #switch = document.getElementById('auth-switch');
  #api;
  #onAuthenticated;
  #mode = 'signin';

  constructor({ api, onAuthenticated }) {
    this.#api = api;
    this.#onAuthenticated = onAuthenticated;
    this.#form.addEventListener('submit', (event) => this.#onSubmit(event));
    this.#switch.addEventListener('click', () => {
      this.#setMode(this.#mode === 'signin' ? 'signup' : 'signin');
      this.#showMessage(null);
    });
  }

  show() {
    this.#section.hidden = false;
    this.#form.elements.email.focus();
  }

  hide() {
    this.#section.hidden = true;
  }

  #setMode(mode) {
    this.#mode = mode;
    const copy = MODES[mode];
    this.#title.textContent = copy.title;
    this.#submit.textContent = copy.submit;
    this.#prompt.textContent = copy.prompt;
    this.#switch.textContent = copy.switchTo;
    this.#form.elements.password.autocomplete = copy.autocomplete;
    this.#hint.hidden = mode === 'signin';
  }

  async #onSubmit(event) {
    event.preventDefault();
    const { email, password } = this.#form.elements;

    this.#submit.disabled = true;
    this.#showMessage(null);
    try {
      if (this.#mode === 'signin') {
        await this.#api.signIn(email.value, password.value);
      } else {
        const { confirmationRequired } = await this.#api.signUp(email.value, password.value);
        if (confirmationRequired) {
          this.#setMode('signin');
          this.#showMessage('Check your inbox to confirm your email address, then sign in.', 'info');
          password.value = '';
          return;
        }
      }
      this.#form.reset();
      this.#onAuthenticated();
    } catch (error) {
      const detail = error instanceof ApiError && error.details?.map((item) => item.message).join(' ');
      this.#showMessage(detail || error.message);
    } finally {
      this.#submit.disabled = false;
    }
  }

  #showMessage(text, kind = 'error') {
    this.#message.hidden = text === null;
    this.#message.textContent = text ?? '';
    this.#message.dataset.kind = kind;
  }
}
