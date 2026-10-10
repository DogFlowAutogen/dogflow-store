/* store.common.js — ตัวช่วยกลาง (ไม่มี state/ไม่เรียกเครือข่าย) ใช้ร่วมกับ store.supabase.js
   ตรวจข้อมูลฝั่งหน้าเว็บเพื่อให้ข้อความผิดพลาดเป็นภาษาไทย — กฎจริงบังคับที่ฐานข้อมูล (schema.sql) อีกชั้นหนึ่ง */
(function (w) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const baht = (n) => '฿' + Number(n || 0).toLocaleString('th-TH');
  const uid = (p) => p + Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');

  // แปลงลิงก์วิดีโอเป็นตัวเล่น (https เท่านั้น)
  function embed(url) {
    let u; try { u = new URL(String(url).trim()); } catch (e) { return null; } if (u.protocol !== 'https:') return null;
    const h = u.hostname.replace(/^www\./, ''); let id, m;
    if (h === 'youtu.be') id = u.pathname.slice(1); else if (h === 'youtube.com' || h.endsWith('.youtube.com')) id = u.searchParams.get('v') || (u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{11})/) || [])[2];
    if (id && /^[\w-]{11}$/.test(id)) return { type: 'iframe', src: 'https://www.youtube-nocookie.com/embed/' + id, thumb: 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg' };
    if (h === 'vimeo.com' && (m = u.pathname.match(/^\/(\d+)/))) return { type: 'iframe', src: 'https://player.vimeo.com/video/' + m[1] };
    if (h === 'drive.google.com' && (m = u.pathname.match(/\/file\/d\/([\w-]+)/))) return { type: 'iframe', src: 'https://drive.google.com/file/d/' + m[1] + '/preview' };
    if (h.endsWith('tiktok.com') && (m = u.pathname.match(/\/video\/(\d+)/))) return { type: 'iframe', src: 'https://www.tiktok.com/embed/v2/' + m[1] };
    if (/\.(mp4|webm|ogg)$/i.test(u.pathname)) return { type: 'video', src: u.href };
    return { type: 'link', src: u.href };
  }

  const activePromos = (promos, now) => { now = now || Date.now(); return promos.filter((x) => x.active && new Date(x.startsAt) <= now && now <= new Date(x.endsAt)); };
  // ราคาแสดงผล = ราคาโปรของสินค้า แล้วหักแคมเปญที่ตรงขอบเขต (เลือกส่วนลดมากสุด 1 แคมเปญ) — ตรงกับ _price() ในฐานข้อมูล; ราคาจริงตอนสั่งซื้อคิดที่เซิร์ฟเวอร์
  function price(p, promos) {
    const base = p.salePrice > 0 ? p.salePrice : p.price;
    const best = activePromos(promos).filter((x) => x.scope === 'all' || x.scope === p.categoryId).reduce((m, x) => Math.max(m, Number(x.percent)), 0);
    return best ? Math.round(base * (100 - best) / 100) : base;
  }
  const activeBanners = (banners, now) => { now = now || Date.now(); return banners.filter((b) => b.active && (!b.startsAt || new Date(b.startsAt) <= now) && (!b.endsAt || now <= new Date(b.endsAt))).sort((a, b) => (a.sort || 0) - (b.sort || 0)); };
  const couponCalc = (c, subtotal) => (c.type === 'percent' ? Math.round(subtotal * c.value / 100) : Math.min(c.value, subtotal));

  // d = { categories, products, brands, members }
  function validate(entity, o, d) {
    const er = [], dupe = (list, key, val) => list.some((x) => x[key] === val && x.id !== o.id);
    if (entity === 'products') {
      if (!o.name || o.name.trim().length < 2) er.push('ชื่อสินค้าสั้นเกินไป');
      if (!o.sku || !o.sku.trim()) er.push('ต้องมี SKU'); else if (dupe(d.products, 'sku', o.sku.trim())) er.push('SKU ซ้ำกับสินค้าอื่น');
      if (!(Number(o.price) > 0) || !Number.isInteger(Number(o.price))) er.push('ราคาต้องเป็นจำนวนเต็มมากกว่า 0');
      if (Number(o.salePrice) < 0) er.push('ราคาโปรติดลบไม่ได้');
      if (Number(o.salePrice) > 0 && Number(o.salePrice) >= Number(o.price)) er.push('ราคาโปรต้องต่ำกว่าราคาปกติ');
      if (!Number.isInteger(Number(o.stock)) || Number(o.stock) < 0) er.push('สต็อกต้องเป็นจำนวนเต็ม ≥ 0');
      if (!d.categories.some((c) => c.id === o.categoryId)) er.push('เลือกหมวดหมู่ไม่ถูกต้อง');
      const ld = Number(o.licenseDevices || 0), ly = Number(o.licenseDays || 0);
      if (!Number.isInteger(ld) || ld < 0 || ld > 50) er.push('จำนวนเครื่อง License ต้อง 0-50 (0 = ไม่ใช่สินค้า License)');
      if (ld > 0 && (!Number.isInteger(ly) || ly < 0 || ly > 3650)) er.push('อายุ License 0-3650 วัน (0 = ตลอดชีพ)');
    } else if (entity === 'categories') {
      if (!o.name || !o.name.trim()) er.push('ต้องมีชื่อหมวดหมู่'); else if (d.categories.some((c) => c.name === o.name.trim() && c.id !== o.id)) er.push('ชื่อหมวดซ้ำ');
    } else if (entity === 'coupons') {
      if (!/^[A-Z0-9_-]{3,20}$/.test(o.code || '')) er.push('โค้ดต้องเป็น A-Z/0-9 ยาว 3-20 ตัว');
      if (!(Number(o.value) > 0) || !Number.isInteger(Number(o.value))) er.push('มูลค่าส่วนลดต้องเป็นจำนวนเต็ม > 0');
      if (o.type === 'percent' && Number(o.value) > 100) er.push('เปอร์เซ็นต์เกิน 100');
    } else if (entity === 'reviews') {
      if (!o.name || !o.text) er.push('กรอกชื่อและข้อความรีวิว'); if (!(o.rating >= 1 && o.rating <= 5)) er.push('คะแนน 1-5');
    } else if (entity === 'banners') {
      if (!o.title || !o.title.trim()) er.push('ใส่ชื่อแบนเนอร์'); if (!o.image) er.push('อัปโหลดภาพแบนเนอร์');
      if (o.link && !/^(https?:\/\/|#|\/)/.test(o.link)) er.push('ลิงก์ต้องขึ้นต้น http(s):// หรือ #');
      if (o.startsAt && o.endsAt && new Date(o.endsAt) <= new Date(o.startsAt)) er.push('วันสิ้นสุดต้องหลังวันเริ่ม');
    } else if (entity === 'brands') {
      if (!o.name || !o.name.trim()) er.push('ใส่ชื่อแบรนด์'); else if (d.brands.some((b) => b.name.toLowerCase() === o.name.trim().toLowerCase() && b.id !== o.id)) er.push('ชื่อแบรนด์ซ้ำ');
      if (!o.logo) er.push('อัปโหลดโลโก้แบรนด์');
    } else if (entity === 'promos') {
      if (!o.name || !o.name.trim()) er.push('ใส่ชื่อโปรโมชัน');
      if (!(Number(o.percent) > 0 && Number(o.percent) <= 90) || !Number.isInteger(Number(o.percent))) er.push('ส่วนลด 1-90%');
      if (o.scope !== 'all' && !d.categories.some((c) => c.id === o.scope)) er.push('เลือกขอบเขตไม่ถูกต้อง');
      if (!o.startsAt || !o.endsAt) er.push('ระบุวันเริ่ม-สิ้นสุด'); else if (new Date(o.endsAt) <= new Date(o.startsAt)) er.push('วันสิ้นสุดต้องหลังวันเริ่ม');
    } else if (entity === 'showcase') {
      if (!o.title || !o.title.trim()) er.push('ใส่หัวข้อ'); if (!o.image) er.push('อัปโหลดภาพหน้าจอ');
    } else if (entity === 'tutorials') {
      if (!o.title || o.title.trim().length < 2) er.push('ใส่ชื่อบทเรียน');
      if (o.kind === 'file' && !o.url && !o.mediaId) er.push('ยังไม่ได้เลือกไฟล์วิดีโอ');
      else if (o.kind !== 'file' && !embed(o.url || '')) er.push('ลิงก์ไม่ถูกต้อง (ต้องเป็น https://)');
    } else if (entity === 'members') {
      if (!o.name || o.name.trim().length < 2) er.push('กรอกชื่อ');
      if (!/^0\d{8,9}$/.test(String(o.phone || '').replace(/[-\s]/g, ''))) er.push('เบอร์โทรไม่ถูกต้อง');
    } else if (entity === 'releases') {
      if (!o.version || !o.version.trim() || o.version.length > 30) er.push('ใส่เลขเวอร์ชัน (ไม่เกิน 30 ตัวอักษร)');
      if (!['windows', 'mac', 'linux', 'other'].includes(o.platform)) er.push('เลือกแพลตฟอร์ม');
      if (!o.filePath && !o.externalUrl) er.push('ต้องอัปโหลดไฟล์ หรือใส่ลิงก์ดาวน์โหลด (https://) อย่างน้อยหนึ่งอย่าง');
      if (o.externalUrl && !/^https:\/\//.test(o.externalUrl)) er.push('ลิงก์ดาวน์โหลดต้องขึ้นต้น https://');
      if (o.sha256 && !/^[0-9a-f]{64}$/.test(o.sha256)) er.push('SHA-256 ต้องเป็นเลขฐานสิบหก 64 ตัว (ตัวพิมพ์เล็ก)');
    } else if (entity === 'faqs') {
      if (!o.q || !o.a) er.push('กรอกคำถามและคำตอบ');
    }
    return er;
  }
  // วัน-เวลาแบบไทย (พ.ศ.) เขตเวลา Asia/Bangkok เช่น "10 ตุลาคม 2569 เวลา 18:30 น."
  const thaiDateTime = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Bangkok' }) + ' น.'; };
  // ปิดจอโหลด (#splash) — เรียกเมื่อโหลดข้อมูลเสร็จหรือล้มเหลว · มีตัวกันค้าง 15 วินาที เผื่อฐานข้อมูลไม่ตอบ
  const hideSplash = () => {
    const el = document.getElementById('splash'); if (!el || el.classList.contains('hide')) return;
    el.classList.add('done'); setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 600); }, 250);
  };
  setTimeout(hideSplash, 15000);
  w.DFCommon = { thaiDateTime, esc, baht, uid, embed, validate, price, activePromos, activeBanners, couponCalc, hideSplash };
})(window);
