import { api, redirect } from './net.js';

const form = document.getElementById('auth-form');
const alertBox = document.getElementById('alert');
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const title = document.getElementById('form-title');
const sub = document.getElementById('form-sub');
const hint = document.getElementById('hint');
const submitBtn = document.getElementById('submit-btn');
const passwordInput = document.getElementById('password');

let mode = 'login';

function setMode(next) {
  mode = next;
  const login = mode === 'login';
  tabLogin.classList.toggle('active', login);
  tabSignup.classList.toggle('active', !login);
  title.textContent = login ? 'Masuk ke grid' : 'Buat operator baru';
  sub.textContent = login
    ? 'Sign in dulu untuk mulai bermain.'
    : 'Username 3-20 karakter (huruf kecil, angka, underscore). Password minimal 6.';
  submitBtn.textContent = login ? 'Sign In' : 'Daftar & Main';
  hint.innerHTML = login
    ? 'Belum punya akun? Klik tab <b>Daftar</b>.'
    : 'Sudah punya akun? Klik tab <b>Sign In</b>.';
  passwordInput.autocomplete = login ? 'current-password' : 'new-password';
  alertBox.classList.remove('show');
}

const showError = (message) => {
  alertBox.textContent = message;
  alertBox.className = 'alert show';
};

tabLogin.addEventListener('click', () => setMode('login'));
tabSignup.addEventListener('click', () => setMode('signup'));

// Existing session? Skip the gate.
api('/api/me')
  .then(() => redirect('/play'))
  .catch(() => {});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = 'Memproses…';
  try {
    await api(`/api/auth/${mode === 'login' ? 'login' : 'signup'}`, {
      method: 'POST',
      body: {
        username: document.getElementById('username').value,
        password: passwordInput.value,
      },
    });
    redirect('/play');
  } catch (error) {
    showError(error.message);
    submitBtn.disabled = false;
    submitBtn.textContent = mode === 'login' ? 'Sign In' : 'Daftar & Main';
  }
});
