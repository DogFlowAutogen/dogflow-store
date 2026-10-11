/* store.js — ชั้นข้อมูลกลาง (หน้าร้าน + แอดมินใช้ร่วมกัน)
   เก็บใน localStorage; ถ้าจะขึ้นระบบจริงให้สลับ load()/save() ไปเรียก API (เช่น Supabase) */
(function (w) {
  const CFG = w.DOGFLOW_CONFIG || {};
  if (CFG.supabaseUrl && CFG.supabaseAnonKey) return;   // ตั้งค่า Supabase แล้ว → ใช้ store.supabase.js แทน (ไฟล์นี้เป็นโหมดทดลองในเบราว์เซอร์)
  const KEY = 'dogflow_store_v1';
  const uid = (p) => p + Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');
  const eq = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }; // เทียบแบบเวลาคงที่
  const baht = (n) => '฿' + Number(n || 0).toLocaleString('th-TH');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ข้อมูลตั้งต้น
  function seed() {
    const end = new Date(); end.setDate(end.getDate() + 2); end.setHours(23, 59, 0, 0);
    return {
      settings: {
        brand: 'DogFlow Auto Gen', version: 'v1.0',
        tagline: 'เครื่องมือสร้างคลิปขายของด้วย AI ครบจบในโปรแกรมเดียว',
        heroTitle: 'สร้างคลิปขายของ\nด้วย AI อัตโนมัติ', heroSub: 'Meta Bot · Auto Story · Flow — AI คิดบท สร้างภาพ ทำคลิปมีเสียงพูด แล้วโพสต์ TikTok / Facebook / Shopee ให้เอง รันหลายบัญชีพร้อมกันได้',
        heroCta: 'เลือกแพ็กเกจเลย', promoText: '', promoEndsAt: end.toISOString(),
        lineId: '', contactEmail: '', paymentInfo: 'สแกน QR ด้านบนเพื่อโอน แล้วกรอกยอด/เลขอ้างอิง พร้อมแนบสลิปด้านล่าง — คีย์จะเข้าโปรไฟล์อัตโนมัติหลังแอดมินยืนยัน',
        paymentQr: 'assets/promptpay-qr.jpg', installGuide: '1) ดาวน์โหลดไฟล์ติดตั้งด้านบน (แนะนำให้ตรวจ SHA-256 ให้ตรงกับที่แสดง)\n2) เปิดไฟล์เพื่อติดตั้ง — ถ้า Windows แจ้งเตือน ให้เลือก "ข้อมูลเพิ่มเติม" แล้ว "เรียกใช้ต่อไป" (เมื่อมั่นใจว่าโหลดจากหน้านี้)\n3) เปิดโปรแกรม แล้วใส่ License key จากหน้าโปรไฟล์ของคุณ\n4) มีปัญหาติดต่อแอดมินทาง LINE', rules: '1) ใช้งานได้ 1 License ต่อ 1 ชุดเครื่องตามจำนวนที่ซื้อ ห้ามแชร์คีย์ ขาย หรือนำไปเผยแพร่\n2) ห้ามส่งสลิปปลอม สลิปซ้ำ หรือสลิปที่ไม่ตรงกับยอดสั่งซื้อ\n3) ห้ามพยายามเจาะระบบ แก้ไขโปรแกรม หรือหลีกเลี่ยงระบบตรวจสอบ License\n4) ใช้ข้อมูลจริงในการสมัครสมาชิก และรักษารหัสผ่านของตนเอง\n5) สินค้าดิจิทัลหลังออกคีย์แล้วไม่รับคืนเงิน ยกเว้นกรณีระบบขัดข้องจากฝั่งผู้ขาย\n\nการฝ่าฝืน: เตือน 3 ครั้งระงับบัญชีอัตโนมัติ · กรณีร้ายแรง (แชร์คีย์/สลิปปลอม) ระงับ License และบัญชีทันทีโดยไม่คืนเงิน', freeShipOver: 0, adminPin: '1234', heroImage: 'assets/app-meta-bot.png'
      },
      categories: [
        { id: 'c-license', name: 'โปรแกรม / License', icon: '🔑' },
        { id: 'c-course', name: 'คอร์สเรียน', icon: '🎓' },
        { id: 'c-pack', name: 'Prompt & เทมเพลต', icon: '🧩' },
        { id: 'c-service', name: 'บริการ', icon: '🛠️' }
      ],
      products: [
        { id: 'p-month', sku: 'AG-M', name: 'DogFlow Auto Gen รายเดือน', categoryId: 'c-license', price: 1099, salePrice: 0, stock: 999, badge: '', image: '', icon: '📅', licenseDevices: 2, licenseDays: 30, active: true, desc: 'License key 30 วัน ใช้ได้ 2 เครื่อง อัปเดตฟรีตลอดอายุคีย์', features: ['License 2 เครื่อง', 'อัปเดตฟรี', 'LINE Support'] },
        { id: 'p-year', sku: 'AG-Y', name: 'DogFlow Auto Gen รายปี', categoryId: 'c-license', price: 3999, salePrice: 0, stock: 999, badge: 'ยอดนิยม', image: '', icon: '🗓️', licenseDevices: 2, licenseDays: 365, active: true, desc: 'License key 365 วัน ใช้ได้ 2 เครื่อง เฉลี่ยเดือนละ ~333 บาท', features: ['License 2 เครื่อง', 'อัปเดตฟรีตลอดปี', 'LINE Support'] },
        { id: 'p-life', sku: 'AG-L', name: 'DogFlow Auto Gen ตลอดชีพ', categoryId: 'c-license', price: 5999, salePrice: 0, stock: 999, badge: 'คุ้มที่สุด', image: '', icon: '♾️', licenseDevices: 2, licenseDays: 0, active: true, desc: 'จ่ายครั้งเดียวใช้ได้ตลอด ไม่มีรายเดือน รวมฟีเจอร์ใหม่', features: ['ใช้ตลอดชีพ', 'License 2 เครื่อง', 'ฟีเจอร์ใหม่ฟรี'] },
        { id: 'p-course', sku: 'CR-01', name: 'คอร์ส AI ทำคลิปครบสูตร', categoryId: 'c-course', price: 990, salePrice: 49, stock: 999, badge: 'ลดสุดๆ', image: '', icon: '🎬', active: true, desc: 'เรียนทำคลิปด้วย AI ครบ 6 ชม. 40 นาที จับมือทำทุกขั้นตอน', features: ['วิดีโอ 6 ชม.40 น.', 'เรียนซ้ำได้', 'ถามตอบผ่าน LINE'] },
        { id: 'p-prompt', sku: 'PK-01', name: 'ชุด Prompt ขายของ 100 แบบ', categoryId: 'c-pack', price: 299, salePrice: 199, stock: 300, badge: '', image: '', icon: '✍️', active: true, desc: 'Prompt สำเร็จรูป ภาพ+บท+เสียง สำหรับสินค้าทุกหมวด', features: ['100 Prompt', 'ไฟล์ .txt/.json', 'อัปเดตรายเดือน'] },
        { id: 'p-setup', sku: 'SV-01', name: 'ติดตั้ง + สอนตัวต่อตัว 1 ชม.', categoryId: 'c-service', price: 1500, salePrice: 0, stock: 20, badge: 'จำกัด', image: '', icon: '🧑‍💻', active: true, desc: 'รีโมทติดตั้งโปรแกรมและตั้งค่าให้พร้อมใช้งานทันที', features: ['รีโมท 1 ชม.', 'ตั้งค่าครบ', 'บันทึกวิดีโอให้'] }
      ],
      coupons: [
        { code: 'DOG10', type: 'percent', value: 10, minTotal: 500, active: true },
        { code: 'WELCOME100', type: 'fixed', value: 100, minTotal: 0, active: true }
      ],
      reviews: [], // รีวิวต้องมาจากลูกค้าจริงเท่านั้น (เพิ่มในแอดมิน)
      faqs: [
        { id: 'f1', q: 'ใช้กับเครื่องอะไรได้บ้าง?', a: 'Mac / Notebook / PC เท่านั้น (ไม่รองรับมือถือ/iPad/Tablet) และต้องมี Gemini Ultra หรือ Pro' },
        { id: 'f2', q: 'ได้ License key ยังไง?', a: 'สมัครสมาชิก → สั่งซื้อ → โอนและแนบสลิป → แอดมินยืนยัน → คีย์ส่งเข้าหน้าโปรไฟล์ของคุณอัตโนมัติ' },
        { id: 'f3', q: 'ตลอดชีพคือเท่าไหร่?', a: 'จ่ายครั้งเดียว ใช้ได้ตลอด รวมอัปเดตฟีเจอร์ใหม่ ตามช่วงโปรโมชันที่แสดงหน้าเว็บ' }
      ],
      orders: [],
      members: [],
      notices: [], // แจ้งเตือนถึงลูกค้า {id,memberId,type:'info'|'warning'|'violation'|'ban',title,body,createdAt,read}
      showcase: [ // ภาพหน้าตาโปรแกรม (ใช้เป็นภาพโฆษณา/ตัวอย่าง)
        { id: 's1', title: 'Meta Bot — เจ็นคลิปขายของด้วย Meta AI', caption: 'Meta AI คิดบท บทพูด และมุมกล้องเอง · คลิปแนวตั้งมีเสียงในตัว ฉากละ ~10 วิ · รันหลายบัญชีพร้อมกันได้', image: 'assets/app-meta-bot.png', sort: 1, active: true },
        { id: 's2', title: 'Flow Bot — เจ็นคลิปขายของด้วย Google Flow', caption: 'สร้างภาพ + คลิปด้วย Google Flow แล้วส่งต่อไปโพสต์ได้ในที่เดียว · มี 2 เอนจิน: Studio (เหมือนคนกดเอง) / Turbo (เร็วผ่าน API)', image: 'assets/app-flow-bot.png', sort: 2, active: true },
        { id: 's3', title: 'Auto Story — หนังสั้น AI จากหัวข้อเดียว', caption: 'AI แต่งเรื่องและสร้างทุกฉากต่อเนื่องเป็นหนังสั้นทั้งเรื่อง · ตัวละครพูดได้ · แทรกสินค้าแบบเนียน ๆ', image: 'assets/app-auto-story.png', sort: 3, active: true }
      ],
      releases: [], // ไฟล์ดาวน์โหลดโปรแกรม (โหมดทดลองรองรับเฉพาะลิงก์ภายนอก)
      tutorials: [], // คู่มือวิดีโอ {id,title,desc,kind:'link'|'file',url,mediaId,sort,active}
      banners: [], // แบนเนอร์โฆษณา {id,title,image,link,startsAt,endsAt,active,sort}
      brands: [],  // แบรนด์สินค้า {id,name,logo}
      promos: [],  // แคมเปญลดราคา {id,name,percent,scope,startsAt,endsAt,active}
      audit: []
    };
  }

  let cache = null;
  function load() {
    if (cache) return cache;
    try { cache = JSON.parse(localStorage.getItem(KEY)); } catch (e) { cache = null; }
    if (!cache || !cache.products) { cache = seed(); save(); }
    ['members', 'notices', 'showcase', 'works', 'releases', 'tutorials', 'banners', 'blocks', 'tickets', 'brands', 'promos', 'reviews', 'faqs', 'audit'].forEach((k) => { if (!cache[k]) cache[k] = []; }); // ข้อมูลเก่าที่ยังไม่มีส่วนใหม่
    return cache;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { alert('บันทึกไม่สำเร็จ (พื้นที่เต็ม?) — ลองลดขนาดรูป'); }
    w.dispatchEvent(new CustomEvent('db:change'));
  }
  w.addEventListener('storage', (e) => { if (e.key === KEY) { cache = null; w.dispatchEvent(new CustomEvent('db:change')); } });

  function log(action, entity, detail) {
    const d = load(); d.audit.unshift({ ts: new Date().toISOString(), action, entity, detail: String(detail || '') });
    d.audit.length = Math.min(d.audit.length, 300);
  }

  // กฎตรวจสอบข้อมูล — คืน array ข้อความผิดพลาด (ว่าง = ผ่าน)
  function validate(entity, o) {
    const d = load(), er = [];
    if (entity === 'blocks') return DFCommon.validate(entity, o, d);
    const dupe = (list, key, val) => list.some((x) => x[key] === val && x.id !== o.id);
    if (entity === 'products') {
      if (!o.name || o.name.trim().length < 2) er.push('ชื่อสินค้าสั้นเกินไป');
      if (!o.sku || !o.sku.trim()) er.push('ต้องมี SKU'); else if (dupe(d.products, 'sku', o.sku.trim())) er.push('SKU ซ้ำกับสินค้าอื่น');
      if (!(Number(o.price) > 0)) er.push('ราคาต้องมากกว่า 0');
      if (Number(o.salePrice) < 0) er.push('ราคาโปรติดลบไม่ได้');
      if (Number(o.salePrice) > 0 && Number(o.salePrice) >= Number(o.price)) er.push('ราคาโปรต้องต่ำกว่าราคาปกติ');
      if (!Number.isInteger(Number(o.stock)) || Number(o.stock) < 0) er.push('สต็อกต้องเป็นจำนวนเต็ม ≥ 0');
      if (!d.categories.some((c) => c.id === o.categoryId)) er.push('เลือกหมวดหมู่ไม่ถูกต้อง');
      if (!Number.isInteger(Number(o.licenseDevices || 0)) || Number(o.licenseDevices || 0) < 0 || Number(o.licenseDevices || 0) > 50) er.push('จำนวนเครื่อง License ต้อง 0-50 (0 = ไม่ใช่สินค้า License)');
      if (Number(o.licenseDevices) > 0 && (!Number.isInteger(Number(o.licenseDays || 0)) || Number(o.licenseDays || 0) < 0 || Number(o.licenseDays || 0) > 3650)) er.push('อายุ License 0-3650 วัน (0 = ตลอดชีพ)');
    } else if (entity === 'categories') {
      if (!o.name || !o.name.trim()) er.push('ต้องมีชื่อหมวดหมู่'); else if (d.categories.some((c) => c.name === o.name.trim() && c.id !== o.id)) er.push('ชื่อหมวดซ้ำ');
    } else if (entity === 'coupons') {
      if (!/^[A-Z0-9_-]{3,20}$/.test(o.code || '')) er.push('โค้ดต้องเป็น A-Z/0-9 ยาว 3-20 ตัว');
      if (d.coupons.some((c) => c.code === o.code && c.id !== o.id && c !== o._ref)) er.push('โค้ดซ้ำ');
      if (!(Number(o.value) > 0)) er.push('มูลค่าส่วนลดต้อง > 0');
      if (o.type === 'percent' && Number(o.value) > 100) er.push('เปอร์เซ็นต์เกิน 100');
    } else if (entity === 'reviews') {
      if (!o.name || !o.text) er.push('กรอกชื่อและข้อความรีวิว');
      if (!(o.rating >= 1 && o.rating <= 5)) er.push('คะแนน 1-5');
    } else if (entity === 'releases') {
      if (!o.version || !o.version.trim()) er.push('ใส่เลขเวอร์ชัน');
      if (!o.externalUrl || !/^https:\/\//.test(o.externalUrl)) er.push('โหมดทดลอง: ใส่ลิงก์ดาวน์โหลด https://');
    } else if (entity === 'showcase') {
      if (!o.title || !o.title.trim()) er.push('ใส่หัวข้อ'); if (!o.image) er.push('อัปโหลดภาพหน้าจอ');
    } else if (entity === 'works') {
      return DFCommon.validate(entity, o, d);
    } else if (entity === 'tutorials') {
      if (!o.title || o.title.trim().length < 2) er.push('ใส่ชื่อบทเรียน');
      if (o.kind === 'file') { if (!o.mediaId) er.push('ยังไม่ได้เลือกไฟล์วิดีโอ'); }
      else if (!DB.embed(o.url || '')) er.push('ลิงก์ไม่ถูกต้อง (ต้องเป็น https://)');
    } else if (entity === 'banners') {
      if (!o.title || !o.title.trim()) er.push('ใส่ชื่อแบนเนอร์');
      if (!o.image) er.push('อัปโหลดภาพแบนเนอร์');
      if (o.link && !/^(https?:\/\/|#|\/)/.test(o.link)) er.push('ลิงก์ต้องขึ้นต้น http(s):// หรือ #');
      if (o.startsAt && o.endsAt && new Date(o.endsAt) <= new Date(o.startsAt)) er.push('วันสิ้นสุดต้องหลังวันเริ่ม');
    } else if (entity === 'brands') {
      if (!o.name || !o.name.trim()) er.push('ใส่ชื่อแบรนด์'); else if (d.brands.some((b) => b.name.toLowerCase() === o.name.trim().toLowerCase() && b.id !== o.id)) er.push('ชื่อแบรนด์ซ้ำ');
      if (!o.logo) er.push('อัปโหลดโลโก้แบรนด์');
    } else if (entity === 'promos') {
      if (!o.name || !o.name.trim()) er.push('ใส่ชื่อโปรโมชัน');
      if (!(Number(o.percent) > 0 && Number(o.percent) <= 90)) er.push('ส่วนลด 1-90%');
      if (o.scope !== 'all' && !d.categories.some((c) => c.id === o.scope)) er.push('เลือกขอบเขตไม่ถูกต้อง');
      if (!o.startsAt || !o.endsAt) er.push('ระบุวันเริ่ม-สิ้นสุด'); else if (new Date(o.endsAt) <= new Date(o.startsAt)) er.push('วันสิ้นสุดต้องหลังวันเริ่ม');
    } else if (entity === 'members') {
      if (!o.name || o.name.trim().length < 2) er.push('กรอกชื่อ');
      if (!/^\S+@\S+\.\S+$/.test(o.email || '')) er.push('อีเมลไม่ถูกต้อง'); else if (d.members.some((m) => m.email === o.email.toLowerCase() && m.id !== o.id)) er.push('อีเมลซ้ำกับสมาชิกอื่น');
      if (!/^0\d{8,9}$/.test(String(o.phone || '').replace(/[-\s]/g, ''))) er.push('เบอร์โทรไม่ถูกต้อง');
    } else if (entity === 'faqs') {
      if (!o.q || !o.a) er.push('กรอกคำถามและคำตอบ');
    }
    return er;
  }

  const idKey = { coupons: 'code' };
  const DB = {
    uid, baht, esc, validate, mode: 'local',
    init() { load(); return Promise.resolve(); },
    async refresh() { cache = null; load(); w.dispatchEvent(new CustomEvent('db:change')); },
    isAdmin: () => false,                                  // โหมดนี้ใช้รหัสแอดมินในเซสชัน (ดู admin.html)
    uploadImage: async (dataUrl) => dataUrl,               // โหมดทดลองเก็บรูปเป็น dataURL ในข้อมูล
    slipUrl: async (p) => (p && p.image) || '',
    couponCalc: (c, subtotal) => (c.type === 'percent' ? Math.round(subtotal * c.value / 100) : Math.min(c.value, subtotal)),
    testLine: async () => ({ ok: false, errors: ['โหมดทดลองไม่รองรับ — ตั้งค่า Supabase เพื่อใช้แจ้งเตือน LINE'] }),
    async attachVideo(o, file) {
      if (!/^video\/(mp4|webm|quicktime)$/.test(file.type)) return { ok: false, errors: ['รองรับเฉพาะ .mp4 / .webm / .mov'] };
      if (file.size > 150 * 1048576) return { ok: false, errors: ['ไฟล์ใหญ่เกิน 150MB'] };
      o.mediaId = o.mediaId || uid('v-'); o.url = ''; try { await DB.putMedia(o.mediaId, file); return { ok: true }; } catch (e) { return { ok: false, errors: [e.message] }; }
    },
    latestRelease(platform) { const r = load().releases.filter((x) => x.active && x.platform === (platform || 'windows')).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]; return r ? { version: r.version, platform: r.platform, title: r.title, notes: r.notes, releasedAt: r.createdAt, mandatory: !!r.mandatory } : null; },
    async announceRelease(id) { // โหมดทดลอง: แจ้งในโปรไฟล์ของสมาชิกที่มีคีย์ (ไม่มีอีเมล)
      const d = load(), r = d.releases.find((x) => x.id === id); if (!r || !r.active) return { ok: false, errors: ['ต้องเปิดให้ดาวน์โหลดก่อน'] };
      const ids = [...new Set(d.orders.filter((o) => ['paid', 'done'].includes(o.status) && o.licenseKeys && o.licenseKeys.length).map((o) => o.memberId))];
      ids.forEach((m) => DB.addNotice(m, 'update', 'มีเวอร์ชันใหม่ v' + r.version, 'ดาวน์โหลดได้ที่หน้าโปรไฟล์ → ดาวน์โหลดโปรแกรม')); r.announcedAt = new Date().toISOString(); save(); return { ok: true, count: ids.length };
    },
    async setEmailUpdates(on) { const m = DB.me(); if (m) { m.emailUpdates = !!on; save(); } return { ok: true }; },
    revokeKeys: async () => ({ ok: false, errors: ['โหมดทดลองไม่รองรับ — ใช้ Supabase + License Server'] }),
    restoreKeys: async () => ({ ok: false, errors: ['โหมดทดลองไม่รองรับ'] }),
    dispatchNotices: async () => ({ ok: false, errors: ['โหมดทดลองไม่มีระบบอีเมล'] }),
    canDownload() { const m = DB.me(); return !!m && load().orders.some((o) => o.memberId === m.id && ['paid', 'done'].includes(o.status) && o.licenseKeys && o.licenseKeys.length) && load().releases.some((r) => r.active); },
    async downloadUrl(id) { if (!DB.canDownload()) return { ok: false, errors: ['ต้องมี License ที่ใช้งานได้จึงจะดาวน์โหลดได้'] }; const r = load().releases.find((x) => x.id === id && x.active); return r ? { ok: true, url: r.externalUrl, fileName: r.fileName, sha256: r.sha256 } : { ok: false, errors: ['ไม่พบไฟล์'] }; },
    attachRelease: async () => ({ ok: false, errors: ['โหมดทดลองรองรับเฉพาะลิงก์ภายนอก — ตั้งค่า Supabase เพื่ออัปโหลดไฟล์'] }),
    async playUrl(t) { return t.kind === 'file' ? DB.mediaURL(t.mediaId) : t.url; },
    get: () => load(),
    settings: () => load().settings,
    list: (e) => load()[e],
    activeBlocks() { return DFCommon.activeBlocks(load().blocks); },
    find: (e, id) => load()[e].find((x) => x[idKey[e] || 'id'] === id),
    // เพิ่ม/แก้ไข: คืน {ok, errors}
    upsert(entity, obj) {
      const errors = validate(entity, obj); if (errors.length) return { ok: false, errors };
      const d = load(), k = idKey[entity] || 'id', i = d[entity].findIndex((x) => x[k] === obj[k]);
      if (i >= 0) { d[entity][i] = obj; log('แก้ไข', entity, obj.name || obj.code || obj.q || obj.id); }
      else { d[entity].push(obj); log('เพิ่ม', entity, obj.name || obj.code || obj.q || obj.id); }
      save(); return { ok: true };
    },
    remove(entity, key) {
      const d = load(), k = idKey[entity] || 'id';
      if (entity === 'members') return DB.removeMember(key);
      if (entity === 'tutorials') { const t = d.tutorials.find((x) => x.id === key); if (t && t.mediaId) DB.delMedia(t.mediaId).catch(() => {}); }
      if (entity === 'brands' && d.products.some((p) => p.brandId === key)) return { ok: false, errors: ['ยังมีสินค้าใช้แบรนด์นี้ — เปลี่ยนแบรนด์สินค้าก่อน'] };
      if (entity === 'categories' && d.products.some((p) => p.categoryId === key)) return { ok: false, errors: ['ยังมีสินค้าในหมวดนี้ ย้าย/ลบสินค้าก่อน'] };
      d[entity] = d[entity].filter((x) => x[k] !== key); log('ลบ', entity, key); save(); return { ok: true };
    },
    saveSettings(s) { const d = load(); d.settings = Object.assign(d.settings, s); log('แก้ไข', 'settings', Object.keys(s).join(',')); save(); },
    // คำนวณคูปอง
    coupon(code, subtotal) {
      const c = load().coupons.find((x) => x.code === String(code || '').trim().toUpperCase());
      if (!c || !c.active) return { ok: false, msg: 'โค้ดไม่ถูกต้องหรือปิดใช้งาน' };
      if (subtotal < c.minTotal) return { ok: false, msg: 'ยอดขั้นต่ำ ' + baht(c.minTotal) };
      const discount = c.type === 'percent' ? Math.round(subtotal * c.value / 100) : Math.min(c.value, subtotal);
      return { ok: true, discount, code: c.code, type: c.type, value: c.value, minTotal: c.minTotal };
    },
    // โปรโมชันที่เปิดอยู่ตอนนี้ (เรียงส่วนลดมากสุดก่อน)
    activePromos() { const n = Date.now(); return load().promos.filter((x) => x.active && new Date(x.startsAt) <= n && n <= new Date(x.endsAt)); },
    // ราคาขายจริง = ราคาโปรของสินค้า แล้วหักแคมเปญที่ตรงขอบเขต (เลือกส่วนลดมากสุด 1 แคมเปญ ไม่ซ้อนกัน)
    price(p) {
      const base = p.salePrice > 0 ? p.salePrice : p.price;
      const best = DB.activePromos().filter((x) => x.scope === 'all' || x.scope === p.categoryId).reduce((m, x) => Math.max(m, Number(x.percent)), 0);
      return best ? Math.round(base * (100 - best) / 100) : base;
    },
    activeBanners() { const n = Date.now(); return load().banners.filter((b) => b.active && (!b.startsAt || new Date(b.startsAt) <= n) && (!b.endsAt || n <= new Date(b.endsAt))).sort((a, b) => (a.sort || 0) - (b.sort || 0)); },
    // แอดมินเพิ่มสมาชิกเอง (ตั้งรหัสผ่านเริ่มต้นให้) — ไม่ล็อกอินแทนลูกค้า
    async adminAddMember(f) {
      const d = load(), er = validate('members', { name: f.name, email: String(f.email || '').toLowerCase(), phone: f.phone });
      if (!f.password || f.password.length < 8) er.push('รหัสผ่านอย่างน้อย 8 ตัว');
      if (er.length) return { ok: false, errors: er };
      const salt = uid('S'), m = { id: uid('M'), name: f.name.trim(), email: f.email.trim().toLowerCase(), phone: f.phone.replace(/[-\s]/g, ''), salt, pwHash: await DB.hash(f.password, salt), banned: false, createdAt: new Date().toISOString(), addedByAdmin: true };
      d.members.push(m); log('แอดมินเพิ่มสมาชิก', 'members', m.email); save(); return { ok: true };
    },
    async resetPassword(id, pw) {
      const m = load().members.find((x) => x.id === id); if (!m) return { ok: false, errors: ['ไม่พบสมาชิก'] }; if (!pw || pw.length < 8) return { ok: false, errors: ['รหัสผ่านอย่างน้อย 8 ตัว'] };
      m.salt = uid('S'); m.pwHash = await DB.hash(pw, m.salt); log('รีเซ็ตรหัสผ่าน', 'members', m.email); save(); return { ok: true };
    },
    // ลบสมาชิก: ถ้ามีออเดอร์ให้ระงับแทน เพื่อไม่ทำให้ประวัติการเงิน/คีย์หาย
    removeMember(id) {
      const d = load(), m = d.members.find((x) => x.id === id); if (!m) return { ok: false, errors: ['ไม่พบสมาชิก'] };
      if (d.orders.some((o) => o.memberId === id)) return { ok: false, errors: ['สมาชิกนี้มีออเดอร์แล้ว — ลบไม่ได้ (เพื่อรักษาประวัติ) ใช้ "ระงับ" แทน'] };
      d.members = d.members.filter((x) => x.id !== id); log('ลบ', 'members', m.email); save(); return { ok: true };
    },
    // แจ้งเตือน LINE ผ่าน Apps Script (ยิงแล้วลืม — ล้มเหลวไม่กระทบการสั่งซื้อ) ส่งเฉพาะข้อมูลที่จำเป็น ไม่ส่งสลิป/เบอร์/อีเมล
    notify(event, o, extra) {
      const url = DB.licenseCfg().url; if (!url || typeof fetch !== 'function') return;
      try { fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(Object.assign({ action: 'notifyOrder', event, orderId: o.id, name: o.customer.name, total: o.total }, extra || {})) }).catch(() => {}); } catch (e) { /* ไม่ทำอะไร */ }
    },
    // ===== คู่มือวิดีโอ =====
    // แปลงลิงก์เป็นตัวเล่น: YouTube/Vimeo/Drive/TikTok → iframe, ไฟล์วิดีโอตรง → <video>, อื่นๆ → ปุ่มเปิดลิงก์ ; ไม่ใช่ https → null
    embed(url) {
      let u; try { u = new URL(String(url).trim()); } catch (e) { return null; } if (u.protocol !== 'https:') return null;
      const h = u.hostname.replace(/^www\./, ''); let id, m;
      if (h === 'youtu.be') id = u.pathname.slice(1); else if (h === 'youtube.com' || h.endsWith('.youtube.com')) id = u.searchParams.get('v') || (u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{11})/) || [])[2];
      if (id && /^[\w-]{11}$/.test(id)) return { type: 'iframe', src: 'https://www.youtube-nocookie.com/embed/' + id, thumb: 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg' };
      if (h === 'vimeo.com' && (m = u.pathname.match(/^\/(\d+)/))) return { type: 'iframe', src: 'https://player.vimeo.com/video/' + m[1] };
      if (h === 'drive.google.com' && (m = u.pathname.match(/\/file\/d\/([\w-]+)/))) return { type: 'iframe', src: 'https://drive.google.com/file/d/' + m[1] + '/preview' };
      if (h.endsWith('tiktok.com') && (m = u.pathname.match(/\/video\/(\d+)/))) return { type: 'iframe', src: 'https://www.tiktok.com/embed/v2/' + m[1] };
      if (/\.(mp4|webm|ogg)$/i.test(u.pathname)) return { type: 'video', src: u.href };
      return { type: 'link', src: u.href };
    },
    // ไฟล์วิดีโอที่อัปโหลดเก็บใน IndexedDB ของเบราว์เซอร์นี้ (ไม่ใช่ localStorage เพราะใหญ่เกิน)
    _idb() { return new Promise((res, rej) => { const r = indexedDB.open('dogflow_media', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
    async putMedia(id, file) { const db = await DB._idb(); return new Promise((res, rej) => { const t = db.transaction('f', 'readwrite'); t.objectStore('f').put(file, id); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
    async mediaURL(id) { const db = await DB._idb(); return new Promise((res, rej) => { const q = db.transaction('f').objectStore('f').get(id); q.onsuccess = () => res(q.result ? URL.createObjectURL(q.result) : null); q.onerror = () => rej(q.error); }); },
    async delMedia(id) { const db = await DB._idb(); return new Promise((res, rej) => { const t = db.transaction('f', 'readwrite'); t.objectStore('f').delete(id); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
    // ===== แจ้งเตือนลูกค้า / ระบบเตือนผิดกฎ =====
    addNotice(memberId, type, title, body) { const d = load(); d.notices.unshift({ id: uid('N'), memberId, type, title: String(title).slice(0, 80), body: String(body).slice(0, 600), createdAt: new Date().toISOString(), read: false }); if (d.notices.length > 2000) d.notices.length = 2000; },
    myNotices() { const m = DB.me(); return m ? load().notices.filter((n) => n.memberId === m.id) : []; },
    unreadCount() { return DB.myNotices().filter((n) => !n.read).length; },
    markNoticesRead(id) { const m = DB.me(); if (!m) return; load().notices.forEach((n) => { if (n.memberId === m.id && (!id || n.id === id)) n.read = true; }); save(); },
    // เตือนผิดกฎ: สะสม strike → ครบ 3 ระงับบัญชีอัตโนมัติ (ผู้ใช้ที่ถูกระงับเข้าสู่ระบบไม่ได้และเห็นเหตุผลตอนล็อกอิน)
    warnMember(memberId, title, body, opts) {
      const d = load(), m = d.members.find((x) => x.id === memberId); if (!m) return { ok: false, errors: ['ไม่พบสมาชิก'] }; opts = opts || {};
      DB.addNotice(memberId, opts.type || 'warning', title, body);
      if (opts.strike) { m.strikes = (m.strikes || 0) + 1; if (m.strikes >= 3 && !m.banned) { m.banned = true; m.banReason = 'ผิดกฎครบ 3 ครั้ง: ' + title; DB.addNotice(memberId, 'ban', 'บัญชีถูกระงับ', 'เนื่องจากฝ่าฝืนกฎครบ 3 ครั้ง กรุณาติดต่อแอดมินทาง LINE'); log('ระงับอัตโนมัติ', 'members', m.email); } }
      log('แจ้งเตือนลูกค้า', 'members', m.email + ' · ' + title); save(); return { ok: true, strikes: m.strikes || 0, banned: !!m.banned };
    },
    setBan(memberId, banned, reason) {
      const d = load(), m = d.members.find((x) => x.id === memberId); if (!m) return { ok: false, errors: ['ไม่พบสมาชิก'] };
      if (banned && !String(reason || '').trim()) return { ok: false, errors: ['ระบุเหตุผลที่ระงับ (ลูกค้าจะเห็น)'] };
      m.banned = !!banned; m.banReason = banned ? String(reason).trim().slice(0, 200) : ''; if (!banned) m.strikes = 0;
      DB.addNotice(memberId, banned ? 'ban' : 'info', banned ? 'บัญชีถูกระงับ' : 'บัญชีเปิดใช้งานแล้ว', banned ? m.banReason : 'แอดมินปลดระงับบัญชีของคุณแล้ว');
      log(banned ? 'ระงับสมาชิก' : 'ปลดระงับ', 'members', m.email); save(); return { ok: true };
    },
    // ===== โปรไฟล์สมาชิก =====
    updateProfile(f) {
      const m = DB.me(); if (!m) return { ok: false, errors: ['ยังไม่ได้เข้าสู่ระบบ'] };
      const er = validate('members', { id: m.id, name: f.name, email: m.email, phone: f.phone }); if (er.length) return { ok: false, errors: er };
      m.name = f.name.trim(); m.phone = f.phone.replace(/[-\s]/g, ''); log('แก้โปรไฟล์', 'members', m.email); save(); return { ok: true };
    },
    async changeMyPassword(oldPw, nw, nw2) {
      const m = DB.me(); if (!m) return { ok: false, errors: ['ยังไม่ได้เข้าสู่ระบบ'] };
      const left = DB.lockLeft('pw_' + m.id); if (left) return { ok: false, errors: ['ลองผิดหลายครั้ง ล็อกอีก ' + Math.ceil(left / 60) + ' นาที'] };
      if (!eq(await DB.hash(oldPw || '', m.salt), m.pwHash)) { DB.lockFail('pw_' + m.id); return { ok: false, errors: ['รหัสผ่านเดิมไม่ถูกต้อง'] }; }
      DB.lockOk('pw_' + m.id);
      if (!nw || nw.length < 8) return { ok: false, errors: ['รหัสผ่านใหม่อย่างน้อย 8 ตัว'] }; if (nw !== nw2) return { ok: false, errors: ['ยืนยันรหัสผ่านใหม่ไม่ตรงกัน'] }; if (nw === oldPw) return { ok: false, errors: ['รหัสผ่านใหม่ต้องต่างจากเดิม'] };
      m.salt = uid('S'); m.pwHash = await DB.hash(nw, m.salt); log('เปลี่ยนรหัสผ่าน', 'members', m.email); save(); return { ok: true };
    },
    deleteMyAccount() { const m = DB.me(); if (!m) return { ok: false, errors: ['ยังไม่ได้เข้าสู่ระบบ'] }; const r = DB.removeMember(m.id); if (r.ok) DB.logout(); return r; },
    // ===== ระบบสมาชิก =====
    // แฮชรหัสผ่านด้วย SHA-256 + salt (ฝั่งเบราว์เซอร์เท่านั้น — ระบบจริงต้องแฮชฝั่งเซิร์ฟเวอร์)
    async hash(pw, salt) { // PBKDF2-SHA256 150,000 รอบ (หน่วงการเดารหัสถ้าข้อมูลรั่ว)
      const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
      const b = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 150000 }, k, 256);
      return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
    },
    // กันเดารหัส: ผิด 5 ครั้งติด → ล็อก 5 นาที แล้วทวีคูณ (เก็บถาวรในเบราว์เซอร์ ปิดแท็บไม่หาย)
    lockState(name) { try { return JSON.parse(localStorage.getItem(KEY + '_lock_' + name)) || { n: 0, until: 0, rounds: 0 }; } catch (e) { return { n: 0, until: 0, rounds: 0 }; } },
    lockLeft(name) { return Math.max(0, Math.ceil((DB.lockState(name).until - Date.now()) / 1000)); },
    lockFail(name) { const s = DB.lockState(name); s.n++; if (s.n >= 5) { s.rounds++; s.until = Date.now() + 5 * 60000 * Math.pow(2, s.rounds - 1); s.n = 0; } localStorage.setItem(KEY + '_lock_' + name, JSON.stringify(s)); },
    lockOk(name) { localStorage.removeItem(KEY + '_lock_' + name); },
    // เข้าสู่ระบบแอดมิน: รหัสแฮชแล้ว · ถ้ายังไม่เคยเปลี่ยนจะเทียบกับค่าเริ่มต้น
    async adminLogin(email, pw) {
      if (arguments.length < 2) pw = email;
      const left = DB.lockLeft('admin'); if (left) return { ok: false, errors: ['ถูกล็อกชั่วคราว รออีก ' + Math.ceil(left / 60) + ' นาที'] };
      const s = load().settings; let good = false;
      if (s.adminPinHash) good = eq(await DB.hash(String(pw || ''), s.adminSalt), s.adminPinHash); else good = eq(String(pw || ''), s.adminPin || '');
      if (!good) { DB.lockFail('admin'); log('ล็อกอินแอดมินล้มเหลว', 'security', ''); save(); return { ok: false, errors: ['รหัสไม่ถูกต้อง'] }; }
      DB.lockOk('admin'); log('ล็อกอินแอดมิน', 'security', ''); save(); return { ok: true, isDefault: !s.adminPinHash };
    },
    async setAdminPassword(pw) {
      if (!pw || pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return { ok: false, errors: ['รหัสแอดมินอย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข'] };
      const s = load().settings; s.adminSalt = uid('A'); s.adminPinHash = await DB.hash(pw, s.adminSalt); delete s.adminPin; log('เปลี่ยนรหัสแอดมิน', 'security', ''); save(); return { ok: true };
    },
    me() {
      const id = localStorage.getItem(KEY + '_session'); if (!id) return null;
      const m = load().members.find((x) => x.id === id && !x.banned); return m || null;
    },
    logout() { localStorage.removeItem(KEY + '_session'); w.dispatchEvent(new CustomEvent('db:change')); },
    async register(f) {
      const d = load(), er = [];
      if (!f.name || f.name.trim().length < 2) er.push('กรอกชื่อ');
      if (!/^\S+@\S+\.\S+$/.test(f.email || '')) er.push('อีเมลไม่ถูกต้อง');
      else if (d.members.some((m) => m.email === f.email.trim().toLowerCase())) er.push('อีเมลนี้สมัครแล้ว — เข้าสู่ระบบแทน');
      if (!/^0\d{8,9}$/.test((f.phone || '').replace(/[-\s]/g, ''))) er.push('เบอร์โทรไม่ถูกต้อง');
      if (!f.password || f.password.length < 8) er.push('รหัสผ่านอย่างน้อย 8 ตัว');
      if (f.password !== f.password2) er.push('ยืนยันรหัสผ่านไม่ตรงกัน');
      if (!f.agree) er.push('ต้องยอมรับเงื่อนไขการใช้งาน');
      if (er.length) return { ok: false, errors: er };
      const salt = uid('S'), m = { id: uid('M'), name: f.name.trim(), email: f.email.trim().toLowerCase(), phone: f.phone.replace(/[-\s]/g, ''), salt, pwHash: await DB.hash(f.password, salt), banned: false, createdAt: new Date().toISOString() };
      d.members.push(m); log('สมัครสมาชิก', 'members', m.email); save();
      localStorage.setItem(KEY + '_session', m.id); return { ok: true, member: m };
    },
    async login(email, pw) {
      const em = String(email || '').trim().toLowerCase(), left = DB.lockLeft('m_' + em);
      if (left) return { ok: false, errors: ['ลองผิดหลายครั้ง ถูกล็อกอีก ' + Math.ceil(left / 60) + ' นาที'] };
      const m = load().members.find((x) => x.email === em);
      if (!m || !eq(await DB.hash(pw || '', m.salt), m.pwHash)) { DB.lockFail('m_' + em); return { ok: false, errors: ['อีเมลหรือรหัสผ่านไม่ถูกต้อง'] }; }
      DB.lockOk('m_' + em);
      if (m.banned) return { ok: false, errors: ['บัญชีนี้ถูกระงับ' + (m.banReason ? ': ' + m.banReason : '') + ' — ติดต่อแอดมินทาง LINE'] };
      localStorage.setItem(KEY + '_session', m.id); w.dispatchEvent(new CustomEvent('db:change')); return { ok: true, member: m };
    },
    // สั่งซื้อ: ต้องล็อกอินก่อน ตรวจสต็อกอีกครั้งฝั่งข้อมูล แล้วตัดสต็อก
    placeOrder(cart, customer, couponCode) {
      const d = load(), errs = [], items = [], mem = DB.me();
      if (!mem) return { ok: false, errors: ['กรุณาสมัครสมาชิก/เข้าสู่ระบบก่อนสั่งซื้อ'] };
      if (!customer.name || customer.name.trim().length < 2) errs.push('กรอกชื่อ');
      if (!/^0\d{8,9}$/.test((customer.phone || '').replace(/[-\s]/g, ''))) errs.push('เบอร์โทรไม่ถูกต้อง');
      if (!/^\S+@\S+\.\S+$/.test(customer.email || '')) errs.push('อีเมลไม่ถูกต้อง (ใช้ส่ง License key)');
      cart.forEach((l) => {
        const p = d.products.find((x) => x.id === l.id);
        if (!p || !p.active) errs.push('สินค้า "' + (p ? p.name : l.id) + '" ไม่พร้อมขาย');
        else if (p.stock < l.qty) errs.push('"' + p.name + '" เหลือ ' + p.stock + ' ชิ้น');
        else items.push({ id: p.id, name: p.name, price: DB.price(p), qty: l.qty });
      });
      if (!items.length && !errs.length) errs.push('ตะกร้าว่าง');
      if (errs.length) return { ok: false, errors: errs };
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      const cp = couponCode ? DB.coupon(couponCode, subtotal) : null;
      const discount = cp && cp.ok ? cp.discount : 0;
      items.forEach((i) => { d.products.find((p) => p.id === i.id).stock -= i.qty; });
      let oid; do { oid = 'DF' + Date.now().toString().slice(-5) + String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000).padStart(3, '0'); } while (d.orders.some((x) => x.id === oid));
      const order = { id: oid, items, subtotal, discount, coupon: cp && cp.ok ? cp.code : '', total: subtotal - discount, customer, memberId: mem.id, status: 'pending', createdAt: new Date().toISOString(), note: '' };
      d.orders.unshift(order); log('สั่งซื้อ', 'orders', order.id + ' ' + baht(order.total)); save(); DB.notify('order', order);
      return { ok: true, order };
    },
    // ===== ตรวจสอบการจ่ายเงิน =====
    // ลูกค้าส่งสลิป: slip = {ref, amount, paidAt, image(dataURL)} → ระบบตรวจอัตโนมัติ แล้วรอแอดมินอนุมัติ
    submitSlip(orderId, slip) {
      const d = load(), o = d.orders.find((x) => x.id === orderId), mem = DB.me();
      if (!o || !mem || o.memberId !== mem.id) return { ok: false, errors: ['ไม่พบออเดอร์'] };
      if (!['pending', 'rejected'].includes(o.status)) return { ok: false, errors: ['ออเดอร์นี้ชำระแล้วหรือถูกยกเลิก'] };
      const er = [], amt = Number(slip.amount);
      if (!/^[A-Za-z0-9]{8,30}$/.test(slip.ref || '')) er.push('เลขอ้างอิงสลิป 8-30 ตัวอักษร/ตัวเลข');
      if (!(amt > 0)) er.push('กรอกยอดที่โอน');
      if (!slip.paidAt) er.push('ระบุวันเวลาที่โอน');
      if (!slip.image) er.push('แนบรูปสลิป');
      if (er.length) return { ok: false, errors: er };
      // ตรวจอัตโนมัติ: ยอดตรง / เวลาหลังสั่งซื้อ / เลขอ้างอิงไม่ซ้ำกับออเดอร์อื่น
      const flags = [];
      if (amt !== o.total) flags.push('ยอดไม่ตรง (โอน ' + baht(amt) + ' / ต้องจ่าย ' + baht(o.total) + ')');
      if (new Date(slip.paidAt) < new Date(new Date(o.createdAt).getTime() - 5 * 60000)) flags.push('เวลาโอนก่อนสั่งซื้อ');
      if (new Date(slip.paidAt) > new Date(Date.now() + 5 * 60000)) flags.push('เวลาโอนอยู่ในอนาคต');
      if (d.orders.some((x) => x.id !== o.id && x.payment && x.payment.ref.toUpperCase() === slip.ref.toUpperCase())) flags.push('เลขอ้างอิงซ้ำกับออเดอร์อื่น');
      o.payment = { ref: slip.ref, amount: amt, paidAt: slip.paidAt, image: slip.image, submittedAt: new Date().toISOString(), flags, reviewNote: '' };
      o.status = 'review'; log('ส่งสลิป', 'orders', o.id + (flags.length ? ' ⚠ ' + flags.length + ' จุดผิดปกติ' : ' ผ่านตรวจอัตโนมัติ'));
      if (flags.some((f) => /ซ้ำ/.test(f))) DB.warnMember(mem.id, 'พบเลขอ้างอิงสลิปซ้ำ', 'ออเดอร์ ' + o.id + ': เลขอ้างอิงนี้เคยถูกใช้แล้ว การส่งสลิปซ้ำ/ปลอมผิดเงื่อนไขการใช้งาน (ข้อ 2) หากเป็นความผิดพลาดกรุณาส่งสลิปที่ถูกต้องอีกครั้ง', { type: 'violation', strike: true });
      else if (flags.some((f) => /ยอดไม่ตรง/.test(f))) DB.addNotice(mem.id, 'warning', 'ยอดโอนไม่ตรงกับออเดอร์', 'ออเดอร์ ' + o.id + ': ' + flags.find((f) => /ยอดไม่ตรง/.test(f)) + ' — แอดมินจะตรวจสอบ อาจต้องโอนเพิ่มหรือส่งสลิปใหม่');
      save(); DB.notify('slip', o, { amount: amt, flags }); return { ok: true, flags };
    },
    // แอดมินอนุมัติ → ออก License key / ปฏิเสธ → ให้ลูกค้าส่งสลิปใหม่
    // ตั้งค่าเชื่อมระบบ License (Apps Script): URL เก็บใน settings, ADMIN_TOKEN เก็บแยกในเบราว์เซอร์แอดมิน (ไม่ติดไปกับไฟล์สำรอง)
    async resolveClip() { return { ok: false, errors: ['โหมดทดลองตรวจลิงก์อัตโนมัติไม่ได้'] }; },
    licenseCfg() { return { url: (load().settings.licenseApiUrl || '').trim(), token: localStorage.getItem('df_lic_token') || '' }; },
    // ออกคีย์จริงผ่าน adminCreate — ทำซ้ำได้ปลอดภัย: ช่อง (สินค้า#ลำดับ) ที่ออกแล้วจะไม่ออกซ้ำ
    async issueKeys(orderId) {
      const d = load(), o = d.orders.find((x) => x.id === orderId); if (!o) return { ok: false, errors: ['ไม่พบออเดอร์'] };
      o.licenseKeys = o.licenseKeys || [];
      const slots = [];
      o.items.forEach((i) => { const p = d.products.find((x) => x.id === i.id); if (p && p.licenseDevices > 0) for (let n = 0; n < i.qty; n++) slots.push({ slot: i.id + '#' + n, i, p }); });
      o.keyStatus = slots.length ? 'pending' : 'none';
      const todo = slots.filter((s) => !o.licenseKeys.some((k) => k.slot === s.slot)), cfg = DB.licenseCfg(), errors = [];
      if (todo.length && (!cfg.url || !cfg.token)) { errors.push('ยังไม่ได้ตั้งค่า License API URL / ADMIN_TOKEN (แท็บ ตั้งค่า)'); }
      else for (const s of todo) {
        try {
          const res = await fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'adminCreate', adminToken: cfg.token, customerName: o.customer.name, days: s.p.licenseDays || 0, maxSessions: s.p.licenseDevices, contact: o.customer.email + ' ' + o.customer.phone, payment: 'เว็บ ' + o.id, note: 'ออเดอร์ ' + o.id + ' · ' + s.p.name, amount: s.i.price, paidAt: o.payment && o.payment.paidAt ? new Date(o.payment.paidAt).toISOString() : '' }) });
          const j = await res.json();
          if (!j.success) { errors.push(j.error || 'ออกคีย์ไม่สำเร็จ'); break; }
          o.licenseKeys.push({ slot: s.slot, product: s.p.name, key: j.key, issuedAt: new Date().toISOString() }); save(); // บันทึกทีละคีย์ กันออกซ้ำถ้าหน้าถูกปิดกลางทาง
        } catch (e) { errors.push('เชื่อมระบบ License ไม่ได้: ' + e.message); break; }
      }
      if (slots.length && slots.every((s) => o.licenseKeys.some((k) => k.slot === s.slot))) o.keyStatus = 'issued';
      log(errors.length ? 'ออกคีย์ล้มเหลว' : 'ออกคีย์', 'orders', o.id + ' ' + o.licenseKeys.length + '/' + slots.length + (errors.length ? ' — ' + errors[0] : '')); save();
      return { ok: !errors.length, errors, total: slots.length, issued: o.licenseKeys.length };
    },
    // แอดมินอนุมัติ → ออกคีย์อัตโนมัติ / ปฏิเสธ → ให้ลูกค้าส่งสลิปใหม่
    async reviewPayment(orderId, approve, note) {
      const d = load(), o = d.orders.find((x) => x.id === orderId); if (!o || !o.payment) return { ok: false, errors: ['ไม่มีสลิป'] };
      if (o.status !== 'review') return { ok: false, errors: ['ออเดอร์นี้ไม่ได้อยู่ในสถานะรอตรวจสลิป'] };
      if (!approve) { o.status = 'rejected'; o.payment.reviewNote = note || 'สลิปไม่ถูกต้อง'; DB.addNotice(o.memberId, 'warning', 'สลิปไม่ผ่านการตรวจสอบ', 'ออเดอร์ ' + o.id + ': ' + o.payment.reviewNote + ' — กรุณาส่งสลิปใหม่ในหน้าโปรไฟล์'); log('ปฏิเสธสลิป', 'orders', o.id); save(); return { ok: true }; }
      o.status = 'paid'; o.payment.reviewNote = note || ''; o.payment.verifiedAt = new Date().toISOString(); DB.addNotice(o.memberId, 'info', 'ชำระเงินสำเร็จ', 'ออเดอร์ ' + o.id + ' ได้รับการยืนยันแล้ว — License key จะปรากฏในหน้าโปรไฟล์'); log('อนุมัติชำระเงิน', 'orders', o.id); save();
      const k = await DB.issueKeys(orderId); // อนุมัติแล้วแม้ออกคีย์พลาดก็ไม่ย้อน — แอดมินกด "ออกคีย์ใหม่" ได้
      return { ok: true, keys: k };
    },
    setOrderStatus(id, status) {
      const d = load(), o = d.orders.find((x) => x.id === id); if (!o) return;
      // ยกเลิก → คืนสต็อก (ครั้งเดียว)
      if (status === 'cancelled' && o.status !== 'cancelled') o.items.forEach((i) => { const p = d.products.find((x) => x.id === i.id); if (p) p.stock += i.qty; });
      if (o.status === 'cancelled' && status !== 'cancelled') o.items.forEach((i) => { const p = d.products.find((x) => x.id === i.id); if (p) p.stock -= i.qty; });
      o.status = status; log('สถานะ', 'orders', id + ' → ' + status); save();
    },
    // ตรวจสุขภาพข้อมูลทั้งร้าน
    health() {
      const d = load(), r = [];
      const add = (lv, msg) => r.push({ lv, msg });
      const skus = {};
      d.products.forEach((p) => {
        const er = validate('products', p); er.forEach((m) => add('err', p.name + ': ' + m));
        skus[p.sku] = (skus[p.sku] || 0) + 1;
        if (p.active && p.stock === 0) add('warn', p.name + ' สต็อกหมดแต่ยังเปิดขาย');
        else if (p.active && p.stock <= 5) add('warn', p.name + ' สต็อกใกล้หมด (' + p.stock + ')');
        if (!p.image && !p.icon) add('warn', p.name + ' ไม่มีรูป/ไอคอน');
        if (!p.desc || p.desc.length < 10) add('warn', p.name + ' คำอธิบายสั้นเกินไป');
      });
      d.categories.forEach((c) => { if (!d.products.some((p) => p.categoryId === c.id)) add('warn', 'หมวด "' + c.name + '" ไม่มีสินค้า'); });
      const pend = d.orders.filter((o) => o.status === 'pending').length; if (pend) add('warn', 'มี ' + pend + ' ออเดอร์รอชำระ/ตรวจสอบ');
      if (d.products.some((p) => p.active && p.licenseDevices > 0) && (!DB.licenseCfg().url || !DB.licenseCfg().token)) add('err', 'มีสินค้า License แต่ยังไม่ได้เชื่อมระบบออกคีย์ (ตั้ง License API URL + ADMIN_TOKEN)');
      d.orders.filter((o) => o.status === 'paid' && o.keyStatus === 'pending').forEach((o) => add('err', 'ออเดอร์ ' + o.id + ' ชำระแล้วแต่ยังออกคีย์ไม่ครบ — กด "ออกคีย์ใหม่"'));
      if (!d.settings.lineId) add('warn', 'ยังไม่ได้ตั้ง LINE ID สำหรับให้ลูกค้าติดต่อ (ตั้งค่าหน้าแรก)');
      if (!d.settings.adminPinHash) add('err', 'ยังใช้รหัสแอดมินเริ่มต้น (1234) — เปลี่ยนในแท็บตั้งค่า');
      if (new Date(d.settings.promoEndsAt) < new Date()) add('warn', 'เวลาโปรโมชันหมดแล้ว — ตั้งวันใหม่ในแท็บตั้งค่า');
      if (!r.length) add('ok', 'ข้อมูลทุกส่วนผ่านการตรวจสอบ ✔');
      return r;
    },
    exportJSON() { const c = JSON.parse(JSON.stringify(load())); ['adminPin', 'adminPinHash', 'adminSalt'].forEach((k) => delete c.settings[k]); return JSON.stringify(c, null, 2); }, // ไม่ส่งออกรหัสแอดมิน
    importJSON(txt) {
      let o; try { o = JSON.parse(txt); } catch (e) { return { ok: false, errors: ['ไฟล์ไม่ใช่ JSON'] }; }
      const need = ['settings', 'categories', 'products', 'coupons', 'orders']; const miss = need.filter((k) => !(k in o));
      if (miss.length) return { ok: false, errors: ['ขาดส่วน: ' + miss.join(', ')] };
      if (!Array.isArray(o.products) || !Array.isArray(o.orders) || typeof o.settings !== 'object') return { ok: false, errors: ['โครงสร้างไฟล์ไม่ถูกต้อง'] };
      const cur = load().settings; ['adminPin', 'adminPinHash', 'adminSalt'].forEach((k) => { delete o.settings[k]; if (k in cur) o.settings[k] = cur[k]; }); // ไฟล์นำเข้าเปลี่ยนรหัสแอดมินไม่ได้
      o.members = o.members || []; o.audit = o.audit || []; o.reviews = o.reviews || []; o.faqs = o.faqs || []; cache = o; log('นำเข้า', 'all', 'import JSON'); save(); return { ok: true };
    },
    reset() { cache = seed(); log('รีเซ็ต', 'all', 'กลับค่าเริ่มต้น'); save(); }
  };
  w.DB = DB;
})(window);
