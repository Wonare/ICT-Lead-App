'use strict';

/* ==========================================================================
   ICT Lead Form - Admin shared helpers
   Auth guard, API client (JWT via Authorization header), toasts, formatting.
   ========================================================================== */

var TOKEN_KEY = 'ict_admin_token';
var ADMIN_KEY = 'ict_admin_name';

var AdminAPI = (function () {
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  function setSession(token, adminName) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ADMIN_KEY, adminName || '');
    } catch (e) { /* storage disabled */ }
  }

  function clearSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ADMIN_KEY);
    } catch (e) { /* noop */ }
  }

  function isAdminPage() {
    return /\/admin\//.test(window.location.pathname) &&
      !/login\.html$/.test(window.location.pathname);
  }

  function forceLogout(message) {
    clearSession();
    var target = '/admin/login.html';
    if (message) target += '?reason=' + encodeURIComponent(message);
    if (isAdminPage()) window.location.replace(target);
  }

  function ApiError(message, status, errors) {
    var e = new Error(message);
    e.status = status;
    e.errors = errors || [];
    return e;
  }

  function request(path, options) {
    var opts = options || {};
    var headers = { Accept: 'application/json' };
    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

    return fetch(path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      return res.json()
        .catch(function () { return null; })
        .then(function (json) {
          if (res.status === 401 && isAdminPage()) {
            forceLogout((json && json.message) || 'Session expired');
            throw ApiError((json && json.message) || 'Session expired', 401);
          }
          if (!res.ok || !json || json.success === false) {
            throw ApiError(
              (json && json.message) || ('Request failed (HTTP ' + res.status + ')'),
              res.status,
              json && json.errors
            );
          }
          return json;
        });
    }).catch(function (err) {
      if (err && err.status) throw err; // already an ApiError
      throw ApiError('Network error - could not reach the server.', 0);
    });
  }

  /** Guard for protected pages: redirects to login when no valid session. */
  function requireAuth() {
    if (!getToken()) {
      window.location.replace('/admin/login.html');
      return Promise.reject(ApiError('Not authenticated', 401));
    }
    return request('/api/admin/auth/me').then(function (json) {
      return json.data.admin;
    });
  }

  return {
    getToken: getToken,
    setSession: setSession,
    clearSession: clearSession,
    forceLogout: forceLogout,
    request: request,
    requireAuth: requireAuth,
    get: function (p) { return request(p); },
    post: function (p, body) { return request(p, { method: 'POST', body: body }); },
    put: function (p, body) { return request(p, { method: 'PUT', body: body }); },
    patch: function (p, body) { return request(p, { method: 'PATCH', body: body }); },
    del: function (p) { return request(p, { method: 'DELETE' }); }
  };
})();

/* ------------------------------------------------------------- Helpers --- */

function setNav(active) {
  var links = document.querySelectorAll('.sidebar nav a');
  for (var i = 0; i < links.length; i++) {
    links[i].classList.toggle('active', links[i].dataset.nav === active);
  }
}

function setAdminIdentity(admin) {
  var nameEl = document.getElementById('adminName');
  var avatarEl = document.getElementById('adminAvatar');
  var stored = '';
  try { stored = localStorage.getItem(ADMIN_KEY) || ''; } catch (e) { /* noop */ }
  var name = (admin && (admin.full_name || admin.username)) || stored || 'Admin';
  if (nameEl) nameEl.textContent = name;
  if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
}

function bindLogout() {
  var btns = document.querySelectorAll('[data-logout]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', function () {
      AdminAPI.clearSession();
      window.location.replace('/admin/login.html');
    });
  }
}

/* Toasts */
function toast(message, type) {
  var wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  var el = document.createElement('div');
  el.className = 'toast toast-' + (type || 'info');
  el.setAttribute('role', 'status');
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(function () {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(function () { el.remove(); }, 320);
  }, 3400);
}

/* Formatting */
function fmtDateTime(iso) {
  if (!iso) return '\u2014';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '\u2014';
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function fmtDate(iso) {
  if (!iso) return '\u2014';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '\u2014';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusClass(status) {
  switch (status) {
    case 'New': return 'badge-new';
    case 'Contacted': return 'badge-contacted';
    case 'Enrolled': return 'badge-enrolled';
    case 'Not Interested': return 'badge-not';
    case 'Closed': return 'badge-closed';
    case 'Active': return 'badge-active';
    case 'Inactive': return 'badge-inactive';
    default: return 'badge-closed';
  }
}

function statusBadge(status) {
  var span = document.createElement('span');
  span.className = 'badge ' + statusClass(status);
  span.textContent = status;
  return span;
}

function makeBadgeEl(status) { return statusBadge(status); }

/* Modal helpers */
function openModal(id) {
  var el = document.getElementById(id);
  if (el) { el.hidden = false; document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
  var el = document.getElementById(id);
  if (el) { el.hidden = true; document.body.style.overflow = ''; }
}

function bindModalClose(overlayId) {
  var overlay = document.getElementById(overlayId);
  if (!overlay) return;
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal(overlayId);
  });
  var closers = overlay.querySelectorAll('[data-close]');
  for (var i = 0; i < closers.length; i++) {
    closers[i].addEventListener('click', function () { closeModal(overlayId); });
  }
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    var open = document.querySelector('.modal-overlay:not([hidden])');
    if (open) { open.hidden = true; document.body.style.overflow = ''; }
  }
});
