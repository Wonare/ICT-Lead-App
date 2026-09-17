'use strict';

/* Admin login: POST /api/admin/auth/login -> store JWT -> dashboard */

(function () {
  var form = document.getElementById('loginForm');
  var usernameEl = document.getElementById('username');
  var passwordEl = document.getElementById('password');
  var errorEl = document.getElementById('loginError');
  var btn = document.getElementById('loginBtn');
  var label = document.getElementById('loginLabel');

  // Already signed in? Skip straight to the dashboard.
  if (AdminAPI.getToken()) {
    window.location.replace('/admin/dashboard.html');
    return;
  }

  // Show reason when redirected here from an expired session.
  var params = new URLSearchParams(window.location.search);
  var reason = params.get('reason');
  if (reason) {
    errorEl.textContent = reason;
    errorEl.classList.add('visible');
  }

  var busy = false;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;

    var username = usernameEl.value.trim();
    var password = passwordEl.value;

    if (!username || !password) {
      errorEl.textContent = 'Please enter your username and password.';
      errorEl.classList.add('visible');
      return;
    }

    busy = true;
    btn.disabled = true;
    btn.classList.add('loading');
    label.textContent = 'Signing in\u2026';
    errorEl.classList.remove('visible');

    AdminAPI.post('/api/admin/auth/login', { username: username, password: password })
      .then(function (json) {
        AdminAPI.setSession(json.data.token, json.data.admin.full_name || json.data.admin.username);
        window.location.replace('/admin/dashboard.html');
      })
      .catch(function (err) {
        errorEl.textContent = err.message || 'Login failed. Please try again.';
        errorEl.classList.add('visible');
        busy = false;
        btn.disabled = false;
        btn.classList.remove('loading');
        label.textContent = 'Sign In';
        passwordEl.value = '';
        passwordEl.focus();
      });
  });
})();
