/* [2026-10-28] ฟอร์มติดต่อหน้าเว็บ — ส่งไป Edge Function `contact` (บันทึก + แจ้ง LINE แอดมิน + อีเมลถึงอีเมลร้าน)
   เปิดจากปุ่มที่มี data-contact · ถ้าส่งไม่สำเร็จ แสดงข้อความ + ลิงก์ส่งอีเมลเองผ่านโปรแกรมอีเมลของผู้ใช้ (ไม่ทำให้ลูกค้าติดต่อไม่ได้) */
(function () {
  var w = window, CFG = w.DOGFLOW_CONFIG || {}, modal = document.getElementById('mContact');
  if (!modal || !CFG.supabaseUrl) return;
  var form = modal.querySelector('form'), box = modal.querySelector('#ctForm'), done = modal.querySelector('#ctDone'), err = modal.querySelector('#ctErr'), btn = modal.querySelector('#ctSend'), cnt = modal.querySelector('#ctCnt'), openedAt = 0, busy = false;
  var mailto = function () { var e = (w.DOGFLOW_CONTACT_EMAIL || '').trim(); return e ? 'mailto:' + encodeURI(e) : ''; };

  function open() {
    form.reset(); err.textContent = ''; cnt.textContent = '0/2000'; box.hidden = false; done.hidden = true; btn.disabled = false; busy = false; openedAt = Date.now();
    var m = mailto(), a = modal.querySelector('#ctMailto'); if (a) { a.hidden = !m; a.href = m || '#'; }
    modal.classList.add('on'); var f = form.elements.name; if (f) setTimeout(function () { try { f.focus(); } catch (e) { /* ไม่โฟกัสก็ไม่เป็นไร */ } }, 60);
  }
  function close() { modal.classList.remove('on'); }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-contact]')) { e.preventDefault(); open(); } else if (modal.classList.contains('on') && (e.target === modal || e.target.closest('[data-ctclose]'))) close(); });
  form.elements.message.addEventListener('input', function () { cnt.textContent = form.elements.message.value.length + '/2000'; });

  form.addEventListener('submit', function (e) {
    e.preventDefault(); if (busy) return;
    var f = form.elements, d = { name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), subject: f.subject.value, message: f.message.value.trim(), website: f.website.value, t: Date.now() - openedAt };
    if (d.name.length < 2) return (err.textContent = 'กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร');
    if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(d.email)) return (err.textContent = 'รูปแบบอีเมลไม่ถูกต้อง');
    if (d.message.length < 10) return (err.textContent = 'กรุณาพิมพ์ข้อความอย่างน้อย 10 ตัวอักษร');
    err.textContent = ''; busy = true; btn.disabled = true; btn.textContent = 'กำลังส่ง…';
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, tm = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    fetch(CFG.supabaseUrl.replace(/\/+$/, '') + '/functions/v1/contact', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseAnonKey || '' }, body: JSON.stringify(d), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }).then(function (j) { return { r: r, j: j }; }); })
      .then(function (x) {
        clearTimeout(tm);
        if (x.j && x.j.ok) { box.hidden = true; done.hidden = false; return; }
        err.textContent = (x.j && x.j.error) || 'ส่งไม่สำเร็จ กรุณาลองใหม่ หรือส่งอีเมล/ทัก LINE โดยตรง';
        busy = false; btn.disabled = false; btn.textContent = '✉ ส่งข้อความ';
      })
      .catch(function () { clearTimeout(tm); err.textContent = 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่ หรือส่งอีเมล/ทัก LINE โดยตรง'; busy = false; btn.disabled = false; btn.textContent = '✉ ส่งข้อความ'; });
  });
})();
