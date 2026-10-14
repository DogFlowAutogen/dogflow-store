/* ชุดวาดกราฟ SVG ล้วน (ไม่พึ่งไลบรารีภายนอก) สำหรับหน้า "ภาพรวม" ของแอดมิน
   ทุกฟังก์ชันรับข้อมูลตัวเลขล้วน คืนสตริง SVG/HTML — ไม่แตะ DOM/เครือข่าย จึงทดสอบแยกได้ · สีมาจากตัวแปร CSS (--c1..--c6) เพื่อสลับธีมได้
   ข้อความที่มาจากผู้ใช้ (ชื่อสินค้า/ลูกค้า) ต้องผ่าน esc() ทุกครั้ง */
(function (root) {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var num = function (n) { n = Number(n); return isFinite(n) ? n : 0; };
  var fmt = function (n) { n = num(n); return Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : Math.abs(n) >= 1e4 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k' : n.toLocaleString('th-TH'); };
  var baht = function (n) { return '฿' + num(n).toLocaleString('th-TH', { maximumFractionDigits: 0 }); };
  var uid = 0, nid = function (p) { return p + (++uid); };

  // เส้นโค้งนุ่ม (Catmull-Rom → Bezier) ผ่านทุกจุด ไม่เกินช่วงข้อมูลมาก
  function smooth(pts, yMin, yMax) {
    var cl = function (y) { return yMin == null ? y : Math.max(yMin, Math.min(yMax, y)); };
    if (pts.length < 2) return pts.length ? 'M' + pts[0][0] + ',' + pts[0][1] : '';
    var d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = 0.18;
      d += ' C' + (p1[0] + (p2[0] - p0[0]) * t).toFixed(1) + ',' + cl(p1[1] + (p2[1] - p0[1]) * t).toFixed(1) + ' ' + (p2[0] - (p3[0] - p1[0]) * t).toFixed(1) + ',' + cl(p2[1] - (p3[1] - p1[1]) * t).toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
    }
    return d;
  }
  function scale(vals, h, pad, min0) {
    var mx = Math.max.apply(null, vals.map(num).concat([1])), mn = min0 === false ? Math.min.apply(null, vals.map(num)) : 0;
    if (mx === mn) mx = mn + 1;
    return function (v) { return pad + (h - 2 * pad) * (1 - (num(v) - mn) / (mx - mn)); };
  }

  // กราฟเส้นเล็กในการ์ด (sparkline) — color = ค่า CSS เช่น "var(--c1)"
  function spark(vals, o) {
    o = o || {}; vals = (vals || []).map(num); var w = o.w || 120, h = o.h || 36, y = scale(vals, h, 3), step = vals.length > 1 ? w / (vals.length - 1) : w;
    var pts = vals.map(function (v, i) { return [i * step, y(v)]; }), id = nid('sp'), c = o.color || 'var(--c1)';
    var line = smooth(pts);
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c + '" stop-opacity=".35"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></linearGradient></defs>'
      + (vals.length > 1 ? '<path d="' + line + ' L' + w + ',' + h + ' L0,' + h + ' Z" fill="url(#' + id + ')"/><path d="' + line + '" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' : '') + '</svg>';
  }

  // กราฟพื้นที่ + เส้นตาราง + ป้ายแกน (ยอดขายรายวัน) · labels = ป้ายแกน X (แสดงเว้นช่วงอัตโนมัติ)
  function area(vals, labels, o) {
    o = o || {}; vals = (vals || []).map(num); var w = o.w || 720, h = o.h || 260, padL = 46, padR = 12, padT = 14, padB = 26, c = o.color || 'var(--c1)', id = nid('ar');
    var mx = Math.max.apply(null, vals.concat([1])), nice = niceMax(mx), iw = w - padL - padR, ih = h - padT - padB;
    var X = function (i) { return padL + (vals.length > 1 ? iw * i / (vals.length - 1) : iw / 2); }, Y = function (v) { return padT + ih * (1 - v / nice); };
    var grid = '', ticks = 4;
    for (var g = 0; g <= ticks; g++) { var gv = nice * g / ticks, gy = Y(gv); grid += '<line x1="' + padL + '" x2="' + (w - padR) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '" class="ch-grid"/><text x="' + (padL - 8) + '" y="' + (gy + 4).toFixed(1) + '" text-anchor="end" class="ch-ax">' + fmt(gv) + '</text>'; }
    var every = Math.max(1, Math.ceil(vals.length / (o.xTicks || 8))), xs = '';
    (labels || []).forEach(function (l, i) { if (i % every === 0 || (i === vals.length - 1 && (vals.length - 1) % every >= every * 0.6)) xs += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 6) + '" text-anchor="middle" class="ch-ax">' + esc(l) + '</text>'; });
    var pts = vals.map(function (v, i) { return [X(i), Y(v)]; }), line = smooth(pts, padT, Y(0)), last = pts[pts.length - 1] || [0, 0], maxI = vals.indexOf(Math.max.apply(null, vals));
    return '<svg class="chart-area" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(o.label || 'กราฟพื้นที่') + '"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c + '" stop-opacity=".38"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></linearGradient></defs>' + grid + xs
      + (vals.length > 1 ? '<path d="' + line + ' L' + X(vals.length - 1).toFixed(1) + ',' + Y(0) + ' L' + X(0).toFixed(1) + ',' + Y(0) + ' Z" fill="url(#' + id + ')"/><path d="' + line + '" fill="none" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round"/>' : '')
      + (vals.length ? '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="4.5" fill="' + c + '" stroke="var(--bg-card,#fff)" stroke-width="2"/>' : '')
      + (vals.length > 3 && maxI >= 0 ? '<g class="ch-peak"><circle cx="' + pts[maxI][0].toFixed(1) + '" cy="' + pts[maxI][1].toFixed(1) + '" r="3.5" fill="' + c + '"/><text x="' + pts[maxI][0].toFixed(1) + '" y="' + (pts[maxI][1] - 9).toFixed(1) + '" text-anchor="middle" class="ch-peak-t">' + fmt(vals[maxI]) + '</text></g>' : '') + '</svg>';
  }
  function niceMax(mx) { var p = Math.pow(10, Math.floor(Math.log10(mx))), n = mx / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }

  // แท่งแนวนอน (อันดับสินค้า) — items: [{label, value, sub?}] · แท่งสีไล่ตามอันดับ
  function hbars(items, o) {
    o = o || {}; items = items || []; var mx = Math.max.apply(null, items.map(function (x) { return num(x.value); }).concat([1])), unit = o.unit || '';
    return '<div class="hbars">' + items.map(function (x, i) {
      var pct = Math.max(2, Math.round(num(x.value) / mx * 100));
      return '<div class="hb"><div class="hb-top"><span class="hb-rank">' + (i + 1) + '</span><span class="hb-l">' + esc(x.label) + '</span><b class="hb-v">' + (o.money ? baht(x.value) : fmt(x.value)) + unit + '</b></div><div class="hb-track"><i style="width:' + pct + '%;background:var(--c' + ((i % 6) + 1) + ')"></i></div></div>';
    }).join('') + '</div>';
  }

  // แท่งแนวตั้งรายวัน/รายเดือน — vals + labels
  function vbars(vals, labels, o) {
    o = o || {}; vals = (vals || []).map(num); var w = o.w || 560, h = o.h || 200, padB = 24, padT = 10, mx = niceMax(Math.max.apply(null, vals.concat([1]))), bw = vals.length ? (w / vals.length) : w, g = Math.min(8, bw * 0.28), c = o.color || 'var(--c1)';
    var bars = vals.map(function (v, i) {
      var bh = (h - padT - padB) * v / mx, x = i * bw + g / 2, y = h - padB - bh;
      return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(2, bw - g).toFixed(1) + '" height="' + Math.max(0, bh).toFixed(1) + '" rx="4" fill="' + (o.hi === i ? 'var(--c2)' : c) + '" opacity="' + (o.hi === i ? 1 : 0.9) + '"/>'
        + (labels && labels[i] != null ? '<text x="' + (x + (bw - g) / 2).toFixed(1) + '" y="' + (h - 7) + '" text-anchor="middle" class="ch-ax">' + esc(labels[i]) + '</text>' : '');
    }).join('');
    return '<svg class="chart-bars" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(o.label || 'กราฟแท่ง') + '"><line x1="0" x2="' + w + '" y1="' + (h - padB) + '" y2="' + (h - padB) + '" class="ch-grid"/>' + bars + '</svg>';
  }

  // โดนัท + ตัวเลขกลาง — items: [{label, value, color?}]
  function donut(items, o) {
    o = o || {}; items = (items || []).filter(function (x) { return num(x.value) > 0; }); var size = o.size || 170, th = o.thickness || 22, r = (size - th) / 2, cx = size / 2, C = 2 * Math.PI * r, total = items.reduce(function (s, x) { return s + num(x.value); }, 0), off = 0;
    var segs = items.map(function (x, i) { var len = C * num(x.value) / total, gap = items.length > 1 ? 3 : 0, s = '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="' + (x.color || 'var(--c' + ((i % 6) + 1) + ')') + '" stroke-width="' + th + '" stroke-dasharray="' + Math.max(0, len - gap).toFixed(2) + ' ' + (C - Math.max(0, len - gap)).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cx + ')" stroke-linecap="butt"/>'; off += len; return s; }).join('');
    var legend = '<ul class="legend">' + items.map(function (x, i) { return '<li><i style="background:' + (x.color || 'var(--c' + ((i % 6) + 1) + ')') + '"></i><span>' + esc(x.label) + '</span><b>' + fmt(x.value) + '</b><em>' + Math.round(num(x.value) / total * 100) + '%</em></li>'; }).join('') + '</ul>';
    return '<div class="donut-wrap"><svg class="donut" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="' + esc(o.label || 'โดนัท') + '"><circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" class="donut-bg" stroke-width="' + th + '"/>' + segs
      + '<text x="' + cx + '" y="' + (cx - 2) + '" text-anchor="middle" class="donut-n">' + esc(o.center != null ? o.center : fmt(total)) + '</text><text x="' + cx + '" y="' + (cx + 17) + '" text-anchor="middle" class="donut-s">' + esc(o.sub || 'ทั้งหมด') + '</text></svg>' + (o.legend === false ? '' : legend) + '</div>';
  }

  // วงแหวนความคืบหน้า (เช่น อัตราสั่งซื้อสำเร็จ) — pct 0..100
  function ring(pct, o) {
    o = o || {}; pct = Math.max(0, Math.min(100, num(pct))); var size = o.size || 96, th = o.thickness || 10, r = (size - th) / 2, C = 2 * Math.PI * r, c = o.color || 'var(--c1)';
    return '<svg class="ring" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="' + esc((o.label || '') + ' ' + Math.round(pct) + '%') + '"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" class="donut-bg" stroke-width="' + th + '"/><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + c + '" stroke-width="' + th + '" stroke-linecap="round" stroke-dasharray="' + (C * pct / 100).toFixed(2) + ' ' + C.toFixed(2) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/><text x="50%" y="' + (size / 2 + 6) + '" text-anchor="middle" class="ring-n">' + Math.round(pct) + '%</text></svg>';
  }

  // ผังความร้อน 7 วัน × 24 ชม. (เวลาที่ลูกค้าสั่งซื้อ) — matrix[7][24]
  function heat(matrix, o) {
    o = o || {}; var days = o.days || ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'], mx = 1; matrix.forEach(function (r) { r.forEach(function (v) { mx = Math.max(mx, num(v)); }); });
    var cell = 18, gap = 3, lw = 26, w = lw + 24 * (cell + gap), h = 7 * (cell + gap) + 18, out = '';
    for (var d = 0; d < 7; d++) { out += '<text x="0" y="' + (d * (cell + gap) + 13) + '" class="ch-ax">' + days[d] + '</text>'; for (var hh = 0; hh < 24; hh++) { var v = num(matrix[d][hh]), a = v ? 0.12 + 0.88 * v / mx : 0.05; out += '<rect x="' + (lw + hh * (cell + gap)) + '" y="' + (d * (cell + gap)) + '" width="' + cell + '" height="' + cell + '" rx="4" fill="var(--c1)" opacity="' + a.toFixed(2) + '"><title>' + days[d] + ' ' + hh + ':00 — ' + v + ' ออเดอร์</title></rect>'; } }
    for (var t = 0; t < 24; t += 3) out += '<text x="' + (lw + t * (cell + gap) + cell / 2) + '" y="' + (h - 3) + '" text-anchor="middle" class="ch-ax">' + t + '</text>';
    return '<svg class="chart-heat" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(o.label || 'ผังความร้อน') + '">' + out + '</svg>';
  }

  // กรวย (funnel) — steps: [{label, value}] เช่น ขอทดลอง → อนุมัติ → ซื้อแพ็กเกจ
  function funnel(steps) {
    steps = steps || []; var mx = Math.max.apply(null, steps.map(function (s) { return num(s.value); }).concat([1]));
    return '<div class="funnel">' + steps.map(function (s, i) { var pct = Math.max(6, Math.round(num(s.value) / mx * 100)), prev = i ? num(steps[i - 1].value) : 0, conv = i && prev ? Math.round(num(s.value) / prev * 100) + '% จากขั้นก่อน' : '';
      return '<div class="fn"><div class="fn-bar" style="width:' + pct + '%;background:var(--c' + ((i % 6) + 1) + ')"><b>' + fmt(s.value) + '</b></div><div class="fn-l"><span>' + esc(s.label) + '</span><em>' + conv + '</em></div></div>'; }).join('') + '</div>';
  }

  // ตัวบอกการเปลี่ยนแปลง ▲▼ เทียบช่วงก่อน — คืน {cls,text}
  function delta(cur, prev) {
    cur = num(cur); prev = num(prev); if (!prev) return { cls: 'flat', text: cur ? 'ใหม่' : '—' };
    var p = (cur - prev) / prev * 100, r = Math.round(Math.abs(p) * 10) / 10;
    return { cls: p > 0.5 ? 'up' : p < -0.5 ? 'down' : 'flat', text: (p > 0.5 ? '▲ ' : p < -0.5 ? '▼ ' : '● ') + r + '%' };
  }

  var api = { esc: esc, fmt: fmt, baht: baht, spark: spark, area: area, hbars: hbars, vbars: vbars, donut: donut, ring: ring, heat: heat, funnel: funnel, delta: delta, niceMax: niceMax };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AdminCharts = api;
})(typeof window !== 'undefined' ? window : this);
