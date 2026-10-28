/* [2026-10-28] การ์ด "ยอดเข้าชมวันนี้" ที่หน้าแรก — นับ 1 ครั้งต่อแท็บ (sessionStorage) แล้วแสดงยอดวันนี้เทียบเมื่อวาน
   ยังไม่ได้ลงฟังก์ชัน SQL (site-traffic.sql) หรือเรียกไม่สำเร็จ = ซ่อนการ์ดเงียบๆ ไม่กระทบหน้าอื่น */
(function () {
  var w = window, CFG = w.DOGFLOW_CONFIG || {}, box = document.getElementById('trafficCard'), boxA = document.getElementById('trafficTrend');
  if (!box || !w.supabase || !CFG.supabaseUrl || !CFG.supabaseAnonKey) return;
  var sb = w.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  var counted = false;
  try { counted = sessionStorage.getItem('df_hit') === '1'; } catch (e) {}
  sb.rpc(counted ? 'site_today' : 'site_hit').then(function (r) {
    if (r.error || !r.data) return;
    try { sessionStorage.setItem('df_hit', '1'); } catch (e) {}
    var t = Number(r.data.today) || 0, y = Number(r.data.yesterday) || 0;
    var pct = y > 0 ? Math.min(100, Math.round(t * 100 / y)) : 100;
    var diff = y > 0 ? Math.round((t - y) * 100 / y) : null;
    var d = diff == null ? '' : ' · <span class="' + (diff >= 0 ? 'tc-up' : 'tc-dn') + '">' + (diff >= 0 ? '▲ ' : '▼ ') + Math.abs(diff) + '%</span>';
    box.innerHTML = '<div class="tc-ic">👁</div><div class="tc-body"><div class="tc-lbl">ยอดเข้าชมวันนี้</div>' +
      '<div class="tc-num">' + t.toLocaleString('th-TH') + '</div>' +
      '<div class="tc-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="tc-sub">เมื่อวาน ' + y.toLocaleString('th-TH') + d + '</div></div>';
    box.hidden = false;
    // การ์ดแบบ A: ยอด 7 วัน + เส้นแนวโน้ม (ต้องมีข้อมูลอย่างน้อย 2 วัน)
    var wk = Array.isArray(r.data.week) ? r.data.week.map(Number) : [];
    if (boxA && wk.length > 1) {
      var sum = wk.reduce(function (a, b) { return a + b; }, 0), mx = Math.max.apply(null, wk) || 1, n = wk.length;
      var pts = wk.map(function (v, i) { return (i * 100 / (n - 1)).toFixed(1) + ' ' + (32 - v * 28 / mx).toFixed(1); });
      var line = 'M' + pts.join('L');
      boxA.innerHTML = '<div class="tc-lbl">ยอดเข้าชม 7 วัน</div><div class="tc-num">' + sum.toLocaleString('th-TH') + '</div>' +
        '<svg viewBox="0 0 100 36" preserveAspectRatio="none"><path class="f" d="' + line + 'L100 36L0 36Z"/><path d="' + line + '"/></svg>';
      boxA.hidden = false;
    }
  });
})();
