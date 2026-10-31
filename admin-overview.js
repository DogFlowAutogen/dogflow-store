/* หน้า "ภาพรวม" ของแอดมิน (แบบ B · Clean Analytics) — แยกเป็น 2 ส่วนเพื่อทดสอบได้โดยไม่ต้องมีเบราว์เซอร์:
   model(snapshot, {days, now}) → ตัวเลขทั้งหมด (ล้วนจากข้อมูลที่หน้าแอดมินโหลดไว้แล้ว) · render(model) → สตริง HTML (ใช้ AdminCharts วาดกราฟ)
   วันที่แบ่งตามเวลาท้องถิ่นของเครื่องแอดมิน · ข้อความจากผู้ใช้ (ชื่อสินค้า/ลูกค้า/หัวข้อตั๋ว) ผ่าน esc() ทุกจุด */
(function (root) {
  var C = root.AdminCharts || (typeof require !== 'undefined' ? require('./admin-charts.js') : null), E = C.esc, DAY = 86400000;
  var MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var num = function (n) { n = Number(n); return isFinite(n) ? n : 0; };
  var t = function (v) { var d = v ? new Date(v).getTime() : NaN; return isFinite(d) ? d : 0; };
  var startOfDay = function (ms) { var d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  var okStatus = function (s) { return s === 'paid' || s === 'done'; };
  var payTime = function (o) { return t(o.payment && o.payment.verifiedAt) || t(o.createdAt); };   // รายได้นับตามวันที่ยืนยันชำระ (ไม่มี = วันที่สร้างออเดอร์)

  function ago(ms, now) {
    var s = Math.max(0, Math.floor((now - ms) / 1000)); if (s < 60) return 'เมื่อสักครู่';
    var m = Math.floor(s / 60); if (m < 60) return m + ' นาทีที่แล้ว'; var h = Math.floor(m / 60); if (h < 24) return h + ' ชม.ที่แล้ว';
    var d = Math.floor(h / 24); return d < 30 ? d + ' วันที่แล้ว' : new Date(ms).getDate() + ' ' + MON[new Date(ms).getMonth()];
  }

  function model(S, o) {
    S = S || {}; o = o || {}; var days = [7, 30, 90].indexOf(o.days) >= 0 ? o.days : 30, now = o.now || Date.now(), today = startOfDay(now), from = today - (days - 1) * DAY, prevFrom = from - days * DAY;
    var orders = S.orders || [], members = S.members || [], products = S.products || [], tickets = S.tickets || [], coms = S.commissions || [];
    var inCur = function (ms) { return ms >= from && ms < today + DAY; }, inPrev = function (ms) { return ms >= prevFrom && ms < from; };
    var labels = [], revenueDaily = [], ordersDaily = [], idx = {};
    for (var i = 0; i < days; i++) { var d = new Date(from + i * DAY); labels.push(d.getDate() + ' ' + MON[d.getMonth()]); revenueDaily.push(0); ordersDaily.push(0); idx[startOfDay(from + i * DAY)] = i; }
    var revenue = 0, revenuePrev = 0, orderCount = 0, orderPrev = 0, created = 0, createdOk = 0, prodMap = {}, heat = [], k;
    for (k = 0; k < 7; k++) heat.push(new Array(24).fill(0));
    orders.forEach(function (x) {
      var cAt = t(x.createdAt), ok = okStatus(x.status), pAt = payTime(x);
      if (ok) {
        var tot = num(x.total);
        if (inCur(pAt)) { revenue += tot; orderCount++; var di = idx[startOfDay(pAt)]; if (di != null) { revenueDaily[di] += tot; ordersDaily[di]++; } (x.items || []).forEach(function (it) { var nm = it.name || 'ไม่ระบุ', r = prodMap[nm] || (prodMap[nm] = { label: nm, value: 0, rev: 0 }); r.value += num(it.qty); r.rev += num(it.price) * num(it.qty); }); }
        else if (inPrev(pAt)) { revenuePrev += tot; orderPrev++; }
      }
      if (inCur(cAt)) { created++; if (ok) createdOk++; var dd = new Date(cAt); heat[dd.getDay()][dd.getHours()]++; }
    });
    var statusCount = { done: 0, review: 0, pending: 0, rejected: 0, cancelled: 0 };
    orders.forEach(function (x) { var s = okStatus(x.status) ? 'done' : x.status; if (s in statusCount) statusCount[s]++; });
    var status = [{ label: 'ชำระแล้ว / เสร็จสิ้น', value: statusCount.done, color: 'var(--c3)' }, { label: 'รอตรวจสลิป', value: statusCount.review, color: 'var(--c2)' }, { label: 'รอชำระ', value: statusCount.pending, color: 'var(--c4)' }, { label: 'สลิปไม่ผ่าน', value: statusCount.rejected, color: 'var(--c5)' }, { label: 'ยกเลิก', value: statusCount.cancelled, color: 'var(--c6)' }];
    var membersNew = members.filter(function (m) { return inCur(t(m.createdAt)); }).length, membersNewPrev = members.filter(function (m) { return inPrev(t(m.createdAt)); }).length;
    var keysIssued = orders.reduce(function (s, x) { return s + (x.licenseKeys || []).filter(function (k2) { return !k2.renewed; }).length; }, 0) + (S.trialKeys || []).length;
    var top = Object.keys(prodMap).map(function (n) { return prodMap[n]; }).sort(function (a, b) { return b.rev - a.rev || b.value - a.value; }).slice(0, 5);
    var ts = S.trialStats || null, funnel = ts && ts.requested ? [{ label: 'ขอทดลองใช้ฟรี', value: ts.requested }, { label: 'อนุมัติ + ออกคีย์', value: ts.approved }, { label: 'ซื้อแพ็กเกจต่อ', value: num(ts.converted) }] : [];
    var tk = { new: 0, open: 0, waiting_user: 0, closed: 0 };
    tickets.forEach(function (x) { var s = x.status in tk ? x.status : 'closed'; tk[s]++; });
    var ticketsBy = [{ label: 'ใหม่', value: tk.new, color: 'var(--c2)' }, { label: 'กำลังดำเนินการ', value: tk.open, color: 'var(--c1)' }, { label: 'รอลูกค้าตอบ', value: tk.waiting_user, color: 'var(--c4)' }, { label: 'ปิดแล้ว', value: tk.closed, color: 'var(--c3)' }];
    var agents = {}, comPending = 0, comPaid = 0; coms.forEach(function (c) { if (c.referrerId) agents[c.referrerId] = 1; if (c.status === 'pending' || c.status === 'requested') comPending += num(c.amount); else if (c.status === 'paid') comPaid += num(c.amount); });
    // กิจกรรมล่าสุด: รวมเหตุการณ์จากข้อมูลที่โหลดไว้ แล้วเรียงใหม่สุดก่อน
    var ev = [];
    orders.forEach(function (x) { var a = t(x.createdAt); if (a) ev.push({ at: a, k: 'order', m: 'ออเดอร์ ' + x.id + ' · ' + ((x.customer && x.customer.name) || ''), v: C.baht(x.total) }); });
    members.forEach(function (m) { var a = t(m.createdAt); if (a) ev.push({ at: a, k: 'member', m: 'สมาชิกใหม่ · ' + (m.name || m.email || ''), v: '+1' }); });
    tickets.forEach(function (x) { var a = t(x.createdAt); if (a) ev.push({ at: a, k: 'ticket', m: 'ตั๋วใหม่ · ' + (x.title || ''), v: x.status === 'new' ? 'ใหม่' : '' }); });
    ((S.trialQ && S.trialQ.pending) || []).forEach(function (x) { var a = t(x.requestedAt); if (a) ev.push({ at: a, k: 'trial', m: 'คำขอทดลองฟรี · ' + (x.name || ''), v: 'รออนุมัติ' }); });
    ev.sort(function (a, b) { return b.at - a.at; }); var recent = ev.slice(0, 6).map(function (e) { e.t = ago(e.at, now); return e; });
    // [2026-10-31] สถิติเข้าชมเว็บ: รายวันตามช่วงที่เลือก + รายเดือน (ไม่มีข้อมูล = null → ซ่อนการ์ด)
    var site = null;
    if (S.siteStats && Array.isArray(S.siteStats.days)) {
      var sd = {}; S.siteStats.days.forEach(function (x) { sd[x.day] = num(x.views); });
      var key = function (ms) { var q = new Date(ms); return q.getFullYear() + '-' + ('0' + (q.getMonth() + 1)).slice(-2) + '-' + ('0' + q.getDate()).slice(-2); };
      var daily = [], sum7 = 0, sumRange = 0, sumPrev = 0, i2;
      for (i2 = 0; i2 < days; i2++) { var vv = sd[key(from + i2 * DAY)] || 0; daily.push(vv); sumRange += vv; }
      for (i2 = 0; i2 < days; i2++) sumPrev += sd[key(prevFrom + i2 * DAY)] || 0;
      for (i2 = 0; i2 < 7; i2++) sum7 += sd[key(today - i2 * DAY)] || 0;
      var curMon = key(today).slice(0, 7), mons = (S.siteStats.months || []).map(function (x) { return { month: x.month, views: num(x.views) }; }), mons0 = mons;
      var sv = String(o.siteView || 'range'), yr = new Date(today).getFullYear(), view = { mode: 'range', labels: null, vals: daily, caption: 'รายวัน ' + days + ' วันล่าสุด' };
      if (sv === 'year') {
        var mv = [], ml = [], mm; for (mm = 0; mm < 12; mm++) { var kk = yr + '-' + ('0' + (mm + 1)).slice(-2); ml.push(MON[mm]); mv.push((mons0.filter(function (x) { return x.month === kk; })[0] || { views: 0 }).views); }
        view = { mode: 'year', labels: ml, vals: mv, caption: 'รายเดือน ทั้งปี ' + (yr + 543) };
      } else if (/^\d{4}-\d{2}$/.test(sv)) {
        var py = Number(sv.slice(0, 4)), pm = Number(sv.slice(5)) - 1, nd = new Date(py, pm + 1, 0).getDate(), dv = [], dl = [], dd2;
        for (dd2 = 1; dd2 <= nd; dd2++) { dv.push(sd[sv + '-' + ('0' + dd2).slice(-2)] || 0); dl.push(dd2 % 5 === 1 || dd2 === nd ? String(dd2) : ''); }
        view = { mode: 'month', labels: dl, vals: dv, caption: 'รายวัน ' + MON[pm] + ' ' + (py + 543) };
      }
      var vt = view.vals.reduce(function (a, b) { return a + b; }, 0);
      view.sum = vt; view.max = Math.max.apply(null, view.vals.concat([0])); view.avg = view.vals.length ? Math.round(vt / view.vals.length) : 0; view.sel = sv;
      site = { rFrom: o.siteFrom || key(from), rTo: o.siteTo || key(today), view: view, yearMonths: mons0.filter(function (x) { return x.views > 0 || true; }).map(function (x) { return x.month; }).reverse(), yr: yr, daily: daily, today: sd[key(today)] || 0, yesterday: sd[key(today - DAY)] || 0, week: sum7, range: sumRange, rangePrev: sumPrev, months: mons.slice(-12).reverse(), monthNow: (mons.filter(function (x) { return x.month === curMon; })[0] || { views: 0 }).views, total: num(S.siteStats.total) };
    }
    var health = (S.health || []).filter(function (h) { return h && h.msg; }).slice(0, 5);
    var lowStock = products.filter(function (p) { return p.active && num(p.stock) <= 5; }).length;
    return {
      days: days, now: now, from: from, to: today, labels: labels, revenueDaily: revenueDaily, ordersDaily: ordersDaily, heat: heat,
      revenue: revenue, revenuePrev: revenuePrev, orderCount: orderCount, orderPrev: orderPrev, avgOrder: orderCount ? Math.round(revenue / orderCount) : 0,
      membersTotal: members.length, membersNew: membersNew, membersNewPrev: membersNewPrev, keysIssued: keysIssued, conversion: created ? Math.round(createdOk / created * 1000) / 10 : 0, created: created,
      site: site, status: status, topProducts: top, funnel: funnel, tickets: ticketsBy, commission: { pending: comPending, paid: comPaid, agents: Object.keys(agents).length }, recent: recent, health: health,
      alerts: { slips: statusCount.review, trials: ((S.trialQ && S.trialQ.pending) || []).length, tickets: tk.new, lowStock: lowStock }
    };
  }

  var dlt = function (d, txt) { return '<span class="delta ' + d.cls + '">' + d.text + '</span> <span class="ov-mut">' + txt + '</span>'; };
  var fmtDate = function (ms) { var d = new Date(ms); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + (d.getFullYear() + 543); };
  var TILE = function (icon, lb, n, sub) { return '<div><div class="lb"><i>' + icon + '</i>' + lb + '</div><div class="n">' + n + '</div>' + sub + '</div>'; };
  var icon = { order: '🛒', member: '👤', ticket: '💬', trial: '🎁' };
  var empty = function (msg) { return '<p class="ov-empty">' + E(msg) + '</p>'; };

  // [2026-10-31] การ์ดสถิติเข้าชมเว็บไซต์: วันนี้/7 วัน/เดือนนี้ + กราฟรายวัน + ตารางรายเดือน
  function siteCard(m, step) {
    var s = m.site; if (!s) return '';
    var d = C.delta(s.range, s.rangePrev), th = function (n) { return num(n).toLocaleString('th-TH'); };
    var mn = function (k) { var p = String(k).split('-'); return MON[Number(p[1]) - 1] + ' ' + (Number(p[0]) + 543); };
    return '<div class="ov-card"><h3>👁 ยอดเข้าชมเว็บไซต์</h3><div class="cap">จำนวนครั้งที่เข้าชม (นับ 1 ครั้งต่อแท็บ · เวลาไทย) · เริ่มเก็บตั้งแต่ติดตั้งตัวนับ</div>'
      + '<div class="ov-strip s4">' + TILE('☀️', 'วันนี้', th(s.today), '<span class="ov-mut">เมื่อวาน ' + th(s.yesterday) + '</span>')
      + TILE('📅', '7 วัน', th(s.week), '<span class="ov-mut">รวม 7 วันล่าสุด</span>') + TILE('🗓️', 'เดือนนี้', th(s.monthNow), '<span class="ov-mut">สะสมทั้งหมด ' + th(s.total) + '</span>')
      + TILE('📈', m.days + ' วัน', th(s.range), dlt(d, 'เทียบ ' + m.days + ' วันก่อน')) + '</div>'
      + '<div style="display:flex;gap:10px;align-items:center;margin:4px 0 8px;flex-wrap:wrap"><select id="siteView" aria-label="มุมมองสถิติเข้าชม"><option value="range"' + (s.view.sel === 'range' ? ' selected' : '') + '>ตามช่วงที่เลือก (' + m.days + ' วัน)</option><option value="year"' + (s.view.sel === 'year' ? ' selected' : '') + '>ทั้งปี ' + (s.yr + 543) + ' (รายเดือน)</option>'
      + s.yearMonths.map(function (k) { return '<option value="' + k + '"' + (s.view.sel === k ? ' selected' : '') + '>' + E(mn(k)) + ' (รายวัน)</option>'; }).join('') + '</select>'
      + '<span class="ov-mut">' + E(s.view.caption) + ' · รวม <b>' + th(s.view.sum) + '</b> · เฉลี่ย ' + th(s.view.avg) + ' · สูงสุด ' + th(s.view.max) + '</span></div>'
      + (s.view.sum > 0 ? C.vbars(s.view.vals, s.view.labels || m.labels.map(function (l, i) { return i % step === 0 ? l.split(' ')[0] : ''; }), { h: 190, color: 'var(--c1)', hi: s.view.vals.indexOf(s.view.max), label: 'ยอดเข้าชม' }) : empty('ยังไม่มีข้อมูลการเข้าชมในช่วงนี้'))
      + (s.months.length ? '<table class="ov-tbl" style="margin-top:12px"><tr><th>เดือน</th><th class="r">เข้าชม</th></tr>' + s.months.map(function (x) { return '<tr><td>' + E(mn(x.month)) + '</td><td class="r">' + th(x.views) + '</td></tr>'; }).join('') + '</table>' : '')
      + '<h4 style="margin:18px 0 8px">🔎 รายงานละเอียด (เลือกช่วงวันที่เอง)</h4>'
      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><input type="date" id="sFrom" value="' + E(s.rFrom) + '" style="width:auto"> – <input type="date" id="sTo" value="' + E(s.rTo) + '" style="width:auto">'
      + '<button type="button" class="btn sm" id="sGo">ดูช่วงนี้</button><button type="button" class="btn sm ghost" id="sCsv">⬇ ส่งออก CSV</button></div>'
      + '<div id="siteRep" class="ov-mut">กำลังโหลด…</div>'
      + '</div>';
  }

  // [2026-10-31] รายงานละเอียดของช่วงที่เลือก: ผู้เข้าชมไม่ซ้ำ · เทียบยอดขาย · รายหน้า · แหล่งที่มา · อุปกรณ์ · ช่วงเวลา (rep มาจาก admin_site_report)
  var SRC = { direct: 'เข้าตรง', google: 'Google', tiktok: 'TikTok', facebook: 'Facebook', line: 'LINE', youtube: 'YouTube', other: 'อื่นๆ' };
  var DEV = { mobile: '📱 มือถือ', tablet: '📟 แท็บเล็ต', desktop: '💻 คอมพิวเตอร์' };
  var PG = { home: 'หน้าแรก', features: 'ฟีเจอร์', howto: 'วิธีซื้อ/ติดตั้ง', guide: 'คู่มือทำคลิป TikTok', profile: 'โปรไฟล์/สมาชิก' };
  var dkey = function (ms) { var q = new Date(ms); return q.getFullYear() + '-' + ('0' + (q.getMonth() + 1)).slice(-2) + '-' + ('0' + q.getDate()).slice(-2); };
  function salesByDay(S) {
    var map = {}; ((S && S.orders) || []).forEach(function (x) { if (!okStatus(x.status)) return; var k = dkey(payTime(x)), r = map[k] || (map[k] = { n: 0, rev: 0 }); r.n++; r.rev += num(x.total); }); return map;
  }
  function siteReport(rep, S) {
    if (!rep || !Array.isArray(rep.daily)) return empty('โหลดรายงานไม่สำเร็จ');
    var th = function (n) { return num(n).toLocaleString('th-TH'); }, sum = function (k) { return rep.daily.reduce(function (a, x) { return a + num(x[k]); }, 0); }, sd = salesByDay(S);
    var views = sum('views'), visits = sum('visits'), uniq = sum('uniques'), n = 0, rev = 0;
    rep.daily.forEach(function (x) { var r = sd[x.day]; if (r) { n += r.n; rev += r.rev; } });
    var conv = visits ? Math.round(n / visits * 1000) / 10 : 0, pv = visits ? (views / visits).toFixed(1) : '0';
    if (!views) return empty('ยังไม่มีข้อมูลละเอียดในช่วงนี้ — เริ่มเก็บตั้งแต่ ' + (rep.since ? fmtDate(new Date(rep.since + 'T00:00:00').getTime()) : 'วันที่เปิดใช้ตัวนับใหม่'));
    var out = '<div class="ov-strip s4">' + TILE('🚪', 'เข้าเว็บ (ครั้ง)', th(visits), '<span class="ov-mut">หน้าที่เปิด ' + th(views) + ' · ' + pv + ' หน้า/ครั้ง</span>')
      + TILE('🧍', 'ผู้เข้าชมไม่ซ้ำ', th(uniq), '<span class="ov-mut">นับรายวัน (คนเดิมคนละวันนับใหม่)</span>')
      + TILE('🧾', 'ออเดอร์ที่ชำระ', th(n), '<span class="ov-mut">ยอด ' + C.baht(rev) + '</span>')
      + TILE('🎯', 'เข้าชม → ซื้อ', conv + '%', '<span class="ov-mut">ออเดอร์ ÷ การเข้าเว็บ</span>') + '</div>';
    var two = function (t, cap, body) { return '<div class="ov-card" style="box-shadow:none"><h3>' + t + '</h3><div class="cap">' + cap + '</div>' + body + '</div>'; };
    var totV = function (a, k) { return a.reduce(function (s, x) { return s + num(x[k]); }, 0) || 1; };
    var mk = function (arr, key, names, vk) { return arr.map(function (x) { return { label: (names[x[key]] || x[key]) + ' · ' + Math.round(num(x[vk]) / totV(arr, vk) * 100) + '%', value: num(x[vk]) }; }); };
    var pgs = mk(rep.pages, 'page', PG, 'views'), srcs = mk(rep.sources, 'source', SRC, 'visits'), devs = mk(rep.devices, 'device', DEV, 'visits');
    out += '<div class="ov-two">' + two('📄 หน้าที่ถูกเปิดมากสุด', 'จำนวนหน้าที่เปิด', pgs.length ? C.hbars(pgs, {}) : empty('ไม่มีข้อมูล'))
      + two('🧭 แหล่งที่มา', 'เข้าเว็บมาจากไหน (ครั้ง)', srcs.length ? C.hbars(srcs, {}) : empty('ไม่มีข้อมูล')) + '</div>';
    var hrs = (rep.hours || []).map(num);
    out += '<div class="ov-two" style="margin-top:16px">' + two('📱 อุปกรณ์', 'มือถือ vs คอม (ครั้ง)', devs.length ? C.hbars(devs, {}) : empty('ไม่มีข้อมูล'))
      + two('🕐 ช่วงเวลาที่คนเข้า', 'ชั่วโมงตามเวลาไทย (ครั้ง) · สูงสุด ' + (hrs.length ? hrs.indexOf(Math.max.apply(null, hrs)) + ':00 น.' : '-'), hrs.some(function (v) { return v > 0; }) ? C.vbars(hrs, hrs.map(function (v, i) { return i % 3 === 0 ? String(i) : ''; }), { h: 170, color: 'var(--c3)', label: 'เข้าเว็บรายชั่วโมง' }) : empty('ไม่มีข้อมูล')) + '</div>';
    var dv = rep.daily.map(function (x) { return num(x.visits); }), st = Math.max(1, Math.ceil(dv.length / 8));
    out += '<div style="margin-top:16px">' + two('📈 การเข้าเว็บรายวัน (' + E(rep.from) + ' – ' + E(rep.to) + ')', 'ครั้งที่เข้าเว็บต่อวัน', C.vbars(dv, rep.daily.map(function (x, i) { return i % st === 0 ? x.day.slice(8) : ''; }), { h: 170, color: 'var(--c2)', label: 'เข้าเว็บรายวัน' })) + '</div>';
    return out;
  }
  // CSV รายวันของช่วงที่เลือก: เข้าเว็บ + ผู้ไม่ซ้ำ + ออเดอร์/ยอดขายของวันนั้น (เปิดใน Excel ไทยได้: UTF-8 + BOM)
  function siteCsv(rep, S) {
    var cell = function (v) { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }, sd = salesByDay(S);
    var rows = [['วันที่', 'หน้าที่เปิด', 'เข้าเว็บ (ครั้ง)', 'ผู้เข้าชมไม่ซ้ำ', 'ออเดอร์ที่ชำระ', 'ยอดขาย (บาท)']];
    rep.daily.forEach(function (x) { var r = sd[x.day] || { n: 0, rev: 0 }; rows.push([x.day, x.views, x.visits, x.uniques, r.n, r.rev]); });
    rows.push([]); rows.push(['แหล่งที่มา', 'เข้าเว็บ (ครั้ง)']); rep.sources.forEach(function (x) { rows.push([SRC[x.source] || x.source, x.visits]); });
    rows.push([]); rows.push(['อุปกรณ์', 'เข้าเว็บ (ครั้ง)']); rep.devices.forEach(function (x) { rows.push([DEV[x.device] || x.device, x.visits]); });
    rows.push([]); rows.push(['หน้า', 'หน้าที่เปิด']); rep.pages.forEach(function (x) { rows.push([PG[x.page] || x.page, x.views]); });
    return '﻿' + rows.map(function (r) { return r.map(cell).join(','); }).join('\r\n');
  }

  function render(m) {
    var vs = 'เทียบ ' + m.days + ' วันก่อน', dRev = C.delta(m.revenue, m.revenuePrev), dOrd = C.delta(m.orderCount, m.orderPrev), dMem = C.delta(m.membersNew, m.membersNewPrev), a = m.alerts;
    var hasSales = m.revenueDaily.some(function (v) { return v > 0; }), shareMax = Math.max.apply(null, m.topProducts.map(function (p) { return p.rev; }).concat([1])), todo = [];
    if (a.slips) todo.push('<b>' + a.slips + ' สลิปรอตรวจ</b>'); if (a.trials) todo.push('<b>' + a.trials + ' คำขอทดลองฟรี</b>'); if (a.tickets) todo.push('<b>' + a.tickets + ' ตั๋วใหม่</b>'); if (a.lowStock) todo.push('<b>' + a.lowStock + ' สต็อกใกล้หมด</b>');
    var go = a.slips ? 'orders' : a.trials ? 'trials' : a.tickets ? 'feedback' : 'products';
    var step = Math.max(1, Math.ceil(m.days / 6)), tickTotal = m.tickets.reduce(function (s, x) { return s + x.value; }, 0);
    return '<div class="ovw">'
      + '<div class="ov-head"><div><h1>📊 ภาพรวมร้าน</h1><div class="ov-sub">สรุปผลการดำเนินงาน · ' + fmtDate(m.from) + ' – ' + fmtDate(m.to) + '</div></div>'
      + '<div class="ov-tools"><select id="ovDays" aria-label="ช่วงเวลา">' + [7, 30, 90].map(function (d) { return '<option value="' + d + '"' + (d === m.days ? ' selected' : '') + '>' + d + ' วันล่าสุด</option>'; }).join('') + '</select><button class="ov-btn" id="ovCsv" type="button">⬇ ส่งออก CSV</button></div></div>'
      + (todo.length ? '<div class="ov-alert"><span>⚠️ มีงานรอคุณ: ' + todo.join(' · ') + '</span><a href="#" data-gotab="' + go + '">ไปจัดการ →</a></div>' : '<div class="ov-alert ok"><span>✅ ไม่มีงานค้างที่ต้องจัดการตอนนี้</span></div>')
      + '<div class="ov-strip">'
      + TILE('฿', 'รายได้', C.baht(m.revenue), dlt(dRev, vs)) + TILE('🧾', 'ออเดอร์สำเร็จ', m.orderCount, dlt(dOrd, vs))
      + TILE('💰', 'ยอดเฉลี่ย/ออเดอร์', C.baht(m.avgOrder), '<span class="ov-mut">ต่อคำสั่งซื้อ</span>')
      + TILE('👥', 'สมาชิกทั้งหมด', m.membersTotal.toLocaleString('th-TH'), '<span class="ov-mut">+' + m.membersNew + ' ใน ' + m.days + ' วัน</span> ' + (m.membersNewPrev || m.membersNew ? '<span class="delta ' + dMem.cls + '">' + dMem.text + '</span>' : ''))
      + TILE('🔑', 'คีย์ที่ออกแล้ว', m.keysIssued, '<span class="ov-mut">รวมคีย์ทดลอง</span>') + TILE('✅', 'อัตราสำเร็จ', m.conversion + '%', '<span class="ov-mut">ชำระ ÷ สร้างออเดอร์ (' + m.created + ')</span>') + '</div>'
      + '<div class="ov-cols"><div class="ov-stack">'
      + '<div class="ov-card"><div class="ov-big"><b>' + C.baht(m.revenue) + '</b>' + dlt(dRev, vs) + '</div><h3>รายได้รายวัน</h3><div class="cap">ยอดชำระแล้ว ' + m.days + ' วันล่าสุด' + (hasSales ? ' · จุดสูงสุด ' + C.baht(Math.max.apply(null, m.revenueDaily)) : '') + '</div>' + (hasSales ? C.area(m.revenueDaily, m.labels, { h: 280, label: 'รายได้รายวัน', xTicks: 8 }) : empty('ยังไม่มียอดขายในช่วงนี้')) + '</div>'
      + '<div class="ov-two"><div class="ov-card"><h3>ออเดอร์รายวัน</h3><div class="cap">จำนวนคำสั่งซื้อที่ชำระแล้ว</div>' + (hasSales ? C.vbars(m.ordersDaily, m.labels.map(function (l, i) { return i % step === 0 ? l.split(' ')[0] : ''; }), { h: 190, color: 'var(--c2)', hi: m.ordersDaily.indexOf(Math.max.apply(null, m.ordersDaily)), label: 'ออเดอร์รายวัน' }) : empty('ยังไม่มีข้อมูล')) + '</div>'
      + '<div class="ov-card"><h3>ช่วงเวลาที่ลูกค้าสั่งซื้อ</h3><div class="cap">วัน × ชั่วโมง (สีเข้ม = มากกว่า) · ออเดอร์ที่สร้างในช่วงนี้</div>' + (m.created ? C.heat(m.heat) : empty('ยังไม่มีข้อมูล')) + '</div></div>'
      + siteCard(m, step)
      + '<div class="ov-card"><h3>กรวยการทดลองใช้ฟรี → ซื้อแพ็กเกจ</h3><div class="cap">ดูว่าคำขอทดลองกลายเป็นลูกค้าจริงกี่เปอร์เซ็นต์ (ตลอดทั้งระบบ)</div>' + (m.funnel.length ? C.funnel(m.funnel) : empty('ยังไม่มีคำขอทดลองใช้ฟรี')) + '</div>'
      + '</div><div class="ov-stack">'
      + '<div class="ov-card"><h3>สถานะออเดอร์</h3><div class="cap">ทุกออเดอร์ในร้าน</div>' + (m.status.some(function (s) { return s.value > 0; }) ? C.donut(m.status, { sub: 'ออเดอร์', size: 150, thickness: 20 }) : empty('ยังไม่มีออเดอร์')) + '</div>'
      + '<div class="ov-card"><h3>สินค้าขายดี</h3><div class="cap">เรียงตามรายได้ · ' + m.days + ' วันล่าสุด</div>' + (m.topProducts.length ? '<table class="ov-tbl"><tr><th>สินค้า</th><th class="r">ขาย</th><th class="r">รายได้</th></tr>' + m.topProducts.map(function (p) { return '<tr><td>' + E(p.label) + '<span class="share"><i style="width:' + Math.round(p.rev / shareMax * 100) + '%"></i></span></td><td class="r">' + p.value + '</td><td class="r"><b>' + C.baht(p.rev) + '</b></td></tr>'; }).join('') + '</table>' : empty('ยังไม่มียอดขายในช่วงนี้')) + '</div>'
      + '<div class="ov-card"><h3>กิจกรรมล่าสุด</h3><div class="cap">เหตุการณ์ล่าสุดในร้าน</div>' + (m.recent.length ? '<div class="ov-act">' + m.recent.map(function (r) { return '<div><span class="d">' + icon[r.k] + '</span><span><span class="m">' + E(r.m) + '</span><br><span class="t">' + E(r.t) + '</span></span><span class="v">' + E(r.v) + '</span></div>'; }).join('') + '</div>' : empty('ยังไม่มีกิจกรรม')) + '</div>'
      + '<div class="ov-card"><h3>ตั๋วแจ้งปัญหา</h3><div class="cap">ค่าคอมค้างจ่าย ' + C.baht(m.commission.pending) + ' · ตัวแทน ' + m.commission.agents + ' ราย</div>' + (tickTotal ? C.donut(m.tickets, { sub: 'ตั๋ว', size: 130, thickness: 18 }) : empty('ยังไม่มีตั๋ว')) + '</div>'
      + '<div class="ov-card"><h3>🩺 ปัญหาที่ต้องดู</h3><div class="cap">จากการตรวจสุขภาพระบบของร้าน</div>' + (m.health.length ? m.health.map(function (h) { return '<div class="ov-hl"><span class="tag ' + (h.lv === 'err' ? 'err' : 'warn') + '">' + (h.lv === 'err' ? 'ควรแก้' : 'ควรดู') + '</span><span>' + E(h.msg) + '</span></div>'; }).join('') : '<div class="ov-hl"><span class="tag ok">ปกติ</span><span>ไม่พบปัญหา</span></div>') + '</div>'
      + '</div></div></div>';
  }

  // CSV ออเดอร์ในช่วงที่เลือก (เปิดใน Excel ภาษาไทยได้: UTF-8 + BOM) — เซลล์ที่ขึ้นต้นด้วย = + - @ ใส่ ' นำหน้า กันสูตร
  function csv(S, m) {
    var cell = function (v) { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }, stT = { pending: 'รอชำระ', review: 'รอตรวจสลิป', paid: 'ชำระแล้ว', done: 'เสร็จสิ้น', rejected: 'สลิปไม่ผ่าน', cancelled: 'ยกเลิก' };
    var rows = [['เลขที่ออเดอร์', 'วันที่สร้าง', 'ลูกค้า', 'อีเมล', 'รายการ', 'ยอด (บาท)', 'สถานะ']];
    (S.orders || []).filter(function (x) { var a = t(x.createdAt); return a >= m.from && a < m.to + DAY; }).forEach(function (x) { rows.push([x.id, new Date(t(x.createdAt)).toLocaleString('th-TH'), x.customer && x.customer.name, x.customer && x.customer.email, (x.items || []).map(function (i) { return i.name + '×' + i.qty; }).join(' | '), num(x.total), stT[x.status] || x.status]); });
    return '﻿' + rows.map(function (r) { return r.map(cell).join(','); }).join('\r\n');
  }

  var api = { model: model, render: render, csv: csv, ago: ago, siteReport: siteReport, siteCsv: siteCsv };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AdminOverview = api;
})(typeof window !== 'undefined' ? window : this);
