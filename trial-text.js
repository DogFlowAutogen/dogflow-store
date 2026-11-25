/* [2026-11-25] ข้อความและเงื่อนไขทดลองฟรี — แอดมินแก้ได้ในแท็บ "🎁 ขอคีย์ฟรี" (เก็บใน app_settings)
   ใช้ร่วมกันทั้งหน้าแรก (หน้ายืนยัน) · หน้าโปรไฟล์ (การ์ดขอคีย์/การ์ดลิมิตเต็ม) · หน้าแอดมิน (ค่าตั้งต้น/พรีวิว)
   ช่องว่าง = ใช้ข้อความตั้งต้นด้านล่าง · ใส่ {days} {devices} {claim} ในข้อความได้ ระบบแทนด้วยค่าจริง (วันทดลอง / จำนวนเครื่อง / วันที่ต้องเริ่มใช้คีย์) */
(function (root) {
  var D = {
    trialCfmTitle: 'ทดลองฟรีวันละไม่กี่สิทธิ์นะ',
    trialCfmText: 'เรามีสิทธิ์ทดลองใช้ฟรีให้แค่วันละไม่กี่คน ถ้าวันนี้เต็มแล้วจะขอไม่ได้ ไว้มาลองใหม่พรุ่งนี้ได้เลย',
    trialCfmNote: 'ก่อนขอ ต้องสมัครสมาชิกและยืนยันตัวตนผ่าน LINE ก่อนนะ',
    trialCfmAsk: 'พร้อมไปต่อเลยไหม?',
    trialCfmOk: 'ไปต่อเลย',
    trialCfmCancel: 'ไว้ก่อน',
    trialFullTitle: 'วันนี้สิทธิ์ทดลองฟรีเต็มแล้ว 🙏',
    trialFullText: 'วันนี้มีคนขอทดลองฟรีครบตามจำนวนแล้ว ขอโทษด้วยนะ แวะมาขอใหม่พรุ่งนี้ได้เลย ระบบเริ่มนับใหม่ทุกเที่ยงคืนตามเวลาไทย',
    trialTermsTick: 'ฉันอ่านและยอมรับเงื่อนไขการใช้งานฟรีแล้ว',
    trialTerms: 'ทดลองใช้ฟรี {days} วัน · {devices} เครื่อง · ใช้ได้ครบทุกฟีเจอร์\nขอได้ครั้งเดียวต่อบัญชีต่อโปรแกรม\nคีย์ต้องเริ่มใช้ภายใน {claim} วันหลังได้รับ\nห้ามนำคีย์ไปแจกหรือขายต่อ'
  };
  var num = function (v, d) { var n = Number(v); return v !== '' && v != null && isFinite(n) && n > 0 ? n : d; };
  var S = function () { return (root.DB && root.DB.settings && root.DB.settings()) || {}; };
  // ตัวเลขที่ระบบใช้จริง (ตรงกับค่าเริ่มต้นฝั่งฐานข้อมูล: 1 วัน · 1 เครื่อง · ต้องเริ่มใช้ใน 14 วัน)
  function nums(s) { s = s || S(); return { days: num(s.trialDefaultDays, 1), devices: num(s.trialDevices, 1), claim: num(s.trialClaimDays, 14) }; }
  function fill(t, c) { c = c || nums(); return String(t).replace(/\{(days|devices|claim)\}/g, function (m, k) { return c[k]; }); }
  function raw(k) { var v = S()[k]; return typeof v === 'string' && v.trim() ? v : D[k]; }
  function msg(k, c) { return fill(raw(k), c); }
  function termsOn() { return S().trialTermsOn !== false; }
  // เงื่อนไขเป็นรายการ (หนึ่งบรรทัด = หนึ่งข้อ) · ปิดไว้ = รายการว่าง
  function terms(c) { if (!termsOn()) return []; return raw('trialTerms').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) { return fill(x, c); }); }
  var api = { D: D, nums: nums, fill: fill, raw: raw, msg: msg, terms: terms, termsOn: termsOn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DFTrialText = api;
})(typeof window !== 'undefined' ? window : this);
