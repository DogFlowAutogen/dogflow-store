/* ไอคอนรูปดวงตาแสดง/ซ่อนรหัสผ่าน — ใส่ให้ทุกช่อง input[type=password] ในหน้าเว็บอัตโนมัติ (รวมช่องที่สร้างทีหลัง เช่น ในหน้าต่างโต้ตอบของแอดมิน)
   ไม่แตะโค้ดหน้าเดิม: ห่อช่องเดิมด้วย <span.pw-wrap> (ตัว input เดิมชิ้นเดิม ค่า/ชื่อ/เหตุการณ์ยังอยู่) แล้วเติมปุ่มสลับ type password ↔ text
   ปลอดภัย: กลับเป็นซ่อนเองเมื่อส่งฟอร์ม/รีเซ็ตฟอร์ม/ซ่อนหน้าต่าง · ปุ่มไม่ใช่ช่องกรอก (type=button) จึงไม่ถูกส่งไปกับฟอร์ม */
(function () {
  var EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19C5 19 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 5c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';

  function setShown(input, btn, show) {
    input.type = show ? 'text' : 'password';
    btn.innerHTML = show ? EYE_OFF : EYE;
    btn.setAttribute('aria-pressed', show ? 'true' : 'false');
    btn.setAttribute('aria-label', show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
    btn.title = show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน';
  }

  function enhance(input) {
    if (input.__pwEye || input.type !== 'password') return;
    input.__pwEye = true;
    var hadFocus = document.activeElement === input, wrap = document.createElement('span'), btn = document.createElement('button');
    wrap.className = 'pw-wrap'; btn.type = 'button'; btn.className = 'pw-eye'; btn.tabIndex = 0;
    input.parentNode.insertBefore(wrap, input); wrap.appendChild(input); wrap.appendChild(btn);
    setShown(input, btn, false);
    if (hadFocus) input.focus();
    btn.addEventListener('mousedown', function (e) { e.preventDefault(); });   // กดปุ่มแล้วไม่ดึงโฟกัสออกจากช่องรหัส
    btn.addEventListener('click', function () { setShown(input, btn, input.type === 'password'); input.focus(); });
    var hide = function () { if (input.type !== 'password') setShown(input, btn, false); };
    if (input.form) { input.form.addEventListener('submit', hide, true); input.form.addEventListener('reset', hide); }
    input.addEventListener('blur', function () { setTimeout(function () { if (!wrap.contains(document.activeElement) && input.type !== 'password' && !document.hasFocus()) hide(); }, 0); });   // สลับแท็บ/ออกจากหน้าต่าง = ซ่อน
    input.__pwHide = hide;
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches('input[type=password]')) enhance(root);
    var list = root.querySelectorAll ? root.querySelectorAll('input[type=password]') : [];
    for (var i = 0; i < list.length; i++) enhance(list[i]);
  }

  function start() {
    scan(document.body);
    new MutationObserver(function (muts) { for (var i = 0; i < muts.length; i++) for (var j = 0; j < muts[i].addedNodes.length; j++) scan(muts[i].addedNodes[j]); })
      .observe(document.body, { childList: true, subtree: true });
    // ซ่อนรหัสที่เปิดค้างไว้ทุกช่องเมื่อ: สลับแท็บ · ปิดหน้าต่าง (ปุ่มปิด/คลิกพื้นหลัง/Esc)
    var hideAll = function () { document.querySelectorAll('.pw-wrap input').forEach(function (el) { if (el.__pwHide) el.__pwHide(); }); };
    document.addEventListener('visibilitychange', function () { if (document.hidden) hideAll(); });
    document.addEventListener('click', function (e) { if (e.target.closest && (e.target.closest('[data-close]') || (e.target.classList && e.target.classList.contains('modal')))) hideAll(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideAll(); });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
