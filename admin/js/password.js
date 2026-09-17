'use strict';
(function () {
  var form = document.getElementById('passwordForm');
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var button = document.getElementById('changePasswordBtn');
    var message = document.getElementById('passwordMessage');
    var body = { currentPassword: form.querySelector('#currentPassword').value,
      newPassword: form.querySelector('#newPassword').value,
      confirmPassword: form.querySelector('#confirmPassword').value };
    if (body.newPassword !== body.confirmPassword) { message.textContent = 'The new passwords do not match.'; return; }
    button.disabled = true;
    message.textContent = 'Changing password...';
    AdminAPI.post('/api/admin/auth/password', body).then(function (json) {
      form.reset();
      AdminAPI.forceLogout(json.message);
    }).catch(function (err) { message.textContent = err.message; })
      .finally(function () { button.disabled = false; });
  });
})();
