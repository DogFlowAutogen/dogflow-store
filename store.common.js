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

  // ตัวแปลงลิงก์ "ผลงานลูกค้า" (คลิปสั้นแนวตั้ง) → { platform, label, icon, type:'iframe'|'video'|'link', src, thumb, open, ratio, short }
  // รองรับ YouTube (รวม Shorts) · TikTok (ลิงก์เต็ม .../video/เลข) · Instagram Reels/โพสต์ · Facebook Reels/วิดีโอ · ไฟล์ .mp4/.webm · อื่น ๆ = เปิดแท็บใหม่
  // ตัวเล่นของแต่ละแพลตฟอร์มโหลดเมื่อผู้เข้าชมกดเล่นเท่านั้น (ดู index.html) — ลิงก์ย่อของ TikTok (vm./vt./tiktok.com/t/) แปลงเป็นลิงก์เต็มในเบราว์เซอร์ไม่ได้ → short:true
  function clip(url) {
    let u; try { u = new URL(String(url || '').trim()); } catch (e) { return null; } if (u.protocol !== 'https:') return null;
    const h = u.hostname.replace(/^(www|m|mobile)\./, ''), is = (d) => h === d || h.endsWith('.' + d); let id, m;
    const out = (platform, label, icon, o) => Object.assign({ platform, label, icon, type: 'link', src: u.href, thumb: '', open: u.href, ratio: '9/16', short: false }, o);
    if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0]; else if (is('youtube.com')) id = u.searchParams.get('v') || (u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{11})/) || [])[2];
    if (id && /^[\w-]{11}$/.test(id)) { const sh = /^\/shorts\//.test(u.pathname); return out('youtube', 'YouTube', '▶️', { type: 'iframe', src: 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&playsinline=1&rel=0', thumb: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg', open: 'https://www.youtube.com/watch?v=' + id, ratio: sh ? '9/16' : '16/9' }); }
    if (is('tiktok.com')) {
      if ((m = u.pathname.match(/\/video\/(\d{8,25})/))) return out('tiktok', 'TikTok', '🎵', { type: 'iframe', src: 'https://www.tiktok.com/player/v1/' + m[1] + '?autoplay=1&controls=1&progress_bar=1&play_button=1&volume_control=1&fullscreen_button=1&description=0&music_info=0' });
      return out('tiktok', 'TikTok', '🎵', { short: true });
    }
    if (is('instagram.com') && (m = u.pathname.match(/^\/(?:[\w.]+\/)?(reel|reels|p|tv)\/([\w-]{5,})/))) { const k = m[1] === 'reels' ? 'reel' : m[1]; return out('instagram', 'Instagram', '📸', { type: 'iframe', src: 'https://www.instagram.com/' + k + '/' + m[2] + '/embed', open: 'https://www.instagram.com/' + k + '/' + m[2] + '/' }); }
    if (is('instagram.com')) return out('instagram', 'Instagram', '📸');
    if (is('facebook.com') || is('fb.watch') || is('fb.com')) {
      const vid = h === 'fb.watch' || /\/(reel|reels|watch|videos|video\.php)(\/|$|\?)/.test(u.pathname + u.search);
      if (/^\/share\//.test(u.pathname) && h !== 'fb.watch') return out('facebook', 'Facebook', '👍', { short: true });   // ลิงก์แชร์ → ต้องให้เซิร์ฟเวอร์ขยายเป็นลิงก์เต็มก่อน (ฟอร์มแอดมินทำให้ตอนบันทึก)
      return out('facebook', 'Facebook', '👍', vid ? { type: 'iframe', src: 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(u.href) + '&show_text=false&autoplay=true&width=380' } : {});
    }
    if (/\.(mp4|webm|ogg)$/i.test(u.pathname)) return out('file', 'ไฟล์วิดีโอ', '🎞️', { type: 'video' });
    return out('other', 'ลิงก์ภายนอก', '🔗');
  }

  const activePromos = (promos, now) => { now = now || Date.now(); return promos.filter((x) => x.active && new Date(x.startsAt) <= now && now <= new Date(x.endsAt)); };
  // ราคาแสดงผล = ราคาโปรของสินค้า แล้วหักแคมเปญที่ตรงขอบเขต (เลือกส่วนลดมากสุด 1 แคมเปญ) — ตรงกับ _price() ในฐานข้อมูล; ราคาจริงตอนสั่งซื้อคิดที่เซิร์ฟเวอร์
  function price(p, promos) {
    const base = p.salePrice > 0 ? p.salePrice : p.price;
    const best = activePromos(promos).filter((x) => x.scope === 'all' || x.scope === p.categoryId).reduce((m, x) => Math.max(m, Number(x.percent)), 0);
    return best ? Math.round(base * (100 - best) / 100) : base;
  }
  const activeBanners = (banners, now) => { now = now || Date.now(); return banners.filter((b) => b.active && (!b.startsAt || new Date(b.startsAt) <= now) && (!b.endsAt || now <= new Date(b.endsAt))).sort((a, b) => (a.sort || 0) - (b.sort || 0)); };
  const activeBlocks = (blocks, now) => { now = now || Date.now(); return blocks.filter((b) => b.active && (!b.startsAt || new Date(b.startsAt) <= now) && (!b.endsAt || now <= new Date(b.endsAt))).sort((a, b) => (a.sort || 0) - (b.sort || 0)); };

  /* ---------- บล็อกหน้าแรก: ชนิด + ฟิลด์ของแต่ละชนิด (ใช้ร่วมกันทั้งฟอร์มแอดมิน/ตัวตรวจ/ตัวแปลงข้อมูล) ----------
     รายการแบบหลายบรรทัด (list:true) แยกช่องด้วย "|" — โครงของแต่ละบรรทัดบอกไว้ใน label */
  const CTA = [{ k: 'cta1Text', label: 'ปุ่มหลัก: ข้อความ' }, { k: 'cta1Link', label: 'ปุ่มหลัก: ลิงก์ (#shop · https://… · cart:รหัสสินค้า = ใส่ตะกร้าให้เลย)' }, { k: 'cta2Text', label: 'ปุ่มรอง: ข้อความ (ไม่ใส่ = ไม่แสดง)' }, { k: 'cta2Link', label: 'ปุ่มรอง: ลิงก์ (https://… · #… · cart:รหัสสินค้า)' }];
  const BLOCKS = {
    promo: { label: '🔥 โปรโมชัน (ภาพ + ราคา + นับถอยหลัง)', hint: 'ภาพซ้าย ข้อความขวา มีกล่องราคาและเวลานับถอยหลังถึง "วันสิ้นสุดแสดง"', fields: [
      { k: 'image', label: 'ภาพสินค้า/โปสเตอร์ (แนวตั้งหรือสี่เหลี่ยม)', type: 'image', max: 900, full: true },
      { k: 'badge', label: 'ป้ายเล็กด้านบน (เช่น 🔥 โปรพิเศษ ถึงสิ้นเดือนนี้)', full: true }, { k: 'head', label: 'หัวข้อ' }, { k: 'accent', label: 'คำเน้นสี (ต่อท้ายหัวข้อ)' },
      { k: 'sub', label: 'คำอธิบายสั้น', type: 'textarea', full: true },
      { k: 'chips', label: 'จุดเด่น (บรรทัดละ 1 อัน: อีโมจิ|ข้อความ)', type: 'textarea', list: true, full: true },
      { k: 'productId', label: '🔗 สินค้าที่ผูก — ราคา/ราคาปกติ/สต็อกดึงจากสินค้าจริงอัตโนมัติ', type: 'select', ref: 'products', full: true },
      { k: 'promoId', label: '🔗 โปรโมชันที่ผูก — นับถอยหลังถึงเวลาสิ้นสุดจริงของโปรนี้', type: 'select', ref: 'promos', full: true },
      { k: 'priceLabel', label: 'ป้ายเหนือราคา (เช่น ราคาโปร)' }, { k: 'priceNote', label: 'ข้อความข้างราคา (เช่น จ่ายครั้งเดียวจบ)' },
      { k: 'countdown', label: '⏰ แสดงเวลานับถอยหลัง (ถ้าไม่ผูกโปร จะนับถึง "หยุดแสดง" ของบล็อก)', type: 'check', full: true }, { k: 'note', label: 'หมายเหตุใต้ราคา', full: true }, ...CTA] },
    hero: { label: '✨ แบนเนอร์กลางหน้า (ข้อความใหญ่ กลางจอ)', hint: 'พื้นไล่สี ข้อความใหญ่ตรงกลาง พร้อมป้ายจุดเด่นและปุ่ม', fields: [
      { k: 'deco', label: 'อีโมจิประดับรอบกรอบ (พิมพ์ติดกันได้สูงสุด 6 ตัว)' }, { k: 'head', label: 'หัวข้อบรรทัดแรก' }, { k: 'accent', label: 'หัวข้อบรรทัดใหญ่ (สีทอง)' },
      { k: 'chips', label: 'ป้ายจุดเด่น (บรรทัดละ 1 อัน: อีโมจิ|ข้อความ)', type: 'textarea', list: true, full: true },
      { k: 'sub', label: 'คำอธิบาย', type: 'textarea', full: true }, ...CTA] },
    steps: { label: '🧭 ขั้นตอนการทำงาน (การ์ดขั้นตอน 1-2-3…)', hint: 'ชื่อโปรแกรม + ขั้นตอนเรียงเป็นการ์ด + ป้ายแพลตฟอร์มที่รองรับ + ปุ่ม', fields: [
      { k: 'icon', label: 'ไอคอนโปรแกรม (อีโมจิ)' }, { k: 'tag', label: 'ป้ายเล็ก (เช่น คู่มือฟรี 16 คลิป)' }, { k: 'head', label: 'ชื่อโปรแกรม' }, { k: 'accent', label: 'คำเน้นสี (ต่อท้ายชื่อ)' },
      { k: 'sub', label: 'สโลแกนด้านขวา', full: true },
      { k: 'steps', label: 'ขั้นตอน (บรรทัดละ 1 ขั้น: อีโมจิ|ข้อความ)', type: 'textarea', list: true, full: true },
      { k: 'chipsLabel', label: 'หัวป้ายแพลตฟอร์ม (เช่น 🧠 ใช้ได้ทั้ง AI)' }, { k: 'chips', label: 'ป้ายแพลตฟอร์ม (บรรทัดละ 1 อัน)', type: 'textarea', list: true },
      { k: 'meta', label: 'ข้อมูลท้ายการ์ด (บรรทัดละ 1 อัน: อีโมจิ|ข้อความ · ใส่ {version} = เวอร์ชันล่าสุดจริงที่เผยแพร่)', type: 'textarea', list: true, full: true }, ...CTA] },
    buy: { label: '🛒 การ์ดแพ็กเกจ / สั่งซื้อ (ภาพ + แพ็กเกจ + รายการ)', hint: 'ภาพซ้าย ขวามีแพ็กเกจราคา รายการที่ได้ ข้อกำหนดเครื่อง และปุ่มสั่งซื้อ', fields: [
      { k: 'image', label: 'ภาพสินค้า/โปสเตอร์', type: 'image', max: 900, full: true },
      { k: 'head', label: 'หัวข้อ', full: true }, { k: 'sub', label: 'คำอธิบายสั้น', type: 'textarea', full: true },
      { k: 'plans', label: 'แพ็กเกจ (บรรทัดละ 1 อัน — แนะนำ @รหัสสินค้า เช่น @p-year ระบบดึงชื่อ/ราคาจริง/อายุ/จำนวนเครื่องให้ · หรือพิมพ์เอง: ชื่อ|ราคา|หน่วย|หมายเหตุ · ขึ้นต้น * = ไฮไลต์)', type: 'textarea', list: true, full: true },
      { k: 'features', label: 'สิ่งที่ได้รับ (บรรทัดละ 1 ข้อ)', type: 'textarea', list: true, full: true },
      { k: 'reqs', label: 'ข้อกำหนดเครื่อง (บรรทัดละ 1 ข้อ: ขึ้นต้น + = ผ่าน, - = ไม่รองรับ)', type: 'textarea', list: true, full: true },
      { k: 'foot', label: 'ข้อความท้ายการ์ด (เช่น LINE ID · เงื่อนไข)', full: true }, ...CTA.slice(0, 2), ...CTA.slice(2)] }
  };
  const BLOCK_COMMON = [{ k: 'title', label: 'ชื่อบล็อก (ใช้ในหน้าแอดมินเท่านั้น)', full: true }, { k: 'sort', label: 'ลำดับ (น้อยขึ้นก่อน)', type: 'number' }, { k: 'active', label: 'เปิดแสดง', type: 'check' }, { k: 'startsAt', label: 'เริ่มแสดง (ว่าง = ทันที)', type: 'datetime' }, { k: 'endsAt', label: 'หยุดแสดง (ว่าง = ไม่จำกัด / ใช้เป็นเวลานับถอยหลัง)', type: 'datetime' }];
  const blockFields = (kind, ctx) => [...BLOCK_COMMON, ...(BLOCKS[kind] ? BLOCKS[kind].fields : [])].map((f) => !f.ref ? f : Object.assign({}, f, { opts: [['', '— ไม่ผูก —'], ...((ctx && ctx[f.ref]) || []).map((x) => [x.id, f.ref === 'products' ? x.name + ' · ' + x.id : x.name + ' (' + x.percent + '% · ' + x.id + ')'])] }));
  const BLOCK_COLS = ['id', 'kind', 'title', 'image', 'sort', 'startsAt', 'endsAt', 'active'];
  const linkOk = (s) => !s || /^(https?:\/\/|#|\/|cart:[A-Za-z0-9_-]+$)/.test(s);
  const cartId = (s) => { const m = /^cart:([A-Za-z0-9_-]+)$/.exec(s || ''); return m ? m[1] : ''; };
  // d = { blocks, products, promos } · คืน [{lv:'err'|'warn', msg}] — เฉพาะบล็อกที่เปิดอยู่
  function blockHealth(d) {
    const r = [], now = Date.now(), add = (lv, msg) => r.push({ lv, msg }), P = (id) => (d.products || []).find((x) => x.id === id), M = (id) => (d.promos || []).find((x) => x.id === id);
    (d.blocks || []).filter((b) => b.active).forEach((b) => {
      const n = 'บล็อก "' + b.title + '": ', add = (lv, msg) => r.push({ lv, msg, tab: 'blocks', id: b.id });   // add ของบล็อก: แนบปลายทางให้กดไปแก้ไข
      if (b.endsAt && new Date(b.endsAt) < now) add('warn', n + 'หมดช่วงแสดงแล้ว (' + b.endsAt.slice(0, 10) + ') — ปิดหรือต่อเวลา');
      if (BLOCKS[b.kind] && BLOCKS[b.kind].fields.some((f) => f.k === 'image') && !b.image) add('warn', n + 'ยังไม่มีภาพ');
      if (b.productId) { const p = P(b.productId); if (!p) add('err', n + 'สินค้าที่ผูกไว้ถูกลบแล้ว — ราคาจึงไม่แสดง'); else if (!p.active) add('warn', n + 'สินค้า "' + p.name + '" ปิดขายอยู่ — ราคาจึงไม่แสดง'); else if (p.stock <= 0) add('warn', n + 'สินค้า "' + p.name + '" สต็อกหมด'); }
      if (b.promoId) { const m = M(b.promoId); if (!m) add('err', n + 'โปรโมชันที่ผูกไว้ถูกลบแล้ว'); else if (!m.active || new Date(m.endsAt) < now) add('warn', n + 'โปรโมชัน "' + m.name + '" หมดเวลา/ปิดอยู่ — ไม่แสดงนับถอยหลัง'); else if (new Date(m.startsAt) > now) add('warn', n + 'โปรโมชัน "' + m.name + '" ยังไม่เริ่ม'); }
      (b.plans || []).forEach((l) => { const t = String(l).replace(/^\*/, '').trim(); if (t.startsWith('@')) { const p = P(t.slice(1).trim()); if (!p) add('err', n + 'แพ็กเกจอ้างสินค้า ' + t + ' ที่ไม่มีอยู่'); else if (!p.active || p.stock <= 0) add('warn', n + 'แพ็กเกจ "' + p.name + '" ' + (p.active ? 'สต็อกหมด' : 'ปิดขายอยู่') + ' — ลูกค้าซื้อไม่ได้'); } });
      [b.cta1Link, b.cta2Link].forEach((u) => { const id = cartId(u); if (id) { const p = P(id); if (!p || !p.active) add('err', n + 'ปุ่ม cart:' + id + ' ชี้ไปสินค้าที่ไม่มี/ปิดขาย'); } });
    });
    return r;
  }
  /* ---------- แจ้งปัญหา / เสนอแนะ: ป้ายสถานะ/ประเภท ใช้ร่วมกันหน้าแอดมิน/โปรไฟล์ ---------- */
  const FB = {
    status: { new: ['ใหม่', 'err'], open: ['กำลังดำเนินการ', 'paid'], waiting_user: ['รอลูกค้าตอบ', 'pending'], resolved: ['แก้ไขแล้ว', 'okk'], closed: ['ปิดแล้ว', 'cancelled'], duplicate: ['ซ้ำกับเรื่องอื่น', 'cancelled'] },
    cat: { bug: '🐞 บั๊ก / ใช้งานไม่ได้', crash: '💥 โปรแกรมปิดเอง / ค้าง', suggestion: '💡 ข้อเสนอแนะ', question: '❓ สอบถาม', other: '📝 อื่น ๆ' },
    sev: { low: 'เล็กน้อย', normal: 'ปกติ', high: 'กระทบการใช้งานมาก' }, prio: { low: 'ต่ำ', normal: 'ปกติ', high: 'สูง', urgent: 'ด่วน' },
    quick: [['รับเรื่องแล้ว ทีมงานกำลังตรวจสอบ และจะแจ้งความคืบหน้าในเรื่องนี้', 'open'], ['รบกวนแจ้งขั้นตอนที่ทำก่อนเกิดปัญหา และแนบภาพหน้าจอ/ข้อความผิดพลาดเพิ่มเติมได้ไหมครับ', 'waiting_user'],
      ['ปัญหานี้แก้ไขแล้วในเวอร์ชันล่าสุด กรุณาอัปเดตโปรแกรมแล้วลองใหม่ หากยังพบอีกตอบกลับในเรื่องนี้ได้เลย', 'resolved'], ['ขอบคุณสำหรับข้อเสนอแนะ เราบันทึกไว้พิจารณาในรุ่นถัดไปแล้วครับ', 'closed']],
  };
  // เทียบเลขเวอร์ชันจากข้อความ (ดึงชุดตัวเลขแรกที่เป็น x.y.z) — คืน >0 ถ้า a ใหม่กว่า b · ไม่พบเลข = null
  const verNum = (v) => { const m = /(\d+(?:\.\d+){0,3})/.exec(String(v || '')); return m ? m[1].split('.').map(Number) : null; };
  const verCmp = (a, b) => { const x = verNum(a), y = verNum(b); if (!x || !y) return null; for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
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
      const cm = Number(o.commission || 0); if (!Number.isInteger(cm) || cm < 0) er.push('ค่าคอมตัวแทนต้องเป็นจำนวนเต็ม ≥ 0 (0 = ไม่มีค่าคอม)'); else if (cm > Number(o.price)) er.push('ค่าคอมตัวแทนต้องไม่เกินราคาสินค้า');
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
    } else if (entity === 'tickets') {
      if (!o.title || o.title.trim().length < 3 || o.title.length > 120) er.push('หัวข้อต้อง 3-120 ตัวอักษร');
      if (!o.body || o.body.trim().length < 5 || o.body.length > 4000) er.push('รายละเอียดต้อง 5-4000 ตัวอักษร');
      if (!FB.cat[o.category]) er.push('เลือกประเภท'); if (!FB.sev[o.severity]) er.push('เลือกระดับผลกระทบ'); if (!FB.prio[o.priority]) er.push('เลือกความสำคัญ'); if (!FB.status[o.status]) er.push('เลือกสถานะ');
      if (String(o.module || '').length > 40 || String(o.appVersion || '').length > 40) er.push('โมดูล/เวอร์ชันยาวเกิน 40 ตัวอักษร');
    } else if (entity === 'commissions') {
      if (!o.referrerId) er.push('เลือกสมาชิกผู้รับค่าคอม');
      if (!o.product || !o.product.trim()) er.push('ใส่ชื่อรายการ/แพ็กเกจ');
      if (!Number.isInteger(Number(o.amount)) || Number(o.amount) < 0 || Number(o.amount) > 1000000) er.push('ยอดค่าคอมต้องเป็นจำนวนเต็ม 0 – 1,000,000 บาท');
      if (!Number.isInteger(Number(o.qty)) || Number(o.qty) < 1) er.push('จำนวนต้องเป็นจำนวนเต็ม ≥ 1');
      if (!['pending', 'void'].includes(o.status)) er.push('สถานะแก้ได้เฉพาะ "รอ/ถอนได้" หรือ "ยกเลิก" (จ่ายแล้ว/ขอถอนแล้วจัดการที่หน้าคำขอถอนเงิน)');
      if ((d.members || []).length && o.referrerId && !(d.members || []).some((m) => m.id === o.referrerId)) er.push('ไม่พบสมาชิกผู้รับค่าคอม');
    } else if (entity === 'blocks') {
      if (!BLOCKS[o.kind]) er.push('ชนิดบล็อกไม่ถูกต้อง');
      if (!o.title || o.title.trim().length < 2) er.push('ใส่ชื่อบล็อก (อย่างน้อย 2 ตัวอักษร)');
      if (!o.head || !o.head.trim()) er.push('ใส่หัวข้อ');
      if (!linkOk(o.cta1Link) || !linkOk(o.cta2Link)) er.push('ลิงก์ปุ่มต้องขึ้นต้น http(s):// , # หรือ cart:รหัสสินค้า');
      if (o.cta2Text && !o.cta2Link) er.push('ใส่ลิงก์ของปุ่มรอง');
      if (o.startsAt && o.endsAt && new Date(o.endsAt) <= new Date(o.startsAt)) er.push('วันหยุดแสดงต้องหลังวันเริ่ม');
      const has = (list, id) => (list || []).some((x) => x.id === id);
      [o.cta1Link, o.cta2Link].forEach((u) => { const id = cartId(u); if (id && !has(d.products, id)) er.push('ลิงก์ปุ่ม cart:' + id + ' — ไม่พบสินค้ารหัสนี้'); });
      if (o.productId && !has(d.products, o.productId)) er.push('สินค้าที่ผูกไว้ไม่มีอยู่แล้ว — เลือกใหม่');
      if (o.promoId && !has(d.promos, o.promoId)) er.push('โปรโมชันที่ผูกไว้ไม่มีอยู่แล้ว — เลือกใหม่');
      if (o.kind === 'promo' && o.countdown && !o.promoId && !o.endsAt) er.push('เปิดนับถอยหลังต้องผูกโปรโมชัน หรือกำหนด "หยุดแสดง"');
      if (o.kind === 'buy') { if (!(o.plans || []).length) er.push('ใส่แพ็กเกจอย่างน้อย 1 บรรทัด'); (o.plans || []).forEach((l, i) => { const t = String(l).replace(/^\*/, '').trim(), n = 'แพ็กเกจบรรทัดที่ ' + (i + 1);
        if (t.startsWith('@')) { if (!has(d.products, t.slice(1).trim())) er.push(n + ': ไม่พบสินค้ารหัส ' + t.slice(1)); return; }
        const p = t.split('|'); if (!p[0].trim() || p[1] === undefined || p[1].trim() === '' || !(Number(p[1]) >= 0)) er.push(n + ' ต้องเป็น @รหัสสินค้า หรือ ชื่อ|ราคา(ตัวเลข)|หน่วย|หมายเหตุ'); }); }
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
    } else if (entity === 'works') {
      const c = clip(o.url || '');
      if (!o.title || o.title.trim().length < 2) er.push('ใส่ชื่อคลิป/ผลงาน');
      if (!c) er.push('ลิงก์คลิปไม่ถูกต้อง (ต้องเป็น https://)');
      else if (c.short) er.push('ลิงก์ย่อของ TikTok เล่นในหน้าเว็บไม่ได้ — เปิดลิงก์นั้นแล้วคัดลอก URL เต็ม (tiktok.com/@ชื่อ/video/เลข) มาแปะ');
      if (o.active && !o.consent) er.push('ต้องติ๊ก "ได้รับอนุญาตจากเจ้าของคลิปแล้ว" ก่อนเปิดแสดงในหน้าแรก');
      if ((o.creator || '').length > 80 || (o.caption || '').length > 200) er.push('เครดิตไม่เกิน 80 ตัวอักษร · คำอธิบายไม่เกิน 200');
    } else if (entity === 'tutorials') {
      if (!o.title || o.title.trim().length < 2) er.push('ใส่ชื่อบทเรียน');
      if (o.kind === 'file' && !o.url && !o.mediaId) er.push('ยังไม่ได้เลือกไฟล์วิดีโอ');
      else if (o.kind !== 'file' && !embed(o.url || '')) er.push('ลิงก์ไม่ถูกต้อง (ต้องเป็น https://)');
    } else if (entity === 'members') {
      if (!o.name || o.name.trim().length < 2) er.push('กรอกชื่อ');
      if (!/^0\d{8,9}$/.test(String(o.phone || '').replace(/[-\s]/g, ''))) er.push('เบอร์โทรไม่ถูกต้อง');
    } else if (entity === 'releases') {
      if (!o.version || !/^\d+(\.\d+){0,3}$/.test(o.version.trim())) er.push('เลขเวอร์ชันต้องเป็นตัวเลขแบบ 1.0.0 (ห้ามใส่ชื่อโปรแกรม — ชื่อเต็มใส่ในช่องชื่อเรื่อง) ไม่เช่นนั้นโปรแกรมจะตรวจอัปเดตไม่ได้');
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
  w.DFCommon = { thaiDateTime, esc, baht, uid, embed, clip, validate, price, activePromos, activeBanners, activeBlocks, BLOCKS, BLOCK_COLS, blockFields, blockHealth, cartId, FB, verCmp, couponCalc, hideSplash };
})(window);
