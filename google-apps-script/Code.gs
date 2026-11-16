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
const BLOBS = { stock: STAFF, takes: STAFF, moves: ['ceo', 'assistante'], goals: ['ceo'], charges: ['ceo'], dispatch: ['ceo', 'assistante'] };

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
  vapidKeys();                                                   // clé des notifications sur téléphone
  UrlFetchApp.getRequest('https://fcm.googleapis.com/');           // demande dès maintenant l'autorisation d'envoyer les notifications
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
    if (b.a === 'pushkey') return out({ ok: true, key: vapidKeys().pub });
    if (b.a === 'pushget') return out({ ok: true, n: parse(CacheService.getScriptCache().get('pm_' + sha(String(b.e || ''))), null) });
    if (b.a === 'login') return out(login(b));
    if (b.a === 'signup') return out(locked(function () { return signup(b); }));
    const me = auth(b.token);
    if (!me) return out({ ok: false, error: 'auth' });
    if (b.a === 'state') {
      CacheService.getScriptCache().put('seen_' + CC + '_' + me.id, String(Date.now()), 21600);
      if (STAFF.indexOf(me.role) >= 0) quickImport();              // les commandes des Sheets arrivent sans attendre la minute suivante
      const now = Date.now(); return out({ ok: true, now: now, state: state(me, Number(b.since) || 0) });
    }
    if (b.a === 'subscribe') return out(locked(function () { return subscribe(me, b, true); }));
    if (b.a === 'unsubscribe') return out(locked(function () { return subscribe(me, b, false); }));
    if (b.a === 'markets') return out({ ok: true, markets: markets(me) });
    if (b.a === 'switch') return out(switchTo(me, b));
    if (b.a === 'market-add') return out(locked(function () { return marketAdd(me, b); }));
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
  u.lastLogin = Date.now(); writeUser(u);
  return { ok: true, token: token(u), user: pub(u) };
}
function writeUser(u) {
  const r = rows('users').filter(function (x) { return String(x.id) === u.id; })[0];
  if (r) tab('users').getRange(r._row, 1, 1, HEAD.users.length).setValues([userRow(u)]);
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
  // Le CEO et les e-commerçants gardent un seul mot de passe pour tous les pays.
  if (me.role === 'ceo' || me.role === 'marchand') eachCountry(function () { users().filter(function (u) { return u.role === me.role && u.email === me.email; }).forEach(write); });
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
    goals: ceo ? (d.goals || []) : [], charges: ceo ? (d.charges || []) : [], pos: d.pos || {},
    dispatch: isShop ? [] : (d.dispatch || []), seen: money ? seenMap(us) : {} };
}
// Dernière activité de chaque compte (gardée 6 heures), pour voir qui est connecté.
function seenMap(us) {
  const keys = us.map(function (u) { return 'seen_' + CC + '_' + u.id; }), got = CacheService.getScriptCache().getAll(keys), out = {};
  us.forEach(function (u, i) { if (got[keys[i]]) out[u.id] = Number(got[keys[i]]); });
  return out;
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
    pushNotif(op.n);
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
    // Les commandes passées dans l'app que l'envoi ne contient pas (arrivées entre-temps) sont gardées.
    const sent = {}; (s.orders || []).forEach(function (o) { sent[String(o.id)] = 1; });
    const extra = rows('orders').filter(function (r) { return !sent[String(r.id)] && !parse(r.json, {}).old; }).map(function (r) { return [r.id, r.shop, r.status, r.createdAt, now, r.json]; });
    replace('orders', (s.orders || []).map(function (o) { return [o.id, o.shop, o.status, o.createdAt, now, JSON.stringify(o)]; }).concat(extra));
    saveShops(s.shops || []);
    const keep = users().filter(function (u) { return u.role === 'ceo'; }), ids = {}; keep.forEach(function (u) { ids[u.id] = 1; });
    saveUsers(keep.concat((s.users || []).filter(function (u) { return u.role !== 'ceo' && !ids[u.id]; })));
    Object.keys(BLOBS).forEach(function (k) { setBlob(k, s[k] || []); });
  }
}
function saveUsers(list) {
  // Le mot de passe personnel d'un e-commerçant ou du CEO n'est jamais effacé par une mise à jour de la liste.
  const old = {}; users().forEach(function (u) { old[u.id] = u; });
  list.forEach(function (u) { const o = old[u.id]; if (o && o.ph && !u.pass) u.ph = o.ph; if (o && o.lastLogin) u.lastLogin = o.lastLogin; });
  // Un e-commerçant déjà inscrit dans un autre pays garde le même mot de passe ici.
  const need = list.filter(function (u) { return u.role === 'marchand' && u.email && !u.ph; });
  if (need.length) {
    const home = CC, found = {};
    eachCountry(function (c) { if (c !== home) users().forEach(function (x) { if (x.role === 'marchand' && x.ph && x.email) found[x.email] = x.ph; }); });
    need.forEach(function (u) { if (found[u.email]) { u.ph = found[u.email]; delete u.pass; } });
  }
  replace('users', list.map(userRow));
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
  if (me.role === 'closeuse' || me.role === 'livreur') {         // seuls les opérations et le CEO fixent les frais
    if (prev && prev.feeSet) { o.fee = prev.fee; o.feeExp = prev.feeExp; o.noClose = prev.noClose; o.feeSet = true; } else delete o.feeSet;
  }
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
 * Récupère les nouvelles lignes des Sheets des boutiques, en lisant chaque Sheet directement
 * (Google Drive signale les modifications avec plusieurs minutes de retard : on ne s'y fie plus).
 * · Dès qu'un membre de l'équipe a l'app ouverte : à chaque lecture de l'app, pour son pays (toutes les 12 secondes au plus).
 * · Sinon, chaque minute pour tous les pays (déclencheur) : c'est ce qui fait sonner les téléphones quand l'app est fermée.
 */
function quickImport() {
  const last = Number(PropertiesService.getScriptProperties().getProperty('imp_fast_' + CC)) || 0;
  if (Date.now() - last >= 12000) importAll(CC);
}
function linkedShops() { return rows('shops').filter(function (s) { return s.sheetId; }); }
function importAll(only) {
  only = typeof only === 'string' ? only : null;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(only ? 300 : 5000)) return;
  try {
    const props = PropertiesService.getScriptProperties(), start = Date.now();
    if (only) {
      props.setProperty('imp_fast_' + only, String(start));
      ORDER_ROWS = null; directImport('imp_cur_' + only, start, 5000); ORDER_ROWS = null;
      return;
    }
    eachCountry(function (c) {
      // L'équipe de ce pays a l'app ouverte : ses lectures s'occupent déjà des Sheets.
      if (start - (Number(props.getProperty('imp_fast_' + c)) || 0) < 90000) return;
      const shops = linkedShops(); if (!shops.length) return;
      if (!restImport(shops, 'imp_tcur_' + c)) directImport('imp_cur_' + c, start, 4000);
    });
    if (start - (Number(props.getProperty('imp_full')) || 0) > 600000) {         // ménage : on ne garde que les notifications récentes
      props.setProperty('imp_full', String(start));
      eachCountry(function () { const nn = tab('notifs').getLastRow(); if (nn > 700) tab('notifs').deleteRows(2, nn - 400); });
    }
  } finally { lock.releaseLock(); }
}
// Lecture directe, un Sheet après l'autre, en reprenant là où le passage précédent s'est arrêté.
function directImport(key, start, budget) {
  const props = PropertiesService.getScriptProperties(), shops = linkedShops(), n = shops.length; if (!n) return;
  const cur = (Number(props.getProperty(key)) || 0) % n; let next = tab('orders').getLastRow() + 1000, done = 0;
  for (; done < n && (done === 0 || Date.now() - start < budget); done++) {
    const shop = shops[(cur + done) % n];
    try { next = importShop(shop, next, null); } catch (err) { console.error('import ' + shop.name + ' : ' + err); }
  }
  props.setProperty(key, String((cur + done) % n));
}
// Lecture de plusieurs Sheets en même temps (API Google Sheets). Renvoie false si elle n'est pas disponible.
function restImport(shops, key) {
  const props = PropertiesService.getScriptProperties();
  if (Date.now() - (Number(props.getProperty('rest_off')) || 0) < 6 * 3600000) return false;
  const n = shops.length, cur = (Number(props.getProperty(key)) || 0) % n, pick = [];
  for (let i = 0; i < Math.min(n, 15); i++) pick.push(shops[(cur + i) % n]);
  props.setProperty(key, String((cur + pick.length) % n));
  let res;
  try {
    const tok = ScriptApp.getOAuthToken();
    res = UrlFetchApp.fetchAll(pick.map(function (shop) {
      return { url: 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(String(shop.sheetId)) + '/values:batchGet?ranges=1:1&ranges=A' + Math.max(2, Number(shop.lastRow || 1) + 1) + ':ZZ&valueRenderOption=FORMATTED_VALUE',
        headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true };
    }));
  } catch (err) { props.setProperty('rest_off', String(Date.now())); return false; }
  let next = tab('orders').getLastRow() + 1000, okAny = false, off = false;
  res.forEach(function (r, i) {
    const code = r.getResponseCode(), shop = pick[i];
    if (code !== 200) { if (code === 403 && /disabled|not been used|insufficient/i.test(r.getContentText())) off = true; else console.error('sheet ' + shop.name + ' : HTTP ' + code); return; }
    okAny = true;
    const vr = parse(r.getContentText(), {}).valueRanges || [];
    try { next = importShop(shop, next, { head: (vr[0] && vr[0].values && vr[0].values[0]) || [], data: (vr[1] && vr[1].values) || [] }); }
    catch (err) { console.error('import ' + shop.name + ' : ' + err); }
  });
  if (off && !okAny) { props.setProperty('rest_off', String(Date.now())); return false; }
  return true;
}
// À lancer à la main depuis l'éditeur pour vérifier la lecture des Sheets (résultat dans le journal d'exécution).
function diag() {
  eachCountry(function (c) {
    const shops = linkedShops(); if (!shops.length) { console.log(c + ' : aucun Sheet lié'); return; }
    const t0 = Date.now(), r = UrlFetchApp.fetchAll(shops.map(function (s) { return { url: 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(String(s.sheetId)) + '/values:batchGet?ranges=1:1', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true }; }));
    const t1 = Date.now(); shops.forEach(function (s) { try { merchantSheet(s).getLastRow(); } catch (err) { console.log(c + ' ' + s.name + ' : ouverture impossible — ' + err); } });
    console.log(c + ' : ' + shops.length + ' Sheet(s) · lecture groupée ' + (t1 - t0) + ' ms, codes ' + r.map(function (x) { return x.getResponseCode(); }).join(',') + ' · lecture directe ' + (Date.now() - t1) + ' ms'
      + (r[0].getResponseCode() === 200 ? '' : ' · ' + r[0].getContentText().slice(0, 200)));
    // La lecture groupée fonctionne : on la réactive tout de suite si elle avait été mise de côté.
    if (r.every(function (x) { return x.getResponseCode() === 200; })) PropertiesService.getScriptProperties().deleteProperty('rest_off');
  });
}
// Colonne du téléphone du client : d'abord un titre qui parle de téléphone, ensuite seulement un « numéro »
// qui n'est ni un numéro de commande ni un numéro de suivi.
function phoneCol(h) {
  const not = /commande|order|suivi|track|ref|facture|ligne|n° ?id|\bid\b/;
  let i = col(h, /t[ée]l|phone|whatsapp|mobile|portable|gsm|cellul/, /commande|order/);
  if (i < 0) i = col(h, /contact/, not);
  if (i < 0) i = col(h, /num[ée]ro|^n[°o]\b|number/, not);
  return i;
}
// À lancer à la main : remet le bon téléphone sur les commandes déjà arrivées des Sheets (pays par pays).
function repairPhones() {
  eachCountry(function (c) {
    const byShop = {}; linkedShops().forEach(function (s) { byShop[String(s.name)] = s; });
    const sh = tab('orders'), n = sh.getLastRow(); if (n < 2) return;
    const vals = sh.getRange(2, 1, n - 1, 6).getValues(), cache = {}; let fixed = 0;
    vals.forEach(function (r, i) {
      const o = parse(r[5], null); if (!o || !o.sheetRow || o.old || !byShop[o.shop]) return;
      if (!cache[o.shop]) { try { const ms = merchantSheet(byShop[o.shop]), w = ms.getLastColumn(), last = ms.getLastRow(); cache[o.shop] = { col: phoneCol(ms.getRange(1, 1, 1, w).getValues()[0]), rows: last > 1 ? ms.getRange(1, 1, last, w).getDisplayValues() : [] }; } catch (err) { cache[o.shop] = { col: -1, rows: [] }; } }
      const k = cache[o.shop], row = k.rows[o.sheetRow - 1]; if (k.col < 0 || !row) return;
      const phone = String(row[k.col] || '').trim(); if (!phone || phone === o.phone) return;
      o.phone = phone; sh.getRange(i + 2, 5, 1, 2).setValues([[Date.now(), JSON.stringify(o)]]); fixed++;
    });
    console.log(c + ' : ' + fixed + ' téléphone(s) corrigé(s)');
  });
}
function toTime(v) {                              // date d'une cellule : vraie date, « 12/11/2026 » ou « 2026-11-12 »
  if (v instanceof Date) return v.getTime();
  const s = String(v || ''); let m = s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : NaN;
}
function importShop(shop, next, pre) {
  // Premier passage après le branchement du Sheet : on ne reprend pas les anciennes commandes déjà traitées,
  // seulement celles datées du jour même (si le Sheet a une colonne de date).
  const init = !Number(shop.lastRow), mark = function (n) { tab('shops').getRange(shop._row, HEAD.shops.indexOf('lastRow') + 1).setValue(Math.max(1, n)); };
  const from = Math.max(2, Number(shop.lastRow || 1) + 1);
  let h, data, last;
  if (pre) {                                      // lignes déjà lues par la lecture groupée
    h = pre.head; data = pre.data; last = from - 1 + data.length;
    if (!data.length) { if (init) mark(1); return next; }
  } else {
    const sh = merchantSheet(shop); last = sh.getLastRow();
    if (last < from) { if (init) mark(last); return next; }
    const w = sh.getLastColumn(); h = sh.getRange(1, 1, 1, w).getValues()[0];
    data = sh.getRange(from, 1, last - from + 1, w).getValues();
  }
  const c = {
    product: col(h, /produit|product|article/), client: col(h, /nom|client|name/, /produit|product|article/),
    phone: phoneCol(h), price: col(h, /prix|montant|total|price/),
    zone: col(h, /quartier|adresse|lieu|zone|ville|address/), qty: col(h, /quantit|qt[ée]|qty/), sexe: col(h, /sexe|genre/),
    date: col(h, /date|jour|horodat|timestamp/)
  };
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const disp = (blobs().dispatch || []).filter(function (d) { return d.shop === shop.name; })[0], pushes = [];
  const now = Date.now(), orders = [], notifs = [];
  data.forEach(function (r, i) {
    const get = function (k) { return c[k] >= 0 && r[c[k]] != null ? String(r[c[k]]).trim() : ''; };
    if (!get('client') && !get('phone')) return;                     // ligne vide
    if (init && !(c.date >= 0 && toTime(r[c.date]) >= today0.getTime())) return;   // ancienne commande : ignorée
    const sx = get('sexe').charAt(0).toUpperCase(), id = 'o' + Utilities.getUuid().slice(0, 12);
    const o = { id: id, ref: 'W' + (next++), shop: String(shop.name), client: get('client') || 'Client', phone: get('phone'),
      sexe: sx === 'F' ? 'F' : (sx === 'H' || sx === 'M') ? 'H' : '', product: get('product') || 'Produit',
      qty: parseInt(get('qty'), 10) || 1, price: parseInt(get('price').replace(/[^0-9]/g, ''), 10) || 0,
      zone: get('zone') || 'À préciser', fee: 1500, feeExp: 0, agence: '', note: '', status: 'nouveau', driver: null, closer: null,
      createdAt: now, transferred: false, sheetRow: from + i, history: [{ at: now, by: 'Google Sheet', text: 'Commande reçue' }] };
    orders.push([o.id, o.shop, o.status, o.createdAt, now, JSON.stringify(o)]);
    // La notification va à la closeuse qui a cette boutique dans la répartition du jour, sinon à toutes.
    const n = { id: 'n' + Utilities.getUuid().slice(0, 12), at: now, by: 'sheet',
      title: 'Nouvelle commande pour ' + shop.name, text: o.client + ' · ' + o.product + ' · ' + o.zone, orderId: o.id };
    if (disp && disp.closer) n.toUser = disp.closer; else n.toRole = 'closeuse';
    notifs.push([n.id, n.at, JSON.stringify(n)]); pushes.push(n);
  });
  if (orders.length) {
    const so = tab('orders'), sn = tab('notifs');
    so.getRange(so.getLastRow() + 1, 1, orders.length, 6).setValues(orders);
    sn.getRange(sn.getLastRow() + 1, 1, notifs.length, 3).setValues(notifs);
  }
  mark(last);
  pushes.slice(-3).forEach(pushNotif);
  return next;
}

/* ---------- E-commerçants présents dans plusieurs pays ---------- */
function myTwin(me) { return users().filter(function (x) { return x.role === 'marchand' && x.email === me.email && !x.gone && x.status !== 'pending'; })[0]; }
function markets(me) {
  if (me.role !== 'marchand') return [];
  const out = [], home = CC, d0 = new Date(); d0.setHours(0, 0, 0, 0); const t0 = d0.getTime();
  eachCountry(function (c) {
    const u = myTwin(me); if (!u) return;
    let run = 0, liv = 0; const sh = tab('orders'), n = sh.getLastRow();
    if (n > 1) sh.getRange(2, 2, n - 1, 4).getValues().forEach(function (r) {
      if (String(r[0]) !== u.shop) return; const st = String(r[1]);
      if (st === 'livre') { if (Number(r[3]) >= t0) liv++; } else if (['annule', 'injoignable', 'reporte'].indexOf(st) < 0) run++;
    });
    out.push({ c: c, shop: u.shop, here: c === home, run: run, liv: liv });
  });
  return out;
}
// Passe d'un pays à l'autre sans se reconnecter : le même e-mail doit y avoir un compte e-commerçant.
function switchTo(me, b) {
  const to = String(b.to || '');
  if (me.role !== 'marchand' || !COUNTRY_NAMES[to] || !hubId(to)) return { ok: false, error: 'pays' };
  CC = to; ORDER_ROWS = null;
  const u = myTwin(me); if (!u) return { ok: false, error: 'none' };
  u.lastLogin = Date.now(); writeUser(u);
  return { ok: true, token: token(u), user: pub(u) };
}
// Un e-commerçant ouvre lui-même un nouveau marché : même e-mail, même mot de passe, et le Sheet de ce pays.
function marketAdd(me, b) {
  const to = String(b.to || ''), home = CC;
  if (me.role !== 'marchand' || !COUNTRY_NAMES[to] || !hubId(to) || to === home) return { ok: false, error: 'pays' };
  const m = String(b.sheet || '').match(/\/d\/([\w-]{20,})/), sheet = m ? m[1] : String(b.sheet || '').trim();
  CC = to; ORDER_ROWS = null;
  if (users().some(function (x) { return x.email === me.email; })) return { ok: false, error: 'exists' };
  const shop = rows('shops').filter(function (s) { return String(s.name).toUpperCase() === String(me.shop).toUpperCase(); })[0];
  if (shop && users().some(function (x) { return x.role === 'marchand' && x.shop === String(shop.name); })) return { ok: false, error: 'shop' };
  if (!shop) tab('shops').appendRow(['s_' + Utilities.getUuid().slice(0, 8), me.shop, sheet, 'essai', Date.now() + 30 * DAY, 0, JSON.stringify({ phone: me.phone || '' })]);
  else if (sheet && !shop.sheetId) tab('shops').getRange(shop._row, 3, 1, 1).setValue(sheet);
  const u = { id: 'u_' + Utilities.getUuid().slice(0, 10), name: me.shop, role: 'marchand', email: me.email, shop: shop ? String(shop.name) : me.shop,
    contact: me.contact || '', phone: me.phone || '', createdAt: Date.now() };
  if (me.ph) u.ph = me.ph; else u.pass = me.pass;
  tab('users').appendRow(userRow(u));
  const n = { id: 'n' + Utilities.getUuid().slice(0, 12), at: Date.now(), by: u.id, toRole: 'ceo', title: 'Nouveau marché ouvert', text: me.shop + ' arrive en ' + COUNTRY_NAMES[to] + ' — essai de 30 jours démarré.' };
  tab('notifs').appendRow([n.id, n.at, JSON.stringify(n)]);
  return { ok: true };
}

/* ---------- Notifications sur le téléphone, même quand l'app est fermée (Web Push) ----------
 * Le serveur prévient le service de notifications du téléphone (Google, Apple, Mozilla), signé avec la clé
 * de Wassi. Le téléphone réveille alors l'app, qui vient chercher ici le texte à afficher. */
// (L'éditeur Apps Script n'accepte pas l'écriture abrégée des grands nombres : ils passent par BigInt().)
const N0 = BigInt(0), N1 = BigInt(1), N2 = BigInt(2), N3 = BigInt(3), N8 = BigInt(8), N255 = BigInt(255);
const EC = { p: BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff'), n: BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'),
  g: [BigInt('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'), BigInt('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5')] };
function mod(a, m) { const r = a % m; return r < N0 ? r + m : r; }
function inv(a, m) {
  let lm = N1, hm = N0, low = mod(a, m), high = m;
  while (low > N1) { const q = high / low, nm = hm - lm * q, nw = high - low * q; hm = lm; high = low; lm = nm; low = nw; }
  return mod(lm, m);
}
function ecAdd(P, Q) {
  if (!P) return Q; if (!Q) return P;
  const p = EC.p; let l;
  if (P[0] === Q[0]) { if (mod(P[1] + Q[1], p) === N0) return null; l = mod((N3 * P[0] * P[0] - N3) * inv(N2 * P[1], p), p); }
  else l = mod((Q[1] - P[1]) * inv(mod(Q[0] - P[0], p), p), p);
  const x = mod(l * l - P[0] - Q[0], p); return [x, mod(l * (P[0] - x) - P[1], p)];
}
function ecMul(k, P) { let R = null, A = P; while (k > N0) { if ((k & N1) === N1) R = ecAdd(R, A); A = ecAdd(A, A); k = k >> N1; } return R; }
function b2n(bytes) { let x = N0; for (let i = 0; i < bytes.length; i++) x = (x << N8) | BigInt(bytes[i] & 255); return x; }
function n2b(x, len) { const o = []; for (let i = len - 1; i >= 0; i--) { const v = Number(x & N255); o[i] = v > 127 ? v - 256 : v; x = x >> N8; } return o; }
function b64u(bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ''); }
function utf8(s) { return Utilities.newBlob(s).getBytes(); }
function hmac(key, data) { return Utilities.computeHmacSha256Signature(data, key); }
function ecSign(msg, d) {                         // signature ECDSA P-256, nonce déterministe (RFC 6979)
  const n = EC.n, z = b2n(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, msg)), x = n2b(d, 32), h1 = n2b(mod(z, n), 32);
  let V = [], K = []; for (let i = 0; i < 32; i++) { V.push(1); K.push(0); }
  K = hmac(K, V.concat([0], x, h1)); V = hmac(K, V); K = hmac(K, V.concat([1], x, h1)); V = hmac(K, V);
  for (;;) {
    V = hmac(K, V); const k = b2n(V);
    if (k > N0 && k < n) { const r = mod(ecMul(k, EC.g)[0], n), s2 = mod(inv(k, n) * (z + r * d), n); if (r > N0 && s2 > N0) return n2b(r, 32).concat(n2b(s2, 32)); }
    K = hmac(K, V.concat([0])); V = hmac(K, V);
  }
}
function vapidKeys() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('vapid_d')) {
    const seed = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, utf8(Utilities.getUuid() + Utilities.getUuid() + Date.now()));
    const d = mod(b2n(seed), EC.n - N1) + N1, Q = ecMul(d, EC.g);
    props.setProperty('vapid_pub', b64u([4].concat(n2b(Q[0], 32), n2b(Q[1], 32))));
    props.setProperty('vapid_d', d.toString(16));
  }
  return { d: BigInt('0x' + props.getProperty('vapid_d')), pub: props.getProperty('vapid_pub') };
}
function vapidJwt(aud) {
  const cache = CacheService.getScriptCache(), key = 'jwt_' + sha(aud).slice(0, 40); let t = cache.get(key);
  if (t) return t;
  const head = b64u(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(utf8(JSON.stringify({ aud: aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://wassidelivery.github.io/' })));
  t = head + '.' + body + '.' + b64u(ecSign(utf8(head + '.' + body), vapidKeys().d));
  cache.put(key, t, 6 * 3600); return t;
}
const PUSH_HOSTS = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com|[a-z0-9.-]+\.push\.apple\.com)\//i;
function subscribe(me, b, on) {
  const e = String(b.e || ''); if (!PUSH_HOSTS.test(e)) return { ok: false, error: 'endpoint' };
  let subs = (blobs().subs || []).filter(function (s) { return s.e !== e; });
  if (on) subs.push({ u: me.id, e: e, at: Date.now() });
  setBlob('subs', subs.slice(-300));
  return { ok: true };
}
function pushNotif(n) {
  try {
    const subs = blobs().subs || []; if (!subs.length) return;
    const ids = {}; users().forEach(function (u) {
      if (u.gone || u.status === 'pending' || u.id === n.by) return;
      if (n.toUser ? u.id === n.toUser : (u.role === n.toRole && (!n.shop || u.shop === n.shop))) ids[u.id] = 1;
    });
    const mine = subs.filter(function (s) { return ids[s.u]; }); if (!mine.length) return;
    const cache = CacheService.getScriptCache(), pub = vapidKeys().pub, msg = JSON.stringify({ title: n.title, body: n.text, tag: n.id });
    const reqs = mine.map(function (s) {
      cache.put('pm_' + sha(s.e), msg, 900);
      return { url: s.e, method: 'post', muteHttpExceptions: true, headers: { TTL: '3600', Urgency: 'high', Authorization: 'vapid t=' + vapidJwt(s.e.match(/^https:\/\/[^\/]+/)[0]) + ', k=' + pub } };
    });
    const dead = {}; UrlFetchApp.fetchAll(reqs).forEach(function (r, i) { const c = r.getResponseCode(); if (c === 404 || c === 410) dead[mine[i].e] = 1; });
    if (Object.keys(dead).length) setBlob('subs', subs.filter(function (s) { return !dead[s.e]; }));
  } catch (err) { console.error('push : ' + err); }
}
