'use strict';

/* ==========================================================================
   ICT Lead Form - Frontend logic (Vanilla JS)

   1. Loads course options from the backend (/api/courses -> MySQL `courses`).
   2. Validates every required field with friendly messages.
   3. Submits via fetch() to POST /api/leads with a loading state and
      double-submit protection.
   4. Shows the success card, with "Submit Another Response" to reset.
   ========================================================================== */

(function () {
  var COURSES_ENDPOINT = '/api/courses';
  var SUBMIT_ENDPOINT = '/api/leads';

  // Fallback list used only if the courses API is unreachable at load time,
  // so the form never shows an empty dropdown. The backend still validates
  // the chosen course against the database.
  var FALLBACK_COURSES = [
    'Web Development',
    'Python Programming',
    'JavaScript',
    'HTML & CSS',
    'Graphics Design',
    'Microsoft Office',
    'Database Management',
    'Networking',
    'Cybersecurity',
    'Data Analysis',
    'Other'
  ];

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
  var PHONE_RE = /^\+?[0-9\s\-().]{7,20}$/;
  var NAME_RE = /^[A-Za-z\u00C0-\u024F' .-]{2,120}$/;

  var form = document.getElementById('leadForm');
  var formCard = document.getElementById('formCard');
  var successCard = document.getElementById('successCard');
  var submitBtn = document.getElementById('submitBtn');
  var submitLabel = document.getElementById('submitLabel');
  var resetBtn = document.getElementById('resetBtn');
  var alertBox = document.getElementById('formAlert');
  var referralSource = document.getElementById('referralSource');
  var referralOtherField = document.getElementById('referralOtherField');
  var courseSelect = document.getElementById('course');

  var isSubmitting = false;

  var fields = {
    full_name: document.getElementById('fullName'),
    phone: document.getElementById('phone'),
    email: document.getElementById('email'),
    course: document.getElementById('course'),
    communication_method: document.getElementById('communicationMethod'),
    referral_source: document.getElementById('referralSource'),
    referral_other: document.getElementById('referralOther')
  };

  /* ------------------------------------------------------------------ *
   * Course dropdown (from database)
   * ------------------------------------------------------------------ */
  function populateCourses(names, selectedValue) {
    courseSelect.innerHTML = '';

    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select a course\u2026';
    placeholder.disabled = true;
    placeholder.selected = true;
    courseSelect.appendChild(placeholder);

    names.forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      courseSelect.appendChild(opt);
    });

    if (selectedValue && names.indexOf(selectedValue) !== -1) {
      courseSelect.value = selectedValue;
    }
  }

  function loadCourses() {
    return fetch(COURSES_ENDPOINT, { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        var courses = (json && json.data && json.data.courses) || [];
        var names = courses.map(function (c) { return c.course_name; });
        if (!names.length) throw new Error('No active courses');
        populateCourses(names, courseSelect.value);
      })
      .catch(function () {
        // Keep the form usable even if the API is briefly down.
        populateCourses(FALLBACK_COURSES, courseSelect.value);
      });
  }

  /* ------------------------------------------------------------------ *
   * Error display helpers
   * ------------------------------------------------------------------ */
  function showError(key, message) {
    var el = document.getElementById('err-' + key);
    if (el) {
      el.textContent = message;
      el.classList.add('visible');
    }
    markInvalid(key, true);
  }

  function clearError(key) {
    var el = document.getElementById('err-' + key);
    if (el) {
      el.textContent = '';
      el.classList.remove('visible');
    }
    markInvalid(key, false);
  }

  function markInvalid(key, invalid) {
    if (key === 'learning_mode') {
      var pills = document.querySelectorAll('#learningModeGroup .radio-pill');
      for (var i = 0; i < pills.length; i++) {
        pills[i].classList.toggle('invalid', invalid);
      }
      return;
    }
    if (fields[key]) fields[key].classList.toggle('invalid', invalid);
  }

  function clearAllErrors() {
    Object.keys(fields).forEach(clearError);
    clearError('learning_mode');
    hideAlert();
  }

  function showAlert(message) {
    alertBox.textContent = message;
    alertBox.className = 'alert alert-error';
    alertBox.hidden = false;
  }

  function hideAlert() {
    alertBox.hidden = true;
    alertBox.textContent = '';
  }

  /* ------------------------------------------------------------------ *
   * Validation (frontend mirror of the backend rules)
   * ------------------------------------------------------------------ */
  function value(key) {
    return fields[key] ? fields[key].value.trim() : '';
  }

  function learningModeValue() {
    var checked = form.querySelector('input[name="learning_mode"]:checked');
    return checked ? checked.value : '';
  }

  function referralOtherRequired() {
    return value('referral_source') === 'Other';
  }

  function validateField(key) {
    switch (key) {
      case 'full_name': {
        var v = value('full_name');
        if (!v) return 'Please enter your full name.';
        if (v.length > 120) return 'Full name must not exceed 120 characters.';
        if (!NAME_RE.test(v)) return 'Please enter a valid full name (letters, spaces, hyphens and apostrophes only).';
        return '';
      }
      case 'phone': {
        var p = value('phone');
        var digits = p.replace(/\D/g, '');
        if (!p) return 'Please enter your phone/WhatsApp number.';
        if (!PHONE_RE.test(p) || digits.length < 7 || digits.length > 15) return 'Please enter a valid phone number.';
        return '';
      }
      case 'email': {
        var e = value('email');
        if (!e) return 'Please enter your email address.';
        if (e.length > 190 || !EMAIL_RE.test(e)) return 'Please enter a valid email address.';
        return '';
      }
      case 'course':
        if (!value('course')) return 'Please select an ICT course.';
        return '';
      case 'learning_mode':
        if (!learningModeValue()) return 'Please select a preferred learning mode.';
        return '';
      case 'communication_method':
        if (!value('communication_method')) return 'Please select how you would like us to contact you.';
        return '';
      case 'referral_source':
        if (!value('referral_source')) return 'Please tell us how you heard about us.';
        return '';
      case 'referral_other': {
        if (!referralOtherRequired()) return '';
        var o = value('referral_other');
        if (!o) return 'Please specify how you heard about us.';
        if (o.length > 150) return 'Please keep this under 150 characters.';
        return '';
      }
      default:
        return '';
    }
  }

  var FIELD_KEYS = [
    'full_name',
    'phone',
    'email',
    'course',
    'learning_mode',
    'communication_method',
    'referral_source',
    'referral_other'
  ];

  function validateForm() {
    var firstInvalid = null;
    FIELD_KEYS.forEach(function (key) {
      var msg = validateField(key);
      if (msg) {
        showError(key, msg);
        if (!firstInvalid) firstInvalid = key;
      } else {
        clearError(key);
      }
    });

    if (firstInvalid) {
      var target =
        firstInvalid === 'learning_mode'
          ? document.getElementById('learningModeGroup')
          : fields[firstInvalid];
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (target && typeof target.focus === 'function' && firstInvalid !== 'learning_mode') {
        try { target.focus({ preventScroll: true }); } catch (e) { /* older browsers */ }
      }
      return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Submission
   * ------------------------------------------------------------------ */
  function collectPayload() {
    return {
      full_name: value('full_name'),
      phone: value('phone'),
      email: value('email'),
      course: value('course'),
      learning_mode: learningModeValue(),
      communication_method: value('communication_method'),
      referral_source: value('referral_source'),
      referral_other: referralOtherRequired() ? value('referral_other') : null
    };
  }

  function setLoading(loading) {
    isSubmitting = loading;
    submitBtn.disabled = loading;
    submitBtn.classList.toggle('loading', loading);
    submitLabel.textContent = loading ? 'Submitting\u2026' : 'Get Course Details';
    if (loading) submitBtn.setAttribute('aria-busy', 'true');
    else submitBtn.removeAttribute('aria-busy');
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return; // prevent multiple submissions

    hideAlert();
    if (!validateForm()) {
      showAlert('Please fix the highlighted fields and try again.');
      return;
    }

    setLoading(true);

    fetch(SUBMIT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(collectPayload())
    })
      .then(function (res) {
        return res.json()
          .then(function (json) { return { ok: res.ok, status: res.status, json: json }; })
          .catch(function () { return { ok: res.ok, status: res.status, json: null }; });
      })
      .then(function (result) {
        if (result.ok && result.json && result.json.success) {
          showSuccess();
          return;
        }

        var json = result.json || {};

        // Field-level errors from the backend validator
        if (Array.isArray(json.errors) && json.errors.length) {
          json.errors.forEach(function (err) {
            if (err && err.field && err.message) showError(err.field, err.message);
          });
          showAlert(json.message || 'Please fix the errors below.');
          setLoading(false);
          return;
        }

        showAlert(json.message || 'Something went wrong. Please check your details and try again.');
        setLoading(false);
      })
      .catch(function () {
        showAlert('Network error - we could not reach the server. Please check your connection and try again.');
        setLoading(false);
      });
  }

  function showSuccess() {
    setLoading(false);
    formCard.hidden = true;
    successCard.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    resetBtn.focus();
  }

  function handleReset() {
    form.reset();
    clearAllErrors();
    courseSelect.value = '';
    toggleReferralOther();
    successCard.hidden = true;
    formCard.hidden = false;
    setLoading(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fields.full_name.focus();
    // Refresh the dropdown in case the admin changed the courses meanwhile.
    loadCourses();
  }

  /* ------------------------------------------------------------------ *
   * "Other" referral toggle + live error clearing
   * ------------------------------------------------------------------ */
  function toggleReferralOther() {
    var needed = referralOtherRequired();
    referralOtherField.hidden = !needed;
    if (!needed) {
      fields.referral_other.value = '';
      clearError('referral_other');
    }
  }

  function bindLiveValidation() {
    Object.keys(fields).forEach(function (key) {
      var el = fields[key];
      if (!el) return;
      var eventName = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(eventName, function () {
        if (el.classList.contains('invalid')) {
          var msg = validateField(key);
          if (!msg) clearError(key);
        }
      });
      el.addEventListener('blur', function () {
        if (el.value.trim() !== '' && !el.classList.contains('invalid')) {
          var m = validateField(key);
          if (m) showError(key, m);
        }
      });
    });

    var radios = form.querySelectorAll('input[name="learning_mode"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].addEventListener('change', function () { clearError('learning_mode'); });
    }

    referralSource.addEventListener('change', function () {
      toggleReferralOther();
      if (referralSource.classList.contains('invalid')) clearError('referral_source');
    });
  }

  /* ------------------------------------------------------------------ *
   * Init
   * ------------------------------------------------------------------ */
  form.addEventListener('submit', handleSubmit);
  resetBtn.addEventListener('click', handleReset);
  bindLiveValidation();
  toggleReferralOther();
  loadCourses();
})();
