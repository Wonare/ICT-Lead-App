'use strict';

/* Leads page: list, search, filter, paginate, view full detail,
   change status (PATCH), add notes / update (PUT), delete, CSV export. */

(function () {
  setNav('leads');
  bindLogout();
  bindModalClose('leadModal');
  bindModalClose('confirmModal');

  var PAGE_SIZE = 10;
  var state = { search: '', status: '', course: '', page: 1, totalPages: 1, total: 0 };
  var currentLead = null;
  var pendingDeleteId = null;

  var tbody = document.getElementById('leadsBody');
  var searchInput = document.getElementById('searchInput');
  var statusFilter = document.getElementById('statusFilter');
  var courseFilter = document.getElementById('courseFilter');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var pgInfo = document.getElementById('pgInfo');
  var pgCurrent = document.getElementById('pgCurrent');

  var saveBtn = document.getElementById('saveLeadBtn');
  var deleteLeadBtn = document.getElementById('deleteLeadBtn');
  var confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

  /* ------------------------------------------------------- Data loading */

  function buildQuery(extra) {
    var params = new URLSearchParams();
    if (state.search) params.set('search', state.search);
    if (state.status) params.set('status', state.status);
    if (state.course) params.set('course', state.course);
    params.set('page', String(extra && extra.page ? extra.page : state.page));
    params.set('limit', String(extra && extra.limit ? extra.limit : PAGE_SIZE));
    return params.toString();
  }

  function loadCourseFilter() {
    return AdminAPI.get('/api/admin/courses')
      .then(function (json) {
        json.data.courses.forEach(function (c) {
          var opt = document.createElement('option');
          opt.value = c.course_name;
          opt.textContent = c.course_name + (c.status === 'Inactive' ? ' (inactive)' : '');
          courseFilter.appendChild(opt);
        });
      })
      .catch(function () { /* filter stays with "All courses" */ });
  }

  function loadLeads() {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Loading\u2026</td></tr>';
    return AdminAPI.get('/api/admin/leads?' + buildQuery())
      .then(function (json) {
        var d = json.data;
        state.page = d.pagination.page;
        state.totalPages = d.pagination.totalPages;
        state.total = d.pagination.total;
        renderLeads(d.leads);
        renderPagination(d.pagination);
      })
      .catch(function (err) {
        if (err && err.status === 401) return;
        tbody.innerHTML = '';
        var tr = document.createElement('tr');
        tr.className = 'empty-row';
        var td = document.createElement('td');
        td.colSpan = 7;
        td.textContent = err.message || 'Could not load leads.';
        tr.appendChild(td);
        tbody.appendChild(tr);
      });
  }

  /* ---------------------------------------------------------- Rendering */

  function renderLeads(leads) {
    tbody.innerHTML = '';
    if (!leads.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No leads found. Submissions from the form appear here instantly.</td></tr>';
      return;
    }

    leads.forEach(function (lead) {
      var tr = document.createElement('tr');

      // Name + email
      var tdName = document.createElement('td');
      var nameDiv = document.createElement('div');
      nameDiv.className = 'td-strong';
      nameDiv.textContent = lead.full_name;
      var emailDiv = document.createElement('div');
      emailDiv.className = 'td-muted';
      emailDiv.textContent = lead.email;
      tdName.appendChild(nameDiv);
      tdName.appendChild(emailDiv);

      var tdPhone = document.createElement('td');
      tdPhone.className = 'nowrap';
      tdPhone.textContent = lead.phone;

      var tdCourse = document.createElement('td');
      tdCourse.textContent = lead.course;

      var tdMode = document.createElement('td');
      tdMode.textContent = lead.learning_mode;

      var tdStatus = document.createElement('td');
      tdStatus.appendChild(statusBadge(lead.status));

      var tdDate = document.createElement('td');
      tdDate.className = 'td-muted nowrap';
      tdDate.textContent = fmtDateTime(lead.created_at);

      var tdActions = document.createElement('td');
      tdActions.style.textAlign = 'right';
      tdActions.className = 'nowrap';

      var viewBtn = document.createElement('button');
      viewBtn.type = 'button';
      viewBtn.className = 'btn-icon';
      viewBtn.title = 'View / edit lead';
      viewBtn.setAttribute('aria-label', 'View lead ' + lead.full_name);
      viewBtn.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      viewBtn.addEventListener('click', function () { openLead(lead.id); });

      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-icon danger';
      delBtn.title = 'Delete lead';
      delBtn.setAttribute('aria-label', 'Delete lead ' + lead.full_name);
      delBtn.style.marginLeft = '6px';
      delBtn.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      delBtn.addEventListener('click', function () { askDelete(lead); });

      tdActions.appendChild(viewBtn);
      tdActions.appendChild(delBtn);

      tr.appendChild(tdName);
      tr.appendChild(tdPhone);
      tr.appendChild(tdCourse);
      tr.appendChild(tdMode);
      tr.appendChild(tdStatus);
      tr.appendChild(tdDate);
      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });
  }

  function renderPagination(pg) {
    var from = pg.total === 0 ? 0 : (pg.page - 1) * pg.limit + 1;
    var to = Math.min(pg.total, pg.page * pg.limit);
    pgInfo.textContent = 'Showing ' + from + '\u2013' + to + ' of ' + pg.total + ' lead' + (pg.total === 1 ? '' : 's');
    pgCurrent.textContent = pg.page + ' / ' + pg.totalPages;
    prevBtn.disabled = pg.page <= 1;
    nextBtn.disabled = pg.page >= pg.totalPages;
  }

  /* ------------------------------------------------------- Detail modal */

  function detailItem(label, value, span2) {
    var wrap = document.createElement('div');
    wrap.className = 'detail-item' + (span2 ? ' span-2' : '');
    var dt = document.createElement('div');
    dt.className = 'dt';
    dt.textContent = label;
    var dd = document.createElement('div');
    dd.className = 'dd';
    if (value instanceof Node) dd.appendChild(value);
    else dd.textContent = value === null || value === undefined || value === '' ? '\u2014' : String(value);
    wrap.appendChild(dt);
    wrap.appendChild(dd);
    return wrap;
  }

  function openLead(id) {
    AdminAPI.get('/api/admin/leads/' + id)
      .then(function (json) {
        currentLead = json.data.lead;
        var lead = currentLead;
        var grid = document.getElementById('leadDetail');
        grid.innerHTML = '';

        grid.appendChild(detailItem('Full Name', lead.full_name));
        grid.appendChild(detailItem('Phone / WhatsApp', lead.phone));
        grid.appendChild(detailItem('Email Address', lead.email));
        grid.appendChild(detailItem('Interested Course', lead.course));
        grid.appendChild(detailItem('Preferred Learning Mode', lead.learning_mode));
        grid.appendChild(detailItem('Preferred Communication', lead.communication_method));
        grid.appendChild(detailItem('Referral Source', lead.referral_source));
        grid.appendChild(detailItem('Other Referral Info', lead.referral_other));
        grid.appendChild(detailItem('Lead Status', statusBadge(lead.status)));
        grid.appendChild(detailItem('Lead ID', '#' + lead.id));
        grid.appendChild(detailItem('Date Submitted', fmtDateTime(lead.created_at)));
        grid.appendChild(detailItem('Last Updated', fmtDateTime(lead.updated_at)));

        document.getElementById('editStatus').value = lead.status;
        document.getElementById('editNotes').value = lead.notes || '';
        document.getElementById('leadModalTitle').textContent = 'Lead #' + lead.id + ' \u2014 ' + lead.full_name;

        openModal('leadModal');
      })
      .catch(function (err) {
        if (err && err.status === 401) return;
        toast(err.message || 'Could not load the lead.', 'error');
      });
  }

  /* ------------------------------------------------------------- Saving */

  saveBtn.addEventListener('click', function () {
    if (!currentLead || saveBtn.disabled) return;

    var newStatus = document.getElementById('editStatus').value;
    var newNotes = document.getElementById('editNotes').value.trim();
    var oldNotes = currentLead.notes || '';

    var statusChanged = newStatus !== currentLead.status;
    var notesChanged = newNotes !== oldNotes;

    if (!statusChanged && !notesChanged) {
      toast('No changes to save.', 'info');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.classList.add('loading');

    var jobs = [];
    // Dedicated status endpoint (PATCH) when the status changed...
    if (statusChanged) {
      jobs.push(AdminAPI.patch('/api/admin/leads/' + currentLead.id + '/status', { status: newStatus }));
    }
    // ...and PUT for notes.
    if (notesChanged) {
      jobs.push(AdminAPI.put('/api/admin/leads/' + currentLead.id, { notes: newNotes }));
    }

    Promise.all(jobs)
      .then(function () {
        toast('Lead updated successfully.', 'success');
        closeModal('leadModal');
        loadLeads();
      })
      .catch(function (err) {
        if (err && err.status === 401) return;
        toast(err.message || 'Could not update the lead.', 'error');
      })
      .then(function () {
        saveBtn.disabled = false;
        saveBtn.classList.remove('loading');
      });
  });

  /* ------------------------------------------------------------ Deleting */

  function askDelete(lead) {
    pendingDeleteId = lead.id;
    document.getElementById('confirmText').textContent =
      'You are about to permanently delete the lead from "' + lead.full_name + '" (' + lead.email + '). This action cannot be undone.';
    openModal('confirmModal');
  }

  deleteLeadBtn.addEventListener('click', function () {
    if (!currentLead) return;
    closeModal('leadModal');
    askDelete(currentLead);
  });

  confirmDeleteBtn.addEventListener('click', function () {
    if (pendingDeleteId === null) return;
    confirmDeleteBtn.disabled = true;

    AdminAPI.del('/api/admin/leads/' + pendingDeleteId)
      .then(function () {
        toast('Lead deleted.', 'success');
        closeModal('confirmModal');
        pendingDeleteId = null;
        // Stay on a valid page after deletion.
        if (state.page > 1 && (state.page - 1) * PAGE_SIZE >= state.total - 1) state.page -= 1;
        loadLeads();
      })
      .catch(function (err) {
        if (err && err.status === 401) return;
        toast(err.message || 'Could not delete the lead.', 'error');
      })
      .then(function () {
        confirmDeleteBtn.disabled = false;
      });
  });

  /* --------------------------------------------------------- CSV export */

  function csvCell(v) {
    if (v === null || v === undefined) return '';
    var s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? '"' + s + '"' : s;
  }

  document.getElementById('exportBtn').addEventListener('click', function () {
    AdminAPI.get('/api/admin/leads?' + buildQuery({ page: 1, limit: 1000 }))
      .then(function (json) {
        var leads = json.data.leads;
        if (!leads.length) {
          toast('No leads to export with the current filters.', 'info');
          return;
        }
        var header = ['ID', 'Full Name', 'Phone', 'Email', 'Course', 'Learning Mode',
          'Communication Method', 'Referral Source', 'Referral Other', 'Status', 'Notes',
          'Created At', 'Updated At'];
        var rows = leads.map(function (l) {
          return [l.id, l.full_name, l.phone, l.email, l.course, l.learning_mode,
            l.communication_method, l.referral_source, l.referral_other, l.status, l.notes,
            l.created_at, l.updated_at].map(csvCell).join(',');
        });
        var blob = new Blob(['\uFEFF' + header.join(',') + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'ict-leads-' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast('Exported ' + leads.length + ' lead(s) to CSV.', 'success');
      })
      .catch(function (err) {
        if (err && err.status === 401) return;
        toast(err.message || 'Export failed.', 'error');
      });
  });

  /* ------------------------------------------------------ Filter events */

  var searchTimer = null;
  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.search = searchInput.value.trim();
      state.page = 1;
      loadLeads();
    }, 350);
  });

  statusFilter.addEventListener('change', function () {
    state.status = statusFilter.value;
    state.page = 1;
    loadLeads();
  });

  courseFilter.addEventListener('change', function () {
    state.course = courseFilter.value;
    state.page = 1;
    loadLeads();
  });

  document.getElementById('refreshBtn').addEventListener('click', loadLeads);

  prevBtn.addEventListener('click', function () {
    if (state.page > 1) { state.page -= 1; loadLeads(); }
  });

  nextBtn.addEventListener('click', function () {
    if (state.page < state.totalPages) { state.page += 1; loadLeads(); }
  });

  /* --------------------------------------------------------------- Init */

  AdminAPI.requireAuth()
    .then(function (admin) {
      setAdminIdentity(admin);
      return loadCourseFilter();
    })
    .then(loadLeads)
    .catch(function (err) {
      if (err && err.status === 401) return;
      toast(err.message || 'Could not initialise the page.', 'error');
    });
})();
