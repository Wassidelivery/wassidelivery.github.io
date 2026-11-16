/* WASSI DELIVERY — comptes : connexion par e-mail, création de compte, équipe et accès.
   · Le CEO et les e-commerçants ont un mot de passe personnel.
   · L'équipe (closeuses, livreurs, responsable des opérations) reçoit un code d'accès donné par le CEO.
   · Retirer un membre le déconnecte immédiatement de l'application. */
'use strict';

const SIGN_ROLES = [['marchand', 'E-commerçant', 'shop', 'Suivre mes livraisons, mon compte, mes statistiques et mon stock.'],
  ['closeuse', 'Closeuse', 'phone', 'Appeler les clients, confirmer et envoyer les commandes aux livreurs.'],
  ['livreur', 'Livreur', 'truck', 'Recevoir mes livraisons et les marquer livrées.'],
  ['assistante', 'Responsable des opérations', 'doc', 'Résumé du jour, rapports, soldes et stocks des boutiques.']];
const genCode = () => String(Math.floor(100000 + Math.random() * 900000));
const byEmail = e => S.users.find(u => (u.email || '').toLowerCase() === String(e || '').trim().toLowerCase());
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const checkPass = (u, p) => u.ph ? u.ph === hash(p) : !!u.pass && u.pass === p;

function clearSession() { localStorage.removeItem(LS('wassi.since')); sessionStorage.removeItem(LS('wassi.user')); localStorage.removeItem(LS('wassi.user')); localStorage.removeItem(LS('wassi.token')); }
function kick(msg) { U = null; clearSession(); Undo.stack = []; Nav.hist = []; V.modal = null; V.auth = { mode: 'login', msg }; }
function logout() { if (window.Gps) Gps.pause(); pushOff(); kick(''); renderModal(); render(); }
function enter(u) {
  if (Remote.on) { localStorage.removeItem(LS('wassi.since')); S.orders = []; }   // chaque rôle ne reçoit que ses commandes
  U = u; V.tab = null; V.sub = null; V.auth = { mode: 'login' }; Nav.hist = []; Undo.stack = []; markSeen();
  (Remote.on ? localStorage : sessionStorage).setItem(LS('wassi.user'), u.id);
  V.markets = null;
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().then(pushSetup).catch(() => {}); else pushSetup();
  render(); Remote.pull().then(() => offerUpload()); if (window.Gps && u.role === 'livreur' && Gps.on) Gps.start();
}

const flag = c => `<i class="flag flag-${c}" aria-hidden="true"></i>`;
function renderCountry() {
  $('#app').innerHTML = `<div class="login"><div class="login-box">
    <div class="brand"><img src="icons/icon-192.png" alt="Logo Wassi Delivery" width="108" height="108"><h1>WASSI DELIVERY</h1><p>${SLOGAN}</p></div>
    <div class="panel"><h2>Dans quel pays travaillez-vous ?</h2><p class="hint">Chaque pays a ses propres commandes, boutiques, équipes et caisse.</p>
      <div class="roles">${Object.entries(COUNTRIES).map(([k, c]) => `<button class="role-card" data-a="country" data-id="${k}">${flag(k)}<span><b>${esc(c.name)}</b><small>${esc(c.city)} · ${c.dial}</small></span></button>`).join('')}</div>
    </div></div></div>`;
}
function renderAuth() {
  render.auth = V.auth;                          // tant que cet écran est affiché, une mise à jour en arrière-plan ne le redessine pas
  const a = V.auth, h = new Date().getHours(), hi = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  const msg = a.msg ? `<div class="auth-msg ${a.good ? 'good' : ''}">${ico(a.good ? 'check' : 'alert')}<span>${esc(a.msg)}</span></div>` : '';
  const back = `<button class="btn line block" data-a="back">${ico('back')} Retour</button>`;
  const inp = (id, label, type, extra = '') => `<label class="field"><span>${label}</span><input class="input" id="${id}" type="${type}" value="${esc((a.v || {})[id] || '')}" ${extra}>${type === 'password' ? eyeBtn : ''}</label>`;
  let body;
  if (a.mode === 'role') body = `<h2>Créer un compte</h2><p class="hint">Qui êtes-vous ? Choisissez votre rôle.</p>
    <div class="roles">${SIGN_ROLES.map(([k, l, ic, d]) => `<button class="role-card" data-a="au-role" data-id="${k}"><span class="avatar">${ico(ic)}</span><span><b>${l}</b><small>${d}</small></span></button>`).join('')}</div>
    <p class="hint" style="margin:14px 0">CEO : pas besoin de choisir un rôle, connectez-vous directement avec votre e-mail.</p>${back}`;
  else if (a.mode === 'signup') { const shop = a.role === 'marchand';
    body = `<h2>${shop ? 'Compte e-commerçant' : 'Compte ' + ROLES[a.role]}</h2><p class="hint">${shop ? 'Votre essai gratuit de 30 jours démarre à la création du compte.' : 'Votre demande est envoyée au CEO, qui vous donnera votre code d\'accès.'}</p>${msg}
      ${shop ? inp('su-shop', 'Nom de votre boutique', 'text', 'autocomplete="organization"') : ''}
      ${inp('su-name', shop ? 'Votre nom' : 'Prénom et nom', 'text', 'autocomplete="name"')}
      ${inp('su-email', 'Adresse e-mail', 'email', 'autocomplete="email" inputmode="email"')}
      ${inp('su-phone', 'Numéro WhatsApp', 'tel', 'autocomplete="tel" placeholder="${PAYS.dial} …"')}
      ${shop ? inp('su-pass', 'Créez votre mot de passe (6 caractères minimum)', 'password', 'autocomplete="new-password"') + inp('su-pass2', 'Répétez le mot de passe', 'password', 'autocomplete="new-password"') : ''}
      <button class="btn primary block" style="margin-top:16px" data-a="signup" data-enter>${shop ? 'Créer mon compte' : 'Envoyer ma demande'}</button>
      <div style="height:8px"></div>${back}`; }
  else if (a.mode === 'sent') body = `<div class="lock" style="padding:10px 0">${ico('check')}<h3>Demande envoyée</h3>
      <p>Le CEO de Wassi Delivery va valider votre compte et vous donner votre code d'accès. Vous pourrez alors vous connecter avec votre e-mail et ce code.</p></div>${back}`;
  else { const demo = Remote.on ? [] : ['ceo', 'assistante', 'closeuse', 'livreur', 'marchand'].map(r => byRole(r)[0]).filter(Boolean);
    body = `<h2>${hi} 👋</h2><p class="hint">Connectez-vous avec votre e-mail : votre espace s'ouvre automatiquement.</p>${msg}
      ${inp('au-email', 'Adresse e-mail', 'email', 'autocomplete="username" inputmode="email"')}
      ${inp('au-pass', 'Mot de passe ou code d\'accès', 'password', 'autocomplete="current-password"')}
      <button class="btn primary block" style="margin-top:16px" data-a="login" data-enter>Se connecter</button>
      <button class="btn line block" style="margin-top:8px" data-a="au-go" data-id="role">Créer un compte</button>
      ${demo.length ? `<div class="role-group"><h3>Mode démonstration — entrer sans mot de passe</h3><div class="people">${demo.map(u =>
        `<button class="person" data-a="demo-login" data-id="${esc(u.id)}"><span class="avatar">${esc(initials(u.name))}</span><span>${esc(u.name)}<small>${ROLES[u.role]}</small></span></button>`).join('')}</div></div>` : ''}`; }
  $('#app').innerHTML = `<div class="login"><div class="login-box">
    <div class="brand"><img src="icons/icon-192.png" alt="Logo Wassi Delivery" width="108" height="108"><h1>WASSI DELIVERY</h1><p>${SLOGAN}</p></div>
    <div class="panel"><button class="country-pill" data-a="country-change" aria-label="Changer de pays">${flag(CC)}<b>${esc(PAYS.name)}</b><span>Changer</span></button>${body}</div></div></div>`;
}
const authMsg = (msg, good) => { V.auth.msg = msg; V.auth.good = good; V.auth.v = {}; document.querySelectorAll('.panel input:not([type=password])').forEach(i => V.auth.v[i.id] = i.value); renderAuth(); };
function authBack() {
  const a = V.auth;
  if (a.mode === 'signup') V.auth = { mode: 'role' }; else if (a.mode === 'role' || a.mode === 'sent') V.auth = { mode: 'login' }; else return false;
  renderAuth(); return true;
}

// Pendant l'appel au serveur : le bouton le dit et ne peut pas être touché deux fois.
const busyBtn = (a, text) => { const b = document.querySelector(`.panel [data-a="${a}"]`); if (b) { b.disabled = true; b.innerHTML = '<span class="spin"></span>' + text; } };
async function doLogin() {
  const email = $('#au-email').value.trim().toLowerCase(), pass = $('#au-pass').value;
  if (!email || !pass) return authMsg('Entrez votre e-mail et votre mot de passe.');
  busyBtn('login', 'Connexion en cours…');
  let u;
  if (Remote.on) {
    try {
      const r = await Remote.call({ a: 'login', email, pass });
      if (!r.ok) return authMsg(r.error === 'pending' ? 'Votre compte attend la validation du CEO.' : r.error === 'locked' ? 'Trop d\'essais. Réessayez dans 10 minutes.' : 'E-mail ou mot de passe incorrect.');
      localStorage.setItem(LS('wassi.token'), r.token); u = user(r.user.id); if (!u) { S.users.push(r.user); u = r.user; }
    } catch (e) { return authMsg('Connexion impossible. Vérifiez votre connexion internet.'); }
  } else {
    u = byEmail(email);
    if (!u || u.gone || !checkPass(u, pass)) return authMsg('E-mail ou mot de passe incorrect.');
    if (u.status === 'pending') return authMsg('Votre compte attend la validation du CEO.');
  }
  enter(u);
}

async function doSignup() {
  const role = V.auth.role, g = id => ($('#' + id) ? $('#' + id).value.trim() : ''), shopName = g('su-shop').toUpperCase();
  const name = g('su-name'), email = g('su-email').toLowerCase(), phone = g('su-phone'), pass = $('#su-pass') ? $('#su-pass').value : '';
  if (!name || !validEmail(email)) return authMsg('Entrez votre nom et une adresse e-mail valide.');
  if (role === 'marchand') {
    if (!shopName) return authMsg('Entrez le nom de votre boutique.');
    if (pass.length < 6) return authMsg('Le mot de passe doit faire au moins 6 caractères.');
    if (pass !== $('#su-pass2').value) return authMsg('Les deux mots de passe ne sont pas identiques.');
  }
  busyBtn('signup', role === 'marchand' ? 'Création du compte en cours…' : 'Envoi de la demande en cours…');
  if (Remote.on) {
    try {
      const r = await Remote.call({ a: 'signup', role, name, email, phone, shop: shopName, pass });
      if (!r.ok) return authMsg(r.error === 'email' ? 'Un compte existe déjà avec cet e-mail.' : 'Création impossible pour le moment.');
      if (r.token) { localStorage.setItem(LS('wassi.token'), r.token); S.users.push(r.user); return enter(r.user); }
      V.auth = { mode: 'sent' }; return renderAuth();
    } catch (e) { return authMsg('Connexion impossible. Vérifiez votre connexion internet.'); }
  }
  if (byEmail(email)) return authMsg('Un compte existe déjà avec cet e-mail.');
  const u = { id: uid('u_'), name, role, email, phone, createdAt: Date.now() };
  const known = role === 'marchand' && S.shops.find(s => norm(s.name) === norm(shopName));
  if (role === 'marchand') { u.shop = known ? known.name : shopName; u.contact = name; u.name = u.shop; u.ph = hash(pass); }
  if (role !== 'marchand' || known) u.status = 'pending';       // l'équipe et les boutiques déjà suivies sont validées par le CEO
  else S.shops.push({ id: uid('s'), name: shopName, sheetId: '', plan: 'essai', trialEnd: Date.now() + 30 * DAY, phone });
  S.users.push(u);
  const nt = { id: uid('n'), at: Date.now(), by: u.id, toRole: 'ceo', title: u.status ? 'Demande de compte' : 'Nouvelle boutique inscrite', text: `${name} · ${ROLES[role]}${u.shop ? ' · ' + u.shop : ''}${u.status ? ' — à valider dans Réglages.' : ' — essai de 30 jours démarré.'}` };
  S.notifs.push(nt); persist();
  if (u.status) { V.auth = { mode: 'sent' }; return renderAuth(); }
  enter(u);
}

/* ---- Gestion des comptes (CEO) ---- */
function accessText(u) {
  return [`Bonjour ${u.contact || u.name},`, '', 'Voici votre accès à l\'application WASSI DELIVERY.', `Rôle : ${ROLES[u.role]}${u.shop ? ' · ' + u.shop : ''}`, `E-mail : ${u.email}`,
    `${u.role === 'marchand' ? 'Mot de passe provisoire' : 'Code d\'accès'} : ${u.pass}`, '', u.role === 'marchand' ? 'Vous pourrez le remplacer dans l\'onglet Compte.' : 'Ce code est personnel, ne le partagez pas.', '', SLOGAN].join('\n');
}
const showAccess = u => { V.modal = { t: 'report', title: 'Accès de ' + u.name, text: accessText(u) }; renderModal(); };
const STAFF_OPTS = [['closeuse', 'Closeuse'], ['livreur', 'Livreur'], ['assistante', 'Responsable des opérations'], ['ceo', 'CEO']];

Object.assign(A, {
  login: () => doLogin(), signup: () => doSignup(),
  'au-go': d => { V.auth = { mode: d.id }; renderAuth(); Nav.push('a'); },
  'au-role': d => { V.auth = { mode: 'signup', role: d.id }; renderAuth(); Nav.push('a'); },
  'demo-login': d => { const u = user(d.id); if (u && !Remote.on) enter(u); },
  'user-add': () => form('Nouveau membre de l\'équipe', [{ k: 'name', l: 'Prénom et nom' }, { k: 'email', l: 'Adresse e-mail', t: 'email' }, { k: 'role', l: 'Rôle', opts: STAFF_OPTS.slice(0, 3) },
    { k: 'salary', l: 'Salaire de base (F par mois)', n: 1, v: '0' }, { k: 'free', l: 'Statut', opts: [['', 'Salarié'], ['1', 'Freelance (payé à la livraison)']] }],
    v => { const email = v.email.trim().toLowerCase(); if (!v.name.trim() || !validEmail(email)) return 'Nom et adresse e-mail valide obligatoires.'; if (byEmail(email)) return 'Un compte existe déjà avec cet e-mail.';
      const u = { id: uid('u_'), name: v.name.trim(), role: v.role, email, pass: genCode(), salary: parseInt(v.salary, 10) || 0, createdAt: Date.now() }; if (v.free) u.free = true;
      S.users.push(u); syncCfg(); setTimeout(() => showAccess(u)); }, { note: 'Un code d\'accès personnel est créé automatiquement. Vous pourrez l\'envoyer par WhatsApp.' }),
  'user-edit': d => { const u = user(d.id); form('Modifier ' + u.name, [{ k: 'name', l: 'Nom', v: u.name }, { k: 'email', l: 'Adresse e-mail', t: 'email', v: u.email || '' },
    ...(u.role === 'marchand' ? [] : [{ k: 'role', l: 'Rôle', opts: STAFF_OPTS, v: u.role }, { k: 'salary', l: 'Salaire de base (F par mois)', n: 1, v: String(u.salary || 0) }, { k: 'free', l: 'Statut', opts: [['', 'Salarié'], ['1', 'Freelance (payé à la livraison)']], v: u.free ? '1' : '' }])],
    v => { const email = v.email.trim().toLowerCase(), other = email && byEmail(email); if (!v.name.trim() || (email && !validEmail(email))) return 'Nom obligatoire et adresse e-mail valide.'; if (other && other.id !== u.id) return 'Cet e-mail est déjà utilisé.';
      if (u.id === U.id && v.role && v.role !== 'ceo') return 'Vous ne pouvez pas retirer votre propre rôle de CEO.';
      u.name = v.name.trim(); u.email = email; if (v.role) { u.role = v.role; u.salary = parseInt(v.salary, 10) || 0; v.free ? u.free = true : delete u.free; }
      if (email && !u.pass && !u.ph) u.pass = genCode(); syncCfg(); }); },
  'user-code': d => { const u = user(d.id); if (!u.email) return toast('E-mail manquant', 'Ajoutez d\'abord l\'adresse e-mail de ' + u.name + '.');
    const go = () => { u.pass = genCode(); delete u.ph; syncCfg(); showAccess(u); };
    if (u.pass || u.ph) ask(`Créer un nouveau code pour ${u.name} ? L'ancien ne fonctionnera plus.`, go, { ok: 'Créer le code' }); else go(); },
  'user-show': d => showAccess(user(d.id)),
  'user-ok': d => { const u = user(d.id); if (!u) return;
    // Un membre déjà connu (repris de l'ancienne app) récupère simplement son e-mail et son code.
    const twin = S.users.find(x => x !== u && !x.email && x.role === u.role && norm(x.name) === norm(u.name));
    const t = twin || u; if (twin) { twin.email = u.email; twin.phone = u.phone; delete twin.gone; S.users = S.users.filter(x => x !== u); }
    delete t.status; if (t.role !== 'marchand') t.pass = genCode();
    syncCfg(); if (t.role === 'marchand') toast('Compte validé', t.name + ' peut se connecter avec son mot de passe.'); else showAccess(t); },
  'user-no': d => ask('Refuser cette demande de compte ?', () => { S.users = S.users.filter(u => u.id !== d.id); syncCfg(); }, { danger: true, ok: 'Refuser' }),
  'user-del': d => { const u = user(d.id), used = S.orders.some(o => o.driver === u.id || o.closer === u.id);
    ask(`Retirer ${u.name} ? Cette personne sera déconnectée et ne pourra plus ouvrir l'application.`, () => {
    // On garde le nom dans l'historique des livraisons, mais le compte est fermé.
    if (used) { u.gone = true; u.email = ''; delete u.pass; delete u.ph; } else S.users = S.users.filter(x => x.id !== u.id);
    S.orders.filter(o => o.driver === u.id && o.status === 'assigne').forEach(o => { o.driver = null; o.status = 'confirme'; o.reason = 'Livreur retiré : à réassigner'; Remote.push({ t: 'order', o }); });
    syncCfg(); toast('Accès retiré', u.name + ' ne peut plus se connecter.'); }, { danger: true, ok: 'Retirer' }); },
  'my-email': () => form('Mon adresse e-mail', [{ k: 'email', l: 'Nouvelle adresse e-mail', t: 'email', v: U.email || '' }, { k: 'pass', l: 'Mot de passe actuel', t: 'password' }],
    v => { const email = v.email.trim().toLowerCase(), o = byEmail(email); if (!validEmail(email)) return 'Adresse e-mail invalide.'; if (o && o.id !== U.id) return 'Cet e-mail est déjà utilisé.';
      if (!Remote.on && !checkPass(U, v.pass)) return 'Mot de passe actuel incorrect.'; U.email = email; syncCfg(); toast('E-mail modifié', email); }),
  'my-pass': () => form('Changer mon mot de passe', [{ k: 'old', l: 'Mot de passe actuel', t: 'password' }, { k: 'p1', l: 'Nouveau mot de passe (6 caractères minimum)', t: 'password' }, { k: 'p2', l: 'Répétez le nouveau mot de passe', t: 'password' }],
    v => { if (v.p1.length < 6) return 'Le nouveau mot de passe doit faire au moins 6 caractères.'; if (v.p1 !== v.p2) return 'Les deux mots de passe ne sont pas identiques.';
      if (Remote.on) { Remote.call({ a: 'pass', old: v.old, pass: v.p1 }).then(r => toast(r.ok ? 'Mot de passe modifié' : 'Mot de passe actuel incorrect', r.ok ? 'Utilisez-le à la prochaine connexion.' : 'Rien n\'a été changé.')).catch(() => toast('Hors connexion', 'Réessayez plus tard.')); return; }
      if (!checkPass(U, v.old)) return 'Mot de passe actuel incorrect.'; U.ph = hash(v.p1); delete U.pass; persist(); toast('Mot de passe modifié', 'Utilisez-le à la prochaine connexion.'); }),
  'shop-access': d => { const s = S.shops.find(x => x.id === d.id), u = S.users.find(x => x.role === 'marchand' && x.shop === s.name && x.status !== 'pending');
    form('Accès de ' + s.name, [{ k: 'email', l: 'Adresse e-mail de l\'e-commerçant', t: 'email', v: u ? u.email : '' }],
      v => { const email = v.email.trim().toLowerCase(), o = byEmail(email); if (!validEmail(email)) return 'Adresse e-mail invalide.'; if (o && o !== u) return 'Cet e-mail est déjà utilisé.';
        const t = u || { id: uid('u_'), name: s.name, role: 'marchand', shop: s.name, createdAt: Date.now() }; if (!u) S.users.push(t);
        t.email = email; t.pass = genCode(); delete t.ph; syncCfg(); setTimeout(() => showAccess(t)); },
      { note: 'Un mot de passe provisoire est créé. L\'e-commerçant pourra le remplacer par le sien.', ok: u ? 'Réinitialiser l\'accès' : 'Créer l\'accès' }); }
});
