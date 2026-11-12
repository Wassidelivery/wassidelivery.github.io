/**
 * WASSI DELIVERY — serveur gratuit dans Google Sheets (Google Apps Script).
 *
 * Rôle : relier tous les téléphones entre eux, garder les comptes (e-mail + mot de passe),
 * lire les nouvelles commandes dans le Google Sheet de chaque e-commerçant et y réécrire
 * le statut et le nom du livreur.
 *
 * MISE EN PLACE (une seule fois, environ 10 minutes)
 *  1. Créez un Google Sheet vide nommé « WASSI HUB » avec le compte Google de Wassi.
 *  2. Menu Extensions > Apps Script. Effacez tout, collez ce fichier, enregistrez.
 *  3. Choisissez la fonction « setup » puis Exécuter, et acceptez les autorisations.
 *     Cinq onglets sont créés : Commandes, Utilisateurs, Boutiques, Notifs, Données.
 *     Un Google Sheet « WASSI HUB — <pays> » est aussi créé pour chaque autre pays (Côte d'Ivoire, Bénin, Gabon).
 *     Le compte CEO est créé avec l'adresse du compte Google utilisé ; son mot de passe
 *     provisoire est écrit dans l'onglet Utilisateurs, colonne « pass » : changez-le
 *     ensuite dans l'app (Réglages > Mon compte).
 *  4. Déployer > Nouveau déploiement > Application Web.
 *     Exécuter en tant que : Moi.  Accès : Tout le monde.  Copiez l'adresse (…/exec).
 *  5. Dans l'app : espace CEO > Réglages > collez l'adresse > Enregistrer, puis
 *     Réglages > Importer pour envoyer vos données sur le serveur.
 *  6. Chaque e-commerçant partage son Google Sheet avec le compte Google de Wassi
 *     (droit « Éditeur »). Dans l'app : Boutiques > fiche de la boutique > Lier le Google Sheet.
 *
 * Le Sheet d'un e-commerçant doit avoir une ligne de titres. Les colonnes sont
 * reconnues par leur nom : Nom/Client, Téléphone/Numéro, Produit, Prix/Montant,
 * Quartier/Adresse/Lieu, Quantité, Sexe. Les colonnes « Statut Wassi » et
 * « Livreur Wassi » sont ajoutées automatiquement.
 */

const TAB = { orders: 'Commandes', users: 'Utilisateurs', shops: 'Boutiques', notifs: 'Notifs', data: 'Données' };
const HEAD = {
  orders: ['id', 'shop', 'status', 'createdAt', 'updatedAt', 'json'],
  users: ['id', 'name', 'role', 'email', 'pass', 'ph', 'shop', 'json'],
  shops: ['id', 'name', 'sheetId', 'plan', 'trialEnd', 'lastRow', 'json'],
  notifs: ['id', 'at', 'json'],
  data: ['k', 'json']
};
const STATUS_LABEL = { nouveau: 'Nouveau', confirme: 'Confirmé', assigne: 'En livraison', livre_livreur: 'En livraison',
  livre: 'Livré', reporte: 'Reporté', injoignable: 'Injoignable', annule: 'Annulé' };
const DAY = 864e5;
const CHUNK = 40000;                             // une cellule Google Sheets contient 50 000 caractères au maximum
const STAFF = ['ceo', 'assistante', 'closeuse', 'livreur'];
// Qui a le droit de remplacer chaque liste.
const BLOBS = { stock: STAFF, takes: STAFF, moves: ['ceo', 'assistante'], goals: ['ceo'], charges: ['ceo'] };

// Un Google Sheet par pays. Celui du Niger est le « WASSI HUB » d'origine ; ceux des autres pays sont
// créés par la fonction setup, qui garde leur identifiant dans les propriétés du script.
const HUB_ID = '1Z31xZ6i3K28adEzrne8omfiCavNmGURlcW2kMmgSLLg';
const COUNTRY_NAMES = { ne: 'Niger', ci: "Côte d'Ivoire", bj: 'Bénin', ga: 'Gabon' };
let CC = 'ne';                                    // pays de l'appel en cours
const BOOKS = {};
function hubId(c) { return c === 'ne' && HUB_ID ? HUB_ID : PropertiesService.getScriptProperties().getProperty('hub_' + c); }
function book() {
  if (!BOOKS[CC]) { const id = hubId(CC); if (!id) throw new Error('pays'); BOOKS[CC] = SpreadsheetApp.openById(id); }
  return BOOKS[CC];
}
function eachCountry(fn) {                        // exécute fn pour chaque pays installé, puis revient au pays de départ
  const back = CC;
  try { Object.keys(COUNTRY_NAMES).forEach(function (c) { if (!hubId(c)) return; CC = c; ORDER_ROWS = null; fn(c); }); }
  finally { CC = back; ORDER_ROWS = null; }
}
function tab(k) { return book().getSheetByName(TAB[k]); }
function rows(k) {
  const sh = tab(k), n = sh.getLastRow();
  if (n < 2) return [];
  const h = HEAD[k];
  return sh.getRange(2, 1, n - 1, h.length).getValues().map(function (r, i) {
    const o = { _row: i + 2 }; h.forEach(function (c, j) { o[c] = r[j]; }); return o;
  });
}
function parse(s, d) { try { const v = JSON.parse(s); return v == null ? d : v; } catch (e) { return d; } }
function sha(s) {
  return 's' + Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'wassi:' + s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function code() { return String(Math.floor(100000 + Math.random() * 900000)); }

function setup() {
  const props = PropertiesService.getScriptProperties();
  Object.keys(COUNTRY_NAMES).forEach(function (c) {
    if (!hubId(c)) props.setProperty('hub_' + c, SpreadsheetApp.create('WASSI HUB — ' + COUNTRY_NAMES[c]).getId());
  });
  eachCountry(function () {
    const ss = book();
    Object.keys(TAB).forEach(function (k) {
      const sh = ss.getSheetByName(TAB[k]) || ss.insertSheet(TAB[k]);
      sh.getRange(1, 1, 1, HEAD[k].length).setValues([HEAD[k]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    });
    tab('users').getRange('E:E').setNumberFormat('@');           // les codes restent du texte
    tab('data').getRange('B:B').setNumberFormat('@');
  });
  CC = 'ne';
  if (!rows('users').length) {
    const mail = Session.getEffectiveUser().getEmail() || 'ceo@wassi.app';
    tab('users').appendRow(['u_ceo', 'CEO', 'ceo', mail.toLowerCase(), code(), '', '', '{}']);
  }
  // Le compte du CEO est le même dans tous les pays : il est recopié dans les Sheets qui n'ont encore aucun compte.
  const ceos = rows('users').filter(function (u) { return String(u.role) === 'ceo'; });
  eachCountry(function (c) {
    if (c === 'ne' || rows('users').length) return;
    ceos.forEach(function (u) { tab('users').appendRow(HEAD.users.map(function (k) { return u[k]; })); });
  });
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'importAll') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('importAll').timeBased().everyMinutes(1).create();
}

/* ---------- Utilisateurs et boutiques : ligne du tableur <-> objet de l'app ---------- */
const U_COLS = ['id', 'name', 'role', 'email', 'pass', 'ph', 'shop'];
function userObj(r) {
  const x = parse(r.json, {});
  x.id = String(r.id); x.name = String(r.name); x.role = String(r.role); x.email = String(r.email || '').toLowerCase();
  if (r.pass !== '' && r.pass != null) x.pass = String(r.pass);
  if (r.ph) x.ph = String(r.ph);
  if (r.shop) x.shop = String(r.shop);
  return x;
}
function userRow(u) {
  const x = {}; Object.keys(u).forEach(function (k) { if (U_COLS.indexOf(k) < 0 && k !== '_row') x[k] = u[k]; });
  return [u.id, u.name, u.role, String(u.email || '').toLowerCase(), u.pass || '', /^s[0-9a-f]{64}$/.test(u.ph || '') ? u.ph : '', u.shop || '', JSON.stringify(x)];
}
function users() { return rows('users').map(userObj); }
function pub(u) { return { id: u.id, name: u.name, role: u.role, shop: u.shop || '', free: !!u.free, gone: !!u.gone, status: u.status || undefined, salary: u.salary || 0 }; }
function shopObj(r) {
  const x = parse(r.json, {});
  x.id = String(r.id); x.name = String(r.name); x.sheetId = String(r.sheetId || ''); x.plan = String(r.plan || 'essai'); x.trialEnd = Number(r.trialEnd) || 0;
  return x;
}
// Les listes (stock, passages, caisse…) sont enregistrées en JSON, découpé sur plusieurs lignes quand il est long.
function blobs() {
  const parts = {}; rows('data').forEach(function (r) { parts[r.k] = (parts[r.k] || '') + String(r.json); });
  const o = {}; Object.keys(parts).forEach(function (k) { o[k] = parse(parts[k], null); });
  return o;
}
function setBlob(k, v) {
  const keep = rows('data').filter(function (r) { return r.k !== k; }).map(function (r) { return [r.k, String(r.json)]; }), s = JSON.stringify(v);
  for (let i = 0; i === 0 || i < s.length; i += CHUNK) keep.push([k, s.slice(i, i + CHUNK)]);
  replace('data', keep);
  tab('data').getRange('B:B').setNumberFormat('@');
}

/* ---------- Entrée de l'application ---------- */
function doGet() { return out({ ok: true, app: 'WASSI DELIVERY' }); }
function doPost(e) {
  let b; try { b = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'json' }); }
  CC = COUNTRY_NAMES[b.c] ? b.c : 'ne'; ORDER_ROWS = null;
  if (!hubId(CC)) return out({ ok: false, error: 'pays' });
  try {
    if (b.a === 'login') return out(login(b));
    if (b.a === 'signup') return out(locked(function () { return signup(b); }));
    const me = auth(b.token);
    if (!me) return out({ ok: false, error: 'auth' });
    if (b.a === 'state') { const now = Date.now(); return out({ ok: true, now: now, state: state(me, Number(b.since) || 0) }); }
    if (b.a === 'pass') return out(locked(function () { return changePass(me, b); }));
    if (b.a === 'ops') return out(locked(function () { (b.ops || []).forEach(function (op) { apply(op, me); }); return { ok: true }; }));
    return out({ ok: false, error: 'action' });
  } catch (err) { return out({ ok: false, error: String(err) }); }
}
function locked(fn) { const lock = LockService.getScriptLock(); lock.waitLock(20000); try { return fn(); } finally { lock.releaseLock(); } }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ---------- Connexion et comptes ---------- */
function okPass(u, p) { return u.ph ? u.ph === sha(p) : (!!u.pass && String(u.pass) === String(p)); }
function token(u) {
  const t = Utilities.getUuid() + Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('tok_' + t, CC + '|' + u.id);
  return t;
}
function login(b) {
  const email = String(b.email || '').trim().toLowerCase(), props = PropertiesService.getScriptProperties(), key = 'fail_' + CC + '_' + email;
  const fails = parse(props.getProperty(key), { n: 0, at: 0 });
  if (fails.n >= 5 && Date.now() - fails.at < 10 * 60000) return { ok: false, error: 'locked' };
  const u = users().filter(function (x) { return x.email && x.email === email; })[0];
  if (!u || u.gone || !okPass(u, b.pass)) {
    props.setProperty(key, JSON.stringify({ n: fails.n + 1, at: Date.now() }));
    return { ok: false, error: 'pass' };
  }
  if (u.status === 'pending') return { ok: false, error: 'pending' };
  props.deleteProperty(key);
  return { ok: true, token: token(u), user: pub(u) };
}
function auth(t) {
  if (!t) return null;
  const v = PropertiesService.getScriptProperties().getProperty('tok_' + t);
  if (!v) return null;
  // Un jeton n'est valable que dans le pays où la personne s'est connectée.
  const parts = v.indexOf('|') < 0 ? ['ne', v] : [v.slice(0, v.indexOf('|')), v.slice(v.indexOf('|') + 1)], id = parts[1];
  if (parts[0] !== CC) return null;
  const u = users().filter(function (x) { return x.id === id; })[0];
  return u && !u.gone && u.status !== 'pending' ? u : null;      // un membre retiré est déconnecté tout de suite
}
function signup(b) {
  const email = String(b.email || '').trim().toLowerCase(), role = String(b.role || ''), name = String(b.name || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !name || ['marchand', 'closeuse', 'livreur', 'assistante'].indexOf(role) < 0) return { ok: false, error: 'form' };
  if (users().some(function (x) { return x.email === email; })) return { ok: false, error: 'email' };
  const u = { id: 'u_' + Utilities.getUuid().slice(0, 10), name: name, role: role, email: email, phone: String(b.phone || ''), createdAt: Date.now() };
  let known = null;
  if (role === 'marchand') {
    const shop = String(b.shop || '').trim().toUpperCase();
    if (!shop || String(b.pass || '').length < 6) return { ok: false, error: 'form' };
    known = rows('shops').filter(function (s) { return String(s.name).toUpperCase() === shop; })[0];
    u.shop = known ? String(known.name) : shop; u.contact = name; u.name = u.shop; u.ph = sha(b.pass);
    if (!known) tab('shops').appendRow(['s_' + Utilities.getUuid().slice(0, 8), shop, '', 'essai', Date.now() + 30 * DAY, 0, JSON.stringify({ phone: u.phone })]);
  }
  if (role !== 'marchand' || known) u.status = 'pending';       // l'équipe et les boutiques déjà suivies sont validées par le CEO
  tab('users').appendRow(userRow(u));
  const n = { id: 'n' + Utilities.getUuid().slice(0, 12), at: Date.now(), by: u.id, toRole: 'ceo', title: u.status ? 'Demande de compte' : 'Nouvelle boutique inscrite',
    text: name + ' · ' + role + (u.shop ? ' · ' + u.shop : '') };
  tab('notifs').appendRow([n.id, n.at, JSON.stringify(n)]);
  return u.status ? { ok: true } : { ok: true, token: token(u), user: pub(u) };
}
function changePass(me, b) {
  if (!okPass(me, b.old) || String(b.pass || '').length < 6) return { ok: false, error: 'pass' };
  const ph = sha(b.pass), write = function (u) {
    const r = rows('users').filter(function (x) { return String(x.id) === u.id; })[0];
    u.ph = ph; delete u.pass; tab('users').getRange(r._row, 1, 1, HEAD.users.length).setValues([userRow(u)]);
  };
  // Le CEO garde un seul mot de passe pour tous les pays.
  if (me.role === 'ceo') eachCountry(function () { users().filter(function (u) { return u.role === 'ceo' && u.email === me.email; }).forEach(write); });
  else write(me);
  return { ok: true };
}

/* ---------- Lecture de l'état ---------- */
function state(me, since) {
  const isShop = me.role === 'marchand', ceo = me.role === 'ceo', own = function (x) { return !isShop || x.shop === me.shop; };
  // Seules les commandes modifiées depuis la dernière lecture sont renvoyées.
  let orders = changedOrders(since).filter(own);
  if (me.role === 'livreur') orders = orders.filter(function (o) { return o.driver === me.id; });
  const notifs = rows('notifs').slice(-300).map(function (r) { return parse(r.json, null); }).filter(function (n) {
    return n && (n.toUser === me.id || (n.toRole === me.role && (!n.shop || n.shop === me.shop))); });
  const us = users().filter(function (u) { return !isShop || u.role !== 'marchand' || u.shop === me.shop; }).map(function (u) { return ceo || u.id === me.id ? u : pub(u); });
  const shops = rows('shops').map(shopObj).filter(function (s) { return !isShop || s.name === me.shop; }).map(function (s) {
    if (!ceo && me.role !== 'assistante') s.sheetId = s.sheetId ? '1' : ''; return s; });
  const d = blobs(), money = ceo || me.role === 'assistante';
  return { v: 1, users: us, shops: shops, orders: orders, notifs: notifs,
    stock: (d.stock || []).filter(own), takes: (d.takes || []).filter(own),
    moves: (d.moves || []).filter(function (m) { return money || (isShop && m.shop === me.shop); }),
    goals: ceo ? (d.goals || []) : [], charges: ceo ? (d.charges || []) : [], pos: d.pos || {} };
}

/* ---------- Écriture ---------- */
function changedOrders(since) {
  const sh = tab('orders'), n = sh.getLastRow(); if (n < 2) return [];
  const at = sh.getRange(2, 5, n - 1, 1).getValues(), hit = [];
  for (let i = 0; i < at.length; i++) if (Number(at[i][0]) > since) hit.push(i);
  if (!hit.length) return [];
  const first = hit[0], json = sh.getRange(first + 2, 6, hit[hit.length - 1] - first + 1, 1).getValues();
  return hit.map(function (i) { return parse(json[i - first][0], null); }).filter(Boolean);
}
// Numéro de ligne de chaque commande, lu une seule fois par appel.
let ORDER_ROWS = null;
function orderRows() {
  if (ORDER_ROWS) return ORDER_ROWS;
  ORDER_ROWS = {}; const sh = tab('orders'), n = sh.getLastRow();
  if (n > 1) sh.getRange(2, 1, n - 1, 1).getValues().forEach(function (r, i) { ORDER_ROWS[String(r[0])] = i + 2; });
  return ORDER_ROWS;
}

function apply(op, me) {
  const staff = STAFF.indexOf(me.role) >= 0;
  if (op.t === 'notif' && op.n && staff) {
    tab('notifs').appendRow([op.n.id, op.n.at, JSON.stringify(op.n)]);
  } else if (op.t === 'order' && op.o && staff) {
    saveOrder(op.o, me);
  } else if (op.t === 'set' && BLOBS[op.k] && BLOBS[op.k].indexOf(me.role) >= 0 && Array.isArray(op.v)) {
    setBlob(op.k, op.v);
  } else if (op.t === 'pos' && me.role === 'livreur' && op.id === me.id) {
    const pos = blobs().pos || {}; if (op.p) pos[me.id] = op.p; else delete pos[me.id]; setBlob('pos', pos);
  } else if (op.t === 'users' && me.role === 'ceo') {
    saveUsers(op.users);
  } else if (op.t === 'shops' && (me.role === 'ceo' || me.role === 'assistante')) {
    saveShops(op.shops);
  } else if (op.t === 'import' && me.role === 'ceo' && op.state) {
    const s = op.state, now = Date.now();
    ORDER_ROWS = null;
    replace('orders', (s.orders || []).map(function (o) { return [o.id, o.shop, o.status, o.createdAt, now, JSON.stringify(o)]; }));
    saveShops(s.shops || []);
    const keep = users().filter(function (u) { return u.role === 'ceo'; }), ids = {}; keep.forEach(function (u) { ids[u.id] = 1; });
    saveUsers(keep.concat((s.users || []).filter(function (u) { return u.role !== 'ceo' && !ids[u.id]; })));
    Object.keys(BLOBS).forEach(function (k) { setBlob(k, s[k] || []); });
    replace('notifs', []);
  }
}
function saveUsers(list) {
  // Le mot de passe personnel d'un e-commerçant ou du CEO n'est jamais effacé par une mise à jour de la liste.
  const old = {}; users().forEach(function (u) { old[u.id] = u; });
  replace('users', list.map(function (u) { const o = old[u.id]; if (o && o.ph && !u.pass) u.ph = o.ph; return userRow(u); }));
  tab('users').getRange('E:E').setNumberFormat('@');
}
function saveShops(list) {
  const old = {}; rows('shops').forEach(function (s) { old[s.id] = s; });
  replace('shops', list.map(function (s) {
    const o = old[s.id] || {}, x = {}; Object.keys(s).forEach(function (k) { if (['id', 'name', 'sheetId', 'plan', 'trialEnd'].indexOf(k) < 0) x[k] = s[k]; });
    const sheet = s.sheetId === '1' ? (o.sheetId || '') : (s.sheetId || '');
    return [s.id, s.name, sheet, s.plan || 'essai', s.trialEnd || 0, o.sheetId === sheet ? (o.lastRow || 1) : 0, JSON.stringify(x)];
  }));
}
function replace(k, data) {
  const sh = tab(k), n = sh.getLastRow();
  if (n > 1) sh.getRange(2, 1, n - 1, HEAD[k].length).clearContent();
  if (data.length) sh.getRange(2, 1, data.length, HEAD[k].length).setValues(data);
}
function saveOrder(o, me) {
  const idx = orderRows(), sh = tab('orders'), row = idx[String(o.id)];
  const prev = row ? parse(sh.getRange(row, 6).getValue(), {}) : null;
  // Un livreur ne peut toucher qu'aux commandes qui lui sont confiées.
  if (me.role === 'livreur' && !(prev && prev.driver === me.id)) return;
  if (!prev && me.role !== 'ceo' && me.role !== 'closeuse') return;   // saisie à la main : CEO et closeuses seulement
  const line = [o.id, o.shop, o.status, o.createdAt, Date.now(), JSON.stringify(o)];
  if (row) sh.getRange(row, 1, 1, line.length).setValues([line]);
  else { sh.appendRow(line); idx[String(o.id)] = sh.getLastRow(); }
  if (!prev || prev.status !== o.status || prev.driver !== o.driver) writeBack(o);
}

/* ---------- Google Sheets des e-commerçants ---------- */
function col(headers, re, not) {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i]).toLowerCase();
    if (re.test(h) && !(not && not.test(h))) return i;
  }
  return -1;
}
function merchantSheet(shop) {
  const ss = SpreadsheetApp.openById(String(shop.sheetId));
  return ss.getSheets()[0];
}
function ensureCol(sh, name) {
  const last = Math.max(1, sh.getLastColumn());
  const h = sh.getRange(1, 1, 1, last).getValues()[0];
  const i = h.indexOf(name);
  if (i >= 0) return i + 1;
  sh.getRange(1, last + 1).setValue(name).setFontWeight('bold');
  return last + 1;
}
function writeBack(o) {
  if (!o.sheetRow) return;
  const shop = rows('shops').filter(function (s) { return s.name === o.shop; })[0];
  if (!shop || !shop.sheetId) return;
  try {
    const sh = merchantSheet(shop);
    sh.getRange(o.sheetRow, ensureCol(sh, 'Statut Wassi')).setValue(STATUS_LABEL[o.status] || o.status);
    const drv = rows('users').filter(function (u) { return String(u.id) === String(o.driver); })[0];
    sh.getRange(o.sheetRow, ensureCol(sh, 'Livreur Wassi')).setValue(drv ? drv.name : '');
  } catch (err) { console.error('writeBack ' + o.shop + ' : ' + err); }
}

/**
 * Lancé chaque minute : récupère les nouvelles lignes de chaque boutique.
 * Pour rester dans les limites gratuites de Google, seuls les Sheets modifiés depuis le dernier
 * passage sont ouverts ; tous sont revérifiés toutes les 10 minutes par sécurité.
 */
function importAll() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const props = PropertiesService.getScriptProperties(), now = Date.now(), start = now;
    const last = Number(props.getProperty('imp_at')) || 0, full = Number(props.getProperty('imp_full')) || 0;
    let changed = null;                                              // null = tout vérifier
    if (last && now - full < 10 * 60000) {
      try {
        changed = {};
        const q = 'modifiedDate > "' + new Date(last - 90000).toISOString().slice(0, 19) + '" and mimeType = "application/vnd.google-apps.spreadsheet"';
        const it = DriveApp.searchFiles(q); while (it.hasNext()) changed[it.next().getId()] = 1;
      } catch (err) { changed = null; }
    }
    if (!changed) props.setProperty('imp_full', String(now));
    props.setProperty('imp_at', String(now));
    eachCountry(function () {
      const shops = rows('shops').filter(function (shop) { return shop.sheetId && (!changed || changed[String(shop.sheetId)]); });
      if (shops.length) {
        let next = tab('orders').getLastRow() + 1000;
        shops.forEach(function (shop) {
          if (Date.now() - start > 40000) return;                     // on reprendra au prochain passage
          try { next = importShop(shop, next); } catch (err) { console.error('import ' + shop.name + ' : ' + err); }
        });
      }
      if (!changed) { const nn = tab('notifs').getLastRow(); if (nn > 700) tab('notifs').deleteRows(2, nn - 400); }   // on ne garde que les notifications récentes
    });
  } finally { lock.releaseLock(); }
}
function importShop(shop, next) {
  const sh = merchantSheet(shop), last = sh.getLastRow(), from = Math.max(2, Number(shop.lastRow || 1) + 1);
  if (last < from) return next;
  const w = sh.getLastColumn(), h = sh.getRange(1, 1, 1, w).getValues()[0];
  const c = {
    product: col(h, /produit|product|article/), client: col(h, /nom|client|name/, /produit|product|article/),
    phone: col(h, /t[ée]l|num[ée]ro|phone|contact|whatsapp/), price: col(h, /prix|montant|total|price/),
    zone: col(h, /quartier|adresse|lieu|zone|ville|address/), qty: col(h, /quantit|qt[ée]|qty/), sexe: col(h, /sexe|genre/)
  };
  const data = sh.getRange(from, 1, last - from + 1, w).getValues(), now = Date.now(), orders = [], notifs = [];
  data.forEach(function (r, i) {
    const get = function (k) { return c[k] >= 0 ? String(r[c[k]]).trim() : ''; };
    if (!get('client') && !get('phone')) return;                     // ligne vide
    const sx = get('sexe').charAt(0).toUpperCase(), id = 'o' + Utilities.getUuid().slice(0, 12);
    const o = { id: id, ref: 'W' + (next++), shop: String(shop.name), client: get('client') || 'Client', phone: get('phone'),
      sexe: sx === 'F' ? 'F' : (sx === 'H' || sx === 'M') ? 'H' : '', product: get('product') || 'Produit',
      qty: parseInt(get('qty'), 10) || 1, price: parseInt(get('price').replace(/[^0-9]/g, ''), 10) || 0,
      zone: get('zone') || 'À préciser', fee: 1500, feeExp: 0, agence: '', note: '', status: 'nouveau', driver: null, closer: null,
      createdAt: now, transferred: false, sheetRow: from + i, history: [{ at: now, by: 'Google Sheet', text: 'Commande reçue' }] };
    orders.push([o.id, o.shop, o.status, o.createdAt, now, JSON.stringify(o)]);
    const n = { id: 'n' + Utilities.getUuid().slice(0, 12), at: now, by: 'sheet', toRole: 'closeuse',
      title: 'Nouvelle commande pour ' + shop.name, text: o.client + ' · ' + o.product + ' · ' + o.zone, orderId: o.id };
    notifs.push([n.id, n.at, JSON.stringify(n)]);
  });
  if (orders.length) {
    const so = tab('orders'), sn = tab('notifs');
    so.getRange(so.getLastRow() + 1, 1, orders.length, 6).setValues(orders);
    sn.getRange(sn.getLastRow() + 1, 1, notifs.length, 3).setValues(notifs);
  }
  tab('shops').getRange(shop._row, HEAD.shops.indexOf('lastRow') + 1).setValue(last);
  return next;
}
