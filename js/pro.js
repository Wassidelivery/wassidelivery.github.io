/* WASSI DELIVERY — retour et annulation, stock, caisse, reprise de l'ancienne application, carte. */
'use strict';

Object.assign(ICONS, {
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>', undo: '<path d="M4 9h10a6 6 0 010 12H8M4 9l4-4M4 9l4 4"/>',
  box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/>', pin: '<path d="M12 21s7-6.200 7-11a7 7 0 10-14 0c0 4.800 7 11 7 11z"/><circle cx="12" cy="10" r="2.500"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', gps: '<circle cx="12" cy="12" r="3.500"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  star: '<path d="M12 3l2.700 5.600 6.100.800-4.500 4.300 1.100 6.100L12 16.900 6.600 19.800l1.100-6.100L3.200 9.400l6.100-.800z"/>'
});
Object.assign(V, { day: dayKey(Date.now()), sub: null, mapSel: null, repShop: '', auth: { mode: 'login' } });
const today = () => dayKey(Date.now());
const DEP_TYPES = ['Essence', 'Crédit / Appel', 'Réparation véhicule', 'Emballage', 'Salaires / Primes', 'Autre'];

/* ================= Retour en arrière ================= */
const Nav = {
  hist: [], skip: 0, m: false,
  push(k) { try { history.pushState({ w: k }, ''); } catch (e) {} },
  go(tab) { if (tab === V.tab && !V.sub) return; this.hist.push({ tab: V.tab, sub: V.sub }); if (this.hist.length > 40) this.hist.shift(); this.push('t'); setTab(tab); },
  sub(id) { this.hist.push({ tab: V.tab, sub: V.sub }); this.push('t'); V.sub = id; render(); window.scrollTo(0, 0); },
  modal(open) {                                 // garde le bouton « retour » du téléphone en phase avec les fenêtres
    if (open && !this.m) { this.m = true; this.push('m'); }
    else if (!open && this.m) { this.m = false; if (history.state && history.state.w === 'm') { this.skip++; history.back(); } }
  },
  back() {
    if (V.modal) { V.modal = V.modal.prev || null; renderModal(); if (!V.modal) render(); return true; }
    if (!U) { if (!localStorage.getItem('wassi.welcomed')) { if (V.slide) { V.slide--; renderWelcome(); return true; } return false; } return authBack(); }
    const p = this.hist.pop(); if (!p) return false;
    setTab(p.tab, p.sub); return true;
  }
};
function setTab(id, sub = null) { V.tab = id; V.sub = sub; V.disp = null; V.q = ''; V.shop = ''; V.stf = ''; V.sel.clear(); V.mapSel = null; render(); window.scrollTo(0, 0); }
window.addEventListener('popstate', () => { if (Nav.skip) { Nav.skip--; return; } Nav.back(); });

/* ================= Annuler la dernière action ================= */
const Undo = {
  stack: [],
  run() {
    const before = this.stack.pop(); if (!before) return;
    const cur = S; S = upgrade(JSON.parse(before));
    if (Remote.on) {
      const was = new Map(cur.orders.map(o => [o.id, JSON.stringify(o)])), ids = new Set(S.orders.map(o => o.id));
      S.orders.forEach(o => { if (was.get(o.id) !== JSON.stringify(o)) Remote.push({ t: 'order', o }); });
      cur.orders.forEach(o => { if (!ids.has(o.id)) Remote.push({ t: 'order', o: { ...o, status: 'annule', reason: 'Saisie annulée' } }); });
      blob('stock', 'takes', 'moves', 'goals', 'charges', 'dispatch');
      if (U.role === 'ceo') { Remote.push({ t: 'users', users: S.users }); Remote.push({ t: 'shops', shops: S.shops }); }
    }
    V.modal = null; persist(); renderModal(); render();
    toast('Action annulée', 'Tout est revenu comme avant. Vous pouvez corriger.');
  }
};
const QUIET = new Set(['undo', 'tab', 'back', 'open', 'close', 'close-bg', 'bell', 'theme', 'range', 'shop', 'stf', 'period', 'more', 'day', 'map-zoom', 'map-pick', 'sub', 'logout', 'copy', 'csv', 'json', 'backup', 'rep-copy']);
// Exécute une action ; si elle a modifié les données, garde l'état d'avant pour pouvoir l'annuler.
function tracked(name, fn) {
  if (!U || QUIET.has(name)) return fn();
  const before = JSON.stringify(S), rev = REV, had = Undo.stack.length, r = fn();
  if (U && REV !== rev) { Undo.stack.push(before); if (Undo.stack.length > 6) Undo.stack.shift(); if (!had) render(); }
  return r;
}
// Envoie au serveur une liste entière (stock, passages, caisse…) quand l'app est connectée.
function blob(...keys) {
  if (!Remote.on) return;
  Remote.pushes++;
  keys.forEach(k => { if (!Remote.busy) Remote.q = Remote.q.filter(op => !(op.t === 'set' && op.k === k)); Remote.q.push({ t: 'set', k, v: S[k], _k: localStorage.getItem(LS('wassi.token')) || '' }); });
  Remote.saveQ(); Remote.flush();
}
// Le serveur ne renvoie que les commandes modifiées depuis la dernière lecture : on les fusionne avec celles déjà connues.
function mergeState(st) { const m = new Map(S.orders.map(o => [o.id, o])); (st.orders || []).forEach(o => m.set(o.id, o)); Object.assign(S, st, { orders: [...m.values()] }); upgrade(S); }
// Premier branchement au serveur : propose d'y envoyer les vraies données déjà présentes sur cet appareil.
function localBackup() { try { const d = JSON.parse(localStorage.getItem(LS('wassi.demo3'))); return d && d.importedAt && Array.isArray(d.orders) && d.orders.length ? d : null; } catch (e) { return null; } }
function offerUpload(force) {
  if (!Remote.on || !U || U.role !== 'ceo' || S.orders.length || V.modal || (!force && localStorage.getItem(LS('wassi.noupload')))) return;
  const d = localBackup(); if (!d) return;
  V.modal = { t: 'html', title: 'Envoyer vos données sur le serveur ?', html: () => `<p style="color:var(--ink-2);margin-bottom:14px">Le serveur est vide. Les données de cet appareil peuvent y être envoyées pour que toute l'équipe travaille dessus :<br><b>${d.orders.length} commandes · ${d.shops.length} boutiques · ${(d.stock || []).length} produits en stock</b>.</p>
    <div class="actions fill"><button class="btn line" data-a="upload-no">Plus tard</button><button class="btn primary" data-a="upload-yes">Envoyer maintenant</button></div>` };
  renderModal();
}
function doUpload() {
  const d = localBackup(); V.modal = null; renderModal(); if (!d || !Remote.on || U.role !== 'ceo') return;
  d.users = d.users.filter(u => u.role !== 'ceo').concat(S.users.filter(u => u.role === 'ceo'));
  S = upgrade(d); U = user(U.id) || U; Remote.push({ t: 'import', state: S }); persist(); render();
  toast('Envoi en cours', 'Gardez cette page ouverte une minute, le temps que Google enregistre tout.');
}
const save = (...keys) => { blob(...keys); persist(); render(); };

/* ================= Stock ================= */
const stockItem = (shop, product, make) => {
  let it = S.stock.find(i => i.shop === shop && norm(i.product) === norm(product));
  if (!it && make) { it = { id: uid('k'), shop, product, qty: 0 }; S.stock.push(it); }
  return it;
};
const sameProd = (t, shop, product) => t.shop === shop && norm(t.product) === norm(product);
const inHand = (driver, shop, product) => sum(S.takes.filter(t => t.driver === driver && sameProd(t, shop, product)), t => t.qty);
const outHand = (shop, product) => sum(S.takes.filter(t => sameProd(t, shop, product)), t => t.qty);        // chez tous les livreurs
function handList(driver) {
  const m = new Map();
  S.takes.filter(t => t.driver === driver).forEach(t => { const k = t.shop + '|' + norm(t.product), x = m.get(k) || { shop: t.shop, product: t.product, qty: 0 }; x.qty += t.qty; m.set(k, x); });
  return [...m.values()].filter(x => x.qty !== 0).sort((a, b) => a.shop.localeCompare(b.shop));
}
// À la livraison : la pièce sort du stock que le livreur a avec lui, sinon du stock au bureau.
function consume(o) {
  if (o.stk) return; const q = o.qty || 1;
  if (o.driver && inHand(o.driver, o.shop, o.product) >= q) { S.takes.push({ id: uid('t'), at: Date.now(), driver: o.driver, shop: o.shop, product: o.product, qty: -q, kind: 'liv', orderId: o.id }); o.stk = 'd'; }
  else { stockItem(o.shop, o.product, true).qty -= q; o.stk = 'b'; }
  blob('stock', 'takes');
}
function release(o) {                           // la livraison est annulée ou corrigée : la pièce revient
  if (!o.stk || o.stk === 'x') return;
  if (o.stk === 'd') S.takes = S.takes.filter(t => t.orderId !== o.id); else stockItem(o.shop, o.product, true).qty += (o.qty || 1);
  delete o.stk; blob('stock', 'takes');
}

/* ================= Soldes des boutiques et caisse Wassi ================= */
const dayB = d => { const a = new Date(d + 'T00:00:00').getTime(); return [a, a + DAY]; };
const balanceAt = (shop, t = Infinity) => {
  const s = shopOf(shop) || {};
  return (s.open || 0) + net(S.orders.filter(o => o.shop === shop && o.status === 'livre' && feeOk(o) && actT(o) < t)) + sum(S.moves.filter(m => m.shop === shop && m.at < t), m => m.amt);
};
const balance = shop => balanceAt(shop);
const caisse = (t = Infinity) => sum(S.orders.filter(o => o.status === 'livre' && actT(o) < t), wfee)
  - sum(S.moves.filter(m => m.type === 'dep' && m.at < t), m => m.amt) + sum(S.moves.filter(m => m.type === 'adj' && m.at < t), m => m.amt);
// Exercice Wassi : du 29 d'un mois au 28 du mois suivant (comme dans l'ancienne application).
const exoStart = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); if (d.getDate() < 29) d.setMonth(d.getMonth() - 1, 29); else d.setDate(29); return d.getTime(); };
const primeOf = (u, n, l) => u.free ? sum(l.filter(o => o.driver === u.id), o => o.fee) : u.role === 'livreur' ? Math.max(0, n - 5) * ((u.salary || 0) >= 75000 ? 200 : 500) : u.role === 'closeuse' ? Math.max(0, n - 5) * 500 : 0;
function exoResult() {
  const a = exoStart(), l = S.orders.filter(o => o.status === 'livre' && actT(o) >= a);
  const staff = S.users.filter(u => !u.gone && u.status !== 'pending' && ['livreur', 'closeuse', 'assistante'].includes(u.role));
  const rows = staff.map(u => { const n = l.filter(o => (u.role === 'livreur' ? o.driver : o.closer) === u.id).length; return { u, n, prime: primeOf(u, n, l) }; });
  const ca = sum(l, wfee), sal = sum(staff, u => u.free ? 0 : u.salary) + sum(S.charges, c => c.amt), primes = sum(rows, r => r.prime);
  const dep = sum(S.moves.filter(m => m.type === 'dep' && m.at >= a && m.cat !== 'Salaires / Primes'), m => m.amt);
  const netR = ca - sal - primes - dep, secours = netR > 0 ? netR * .1 : 0;
  return { a, n: l.length, ca, sal, primes, dep, netR, secours, benef: netR - secours, rows };
}

/* ================= Rapport journalier d'un e-commerçant (même format que d'habitude) ================= */
const sp = n => fmt(n).replace(/\s/g, ' ');
function reportText(shop, day) {
  const [a, b] = dayB(day), l = S.orders.filter(o => o.shop === shop && o.status === 'livre' && feeOk(o) && actT(o) >= a && actT(o) < b).sort((x, y) => actT(x) - actT(y));
  const fails = S.orders.filter(o => o.shop === shop && o.status === 'annule' && (o.updatedAt || o.createdAt) >= a && (o.updatedAt || o.createdAt) < b).length;
  const ventes = sum(l, o => o.price), frais = sum(l, wfee), gain = ventes - frais, fin = balanceAt(shop, b), q = new Map();
  l.forEach(o => q.set(o.product, (q.get(o.product) || 0) + (o.qty || 1)));
  const st = S.stock.filter(i => i.shop === shop);
  return `RAPPORT DU ${dmy(a)}

👤Marchand : ${shop}

📋Commandes livrées : ${l.length}
----------------------------------------------------

${l.map(o => `➡️${o.zone} /${o.product} (x${o.qty || 1})->${sp(o.price)}f`).join('\n') || 'Aucune livraison ce jour'}

Total : ${sp(ventes)} FCFA

Frais Wassi par livraison :
${l.map(o => `•${o.zone} : ${sp(wfee(o))}f`).join('\n') || 'Aucun'}

Total : ${sp(frais)} FCFA
${fails ? `\n↩️ Retours / Échecs du jour : ${fails}\n` : ''}
📦Stock écoulé :
${[...q].map(([p, n]) => `${p} : ${n} unités`).join('\n') || 'Aucun'}

📦Stock restant :
${st.map(i => `(${i.qty + outHand(shop, i.product)}pcs pour ${i.product})`).join('\n') || 'Aucun'}

💰GAIN DU JOUR (Ventes - Frais Wassi) :
👉${sp(ventes)} - ${sp(frais)} = ${sp(gain)} FCFA

📋NOUVEAU SOLDE MARCHAND (Solde précédent + Gain du jour) :
${sp(fin - gain)} + ${sp(gain)} = ${sp(fin)} FCFA`;
}

/* ================= Reprise de l'ancienne application (fichier .json) ================= */
const isOldBackup = d => d && Array.isArray(d.orders) && (Array.isArray(d.merchants) || (d.orders[0] && 'dateStr' in d.orders[0]));
function importOld(d) {
  const now = Date.now(), ts = s => { const t = new Date(String(s) + 'T12:00:00').getTime(); return isNaN(t) ? now : t; };
  const users = S.users.filter(u => u.role === 'ceo'), charges = [], roleMap = { livreur: 'livreur', closeuse: 'closeuse', assistante: 'assistante', freelance: 'livreur' };
  (d.team || []).forEach(t => { const r = roleMap[norm(t.role)], sal = +t.baseSalary || 0;
    if (!r) return charges.push({ id: uid('c'), name: t.name + ' (' + t.role + ')', amt: sal });
    if (users.some(u => u.role === r && norm(u.name) === norm(t.name))) return;
    const u = { id: 'u_' + slug(t.name) + '_' + r[0], name: String(t.name).trim(), role: r, salary: sal, email: '' }; if (norm(t.role) === 'freelance') u.free = true; users.push(u); });
  const who = (name, role) => {                 // retrouve la personne ; les anciens membres restent dans l'historique sans accès
    if (!name || norm(name) === 'non') return null;
    let u = users.find(x => x.role === role && norm(x.name) === norm(name));
    if (!u) { u = { id: 'u_' + slug(name) + '_' + role[0], name: String(name).trim(), role, salary: 0, email: '', gone: true }; users.push(u); }
    return u.id;
  };
  const shops = [], bal = {}, shopFor = name => { const n = String(name || 'SANS NOM').trim(); let s = shops.find(x => norm(x.name) === norm(n));
    if (!s) { s = { id: 's_' + slug(n), name: n, sheetId: '', plan: 'essai', trialEnd: now + 30 * DAY }; shops.push(s); bal[s.name] = 0; } return s; };
  (d.merchants || []).forEach(m => { const s = shopFor(m.name); bal[s.name] += +m.balance || 0; if (m.nextStorageFeeDate) s.storageDue = m.nextStorageFeeDate; });
  const orders = (d.orders || []).map((x, i) => { const at = ts(x.dateStr), ret = !!x.isRetour, closer = who(x.closeuse, 'closeuse');
    return { id: 'a' + x.id, ref: 'A' + (i + 1), shop: shopFor(x.marchand).name, client: 'Client', phone: '', product: String(x.produit || 'Produit').trim(), qty: +x.quantite || 1,
      price: +x.prixMarchandise || 0, zone: String(x.lieu || '').trim() || PAYS.city, fee: +x.fraisLivraison || 0, feeExp: +x.fraisExpedition || 0, agence: x.agenceExp || '', note: '',
      status: ret ? 'annule' : 'livre', ...(ret ? { reason: 'Retour' } : { deliveredAt: at, validatedAt: at, cashIn: at }), driver: who(x.livreur, 'livreur'), closer,
      createdAt: at, transferred: true, stk: 'x', old: 1, history: [] }; });
  const moves = [];
  (d.merchantMoves || []).forEach(m => { const s = shopFor(m.merchantName), amt = +m.montant || 0; moves.push({ id: 'v' + m.id, at: ts(m.dateStr), type: amt < 0 ? 'pay' : 'badj', shop: s.name, amt, note: m.note || (amt < 0 ? 'Reversement' : 'Ajustement') }); });
  (d.depenses || []).forEach(x => moves.push({ id: 'd' + x.id, at: ts(x.dateStr), type: 'dep', cat: x.type || 'Autre', amt: +x.montant || 0, note: x.note || '' }));
  (d.caisseAdjustments || []).forEach(x => moves.push({ id: 'j' + x.id, at: ts(x.dateStr), type: 'adj', amt: +x.montant || 0, note: x.note || '' }));
  // Solde d'ouverture : ce qu'il faut pour retrouver exactement le solde de l'ancienne application.
  shops.forEach(s => { s.open = (bal[s.name] || 0) - sum(orders.filter(o => o.shop === s.name && o.status === 'livre'), o => o.price - wfee(o)) - sum(moves.filter(m => m.shop === s.name), m => m.amt); });
  const stock = []; (d.inventory || []).forEach(i => { const s = shopFor(i.merchant), p = String(i.product || '').trim(); let it = stock.find(x => x.shop === s.name && norm(x.product) === norm(p));
    if (!it) { it = { id: 'k' + i.id, shop: s.name, product: p, qty: 0 }; stock.push(it); } it.qty += +i.stock || 0; });
  const seenG = new Set(), goals = (d.goals || []).filter(g => !seenG.has(g.id) && seenG.add(g.id)).map(g => ({ id: 'g' + g.id, type: g.type || 'epargne', name: g.name, target: +g.target || 0, current: +g.current || 0 }));
  return { v: 1, users, shops, orders, notifs: [], stock, takes: [], moves, pos: {}, goals, charges, cfg: S.cfg || {}, createdAt: now, importedAt: now };
}
function applyImport(d) {
  if (isOldBackup(d)) {
    const n = importOld(d);
    if (!confirm(`Reprendre l'ancienne application ?\n\n${n.orders.length} livraisons · ${n.shops.length} boutiques · ${n.stock.length} produits en stock · ${n.users.length - 1} membres d'équipe\n\nLes données actuelles de l'app seront remplacées.`)) return false;
    S = n;
  } else {
    if (!d || d.v !== 1 || !Array.isArray(d.orders) || !Array.isArray(d.users)) throw new Error('format');
    if (!d.users.some(u => u.role === 'ceo')) d.users.push(...S.users.filter(u => u.role === 'ceo'));
    if (!confirm(`Remplacer les données actuelles par cette sauvegarde (${d.orders.length} commandes) ?`)) return false;
    S = upgrade(d);
  }
  U = user(U.id) || S.users.find(u => u.role === 'ceo'); Undo.stack = [];
  if (Remote.on) Remote.push({ t: 'import', state: S });
  persist(); V.range = '30'; render();
  toast('Données chargées', `${S.orders.length} commandes · ${S.shops.length} boutiques.`); return true;
}
function importFile(file) {
  return file.text().then(t => applyImport(JSON.parse(t))).catch(() => toast('Fichier non reconnu', 'Choisissez une sauvegarde Wassi (.json), de cette app ou de l\'ancienne.'));
}

/* ================= Carte de la ville ================= */
const GEO = { 'plateau': [13.5190, 2.1090], 'sonuci': [13.5480, 2.1010], 'bobiel': [13.5600, 2.0850], 'koubia': [13.5450, 2.0640], 'francophonie': [13.5460, 2.0900], 'harobanda': [13.4890, 2.0960],
  'niamey 2000': [13.5380, 2.1680], 'ryad': [13.5500, 2.0760], 'yantala': [13.5340, 2.0900], 'aeroport': [13.4860, 2.1720], 'tchangarey': [13.5740, 2.1050], 'lazaret': [13.5540, 2.1160],
  'koira kano': [13.5300, 2.0810], 'kouara kano': [13.5300, 2.0810], 'grand marche': [13.5145, 2.1170], 'katako': [13.5225, 2.1180], 'poudriere': [13.5100, 2.1350], 'banifandou': [13.5350, 2.1340],
  'wadata': [13.5170, 2.1410], 'boukoki': [13.5290, 2.1150], 'dar es salam': [13.5450, 2.1250], 'rive droite': [13.4950, 2.0900], 'recasement': [13.5410, 2.1060], 'goudel': [13.5350, 2.0520],
  'maourey': [13.5140, 2.1110], 'talladje': [13.4980, 2.1500], 'gamkalle': [13.4960, 2.1250], 'saga': [13.4720, 2.1400], 'kalley': [13.5120, 2.1260], 'lacouroussou': [13.5130, 2.1220],
  'bassora': [13.5300, 2.1720], 'route filingue': [13.5360, 2.1520], 'nord faisceau': [13.5580, 2.1300], 'gaweye': [13.5010, 2.1050], 'kirkissoye': [13.4800, 2.1100], 'lamorde': [13.4980, 2.0850],
  'universite': [13.5010, 2.0900], 'terminus': [13.5175, 2.1030], 'chateau': [13.5220, 2.0970], 'issa beri': [13.5210, 2.1050], 'aviation': [13.5010, 2.1600], 'koira tegui': [13.5800, 2.1300],
  'lossa goungou': [13.5650, 2.0650], 'liberte': [13.5180, 2.1260], 'abidjan': [13.5220, 2.1290], 'nouveau marche': [13.5110, 2.1290], 'cite caisse': [13.5410, 2.1160], 'dan gao': [13.5350, 2.1450],
  'madina': [13.5280, 2.1350], 'garba do': [13.5250, 2.1500], 'cite fayçal': [13.5270, 2.1280], 'cite faycal': [13.5270, 2.1280], 'petit marche': [13.5140, 2.1100], 'stade': [13.5200, 2.1230],
  'rond point': [13.5160, 2.1140], 'palais': [13.5100, 2.1050], 'gare': [13.5170, 2.1410], 'expedition': [13.5170, 2.1410] };
if (PAYS.zones) { Object.keys(GEO).forEach(k => delete GEO[k]); PAYS.zones.forEach(z => { GEO[norm(z[0])] = [z[1], z[2]]; }); GEO.expedition = PAYS.center; }
const GEO_KEYS = Object.keys(GEO).sort((a, b) => b.length - a.length), CENTER = PAYS.center.slice();
function geo(zone) {                            // position approximative d'un quartier
  const z = norm(zone); for (const k of GEO_KEYS) if (z.includes(k)) return GEO[k];
  let h = 0; for (const c of z) h = (h * 31 + c.charCodeAt(0)) | 0;
  return [CENTER[0] + ((h & 255) - 128) / 9000, CENTER[1] + (((h >> 8) & 255) - 128) / 9000];
}
const MapV = { z: 13, c: CENTER.slice() };
const proj = (lat, lng, z) => { const n = 256 * 2 ** z, s = Math.sin(lat * Math.PI / 180); return [(lng + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n]; };
const unproj = (x, y, z) => { const n = 256 * 2 ** z; return [Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI, x / n * 360 - 180]; };
// Où est chaque livreur : sa vraie position s'il la partage, sinon le quartier de sa livraison en cours.
const ALL = () => true;
function driverSpots(filter = ALL) {
  return byRole('livreur').map(u => {
    const run = S.orders.filter(o => o.driver === u.id && o.status === 'assigne').sort((a, b) => a.assignedAt - b.assignedAt), mine = run.filter(filter);
    const p = S.pos[u.id], live = p && Date.now() - p.at < 15 * MIN;
    if (!mine.length && !(live && filter === ALL)) return null;
    const at = live ? [p.lat, p.lng] : run.length ? geo(run[0].zone) : null; if (!at) return null;
    return { u, at, live, run: mine, since: live ? p.at : run[0].assignedAt };
  }).filter(Boolean);
}
function mapHtml(spots, dests) {
  const z = MapV.z, [cx, cy] = proj(MapV.c[0], MapV.c[1], z), H = 420, W = 1300, n = 2 ** z, tiles = [];
  for (let tx = Math.floor((cx - W / 2) / 256); tx <= Math.floor((cx + W / 2) / 256); tx++) for (let ty = Math.floor((cy - H / 2) / 256); ty <= Math.floor((cy + H / 2) / 256); ty++) {
    if (ty < 0 || ty >= n) continue;
    tiles.push(`<img src="https://tile.openstreetmap.org/${z}/${((tx % n) + n) % n}/${ty}.png" alt="" draggable="false" loading="lazy" style="left:${tx * 256 - cx}px;top:${ty * 256 - cy}px">`);
  }
  const at = ([lat, lng]) => { const [x, y] = proj(lat, lng, z); return `left:${(x - cx).toFixed(1)}px;top:${(y - cy).toFixed(1)}px`; };
  return `<div class="map" id="map"><div class="map-layer" id="map-layer">${tiles.join('')}
      ${dests.map(o => `<span class="dest" style="${at(geo(o.zone))}" title="${esc(o.product + ' → ' + o.zone)}"></span>`).join('')}
      ${spots.map(s => `<button class="mpin ${s.live ? 'live' : ''} ${V.mapSel === s.u.id ? 'on' : ''}" style="${at(s.at)}" data-a="map-pick" data-id="${esc(s.u.id)}" aria-label="${esc(s.u.name)}"><i>${esc(initials(s.u.name))}</i><b>${esc(s.u.name)}${s.run.length ? ' · ' + s.run.length : ''}</b></button>`).join('')}</div>
    <div class="map-ctl"><button data-a="map-zoom" data-id="1" aria-label="Zoomer">+</button><button data-a="map-zoom" data-id="-1" aria-label="Dézoomer">−</button><button data-a="map-zoom" data-id="0" aria-label="Recentrer la carte">${ico('gps')}</button></div>
    <a class="map-att" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a></div>`;
}
function afterRender() {                        // déplacement de la carte au doigt ou à la souris
  const el = document.getElementById('map'), layer = document.getElementById('map-layer'); if (!el) return;
  let st = null;
  el.onpointerdown = e => { if (e.target.closest('button,a')) return; st = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; el.setPointerCapture(e.pointerId); };
  el.onpointermove = e => { if (!st) return; st.dx = e.clientX - st.x; st.dy = e.clientY - st.y; layer.style.transform = `translate(${st.dx}px,${st.dy}px)`; };
  el.onpointerup = el.onpointercancel = () => { if (!st) return; const [cx, cy] = proj(MapV.c[0], MapV.c[1], MapV.z), moved = Math.abs(st.dx) + Math.abs(st.dy) > 3;
    if (moved) MapV.c = unproj(cx - st.dx, cy - st.dy, MapV.z); st = null; if (moved) render(); };
}

/* ---- Partage de position du livreur ---- */
var Gps = {
  id: null, last: 0,
  get on() { return localStorage.getItem(LS('wassi.gps')) === '1'; },
  start() {
    if (!navigator.geolocation) return toast('Position indisponible', 'Ce téléphone ne permet pas la localisation.');
    localStorage.setItem(LS('wassi.gps'), '1'); if (this.id != null) return;
    this.id = navigator.geolocation.watchPosition(p => {
      const now = Date.now(); if (!U || U.role !== 'livreur' || now - this.last < 20000) return; this.last = now;
      S.pos[U.id] = { lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5), at: now };
      Remote.push({ t: 'pos', id: U.id, p: S.pos[U.id] }); persist();
    }, () => { this.stop(); toast('Position non partagée', 'Autorisez la localisation pour Wassi Delivery dans votre téléphone.'); render(); }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 });
  },
  pause() { if (this.id != null) navigator.geolocation.clearWatch(this.id); this.id = null; },
  stop() { this.pause(); localStorage.removeItem(LS('wassi.gps')); if (U && S.pos[U.id]) { delete S.pos[U.id]; Remote.push({ t: 'pos', id: U.id, p: null }); persist(); } }
};

/* ================= Actions ================= */
const stockOpts = () => S.stock.slice().sort((a, b) => a.shop.localeCompare(b.shop) || a.product.localeCompare(b.product)).map(i => [i.id, `${i.shop} — ${i.product} (${i.qty} au bureau)`]);
const num = v => parseInt(String(v).replace(/[^\d-]/g, ''), 10) || 0;
const drop = (k, id) => { S[k] = S[k].filter(x => x.id !== id); };

Object.assign(A, {
  back: () => { if (history.state && history.state.w) history.back(); else if (!Nav.back()) toast('Premier écran', 'Il n\'y a pas d\'écran précédent.'); },
  undo: () => Undo.run(),
  country: d => { if (!COUNTRIES[d.id]) return; localStorage.setItem('wassi.country', d.id); location.reload(); },
  'country-change': () => { localStorage.removeItem('wassi.country'); V.modal = null; renderModal(); render(); },
  'upload-yes': () => doUpload(), 'upload-no': () => { localStorage.setItem(LS('wassi.noupload'), '1'); V.modal = null; renderModal(); }, 'upload-ask': () => offerUpload(true),
  'w-prev': () => Nav.back(),
  more: () => { V.modal = { t: 'html', title: 'Plus', html: () => `<div class="grid">${TABS[U.role].slice(4).map(([id, l, ic]) => `<button class="btn block ${V.tab === id ? 'primary' : ''}" style="justify-content:flex-start" data-a="tab-m" data-id="${id}">${ico(ic)} ${l}${tabCount(id) ? ` <span class="badge st-conf">${tabCount(id)}</span>` : ''}</button>`).join('')}</div>` }; renderModal(); },
  'tab-m': d => { V.modal = null; renderModal(); Nav.go(d.id); },
  sub: d => Nav.sub(d.id),
  day: d => { V.day = d.id; render(); },
  noclose: d => { const o = order(d.id); if (!MONEY()) return; o.noClose = !o.noClose; commit(o, o.noClose ? 'Closing fait par la boutique (pas de frais de closing)' : 'Closing fait par Wassi'); },
  undeliver: d => { Biz.undeliver(order(d.id)); V.modal = null; renderModal(); toast('Corrigé', 'La commande est revenue dans « À livrer ».'); },
  confirm: d => { const o = order(d.id); Biz.confirm(o); if (!byRole('livreur').length) return;
    V.modal = { t: 'html', title: 'Envoyer à quel livreur ?', html: () => `<p style="color:var(--ink-2);margin-bottom:10px">${esc(o.client)} · ${esc(o.product)} · ${esc(o.zone)}</p><div class="grid">${byRole('livreur').map(u => { const h = inHand(u.id, o.shop, o.product), n = S.orders.filter(x => x.driver === u.id && x.status === 'assigne').length;
      return `<button class="btn block" style="justify-content:space-between" data-a="assign" data-id="${esc(o.id)}" data-d="${esc(u.id)}"><span>${ico('truck')} ${esc(u.name)}</span><small style="font-weight:600;color:var(--ink-2)">${n} en cours${h > 0 ? ' · ' + h + ' pcs en main' : ''}</small></button>`; }).join('')}
      <button class="btn line block" data-a="close">Plus tard</button></div>` }; renderModal(); },
  assign: d => { Biz.assign(order(d.id), d.d); if (V.modal && V.modal.t === 'html') { V.modal = null; renderModal(); } toast('Envoyée', 'Le livreur ' + uname(d.d) + ' a été notifié.'); },
  gps: () => { Gps.on ? Gps.stop() : Gps.start(); render(); },
  'map-zoom': d => { const k = +d.id; if (!k) { MapV.z = 13; MapV.c = CENTER.slice(); } else MapV.z = Math.max(11, Math.min(17, MapV.z + k)); render(); },
  'map-pick': d => { V.mapSel = V.mapSel === d.id ? null : d.id; render(); },

  /* ---- stock ---- */
  'stock-add': d => form('Ajouter un produit au stock', [...(d.id ? [] : [{ k: 'shop', l: 'Boutique', opts: S.shops.map(s => [s.name, s.name]) }]), { k: 'product', l: 'Nom du produit' }, { k: 'qty', l: 'Quantité reçue (pièces)', n: 1 }],
    v => { const shop = d.id || v.shop, p = v.product.trim(), q = num(v.qty); if (!p || q <= 0) return 'Nom du produit et quantité obligatoires.';
      stockItem(shop, p, true).qty += q; notify({ toRole: 'marchand', shop, title: 'Stock reçu', text: `${q} × ${p} ajoutés à votre stock chez Wassi.` }); save('stock'); },
    { note: 'Si le produit existe déjà, la quantité s\'ajoute au stock actuel.' }),
  'stock-set': d => { const it = S.stock.find(i => i.id === d.id); form(`${it.product} — ${it.shop}`, [{ k: 'qty', l: 'Quantité réelle au bureau (pièces)', n: 1, v: String(it.qty) }],
    v => { if (!/^-?\d+$/.test(v.qty.trim())) return 'Entrez un nombre.'; it.qty = num(v.qty); save('stock'); }, { note: 'Sert à corriger une erreur de saisie ou après un inventaire.' }); },
  'stock-del': d => { const it = S.stock.find(i => i.id === d.id); if (it && confirm(`Supprimer « ${it.product} » du stock de ${it.shop} ?`)) { drop('stock', d.id); save('stock'); } },
  'take-add': d => { const self = U.role === 'livreur', opts = stockOpts(); if (!opts.length) return toast('Stock vide', 'Ajoutez d\'abord des produits au stock des boutiques.');
    form(self ? 'Passage au bureau' : 'Passage d\'un livreur au bureau', [...(self ? [] : [{ k: 'driver', l: 'Livreur', opts: byRole('livreur').map(u => [u.id, u.name]), v: d.id }]),
      { k: 'kind', l: 'Mouvement', opts: [['take', 'Prend des pièces'], ['ret', 'Rend des pièces au bureau']] }, { k: 'item', l: 'Produit', opts }, { k: 'qty', l: 'Nombre de pièces', n: 1 }],
      v => { const drv = self ? U.id : v.driver, it = S.stock.find(i => i.id === v.item), q = num(v.qty); if (!drv || !it || q <= 0) return 'Livreur, produit et nombre de pièces obligatoires.';
        if (v.kind === 'take' && it.qty < q) return `Il ne reste que ${it.qty} pièce(s) de ${it.product} au bureau.`;
        if (v.kind === 'ret' && inHand(drv, it.shop, it.product) < q) return `${uname(drv)} n'a que ${inHand(drv, it.shop, it.product)} pièce(s) de ${it.product} avec lui.`;
        const s = v.kind === 'take' ? 1 : -1; it.qty -= s * q; S.takes.push({ id: uid('t'), at: Date.now(), driver: drv, shop: it.shop, product: it.product, qty: s * q, kind: v.kind, by: U.name });
        notify(self ? { toRole: 'assistante', title: 'Passage au bureau', text: `${U.name} ${s > 0 ? 'a pris' : 'a rendu'} ${q} × ${it.product} (${it.shop}).` } : { toUser: drv, title: s > 0 ? 'Stock remis' : 'Stock rendu', text: `${q} × ${it.product} (${it.shop}) — enregistré par ${U.name}.` });
        save('stock', 'takes'); }); },
  'take-del': d => { const t = S.takes.find(x => x.id === d.id); if (!t || t.kind === 'liv' || !confirm('Supprimer ce passage ? Le stock du bureau sera corrigé.')) return;
    stockItem(t.shop, t.product, true).qty += t.qty; drop('takes', t.id); save('stock', 'takes'); },

  /* ---- soldes et caisse ---- */
  'pay-out': d => { const b = balance(d.id); form('Reverser à ' + d.id, [{ k: 'amt', l: `Montant reversé (F) — solde actuel ${F(b)}`, n: 1, v: String(Math.max(0, b)) }, { k: 'note', l: 'Note (facultatif)', ph: 'Espèces, Nita, Amana…' }],
    v => { const amt = num(v.amt); if (amt <= 0) return 'Entrez le montant reversé.'; const at = Date.now();
      S.moves.push({ id: uid('m'), at, type: 'pay', shop: d.id, amt: -amt, note: v.note.trim() || 'Reversement', by: U.name });
      notify({ toRole: 'marchand', shop: d.id, title: 'Reversement effectué', text: `Wassi Delivery vous a reversé ${F(amt)}. Nouveau solde : ${F(b - amt)}.` });
      save('moves'); setTimeout(() => { V.modal = { t: 'report', title: 'Reçu de reversement', text: [`💰 WASSI DELIVERY — Reversement ${d.id}`, `Date : ${dmy(at)}`, '', `Solde avant : ${sp(b)} FCFA`, `✅ Montant reversé : ${sp(amt)} FCFA`, `Nouveau solde : ${sp(b - amt)} FCFA`, v.note.trim() ? 'Note : ' + v.note.trim() : '', '', SLOGAN].filter((x, i, a) => x || a[i - 1]).join('\n') }; renderModal(); }); }, { ok: 'Enregistrer le reversement' }); },
  'bal-adj': d => form('Ajuster le solde de ' + d.id, [{ k: 'dir', l: 'Sens', opts: [['1', 'Ajouter au solde'], ['-1', 'Retirer du solde']] }, { k: 'amt', l: 'Montant (F)', n: 1 }, { k: 'note', l: 'Motif', ph: 'Correction, frais de stockage…' }],
    v => { const amt = num(v.amt); if (amt <= 0 || !v.note.trim()) return 'Montant et motif obligatoires.'; S.moves.push({ id: uid('m'), at: Date.now(), type: 'badj', shop: d.id, amt: +v.dir * amt, note: v.note.trim(), by: U.name }); save('moves'); }),
  'dep-add': () => form('Nouvelle dépense', [{ k: 'cat', l: 'Type de dépense', opts: DEP_TYPES.map(t => [t, t]) }, { k: 'amt', l: 'Montant (F)', n: 1 }, { k: 'note', l: 'Détail', ph: 'Moto Moussa, recharge…' }, { k: 'day', l: 'Date', t: 'date', v: today() }],
    v => { const amt = num(v.amt); if (amt <= 0) return 'Entrez le montant de la dépense.'; const [a] = dayB(v.day || today());
      S.moves.push({ id: uid('m'), at: v.day === today() || !v.day ? Date.now() : a + 12 * 3600e3, type: 'dep', cat: v.cat, amt, note: v.note.trim(), by: U.name });
      if (U.role !== 'ceo') notify({ toRole: 'ceo', title: 'Dépense enregistrée', text: `${v.cat} · ${F(amt)}${v.note.trim() ? ' · ' + v.note.trim() : ''} (${U.name})` }); save('moves'); }),
  'adj-add': () => form('Ajuster la caisse Wassi', [{ k: 'dir', l: 'Sens', opts: [['1', 'Entrée d\'argent'], ['-1', 'Sortie d\'argent (retrait, salaires…)']] }, { k: 'amt', l: 'Montant (F)', n: 1 }, { k: 'note', l: 'Motif' }],
    v => { const amt = num(v.amt); if (amt <= 0 || !v.note.trim()) return 'Montant et motif obligatoires.'; S.moves.push({ id: uid('m'), at: Date.now(), type: 'adj', amt: +v.dir * amt, note: v.note.trim(), by: U.name }); save('moves'); }),
  'move-del': d => { const m = S.moves.find(x => x.id === d.id); if (m && confirm(`Supprimer cette ligne (${F(Math.abs(m.amt))}) ? Les soldes seront recalculés.`)) { drop('moves', d.id); save('moves'); } },
  'goal-add': () => form('Nouvelle épargne ou objectif', [{ k: 'type', l: 'Type', opts: [['epargne', 'Épargne'], ['objectif', 'Objectif']] }, { k: 'name', l: 'Nom', ph: 'Achat d\'une nouvelle moto' }, { k: 'target', l: 'Montant visé (F)', n: 1, v: '0' }, { k: 'current', l: 'Déjà mis de côté (F)', n: 1, v: '0' }],
    v => { if (!v.name.trim()) return 'Donnez un nom.'; S.goals.push({ id: uid('g'), type: v.type, name: v.name.trim(), target: num(v.target), current: num(v.current) }); save('goals'); }),
  'goal-set': d => { const g = S.goals.find(x => x.id === d.id); form(g.name, [{ k: 'current', l: 'Montant mis de côté (F)', n: 1, v: String(g.current) }, { k: 'target', l: 'Montant visé (F)', n: 1, v: String(g.target) }],
    v => { g.current = num(v.current); g.target = num(v.target); save('goals'); }); },
  'goal-del': d => { if (confirm('Supprimer cette ligne ?')) { drop('goals', d.id); save('goals'); } },
  'charge-add': () => form('Charge fixe mensuelle', [{ k: 'name', l: 'Nom', ph: 'Internet, loyer, salaire du CEO…' }, { k: 'amt', l: 'Montant par mois (F)', n: 1 }],
    v => { const amt = num(v.amt); if (!v.name.trim() || amt <= 0) return 'Nom et montant obligatoires.'; S.charges.push({ id: uid('c'), name: v.name.trim(), amt }); save('charges'); }),
  'charge-del': d => { if (confirm('Supprimer cette charge fixe ?')) { drop('charges', d.id); save('charges'); } },
  'shop-storage': d => { const s = S.shops.find(x => x.id === d.id); if (!confirm(`Valider le paiement du stockage de ${s.name} pour 3 mois de plus ?`)) return;
    const t = new Date((s.storageDue || today()) + 'T12:00:00'); t.setMonth(t.getMonth() + 3); s.storageDue = dayKey(t.getTime()); syncCfg(); },
  'shop-add': () => form('Nouvelle boutique', [{ k: 'name', l: 'Nom de la boutique' }, { k: 'sheetId', l: 'Lien du Google Sheet des commandes (facultatif)', ph: 'https://docs.google.com/spreadsheets/d/…' }],
    v => { const name = v.name.trim().toUpperCase(); if (!name || S.shops.some(s => norm(s.name) === norm(name))) return 'Donnez un nom de boutique qui n\'existe pas encore.';
      S.shops.push({ id: uid('s'), name, sheetId: sheetId(v.sheetId), plan: 'essai', trialEnd: Date.now() + 30 * DAY }); syncCfg(); }, { note: 'L\'essai gratuit de 30 jours démarre maintenant. Créez ensuite l\'accès de l\'e-commerçant depuis sa fiche.' }),
  // Aperçu d'un espace par le CEO (mode local) : rien n'est créé, on regarde seulement.
  preview: d => { const s = d.id && S.shops.find(x => x.id === d.id); if (U.role !== 'ceo' || Remote.on) return;
    enter(s ? { id: 'preview', name: s.name, role: 'marchand', shop: s.name, preview: true } : d.u ? user(d.u) : { id: 'preview', name: 'Aperçu', role: 'assistante', preview: true }); },
  report: d => { V.modal = { t: 'report', title: 'Rapport ' + d.id, text: reportText(d.id, V.day) }; renderModal(); }
});

/* ================= Frais à préciser (opérations et CEO) ================= */
const feePending = () => S.orders.filter(o => o.status === 'livre' && !feeOk(o)).sort((a, b) => actT(a) - actT(b));
function feeQueue() {
  const l = feePending(); if (!l.length || !MONEY()) return '';
  return `<div class="section"><div class="head"><h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3)">Frais de livraison à préciser · ${l.length}</h3>
      ${l.length > 1 ? `<button class="btn sm primary" data-a="fee-all">Tout valider aux montants proposés</button>` : ''}</div>
    <p class="note">Tant que les frais ne sont pas validés, la livraison n'est pas comptée dans le solde de la boutique et l'e-commerçant ne voit pas les frais.</p>
    <div class="card">${l.slice(0, 40).map(o => `<div class="list-row wrap"><div class="grow" data-a="open" data-id="${esc(o.id)}" style="cursor:pointer"><b>${esc(o.shop)} · ${esc(o.product)}${o.qty > 1 ? ' × ' + o.qty : ''}</b><small>${esc(o.zone)} · ${F(o.price)} · livrée le ${dmy(actT(o)).slice(0, 5)} par ${esc(uname(o.driver))}</small></div>
      <input class="input num" style="width:104px" inputmode="numeric" data-ch="fee" data-id="${esc(o.id)}" value="${esc(o.fee || 0)}" aria-label="Frais de livraison en francs">
      <button class="btn sm ok" data-a="fee-ok" data-id="${esc(o.id)}">Valider</button></div>`).join('')}</div></div>`;
}

/* ================= Répartition des boutiques entre les closeuses ================= */
function dispatchView() {
  const clos = byRole('closeuse'), cur = Object.fromEntries(S.dispatch.map(d => [d.shop, d.closer]));
  if (!V.disp) V.disp = { ...cur };
  const d = V.disp, shops = S.shops.slice().sort((a, b) => a.name.localeCompare(b.name)), last = S.dispatch[0];
  const cnt = name => S.orders.filter(o => o.shop === name && o.status === 'nouveau').length;
  const dirty = shops.some(s => (d[s.name] || '') !== (cur[s.name] || ''));
  return head('Répartition des boutiques', 'Chaque matin, donnez à chaque closeuse les boutiques qu\'elle traite, puis envoyez', `<button class="btn primary" data-a="disp-send">${ico('check')} Envoyer la répartition</button>`) +
    `<div class="kpis">${clos.map(c => { const mine = shops.filter(s => d[s.name] === c.id); return kpi(esc(c.name), mine.length + ' boutique' + (mine.length > 1 ? 's' : ''), sum(mine, s => cnt(s.name)) + ' commande(s) à traiter'); }).join('')}
      ${kpi('Non réparties', shops.filter(s => !d[s.name]).length, 'vues par toutes les closeuses', true)}</div>
    <p class="note" style="margin:12px 0">${last ? `Dernière répartition envoyée le ${dmy(dayB(last.day)[0])}${last.by ? ' par ' + esc(last.by) : ''}. Elle reste valable tant qu'une nouvelle n'est pas envoyée.` : 'Aucune répartition envoyée : pour l\'instant, toutes les closeuses voient toutes les boutiques.'}${dirty ? ' <b style="color:var(--bad)">Modifications pas encore envoyées.</b>' : ''}</p>
    <div class="actions" style="margin-bottom:12px"><button class="btn" data-a="disp-auto">Répartir automatiquement</button><button class="btn" data-a="disp-clear">Tout effacer</button></div>
    ${clos.length ? '' : `<div class="insight alert" style="margin-bottom:12px">${ico('alert')}<div>Aucune closeuse n'a de compte dans ce pays. Ajoutez-les dans Réglages > Équipe.</div></div>`}
    <div class="table-wrap"><table><thead><tr><th>Boutique</th><th class="r">À traiter</th><th>Closeuse du jour</th></tr></thead><tbody>${shops.map(s => `<tr><td><b>${esc(s.name)}</b></td><td class="r num">${cnt(s.name)}</td>
      <td><select class="input" data-disp="${esc(s.name)}" style="min-width:170px" aria-label="Closeuse pour ${esc(s.name)}"><option value="">— Non répartie —</option>${clos.map(c => `<option value="${esc(c.id)}" ${d[s.name] === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>`;
}

/* ================= Comptes : qui utilise l'app, qui est connecté ================= */
function accountsView() {
  const now = Date.now(), on = u => (S.seen[u.id] || 0) > now - 3 * MIN;
  const when = u => on(u) ? '<span class="badge st-ok">En ligne</span>' : S.seen[u.id] ? 'vu ' + ago(S.seen[u.id]) : u.lastLogin ? 'connexion ' + ago(u.lastLogin) : '<span class="badge st-wait">Jamais connecté</span>';
  const acc = u => u.pass ? `code <b class="num">${esc(u.pass)}</b>` : u.ph ? 'mot de passe personnel' : '<span style="color:var(--bad)">aucun accès</span>';
  const order2 = (a, b) => on(b) - on(a) || (S.seen[b.id] || b.lastLogin || 0) - (S.seen[a.id] || a.lastLogin || 0);
  const ms = S.users.filter(u => u.role === 'marchand' && !u.gone).sort(order2), st = S.users.filter(u => u.role !== 'marchand' && !u.gone && u.status !== 'pending').sort(order2);
  const row = (u, shop) => `<tr><td><b>${esc(u.name)}</b>${u.status === 'pending' ? ' <span class="badge st-conf">À valider</span>' : ''}${shop ? `<br><small style="color:var(--ink-3)">${esc(u.contact || '')}</small>` : `<br><small style="color:var(--ink-3)">${ROLES[u.role]}</small>`}</td>
    <td>${u.email ? esc(u.email) : '<span style="color:var(--bad)">à renseigner</span>'}${u.phone ? `<br><small style="color:var(--ink-3)">${esc(u.phone)}</small>` : ''}</td><td>${acc(u)}</td><td>${when(u)}</td>
    ${shop ? `<td>${shopOf(u.shop) ? planBadge(shopOf(u.shop)) : '—'}</td>` : ''}
    <td class="r">${shop ? (shopOf(u.shop) ? `<button class="btn sm line" data-a="shop-access" data-id="${esc(shopOf(u.shop).id)}">Nouveau code</button><button class="btn sm danger" data-a="shop-del" data-id="${esc(shopOf(u.shop).id)}">Supprimer</button>` : '') : (u.id === U.id ? '' : `<button class="btn sm line" data-a="user-code" data-id="${esc(u.id)}">Nouveau code</button>`)}</td></tr>`;
  return head('Comptes', 'Qui utilise l\'application, avec quel e-mail, et qui est connecté en ce moment') +
    `<div class="kpis">${kpi('E-commerçants inscrits', ms.length, S.shops.length + ' boutiques au total')}${kpi('En ligne maintenant', S.users.filter(on).length, 'actifs dans les 3 dernières minutes', true)}${kpi('Jamais connectés', S.users.filter(u => !u.gone && !u.lastLogin && !S.seen[u.id]).length, 'comptes créés mais pas utilisés')}</div>
    <p class="note" style="margin:12px 0">Un <b>code</b> donné par Wassi reste visible ici. Un <b>mot de passe personnel</b>, choisi par la personne, est secret : personne ne peut le lire, même vous. Si elle l'oublie, « Nouveau code » lui en crée un provisoire.</p>
    <div class="section" style="margin-top:8px"><h3>E-commerçants · ${ms.length}</h3>${ms.length ? `<div class="table-wrap"><table><thead><tr><th>Boutique</th><th>E-mail</th><th>Accès</th><th>Activité</th><th>Abonnement</th><th></th></tr></thead><tbody>${ms.map(u => row(u, true)).join('')}</tbody></table></div>` : empty('Aucun e-commerçant n\'a encore de compte', 'Créez leur accès depuis la fiche de leur boutique, ou laissez-les s\'inscrire.')}</div>
    <div class="section"><h3>Équipe · ${st.length}</h3><div class="table-wrap"><table><thead><tr><th>Nom</th><th>E-mail</th><th>Accès</th><th>Activité</th><th></th></tr></thead><tbody>${st.map(u => row(u, false)).join('')}</tbody></table></div></div>`;
}

/* ================= E-commerçant présent dans plusieurs pays ================= */
function loadMarkets() {
  if (V.mBusy || !Remote.on) return; V.mBusy = true;
  Remote.call({ a: 'markets' }).then(r => { V.mBusy = false; V.markets = r.ok ? r.markets : []; render(); }).catch(() => { V.mBusy = false; V.markets = []; });
}
// Barre en haut de l'espace e-commerçant : un clic pour passer d'un pays à l'autre.
function marketBar() {
  if (!Remote.on) return '';
  if (!V.markets) { loadMarkets(); return ''; }
  const others = V.markets.filter(x => !x.here && COUNTRIES[x.c]);
  return `<div class="chips" style="margin-bottom:12px"><span class="chip on">${flag(CC)}${esc(PAYS.name)}</span>${others.map(x => `<button class="chip" data-a="market-go" data-id="${x.c}">${flag(x.c)}${esc(COUNTRIES[x.c].name)} <small>${x.run} en cours</small></button>`).join('')}
    ${Object.keys(COUNTRIES).length > V.markets.length ? `<button class="chip" data-a="market-add">${ico('plus')} Ajouter un pays</button>` : ''}</div>`;
}
function marketsCard() {
  if (!Remote.on || !V.markets || V.markets.length < 2) return '';
  return `<div class="section"><h3>Mes marchés</h3><div class="card">${V.markets.filter(x => COUNTRIES[x.c]).map(x => `<div class="list-row">${flag(x.c)}<div class="grow"><b>${esc(COUNTRIES[x.c].name)}</b><small>${esc(x.shop)} · ${x.run} commande(s) en cours · ${x.liv} livrée(s) aujourd'hui</small></div>
    ${x.here ? '<span class="badge st-ok">Vous êtes ici</span>' : `<button class="btn sm primary" data-a="market-go" data-id="${x.c}">Ouvrir</button>`}</div>`).join('')}</div></div>`;
}

/* ================= Notifications sur le téléphone, même app fermée ================= */
const b64Bytes = t => Uint8Array.from(atob(String(t).replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
async function pushSetup() {
  if (!Remote.on || !U || U.preview || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready; let sub = await reg.pushManager.getSubscription();
    if (!sub) { const r = await Remote.call({ a: 'pushkey' }); if (!r.ok || !r.key) return; sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64Bytes(r.key) }); }
    V.pushE = sub.endpoint; const tag = U.id + '|' + sub.endpoint;
    if (localStorage.getItem(LS('wassi.push')) !== tag) { const r = await Remote.call({ a: 'subscribe', e: sub.endpoint }); if (r.ok) localStorage.setItem(LS('wassi.push'), tag); }
  } catch (e) {}
}
function pushOff() {                             // à la déconnexion : ce téléphone ne reçoit plus les notifications de ce compte
  if (Remote.on && V.pushE) Remote.call({ a: 'unsubscribe', e: V.pushE }).catch(() => {});
  localStorage.removeItem(LS('wassi.push'));
}
function pushHint() {
  if (!('Notification' in window) || Notification.permission === 'granted') return '';
  return `<div class="insight" style="margin-bottom:10px">${ico('bell')}<div style="flex:1">${Notification.permission === 'denied' ? 'Les notifications sont bloquées pour cette app. Autorisez-les dans les réglages du téléphone pour être prévenu même quand l\'app est fermée.' : 'Activez les notifications pour être prévenu avec une sonnerie, même quand l\'app est fermée.'}</div>
    ${Notification.permission === 'denied' ? '' : '<button class="btn sm primary" data-a="notif-on">Activer</button>'}</div>`;
}

Object.assign(A, {
  eye: (d, el) => { const i = el.parentElement.querySelector('input'); if (!i) return; i.type = i.type === 'password' ? 'text' : 'password'; el.classList.toggle('on', i.type === 'text'); i.focus(); },
  'shop-del': d => { const s = S.shops.find(x => x.id === d.id); if (!s || U.role !== 'ceo') return;
    const bal = balance(s.name), run = S.orders.filter(o => o.shop === s.name && !CLOSED.includes(o.status)).length, pcsN = sum(S.stock.filter(i => i.shop === s.name), i => i.qty) + sum(S.takes.filter(t => t.shop === s.name), t => t.qty);
    V.modal = { t: 'html', title: 'Supprimer ' + s.name + ' ?', html: () => `<p style="color:var(--ink-2);margin-bottom:12px">La boutique disparaît de l'application, son e-commerçant est déconnecté et ne pourra plus se connecter, et son Google Sheet n'est plus lu. L'historique de ses livraisons reste dans vos chiffres.</p>
      ${bal ? `<div class="insight alert" style="margin-bottom:8px">${ico('alert')}<div>Son solde est de <b>${F(bal)}</b>. Pensez à le régler avant de supprimer.</div></div>` : ''}
      ${pcsN > 0 ? `<div class="insight alert" style="margin-bottom:8px">${ico('alert')}<div>Il reste <b>${pcsN} pièce(s)</b> de son stock chez Wassi. Elles seront retirées de l'app.</div></div>` : ''}
      ${run ? `<div class="insight alert" style="margin-bottom:8px">${ico('alert')}<div><b>${run} commande(s) en cours</b> seront annulées.</div></div>` : ''}
      <div class="actions fill" style="margin-top:14px"><button class="btn line" data-a="close">Annuler</button><button class="btn danger" data-a="shop-del-ok" data-id="${esc(s.id)}">Supprimer définitivement</button></div>` }; renderModal(); },
  'shop-del-ok': d => { const s = S.shops.find(x => x.id === d.id); if (!s || U.role !== 'ceo') return; const at = Date.now();
    S.orders.filter(o => o.shop === s.name && !CLOSED.includes(o.status)).forEach(o => { if (o.driver) notify({ toUser: o.driver, title: 'Livraison retirée', text: `${o.client} · ${o.product} : boutique supprimée.`, orderId: o.id });
      release(o); o.status = 'annule'; o.driver = null; o.reason = 'Boutique supprimée'; o.updatedAt = at; o.history.push({ at, by: U.name, text: 'Annulée : boutique supprimée' }); Remote.push({ t: 'order', o }); });
    S.users = S.users.filter(u => !(u.role === 'marchand' && u.shop === s.name)); S.stock = S.stock.filter(i => i.shop !== s.name); S.dispatch = S.dispatch.filter(x => x.shop !== s.name); S.shops = S.shops.filter(x => x.id !== s.id);
    V.sub = null; V.modal = null; renderModal(); blob('stock', 'dispatch'); syncCfg(); toast('Boutique supprimée', s.name + ' n\'a plus accès à l\'application.'); },
  'fee-ok': d => { const o = order(d.id); if (!o || !MONEY()) return; o.feeSet = true; commit(o, 'Frais validés : ' + F(wfee(o))); },
  'fee-all': () => { const l = feePending(); if (!MONEY() || !l.length || !confirm(`Valider les frais proposés pour ${l.length} livraison(s) ?`)) return;
    l.forEach(o => { o.feeSet = true; o.history.push({ at: Date.now(), by: U.name, text: 'Frais validés : ' + F(wfee(o)) }); o.updatedAt = Date.now(); Remote.push({ t: 'order', o }); }); persist(); render(); toast('Frais validés', l.length + ' livraison(s) ajoutée(s) aux soldes des boutiques.'); },
  'disp-auto': () => { const clos = byRole('closeuse'); if (!clos.length) return toast('Aucune closeuse', 'Ajoutez d\'abord les closeuses dans Réglages.');
    const cnt = n => S.orders.filter(o => o.shop === n && o.status === 'nouveau').length; V.disp = {};
    S.shops.slice().sort((a, b) => cnt(b.name) - cnt(a.name) || a.name.localeCompare(b.name)).forEach((s, i) => { V.disp[s.name] = clos[i % clos.length].id; }); render(); },
  'disp-clear': () => { V.disp = {}; render(); },
  'disp-send': () => { const d = V.disp || {};
    S.dispatch = S.shops.filter(s => d[s.name] && user(d[s.name])).map(s => ({ shop: s.name, closer: d[s.name], day: today(), by: U.name }));
    byRole('closeuse').forEach(c => { const l = S.dispatch.filter(x => x.closer === c.id).map(x => x.shop);
      notify({ toUser: c.id, title: 'Votre répartition du jour', text: l.length ? `Vos boutiques aujourd'hui : ${l.join(', ')}. Traitez uniquement leurs commandes.` : 'Aucune boutique ne vous est attribuée pour le moment.' }); });
    V.disp = null; save('dispatch'); toast('Répartition envoyée', 'Chaque closeuse a reçu la liste de ses boutiques.'); },
  'notif-on': () => { Notification.requestPermission().then(p => { if (p === 'granted') { pushSetup(); toast('Notifications activées', 'Vous serez prévenu même quand l\'app est fermée.'); } renderModal(); }).catch(() => {}); },
  'market-go': async d => {
    if (!COUNTRIES[d.id]) return; toast('Changement de pays', 'Ouverture de ' + COUNTRIES[d.id].name + '…');
    try {
      const r = await Remote.call({ a: 'switch', to: d.id }); if (!r.ok) return toast('Impossible', 'Vous n\'avez pas encore de compte dans ce pays.');
      const sfx = d.id === 'ne' ? '' : '.' + d.id; let st = null; try { st = JSON.parse(localStorage.getItem('wassi.remote' + sfx)); } catch (e) {}
      if (!st || st.v !== 1) st = { v: 1, users: [], shops: [], orders: [], notifs: [] };
      st.users = (st.users || []).filter(u => u.id !== r.user.id).concat([r.user]); st.orders = [];
      localStorage.setItem('wassi.remote' + sfx, JSON.stringify(st)); localStorage.setItem('wassi.token' + sfx, r.token); localStorage.setItem('wassi.user' + sfx, r.user.id); localStorage.removeItem('wassi.since' + sfx);
      localStorage.setItem('wassi.country', d.id); location.reload();
    } catch (e) { toast('Connexion impossible', 'Vérifiez votre connexion internet.'); }
  },
  'market-add': () => { const have = (V.markets || []).map(x => x.c), opts = Object.entries(COUNTRIES).filter(([k]) => !have.includes(k)).map(([k, c]) => [k, c.name]);
    if (!opts.length) return toast('Déjà partout', 'Vous êtes présent dans tous les pays.');
    form('Ouvrir un nouveau pays', [{ k: 'to', l: 'Pays', opts }, { k: 'sheet', l: 'Lien du Google Sheet des commandes de ce pays', ph: 'https://docs.google.com/spreadsheets/d/…' }],
      v => { Remote.call({ a: 'market-add', to: v.to, sheet: v.sheet.trim() }).then(r => { if (r.ok) { V.markets = null; toast('Marché ouvert', COUNTRIES[v.to].name + ' est ajouté. Même e-mail, même mot de passe.'); render(); }
        else toast('Impossible', r.error === 'exists' ? 'Vous avez déjà un compte dans ce pays.' : r.error === 'shop' ? 'Une boutique du même nom existe déjà dans ce pays. Contactez Wassi Delivery.' : 'Ce pays n\'est pas encore disponible.'); })
        .catch(() => toast('Connexion impossible', 'Vérifiez votre connexion internet.')); },
      { note: 'Partagez ce Google Sheet avec le compte Google de Wassi Delivery (droit Éditeur). Les nouvelles commandes arriveront automatiquement dans ce pays. Essai gratuit de 30 jours.', ok: 'Ouvrir ce pays' }); }
});
