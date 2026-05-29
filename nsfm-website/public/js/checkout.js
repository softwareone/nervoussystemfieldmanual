(function () {
  'use strict';

  var btn = document.getElementById('checkout-btn');
  var err = document.getElementById('checkout-error');
  if (!btn) return;

  var label = btn.textContent;

  btn.addEventListener('click', function () {
    if (err) err.textContent = '';
    btn.textContent = 'LOADING…';
    btn.disabled = true;

    fetch('/checkout/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data.url) {
          window.location.href = result.data.url;
        } else {
          if (err) err.textContent = result.data.error || 'Something went wrong. Try again.';
          btn.textContent = label;
          btn.disabled = false;
        }
      })
      .catch(function () {
        if (err) err.textContent = 'Network error. Try again.';
        btn.textContent = label;
        btn.disabled = false;
      });
  });
})();
