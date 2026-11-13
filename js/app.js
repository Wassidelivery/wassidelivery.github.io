/* WASSI DELIVERY — application de gestion des livraisons.
   Un seul fichier, sans dépendance : fonctionne hors ligne et s'installe sur téléphone. */
'use strict';

/* ================= Outils ================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));
const F = n => fmt(n) + ' F';
const DAY = 864e5, MIN = 6e4;
const pad2 = n => String(n).padStart(2, '0');
const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const hm = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dmy = t => new Date(t).toLocaleDateString('fr-FR');
const ago = t => {
  const m = Math.round((Date.now() - t) / MIN);
  if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
};
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const digits = s => String(s || '').replace(/[^\d+]/g, '');
const initials = n => String(n).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const sum = (a, f) => a.reduce((s, x) => s + (f(x) || 0), 0);
const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
const norm = s => slug(s).replace(/\./g, ' ');
// Empreinte des mots de passe en mode démonstration (en mode connecté, le serveur Google s'en charge).
const hash = s => { let a = 0xdeadbeef, b = 0x41c6ce57; for (const ch of 'wassi:' + s) { const c = ch.codePointAt(0); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
  a = Math.imul(a ^ a >>> 16, 2246822507) ^ Math.imul(b ^ b >>> 13, 3266489909); b = Math.imul(b ^ b >>> 16, 2246822507) ^ Math.imul(a ^ a >>> 13, 3266489909);
  return 'h' + (b >>> 0).toString(36) + (a >>> 0).toString(36); };

const ICONS = {
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
  truck: '<path d="M2 6h11v10H2zM13 9h5l3 4v3h-8z"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.900 1.900 6.500 5.500M16 4.800a3.500 3.500 0 010 6.400M18 14.800c2 .700 3.200 2.400 3.600 5.200"/>',
  shop: '<path d="M3 9l1.500-5h15L21 9M4 9v11h16V9M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0M9 20v-6h6v6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.900 4.900l2.100 2.100M17 17l2.100 2.100M4.900 19.100L7 17M17 7l2.100-2.100"/>',
  bell: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 21h4"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.400 1.400M17.600 17.600L19 19M5 19l1.400-1.400M17.600 6.400L19 5"/>',
  out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>', phone: '<path d="M5 3h4l2 5-2.500 1.500a11 11 0 005.500 5.500L15.500 12.500l5 2v4a2 2 0 01-2 2A16 16 0 013 5a2 2 0 012-2z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M16.500 16.500L21 21"/>',
  alert: '<path d="M12 3l10 17H2zM12 10v4M12 17.500v.500"/>', list: '<path d="M8 6h13M8 12h13M8 18h13M3.500 6h.500M3.500 12h.500M3.500 18h.500"/>',
  doc: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6"/>', bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.500 10.900V16h7v-2.100A6 6 0 0012 3z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>', home: '<path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>', plus: '<path d="M12 5v14M5 12h14"/>'
};
const ico = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
ICONS.eye = '<path d="M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>';
const eyeBtn = '<button type="button" class="eye" data-a="eye" aria-label="Afficher ou masquer le mot de passe">' + ico('eye') + '</button>';

/* ================= Référentiels ================= */
const SLOGAN = 'Aussitôt commandé, aussitôt livré.';
const WASSI_WA = '22781161013';
const ROLES = { ceo: 'CEO', assistante: 'Responsable des opérations', closeuse: 'Closeuse', livreur: 'Livreur', marchand: 'E-commerçant' };
const CLOSE_FEE = 1000;                         // service de closing Wassi, compté dans les frais de chaque livraison
// Frais Wassi d'une livraison : livraison + expédition + closing (même règle que l'ancienne application).
const wfee = o => (o.fee || 0) + (o.feeExp || 0) + (o.closer && !o.noClose ? CLOSE_FEE : 0);
// Les frais ne comptent pour la boutique qu'une fois précisés par la responsable des opérations ou le CEO.
const feeOk = o => !!(o.feeSet || o.old);
const MONEY = () => !!U && (U.role === 'ceo' || U.role === 'assistante');
const ST = {
  nouveau: { l: 'Nouveau', c: 'new', col: 'var(--info)' },
  confirme: { l: 'Confirmé', c: 'conf', col: 'var(--gold)' },
  assigne: { l: 'En livraison', c: 'ship', col: 'var(--ship)' },
  livre_livreur: { l: 'Livré · à valider', c: 'check', col: 'var(--wait)' },
  livre: { l: 'Livré', c: 'ok', col: 'var(--ok)' },
  reporte: { l: 'Reporté', c: 'wait', col: 'var(--ink-3)' },
  injoignable: { l: 'Injoignable', c: 'wait', col: 'var(--ink-3)' },
  annule: { l: 'Annulé', c: 'bad', col: 'var(--bad)' }
};
const CLOSED = ['livre', 'annule', 'injoignable', 'reporte'];
const PROBLEMS = ['Client injoignable', 'Client absent', 'Client a refusé', 'Reporté par le client', 'Adresse introuvable'];
const ZONES = { 'Plateau': 1500, 'Sonuci': 1500, 'Bobiel': 1500, 'Koubia': 1500, 'Francophonie': 1500, 'Harobanda': 1800, 'Niamey 2000': 1800,
  'Ryad': 1500, 'Yantala': 1500, 'Aéroport': 1800, 'Tchangarey': 1500, 'Lazaret': 1500, 'Koira Kano': 1500, 'Grand Marché': 1200, 'Katako': 1200,
  'Poudrière': 1200, 'Banifandou': 1500, 'Wadata': 1200, 'Boukoki': 1200, 'Dar Es Salam': 1500, 'Rive Droite': 1800, 'Recasement': 1500,
  'EXPEDITION MARADI': 1000, 'EXPEDITION AGADEZ': 1000, 'EXPEDITION TAHOUA': 1000, 'EXPEDITION ZINDER': 1000, 'EXPEDITION DOSSO': 1000, 'EXPEDITION DIFFA': 1000 };
// ---- Pays : chaque filiale a ses propres données, ses quartiers, son indicatif et sa carte.
// Chaque quartier : [nom, latitude, longitude] (position approximative, pour la carte).
const COUNTRIES = {
  ne: { name: 'Niger', city: 'Niamey', dial: '+227', center: [13.5150, 2.1150] },
  ci: { name: "Côte d'Ivoire", city: 'Abidjan', dial: '+225', center: [5.3450, -4.0100], exp: ['Bouaké', 'Yamoussoukro', 'San-Pédro', 'Korhogo', 'Daloa', 'Man'],
    zones: [['Plateau', 5.323, -4.020], ['Cocody', 5.354, -3.985], ['Riviera', 5.355, -3.950], ['Angré', 5.395, -3.985], ['Deux Plateaux', 5.375, -3.995], ['Yopougon', 5.340, -4.085],
      ['Marcory', 5.300, -3.985], ['Zone 4', 5.290, -3.975], ['Treichville', 5.300, -4.010], ['Koumassi', 5.297, -3.950], ['Port-Bouët', 5.255, -3.940], ['Adjamé', 5.355, -4.025],
      ['Attécoubé', 5.335, -4.040], ['Abobo', 5.420, -4.020], ['Bingerville', 5.355, -3.890], ['Anyama', 5.495, -4.050], ['Songon', 5.320, -4.250]] },
  bj: { name: 'Bénin', city: 'Cotonou', dial: '+229', center: [6.3720, 2.4050], exp: ['Porto-Novo', 'Parakou', 'Abomey', 'Bohicon', 'Natitingou', 'Ouidah'],
    zones: [['Akpakpa', 6.365, 2.455], ['Cadjehoun', 6.355, 2.395], ['Fidjrossè', 6.350, 2.365], ['Gbégamey', 6.365, 2.415], ['Haie Vive', 6.358, 2.400], ['Zogbo', 6.385, 2.395],
      ['Agla', 6.375, 2.370], ['Godomey', 6.385, 2.340], ['Calavi', 6.450, 2.355], ['Ganhi', 6.352, 2.435], ['Jéricho', 6.368, 2.428], ['Saint-Michel', 6.365, 2.432],
      ['Dantokpa', 6.372, 2.435], ['Sainte-Rita', 6.378, 2.410], ['Vèdoko', 6.380, 2.400], ['Sèmè', 6.380, 2.560]] },
  ga: { name: 'Gabon', city: 'Libreville', dial: '+241', center: [0.4050, 9.4650], exp: ['Port-Gentil', 'Franceville', 'Oyem', 'Lambaréné', 'Mouila', 'Moanda'],
    zones: [['Centre-ville', 0.392, 9.452], ['Louis', 0.410, 9.445], ['Glass', 0.375, 9.455], ['Akébé', 0.385, 9.465], ['Nombakélé', 0.385, 9.450], ['Mont-Bouët', 0.395, 9.460],
      ['Batterie IV', 0.420, 9.440], ['Charbonnages', 0.430, 9.450], ['Nzeng-Ayong', 0.420, 9.495], ['PK5', 0.400, 9.490], ['PK8', 0.415, 9.520], ['PK12', 0.430, 9.550],
      ['Lalala', 0.355, 9.475], ['Oloumi', 0.370, 9.465], ['Owendo', 0.300, 9.500], ['Okala', 0.470, 9.410], ['Angondjé', 0.510, 9.400], ['Akanda', 0.530, 9.380]] }
};
const CC = COUNTRIES[localStorage.getItem('wassi.country')] ? localStorage.getItem('wassi.country') : 'ne';
const PAYS = COUNTRIES[CC];
// Ce qui est enregistré sur l'appareil est rangé par pays (le Niger garde les noms d'origine).
const LS = k => CC === 'ne' ? k : k + '.' + CC;
if (PAYS.zones) {
  Object.keys(ZONES).forEach(k => delete ZONES[k]);
  PAYS.zones.forEach(z => { ZONES[z[0]] = 1500; });
  PAYS.exp.forEach(t => { ZONES['EXPEDITION ' + t.toUpperCase()] = 1000; });
}
const AGENCES = ['STM', 'RIMBO', 'AMANA', 'SALIM TRANSPORT'];
const isExp = z => /^exp[ée]dition/i.test(z || '');
const CATALOG = {
  'NOVA SHOP': [['Boost Up', 9000], ['Cahier Magique', 10000]],
  'BELLA STORE': [['Thé 18 Saveurs', 10000], ['Thé Ginseng', 13000], ['Baume N°3', 9000]],
  'ZEN MARKET': [['Balm', 13000], ['Magnesium Complex', 14500], ['Spray Dentaire', 10500]],
  'PRIMA DEALS': [['Miracle Balm', 12000]],
  'LUNA HOME': [['Couvre Matelas', 16500], ['Couvre Matelas 3 places fleuri', 15000]],
  'VITA PLUS': [['Stylo', 10000]],
  'ELAN SHOP': [['Gel Exfoliant', 10000]],
  'SOLEA MARKET': [['Lunette Solaire', 13000]],
  'ORIA BOUTIQUE': [['Rouleau de massage', 13000]],
  'KAZI EN LIGNE': [['Gel Exfoliant', 12900]]
};

/* ================= Données de démonstration ================= */
function seed() {
  let s = 20261112;
  const r = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(r() * a.length)];
  const now = Date.now(), sod = startOfDay();
  const users = [
    { id: 'u_ceo', name: 'Idrissa', role: 'ceo' }, { id: 'u_as1', name: 'Mariam', role: 'assistante' },
    { id: 'u_c1', name: 'Aminata', role: 'closeuse' }, { id: 'u_c2', name: 'Rokia', role: 'closeuse' }, { id: 'u_c3', name: 'Salima', role: 'closeuse' },
    { id: 'u_l1', name: 'Moussa', role: 'livreur' }, { id: 'u_l2', name: 'Ibrahim', role: 'livreur' }, { id: 'u_l3', name: 'Oumar', role: 'livreur' },
    { id: 'u_l4', name: 'Boubé', role: 'livreur' }
  ].map(u => ({ ...u, email: slug(u.name) + '@wassi.demo', salary: u.role === 'ceo' ? 0 : u.name === 'Moussa' ? 75000 : u.role === 'assistante' ? 40000 : 50000,
    ...(u.role === 'ceo' ? { ph: hash('wassi-demo-2026') } : { pass: String(100000 + Math.floor(r() * 899999)) }) }));
  const shops = Object.keys(CATALOG).map((name, i) => ({
    id: 's' + i, name, sheetId: '', plan: i === 1 ? 'actif' : 'essai',
    trialEnd: sod + (i === 7 ? -3 : 30 - i * 2) * DAY
  }));
  shops.forEach(sh => users.push({ id: 'u_m' + sh.id, name: sh.name, role: 'marchand', shop: sh.name, email: slug(sh.name) + '@boutique.demo', ph: hash('demo-' + sh.id) }));
  const closers = users.filter(u => u.role === 'closeuse'), drivers = users.filter(u => u.role === 'livreur');
  const firstM = ['Mamadou', 'Ibrahim', 'Moussa', 'Abdou', 'Issoufou', 'Oumarou', 'Souleymane', 'Boubacar', 'Harouna', 'Idrissa'];
  const firstF = ['Aïcha', 'Mariama', 'Fatouma', 'Hadiza', 'Rakia', 'Zeinabou', 'Salamatou', 'Halima', 'Nafissa', 'Balkissa'];
  const last = ['Issa', 'Maïga', 'Hamidou', 'Garba', 'Adamou', 'Seyni', 'Djibo', 'Tahirou', 'Amadou', 'Saley', 'Moumouni', 'Moussaaye'];
  const zones = Object.keys(ZONES), shopNames = Object.keys(CATALOG);
  const weights = [5, 9, 9, 6, 4, 3, 3, 2, 2, 2];
  const pickShop = () => { let x = r() * sum(weights, w => w); for (let i = 0; i < weights.length; i++) { if ((x -= weights[i]) < 0) return shopNames[i]; } return shopNames[0]; };
  const orders = [], notifs = [];
  let n = 1000;
  const make = (createdAt, status) => {
    const shop = pickShop(), [product, price] = pick(CATALOG[shop]);
    const fem = r() < (/balm|baume|thé|gel|couvre/i.test(product) ? .68 : .38);
    const zone = r() < .18 ? pick(zones.slice(-6)) : pick(zones.slice(0, -6));
    const closer = pick(closers), driver = pick(drivers);
    const o = {
      id: 'o' + (++n), ref: 'W' + n, shop, client: (fem ? pick(firstF) : pick(firstM)) + ' ' + pick(last),
      phone: PAYS.dial + ' 9' + Math.floor(r() * 10) + ' ' + pad2(Math.floor(r() * 100)) + ' ' + pad2(Math.floor(r() * 100)) + ' ' + pad2(Math.floor(r() * 100)),
      sexe: fem ? 'F' : 'H', product, qty: r() < .12 ? 2 : 1, price, zone, fee: ZONES[zone],
      feeExp: isExp(zone) ? 1000 : 0, agence: isExp(zone) ? pick(AGENCES) : '', note: '', status,
      driver: null, closer: null, createdAt, transferred: false, sheetRow: n - 998,
      history: [{ at: createdAt, by: 'Google Sheet', text: 'Commande reçue' }]
    };
    if (o.qty === 2) o.price = price * 2 - 1000;
    if (status !== 'nouveau') {
      o.closer = closer.id; o.confirmedAt = createdAt + (4 + r() * 30) * MIN;
      o.history.push({ at: o.confirmedAt, by: closer.name, text: CLOSED.includes(status) && status !== 'livre' ? ST[status].l : 'Confirmée' });
    }
    if (['assigne', 'livre_livreur', 'livre'].includes(status)) {
      o.driver = driver.id; o.assignedAt = o.confirmedAt + (1 + r() * 10) * MIN;
      o.history.push({ at: o.assignedAt, by: closer.name, text: 'Envoyée à ' + driver.name });
    }
    if (['livre_livreur', 'livre'].includes(status)) {
      o.deliveredAt = Math.min(now - MIN, o.assignedAt + (35 + r() * 200) * MIN);
      o.history.push({ at: o.deliveredAt, by: driver.name, text: 'Marquée livrée par le livreur' });
    }
    if (status === 'livre') { o.validatedAt = o.deliveredAt + 5 * MIN; o.history.push({ at: o.validatedAt, by: closer.name, text: 'Livraison validée' }); }
    if (['injoignable', 'reporte', 'annule'].includes(status)) o.reason = status === 'annule' ? 'Client a refusé' : status === 'reporte' ? 'Reporté par le client' : 'Client injoignable';
    orders.push(o); return o;
  };
  for (let d = 13; d >= 1; d--) {
    const base = sod - d * DAY, count = 9 + Math.floor(r() * 9);
    for (let i = 0; i < count; i++) {
      const x = r(), st = x < .7 ? 'livre' : x < .82 ? 'annule' : x < .92 ? 'injoignable' : 'reporte';
      const o = make(base + (8 + r() * 10) * 3600e3, st);
      // Le succès dépend aussi de la zone et du produit, pour des analyses parlantes.
      if (st === 'livre' && isExp(o.zone) && r() < .3) { o.status = 'annule'; o.reason = 'Client a refusé'; delete o.deliveredAt; delete o.validatedAt; o.driver = null; o.history.length = 2; o.history[1].text = 'Annulé'; }
      if (o.status === 'livre') { o.transferred = d > 1; o.cashIn = base + 19 * 3600e3; }
    }
  }
  const span = Math.max(now - sod, 30 * MIN);
  ['nouveau', 'nouveau', 'nouveau', 'nouveau', 'confirme', 'confirme', 'assigne', 'assigne', 'assigne', 'assigne', 'assigne',
    'livre_livreur', 'livre_livreur', 'livre', 'livre', 'livre', 'livre', 'livre', 'injoignable', 'annule'].forEach((st, i) => {
    const c = st === 'nouveau' ? now - (2 + i * 6) * MIN : Math.max(sod + MIN, now - (40 + r() * 0.9 * (span / MIN)) * MIN);
    make(c, st);
  });
  // Scénario des notes vocales : M. Mamadou, Boost Up 9 000 F, Harobanda.
  const ex = orders.find(o => o.status === 'nouveau');
  Object.assign(ex, { shop: 'NOVA SHOP', client: 'Mamadou Issa', sexe: 'H', product: 'Boost Up', qty: 1, price: 9000, zone: 'Harobanda', fee: 1800, feeExp: 0, agence: '' });
  // Stock au bureau, passages des livreurs, dépenses et reversements d'exemple.
  const stock = [], takes = [], moves = [];
  orders.forEach(o => { if (['livre', 'livre_livreur'].includes(o.status)) o.stk = 'x'; });
  shops.forEach(sh => CATALOG[sh.name].forEach(([p], j) => stock.push({ id: 'k' + sh.id + j, shop: sh.name, product: p, qty: 6 + Math.floor(r() * 60) })));
  drivers.forEach((d, i) => { const sh = shops[i % 4], p = CATALOG[sh.name][0][0];
    takes.push({ id: 't' + i, at: Math.min(now - MIN, sod + 8 * 3600e3 + i * 9 * MIN), driver: d.id, shop: sh.name, product: p, qty: 4 + i, kind: 'take', by: 'Mariam' }); });
  for (let d = 13; d >= 0; d--) moves.push({ id: 'm' + d, at: Math.min(now - MIN, sod - d * DAY + 10 * 3600e3), type: 'dep', cat: d % 3 ? 'Essence' : 'Crédit / Appel',
    amt: d % 3 ? 3000 : 1000, note: d % 3 ? 'Moto ' + drivers[d % 4].name : 'Recharge téléphone', by: 'Mariam' });
  shops.forEach(sh => { const l = orders.filter(o => o.shop === sh.name && o.status === 'livre' && o.deliveredAt < sod - 3 * DAY), amt = sum(l, o => o.price - wfee(o));
    if (amt > 0) moves.push({ id: 'p' + sh.id, at: sod - 3 * DAY + 17 * 3600e3, type: 'pay', shop: sh.name, amt: -amt, note: 'Reversement', by: 'Mariam' }); });
  return { v: 1, users, shops, orders, notifs, stock, takes, moves, pos: {}, goals: [], charges: [], cfg: {}, createdAt: now };
}

/* ================= État & synchronisation ================= */
const Remote = {
  // Adresse du serveur : celle enregistrée sur cet appareil, sinon celle fournie avec l'app (js/config.js).
  get api() { const v = localStorage.getItem('wassi.api'); return v === 'off' ? '' : v || window.WASSI_API || ''; },
  get on() { return !!this.api; },
  q: [], busy: false, online: true, pushes: 0,
  init() { try { this.q = JSON.parse(localStorage.getItem(LS('wassi.q')) || '[]'); } catch (e) { this.q = []; } },
  saveQ() { localStorage.setItem(LS('wassi.q'), JSON.stringify(this.q)); },
  async call(body, tok) {
    const res = await fetch(this.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, c: CC, token: tok || localStorage.getItem(LS('wassi.token')) || '' }) });
    return res.json();
  },
  // Chaque modification garde le jeton de la personne qui l'a faite : elle part avec ses droits, même si quelqu'un d'autre se connecte ensuite.
  push(op) { if (!this.on) return; this.pushes++; this.q.push({ ...op, _k: localStorage.getItem(LS('wassi.token')) || '' }); this.saveQ(); this.flush(); },
  async flush() {
    if (this.busy || !this.q.length) return; this.busy = true;
    try {
      while (this.q.length) {
        const k = this.q[0]._k, n = this.q.findIndex(o => o._k !== k), ops = this.q.slice(0, n < 0 ? this.q.length : n);
        const r = await this.call({ a: 'ops', ops }, k);
        // Une modification refusée (jeton expiré, membre retiré) est abandonnée pour ne pas bloquer les suivantes.
        if (r.ok || r.error === 'auth') { this.q.splice(0, ops.length); this.saveQ(); this.online = true; } else break;
      }
    } catch (e) { this.online = false; }
    this.busy = false;
  },
  async pull() {
    if (!this.on || !U) return;
    await this.flush(); if (this.q.length) return render();
    try {
      const mark = this.pushes, r = await this.call({ a: 'state', since: +localStorage.getItem(LS('wassi.since')) || 0 });
      // Une modification faite pendant la lecture est plus récente que la réponse : on relira au prochain passage.
      if (this.pushes !== mark || this.q.length) return;
      this.online = true;
      if (r.ok) { mergeState(r.state); localStorage.setItem(LS('wassi.since'), r.now || 0); persist(); onExternal(); }
      else if (r.error === 'auth') logout();
    } catch (e) { this.online = false; render(); }
  }
};
Remote.init();
const KEY = () => LS(Remote.on ? 'wassi.remote' : 'wassi.demo3');
let S = load();
function load() {
  try { const raw = localStorage.getItem(KEY()); if (raw) { const d = JSON.parse(raw); if (d && d.v === 1) return upgrade(d); } } catch (e) {}
  const d = upgrade(Remote.on ? { v: 1, users: [], shops: [], orders: [], notifs: [] } : seed());
  try { localStorage.setItem(KEY(), JSON.stringify(d)); } catch (e) {}
  return d;
}
// Complète une base enregistrée par une version précédente de l'app.
function upgrade(d) {
  ['stock', 'takes', 'moves', 'goals', 'charges', 'notifs', 'users', 'shops', 'orders', 'dispatch'].forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
  d.seen = d.seen || {};
  d.pos = d.pos || {}; d.cfg = d.cfg || {};
  return d;
}
let REV = 0;                                    // augmente à chaque enregistrement : sert au bouton « Annuler »
function persist() { REV++; try { localStorage.setItem(KEY(), JSON.stringify(S)); } catch (e) { toast('Stockage plein', 'Exportez puis réinitialisez les données.'); } }

let U = null;                                   // utilisateur connecté
const V = { tab: null, modal: null, shop: '', range: 'today', q: '', sel: new Set(), period: 30, pin: '', pick: null, stf: '' };
const seen = new Set();                         // notifications déjà affichées sur cet appareil
const markSeen = () => S.notifs.forEach(n => seen.add(n.id));

const user = id => S.users.find(u => u.id === id);
const uname = id => (user(id) || {}).name || '—';
const order = id => S.orders.find(o => o.id === id);
// Répartition du jour : à quelle closeuse la boutique est confiée (aucune = visible par toutes).
const assignedTo = shop => { const d = S.dispatch.find(x => x.shop === shop), u = d && user(d.closer); return u && !u.gone ? u.id : null; };
const shopMine = o => { const c = assignedTo(o.shop); return !c || c === U.id; };
const byRole = r => S.users.filter(u => u.role === r && !u.gone && u.status !== 'pending');
const shopOf = name => S.shops.find(s => s.name === name);

function notify(n) {
  const x = { id: uid('n'), at: Date.now(), by: U ? U.id : 'sheet', ...n };
  S.notifs.push(x); if (S.notifs.length > 300) S.notifs.splice(0, S.notifs.length - 300);
  Remote.push({ t: 'notif', n: x });
}
function commit(o, text) {
  if (o) { if (text) o.history.push({ at: Date.now(), by: U ? U.name : 'Système', text }); o.updatedAt = Date.now(); Remote.push({ t: 'order', o }); }
  persist(); render();
}

/* ---- Règles métier ---- */
const Biz = {
  confirm(o) {
    if (o.status === 'confirme') return;
    o.status = 'confirme'; o.closer = o.closer || U.id; o.confirmedAt = Date.now(); o.reason = '';
    commit(o, 'Confirmée');
  },
  assign(o, driverId) {
    if (o.driver === driverId && o.status === 'assigne') return;
    const old = o.driver, d = user(driverId);
    if (old && old !== driverId) notify({ toUser: old, title: 'Livraison retirée', text: `${o.client} · ${o.product} a été confiée à un autre livreur.`, orderId: o.id });
    release(o); o.driver = driverId; o.status = 'assigne'; o.closer = o.closer || U.id; o.assignedAt = Date.now();
    o.confirmedAt = o.confirmedAt || Date.now(); delete o.deliveredAt; o.reason = '';
    notify({ toUser: driverId, title: 'Nouvelle livraison', text: `${o.client} · ${o.product} · ${o.zone} · ${F(o.price)}`, orderId: o.id });
    commit(o, (old && old !== driverId ? `Réassignée de ${uname(old)} à ` : 'Envoyée à ') + d.name);
  },
  driverDelivered(o) {
    o.status = 'livre_livreur'; o.deliveredAt = Date.now(); consume(o);
    notify({ ...(o.closer ? { toUser: o.closer } : { toRole: 'closeuse' }), title: 'Commande livrée', text: `${U.name} a livré ${o.client} (${o.shop} · ${o.product}). À valider.`, orderId: o.id });
    commit(o, 'Marquée livrée par le livreur');
  },
  driverProblem(o, reason) {
    o.reason = reason; o.status = 'confirme'; const d = o.driver; o.driver = null;
    notify({ ...(o.closer ? { toUser: o.closer } : { toRole: 'closeuse' }), title: 'Problème de livraison', text: `${uname(d)} : ${reason} — ${o.client} (${o.product}).`, orderId: o.id });
    commit(o, 'Problème signalé : ' + reason);
  },
  undeliver(o) {                                // le livreur corrige un « livré » marqué par erreur
    release(o); o.status = 'assigne'; delete o.deliveredAt;
    notify({ ...(o.closer ? { toUser: o.closer } : { toRole: 'closeuse' }), title: 'Correction du livreur', text: `${U.name} : ${o.client} (${o.product}) n'est pas encore livré.`, orderId: o.id });
    commit(o, 'Correction : pas encore livrée');
  },
  validate(o) {
    o.status = 'livre'; o.validatedAt = Date.now(); consume(o); o.deliveredAt = o.deliveredAt || Date.now(); o.closer = o.closer || U.id;
    notify({ toRole: 'assistante', title: 'Livraison validée', text: `${o.shop} · ${o.product} · ${F(o.price)} — ajoutée au résumé du jour.`, orderId: o.id });
    notify({ toRole: 'marchand', shop: o.shop, title: 'Commande livrée', text: `${o.client} a reçu ${o.product} (${F(o.price)}).`, orderId: o.id });
    commit(o, 'Livraison validée');
  },
  setStatus(o, st, reason) {
    if (st === 'confirme') return this.confirm(o);
    if (st === 'livre') return this.validate(o);
    const old = o.driver;
    if (old) notify({ toUser: old, title: 'Livraison retirée', text: `${o.client} · ${o.product} : ${ST[st].l}.`, orderId: o.id });
    release(o); o.status = st; o.driver = null; o.closer = o.closer || U.id; o.reason = reason || '';
    commit(o, ST[st].l + (reason ? ' — ' + reason : ''));
  },
  incoming(data, manual) {                      // commande arrivée d'un Google Sheet, ou saisie à la main
    const n = 1 + Math.max(1000, ...S.orders.map(o => +String(o.ref).slice(1) || 0));
    const o = { id: uid('o'), ref: 'W' + n, qty: 1, note: '', status: 'nouveau', driver: null, closer: null, createdAt: Date.now(),
      transferred: false, feeExp: 0, agence: '', history: [{ at: Date.now(), by: manual ? U.name : 'Google Sheet', text: manual ? 'Commande saisie à la main' : 'Commande reçue' }], ...data };
    o.fee = o.fee ?? ZONES[o.zone] ?? 1500; if (isExp(o.zone)) o.feeExp = 1000;
    S.orders.push(o);
    const nt = { id: uid('n'), at: Date.now(), by: manual ? U.id : 'sheet', toRole: 'closeuse', title: 'Nouvelle commande pour ' + o.shop, text: `${o.client} · ${o.product} · ${o.zone}`, orderId: o.id };
    S.notifs.push(nt);
    if (manual) { Remote.push({ t: 'order', o }); Remote.push({ t: 'notif', n: nt }); }
    persist(); manual ? render() : onExternal();
  }
};
function simulate() {
  const shop = Object.keys(CATALOG)[Math.floor(Math.random() * 6)], [product, price] = CATALOG[shop][Math.floor(Math.random() * CATALOG[shop].length)];
  const z = Object.keys(ZONES)[Math.floor(Math.random() * 22)];
  const names = ['Aïcha Maïga', 'Moussa Garba', 'Hadiza Seyni', 'Ibrahim Djibo', 'Mariama Saley', 'Oumarou Adamou'], i = Math.floor(Math.random() * names.length);
  Biz.incoming({ shop, product, price, zone: z, client: names[i], sexe: i % 2 ? 'H' : 'F',
    phone: PAYS.dial + ' 9' + Math.floor(Math.random() * 10) + ' ' + pad2(Math.floor(Math.random() * 100)) + ' ' + pad2(Math.floor(Math.random() * 100)) + ' ' + pad2(Math.floor(Math.random() * 100)) });
}

/* ---- Indicateurs ---- */
const isLate = o => (o.status === 'nouveau' && Date.now() - o.createdAt > 15 * MIN) || (o.status === 'assigne' && Date.now() - o.assignedAt > 180 * MIN);
const lateText = o => o.status === 'nouveau' ? 'Non traitée depuis ' + Math.round((Date.now() - o.createdAt) / MIN) + ' min' : 'Chez le livreur depuis ' + Math.round((Date.now() - o.assignedAt) / 36e5) + ' h';
const isDup = o => o.status !== 'annule' && digits(o.phone).length > 5 && S.orders.some(x => x !== o && x.status !== 'annule' && digits(x.phone) === digits(o.phone) && x.product === o.product && Math.abs(x.createdAt - o.createdAt) < 3 * DAY);
function stats(list) {
  const liv = list.filter(o => o.status === 'livre'), closed = list.filter(o => CLOSED.includes(o.status));
  return { n: list.length, liv: liv.length, closed: closed.length, rate: pct(liv.length, closed.length),
    cash: sum(liv, o => o.price), fees: sum(liv, wfee), list, livList: liv };
}
function group(list, key) {
  const m = new Map();
  list.forEach(o => { const k = key(o); if (k == null || k === '') return; if (!m.has(k)) m.set(k, []); m.get(k).push(o); });
  return [...m].map(([k, l]) => ({ k, ...stats(l) }));
}
const inRange = (t, range) => {
  const sod = startOfDay();
  if (range === 'today') return t >= sod; if (range === 'yesterday') return t >= sod - DAY && t < sod;
  if (range === '7') return t >= sod - 6 * DAY; if (range === '30') return t >= sod - 29 * DAY; if (range === 'exo') return t >= exoStart(); return true;
};
// Une commande livrée compte le jour de sa livraison, les autres le jour de leur arrivée.
const actT = o => o.status === 'livre' ? (o.deliveredAt || o.createdAt) : o.createdAt;
const isDue = o => +(o.status === 'reporte' && !!o.retryAt && o.retryAt <= Date.now());
const DONE = ['livre', 'livre_livreur'];
const cashDue = id => S.orders.filter(o => o.driver === id && DONE.includes(o.status) && !o.cashIn);
const net = l => sum(l, o => o.price - wfee(o));
const teamDone = () => S.orders.filter(o => DONE.includes(o.status) && o.deliveredAt >= startOfDay()).length;
const GOAL = () => Math.max(1, +(localStorage.getItem(LS('wassi.goal')) || 40));
const bounds = r => { const d = startOfDay(); return r === 'today' ? [d, d + DAY] : r === 'yesterday' ? [d - DAY, d] : r === '7' ? [d - 6 * DAY, d + DAY] : r === '30' ? [d - 29 * DAY, d + DAY] : r === 'exo' ? [exoStart(), d + DAY] : null; };
const prevStats = r => { const b = bounds(r); if (!b) return null; const len = b[1] - b[0]; return stats(S.orders.filter(o => actT(o) >= b[0] - len && actT(o) < b[0])); };
const delta = (a, b) => b ? `${a >= b ? '▲' : '▼'} ${Math.abs(pct(a - b, b))} % vs période précédente` : '';
const MSG = {
  confirm: o => `Bonjour ${o.client}, c'est Wassi Delivery pour ${o.shop}. Nous confirmons votre commande : ${o.product}${o.qty > 1 ? ' × ' + o.qty : ''} à ${F(o.price)}, livraison à ${o.zone}. Merci !`,
  route: o => `Bonjour ${o.client}, votre livreur Wassi Delivery${o.driver ? ' (' + uname(o.driver) + ')' : ''} est en route avec votre ${o.product}. Merci de préparer ${F(o.price)}.`,
  miss: o => `Bonjour ${o.client}, nous avons essayé de vous joindre pour votre commande ${o.product} (${o.shop}). Quand pouvons-nous vous livrer ?`
};
const waLink = (o, k) => `https://wa.me/${digits(o.phone).replace('+', '')}?text=${encodeURIComponent(MSG[k](o))}`;
const RANGES = { today: "Aujourd'hui", yesterday: 'Hier', 7: '7 jours', 30: '30 jours', exo: 'Exercice', all: 'Tout' };
const RANGE_ORDER = ['today', 'yesterday', '7', '30', 'exo', 'all'];

/* ================= Notifications ================= */
const forMe = n => U && n.by !== U.id && (n.toUser === U.id || (n.toRole === U.role && (!n.shop || n.shop === U.shop)));
const readAt = () => +(localStorage.getItem(LS('wassi.read.') + (U ? U.id : '')) || 0);
const unread = () => S.notifs.filter(n => forMe(n) && n.at > readAt()).length;
function beep() {
  try {
    const C = window.AudioContext || window.webkitAudioContext, c = beep.c || (beep.c = new C()), t = c.currentTime;
    [880, 1175].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; o.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(.0001, t + i * .13); g.gain.exponentialRampToValueAtTime(.2, t + i * .13 + .02); g.gain.exponentialRampToValueAtTime(.0001, t + i * .13 + .22);
      o.start(t + i * .13); o.stop(t + i * .13 + .25); });
  } catch (e) {}
}
function toast(title, text, orderId) {
  const el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = `${ico('bell')}<div><b>${esc(title)}</b>${esc(text || '')}</div>`;
  el.onclick = () => { el.remove(); if (orderId && order(orderId)) { V.modal = { t: 'order', id: orderId }; renderModal(); } };
  $('#toasts').append(el); setTimeout(() => el.remove(), 6000);
}
function onExternal() {                         // des données ont changé ailleurs (autre appareil, Sheet…)
  const fresh = S.notifs.filter(n => forMe(n) && !seen.has(n.id));
  markSeen();
  fresh.slice(-3).forEach(n => {
    toast(n.title, n.text, n.orderId);
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
      navigator.serviceWorker.ready.then(reg => reg.showNotification(n.title, { body: n.text, icon: 'icons/icon-192.png', badge: 'icons/icon-96.png', tag: n.id })).catch(() => {});
    }
  });
  if (fresh.length) { beep(); if (navigator.vibrate) navigator.vibrate(120); }
  render();
}
window.addEventListener('storage', e => { if (e.key === KEY() && e.newValue) { try { S = upgrade(JSON.parse(e.newValue)); onExternal(); } catch (err) {} } });

/* ================= Écran de connexion ================= */
const SLIDES = [
  ['inbox', 'Toutes vos commandes au même endroit', 'Chaque commande des Google Sheets de vos boutiques arrive ici, prête à être traitée.'],
  ['users', 'À chacun son espace', 'Closeuses, livreurs, assistante, CEO et e-commerçants : chacun voit exactement ce dont il a besoin.'],
  ['bell', 'La bonne personne, au bon moment', 'Nouvelle commande, livraison envoyée, colis livré : chacun est prévenu sans un seul appel.'],
  ['chart', 'Des chiffres qui font grandir', 'Taux de livraison, meilleurs produits, zones, caisse et rapports se calculent tout seuls.']
];
function renderWelcome() {
  const i = V.slide || 0, [ic, t, s] = SLIDES[i], last = i === SLIDES.length - 1;
  $('#app').innerHTML = `<div class="welcome"><div class="w-top"><img src="icons/icon-96.png" alt="" width="40" height="40"><b>WASSI DELIVERY</b><button class="skip" data-a="w-skip">Passer</button></div>
    <div class="w-body"><div class="w-art">${ico(ic)}</div><h1>${t}</h1><p>${s}</p></div>
    <div class="w-foot"><div class="w-dots" role="img" aria-label="Étape ${i + 1} sur ${SLIDES.length}">${SLIDES.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
    <div class="actions fill" style="width:100%">${i ? '<button class="btn line" data-a="w-prev">Retour</button>' : ''}<button class="btn primary" data-a="w-next">${last ? 'Commencer' : 'Suivant'}</button></div></div></div>`;
}
/* ================= Coquille ================= */
const TABS = {
  closeuse: [['todo', 'À traiter', 'inbox'], ['run', 'En cours', 'truck'], ['check', 'À valider', 'check'], ['done', 'Terminé', 'list'], ['map', 'Carte', 'pin']],
  livreur: [['mine', 'À livrer', 'truck'], ['stock', 'Mon stock', 'box'], ['done', 'Livrées', 'check']],
  assistante: [['resume', 'Résumé', 'home'], ['dispatch', 'Répartition', 'users'], ['reports', 'Rapports', 'doc'], ['shops', 'Boutiques', 'shop'], ['drivers', 'Livreurs', 'truck'], ['map', 'Carte', 'pin']],
  ceo: [['dash', 'Tableau', 'home'], ['perf', 'Performance', 'chart'], ['money', 'Caisse', 'cash'], ['shops', 'Boutiques', 'shop'], ['drivers', 'Livreurs', 'truck'],
    ['dispatch', 'Répartition', 'users'], ['accounts', 'Comptes', 'lock'], ['orders', 'Commandes', 'list'], ['reports', 'Rapports', 'doc'], ['map', 'Carte', 'pin'], ['settings', 'Réglages', 'gear']],
  marchand: [['over', 'Suivi', 'truck'], ['compte', 'Compte', 'cash'], ['stats', 'Statistiques', 'chart'], ['stock', 'Stock', 'box'], ['orders', 'Commandes', 'list']]
};
function tabCount(id) {
  const mine = o => !o.closer || o.closer === U.id || U.role !== 'closeuse';
  if (U.role === 'closeuse') {
    if (id === 'todo') return S.orders.filter(o => (o.status === 'nouveau' && shopMine(o)) || (isDue(o) && mine(o))).length;
    if (id === 'run') return S.orders.filter(o => ['confirme', 'assigne'].includes(o.status) && mine(o)).length;
    if (id === 'check') return S.orders.filter(o => o.status === 'livre_livreur' && shopMine(o)).length;
  }
  if (U.role === 'livreur' && id === 'mine') return S.orders.filter(o => o.status === 'assigne' && o.driver === U.id).length;
  if (U.role === 'ceo' && id === 'settings') return S.users.filter(u => u.status === 'pending').length;
  if (MONEY() && (id === 'resume' || id === 'money')) return S.orders.filter(o => o.status === 'livre' && !feeOk(o)).length;
  return 0;
}
function render() {
  if (!localStorage.getItem('wassi.welcomed') && (!U || V.replay)) return renderWelcome();
  V.replay = false;
  if (!localStorage.getItem('wassi.country')) return renderCountry();
  if (U && !U.preview) { const me = user(U.id); if (!me || me.status === 'pending' || me.gone) kick('Votre accès a été retiré. Contactez le CEO de Wassi Delivery.'); else U = me; }
  if (!U) return renderAuth();
  const tabs = TABS[U.role]; if (!tabs.some(t => t[0] === V.tab)) V.tab = tabs[0][0];
  const act = document.activeElement, fid = act && act.id, pos = fid && act.selectionStart;
  const nb = unread(), many = tabs.length > 5, extraOn = many && tabs.findIndex(t => t[0] === V.tab) > 3;
  $('#app').innerHTML = `<div class="shell">
    <header class="top"><button class="icon-btn back" data-a="back" aria-label="Retour à l'écran précédent">${ico('back')}</button>
      <img src="icons/icon-96.png" alt="" width="38" height="38">
      <div class="who"><b>WASSI DELIVERY</b><span>${flag(CC)}${esc(U.name)} · ${ROLES[U.role]} · ${esc(PAYS.name)}</span></div>
      ${Undo.stack.length ? `<button class="btn sm undo" data-a="undo" aria-label="Annuler la dernière action">${ico('undo')}<span>Annuler</span></button>` : ''}
      <button class="icon-btn" data-a="bell" aria-label="Notifications">${ico('bell')}${nb ? `<span class="dot">${nb}</span>` : ''}</button>
      <button class="icon-btn" data-a="theme" aria-label="Changer le thème clair ou sombre">${ico('sun')}</button>
      <button class="icon-btn" data-a="logout" aria-label="Se déconnecter">${ico('out')}</button></header>
    <nav class="nav ${many ? 'many' : ''}" aria-label="Sections">${tabs.map(([id, l, ic], i) => { const c = tabCount(id);
      return `<button class="${V.tab === id ? 'on' : ''} ${many && i > 3 ? 'extra' : ''}" data-a="tab" data-id="${id}">${ico(ic)}<span>${l}</span>${c ? `<span class="count">${c}</span>` : ''}</button>`; }).join('')}
      ${many ? `<button class="more ${extraOn ? 'on' : ''}" data-a="more">${ico('list')}<span>Plus</span></button>` : ''}</nav>
    <main>${banner()}${VIEWS[U.role]()}</main></div>`;
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} } }
  if (V.modal) renderModal();
  if (window.afterRender) afterRender();
}
function banner() {
  if (Remote.on) return Remote.online && !Remote.q.length ? '' :
    `<div class="demo-bar offline"><span>${ico('alert')} Hors connexion — ${Remote.q.length} modification(s) en attente d'envoi.</span></div>`;
  if (S.importedAt) return U.role === 'ceo' ? `<div class="demo-bar"><span><b>Données enregistrées sur cet appareil seulement.</b> Reliez le serveur Google (Réglages) pour que toute l'équipe travaille dessus depuis son téléphone.</span></div>` : '';
  return `<div class="demo-bar"><span><b>Mode démonstration.</b> Les données sont des exemples enregistrés sur cet appareil.</span>
    ${['marchand', 'livreur'].includes(U.role) ? '' : `<button class="btn sm primary" data-a="simulate">${ico('plus')} Simuler une commande</button>`}</div>`;
}

/* ================= Composants ================= */
const badge = o => `<span class="badge st-${ST[o.status].c}">${ST[o.status].l}</span>`;
function card(o, acts = '') {
  const late = isLate(o);
  return `<article class="card order ${late ? 'late' : ''}" data-a="open" data-id="${esc(o.id)}">
    <div class="l1"><span class="tag">${esc(o.shop)}</span>${badge(o)}<time>${ago(o.createdAt)}</time></div>
    <h4>${esc(o.client)}</h4>
    <div class="meta">${esc(o.product)}${o.qty > 1 ? ' × ' + o.qty : ''} · ${esc(o.zone)}</div>
    ${late ? `<div class="warn">${ico('clock')}${lateText(o)}</div>` : ''}
    ${o.status === 'reporte' && o.retryAt ? `<div class="warn" ${isDue(o) ? '' : 'style="color:var(--ink-2)"'}>${ico('clock')}${isDue(o) ? 'À rappeler maintenant' : 'Rappel prévu le ' + dmy(o.retryAt).slice(0, 5) + ' à ' + hm(o.retryAt)}</div>` : ''}
    ${o.reason && !CLOSED.includes(o.status) ? `<div class="warn">${ico('alert')}${esc(o.reason)}</div>` : ''}
    ${isDup(o) && ['nouveau', 'confirme'].includes(o.status) ? `<div class="warn">${ico('alert')}Doublon possible (même numéro, même produit)</div>` : ''}
    <div class="l3"><span class="amt num">${F(o.price)}</span>${o.driver && U.role !== 'livreur' ? `<span class="who-drv">${ico('truck')}${esc(uname(o.driver))}</span>` : ''}</div>
    ${acts ? `<div class="actions fill">${acts}</div>` : ''}</article>`;
}
const call = o => `<a class="btn sm line" href="tel:${esc(digits(o.phone))}" data-stop>${ico('phone')} Appeler</a>`;
const wa = o => `<a class="btn sm line" target="_blank" rel="noopener" href="https://wa.me/${esc(digits(o.phone).replace('+', ''))}" data-stop>${ico('chat')} WhatsApp</a>`;
const act = (a, id, label, cls = '') => `<button class="btn sm ${cls}" data-a="${a}" data-id="${esc(id)}">${label}</button>`;
const empty = (t, s) => `<div class="empty"><b>${t}</b>${s || ''}</div>`;
const grid = (list, f) => list.length ? `<div class="grid g-orders">${list.map(f).join('')}</div>` : '';
const head = (t, s, extra = '') => `<div class="head"><div><h2>${t}</h2><p>${s}</p></div>${extra}</div>`;
const kpi = (l, v, sub = '', hero = false) => `<div class="kpi ${hero ? 'hero' : ''}"><small>${l}</small><b class="num">${v}</b><em>${sub}</em></div>`;
function bars(rows, { val, max, cls = () => '' }) {
  const m = max || Math.max(1, ...rows.map(r => r.w));
  return rows.length ? `<div class="bars">${rows.map(r => `<div class="bar"><span class="lab" title="${esc(r.k)}">${esc(r.k)}</span>
    <span class="track"><span class="fill ${cls(r)}" style="width:${Math.max(2, 100 * r.w / m)}%"></span></span><span class="val num">${val(r)}</span></div>`).join('')}</div>` : empty('Pas encore de données');
}
function columns(list, days = 14) {
  const sod = startOfDay(), data = [];
  for (let i = days - 1; i >= 0; i--) { const t = sod - i * DAY, l = list.filter(o => o.createdAt >= t && o.createdAt < t + DAY); data.push({ t, n: l.length, liv: l.filter(o => o.status === 'livre').length }); }
  const max = Math.max(1, ...data.map(d => d.n)), W = 100 / days;
  return `<svg class="cols" viewBox="0 0 100 60" preserveAspectRatio="none" role="img" aria-label="Commandes reçues et livrées par jour">
    ${data.map((d, i) => { const h1 = 48 * d.n / max, h2 = 48 * d.liv / max, x = i * W + W * .18, w = W * .64;
      return `<g><title>${dmy(d.t)} : ${d.n} reçues, ${d.liv} livrées</title><rect x="${x}" y="${50 - h1}" width="${w}" height="${h1}" rx=".8" fill="var(--surface-2)"/>
      <rect x="${x}" y="${50 - h2}" width="${w}" height="${h2}" rx=".8" fill="var(--gold)"/></g>`; }).join('')}</svg>
    <div class="legend" style="justify-content:space-between"><span>${dmy(data[0].t).slice(0, 5)}</span><span><i style="background:var(--gold)"></i>Livrées <i style="background:var(--surface-2);margin-left:10px"></i>Reçues</span><span>${dmy(data[days - 1].t).slice(0, 5)}</span></div>`;
}
function hero(line, done, goal) {
  const h = new Date().getHours(), hi = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const p = goal ? Math.min(100, pct(done, goal)) : 0;
  return `<section class="hero"><div><small>${d}</small><h2>${hi}, ${esc(U.name)}</h2><p>${line}</p></div>
    ${goal ? `<div class="goal"><div class="ring" style="--p:${p}"><b class="num">${p}%</b></div><span><b class="num">${done} / ${goal}</b> livraisons<br>objectif du jour</span></div>` : ''}</section>`;
}
function podium(role) {
  const sod = startOfDay(), rows = byRole(role).map(u => ({ u, n: S.orders.filter(o => (role === 'livreur' ? o.driver : o.closer) === u.id && DONE.includes(o.status) && o.deliveredAt >= sod).length })).sort((a, b) => b.n - a.n);
  return `<div class="card"><h3 class="tag" style="margin-bottom:6px">Classement du jour</h3>${rows.map((r, i) => `<div class="list-row"><span class="avatar" ${i ? 'style="background:var(--surface-2);color:var(--ink-2)"' : ''}>${i + 1}</span>
    <div class="grow"><b>${esc(r.u.name)}${r.u.id === U.id ? ' (vous)' : ''}</b></div><b class="num">${r.n} livrée${r.n > 1 ? 's' : ''}</b></div>`).join('')}</div>`;
}
const share = role => Math.ceil(GOAL() / Math.max(1, byRole(role).length));
const rangeChips = () => `<div class="chips">${RANGE_ORDER.map(k => `<button class="chip ${V.range === k ? 'on' : ''}" data-a="range" data-id="${k}">${RANGES[k]}</button>`).join('')}</div>`;
function shopChips(list) {
  const g = group(list, o => o.shop).sort((a, b) => b.n - a.n);
  return `<div class="chips"><button class="chip ${V.shop ? '' : 'on'}" data-a="shop" data-id="">Toutes <small>${list.length}</small></button>
    ${g.map(x => `<button class="chip ${V.shop === x.k ? 'on' : ''}" data-a="shop" data-id="${esc(x.k)}">${esc(x.k)} <small>${x.n}</small></button>`).join('')}</div>`;
}
const searchBox = ph => `<label class="search">${ico('search')}<input class="input" id="q" type="search" placeholder="${ph}" value="${esc(V.q)}" data-in="q" autocomplete="off"></label>`;
const match = o => !V.q || [o.client, o.phone, o.product, o.shop, o.zone, o.ref].join(' ').toLowerCase().includes(V.q.toLowerCase());

const VIEWS = {};                               // remplies par js/views.js

function insights(l, prod, zon) {
  const out = [], ok = a => a.filter(x => x.closed >= 3);
  const bp = ok(prod).sort((a, b) => b.rate - a.rate)[0], wp = ok(prod).sort((a, b) => a.rate - b.rate)[0];
  if (bp) out.push(`<b>${esc(bp.k)}</b> est votre produit le plus fiable : ${bp.rate} % des commandes sont livrées. C'est celui à pousser en publicité.`);
  if (wp && bp && wp.k !== bp.k && wp.rate < 60) out.push(`<b>${esc(wp.k)}</b> n'est livré qu'à ${wp.rate} %. Vérifiez le prix annoncé et la promesse de la publicité.`);
  const wz = ok(zon).sort((a, b) => a.rate - b.rate)[0];
  if (wz && wz.rate < 55) out.push(`Zone <b>${esc(wz.k)}</b> : seulement ${wz.rate} % de livraisons réussies. Un appel de confirmation renforcé y est conseillé.`);
  const tz = zon[0]; if (tz && tz.liv >= 3) out.push(`Vos clients sont surtout à <b>${esc(tz.k)}</b> (${tz.liv} livraisons). Ciblez cette zone dans vos publicités.`);
  const liv = l.filter(o => o.status === 'livre'), f = liv.filter(o => o.sexe === 'F').length;
  if (liv.length >= 6) out.push(`${pct(f, liv.length)} % de vos acheteurs sont des <b>femmes</b> et ${100 - pct(f, liv.length)} % des hommes.`);
  return out.slice(0, 4);
}

function allOrders(src, canEdit) {
  const l = src.filter(o => inRange(o.createdAt, V.range) && (!V.stf || o.status === V.stf) && (!V.shop || o.shop === V.shop) && match(o)).sort((a, b) => b.createdAt - a.createdAt);
  const inR = src.filter(o => inRange(o.createdAt, V.range));
  return head('Commandes', `${l.length} commande(s)`, canEdit ? `<button class="btn primary" data-a="order-add">${ico('plus')} Saisir une commande</button>` : '') + rangeChips() + '<div style="height:8px"></div>' + (canEdit ? shopChips(inR) + '<div style="height:8px"></div>' : '') +
    `<div class="chips"><button class="chip ${V.stf ? '' : 'on'}" data-a="stf" data-id="">Tous les statuts</button>${Object.entries(ST).map(([k, s]) => `<button class="chip ${V.stf === k ? 'on' : ''}" data-a="stf" data-id="${k}">${s.l}</button>`).join('')}</div>
    <div class="actions" style="margin:12px 0">${searchBox('Rechercher un client, un numéro, un produit…')}</div>` +
    (l.length ? `<div class="table-wrap"><table><thead><tr><th>Réf.</th><th>Reçue</th>${canEdit ? '<th>Boutique</th>' : ''}<th>Client</th><th>Produit</th><th>Lieu</th><th class="r">Montant</th><th>Statut</th>${canEdit ? '<th>Livreur</th>' : ''}</tr></thead><tbody>
      ${l.slice(0, 200).map(o => `<tr data-a="open" data-id="${esc(o.id)}"><td class="num">${esc(o.ref)}</td><td class="num">${dmy(o.createdAt).slice(0, 5)} ${hm(o.createdAt)}</td>${canEdit ? `<td><span class="tag">${esc(o.shop)}</span></td>` : ''}
        <td>${esc(o.client)}</td><td>${esc(o.product)}</td><td>${esc(o.zone)}</td><td class="r num"><b>${fmt(o.price)}</b></td><td>${badge(o)}</td>${canEdit ? `<td>${o.driver ? esc(uname(o.driver)) : '—'}</td>` : ''}</tr>`).join('')}
      </tbody></table></div>${l.length > 200 ? '<p class="hint" style="margin-top:8px;color:var(--ink-3)">200 premières lignes affichées — affinez la recherche.</p>' : ''}` : empty('Aucune commande trouvée'));
}
/* ================= Rapports & exports ================= */
function eodText() {
  const l = S.orders.filter(o => inRange(actT(o), V.range)), st = stats(l);
  return [`📊 WASSI DELIVERY — Résumé ${RANGES[V.range].toLowerCase()} (${dmy(Date.now())})`, '',
    `Reçues : ${st.n} · Livrées : ${st.liv} · Taux : ${st.rate} %`, `Encaissé : ${F(st.cash)} · Revenu livraison : ${F(st.fees)}`,
    `Non livrées : ${st.closed - st.liv} · Encore en cours : ${st.n - st.closed}`, '', 'PAR BOUTIQUE',
    ...group(l, o => o.shop).sort((a, b) => b.liv - a.liv).map(s => `• ${s.k} : ${s.liv}/${s.n} livrées — ventes ${F(s.cash)}, net ${F(s.cash - s.fees)}`), '', 'PAR LIVREUR',
    ...byRole('livreur').map(u => { const d = l.filter(o => o.driver === u.id && ['livre', 'livre_livreur'].includes(o.status)); return `• ${u.name} : ${d.length} livrées — ${F(sum(d, o => o.price))} encaissés`; }), '', 'PAR CLOSEUSE',
    ...byRole('closeuse').map(u => { const s = stats(l.filter(o => o.closer === u.id)); return `• ${u.name} : ${s.n} traitées, ${s.liv} livrées (${s.rate} %)`; })].join('\n');
}
function workList() { return opsList(); }
// Même format que la base du site de comptabilité Wassi (CEO 360° ERP).
const erpRow = o => ({ id: o.createdAt + Math.floor(Math.random() * 1000), dateStr: dayKey(o.deliveredAt || o.createdAt), marchand: o.shop, lieu: o.zone, produit: o.product, quantite: o.qty,
  prixMarchandise: o.price, fraisLivraison: o.fee, fraisExpedition: o.feeExp || 0, agenceExp: o.agence || '', isRetour: false, livreur: uname(o.driver), closeuse: uname(o.closer) });
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); }
  catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  toast('Copié', 'Vous pouvez coller où vous voulez.');
}

/* ================= Fenêtres ================= */
function renderModal() {
  const m = V.modal, root = $('#modal'); Nav.modal(!!m); if (!m) { root.innerHTML = ''; return; }
  const keep = root.querySelector('.sheet'), top = keep ? keep.scrollTop : 0;
  let body = '';
  if (m.t === 'order') body = orderSheet(order(m.id));
  if (m.t === 'problem') { const o = order(m.id); body = `<div class="sheet-head"><h3>Quel est le problème ?</h3>${closeBtn()}</div><p style="color:var(--ink-2);margin-bottom:12px">${esc(o.client)} · ${esc(o.product)}</p>
    <div class="grid">${PROBLEMS.map(p => `<button class="btn block" data-a="reason" data-id="${esc(o.id)}" data-r="${esc(p)}">${p}</button>`).join('')}</div>`; }
  if (m.t === 'retry') { const o = order(m.id); body = `<div class="sheet-head"><h3>Quand rappeler ${esc(o.client)} ?</h3>${closeBtn()}</div>
    <div class="grid">${[[0, 'Plus tard aujourd\'hui (dans 2 h)'], [1, 'Demain matin'], [2, 'Après-demain'], [7, 'Dans une semaine']].map(([n, t]) => `<button class="btn block" data-a="retry" data-id="${esc(o.id)}" data-n="${n}">${t}</button>`).join('')}</div>`; }
  if (m.t === 'report') body = `<div class="sheet-head"><h3>${esc(m.title)}</h3>${closeBtn()}</div><pre class="report" id="rep">${esc(m.text)}</pre>
    <div class="actions fill" style="margin-top:12px"><button class="btn" data-a="rep-copy">Copier</button><a class="btn primary" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(m.text)}">${ico('chat')} Envoyer sur WhatsApp</a></div>`;
  if (m.t === 'notifs') { const l = S.notifs.filter(forMe).sort((a, b) => b.at - a.at).slice(0, 40);
    body = `<div class="sheet-head"><h3>Notifications</h3>${closeBtn()}</div>${pushHint()}${l.length ? l.map(n => `<div class="list-row" ${n.orderId && order(n.orderId) ? `data-a="open" data-id="${esc(n.orderId)}" style="cursor:pointer"` : ''}>
      <div class="grow"><b>${esc(n.title)}</b><small>${esc(n.text)}</small></div><small class="num" style="color:var(--ink-3)">${ago(n.at)}</small></div>`).join('') : empty('Aucune notification')}`; }
  if (m.t === 'form') body = `<div class="sheet-head"><h3>${esc(m.title)}</h3>${closeBtn()}</div>${m.fields.map(f => `<label class="field"><span>${esc(f.l)}</span>${f.opts ?
      `<select class="input" data-f="${f.k}">${f.opts.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(f.v ?? '') ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>` :
      `<input class="input" data-f="${f.k}" value="${esc(f.v || '')}" placeholder="${esc(f.ph || '')}" type="${f.t || 'text'}" ${f.n ? 'inputmode="numeric"' : ''} autocomplete="${f.t === 'password' ? 'new-password' : 'off'}">${f.t === 'password' ? eyeBtn : ''}`}</label>`).join('')}
    ${m.note ? `<p class="hint" style="margin-top:10px;color:var(--ink-2);font-size:13px">${esc(m.note)}</p>` : ''}
    <div class="actions fill" style="margin-top:16px"><button class="btn line" data-a="back">Retour</button><button class="btn primary" data-a="form-ok">${esc(m.ok || 'Enregistrer')}</button></div>`;
  if (m.t === 'html') body = `<div class="sheet-head"><h3>${esc(m.title)}</h3>${closeBtn()}</div>${m.html()}`;
  root.innerHTML = `<div class="overlay" data-a="close-bg"><div class="sheet" role="dialog" aria-modal="true">${body}</div></div>`;
  const s = root.querySelector('.sheet'); if (keep && s) s.scrollTop = top;
}
const closeBtn = () => `<button class="icon-btn" data-a="close" aria-label="Fermer">${ico('x')}</button>`;
// Frais de livraison : visibles et modifiables seulement par la responsable des opérations et le CEO.
function feeBlock(o) {
  if (!MONEY()) return '';
  return `<div class="section" style="margin-top:18px"><h3>Frais de livraison · ${feeOk(o) ? 'validés' : 'à préciser'}</h3>
    <div class="kv"><label class="field" style="margin:0"><span>Frais de livraison (F)</span><input class="input num" inputmode="numeric" data-ch="fee" data-id="${esc(o.id)}" value="${esc(o.fee || 0)}"></label>
      ${isExp(o.zone) ? `<label class="field" style="margin:0"><span>Frais d'expédition (F)</span><input class="input num" inputmode="numeric" data-ch="feeExp" data-id="${esc(o.id)}" value="${esc(o.feeExp || 0)}"></label>` : ''}</div>
    <div class="chips wrap" style="margin-top:10px"><button class="chip ${o.noClose ? 'on' : ''}" data-a="noclose" data-id="${esc(o.id)}">Closing fait par la boutique</button></div>
    <div class="actions" style="margin-top:10px;align-items:center"><b class="num" style="flex:1">Total des frais Wassi : ${F(wfee(o))}</b>${feeOk(o) ? '<span class="badge st-ok">Frais validés</span>' : act('fee-ok', o.id, 'Valider ces frais', 'primary')}</div></div>`;
}
function orderSheet(o) {
  if (!o) return `<div class="sheet-head"><h3>Commande introuvable</h3>${closeBtn()}</div>`;
  const edit = ['closeuse', 'ceo'].includes(U.role), drv = U.role === 'livreur' && o.driver === U.id && o.status === 'assigne';
  const load = id => S.orders.filter(x => x.driver === id && x.status === 'assigne').length;
  const showContact = U.role !== 'marchand';
  return `<div class="sheet-head"><div style="flex:1"><div class="l1" style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><span class="tag">${esc(o.shop)}</span>${badge(o)}<small style="color:var(--ink-3)">${esc(o.ref)}</small></div>
      <h3>${esc(o.client)}</h3></div>${closeBtn()}</div>
    ${showContact ? `<div class="actions fill">${call(o)}${wa(o)}${U.role === 'livreur' && !isExp(o.zone) ? `<a class="btn sm line" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.zone + ', ' + PAYS.city)}">Itinéraire</a>` : ''}</div>
      <div class="chips" style="margin-top:10px">${[['confirm', 'Message : confirmation'], ['route', 'Message : livreur en route'], ['miss', 'Message : injoignable']].map(([k, t]) => `<a class="chip" target="_blank" rel="noopener" href="${esc(waLink(o, k))}">${ico('chat')}${t}</a>`).join('')}</div>` : ''}
    ${isDup(o) && edit ? `<div class="warn" style="margin-top:10px">${ico('alert')}Doublon possible : même numéro et même produit dans les 3 derniers jours.</div>` : ''}
    ${o.reason ? `<div class="warn" style="margin-top:10px">${ico('alert')}${esc(o.reason)}</div>` : ''}
    <div class="kv"><div><small>Produit</small><b>${esc(o.product)}${o.qty > 1 ? ' × ' + o.qty : ''}</b></div><div><small>Montant à encaisser</small><b class="num">${F(o.price)}</b></div>
      <div><small>Lieu</small><b>${esc(o.zone)}</b></div>${MONEY() ? `<div><small>Frais Wassi${feeOk(o) ? '' : ' · à valider'}</small><b class="num">${F(wfee(o))}</b></div>` : U.role === 'marchand' ? `<div><small>Frais Wassi</small><b class="num">${feeOk(o) ? F(wfee(o)) : 'En attente'}</b></div>` : ''}
      ${showContact ? `<div><small>Téléphone</small><b class="num">${esc(o.phone)}</b></div>` : ''}<div><small>Livreur</small><b>${o.driver ? esc(uname(o.driver)) : '—'}</b></div></div>
    ${drv ? `<div class="actions fill" style="margin-top:14px">${act('problem', o.id, 'Problème', 'danger')}${act('delivered', o.id, ico('check') + ' Livré', 'ok')}</div>` : ''}
    ${U.role === 'livreur' && o.driver === U.id && o.status === 'livre_livreur' ? `<div class="actions fill" style="margin-top:14px">${act('undeliver', o.id, 'Erreur : pas encore livrée', 'danger')}</div>` : ''}
    ${edit ? `
    <div class="section" style="margin-top:18px"><h3>1 · Statut</h3><div class="chips wrap">${['confirme', 'reporte', 'injoignable', 'annule', 'livre'].map(k =>
      `<button class="chip ${o.status === k ? 'on' : ''}" data-a="status" data-id="${esc(o.id)}" data-s="${k}">${ST[k].l}</button>`).join('')}</div></div>
    <div class="section" style="margin-top:18px"><h3>2 · Livreur ${o.driver ? '(touchez un autre nom pour changer)' : ''}</h3><div class="chips wrap">${byRole('livreur').map(d =>
      `<button class="chip ${o.driver === d.id ? 'on' : ''}" data-a="assign" data-id="${esc(o.id)}" data-d="${esc(d.id)}">${esc(d.name)} <small>${load(d.id)} en cours${inHand(d.id, o.shop, o.product) > 0 ? ' · ' + inHand(d.id, o.shop, o.product) + ' pcs en main' : ''}</small></button>`).join('')}</div></div>
    <div class="section" style="margin-top:18px"><h3>Détails</h3>
      <div class="chips wrap">${[['F', 'Femme'], ['H', 'Homme']].map(([k, l]) => `<button class="chip ${o.sexe === k ? 'on' : ''}" data-a="sexe" data-id="${esc(o.id)}" data-s="${k}">${l}</button>`).join('')}</div>
      <div class="kv"><label class="field" style="margin:0"><span>Lieu</span><select class="input" data-ch="zone" data-id="${esc(o.id)}">${[...new Set([o.zone, ...Object.keys(ZONES)])].map(z => `<option ${z === o.zone ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select></label>
        ${isExp(o.zone) ? `<label class="field" style="margin:0"><span>Agence d'expédition</span><select class="input" data-ch="agence" data-id="${esc(o.id)}">${['', ...AGENCES].map(a => `<option ${a === (o.agence || '') ? 'selected' : ''}>${a}</option>`).join('')}</select></label>` : ''}</div>
      <label class="field"><span>Note pour le livreur</span><textarea class="input" data-ch="note" data-id="${esc(o.id)}" placeholder="Repère, heure souhaitée…">${esc(o.note)}</textarea></label></div>` :
      (o.note && U.role !== 'marchand' ? `<div class="insight" style="margin-top:12px">${ico('chat')}<div>${esc(o.note)}</div></div>` : '')}
    ${feeBlock(o)}
    <div class="section" style="margin-top:18px"><h3>Historique</h3><ul class="timeline">${o.history.slice().reverse().map(h => `<li><b>${esc(h.text)}</b><small>${esc(U.role === 'marchand' ? '' : h.by + ' · ')}${dmy(h.at).slice(0, 5)} à ${hm(h.at)}</small></li>`).join('')}</ul></div>`;
}
function form(title, fields, done, extra) { V.modal = { t: 'form', title, fields, done, prev: V.modal && V.modal.t === 'order' ? V.modal : null, ...extra }; renderModal(); const f = $('#modal [data-f]'); if (f) f.focus(); }

/* ================= Actions ================= */
let deferredInstall = null;
const A = {
  logout: () => logout(), tab: d => Nav.go(d.id),
  theme: () => { const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    r.dataset.theme = dark ? 'light' : 'dark'; localStorage.setItem('wassi.theme', r.dataset.theme); },
  bell: () => { V.modal = { t: 'notifs' }; localStorage.setItem(LS('wassi.read.') + U.id, Date.now()); render(); },
  open: d => { V.modal = { t: 'order', id: d.id }; renderModal(); },
  close: () => { V.modal = null; renderModal(); }, 'close-bg': (d, el, e) => { if (e.target === el) A.close(); },
  simulate, reset: () => { if (confirm('Remettre les données de démonstration à zéro ?')) { S = seed(); persist(); render(); } },
  confirm: d => Biz.confirm(order(d.id)),
  assign: d => { Biz.assign(order(d.id), d.d); toast('Envoyée', 'Le livreur ' + uname(d.d) + ' a été notifié.'); },
  status: d => { const o = order(d.id); if (d.s === 'reporte') { V.modal = { t: 'retry', id: o.id, prev: V.modal }; return renderModal(); } if (o.status !== d.s) Biz.setStatus(o, d.s); },
  retry: d => { const o = order(d.id), n = +d.n; o.retryAt = n ? startOfDay() + n * DAY + 9 * 3600e3 : Date.now() + 2 * 3600e3; V.modal = { t: 'order', id: o.id };
    Biz.setStatus(o, 'reporte', n ? 'Rappel prévu le ' + dmy(o.retryAt) : 'Rappel prévu dans 2 h'); },
  'order-add': () => form('Saisir une commande', [{ k: 'shop', l: 'Boutique', opts: S.shops.map(s => [s.name, s.name]) }, { k: 'client', l: 'Nom du client' }, { k: 'phone', l: 'Téléphone', ph: PAYS.dial + ' …' },
    { k: 'product', l: 'Produit' }, { k: 'price', l: 'Montant à encaisser (F)', n: 1 }, { k: 'qty', l: 'Quantité', n: 1, v: '1' }, { k: 'zone', l: 'Lieu de livraison', opts: Object.keys(ZONES).map(z => [z, z]) },
    { k: 'sexe', l: 'Client', opts: [['F', 'Femme'], ['H', 'Homme']] }],
    v => { const price = parseInt(v.price, 10); if (!v.client.trim() || digits(v.phone).length < 8 || !v.product.trim() || !(price > 0)) return 'Nom, téléphone, produit et montant sont obligatoires.';
      Biz.incoming({ shop: v.shop, client: v.client.trim(), phone: v.phone.trim(), product: v.product.trim(), price, qty: Math.max(1, parseInt(v.qty, 10) || 1), zone: v.zone, sexe: v.sexe, closer: U.role === 'closeuse' ? U.id : null }, true); }),
  'cash-in': d => { const l = cashDue(d.id), amt = sum(l, o => o.price); if (!l.length || !confirm(`Confirmer que ${uname(d.id)} a remis ${F(amt)} ?`)) return; const at = Date.now();
    l.forEach(o => { o.cashIn = at; o.history.push({ at, by: U.name, text: 'Argent remis à la caisse' }); Remote.push({ t: 'order', o }); });
    notify({ toUser: d.id, title: 'Versement reçu', text: `${F(amt)} bien reçus par ${U.name}. Merci !` }); commit(); toast('Versement enregistré', `${uname(d.id)} · ${F(amt)}`); },
  'goal-save': () => { const g = parseInt($('#goal').value, 10); if (!(g > 0)) return toast('À corriger', 'Entrez un nombre de livraisons.'); localStorage.setItem(LS('wassi.goal'), g); toast('Objectif enregistré', g + ' livraisons par jour.'); render(); },
  backup: () => download(`wassi-sauvegarde-${today()}.json`, JSON.stringify(S), 'application/json'),
  restore: () => $('#restore').click(),
  'w-next': () => { if ((V.slide || 0) < SLIDES.length - 1) { V.slide = (V.slide || 0) + 1; renderWelcome(); } else A['w-skip'](); },
  'w-skip': () => { localStorage.setItem('wassi.welcomed', '1'); V.slide = 0; render(); },
  'w-replay': () => { localStorage.removeItem('wassi.welcomed'); V.slide = 0; V.replay = true; renderWelcome(); },
  validate: d => Biz.validate(order(d.id)),
  'validate-all': () => S.orders.filter(o => o.status === 'livre_livreur').forEach(o => Biz.validate(o)),
  delivered: d => { Biz.driverDelivered(order(d.id)); V.modal = null; renderModal(); toast('Bravo !', 'Livraison enregistrée, la closeuse est prévenue.'); },
  problem: d => { V.modal = { t: 'problem', id: d.id, prev: V.modal }; renderModal(); },
  reason: d => { Biz.driverProblem(order(d.id), d.r); V.modal = null; renderModal(); },
  sexe: d => { const o = order(d.id); o.sexe = d.s; commit(o); },
  range: d => { V.range = d.id; V.sel.clear(); render(); }, shop: d => { V.shop = d.id; V.sel.clear(); render(); },
  stf: d => { V.stf = d.id; render(); }, period: d => { V.period = +d.id; render(); },
  copy: () => copyText(workList().map(o => [dmy(o.deliveredAt || o.createdAt), o.shop, o.zone, o.product, o.qty, o.price, wfee(o), o.agence || '', uname(o.driver), uname(o.closer)].join('\t')).join('\n')),
  csv: () => download(`wassi-livraisons-${today()}.csv`, '﻿' + ['Date;Boutique;Client;Téléphone;Lieu;Produit;Quantité;Montant;Frais livraison;Frais expédition;Agence;Livreur;Closeuse',
    ...workList().map(o => [dmy(o.deliveredAt || o.createdAt), o.shop, o.client, o.phone, o.zone, o.product, o.qty, o.price, o.fee, o.feeExp || 0, o.agence || '', uname(o.driver), uname(o.closer)].map(x => `"${String(x).replace(/"/g, '""')}"`).join(';'))].join('\r\n'), 'text/csv'),
  json: () => download(`wassi-compta-${today()}.json`, JSON.stringify({ orders: workList().map(erpRow), exportedAt: new Date().toISOString() }, null, 2), 'application/json'),
  eod: () => { V.modal = { t: 'report', title: 'Rapport global', text: eodText() }; renderModal(); },
  'rep-copy': () => copyText(V.modal.text),
  install: async () => { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; render(); } },
  'api-save': () => { const v = $('#api').value.trim(); if (v && !/^https:\/\/script\.google\.com\/.+\/exec$/.test(v)) return toast('Adresse invalide', 'Elle doit commencer par https://script.google.com/ et finir par /exec.');
    v ? localStorage.setItem('wassi.api', v) : localStorage.removeItem('wassi.api'); location.reload(); },
  'api-off': () => { if (confirm('Déconnecter cet appareil du serveur et revenir aux données de démonstration ?')) { localStorage.setItem('wassi.api', 'off'); localStorage.removeItem(LS('wassi.token')); location.reload(); } },
  'shop-plan': d => { const s = S.shops.find(x => x.id === d.id); s.plan = s.plan === 'actif' ? 'essai' : 'actif'; syncCfg(); },
  'shop-trial': d => { const s = S.shops.find(x => x.id === d.id); s.trialEnd = Math.max(Date.now(), s.trialEnd) + 30 * DAY; syncCfg(); },
  'shop-sheet': d => { const s = S.shops.find(x => x.id === d.id); form('Google Sheet de ' + s.name, [{ k: 'sheetId', l: 'Lien ou identifiant du Google Sheet', v: s.sheetId, ph: 'https://docs.google.com/spreadsheets/d/…' }], v => { s.sheetId = sheetId(v.sheetId); syncCfg(); }); },
  'form-ok': () => { const m = V.modal, v = {}; document.querySelectorAll('#modal [data-f]').forEach(el => v[el.dataset.f] = el.value); const err = m.done(v); if (err) return toast('À corriger', err); V.modal = null; renderModal(); render(); }
};
const sheetId = s => { const m = String(s || '').match(/\/d\/([\w-]{20,})/); return m ? m[1] : String(s || '').trim(); };
function syncCfg() { persist(); Remote.push({ t: 'users', users: S.users }); Remote.push({ t: 'shops', shops: S.shops }); render(); }

document.addEventListener('click', e => {
  const stop = e.target.closest('[data-stop]'), el = e.target.closest('[data-a]');
  if (!el || (stop && el.contains(stop) && el !== stop && !stop.contains(el))) return;
  if (el.tagName === 'INPUT' && el.type === 'checkbox') return;      // géré par « change »
  const fn = A[el.dataset.a]; if (fn) tracked(el.dataset.a, () => fn(el.dataset, el, e));
});
document.addEventListener('change', e => tracked('edit', () => onChange(e)));
function onChange(e) {
  const el = e.target;
  if (el.type === 'checkbox' && el.dataset.a) return A[el.dataset.a](el.dataset, el, e);
  if (el.id === 'restore' && el.files[0]) { const f = el.files[0]; el.value = ''; return importFile(f); }
  if (el.dataset.set) { V[el.dataset.set] = el.value; return render(); }
  if (el.dataset.disp !== undefined) { V.disp[el.dataset.disp] = el.value; return render(); }
  const k = el.dataset.ch; if (!k) return;
  const o = order(el.dataset.id); if (!o) return;
  if (k === 'zone') { o.zone = el.value; o.fee = ZONES[el.value] ?? o.fee; o.feeExp = isExp(el.value) ? 1000 : 0; if (!isExp(el.value)) o.agence = ''; return commit(o, 'Lieu modifié : ' + el.value); }
  if (k === 'fee' || k === 'feeExp') { if (!MONEY()) return; o[k] = Math.max(0, parseInt(el.value, 10) || 0); o.feeSet = true; return commit(o, 'Frais précisés : ' + F(wfee(o))); }
  o[k] = el.value; commit(o);
}
document.addEventListener('input', e => { if (e.target.dataset.in === 'q') { V.q = e.target.value; render(); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && V.modal) A.close();
  if (e.key === 'Enter' && e.target.tagName === 'INPUT') { const b = e.target.closest('#modal') ? $('#modal [data-a="form-ok"]') : e.target.closest('.panel') ? $('.panel [data-enter]') : null; if (b) { e.preventDefault(); b.click(); } }
});
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (U && V.tab === 'settings') render(); });
window.addEventListener('online', () => Remote.pull());
