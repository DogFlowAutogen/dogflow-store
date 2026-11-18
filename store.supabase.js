/* store.supabase.js — ชั้นข้อมูลจริง (Supabase) API เดียวกับ store.local.js
   • อ่านจากแคชในหน้า (sync) เหมือนเดิม: list/find/settings/price/me/myNotices ...
   • เขียน/เรียกเซิร์ฟเวอร์เป็น async: upsert/remove/placeOrder/submitSlip/reviewPayment/login ...
   • ราคา สต็อก คูปอง การตรวจสลิป การระงับบัญชี คำนวณที่ฐานข้อมูล (RPC) — ค่าจากเบราว์เซอร์ไม่ถูกเชื่อถือ
   ใช้งานเมื่อ config.js ตั้ง supabaseUrl + supabaseAnonKey (anon key เปิดเผยได้ ความปลอดภัยอยู่ที่ RLS) */
(function (w) {
  const CFG = w.DOGFLOW_CONFIG || {};
  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey) return;                 // ไม่ได้ตั้งค่า → ให้ store.local.js ทำงาน
  if (!w.supabase || !w.supabase.createClient) { console.error('ไม่พบ vendor/supabase.js'); return; }
  const C = w.DFCommon, { esc, baht, uid, embed } = C;
  const sb = w.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });

  const DEFAULTS = { brand: 'DogFlow Auto Gen', version: 'v1.0', tagline: '', heroTitle: '', heroSub: '', heroCta: 'เลือกแพ็กเกจเลย', promoText: '', installGuide: '', promoEndsAt: '', lineId: '', contactEmail: '', paymentInfo: '', paymentQr: '', heroImage: '', rules: '', affEnabled: true, affHoldDays: 7, affMin: 300, affTerms: '' };
  const crossPct = (p) => {
    const pr = (p && p.product) || 'dogflow'; if (!S.user || (pr !== 'dogflow' && pr !== 'dogmeta')) return 0;
    const owns = (S.orders || []).some((o) => o.memberId === S.user.id && (o.status === 'paid' || o.status === 'done') && (o.licenseKeys || []).some((k) => !k.revoked && (k.productId || 'dogflow') !== pr));
    const v = S.settings && Number.isFinite(Number(S.settings.crossDiscountPct)) ? Number(S.settings.crossDiscountPct) : 15;
    return owns ? Math.min(90, Math.max(0, v)) : 0;
  };
  const S = { user: null, me: null, isAdmin: false, settings: Object.assign({}, DEFAULTS), categories: [], brands: [], products: [], releases: [], latest: [], promos: [], banners: [], blocks: [], commissions: [], payouts: [], tickets: [], contacts: [], aff: null, affKyc: null, affTerms: null, affKycQ: [], affIp: [], reqs: [], modes: [], showcase: [], works: [], tutorials: [], reviews: [], faqs: [], coupons: [], members: [], orders: [], notices: [], audit: [] };

  /* ---------- แปลงแถวฐานข้อมูล ↔ วัตถุในแอป ---------- */
  const IN = {
    categories: (r) => ({ id: r.id, name: r.name, icon: r.icon, sort: r.sort }),
    brands: (r) => ({ id: r.id, name: r.name, logo: r.logo }),
    products: (r) => ({ id: r.id, sku: r.sku, name: r.name, categoryId: r.category_id, brandId: r.brand_id || '', price: r.price, salePrice: r.sale_price, stock: r.stock, badge: r.badge, image: r.image, icon: r.icon, licenseDevices: r.license_devices, licenseDays: r.license_days, product: r.product || 'dogflow', commission: r.commission || 0, active: r.active, desc: r.description, features: r.features || [] }),
    promos: (r) => ({ id: r.id, name: r.name, percent: r.percent, scope: r.scope, startsAt: r.starts_at, endsAt: r.ends_at, active: r.active }),
    banners: (r) => ({ id: r.id, title: r.title, image: r.image, link: r.link, sort: r.sort, startsAt: r.starts_at || '', endsAt: r.ends_at || '', active: r.active }),
    blocks: (r) => Object.assign({}, r.data || {}, { id: r.id, kind: r.kind, title: r.title, image: r.image || '', sort: r.sort, startsAt: r.starts_at || '', endsAt: r.ends_at || '', active: r.active }),
    reqs: (r) => ({ id: r.id, title: r.title, desc: r.description || '', icon: r.icon || '', image: r.image || '', kind: r.kind, sort: r.sort, active: r.active }),
    modes: (r) => ({ id: r.id, kind: r.kind, title: r.title, tag: r.tag || '', icon: r.icon || '', image: r.image || '', desc: r.description || '', secs: Number(r.secs) || 0, maxScenes: Number(r.max_scenes) || 0, points: Array.isArray(r.points) ? r.points : [], sort: r.sort, active: r.active }),
    showcase: (r) => ({ id: r.id, title: r.title, caption: r.caption, image: r.image, sort: r.sort, active: r.active, views: Number(r.views) || 0 }),
    works: (r) => ({ id: r.id, title: r.title, creator: r.creator || '', caption: r.caption || '', url: r.url, thumb: r.thumb || '', consent: !!r.consent, bot: r.bot || '', sort: r.sort, active: r.active, createdAt: r.created_at, views: Number(r.views) || 0 }),
    tutorials: (r) => ({ id: r.id, title: r.title, desc: r.description, kind: r.kind, url: r.url, thumb: r.thumb || '', mediaId: '', sort: r.sort, active: r.active, views: Number(r.views) || 0 }),
    reviews: (r) => ({ id: r.id, name: r.name, text: r.text, rating: r.rating, active: r.active }),
    faqs: (r) => ({ id: r.id, q: r.q, a: r.a, sort: r.sort }),
    coupons: (r) => ({ code: r.code, type: r.type, value: r.value, minTotal: r.min_total, active: r.active }),
    releases: (r) => ({ id: r.id, version: r.version, platform: r.platform, title: r.title, notes: r.notes, filePath: r.file_path || '', externalUrl: r.external_url || '', fileName: r.file_name, sizeBytes: Number(r.size_bytes) || 0, sha256: r.sha256 || '', mandatory: !!r.mandatory, announcedAt: r.announced_at || '', active: r.active, createdAt: r.created_at, product: r.product || 'dogflow' }),
    tickets: (r) => ({ id: r.id, code: r.code, memberId: r.member_id || '', keyMask: r.key_mask || '', verified: !!r.verified, deviceId: r.device_id || '', deviceName: r.device_name || '', source: r.source, category: r.category, severity: r.severity, priority: r.priority, module: r.module || '', title: r.title, body: r.body, appVersion: r.app_version || '', os: r.os || '', diagnostics: r.diagnostics || {}, attachments: r.attachments || [], status: r.status, dupOf: r.dup_of || '', firstResponseAt: r.first_response_at || '', resolvedAt: r.resolved_at || '', userUnread: !!r.user_unread, adminUnread: !!r.admin_unread, rating: r.rating || 0, ratingComment: r.rating_comment || '', createdAt: r.created_at, updatedAt: r.updated_at, lastActivityAt: r.last_activity_at }),
    commissions: (r) => ({ id: r.id, orderId: r.order_id || '', referrerId: r.referrer_id, buyerId: r.buyer_id || '', productId: r.product_id || '', product: r.product_name, qty: r.qty, unit: r.unit_amount, amount: r.amount, status: r.status, availableAt: r.available_at, payoutId: r.payout_id || '', manual: !!r.manual, note: r.note || '', createdAt: r.created_at, paidAt: r.paid_at || '' }),
    payouts: (r) => ({ id: r.id, memberId: r.member_id, amount: r.amount, status: r.status, info: r.info || {}, requestedAt: r.requested_at, processedAt: r.processed_at || '', transferRef: r.transfer_ref || '', adminNote: r.admin_note || '' }),
    members: (r) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, banned: r.banned, emailUpdates: r.email_updates, banReason: r.ban_reason, strikes: r.strikes, createdAt: r.created_at, refCode: r.ref_code || '', referredBy: r.referred_by || '', referredAt: r.referred_at || '', affBlocked: !!r.aff_blocked, affReason: r.aff_block_reason || '', avatarPath: r.avatar_path || '' })
  };
  const OUT = {
    categories: (o) => ({ id: o.id, name: o.name.trim(), icon: o.icon || '📁', sort: Number(o.sort) || 0 }),
    brands: (o) => ({ id: o.id, name: o.name.trim(), logo: o.logo }),
    products: (o) => ({ id: o.id, sku: o.sku.trim(), name: o.name.trim(), category_id: o.categoryId, brand_id: o.brandId || null, price: Number(o.price), sale_price: Number(o.salePrice) || 0, stock: Number(o.stock), badge: o.badge || '', image: o.image || '', icon: o.icon || '📦', license_devices: Number(o.licenseDevices) || 0, license_days: Number(o.licenseDays) || 0, product: o.product || 'dogflow', commission: Number(o.commission) || 0, active: !!o.active, description: o.desc || '', features: o.features || [] }),
    promos: (o) => ({ id: o.id, name: o.name.trim(), percent: Number(o.percent), scope: o.scope, starts_at: o.startsAt, ends_at: o.endsAt, active: !!o.active }),
    banners: (o) => ({ id: o.id, title: o.title.trim(), image: o.image, link: o.link || '#shop', sort: Number(o.sort) || 0, starts_at: o.startsAt || null, ends_at: o.endsAt || null, active: !!o.active }),
    blocks: (o) => { const data = {}; ((C.BLOCKS[o.kind] || { fields: [] }).fields).forEach((f) => { if (f.k !== 'image') data[f.k] = o[f.k] === undefined ? (f.list ? [] : f.type === 'check' ? false : '') : o[f.k]; }); return { id: o.id, kind: o.kind, title: o.title.trim(), image: o.image || '', data, sort: Number(o.sort) || 0, starts_at: o.startsAt || null, ends_at: o.endsAt || null, active: !!o.active }; },
    commissions: (o) => { const q = Math.max(1, Number(o.qty) || 1), amt = Number(o.amount) || 0; return { id: o.id, order_id: o.orderId || null, referrer_id: o.referrerId, buyer_id: o.buyerId || null, product_id: o.productId || null, product_name: (o.product || '').trim(), qty: q, unit_amount: Math.round(amt / q), amount: amt, status: o.status, available_at: o.availableAt || new Date().toISOString(), manual: o.manual !== false && !o.orderId, note: (o.note || '').trim().slice(0, 300) }; },
    tickets: (o) => ({ id: o.id, member_id: o.memberId || null, source: o.source || 'admin', category: o.category, severity: o.severity, priority: o.priority, module: (o.module || '').trim(), title: o.title.trim(), body: o.body.trim(), app_version: (o.appVersion || '').trim(), os: (o.os || '').trim(), status: o.status }),
    reqs: (o) => ({ id: o.id, title: o.title.trim(), description: (o.desc || '').trim(), icon: (o.icon || '').trim(), image: o.image || '', kind: o.kind, sort: Number(o.sort) || 0, active: !!o.active }),
    modes: (o) => ({ id: o.id, kind: ['genre', 'feature'].includes(o.kind) ? o.kind : 'bot', title: o.title.trim(), tag: (o.tag || '').trim(), icon: (o.icon || '').trim(), image: o.image || '', description: (o.desc || '').trim(), secs: Number(o.secs) || 0, max_scenes: Number(o.maxScenes) || 0, points: (o.points || []).map((x) => String(x).trim()).filter(Boolean), sort: Number(o.sort) || 0, active: !!o.active }),
    showcase: (o) => ({ id: o.id, title: o.title.trim(), caption: o.caption || '', image: o.image, sort: Number(o.sort) || 0, active: !!o.active }),
    works: (o) => ({ id: o.id, title: (o.title || '').trim(), creator: (o.creator || '').trim(), caption: (o.caption || '').trim(), url: (o.url || '').trim(), thumb: o.thumb || '', consent: !!o.consent, bot: (o.bot || '').trim(), sort: Number(o.sort) || 0, active: !!o.active }),
    tutorials: (o) => ({ id: o.id, title: o.title.trim(), description: o.desc || '', kind: o.kind === 'file' ? 'file' : 'link', url: (o.url || '').trim(), thumb: o.thumb || '', sort: Number(o.sort) || 0, active: !!o.active }),
    reviews: (o) => ({ id: o.id, name: o.name.trim(), text: o.text.trim(), rating: Number(o.rating), active: o.active !== false }),
    faqs: (o) => ({ id: o.id, q: o.q.trim(), a: o.a.trim(), sort: Number(o.sort) || 0 }),
    releases: (o) => ({ id: o.id, version: o.version.trim(), platform: o.platform, title: o.title || '', notes: o.notes || '', file_path: o.filePath || null, external_url: o.externalUrl || null, file_name: o.fileName || '', size_bytes: Number(o.sizeBytes) || 0, sha256: o.sha256 || null, mandatory: !!o.mandatory, active: !!o.active, product: o.product || 'dogflow' }),
    coupons: (o) => ({ code: o.code, type: o.type, value: Number(o.value), min_total: Number(o.minTotal) || 0, active: !!o.active })
  };
  const TABLE = { members: 'profiles', blocks: 'home_blocks', reqs: 'requirements' }, KEY = { coupons: 'code' }, IMG = { reqs: ['image'], modes: ['image'], products: ['image'], banners: ['image'], blocks: ['image'], showcase: ['image'], works: ['thumb'], tutorials: ['thumb'], brands: ['logo'] };
  const ORDER = { reqs: 'sort', modes: 'sort', categories: 'sort', faqs: 'sort', banners: 'sort', blocks: 'sort', showcase: 'sort', works: 'sort', tutorials: 'sort' };
  const tbl = (e) => TABLE[e] || e, key = (e) => KEY[e] || 'id';

  const mapPay = (p) => p && ({ id: p.id, ref: p.ref, amount: Number(p.amount), paidAt: p.paid_at, slipPath: p.slip_path, flags: p.flags || [], reviewNote: p.review_note, submittedAt: p.submitted_at, verifiedAt: p.verified_at });
  const mapOrder = (r, pays, keys) => ({ id: r.id, memberId: r.member_id, items: r.items, subtotal: r.subtotal, discount: r.discount, coupon: r.coupon, total: r.total, status: r.status, keyStatus: r.key_status, customer: r.customer, note: r.note, createdAt: r.created_at,
    payment: mapPay((pays[r.id] || [])[0]), licenseKeys: (keys[r.id] || []).map((k) => ({ slot: k.slot, product: k.product_name, key: k.key, issuedAt: k.issued_at, revoked: !!k.revoked_at, revokeReason: k.revoke_reason || '', validUntil: k.valid_until || '', renewed: !!k.renewed, productId: k.product || 'dogflow' })) });
  const groupBy = (rows, f) => rows.reduce((m, r) => ((m[r[f]] = m[r[f]] || []).push(r), m), {});

  /* ---------- แปลข้อความผิดพลาด ---------- */
  function tr(e) {
    if (!e) return 'เกิดข้อผิดพลาด';
    const m = String(e.message || e), c = e.code;
    if (c === '23505') return 'ข้อมูลซ้ำ (เช่น SKU / ชื่อ / โค้ดซ้ำกับรายการที่มีอยู่)';
    if (c === '23503') return 'มีข้อมูลอื่นอ้างอิงอยู่ — ย้าย/ลบรายการที่เกี่ยวข้องก่อน';
    if (c === '23514') return 'ข้อมูลไม่ผ่านเงื่อนไขของระบบ (ตรวจราคา/จำนวน/วันที่)';
    if (c === '42501' || /row-level security|permission denied/i.test(m)) return 'ไม่มีสิทธิ์ทำรายการนี้';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจอินเทอร์เน็ตแล้วลองใหม่';
    if (/Invalid login credentials/i.test(m)) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    if (/User already registered|already been registered/i.test(m)) return 'อีเมลนี้สมัครแล้ว — เข้าสู่ระบบแทน';
    if (/Email not confirmed/i.test(m)) return 'ยังไม่ได้ยืนยันอีเมล — ตรวจกล่องจดหมายแล้วกดลิงก์ยืนยัน (ถ้าไม่พบ ให้ดูในกล่องสแปม/ขยะ)';
    if (/banned|User is banned/i.test(m)) return 'บัญชีนี้ถูกระงับ — ติดต่อแอดมิน';
    if (/rate limit|too many|security purposes|once every/i.test(m)) return 'ทำรายการถี่เกินไป กรุณารอสักครู่ (ขอส่งอีเมลได้ครั้งละ 1 ครั้งต่อนาที)';
    return m;
  }
  const fail = (e) => ({ ok: false, errors: [tr(e)] });
  async function fnErr(error) { try { const j = await error.context.json(); return j.error || error.message; } catch (x) { return error.message; } }
  const emit = () => w.dispatchEvent(new CustomEvent('db:change'));
  const dataUrlToBlob = (u) => { const [h, b] = u.split(','), mime = (h.match(/:(.*?);/) || [])[1] || 'image/jpeg', bin = atob(b), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: mime }); };

  /* ---------- โหลดข้อมูล ---------- */
  async function loadPublic() {
    const rd = (t) => { let q = sb.from(TABLE[t] || t).select('*'); if (ORDER[t]) q = q.order(ORDER[t]); return q; };
    const names = ['categories', 'brands', 'products', 'promos', 'banners', 'blocks', 'reqs', 'modes', 'showcase', 'works', 'tutorials', 'reviews', 'faqs'];
    const [st, ...rs] = await Promise.all([sb.from('app_settings').select('data').eq('id', 1).maybeSingle(), ...names.map(rd)]);
    if (st.error) throw st.error;
    S.settings = Object.assign({}, DEFAULTS, (st.data && st.data.data) || {});
    names.forEach((n, i) => { if (rs[i].error) throw rs[i].error; S[n] = rs[i].data.map(IN[n]); });
    const lr = await sb.rpc('public_latest_release'); S.latest = (lr && Array.isArray(lr.data)) ? lr.data : [];   // เวอร์ชันล่าสุดแบบสาธารณะ (ไม่มีลิงก์ไฟล์)
  }
  async function loadDynamic() {
    if (!S.user) return;
    const lim = S.isAdmin ? 500 : 100;
    const jobs = [sb.from('orders').select('*').order('created_at', { ascending: false }).limit(lim), sb.from('payments').select('*').order('submitted_at', { ascending: false }).limit(lim * 3),
      sb.from('license_keys').select('*').order('issued_at').limit(lim * 5), sb.from('notices').select('*').eq('member_id', S.user.id).order('created_at', { ascending: false }).limit(100)];
    if (S.isAdmin) jobs.push(sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(1000), sb.from('coupons').select('*'), sb.from('audit').select('*').order('ts', { ascending: false }).limit(300), sb.from('commissions').select('*').order('created_at', { ascending: false }).limit(2000), sb.from('payouts').select('*').order('requested_at', { ascending: false }).limit(500));
    const [o, p, k, n, m, cp, au, cm, po] = await Promise.all(jobs);
    for (const r of [o, p, k, n, m, cp, au, cm, po]) if (r && r.error) throw r.error;
    const tkq = await sb.from('feedback_tickets').select('*').order('created_at', { ascending: false }).limit(S.isAdmin ? 1000 : 100);   // แอดมินเห็นทั้งหมด · สมาชิกเห็นเฉพาะของตัวเอง (RLS)
    S.tickets = tkq.error ? [] : tkq.data.map(IN.tickets);
    if (S.isAdmin) { const cq = await sb.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(300); S.contacts = cq.error ? [] : cq.data.map((r) => ({ id: r.id, createdAt: r.created_at, name: r.name, email: r.email, phone: r.phone || '', subject: r.subject, message: r.message, status: r.status, lineSent: !!r.line_sent, emailSent: !!r.email_sent, notifyError: r.notify_error || '' })); } else S.contacts = [];   // [2026-10-28] ข้อความจากฟอร์มติดต่อ (เฉพาะแอดมิน · ยังไม่ได้ลงตาราง = ว่างเงียบๆ)
    // [2026-11-17] เฟส 3 ข้อ 1: สัญญาณ IP ผู้แนะนำ/ผู้ถูกแนะนำ (เฉพาะแอดมิน) — ฟังก์ชันยังไม่มีบนฐานข้อมูล/ไม่ใช่แอดมิน = ว่าง ไม่ให้พังหน้า
    if (S.isAdmin) { const iq = await sb.rpc('admin_aff_ip_flags'); S.affIp = iq.error ? [] : (iq.data || []); const kqq = await sb.rpc('admin_aff_kyc_list'); S.affKycQ = kqq.error ? [] : (kqq.data || []); }
    const pays = groupBy(p.data, 'order_id'), keys = groupBy(k.data, 'order_id');
    // [2026-10-14] ต่ออายุคีย์เดิม: ออเดอร์ที่ใช้ต่อไม่มีแถวคีย์ของตัวเอง → ยืมแถวคีย์เดิมมาแสดงในออเดอร์นั้น (ติดธง renewed ไม่ให้นับซ้ำในรายการคีย์)
    for (const kr of k.data) for (const e of (kr.renewed_orders || [])) { const [oid, slot] = String(e).split('|'); (keys[oid] = keys[oid] || []).push(Object.assign({}, kr, { slot, renewed: true })); }
    S.orders = o.data.map((r) => mapOrder(r, pays, keys));
    S.trialConv = k.data.filter((r) => r.trial_days != null && r.kind === 'paid').length;   // คีย์ทดลองที่ลูกค้าซื้อแพ็กเกจต่อ (อัปเกรดเป็น paid แล้ว) — ใช้ในกรวยหน้า ภาพรวม
    S.trialKeys = k.data.filter((r) => r.kind === 'trial').map((r) => ({ id: r.id, memberId: r.member_id, key: r.key, issuedAt: r.issued_at, expiresAt: r.expires_at, trialDays: r.trial_days, productId: r.product || 'dogflow', revoked: !!r.revoked_at, revokeReason: r.revoke_reason || '' }));   // [2026-10-14] คีย์ทดลองไม่มีออเดอร์ จึงไม่อยู่ใน mapOrder — แยกเก็บ
    S.notices = n.data.map((r) => ({ id: r.id, memberId: r.member_id, type: r.type, title: r.title, body: r.body, read: r.read, createdAt: r.created_at }));
    if (S.isAdmin) { S.commissions = cm.data.map(IN.commissions); S.payouts = po.data.map(IN.payouts); S.members = m.data.map(IN.members); S.coupons = cp.data.map(IN.coupons); S.audit = au.data.map((r) => ({ ts: r.ts, action: r.action, entity: r.entity, detail: (r.detail && (r.detail.name || r.detail.id)) || '' })); }
  }
  // ตัวแทนขาย: สรุปทั้งหมดของสมาชิกคนนี้มาจาก RPC เดียว (ปิดบังข้อมูลผู้สมัคร คำนวณยอดที่ฐานข้อมูล) — ล้มเหลวไม่กระทบส่วนอื่น
  async function loadAff() { if (!S.user) { S.aff = null; S.affKyc = null; return; } const r = await sb.rpc('aff_overview'); S.aff = r.error ? null : r.data;
    const kq = await sb.rpc('aff_kyc_status'); S.affKyc = kq.error ? null : kq.data;
    const tq = await sb.rpc('aff_terms_status'); S.affTerms = tq.error ? null : tq.data; }   // [2026-11-17] ตัวแทนเดิมต้องยอมรับเงื่อนไขฉบับล่าสุดซ้ำก่อนถอน (ฟังก์ชันยังไม่มี = null ไม่พังหน้า)   // [2026-11-17] เฟส 3 ข้อ 3: สถานะยืนยันตัวตนด้วยบัตร (ฟังก์ชันยังไม่มี = null ไม่พังหน้า)
  // [2026-10-14] สถานะสิทธิ์ทดลองใช้ฟรีของสมาชิก (แหล่งความจริงเดียวที่ฐานข้อมูล) + คิวคำขอของแอดมิน — ล้มเหลวไม่กระทบส่วนอื่น
  async function loadTrial() { if (!S.user) { S.trial = null; S.trialMeta = null; S.trialQ = null; return; } const r = await sb.rpc('trial_status'); S.trial = r.error ? null : r.data;
    { const tm = await sb.rpc('trial_status_p', { p_product: 'dogmeta' }); S.trialMeta = tm.error ? null : tm.data; }   /* [2026-11-18] ทดลอง DogMeta (ยังไม่ลง SQL = null → ซ่อนการ์ด) */
     if (S.isAdmin) { const q = await sb.rpc('admin_trial_queue'); S.trialQ = q.error ? null : q.data; const st = await sb.from('trial_requests').select('status').limit(5000); S.siteStats = null; try { const ss = await sb.rpc('admin_site_stats'); S.siteStats = ss.error ? null : ss.data; } catch (e) {}   /* [2026-10-31] สถิติเข้าชมเว็บ (ยังไม่ลง SQL = null → ซ่อนการ์ด) */
    S.trialStats = st.error ? null : { requested: st.data.length, approved: st.data.filter((x) => x.status === 'approved').length, rejected: st.data.filter((x) => x.status === 'rejected').length, cancelled: st.data.filter((x) => x.status === 'cancelled').length, pending: st.data.filter((x) => x.status === 'pending').length }; } else { S.trialQ = null; S.trialStats = null; } }
  let live = null, timer = null;
  function subscribe() {
    if (live || !S.user) return;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => Promise.all([loadDynamic(), loadAff(), loadTrial()]).then(emit).catch(() => {}), 400); };
    live = sb.channel('df-live');
    ['orders', 'payments', 'license_keys', 'notices', 'commissions', 'payouts', 'feedback_tickets', 'trial_requests', 'contact_messages'].forEach((t) => live.on('postgres_changes', { event: '*', schema: 'public', table: t }, refresh));
    live.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feedback_messages' }, () => { refresh(); w.dispatchEvent(new CustomEvent('fb:msg')); });   // ข้อความใหม่ในตั๋ว → ให้หน้าต่างสนทนาที่เปิดอยู่โหลดใหม่
    live.subscribe();
  }
  function unsubscribe() { if (live) { sb.removeChannel(live); live = null; } }
  async function loadReleases() { const r = await sb.from('releases').select('*').order('created_at', { ascending: false }); if (r.error) throw r.error; S.releases = r.data.map(IN.releases); }   // RLS: คืนเฉพาะผู้มีคีย์ที่ใช้งานได้ / แอดมิน
  async function loadMine() {
    const { data: s } = await sb.auth.getSession(); S.user = (s.session && s.session.user) || null;
    S.me = null; S.isAdmin = false; S.orders = []; S.notices = []; S.members = []; S.coupons = []; S.audit = []; S.commissions = []; S.payouts = []; S.tickets = []; S.contacts = []; S.aff = null; S.trial = null; S.trialQ = null; S.trialStats = null; S.trialConv = 0;
    S.releases = [];
    if (!S.user) { unsubscribe(); return; }
    const { data: p } = await sb.from('profiles').select('*').eq('id', S.user.id).maybeSingle();
    if (!p || p.banned) { await sb.auth.signOut(); S.user = null; unsubscribe(); return; }
    S.me = IN.members(p);
    const { data: a } = await sb.rpc('is_admin'); S.isAdmin = a === true;
    await loadDynamic(); await loadReleases(); await loadAff(); await loadTrial(); subscribe();
  }
  let initP = null;
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT' && S.user) loadMine().then(emit); });

  const upload = async (bucket, path, blob, opts) => { const { error } = await sb.storage.from(bucket).upload(path, blob, Object.assign({ upsert: false, cacheControl: '31536000' }, opts)); if (error) throw error; return path; };
  async function uploadImage(dataUrl, folder) {      // dataURL → ไฟล์ใน bucket media → URL สาธารณะ
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)) return dataUrl;
    const blob = dataUrlToBlob(dataUrl), ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg', path = `${folder}/${uid('')}.${ext}`;
    await upload('media', path, blob, { contentType: blob.type });
    return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
  }

  /* ---------- API ---------- */
  const DB = {
    mode: 'supabase', uid, baht, esc, embed,
    init() { return initP || (initP = (async () => { await loadPublic(); await loadMine(); })()); },
    async refresh() { await loadPublic(); await loadMine(); emit(); },   // รีเฟรชข้อมูลทั้งหมดจากเซิร์ฟเวอร์
    // ----- อ่าน (sync จากแคช) -----
    get: () => S, settings: () => S.settings, list: (e) => S[e] || [], find: (e, id) => (S[e] || []).find((x) => x[key(e)] === id),
    validate: (e, o) => C.validate(e, o, S),
    // [2026-11-18] ส่วนลดข้ามโปรแกรม (ลด crossDiscountPct% ค่าเริ่มต้น 15) เมื่อสมาชิกเคยซื้อคีย์ "อีกโปรแกรม" (ไม่นับคีย์ทดลอง/คีย์ที่ถูกระงับ) — กติกาเดียวกับ place_order/_cross_pct ฝั่งเซิร์ฟเวอร์
    crossPct: (p) => crossPct(p),
    price: (p) => { const n = C.price(p, S.promos), c = crossPct(p); return c ? Math.round(n * (100 - c) / 100) : n; }, activePromos: () => C.activePromos(S.promos), activeBanners: () => C.activeBanners(S.banners), activeBlocks: () => C.activeBlocks(S.blocks), couponCalc: C.couponCalc,
    me: () => S.me, isAdmin: () => S.isAdmin, myNotices: () => S.notices, unreadCount: () => S.notices.filter((n) => !n.read).length,
    embed,
    // ----- เขียนแคตตาล็อก (แอดมิน) -----
    async upsert(entity, obj) {
      const errors = DB.validate(entity, obj); if (errors.length) return { ok: false, errors };
      try {
        const o = Object.assign({}, obj); for (const f of IMG[entity] || []) if (o[f]) o[f] = await uploadImage(o[f], entity);
        const row = OUT[entity](o), cur = DB.find(entity, o[key(entity)]);
        if (entity === 'products' && cur && cur.stock === row.stock) delete row.stock;      // ไม่เขียนสต็อกทับถ้าแอดมินไม่ได้แก้ (กันทับยอดที่ลูกค้าเพิ่งซื้อ)
        if (entity === 'members') { const { error } = await sb.rpc('admin_update_member', { p_member: o.id, p_name: o.name, p_phone: o.phone }); if (error) return fail(error); }
        else { const { error } = await sb.from(tbl(entity)).upsert(row, { onConflict: key(entity) }); if (error) return fail(error); }
        if (entity === 'commissions' || (entity === 'products' && S.user)) loadAff().catch(() => {});
        await Promise.all([entity === 'members' ? loadDynamic() : loadPublic(), S.isAdmin ? loadDynamic() : null, entity === 'releases' ? loadReleases() : null]); emit(); return { ok: true };
      } catch (e) { return fail(e); }
    },
    async remove(entity, k) {
      try {
        if (entity === 'works' || entity === 'tutorials') { const cur = DB.find(entity, k), base = sb.storage.from('media').getPublicUrl('').data.publicUrl; if (cur && cur.url && cur.url.startsWith(base) && !S[entity].some((x) => x.id !== k && x.url === cur.url)) { try { await sb.storage.from('media').remove([decodeURIComponent(cur.url.slice(base.length))]); } catch (e) { /* ลบไฟล์ไม่ได้ก็ลบรายการต่อ */ } } }
        if (entity === 'releases') { const cur = DB.find('releases', k); if (cur && cur.filePath && !S.releases.some((x) => x.id !== k && x.filePath === cur.filePath)) { try { await sb.storage.from('releases').remove([cur.filePath]); } catch (e) { /* ลบไฟล์ไม่ได้ก็ลบรายการต่อ */ } } }
        const { error } = entity === 'members' ? await sb.rpc('admin_delete_member', { p_member: k }) : await sb.from(tbl(entity)).delete().eq(key(entity), k);
        if (error) return fail(error);
        await Promise.all([loadPublic(), loadDynamic(), loadReleases()]); emit(); return { ok: true };
      } catch (e) { return fail(e); }
    },
    async saveSettings(patch) {
      try {
        const data = Object.assign({}, S.settings, patch);
        for (const f of ['paymentQr', 'heroImage']) if (data[f]) data[f] = await uploadImage(data[f], 'site');
        const { error } = await sb.from('app_settings').upsert({ id: 1, data }); if (error) return fail(error);
        S.settings = Object.assign({}, DEFAULTS, data); emit(); return { ok: true };
      } catch (e) { return fail(e); }
    },
    uploadImage,
    // วิดีโอคู่มือ: อัปโหลดเข้า bucket media แล้วเก็บเป็นลิงก์ https
    async attachVideo(o, file) {
      const EXT = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-m4v': 'm4v' };   // .mov ของ iPhone/Mac เล่นได้ใน Chrome/Safari (Firefox อาจเล่นไม่ได้)
      if (!EXT[file.type]) return { ok: false, errors: ['รองรับเฉพาะ .mp4 / .webm / .mov'] };
      if (file.size > 50 * 1048576) return { ok: false, errors: ['ไฟล์ใหญ่เกิน 50MB (ข้อจำกัดของ Storage) — ใช้ลิงก์ YouTube/Vimeo แทน'] };
      try { const path = `videos/${uid('')}.${EXT[file.type]}`; await upload('media', path, file, { contentType: file.type }); o.url = sb.storage.from('media').getPublicUrl(path).data.publicUrl; o.mediaId = ''; return { ok: true }; } catch (e) { return fail(e); }
    },
    async playUrl(t) { return t.url; },
    // ----- ดาวน์โหลดโปรแกรม -----
    canDownload: () => S.releases.some((r) => r.active),
    // QR เข้ากลุ่ม LINE ลูกค้า: bucket ส่วนตัว — ฐานข้อมูลออก signed URL ให้เฉพาะผู้ที่มี License ใช้งานได้ (policy ใช้ has_license) ไม่มีสิทธิ์ = ''
    async groupQrUrl() { try { const r = await sb.storage.from('community').createSignedUrl('line-group-qr.jpg', 300); return r.error ? '' : r.data.signedUrl; } catch (e) { return ''; } },
    latestRelease: (platform, product) => S.latest.find((x) => x.platform === (platform || 'windows') && (x.product || 'dogflow') === (product || 'dogflow')) || null,   // [2026-11-18] ต่อสินค้า (ค่าเริ่มต้น dogflow)
    // แอดมิน: ประกาศเวอร์ชันใหม่ให้ลูกค้าที่มีสิทธิ์ (แจ้งในโปรไฟล์ + เข้าคิวอีเมล) → คืนจำนวนผู้รับ
    async countView(entity, id) { const { data, error } = await sb.rpc(entity === 'tutorials' ? 'tutorial_view' : entity === 'showcase' ? 'showcase_view' : 'work_view', { p_id: id }); if (error || data == null) return null; const w = DB.find(entity, id); if (w) w.views = Number(data) || 0; return Number(data) || 0; },   // นับยอดวิวผลงาน (ฟังก์ชันฝั่งฐานข้อมูลบวกทีละ 1) — ยังไม่ได้ลงฟังก์ชัน = คืน null เงียบๆ
    async announceRelease(id) { const { data, error } = await sb.rpc('announce_release', { p_release: id }); if (error) return fail(error); await Promise.all([loadReleases(), loadDynamic()]); emit(); return { ok: true, count: data }; },
    async setEmailUpdates(on) { const { error } = await sb.rpc('set_email_updates', { p_on: !!on }); if (error) return fail(error); if (S.me) S.me.emailUpdates = !!on; emit(); return { ok: true }; },
    // แอดมิน: ระงับ/คืนสิทธิ์คีย์ของสมาชิกที่ License Server (Edge Function revoke-keys)
    // แปะลิงก์ที่กดแชร์จากแอป (รวมลิงก์ย่อ vm.tiktok.com) → ลิงก์เต็ม + ชื่อ/เครดิต/ภาพปก + ตรวจว่าฝังได้ (Edge Function clip-resolve, แอดมินเท่านั้น)
    async resolveClip(url) { const { data, error } = await sb.functions.invoke('clip-resolve', { body: { url } }); if (error) return { ok: false, errors: [await fnErr(error)] }; return data && data.ok ? data : { ok: false, errors: [(data && data.error) || 'ตรวจลิงก์ไม่สำเร็จ'] }; },
    async revokeKeys(memberId, reason) { const { data, error } = await sb.functions.invoke('revoke-keys', { body: { memberId, reason } }); if (error) return { ok: false, errors: [await fnErr(error)] }; await loadDynamic(); emit(); return data.ok ? { ok: true, changed: data.changed } : { ok: false, errors: data.errors || [data.error] }; },
    async restoreKeys(memberId) { const { data, error } = await sb.functions.invoke('revoke-keys', { body: { memberId, restore: true } }); if (error) return { ok: false, errors: [await fnErr(error)] }; await loadDynamic(); emit(); return data.ok ? { ok: true, changed: data.changed } : { ok: false, errors: data.errors || [data.error] }; },
    // [2026-10-14] คีย์ทดลองใช้ฟรี: สมาชิกเห็นของตัวเอง (RLS) · แอดมินเห็นทั้งหมด · ออกคีย์ผ่าน Edge Function issue-trial (แอดมินเท่านั้น)
    trialKeys: (memberId) => (S.trialKeys || []).filter((k) => !memberId || k.memberId === memberId),
    async issueTrial(memberId, days, devices, note, force, product) { const { data, error } = await sb.functions.invoke('issue-trial', { body: { memberId, days, devices, note, force: !!force, product: product || 'dogflow' } }); if (error) return { ok: false, errors: [await fnErr(error)] }; if (data.dup) return { ok: false, dup: true, matches: data.matches || [], errors: [data.error] }; await loadDynamic(); emit(); return data.ok ? { ok: true, key: data.key, days: data.days, devices: data.devices, expiresAt: data.expiresAt } : { ok: false, errors: [data.error || 'ออกคีย์ทดลองไม่สำเร็จ'] }; },
    // [2026-10-14] แจ้งลูกค้าทั้งหมด (แอดมิน): นับผู้รับ / ส่ง (กันส่งซ้ำด้วย idem + ตรวจจำนวนที่ยืนยัน) / ประวัติ — ตรรกะทั้งหมดอยู่ที่ฐานข้อมูล (broadcasts.sql)
    async broadcastPreview(aud) { const { data, error } = await sb.rpc('admin_broadcast_preview', { p_audience: aud }); if (error) return fail(error); return { ok: true, count: data.count, sample: data.sample || [] }; },
    async broadcastSend(o) { const { data, error } = await sb.rpc('admin_broadcast', { p_idem: o.idem, p_title: o.title, p_body: o.body, p_type: o.type, p_audience: o.audience, p_expect: o.expect }); if (error) return fail(error); return { ok: true, recipients: data.recipients, duplicate: !!data.duplicate }; },
    async broadcastHistory() { const { data, error } = await sb.from('broadcasts').select('id,created_at,title,audience,recipients,type').order('created_at', { ascending: false }).limit(8); return error ? [] : data; },
    trialStatus: (product) => (product === 'dogmeta' ? S.trialMeta || null : S.trial || null),   // [2026-11-18] ต่อโปรแกรม (ไม่ส่ง = dogflow)
    siteStats: () => S.siteStats || null,
    siteReport: async (from, to) => { if (!S.isAdmin) return null; try { const r = await sb.rpc('admin_site_report', { p_from: from, p_to: to }); return r.error ? null : r.data; } catch (e) { return null; } },   // [2026-10-31] รายงานเข้าชมละเอียดตามช่วงวันที่
    trialStats: () => (S.trialStats ? Object.assign({}, S.trialStats, { converted: S.trialConv || 0 }) : null),
    trialQueue: () => S.trialQ || { pending: [], recent: [] },
    async requestTrial(note, consent, product) {   // สมาชิกกดขอ → RPC (กันกดซ้ำที่ฐานข้อมูล) แล้วยิงแจ้ง LINE แอดมินทันที (ล้มเหลวไม่เป็นไร ตัวกวาดทุกนาทีเก็บตกให้)
      const meta = product && product !== 'dogflow', { data, error } = meta ? await sb.rpc('request_trial_p', { p_product: product, p_note: note || '', p_consent: !!consent }) : await sb.rpc('request_trial', { p_note: note || '', p_consent: !!consent }); if (error) return fail(error);
      if (meta) S.trialMeta = data; else S.trial = data; emit();
      if (data && data.state === 'pending' && data.request) sb.functions.invoke('notify-line', { body: { event: 'trial', requestId: data.request.id } }).catch(() => {});
      return { ok: true, status: data };
    },
    // [2026-10-28] ยืนยันตัวตนผ่าน LINE: ขอรหัส (คืนรหัสดิบครั้งเดียว) / เช็กสถานะ — เมื่อยืนยันแล้วโหลดสถานะทดลองใช้ฟรีใหม่
    async lineVerifyStart() { const { data, error } = await sb.rpc('line_verify_start'); if (error) return fail(error); if (data && data.verified) { await loadTrial(); emit(); } return { ok: true, data }; },
    async lineVerifyCheck() { const { data, error } = await sb.rpc('line_verify_status'); if (error) return fail(error); if (data && data.verified) { await loadTrial(); emit(); } return { ok: true, verified: !!(data && data.verified) }; },
    async cancelTrialRequest(product) { const meta = product && product !== 'dogflow', { data, error } = meta ? await sb.rpc('cancel_trial_request_p', { p_product: product }) : await sb.rpc('cancel_trial_request'); if (error) return fail(error); if (meta) S.trialMeta = data; else S.trial = data; emit(); return { ok: true, status: data }; },
    async reviewTrial(id, action, code, note, retry) { const { data, error } = await sb.rpc('admin_review_trial', { p_id: id, p_action: action, p_code: code || '', p_note: note || '', p_retry: retry || 'default' }); if (error) return fail(error); await loadTrial(); emit(); return { ok: true, status: data && data.status }; },
    async approveTrial(requestId, days, devices, force) { const { data, error } = await sb.functions.invoke('issue-trial', { body: { requestId, days, devices, force: !!force } }); if (error) return { ok: false, errors: [await fnErr(error)] }; if (data.dup) return { ok: false, dup: true, matches: data.matches || [], errors: [data.error] }; await Promise.all([loadDynamic(), loadTrial()]); emit(); return data.ok ? { ok: true, key: data.key, days: data.days, devices: data.devices } : { ok: false, errors: [data.error || 'อนุมัติไม่สำเร็จ'] }; },
    async dispatchNotices() { const { data, error } = await sb.functions.invoke('dispatch-notices', { body: {} }); if (error) return { ok: false, errors: [await fnErr(error)] }; return data.ok ? { ok: true, sent: data.sent, skipped: data.skipped } : { ok: false, errors: [data.error || 'ส่งอีเมลบางรายการไม่สำเร็จ'], sent: data.sent, failed: data.failed }; },
    // ขอสิทธิ์ที่เซิร์ฟเวอร์ (ตรวจคีย์/โควตา/บันทึกประวัติ) แล้วออก signed URL อายุ 2 นาที
    async downloadUrl(id) {
      // รุ่นที่เก็บไว้ใน GitHub Release ส่วนตัว (repo เกิน 50MB เพดานฟรีของ Storage) — ให้ Edge Function ดึงไฟล์แทนแล้วส่งกลับมาเป็น blob
      // เช็กจากแคชที่โหลดไว้แล้วก่อนเรียกเซิร์ฟเวอร์ เพื่อไม่ให้เรียกทั้ง request_download และ release-download ซ้อนกัน (จะนับโควตา/บันทึกประวัติซ้ำ)
      const cached = S.releases.find((x) => x.id === id);
      if (cached && /^https:\/\/api\.github\.com\/repos\/DogFlowAutogen\/dogflow-releases\/releases\/assets\//.test(cached.externalUrl || '')) {
        const { data: blob, error } = await sb.functions.invoke('release-download', { body: { releaseId: id } });
        if (error) return { ok: false, errors: [await fnErr(error)] };
        return { ok: true, url: URL.createObjectURL(blob), fileName: cached.fileName, sha256: cached.sha256 };
      }
      const { data, error } = await sb.rpc('request_download', { p_release: id }); if (error) return fail(error);
      if (data.url) return { ok: true, url: data.url, fileName: data.fileName, sha256: data.sha256 };
      const s = await sb.storage.from('releases').createSignedUrl(data.path, 120, { download: data.fileName || true }); if (s.error) return fail(s.error);
      return { ok: true, url: s.data.signedUrl, fileName: data.fileName, sha256: data.sha256 };
    },
    // [2026-11-16 ผู้ใช้แจ้ง "กดดาวน์โหลดแล้วไม่มีสถานะอะไรขึ้นเลย"] เหมือน downloadUrl ทุกประการ แต่ดึงไฟล์เองทีละก้อน (stream) แทนรอ sb.functions.invoke
    //  คืน blob ก้อนเดียวเหมือนเดิม — จึงรู้ "โหลดไปแล้วกี่ไบต์ จากทั้งหมดกี่ไบต์" ระหว่างทาง เรียก onProgress(got, total) ให้หน้าเว็บโชว์ % ได้ (เดิมไม่มีทางรู้เลยจนกว่าจะเสร็จทั้งไฟล์)
    //  ดึงตรงไม่ได้ (เช่น CORS/เครือข่าย) → ถอยไปใช้ downloadUrl เดิม (ได้ลิงก์ตรง ไม่มี % แต่เบราว์เซอร์โชว์ความคืบหน้าของตัวเองที่แถบดาวน์โหลดแทน)
    async downloadFile(id, onProgress) {
      const prog = typeof onProgress === 'function' ? onProgress : () => {};
      async function readWithProgress(res, totalHint) {
        const total = Number(res.headers.get('content-length')) || totalHint || 0;
        if (!res.body || !res.body.getReader) { const blob = await res.blob(); prog(blob.size, total || blob.size); return blob; }
        const reader = res.body.getReader(); const chunks = []; let got = 0;
        for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; prog(got, total); }
        return new Blob(chunks);
      }
      const cached = S.releases.find((x) => x.id === id);
      try {
        if (cached && /^https:\/\/api\.github\.com\/repos\/DogFlowAutogen\/dogflow-releases\/releases\/assets\//.test(cached.externalUrl || '')) {
          const { data: ssn } = await sb.auth.getSession(); const token = ssn && ssn.session && ssn.session.access_token;
          if (!token) return { ok: false, errors: ['เซสชันหมดอายุ — ออกจากระบบแล้วเข้าสู่ระบบใหม่'] };
          const res = await fetch(CFG.supabaseUrl + '/functions/v1/release-download', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, apikey: CFG.supabaseAnonKey }, body: JSON.stringify({ releaseId: id }) });
          if (!res.ok) {
            let msg = 'ดาวน์โหลดไม่สำเร็จ (สถานะ ' + res.status + ')';
            try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (_e) { /* คำตอบไม่ใช่ JSON ก็ใช้ข้อความเดิม */ }
            return { ok: false, errors: [msg] };
          }
          const blob = await readWithProgress(res, cached.sizeBytes);
          return { ok: true, blob, fileName: cached.fileName, sha256: cached.sha256 };
        }
      } catch (e) { /* ดึงตรงไม่สำเร็จ — ถอยไปทาง downloadUrl เดิมด้านล่าง ไม่ถือเป็น error */ }
      return DB.downloadUrl(id);
    },
    // แอดมิน: อัปโหลดไฟล์ติดตั้งเข้า bucket releases + คำนวณ SHA-256 (ไฟล์ใหญ่เกิน 300MB ให้ใส่ SHA-256 เอง / อัปโหลดผ่าน Dashboard)
    async attachRelease(o, file) {
      if (file.size > 1073741824) return { ok: false, errors: ['ไฟล์ใหญ่เกิน 1GB'] };
      try {
        const safe = (s) => s.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100), path = safe(o.version) + '/' + safe(file.name);
        if (file.size <= 300 * 1048576) { const buf = await file.arrayBuffer(); o.sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)), (x) => x.toString(16).padStart(2, '0')).join(''); }
        await upload('releases', path, file, { contentType: file.type || 'application/octet-stream', cacheControl: '3600' });
        o.filePath = path; o.fileName = file.name; o.sizeBytes = file.size; return { ok: true };
      } catch (e) { return fail(e); }
    },
    // ----- สมาชิก -----
    async register(f, opts) {   // opts.validateOnly = ตรวจข้อมูลอย่างเดียว ไม่สมัครจริง (ให้หน้าเว็บตรวจก่อนถามยืนยันเบอร์)
      const er = [];
      if (!f.name || f.name.trim().length < 2) er.push('กรอกชื่อ');
      if (!/^\S+@\S+\.\S+$/.test(f.email || '')) er.push('อีเมลไม่ถูกต้อง');
      const pn = C.normalizePhone(f.phone);   // [2026-11-18] กติกาเบอร์มือถือไทยกลาง (06/08/09 10 หลัก · รับ +66/เลขไทย/ขีด/วงเล็บ · ปฏิเสธเบอร์ปลอมชัดๆ)
      if (!pn.ok) er.push(pn.message);
      if (!f.password || f.password.length < 8) er.push('รหัสผ่านอย่างน้อย 8 ตัว');
      if (f.password !== f.password2) er.push('ยืนยันรหัสผ่านไม่ตรงกัน');
      if (!f.agree) er.push('ต้องยอมรับเงื่อนไขการใช้งาน');
      if (er.length) return { ok: false, errors: er };
      if (opts && opts.validateOnly) return { ok: true, validated: true };
      const { data, error } = await sb.auth.signUp({ email: f.email.trim().toLowerCase(), password: f.password, options: { data: Object.assign({ name: f.name.trim(), phone: pn.phone }, /^[A-Za-z0-9]{6,12}$/.test(f.ref || '') ? { ref: f.ref.toUpperCase() } : {}) } });
      if (error) return fail(error);
      // [2026-11-18 ผู้ใช้แจ้ง "สมัครแล้วไม่มีอีเมลยืนยัน"] อีเมลที่ยืนยันแล้วสมัครซ้ำ: Supabase ตอบสำเร็จหลอก (ไม่สร้างผู้ใช้ ไม่ส่งอีเมล · Log เป็น user_repeated_signup) และคืน user ที่ identities ว่างเปล่า
      //   เดิมหน้าเว็บขึ้น "ส่งอีเมลยืนยันแล้ว" ทั้งที่ไม่มีอีเมลไปเลย → ตอนนี้บอกตรงๆ ว่าอีเมลนี้สมัครแล้ว (ยอมรับว่าเปิดเผยว่าอีเมลนั้นเป็นสมาชิก ตามที่ผู้ใช้เลือก)
      if (data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return { ok: false, errors: ['อีเมลนี้สมัครสมาชิกไว้แล้ว — เข้าสู่ระบบได้เลย (ถ้าจำรหัสผ่านไม่ได้ กด "ลืมรหัสผ่าน")'] };
      if (!data.session) return { ok: true, needsConfirm: true };            // เปิด "Confirm email" ไว้ → ต้องกดลิงก์ในอีเมลก่อน
      await loadMine(); emit(); return { ok: true, member: S.me };
    },
    async login(email, pw) {
      const { error } = await sb.auth.signInWithPassword({ email: String(email || '').trim().toLowerCase(), password: pw || '' });
      if (error) return fail(error);
      await loadMine(); if (!S.me) return { ok: false, errors: ['บัญชีนี้ถูกระงับ — ติดต่อแอดมินทาง LINE'] };
      emit(); return { ok: true, member: S.me };
    },
    // ลืมรหัสผ่าน: ส่งลิงก์ตั้งรหัสใหม่ไปอีเมล (ไปหน้า reset.html) — ตอบข้อความเดียวกันไม่ว่าอีเมลนั้นมีบัญชีหรือไม่ (กันเดาว่าใครเป็นสมาชิก) · ติดเพดานความถี่ → บอกให้รอ
    // [2026-11-18] ส่งอีเมลยืนยันการสมัครอีกครั้ง (ลิงก์เดิมหมดอายุ/ไม่ได้รับ) — ตอบสำเร็จเหมือนกันไม่ว่าอีเมลนั้นมีบัญชีหรือไม่ · ติดเพดานความถี่ 1 ครั้ง/นาที → tr() แปลเป็นให้รอ
    async resendConfirm(email) {
      email = String(email || '').trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, errors: ['อีเมลไม่ถูกต้อง'] };
      const { error } = await sb.auth.resend({ type: 'signup', email });
      if (error) return fail(error);
      return { ok: true };
    },
    async forgotPassword(email) {
      email = String(email || '').trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, errors: ['อีเมลไม่ถูกต้อง'] };
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: new URL('reset.html', location.href).href });
      if (error && /rate limit|too many|seconds/i.test(error.message || '')) return { ok: false, errors: ['ขอบ่อยเกินไป กรุณารอ 1 นาทีแล้วลองใหม่'] };
      return { ok: true };
    },
    async logout() { await sb.auth.signOut(); unsubscribe(); await loadMine(); emit(); },
    async updateProfile(f) {
      const er = DB.validate('members', { name: f.name, phone: f.phone }); if (er.length) return { ok: false, errors: er };
      const { error } = await sb.rpc('update_profile', { p_name: f.name, p_phone: f.phone }); if (error) return fail(error);
      await loadMine(); emit(); return { ok: true };
    },
    async changeMyPassword(oldPw, nw, nw2) {
      if (!S.me) return { ok: false, errors: ['ยังไม่ได้เข้าสู่ระบบ'] };
      if (!nw || nw.length < 8) return { ok: false, errors: ['รหัสผ่านใหม่อย่างน้อย 8 ตัว'] }; if (nw !== nw2) return { ok: false, errors: ['ยืนยันรหัสผ่านใหม่ไม่ตรงกัน'] }; if (nw === oldPw) return { ok: false, errors: ['รหัสผ่านใหม่ต้องต่างจากเดิม'] };
      const chk = await sb.auth.signInWithPassword({ email: S.me.email, password: oldPw || '' }); if (chk.error) return { ok: false, errors: ['รหัสผ่านเดิมไม่ถูกต้อง'] };
      const { error } = await sb.auth.updateUser({ password: nw }); return error ? fail(error) : { ok: true };
    },
    async deleteMyAccount() { const { error } = await sb.rpc('delete_my_account'); if (error) return fail(error); await sb.auth.signOut(); await loadMine(); emit(); return { ok: true }; },
    async markNoticesRead(id) { await sb.rpc('mark_notices_read', { p_id: id || null }); S.notices.forEach((n) => { if (!id || n.id === id) n.read = true; }); emit(); },
    // ----- แอดมิน: สมาชิก -----
    async adminLogin(email, pw) {
      const r = await DB.login(email, pw); if (!r.ok) return r;
      if (!S.isAdmin) { await DB.logout(); return { ok: false, errors: ['บัญชีนี้ไม่มีสิทธิ์แอดมิน'] }; }
      return { ok: true, isDefault: false };
    },
    async setAdminPassword(pw) { if (!pw || pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return { ok: false, errors: ['รหัสอย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข'] }; const { error } = await sb.auth.updateUser({ password: pw }); return error ? fail(error) : { ok: true }; },
    async adminAddMember(f) {
      const { data, error } = await sb.functions.invoke('admin-users', { body: { action: 'create', name: f.name, email: f.email, phone: f.phone, password: f.password } });
      if (error) return { ok: false, errors: [await fnErr(error)] }; if (!data.ok) return { ok: false, errors: [data.error] };
      await loadDynamic(); emit(); return { ok: true };
    },
    async resetPassword(id, pw) { const { data, error } = await sb.functions.invoke('admin-users', { body: { action: 'reset_password', userId: id, password: pw } }); if (error) return { ok: false, errors: [await fnErr(error)] }; return data.ok ? { ok: true } : { ok: false, errors: [data.error] }; },
    async clearStrikes(id, reason) { const { error } = await sb.rpc('admin_clear_strikes', { p_member: id, p_reason: reason || '' }); if (error) return fail(error); await loadDynamic(); emit(); return { ok: true }; },   // [2026-11-18] ล้างเตือน (แอดมิน)
    async warnMember(id, title, body, opts) { opts = opts || {}; const { data, error } = await sb.rpc('admin_warn', { p_member: id, p_title: title, p_body: body, p_type: opts.type || 'warning', p_strike: !!opts.strike }); if (error) return fail(error); await loadDynamic(); emit(); return { ok: true, strikes: data.strikes, banned: data.banned }; },
    async setBan(id, banned, reason) { const { error } = await sb.rpc('admin_set_ban', { p_member: id, p_banned: banned, p_reason: reason || '' }); if (error) return fail(error); await loadDynamic(); emit(); return { ok: true }; },
    async removeMember(id) { return DB.remove('members', id); },
    // ----- ออเดอร์ / ชำระเงิน -----
    async coupon(code, subtotal) {
      const { data, error } = await sb.rpc('check_coupon', { p_code: code, p_subtotal: subtotal }); if (error) return { ok: false, msg: tr(error) };
      if (!data.ok) return { ok: false, msg: data.msg };
      return { ok: true, code: data.code, type: data.type, value: data.value, minTotal: data.minTotal, discount: C.couponCalc(data, subtotal) };
    },
    async placeOrder(cart, customer, couponCode) {
      const { data, error } = await sb.rpc('place_order', { p_items: cart.map((l) => ({ id: l.id, qty: l.qty })), p_coupon: couponCode || '' });
      if (error) return fail(error);
      await Promise.all([loadPublic(), loadDynamic()]); emit(); DB.notify('order', data.id);
      return { ok: true, order: DB.find('orders', data.id) };
    },
    async submitSlip(orderId, slip) {
      if (!slip.image) return { ok: false, errors: ['แนบรูปสลิป'] };
      if (!/^[A-Za-z0-9]{8,30}$/.test(slip.ref || '')) return { ok: false, errors: ['เลขอ้างอิงสลิป 8-30 ตัวอักษร/ตัวเลข'] };
      if (!(Number(slip.amount) > 0)) return { ok: false, errors: ['กรอกยอดที่โอน'] }; if (!slip.paidAt) return { ok: false, errors: ['ระบุวันเวลาที่โอน'] };
      try {
        const blob = dataUrlToBlob(slip.image), path = `${S.user.id}/${orderId}-${Date.now()}.jpg`;
        await upload('slips', path, blob, { contentType: 'image/jpeg', cacheControl: '3600' });
        const { data, error } = await sb.rpc('submit_slip', { p_order: orderId, p_ref: slip.ref, p_amount: Number(slip.amount), p_paid_at: new Date(slip.paidAt).toISOString(), p_path: path });
        if (error) return fail(error);
        await loadDynamic(); emit(); DB.notify('slip', orderId); return { ok: true, flags: data.flags };
      } catch (e) { return fail(e); }
    },
    async slipUrl(p) { if (!p || !p.slipPath) return ''; const { data } = await sb.storage.from('slips').createSignedUrl(p.slipPath, 300); return (data && data.signedUrl) || ''; },
    async reviewPayment(orderId, approve, note) {
      const { error } = await sb.rpc('review_payment', { p_order: orderId, p_approve: approve, p_note: note || '' }); if (error) return fail(error);
      await loadDynamic(); emit(); if (!approve) return { ok: true };
      return { ok: true, keys: await DB.issueKeys(orderId) };      // อนุมัติแล้วออกคีย์ต่อทันที (พลาดก็ไม่ย้อนสถานะ ใช้ "ออกคีย์ใหม่" ได้)
    },
    async issueKeys(orderId) {
      const { data, error } = await sb.functions.invoke('issue-keys', { body: { orderId } });
      await loadDynamic(); emit();
      if (error) return { ok: false, errors: [await fnErr(error)], total: 0, issued: 0 };
      return { ok: data.ok, errors: data.errors || (data.error ? [data.error] : []), total: data.total, issued: data.issued };
    },
    async setOrderStatus(id, status) { const { error } = await sb.rpc('set_order_status', { p_order: id, p_status: status }); if (error) return fail(error); await Promise.all([loadPublic(), loadDynamic()]); emit(); return { ok: true }; },
    notify(event, orderId) { sb.functions.invoke('notify-line', { body: { event, orderId } }).catch(() => {}); },       // ยิงแล้วลืม: ล้มเหลวไม่กระทบการสั่งซื้อ
    async testLine() { const { data, error } = await sb.functions.invoke('notify-line', { body: { test: true } }); if (error) return { ok: false, errors: [await fnErr(error)] }; return data.ok ? { ok: true } : { ok: false, errors: [data.error] }; },
    // ----- รูปโปรไฟล์ (bucket avatars สาธารณะ · ไฟล์อยู่ใต้โฟลเดอร์ <user_id>/ · ย่อเหลือ 256px ที่ฝั่งเบราว์เซอร์ก่อนอัปโหลด) -----
    avatarUrl: (path) => (path ? sb.storage.from('avatars').getPublicUrl(path).data.publicUrl : ''),
    async setAvatar(dataUrl) {
      if (!S.user || !S.me) return { ok: false, errors: ['ยังไม่ได้เข้าสู่ระบบ'] };
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl || '')) return { ok: false, errors: ['รองรับเฉพาะไฟล์ภาพ PNG / JPG / WebP'] };
      const blob = dataUrlToBlob(dataUrl); if (blob.size > 512 * 1024) return { ok: false, errors: ['รูปใหญ่เกินไป (เกิน 512KB หลังย่อ) — เลือกรูปอื่น'] };
      const old = S.me.avatarPath, path = S.user.id + '/' + Date.now() + '.jpg';
      try {
        const up = await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false }); if (up.error) return fail(up.error);
        const { error } = await sb.rpc('set_my_avatar', { p_path: path });
        if (error) { await sb.storage.from('avatars').remove([path]).catch(() => {}); return fail(error); }     // ตั้งไม่สำเร็จ → ลบไฟล์ที่เพิ่งอัปโหลด ไม่ให้ค้าง
        if (old) await sb.storage.from('avatars').remove([old]).catch(() => {});                                // ลบรูปเก่า (ไม่สำเร็จก็ไม่กระทบ)
        await loadMine(); emit(); return { ok: true };
      } catch (e) { return fail(e); }
    },
    async removeAvatar() {
      if (!S.me) return { ok: false, errors: ['ยังไม่ได้เข้าสู่ระบบ'] };
      const old = S.me.avatarPath; if (!old) return { ok: true };
      const { error } = await sb.rpc('set_my_avatar', { p_path: '' }); if (error) return fail(error);
      await sb.storage.from('avatars').remove([old]).catch(() => {}); await loadMine(); emit(); return { ok: true };
    },
    async adminClearAvatar(id) {            // แอดมิน: ลบรูปที่ไม่เหมาะสม
      const cur = DB.find('members', id), { error } = await sb.rpc('admin_clear_avatar', { p_member: id }); if (error) return fail(error);
      if (cur && cur.avatarPath) await sb.storage.from('avatars').remove([cur.avatarPath]).catch(() => {});
      await loadDynamic(); emit(); return { ok: true };
    },
    // ----- แจ้งปัญหา / เสนอแนะ (Feedback) -----
    fbMsgs: async (id) => { const { data, error } = await sb.from('feedback_messages').select('*').eq('ticket_id', id).order('created_at'); if (error) return []; return data.map((m) => ({ id: m.id, author: m.author, body: m.body, internal: !!m.internal, at: m.created_at })); },
    async fbCreate(f) { const { data, error } = await sb.rpc('fb_create_web', { p_category: f.category, p_severity: f.severity, p_title: f.title, p_body: f.body, p_module: f.module || '' }); if (error) return fail(error); await loadDynamic(); emit(); return { ok: true, code: data.code, id: data.id }; },
    async fbReply(id, body) { const { error } = await sb.rpc('fb_member_reply', { p_ticket: id, p_body: body }); if (error) return fail(error); await loadDynamic(); emit(); return { ok: true }; },
    async fbRate(id, rating, comment) { const { error } = await sb.rpc('fb_member_rate', { p_ticket: id, p_rating: rating, p_comment: comment || '' }); if (error) return fail(error); await loadDynamic(); emit(); return { ok: true }; },
    async fbSeen(id) { const t = S.tickets.find((x) => x.id === id); if (!t || !t.userUnread) return; await sb.rpc('fb_mark_seen', { p_ticket: id }); t.userUnread = false; emit(); },
    async fbAdminReply(id, body, status, internal) { const { error } = await sb.rpc('fb_admin_reply', { p_ticket: id, p_body: body, p_status: status || null, p_internal: !!internal }); if (error) return fail(error); await loadDynamic(); emit(); return { ok: true }; },
    async fbAdminSet(id, p) { const { error } = await sb.rpc('fb_admin_set', { p_ticket: id, p_status: p.status || null, p_priority: p.priority || null, p_category: p.category || null, p_dup_of: p.dupOf || null, p_clear_dup: !!p.clearDup }); if (error) return fail(error); await loadDynamic(); emit(); return { ok: true }; },
    async fbAttachUrls(t) { const out = []; for (const a of t.attachments || []) { const r = await sb.storage.from('feedback').createSignedUrl(a.path, 600); if (!r.error) out.push({ name: a.name, size: a.size, url: r.data.signedUrl }); } return out; },
    // [2026-10-28] ข้อความติดต่อ (แอดมิน): เปลี่ยนสถานะ / ลบ
    async contactSet(id, status) { if (!['new', 'read', 'done'].includes(status)) return { ok: false, errors: ['สถานะไม่ถูกต้อง'] }; const { error } = await sb.from('contact_messages').update({ status }).eq('id', id); if (error) return fail(error); const m = S.contacts.find((x) => x.id === id); if (m) m.status = status; emit(); return { ok: true }; },
    async contactDelete(id) { const { error } = await sb.from('contact_messages').delete().eq('id', id); if (error) return fail(error); S.contacts = S.contacts.filter((x) => x.id !== id); emit(); return { ok: true }; },
    async fbDelete(id) { const t = S.tickets.find((x) => x.id === id); if (t) { const ps = (t.attachments || []).map((a) => a.path).filter(Boolean); if (ps.length) { try { await sb.storage.from('feedback').remove(ps); } catch (e) { /* ลบไฟล์ไม่ได้ก็ลบรายการต่อ */ } } }
      const { error } = await sb.from('feedback_tickets').delete().eq('id', id); if (error) return fail(error); await loadDynamic(); emit(); return { ok: true }; },
    // ----- ตัวแทนขายโปรแกรม (Affiliate) -----
    affIp: () => S.affIp || [], affKyc: () => S.affKyc, affTermsStatus: () => S.affTerms,
    async affAcceptTerms() { const { error } = await sb.rpc('aff_accept_terms'); if (error) return fail(error); await loadAff(); emit(); return { ok: true }; }, affKycQueue: () => S.affKycQ || [], aff: () => S.aff,
    // [2026-11-17] เฟส 3 ข้อ 3: ส่งรูปบัตรประชาชน (bucket ส่วนตัว kyc/<uid>/…) → ฟังก์ชันบันทึกสถานะ "รอตรวจ" · รูปเก่าของตัวเองลบทิ้งแบบไม่รอผล
    async affKycSubmit(file, nameOnId) {
      if (!S.user) return fail('กรุณาเข้าสู่ระบบ');
      const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
      if (!file || !EXT[file.type]) return fail('ใช้ได้เฉพาะรูป JPG / PNG / WebP');
      if (file.size > 5 * 1024 * 1024) return fail('ไฟล์ใหญ่เกิน 5 MB');
      const path = S.user.id + '/' + Date.now() + '.' + EXT[file.type];
      const up = await sb.storage.from('kyc').upload(path, file, { upsert: false, contentType: file.type, cacheControl: '60' }); if (up.error) return fail(up.error);
      const { data, error } = await sb.rpc('aff_kyc_submit', { p_path: path, p_name: nameOnId || '' });
      if (error) { try { await sb.storage.from('kyc').remove([path]); } catch (e) { /* ลบไม่ได้ก็ปล่อย */ } return fail(error); }
      if (data && data.oldPath) { try { await sb.storage.from('kyc').remove([data.oldPath]); } catch (e) { /* ลบไม่ได้ก็ปล่อย */ } }
      await loadAff(); emit(); return { ok: true };
    },
    async kycImageUrl(path) { if (!path) return ''; const { data } = await sb.storage.from('kyc').createSignedUrl(path, 120); return (data && data.signedUrl) || ''; },
    // แอดมิน: ลบไฟล์รูปก่อน (ลบไม่ได้ = หยุด ไม่เปลี่ยนสถานะ) แล้วค่อยบันทึกผลตรวจ
    async affKycReview(memberId, approve, note, path) {
      if (path) { const rm = await sb.storage.from('kyc').remove([path]); if (rm.error) return fail(rm.error); }
      const { error } = await sb.rpc('admin_aff_kyc_review', { p_member: memberId, p_approve: !!approve, p_note: note || '' }); if (error) return fail(error);
      await loadDynamic(); emit(); return { ok: true };
    },
    async affRefresh() { await loadAff(); emit(); return S.aff; },
    // [2026-11-17] เฟส 1 กันมิจฉาชีพ: ต้องกดสมัครรับทราบเงื่อนไข + ยืนยันตัวตนผ่าน LINE ก่อนถึงได้ลิงก์แนะนำ
    async affOptIn() { const { error } = await sb.rpc('aff_opt_in'); if (error) return fail(error); await loadAff(); emit(); return { ok: true }; },
    async affSavePayout(f) { const { error } = await sb.rpc('aff_save_payout_info', { p_method: f.method, p_bank: f.bank || '', p_account: f.account || '', p_name: f.name || '' }); if (error) return fail(error); await loadMine(); emit(); return { ok: true }; },
    async affRequestPayout() { const { data, error } = await sb.rpc('aff_request_payout'); if (error) return fail(error); await Promise.all([loadAff(), loadDynamic()]); emit(); return { ok: true, amount: data.amount }; },
    async processPayout(id, action, ref, note) { const { error } = await sb.rpc('admin_process_payout', { p_payout: id, p_action: action, p_ref: ref || '', p_note: note || '' }); if (error) return fail(error); await loadDynamic(); emit(); return { ok: true }; },
    async deletePayout(id) { const { error } = await sb.rpc('admin_delete_payout', { p_payout: id }); if (error) return fail(error); await loadDynamic(); emit(); return { ok: true }; },
    async setAffBlock(id, blocked, reason) { const { error } = await sb.rpc('admin_set_aff_block', { p_member: id, p_blocked: !!blocked, p_reason: reason || '' }); if (error) return fail(error); await loadDynamic(); emit(); return { ok: true }; },
    async regenRef(id) { const { data, error } = await sb.rpc('admin_regen_ref', { p_member: id }); if (error) return fail(error); await loadDynamic(); emit(); return { ok: true, code: data }; },
    async setReferrer(id, ref) { const { error } = await sb.rpc('admin_set_referrer', { p_member: id, p_referrer: ref || null }); if (error) return fail(error); await loadDynamic(); emit(); return { ok: true }; },
    // ----- ตรวจสุขภาพข้อมูล / สำรอง -----
    health() {
      const r = [], add = (lv, msg) => r.push({ lv, msg });
      S.products.forEach((p) => {
        DB.validate('products', p).forEach((m) => add('err', p.name + ': ' + m));
        if (p.active && p.stock === 0) add('warn', p.name + ' สต็อกหมดแต่ยังเปิดขาย'); else if (p.active && p.stock <= 5) add('warn', p.name + ' สต็อกใกล้หมด (' + p.stock + ')');
        if (!p.image && !p.icon) add('warn', p.name + ' ไม่มีรูป/ไอคอน'); if (!p.desc || p.desc.length < 10) add('warn', p.name + ' คำอธิบายสั้นเกินไป');
      });
      S.categories.forEach((c) => { if (!S.products.some((p) => p.categoryId === c.id)) add('warn', 'หมวด "' + c.name + '" ไม่มีสินค้า'); });
      const pend = S.orders.filter((o) => o.status === 'review').length; if (pend) add('warn', 'มี ' + pend + ' ออเดอร์รอตรวจสลิป');
      S.orders.filter((o) => o.status === 'paid' && o.keyStatus === 'pending').forEach((o) => add('err', 'ออเดอร์ ' + o.id + ' ชำระแล้วแต่ยังออกคีย์ไม่ครบ — กด "ออกคีย์ใหม่"'));
      if (!S.settings.lineId) add('warn', 'ยังไม่ได้ตั้ง LINE ID สำหรับให้ลูกค้าติดต่อ (ตั้งค่าหน้าแรก)'); if (!S.settings.paymentQr) add('err', 'ยังไม่ได้อัปโหลด QR รับเงิน (ตั้งค่าหน้าแรก)');
      if (S.settings.promoEndsAt && S.settings.promoText && new Date(S.settings.promoEndsAt) < new Date()) add('warn', 'เวลาโปรโมชันหมดแล้ว — ตั้งวันใหม่ในแท็บตั้งค่า');
      C.blockHealth(S).forEach((x) => r.push(x));
      if (S.isAdmin) {
        const old = S.tickets.filter((t) => t.status === 'new' && Date.now() - new Date(t.createdAt) > 864e5); if (old.length) add('warn', 'มีเรื่องแจ้งปัญหา/เสนอแนะที่ยังไม่ตอบเกิน 24 ชม. ' + old.length + ' เรื่อง (แท็บ แจ้งปัญหา/เสนอแนะ)');
        const hot = S.tickets.filter((t) => ['new', 'open'].includes(t.status) && (t.priority === 'urgent' || t.severity === 'high')); if (hot.length) add('warn', 'มีเรื่องความสำคัญสูง/กระทบมากที่ยังเปิดอยู่ ' + hot.length + ' เรื่อง');
      }
      if (S.settings.affEnabled !== false) {
        const wp = S.payouts.filter((x) => x.status === 'requested'); if (wp.length) add('warn', 'มีคำขอถอนค่าคอมรอโอน ' + wp.length + ' รายการ รวม ฿' + wp.reduce((a, x) => a + x.amount, 0).toLocaleString('th-TH'));
        if (S.products.some((p) => p.active) && !S.products.some((p) => p.active && p.commission > 0)) add('warn', 'เปิดระบบตัวแทนขายแล้ว แต่ยังไม่ได้ตั้งค่าคอมให้แพ็กเกจใด (แท็บ ตัวแทนขาย → อัตราค่าคอม)');
        S.commissions.filter((c) => /ถูกยกเลิกหลัง/.test(c.note)).forEach((c) => add('err', 'ค่าคอมออเดอร์ ' + c.orderId + ' ถูกเข้าคำขอถอน/จ่ายแล้ว แต่ออเดอร์ถูกยกเลิก — ตรวจสอบ/เรียกคืน'));
      }
      if (!r.length) add('ok', 'ข้อมูลทุกส่วนผ่านการตรวจสอบ ✔'); return r;
    },
    exportJSON() { const o = { exportedAt: new Date().toISOString() }; ['settings'].forEach((k) => (o[k] = S[k])); ['categories', 'brands', 'products', 'promos', 'banners', 'blocks', 'reqs', 'modes', 'showcase', 'works', 'tutorials', 'reviews', 'faqs', 'coupons', 'members', 'orders', 'commissions', 'payouts', 'tickets'].forEach((k) => (o[k] = S[k])); return JSON.stringify(o, null, 2); },
    importJSON() { return { ok: false, errors: ['โหมด Supabase ไม่รองรับนำเข้าไฟล์ — ใช้ Supabase Dashboard (SQL/Table editor) เพื่อกู้ข้อมูล'] }; },
    reset() { return { ok: false, errors: ['โหมด Supabase ไม่รองรับรีเซ็ตจากหน้าเว็บ'] }; }
  };
  w.DB = DB;
})(window);
