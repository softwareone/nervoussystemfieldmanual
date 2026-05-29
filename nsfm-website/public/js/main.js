(function () {
  'use strict';

  // ----- Mobile nav toggle -----
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');

  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });

    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('is-open');
        toggle.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ----- Scroll reveal -----
  var revealEls = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  // ----- Newsletter signup -----
  var form = document.getElementById('newsletterForm');
  var input = document.getElementById('newsletterEmail');
  var status = document.getElementById('newsletterStatus');

  if (form && input && status) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var btn = form.querySelector('button[type="submit"]');
      var email = input.value.trim();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus('Please enter a valid email address.', 'error');
        return;
      }

      btn.disabled = true;
      setStatus('Standing by…', '');

      fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok) {
            setStatus(result.data.message || "You're on the list.", 'success');
            form.reset();
          } else {
            setStatus(result.data.error || 'Something went wrong. Please try again.', 'error');
          }
        })
        .catch(function () {
          setStatus('Network error. Please try again.', 'error');
        })
        .finally(function () {
          btn.disabled = false;
        });
    });
  }

  function setStatus(msg, kind) {
    if (!status) return;
    status.textContent = msg;
    status.className = 'newsletter-form__status' + (kind ? ' is-' + kind : '');
  }
})();
