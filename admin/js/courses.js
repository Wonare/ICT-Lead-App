'use strict';

/* Courses page: list, add, edit, activate/deactivate (PATCH), delete. */

(function () {
  setNav('courses');
  bindLogout();
  bindModalClose('courseModal');
  bindModalClose('confirmModal');

  var tbody = document.getElementById('coursesBody');
  var countEl = document.getElementById('courseCount');
  var addBtn = document.getElementById('addCourseBtn');
  var saveBtn = document.getElementById('saveCourseBtn');
  var nameEl = document.getElementById('courseName');
  var descEl = document.getElementById('courseDescription');
  var statusEl = document.getElementById('courseStatus');
  var titleEl = document.getElementById('courseModalTitle');
  var confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

  var editingId = null;       // null -> creating
  var pendingDelete = null;   // course awaiting delete confirmation

  /* ------------------------------------------------------- Data loading */

  function loadCourses() {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Loading\u2026</td></tr>';
    AdminAPI.get('/api/admin/courses')
      .then(function (json) {
        renderCourses(json.data.courses);
      })
      .catch(function (err) {
        if (err && err.status === 401) return;
        tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Could not load courses.</td></tr>';
        toast(err.message || 'Could not load courses.', 'error');
      });
  }

  function renderCourses(courses) {
    tbody.innerHTML = '';
    var activeCount = courses.filter(function (c) { return c.status === 'Active'; }).length;
    countEl.textContent = '(' + activeCount + ' active / ' + courses.length + ' total)';

    if (!courses.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No courses yet. Click "Add Course" to create one.</td></tr>';
      return;
    }

    courses.forEach(function (course) {
      var tr = document.createElement('tr');

      var tdName = document.createElement('td');
      tdName.className = 'td-strong';
      tdName.textContent = course.course_name;

      var tdDesc = document.createElement('td');
      tdDesc.className = 'td-muted';
      tdDesc.style.maxWidth = '320px';
      tdDesc.textContent = course.description || '\u2014';

      var tdStatus = document.createElement('td');
      tdStatus.appendChild(statusBadge(course.status));

      var tdCreated = document.createElement('td');
      tdCreated.className = 'td-muted nowrap';
      tdCreated.textContent = fmtDate(course.created_at);

      var tdActions = document.createElement('td');
      tdActions.style.textAlign = 'right';
      tdActions.className = 'nowrap';

      // Edit
      var editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-icon';
      editBtn.title = 'Edit course';
      editBtn.setAttribute('aria-label', 'Edit ' + course.course_name);
      editBtn.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
      editBtn.addEventListener('click', function () { openEdit(course); });

      // Activate / Deactivate
      var toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'btn btn-ghost btn-sm';
      toggleBtn.style.marginLeft = '6px';
      toggleBtn.textContent = course.status === 'Active' ? 'Deactivate' : 'Activate';
      toggleBtn.addEventListener('click', function () { toggleStatus(course); });

      // Delete
      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-icon danger';
      delBtn.title = 'Delete course';
      delBtn.setAttribute('aria-label', 'Delete ' + course.course_name);
      delBtn.style.marginLeft = '6px';
      delBtn.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      delBtn.addEventListener('click', function () { askDelete(course); });

      tdActions.appendChild(editBtn);
      tdActions.appendChild(toggleBtn);
      tdActions.appendChild(delBtn);

      tr.appendChild(tdName);
      tr.appendChild(tdDesc);
      tr.appendChild(tdStatus);
      tr.appendChild(tdCreated);
      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });
  }

  /* ------------------------------------------------------- Modal (add) */

  function clearFieldErrors() {
    ['err-courseName', 'err-courseDescription'].forEach(function (id) {
      var el = document.getElementById(id);
      el.textContent = '';
      el.classList.remove('visible');
    });
    nameEl.classList.remove('invalid');
    descEl.classList.remove('invalid');
  }

  function openAdd() {
    editingId = null;
    titleEl.textContent = 'Add Course';
    nameEl.value = '';
    descEl.value = '';
    statusEl.value = 'Active';
    clearFieldErrors();
    openModal('courseModal');
    nameEl.focus();
  }

  function openEdit(course) {
    editingId = course.id;
    titleEl.textContent = 'Edit Course';
    nameEl.value = course.course_name;
    descEl.value = course.description || '';
    statusEl.value = course.status;
    clearFieldErrors();
    openModal('courseModal');
    nameEl.focus();
  }

  addBtn.addEventListener('click', openAdd);

  saveBtn.addEventListener('click', function () {
    if (saveBtn.disabled) return;

    clearFieldErrors();
    var name = nameEl.value.trim();
    var description = descEl.value.trim();
    var status = statusEl.value;

    var valid = true;
    if (!name) {
      showFieldError('err-courseName', nameEl, 'Please enter the course name.');
      valid = false;
    } else if (name.length < 2) {
      showFieldError('err-courseName', nameEl, 'Course name must be at least 2 characters.');
      valid = false;
    } else if (name.length > 120) {
      showFieldError('err-courseName', nameEl, 'Course name must not exceed 120 characters.');
      valid = false;
    }
    if (description.length > 500) {
      showFieldError('err-courseDescription', descEl, 'Description must not exceed 500 characters.');
      valid = false;
    }
    if (!valid) return;

    saveBtn.disabled = true;
    saveBtn.classList.add('loading');

    var payload = { course_name: name, description: description, status: status };
    var job = editingId
      ? AdminAPI.put('/api/admin/courses/' + editingId, payload)
      : AdminAPI.post('/api/admin/courses', payload);

    job
      .then(function (json) {
        toast(json.message || (editingId ? 'Course updated.' : 'Course created.'), 'success');
        closeModal('courseModal');
        loadCourses();
      })
      .catch(function (err) {
        if (err && err.status === 401) return;
        if (err && err.errors && err.errors.length) {
          err.errors.forEach(function (e) {
            if (e.field === 'course_name') showFieldError('err-courseName', nameEl, e.message);
            if (e.field === 'description') showFieldError('err-courseDescription', descEl, e.message);
          });
        }
        toast(err.message || 'Could not save the course.', 'error');
      })
      .then(function () {
        saveBtn.disabled = false;
        saveBtn.classList.remove('loading');
      });
  });

  function showFieldError(errId, inputEl, message) {
    var el = document.getElementById(errId);
    el.textContent = message;
    el.classList.add('visible');
    inputEl.classList.add('invalid');
  }

  /* ------------------------------------------------------- Toggle status */

  function toggleStatus(course) {
    var next = course.status === 'Active' ? 'Inactive' : 'Active';
    AdminAPI.patch('/api/admin/courses/' + course.id + '/status', { status: next })
      .then(function (json) {
        toast(json.message || 'Course status updated.', 'success');
        loadCourses();
      })
      .catch(function (err) {
        if (err && err.status === 401) return;
        toast(err.message || 'Could not update course status.', 'error');
      });
  }

  /* ------------------------------------------------------------- Delete */

  function askDelete(course) {
    pendingDelete = course;
    document.getElementById('confirmText').textContent =
      'You are about to delete "' + course.course_name + '". Existing leads keep their submitted course name, but the course will disappear from the form dropdown.';
    openModal('confirmModal');
  }

  confirmDeleteBtn.addEventListener('click', function () {
    if (!pendingDelete) return;
    confirmDeleteBtn.disabled = true;

    AdminAPI.del('/api/admin/courses/' + pendingDelete.id)
      .then(function () {
        toast('Course deleted.', 'success');
        closeModal('confirmModal');
        pendingDelete = null;
        loadCourses();
      })
      .catch(function (err) {
        if (err && err.status === 401) return;
        toast(err.message || 'Could not delete the course.', 'error');
      })
      .then(function () {
        confirmDeleteBtn.disabled = false;
      });
  });

  /* --------------------------------------------------------------- Init */

  AdminAPI.requireAuth()
    .then(function (admin) {
      setAdminIdentity(admin);
      loadCourses();
    })
    .catch(function (err) {
      if (err && err.status === 401) return;
      toast(err.message || 'Could not initialise the page.', 'error');
    });
})();
