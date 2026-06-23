// ============================================
// BRH Chat — Login Page Logic
// ============================================

(function () {
  'use strict';

  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('error-message');
  const errorText = document.getElementById('error-text');
  const loginBtn = document.getElementById('login-btn');
  const btnText = loginBtn.querySelector('.btn-text');
  const btnSpinner = loginBtn.querySelector('.btn-spinner');

  // Check if already logged in
  fetch('/api/auth/me')
    .then(r => r.json())
    .then(data => {
      if (data.user) {
        window.location.href = '/';
      }
    })
    .catch(() => {});

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
      showError('กรุณากรอก username และรหัสผ่าน');
      return;
    }

    // Show loading
    loginBtn.disabled = true;
    btnText.textContent = 'กำลังเข้าสู่ระบบ...';
    btnSpinner.style.display = 'block';
    hideError();

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Success — redirect to chat
        btnText.textContent = 'เข้าสู่ระบบสำเร็จ ✓';
        setTimeout(() => {
          window.location.href = '/';
        }, 500);
      } else {
        showError(data.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        resetButton();
      }
    } catch (err) {
      showError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่');
      resetButton();
    }
  });

  function showError(msg) {
    errorText.textContent = msg;
    errorEl.style.display = 'flex';
  }

  function hideError() {
    errorEl.style.display = 'none';
  }

  function resetButton() {
    loginBtn.disabled = false;
    btnText.textContent = 'เข้าสู่ระบบ';
    btnSpinner.style.display = 'none';
  }

})();
