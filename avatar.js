/* avatar.js — ตัวปรับรูปโปรไฟล์ (ใช้ร่วมกันหน้าโปรไฟล์สมาชิก + หน้าแอดมิน)
   เลือกไฟล์ → ตรวจชนิด/ขนาด/ภาพเสีย → หน้าต่างลากเลื่อน+ซูมในกรอบสี่เหลี่ยม → ย่อ 256px (JPEG) → ส่งให้ save(dataUrl) (DB.setAvatar)
   DFAvatar.open(file, save, done) → Promise<string>: ข้อความผิดพลาดก่อนเปิดหน้าต่าง ('' = เปิดแล้ว) · ข้อผิดพลาดตอนบันทึกแสดงในหน้าต่างเอง */
(function (w) {
  const S = 256, st = { img: null, z: 1, x: 0, y: 0, drag: null, busy: false, save: null, done: null };
  let el, cv, zoom, err, okBtn;
  const $ = (id) => document.getElementById(id);
  function ensure() {
    if (el) return;
    el = document.createElement('div'); el.className = 'modal'; el.id = 'mAv';
    el.innerHTML = '<div class="mbox" style="width:min(380px,100%);text-align:center"><h3>🖼️ ปรับรูปโปรไฟล์</h3><p style="color:var(--mut);font-size:13px;margin:0 0 10px">ลากเพื่อเลื่อนรูป · เลื่อนแถบเพื่อซูม</p>'
      + '<canvas id="avCv" width="256" height="256" class="avcv"></canvas><div class="f" style="margin:10px 0 4px"><label>ซูม</label><input type="range" id="avZoom" min="1" max="3" step="0.01" value="1"></div>'
      + '<div class="errs" id="eAvM"></div><div style="display:flex;gap:8px;justify-content:center;margin-top:10px"><button class="btn" id="avOk" type="button">💾 บันทึกรูปนี้</button><button class="btn ghost" id="avNo" type="button">ยกเลิก</button></div></div>';
    document.body.appendChild(el); cv = $('avCv'); zoom = $('avZoom'); err = $('eAvM'); okBtn = $('avOk');
    cv.style.touchAction = 'none';
    cv.onpointerdown = (e) => { st.drag = { px: e.clientX, py: e.clientY, x: st.x, y: st.y }; cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = (e) => { if (!st.drag) return; const k = S / cv.getBoundingClientRect().width; st.x = st.drag.x + (e.clientX - st.drag.px) * k; st.y = st.drag.y + (e.clientY - st.drag.py) * k; draw(); };
    cv.onpointerup = cv.onpointercancel = () => { st.drag = null; };
    zoom.oninput = () => { const im = st.img, base = Math.max(S / im.width, S / im.height), old = st.z, nz = +zoom.value, cx = (S / 2 - st.x) / (base * old), cy = (S / 2 - st.y) / (base * old);   // ซูมรอบกึ่งกลางกรอบ
      st.z = nz; st.x = S / 2 - cx * base * nz; st.y = S / 2 - cy * base * nz; draw(); };
    $('avNo').onclick = close;
    okBtn.onclick = async () => { if (st.busy || !st.img) return; st.busy = true; okBtn.disabled = true; okBtn.textContent = 'กำลังอัปโหลด…';
      let r; try { r = await st.save(cv.toDataURL('image/jpeg', 0.88)); } catch (e) { r = { ok: false, errors: [e.message || 'เกิดข้อผิดพลาด'] }; }
      st.busy = false; okBtn.disabled = false; okBtn.textContent = '💾 บันทึกรูปนี้';
      if (!r || !r.ok) { err.innerHTML = ((r && r.errors) || ['บันทึกไม่สำเร็จ']).map((x) => '• ' + String(x).replace(/[<>&]/g, '')).join('<br>'); return; }
      close(); if (st.done) st.done(); };
  }
  function close() { if (el) el.classList.remove('on'); st.img = null; }
  function draw() {
    const im = st.img; if (!im) return; const c = cv.getContext('2d'), k = Math.max(S / im.width, S / im.height) * st.z, w2 = im.width * k, h2 = im.height * k;
    st.x = Math.min(0, Math.max(S - w2, st.x)); st.y = Math.min(0, Math.max(S - h2, st.y));          // กันรูปหลุดกรอบ
    c.fillStyle = '#fff'; c.fillRect(0, 0, S, S); c.drawImage(im, st.x, st.y, w2, h2);
  }
  function open(file, save, done) {
    return new Promise((res) => {
      if (!file) return res('');
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return res('รองรับเฉพาะไฟล์ PNG / JPG / WebP');
      if (file.size > 8 * 1048576) return res('ไฟล์ใหญ่เกิน 8MB — เลือกรูปที่เล็กกว่านี้');
      const u = URL.createObjectURL(file), im = new Image();
      im.onerror = () => { URL.revokeObjectURL(u); res('อ่านไฟล์ภาพไม่ได้ (ไฟล์เสียหรือไม่ใช่รูปภาพ)'); };
      im.onload = () => { URL.revokeObjectURL(u); if (im.width < 64 || im.height < 64) return res('รูปเล็กเกินไป (อย่างน้อย 64×64 พิกเซล)');
        ensure(); st.img = im; st.z = 1; st.save = save; st.done = done; zoom.value = 1; err.innerHTML = '';
        const base = Math.max(S / im.width, S / im.height); st.x = (S - im.width * base) / 2; st.y = (S - im.height * base) / 2; draw(); el.classList.add('on'); res(''); };
      im.src = u;
    });
  }
  w.DFAvatar = { open, close, _st: st };
})(window);
