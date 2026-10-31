/* [2026-10-31] ตัวนับสถิติเข้าชมแบบละเอียด (ทุกหน้าสาธารณะ) — ส่งเฉพาะ: หน้า · แหล่งที่มา · อุปกรณ์ · เป็นการเข้าใหม่/ผู้เข้าชมใหม่ของวัน
   ไม่เก็บ IP/รหัสผู้ใช้ · ใช้ตัวจำในเบราว์เซอร์ (localStorage) แค่บอกว่า "วันนี้เครื่องนี้เคยนับแล้วหรือยัง" · พังเงียบ ไม่กระทบหน้า */
(function () {
  var w = window, CFG = w.DOGFLOW_CONFIG || {}, PAGE = (document.currentScript && document.currentScript.getAttribute('data-page')) || '';
  if (!PAGE || !CFG.supabaseUrl || !CFG.supabaseAnonKey || !w.fetch) return;
  var ss = function (k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) {} return null; };
  if (ss('df_pg_' + PAGE) === '1') return;                       // นับหน้าละ 1 ครั้งต่อแท็บ
  var firstInTab = ss('df_visit') !== '1';                       // เข้าเว็บครั้งแรกของแท็บนี้ = 1 visit
  var ref = '', q = '';
  try { ref = (document.referrer && new URL(document.referrer).hostname) || ''; q = new URLSearchParams(location.search).get('utm_source') || ''; } catch (e) {}
  var src = 'direct';
  if (firstInTab) {
    var s = (q + ' ' + ref).toLowerCase();
    if (ref && ref === location.hostname) src = 'direct';
    else if (/tiktok/.test(s)) src = 'tiktok'; else if (/facebook|fb\.|fbclid|messenger/.test(s + location.search)) src = 'facebook';
    else if (/line\.|line$|^line/.test(s)) src = 'line'; else if (/youtube|youtu\.be/.test(s)) src = 'youtube'; else if (/google|bing|yahoo|duckduckgo/.test(s)) src = 'google';
    else if (s.trim()) src = 'other';
  }
  var ua = navigator.userAgent || '', dev = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ? 'tablet' : /Mobi|iPhone|Android/i.test(ua) ? 'mobile' : 'desktop';
  var today = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10), isUnique = false;   // วันตามเวลาไทย
  try { if (localStorage.getItem('df_vday') !== today) { isUnique = true; localStorage.setItem('df_vday', today); } } catch (e) {}
  ss('df_pg_' + PAGE, '1'); ss('df_visit', '1');
  try {
    fetch(CFG.supabaseUrl + '/rest/v1/rpc/site_track', { method: 'POST', keepalive: true,
      headers: { apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + CFG.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_page: PAGE, p_source: src, p_device: dev, p_visit: firstInTab, p_unique: isUnique }) }).catch(function () {});
  } catch (e) {}
})();
