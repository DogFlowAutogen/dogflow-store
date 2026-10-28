/* การ์ด "ทดลองใช้ฟรี" ในหน้าโปรไฟล์ — ตัวเรนเดอร์ล้วน (รับผลจาก RPC trial_status → คืน HTML) ไม่แตะ DOM/เครือข่าย จึงทดสอบแยกได้
   สถานะ: eligible / pending / issued / lapsed / rejected / customer / used / blocked(+reason) */
(function (root) {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var dt = function (v) { try { return new Date(v).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };

  // เหตุผลที่ขอไม่ได้ → ข้อความถึงสมาชิก + ทางแก้ (action: profile = เลื่อนไปกรอกข้อมูล, none = ไม่มีปุ่ม)
  var BLOCK = {
    email_unverified: ['ยังไม่ได้ยืนยันอีเมล', 'กดลิงก์ยืนยันในอีเมลที่ส่งตอนสมัคร (ดูในกล่องสแปมด้วย) แล้วกลับมาที่หน้านี้'],
    line_unverified: ['ยืนยันตัวตนผ่าน LINE ก่อน', 'เพื่อกันการสมัครซ้ำเอาสิทธิ์ทดลอง กดปุ่มด้านล่างเพื่อรับรหัส แล้วส่งรหัสในแชต LINE ของร้าน (ทำครั้งเดียว ใช้เวลาไม่ถึงนาที)', 'line'],   // [2026-10-28]
    profile_incomplete: ['ข้อมูลส่วนตัวยังไม่ครบ', 'กรอกชื่อ-นามสกุล และเบอร์โทร (ขึ้นต้น 0, 9–10 หลัก) ในกล่อง "ข้อมูลส่วนตัว" แล้วกดบันทึก', 'profile'],
    banned: ['บัญชีนี้ถูกระงับ', 'ไม่สามารถขอทดลองใช้ฟรีได้ หากคิดว่าผิดพลาดโปรดติดต่อทีมงาน'],
    trial_disabled: ['ปิดรับคำขอทดลองใช้ฟรีชั่วคราว', 'ขณะนี้ทีมงานปิดรับคำขอ กรุณากลับมาใหม่ภายหลัง หรือเลือกซื้อแพ็กเกจได้ทันที'],
    queue_full: ['มีผู้ขอจำนวนมากในขณะนี้', 'คิวคำขอเต็มชั่วคราว กรุณาลองใหม่ภายหลัง'],
    dup_identity: ['พบข้อมูลซ้ำกับบัญชีที่เคยใช้สิทธิ์ทดลองแล้ว', 'สิทธิ์ทดลองฟรีมีได้ 1 สิทธิ์ต่อ 1 คน (ตรวจจากเบอร์โทร/อีเมลเดียวกัน) — เลือกซื้อแพ็กเกจเพื่อใช้งานต่อได้'],
    rate_limited: ['กดขอบ่อยเกินไป', 'กรุณารอสักครู่ (ประมาณ 1 ชั่วโมง) แล้วลองใหม่'],
    login_required: ['กรุณาเข้าสู่ระบบ', 'เข้าสู่ระบบก่อนจึงจะขอทดลองใช้ฟรีได้'],
    no_profile: ['ไม่พบข้อมูลสมาชิก', 'ลองออกจากระบบแล้วเข้าใหม่ หากยังไม่หาย โปรดติดต่อทีมงาน']
  };

  function wrap(tone, title, body, actions) {
    return '<div class="trial ' + tone + '"><h3>🎁 ทดลองใช้ฟรี</h3><div class="trial-t">' + title + '</div>' + body + (actions ? '<div class="trial-a">' + actions + '</div>' : '') + '</div>';
  }

  // ctx: { dl: {id, version} | null — รุ่นล่าสุดที่ดาวน์โหลดได้, busy: boolean }
  function render(st, ctx) {
    ctx = ctx || {}; st = st || {};
    var cfg = st.config || {}, days = cfg.days || 1, dev = cfg.devices || 1, claim = cfg.claimDays || 14, buy = '<a class="btn sm gold" href="index.html#shop">🛒 ดูแพ็กเกจ</a>';
    switch (st.state) {
      case 'eligible':
        return wrap('ok', 'ทดลองใช้ฟรี ' + days + ' วัน · ' + dev + ' เครื่อง · ใช้ได้ครบทุกฟีเจอร์',
          '<p style="margin:0 0 4px"><b>ขั้นตอน</b></p><ol class="trial-s" style="margin:0 0 8px;padding-left:20px;line-height:1.7"><li>ติ๊กยินยอมด้านล่าง แล้วกดปุ่ม <b>ขอคีย์ทดลองใช้ฟรี</b> (ส่งคำขอถึงทีมงานทันที)</li><li>รอทีมงานตรวจสอบ — ไม่ต้องกดขอซ้ำ</li><li>เมื่ออนุมัติ คีย์จะขึ้นในกล่อง <b>"License key ของฉัน"</b> และมีแจ้งเตือนในกล่อง "การแจ้งเตือน"</li><li>ดาวน์โหลดและติดตั้งโปรแกรม แล้วใส่คีย์ — วันทดลองเริ่มนับเมื่อเปิดใช้ครั้งแรก (ต้องเริ่มใช้ภายใน ' + claim + ' วันหลังได้รับคีย์)</li></ol>' +   /* [2026-10-28] ขั้นตอนตั้งแต่ขอจนได้คีย์ */
          '<label class="trial-c"><input type="checkbox" id="trialConsent"> ยินยอมให้เก็บรหัสเครื่องเพื่อป้องกันการใช้สิทธิ์ทดลองซ้ำ</label>' +
          '<input id="trialNote" maxlength="200" placeholder="หมายเหตุถึงทีมงาน (ไม่บังคับ)" style="width:100%;margin-top:6px"><div class="errs" id="trialErr"></div>',
          '<button class="btn gold" id="trialAsk"' + (ctx.busy ? ' disabled' : '') + '>🎁 ขอคีย์ทดลองใช้ฟรี</button>');
      case 'pending':
        return wrap('wait', '⏳ ส่งคำขอแล้ว — รอทีมงานตรวจสอบ',
          '<p style="margin:0 0 6px">ส่งเมื่อ ' + esc(dt(st.request && st.request.requestedAt)) + ' · ทีมงานได้รับแจ้งเตือนแล้ว</p>' +
          '<ol class="trial-s" style="margin:0 0 6px;padding-left:20px;line-height:1.7"><li>✅ ส่งคำขอแล้ว</li><li>⏳ <b>ตอนนี้:</b> รอทีมงานตรวจสอบ — <b>ไม่ต้องกดขอซ้ำ</b> เปิดหน้านี้ค้างไว้หรือกลับมาดูภายหลังได้</li><li>เมื่ออนุมัติ: คีย์ขึ้นในกล่อง <b>"License key ของฉัน"</b> (ด้านล่าง) และมีแจ้งเตือนในกล่อง "การแจ้งเตือน" ด้านบน</li><li>จากนั้น: ดาวน์โหลดและติดตั้งโปรแกรม แล้วใส่คีย์ที่ได้</li></ol>' +
          '<p style="font-size:12px;opacity:.75;margin:0">หน้านี้อัปเดตสถานะเอง · ถ้าไม่ต้องการแล้วกดยกเลิกคำขอได้ · ถ้ารอนานผิดปกติ ติดต่อทีมงานผ่านปุ่ม LINE ที่หน้าร้าน</p>',
          st.canCancel ? '<button class="btn ghost sm" id="trialCancel"' + (ctx.busy ? ' disabled' : '') + '>ยกเลิกคำขอ</button>' : '');
      case 'issued': {
        var k = st.key || {}, dl = ctx.dl;
        return wrap('ok', '✅ ได้รับคีย์ทดลองแล้ว',
          '<ol class="trial-s"><li>ดาวน์โหลดและติดตั้งโปรแกรม' + (dl ? ' (รุ่น ' + esc(dl.version) + ')' : ' — ดูกล่อง "ดาวน์โหลดโปรแกรม" ด้านล่าง') + '</li><li>เปิดโปรแกรมแล้วใส่คีย์จากกล่อง "License key ของฉัน"</li><li>วันทดลอง ' + esc(k.trialDays || days) + ' วัน เริ่มนับตอนเปิดใช้ครั้งแรก · ต้องเริ่มใช้ภายใน ' + esc(dt(k.startBy)) + '</li></ol>' +
          '<p style="color:var(--mut);font-size:13px">ซื้อแพ็กเกจเมื่อไหร่ก็ได้ คีย์เดิมจะถูกอัปเกรดให้ ไม่ต้องใส่คีย์ใหม่</p>',
          (dl ? '<button class="btn gold" data-dl="' + esc(dl.id) + '">⬇ ดาวน์โหลดโปรแกรม</button> ' : '') + buy);
      }
      case 'lapsed':
        return wrap('warn', 'คีย์ทดลองเลยกำหนดเริ่มใช้แล้ว',
          '<p>คีย์ที่ได้รับต้องเริ่มใช้ภายใน ' + claim + ' วัน (หมดเขต ' + esc(dt(st.key && st.key.startBy)) + ') สิทธิ์ทดลองฟรีใช้ไปแล้ว — เลือกซื้อแพ็กเกจเพื่อใช้งานต่อ ใช้คีย์เดิมได้</p>', buy);
      case 'rejected': {
        var r = st.request || {}, when = r.permanent ? 'ไม่สามารถขอทดลองใช้ฟรีอีกได้' : (r.retryAfter ? 'ขอใหม่ได้หลังวันที่ ' + esc(dt(r.retryAfter)) : '');
        return wrap('err', 'คำขอทดลองใช้ฟรีไม่ผ่าน',
          '<p><b>เหตุผล:</b> ' + esc(r.decisionNote || 'ไม่ระบุ') + '</p>' + (when ? '<p>' + when + '</p>' : ''), buy);
      }
      case 'customer':
        return wrap('ok', 'คุณเป็นลูกค้าแล้ว', '<p>บัญชีนี้มีแพ็กเกจที่ใช้งานอยู่ จึงไม่ต้องขอทดลองใช้ฟรี — คีย์อยู่ในกล่อง "License key ของฉัน"</p>', '');
      case 'used':
        return wrap('warn', 'ใช้สิทธิ์ทดลองฟรีไปแล้ว', '<p>' + (st.reason === 'revoked' ? 'คีย์ทดลองถูกระงับ' : 'บัญชีนี้ใช้สิทธิ์ทดลองครบแล้ว (1 สิทธิ์ต่อ 1 คน)') + ' — เลือกซื้อแพ็กเกจเพื่อใช้งานต่อได้</p>', buy);
      case 'blocked': {
        var b = BLOCK[st.reason] || ['ขอทดลองใช้ฟรีไม่ได้ในขณะนี้', 'โปรดลองใหม่ภายหลังหรือติดต่อทีมงาน'];
        if (b[2] === 'line') {   // [2026-10-28] ยืนยัน LINE: ยังไม่มีรหัส = ปุ่มขอรหัส · มีรหัสแล้ว = แสดงรหัส + ปุ่มเปิดแชตร้านพร้อมข้อความรหัส
          var ln = ctx.line || {};
          if (ln.code) {   // [2026-10-28] แสดงขั้นตอนส่งรหัส + ปุ่มคัดลอก + ที่วาง QR (profile.html ใส่ SVG ให้ถ้ามีไลบรารี QR)
            var oa = esc(ln.oa || '');
            return wrap('wait', 'ยืนยันตัวตนผ่าน LINE — ส่งรหัสนี้ให้ร้าน',
              '<p style="font-size:26px;font-weight:800;letter-spacing:2px;margin:6px 0">' + esc(ln.code) + '</p>' +
              '<ol style="margin:8px 0 6px;padding-left:20px;line-height:1.7">' +
              '<li>เปิดแอป LINE แล้วเข้าแชตของร้าน' + (oa ? ' (ค้นหา ID <b>' + oa + '</b> แล้วเพิ่มเพื่อน)' : '') + ' — กดปุ่มด้านล่าง' + (ln.qr ? ' หรือสแกน QR ด้วยมือถือ' : '') + '</li>' +
              '<li>ส่งรหัส <b>' + esc(ln.code) + '</b> เป็นข้อความ (ถ้าเปิดจากปุ่ม รหัสจะอยู่ในช่องพิมพ์แล้ว กดส่งได้เลย)</li>' +
              '<li>รอข้อความ ✅ ตอบกลับในแชต หน้านี้จะอัปเดตเอง</li></ol>' +
              '<p style="font-size:12.5px;margin:0 0 6px">⏳ กำลังรอการยืนยันจาก LINE… <span id="lineChk" style="opacity:.7"></span></p>' +
              '<p style="font-size:12px;opacity:.75;margin:0">รหัสหมดอายุใน 10 นาที · ส่งในแชต 1 ต่อ 1 กับบัญชีร้านเท่านั้น (ไม่ใช่ในกลุ่ม)</p>' +
              (ln.qr ? '<div id="lineQr" style="width:190px;height:190px;margin:10px 0;background:#fff;padding:0;border-radius:10px;overflow:hidden"></div>' : ''),
              (ln.url ? '<a class="btn gold" target="_blank" rel="noopener" href="' + esc(ln.url) + '">💬 เปิดแชต LINE แล้วส่งรหัส</a> ' : '') +
              '<button class="btn ghost sm" id="lineCopy" data-code="' + esc(ln.code) + '">คัดลอกรหัส</button> ' +
              '<button class="btn ghost sm" id="lineVerifyStart"' + (ctx.busy ? ' disabled' : '') + '>ขอรหัสใหม่</button>');
          }
          return wrap('warn', esc(b[0]), '<p>' + esc(b[1]) + '</p>' + (ln.error ? '<div class="errs">' + esc(ln.error) + '</div>' : ''),
            '<button class="btn gold" id="lineVerifyStart"' + (ctx.busy ? ' disabled' : '') + '>💬 ยืนยันผ่าน LINE</button>');
        }
        return wrap('warn', esc(b[0]), '<p>' + esc(b[1]) + '</p>', b[2] === 'profile' ? '<a class="btn sm" href="#fProf" data-focus-prof>ไปกรอกข้อมูล</a>' : '');
      }
      default:
        return wrap('warn', 'กำลังโหลดสถานะ…', '', '');
    }
  }

  var api = { render: render, esc: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrialCard = api;
})(typeof window !== 'undefined' ? window : this);
