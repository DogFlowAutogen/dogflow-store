/* "📣 แจ้งลูกค้าทั้งหมด" (แอดมิน) — 3 หน้าในหน้าต่างเดียว: ① เขียนข้อความ + เลือกกลุ่ม ② หน้ายืนยัน ③ ผลการส่ง
   ปลอดภัย: ส่งแล้วถอนไม่ได้ จึงต้อง ติ๊กตรวจแล้ว + พิมพ์คำว่า "ส่ง" · แสดงจำนวนผู้รับจริงจากฐานข้อมูลก่อนส่ง และส่งจำนวนนั้นกลับไปให้ฐานข้อมูลตรวจซ้ำ (เปลี่ยน = ปฏิเสธ)
   รหัสกันส่งซ้ำ (idem) สร้างใหม่ทุกครั้งที่เข้าหน้ายืนยัน → กดซ้ำ/ลองใหม่หน้าเดิมไม่ส่งซ้ำ แต่แก้ข้อความแล้วส่งใหม่ได้
   ตัวนี้ไม่ผูกกับหน้าแอดมิน: ต้องการ DB = { broadcastPreview(aud), broadcastSend(o), broadcastHistory() } และ host = { toast(msg) } */
(function (root) {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var AUD = [['all', 'ทุกสมาชิก', 'สมาชิกทุกคนที่ไม่ถูกระงับ'], ['paid', 'ลูกค้าที่ซื้อแล้ว', 'มีคีย์แบบซื้อที่ใช้งานได้'], ['trial', 'ผู้ใช้คีย์ทดลอง', 'มีคีย์ทดลอง และยังไม่ซื้อแพ็กเกจ'], ['nokey', 'สมาชิกที่ยังไม่มีคีย์', 'ยังไม่เคยได้คีย์ใด (ชวนทดลอง/ซื้อ)']];
  var TYPES = [['info', 'ℹ️', 'แจ้งทราบ'], ['warning', '⚠️', 'สำคัญ / ควรอ่าน'], ['update', '💿', 'ข่าวสาร / อัปเดต']];
  var audName = function (a) { for (var i = 0; i < AUD.length; i++) if (AUD[i][0] === a) return AUD[i][1]; return a; };
  var typeOf = function (t) { for (var i = 0; i < TYPES.length; i++) if (TYPES[i][0] === t) return TYPES[i]; return TYPES[0]; };
  var uuid = function () { try { if (root.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* ใช้แบบสำรอง */ } return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8); };
  var TITLE_MAX = 80, BODY_MAX = 600;
  var thaiDate = function (v) { try { return new Date(v).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ''; } };

  // ---------- หน้าจอ (ฟังก์ชันล้วน: state → HTML) ----------
  function viewCompose(s) {
    var invalid = s.title.trim().length < 3 || s.body.trim().length < 5;
    return '<h3>📣 แจ้งลูกค้าทั้งหมด</h3><p class="bc-mut">ข้อความจะเด้งในหน้าโปรไฟล์ของสมาชิกในกลุ่มที่เลือก (ไม่ส่งอีเมล) · ส่งแล้วถอนกลับไม่ได้ — มีหน้ายืนยันก่อนส่งทุกครั้ง</p>'
      + '<div class="bc-f"><label>ส่งถึงใคร</label><div class="bc-aud">' + AUD.map(function (a) { return '<label class="bc-opt' + (s.aud === a[0] ? ' on' : '') + '"><input type="radio" name="bcAud" value="' + a[0] + '"' + (s.aud === a[0] ? ' checked' : '') + '><span><b>' + a[1] + '</b><small>' + a[2] + '</small></span></label>'; }).join('') + '</div>'
      + '<div class="bc-cnt" id="bcCnt">' + (s.countErr ? '<span class="bc-err">ตรวจจำนวนผู้รับไม่สำเร็จ: ' + esc(s.countErr) + '</span>' : s.count === null ? 'กำลังนับผู้รับ…' : 'ผู้รับ <b>' + s.count.toLocaleString('th-TH') + '</b> คน' + (s.sample && s.sample.length ? ' <span class="bc-mut">(เช่น ' + s.sample.map(esc).join(', ') + ')</span>' : '')) + '</div></div>'
      + '<div class="bc-f"><label>ประเภท</label><div class="bc-types">' + TYPES.map(function (t) { return '<label class="bc-opt sm' + (s.type === t[0] ? ' on' : '') + '"><input type="radio" name="bcType" value="' + t[0] + '"' + (s.type === t[0] ? ' checked' : '') + '><span>' + t[1] + ' ' + t[2] + '</span></label>'; }).join('') + '</div></div>'
      + '<div class="bc-f"><label>หัวข้อ <small class="bc-mut" id="bcTc">' + s.title.length + '/' + TITLE_MAX + '</small></label><input id="bcTitle" maxlength="' + TITLE_MAX + '" value="' + esc(s.title) + '" placeholder="เช่น ปิดปรับปรุงระบบคืนนี้ 22:00–23:00 น."></div>'
      + '<div class="bc-f"><label>ข้อความ <small class="bc-mut" id="bcBc">' + s.body.length + '/' + BODY_MAX + '</small></label><textarea id="bcBody" rows="5" maxlength="' + BODY_MAX + '" placeholder="เขียนให้สั้น ชัด บอกว่าลูกค้าต้องทำอะไร (ถ้ามี)">' + esc(s.body) + '</textarea></div>'
      + '<div class="bc-err" id="bcErr">' + (s.err ? esc(s.err) : '') + '</div>'
      + '<div class="bc-act"><button type="button" class="btn ghost" data-bc-close>ปิด</button><button type="button" class="btn gold" id="bcNext"' + (invalid || !s.count ? ' disabled' : '') + '>ถัดไป: ตรวจสอบและยืนยัน →</button></div>'
      + '<details class="bc-hist"><summary>ประวัติการแจ้ง (ล่าสุด)</summary>' + (s.history === null ? '<p class="bc-mut">กำลังโหลด…</p>' : s.history.length ? '<div class="bc-hl">' + s.history.map(function (h) { return '<div><span class="bc-mut">' + esc(thaiDate(h.created_at)) + '</span><b>' + esc(h.title) + '</b><span class="bc-mut">' + esc(audName(h.audience)) + ' · ' + Number(h.recipients).toLocaleString('th-TH') + ' คน</span></div>'; }).join('') + '</div>' : '<p class="bc-mut">ยังไม่เคยแจ้ง</p>') + '</details>';
  }
  function viewConfirm(s) {
    var t = typeOf(s.type), ok = s.ack && s.typed.trim() === 'ส่ง' && !s.busy;
    return '<h3>✋ ตรวจสอบก่อนส่ง</h3><div class="bc-warn">ส่งแล้ว <b>ถอนกลับไม่ได้</b> — ลูกค้าทุกคนในกลุ่มจะเห็นข้อความนี้ในโปรไฟล์</div>'
      + '<div class="bc-sum"><div><span>ส่งถึง</span><b>' + esc(audName(s.aud)) + '</b></div><div><span>จำนวนผู้รับ</span><b class="bc-big">' + s.count.toLocaleString('th-TH') + ' คน</b></div><div><span>ประเภท</span><b>' + t[1] + ' ' + t[2] + '</b></div></div>'
      + '<div class="bc-prev-l">ตัวอย่างที่ลูกค้าจะเห็นในโปรไฟล์</div><div class="bc-prev"><span class="bc-pi">' + t[1] + '</span><span><b>' + esc(s.title.trim()) + '</b><br><span class="bc-pb">' + esc(s.body.trim()) + '</span></span></div>'
      + '<label class="bc-ack"><input type="checkbox" id="bcAck"' + (s.ack ? ' checked' : '') + '> ฉันตรวจกลุ่มผู้รับ จำนวน และข้อความแล้ว ถูกต้องทั้งหมด</label>'
      + '<div class="bc-f"><label>พิมพ์คำว่า <b>ส่ง</b> เพื่อยืนยัน</label><input id="bcTyped" autocomplete="off" value="' + esc(s.typed) + '" placeholder="ส่ง" style="max-width:160px"></div>'
      + '<div class="bc-err" id="bcErr">' + (s.err ? esc(s.err) : '') + '</div>'
      + '<div class="bc-act"><button type="button" class="btn ghost" id="bcBack"' + (s.busy ? ' disabled' : '') + '>← กลับไปแก้ไข</button><button type="button" class="btn danger" id="bcSend"' + (ok ? '' : ' disabled') + '>' + (s.busy ? 'กำลังส่ง…' : '📣 ส่งถึง ' + s.count.toLocaleString('th-TH') + ' คน') + '</button></div>';
  }
  function viewDone(s) {
    var r = s.result || {};
    return '<h3>' + (r.duplicate ? 'ℹ️ รายการนี้ถูกส่งไปแล้ว' : '✅ ส่งเรียบร้อยแล้ว') + '</h3><p>' + (r.duplicate ? 'ระบบไม่ส่งซ้ำ' : 'ส่งถึงสมาชิก') + ' <b>' + Number(r.recipients || 0).toLocaleString('th-TH') + ' คน</b> (' + esc(audName(s.aud)) + ') · ลูกค้าจะเห็นเมื่อเปิดหน้าโปรไฟล์ (หน้าที่เปิดอยู่จะเด้งเองทันที)</p>'
      + '<div class="bc-prev"><span class="bc-pi">' + typeOf(s.type)[1] + '</span><span><b>' + esc(s.title.trim()) + '</b><br><span class="bc-pb">' + esc(s.body.trim()) + '</span></span></div><div class="bc-act"><button type="button" class="btn gold" data-bc-close>ปิด</button></div>';
  }
  var view = function (s) { return s.step === 'confirm' ? viewConfirm(s) : s.step === 'done' ? viewDone(s) : viewCompose(s); };

  // ---------- ตัวควบคุม ----------
  function create(opts) {
    var DB = opts.DB, host = opts.host || {}, box = opts.box, modal = opts.modal, s;
    var fresh = function () { return { step: 'compose', aud: 'all', type: 'info', title: '', body: '', count: null, sample: [], countErr: '', history: null, idem: '', ack: false, typed: '', busy: false, err: '', result: null }; };
    var paint = function () { box.innerHTML = view(s); };
    // วาดใหม่เฉพาะส่วนที่เปลี่ยน (พิมพ์ในช่องแล้วไม่หลุดโฟกัส)
    var sync = function () { var n = box.querySelector('#bcNext'); if (n) n.disabled = s.title.trim().length < 3 || s.body.trim().length < 5 || !s.count; var tc = box.querySelector('#bcTc'), bc = box.querySelector('#bcBc'); if (tc) tc.textContent = s.title.length + '/' + TITLE_MAX; if (bc) bc.textContent = s.body.length + '/' + BODY_MAX; };
    var seq = 0;
    async function loadCount() {
      var my = ++seq; s.count = null; s.countErr = ''; s.sample = []; paint();
      try { var r = await DB.broadcastPreview(s.aud); if (my !== seq) return; if (!r || r.ok === false) throw new Error((r && r.errors && r.errors[0]) || 'ไม่ทราบสาเหตุ'); s.count = Number(r.count) || 0; s.sample = r.sample || []; }
      catch (e) { if (my !== seq) return; s.countErr = e.message || String(e); s.count = null; }
      if (s.step === 'compose') paint();
    }
    async function loadHistory() { try { var h = await DB.broadcastHistory(); s.history = Array.isArray(h) ? h : []; } catch (e) { s.history = []; } if (s.step === 'compose') { var d = box.querySelector('.bc-hist'), wasOpen = d && d.open; paint(); if (wasOpen) box.querySelector('.bc-hist').open = true; } }
    function open() { s = fresh(); modal.classList.add('on'); paint(); loadCount(); loadHistory(); }
    function close() { modal.classList.remove('on'); seq++; }
    async function send() {
      if (s.busy || !(s.ack && s.typed.trim() === 'ส่ง')) return;
      s.busy = true; s.err = ''; paint();
      var r; try { r = await DB.broadcastSend({ idem: s.idem, title: s.title.trim(), body: s.body.trim(), type: s.type, audience: s.aud, expect: s.count }); } catch (e) { r = { ok: false, errors: [e && e.message ? e.message : 'เชื่อมต่อไม่สำเร็จ'] }; }
      s.busy = false;
      if (r && r.ok) { s.result = r; s.step = 'done'; paint(); if (host.toast) host.toast(r.duplicate ? 'รายการนี้ส่งไปแล้ว' : 'ส่งถึง ' + r.recipients + ' คนแล้ว ✔'); return; }
      s.err = ((r && r.errors && r.errors[0]) || 'ส่งไม่สำเร็จ') + ' — ถ้าไม่แน่ใจว่าส่งไปหรือยัง ให้ดูใน "ประวัติการแจ้ง" ก่อนส่งใหม่'; paint();
    }
    box.addEventListener('input', function (e) {
      var id = e.target.id; if (id === 'bcTitle') { s.title = e.target.value; sync(); } else if (id === 'bcBody') { s.body = e.target.value; sync(); } else if (id === 'bcTyped') { s.typed = e.target.value; var b = box.querySelector('#bcSend'); if (b) b.disabled = !(s.ack && s.typed.trim() === 'ส่ง' && !s.busy); }
    });
    box.addEventListener('change', function (e) {
      var n = e.target.name; if (n === 'bcAud') { s.aud = e.target.value; loadCount(); } else if (n === 'bcType') { s.type = e.target.value; paint(); } else if (e.target.id === 'bcAck') { s.ack = e.target.checked; var b = box.querySelector('#bcSend'); if (b) b.disabled = !(s.ack && s.typed.trim() === 'ส่ง' && !s.busy); }
    });
    box.addEventListener('click', function (e) {
      if (e.target.closest('[data-bc-close]')) { close(); return; }
      if (e.target.closest('#bcNext')) { if (s.title.trim().length < 3) { s.err = 'หัวข้อต้องยาวอย่างน้อย 3 ตัวอักษร'; paint(); return; } if (s.body.trim().length < 5) { s.err = 'ข้อความต้องยาวอย่างน้อย 5 ตัวอักษร'; paint(); return; } s.err = ''; s.step = 'confirm'; s.ack = false; s.typed = ''; s.idem = uuid(); paint(); return; }
      if (e.target.closest('#bcBack')) { s.step = 'compose'; s.err = ''; paint(); loadCount(); return; }   // กลับมาแก้ → นับผู้รับใหม่ (จำนวนอาจเปลี่ยนระหว่างนั้น)
      if (e.target.closest('#bcSend')) { send(); }
    });
    modal.addEventListener('click', function (e) { if (e.target === modal && !(s && s.busy)) close(); });
    return { open: open, close: close, state: function () { return s; } };
  }

  var api = { create: create, view: view, AUD: AUD, TYPES: TYPES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AdminBroadcast = api;
})(typeof window !== 'undefined' ? window : this);
