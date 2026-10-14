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
    var health = (S.health || []).filter(function (h) { return h && h.msg; }).slice(0, 5);
    var lowStock = products.filter(function (p) { return p.active && num(p.stock) <= 5; }).length;
    return {
      days: days, now: now, from: from, to: today, labels: labels, revenueDaily: revenueDaily, ordersDaily: ordersDaily, heat: heat,
      revenue: revenue, revenuePrev: revenuePrev, orderCount: orderCount, orderPrev: orderPrev, avgOrder: orderCount ? Math.round(revenue / orderCount) : 0,
      membersTotal: members.length, membersNew: membersNew, membersNewPrev: membersNewPrev, keysIssued: keysIssued, conversion: created ? Math.round(createdOk / created * 1000) / 10 : 0, created: created,
      status: status, topProducts: top, funnel: funnel, tickets: ticketsBy, commission: { pending: comPending, paid: comPaid, agents: Object.keys(agents).length }, recent: recent, health: health,
      alerts: { slips: statusCount.review, trials: ((S.trialQ && S.trialQ.pending) || []).length, tickets: tk.new, lowStock: lowStock }
    };
  }

  var dlt = function (d, txt) { return '<span class="delta ' + d.cls + '">' + d.text + '</span> <span class="ov-mut">' + txt + '</span>'; };
  var fmtDate = function (ms) { var d = new Date(ms); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + (d.getFullYear() + 543); };
  var TILE = function (icon, lb, n, sub) { return '<div><div class="lb"><i>' + icon + '</i>' + lb + '</div><div class="n">' + n + '</div>' + sub + '</div>'; };
  var icon = { order: '🛒', member: '👤', ticket: '💬', trial: '🎁' };
  var empty = function (msg) { return '<p class="ov-empty">' + E(msg) + '</p>'; };

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

  var api = { model: model, render: render, csv: csv, ago: ago };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AdminOverview = api;
})(typeof window !== 'undefined' ? window : this);
