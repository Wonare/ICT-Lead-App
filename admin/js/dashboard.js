'use strict';

/* Dashboard: renders stats from GET /api/admin/stats */

(function () {
  setNav('dashboard');
  bindLogout();

  function renderBars(container, items, labelKey) {
    container.innerHTML = '';
    if (!items.length) {
      var empty = document.createElement('p');
      empty.className = 'td-muted';
      empty.textContent = 'No data yet - leads will appear here once the form is submitted.';
      container.appendChild(empty);
      return;
    }
    var max = items.reduce(function (m, it) { return Math.max(m, it.count); }, 0) || 1;

    items.forEach(function (it) {
      var row = document.createElement('div');
      row.className = 'bar-row';

      var label = document.createElement('div');
      label.className = 'bar-label';
      label.textContent = it[labelKey];
      label.title = it[labelKey];

      var track = document.createElement('div');
      track.className = 'bar-track';
      var fill = document.createElement('div');
      fill.className = 'bar-fill';
      fill.style.width = Math.max(4, Math.round((it.count / max) * 100)) + '%';
      track.appendChild(fill);

      var count = document.createElement('div');
      count.className = 'bar-count';
      count.textContent = it.count;

      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(count);
      container.appendChild(row);
    });
  }

  function renderRecent(leads) {
    var tbody = document.getElementById('recentBody');
    tbody.innerHTML = '';
    if (!leads.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No leads yet. Submissions from the form will appear here instantly.</td></tr>';
      return;
    }
    leads.forEach(function (lead) {
      var tr = document.createElement('tr');

      var tdName = document.createElement('td');
      tdName.className = 'td-strong nowrap';
      tdName.textContent = lead.full_name;

      var tdEmail = document.createElement('td');
      tdEmail.textContent = lead.email;

      var tdCourse = document.createElement('td');
      tdCourse.textContent = lead.course;

      var tdStatus = document.createElement('td');
      tdStatus.appendChild(statusBadge(lead.status));

      var tdDate = document.createElement('td');
      tdDate.className = 'td-muted nowrap';
      tdDate.textContent = fmtDateTime(lead.created_at);

      tr.appendChild(tdName);
      tr.appendChild(tdEmail);
      tr.appendChild(tdCourse);
      tr.appendChild(tdStatus);
      tr.appendChild(tdDate);
      tbody.appendChild(tr);
    });
  }

  AdminAPI.requireAuth()
    .then(function (admin) {
      setAdminIdentity(admin);
      return AdminAPI.get('/api/admin/stats');
    })
    .then(function (json) {
      var s = json.data;

      document.getElementById('statTotal').textContent = s.leads.total;
      document.getElementById('statNew').textContent = s.leads.by_status['New'] || 0;
      document.getElementById('statEnrolled').textContent = s.leads.by_status['Enrolled'] || 0;
      document.getElementById('statMonth').textContent = s.leads.this_month;
      document.getElementById('statCourses').textContent = s.courses.active + ' / ' + s.courses.total;

      renderBars(document.getElementById('byCourse'), s.by_course, 'course');
      renderBars(document.getElementById('bySource'), s.by_source, 'referral_source');
      renderRecent(s.recent);
    })
    .catch(function (err) {
      if (err && err.status === 401) return; // redirecting to login
      toast(err.message || 'Could not load dashboard data.', 'error');
    });
})();
