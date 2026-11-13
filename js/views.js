/* WASSI DELIVERY — les écrans de chaque rôle, puis le démarrage de l'app. */
'use strict';

const locked = sh => !!sh && sh.plan !== 'actif' && (sh.trialEnd || 0) <= Date.now();
const dayList = (day, shop) => { const [a, b] = dayB(day); return S.orders.filter(o => o.status === 'livre' && actT(o) >= a && actT(o) < b && (!shop || o.shop === shop)); };
function opsList() { return dayList(V.day, V.shop).filter(match).sort((a, b) => actT(b) - actT(a)); }
const dayPicker = () => `<div class="actions" style="align-items:center;margin-bottom:10px"><div class="chips">
    <button class="chip ${V.day === today() ? 'on' : ''}" data-a="day" data-id="${today()}">Aujourd'hui</button>
    <button class="chip ${V.day === dayKey(Date.now() - DAY) ? 'on' : ''}" data-a="day" data-id="${dayKey(Date.now() - DAY)}">Hier</button></div>
  <input type="date" class="input" style="max-width:170px" data-set="day" value="${esc(V.day)}" max="${today()}" aria-label="Choisir une date"></div>`;
const box = (title, body, extra = '') => `<div class="card"><div class="card-h"><h3 class="tag">${title}</h3>${extra}</div>${body}</div>`;
const lrow = (main, sub, right = '', pre = '') => `<div class="list-row">${pre}<div class="grow"><b>${main}</b>${sub ? `<small>${sub}</small>` : ''}</div>${right}</div>`;
const av = (name, dim) => `<span class="avatar" ${dim ? 'style="background:var(--surface-2);color:var(--ink-2)"' : ''}>${esc(initials(name))}</span>`;
const del = (a, id, label) => `<button class="icon-btn sm" data-a="${a}" data-id="${esc(id)}" aria-label="${label}">${ico('trash')}</button>`;
const planBadge = s => s.plan === 'actif' ? '<span class="badge st-ok">Abonné</span>' : locked(s) ? '<span class="badge st-bad">Essai terminé</span>' : `<span class="badge st-conf">Essai · ${Math.ceil((s.trialEnd - Date.now()) / DAY)} j</span>`;
const pcs = n => `${n} pc${Math.abs(n) > 1 ? 's' : ''}`;
const shopStock = shop => S.stock.filter(i => i.shop === shop).map(i => ({ i, out: outHand(shop, i.product) })).sort((a, b) => a.i.product.localeCompare(b.i.product));
const waTo = (phone, text) => `https://wa.me/${digits(phone).replace('+', '')}?text=${encodeURIComponent(text)}`;
const shopPhone = name => { const s = shopOf(name) || {}, u = S.users.find(x => x.role === 'marchand' && x.shop === name && x.phone); return s.phone || (u && u.phone) || ''; };

/* ================= Closeuse : aller vite ================= */
VIEWS.closeuse = () => {
  const mine = o => !o.closer || o.closer === U.id, sod = startOfDay();
  if (V.tab === 'map') return mapView();
  const quick = (o, s, label) => `<button class="btn sm line" data-a="status" data-id="${esc(o.id)}" data-s="${s}">${label}</button>`;
  if (V.tab === 'todo') {
    const all = S.orders.filter(o => o.status === 'nouveau').sort((a, b) => a.createdAt - b.createdAt), myShops = S.dispatch.filter(d => d.closer === U.id).map(d => d.shop);
    const l = all.filter(shopMine), mineL = l.filter(o => assignedTo(o.shop) === U.id), free = l.filter(o => !assignedTo(o.shop));
    const back = S.orders.filter(o => mine(o) && (isDue(o) || (['injoignable', 'reporte'].includes(o.status) && !o.retryAt && o.createdAt > sod - 2 * DAY))).sort((a, b) => isDue(b) - isDue(a) || b.createdAt - a.createdAt);
    const myDone = S.orders.filter(o => o.closer === U.id && DONE.includes(o.status) && o.deliveredAt >= sod).length;
    const acts = o => call(o) + quick(o, 'injoignable', 'Injoignable') + act('confirm', o.id, ico('check') + ' Confirmer', 'primary');
    return hero((myShops.length ? `Vos boutiques du jour : ${myShops.map(esc).join(', ')}. ` : S.dispatch.length ? 'Aucune boutique ne vous est attribuée aujourd\'hui. ' : '') + (l.length ? `${l.length} nouvelle(s) commande(s) vous attendent.` : 'Tout est traité, beau travail.'), myDone, share('closeuse')) +
      head('À traiter', 'Appelez, confirmez, puis choisissez le livreur : 3 gestes par commande', `<button class="btn" data-a="order-add">${ico('plus')} Saisir une commande</button>`) +
      (myShops.length ? (grid(mineL, o => card(o, acts(o))) || empty('Rien à traiter dans vos boutiques', 'Les nouvelles commandes de vos boutiques arrivent ici.')) + (free.length ? `<div class="section"><h3>Boutiques non réparties · ${free.length}</h3>${grid(free, o => card(o, acts(o)))}</div>` : '')
        : (grid(l, o => card(o, acts(o))) || empty('Tout est traité', 'Les nouvelles commandes des Google Sheets arrivent ici.'))) +
      (back.length ? `<div class="section"><h3>À rappeler (injoignables / reportées)</h3>${grid(back, o => card(o, acts(o)))}</div>` : '');
  }
  if (V.tab === 'run') {
    const a = S.orders.filter(o => o.status === 'confirme' && mine(o)), b = S.orders.filter(o => o.status === 'assigne' && mine(o)).sort((x, y) => x.assignedAt - y.assignedAt);
    const drv = o => byRole('livreur').map(u => { const h = inHand(u.id, o.shop, o.product); return `<button class="btn sm ${h > 0 ? 'primary' : ''}" data-a="assign" data-id="${esc(o.id)}" data-d="${esc(u.id)}" title="${h > 0 ? h + ' pièce(s) en main' : ''}">${esc(u.name)}</button>`; }).join('');
    return head('En cours', `${a.length} à envoyer · ${b.length} chez les livreurs`) +
      (a.length ? `<div class="section" style="margin-top:0"><h3>Confirmées — touchez le nom du livreur (en doré : il a déjà le produit avec lui)</h3>${grid(a, o => card(o, drv(o)))}</div>` : '') +
      (b.length ? `<div class="section"><h3>Chez les livreurs</h3>${grid(b, o => card(o, call(o) + act('open', o.id, 'Changer de livreur', 'line')))}</div>` : '') +
      (!a.length && !b.length ? empty('Rien en cours') : '');
  }
  if (V.tab === 'check') {
    const l = S.orders.filter(o => o.status === 'livre_livreur' && shopMine(o)).sort((x, y) => x.deliveredAt - y.deliveredAt);
    return head('À valider', 'Livraisons déclarées par les livreurs', l.length > 1 ? `<button class="btn primary" data-a="validate-all">${ico('check')} Tout valider (${l.length})</button>` : '') +
      (grid(l, o => card(o, act('validate', o.id, ico('check') + ' Valider livré', 'ok'))) || empty('Aucune livraison à valider', 'Dès qu\'un livreur marque « livré », la commande apparaît ici.'));
  }
  const l = S.orders.filter(o => CLOSED.includes(o.status) && o.closer === U.id && (o.validatedAt || o.updatedAt || o.createdAt) >= sod).sort((x, y) => y.createdAt - x.createdAt);
  const st = stats(S.orders.filter(o => o.closer === U.id && actT(o) >= sod)), ex = exoResult().rows.find(r => r.u.id === U.id) || { n: 0, prime: 0 };
  return head('Terminé', 'Votre journée') + `<div class="kpis">${kpi('Traitées', st.n)}${kpi('Livrées', st.liv, '', true)}${kpi('Taux de livraison', st.rate + ' %')}${kpi('Prime de l\'exercice', F(ex.prime), ex.n + ' livraisons validées')}</div>
    <div class="section">${podium('closeuse')}</div>
    <div class="section">${grid(l, o => card(o)) || empty('Aucune commande clôturée aujourd\'hui')}</div>`;
};

/* ================= Livreur ================= */
VIEWS.livreur = () => {
  const sod = startOfDay(), done = S.orders.filter(o => o.driver === U.id && DONE.includes(o.status) && o.deliveredAt >= sod);
  const cash = sum(cashDue(U.id), o => o.price), hand = handList(U.id);
  if (V.tab === 'mine') {
    const l = S.orders.filter(o => o.status === 'assigne' && o.driver === U.id).sort((a, b) => a.zone.localeCompare(b.zone) || a.assignedAt - b.assignedAt);
    return hero(l.length ? `${l.length} livraison(s) à faire, classées par quartier.` : 'Aucune livraison en attente.', done.length, share('livreur')) +
      `<div class="kpis">${kpi('À livrer', l.length, F(sum(l, o => o.price)) + ' à encaisser', true)}${kpi('Livrées aujourd\'hui', done.length)}${kpi('À remettre à Wassi', F(cash))}${kpi('Pièces avec moi', sum(hand, h => h.qty))}</div>
      <div class="insight" style="margin:14px 0">${ico('gps')}<div style="flex:1"><b>${Gps.on ? 'Votre position est partagée' : 'Partager ma position'}</b><br>${Gps.on ? 'Les closeuses et les boutiques voient où vous êtes pendant vos livraisons.' : 'Les boutiques pourront suivre leur colis sur la carte.'}</div>
        <button class="btn sm ${Gps.on ? 'line' : 'primary'}" data-a="gps">${Gps.on ? 'Arrêter' : 'Activer'}</button></div>` +
      (grid(l, o => card(o, call(o) + act('problem', o.id, 'Problème', 'danger') + act('delivered', o.id, ico('check') + ' Livré', 'ok'))) || empty('Aucune livraison pour le moment', 'Vous serez notifié dès qu\'une closeuse vous envoie une commande.'));
  }
  if (V.tab === 'stock') {
    const pass = S.takes.filter(t => t.driver === U.id && t.kind !== 'liv').sort((a, b) => b.at - a.at).slice(0, 30);
    return head('Mon stock', 'Les pièces que vous avez prises au bureau', `<button class="btn primary" data-a="take-add">${ico('plus')} Passage au bureau</button>`) +
      `<div class="grid g-2">${box('Avec moi en ce moment · ' + pcs(sum(hand, h => h.qty)), hand.length ? hand.map(h => lrow(esc(h.product), esc(h.shop), `<b class="num big">${h.qty}</b>`)).join('') : empty('Aucune pièce avec vous', 'Déclarez votre passage au bureau quand vous prenez des produits.'))}
      ${box('Mes passages au bureau', pass.length ? pass.map(t => lrow(`${t.qty > 0 ? 'Pris' : 'Rendu'} : ${Math.abs(t.qty)} × ${esc(t.product)}`, `${esc(t.shop)} · ${dmy(t.at).slice(0, 5)} à ${hm(t.at)}${t.by && t.by !== U.name ? ' · noté par ' + esc(t.by) : ''}`,
        t.at >= sod && t.by === U.name ? del('take-del', t.id, 'Supprimer ce passage') : '', `<span class="avatar" style="${t.qty > 0 ? '' : 'background:var(--surface-2);color:var(--ink-2)'}">${t.qty > 0 ? '+' : '−'}</span>`)).join('') : empty('Aucun passage enregistré'))}</div>
      <p class="hint" style="margin-top:12px;color:var(--ink-3);font-size:13px">Chaque livraison marquée « livré » retire automatiquement la pièce de votre stock.</p>`;
  }
  const ex = exoResult().rows.find(r => r.u.id === U.id) || { n: 0, prime: 0 };
  return head('Livrées', 'Votre journée') + `<div class="kpis">${kpi('Livrées', done.length, '', true)}${kpi('Encaissé à remettre', F(cash))}${kpi('Validées par la closeuse', done.filter(o => o.status === 'livre').length)}${kpi('Prime de l\'exercice', F(ex.prime), ex.n + ' livraisons')}</div>
    <div class="section">${podium('livreur')}</div>
    <div class="section">${grid(done.sort((a, b) => b.deliveredAt - a.deliveredAt), o => card(o, o.status === 'livre_livreur' ? act('undeliver', o.id, 'Erreur : pas encore livrée', 'line') : '')) || empty('Pas encore de livraison aujourd\'hui')}</div>`;
};

/* ================= Responsable des opérations ================= */
function dayText(day) {
  const l = dayList(day), [a, b] = dayB(day), dep = S.moves.filter(m => m.type === 'dep' && m.at >= a && m.at < b), ventes = sum(l, o => o.price), frais = sum(l, wfee);
  const by = (f, title) => { const g = group(l, f).sort((x, y) => y.n - x.n); return g.length ? ['', title, ...g.map(x => `• ${uname(x.k)} : ${x.n} livraison(s) — ${sp(x.cash)} F`)] : []; };
  return [`📊 WASSI DELIVERY — Résumé du ${dmy(a)}`, '', `Livraisons effectuées : ${l.length}`, `Ventes encaissées : ${sp(ventes)} F`, `Frais Wassi : ${sp(frais)} F`, `À créditer aux boutiques : ${sp(ventes - frais)} F`,
    `Dépenses du jour : ${sp(sum(dep, m => m.amt))} F`, '', 'PAR BOUTIQUE', ...group(l, o => o.shop).sort((x, y) => y.n - x.n).map(s => `• ${s.k} : ${s.n} livraison(s) — ventes ${sp(s.cash)} F, gain ${sp(s.cash - s.fees)} F`),
    ...by(o => o.driver, 'PAR LIVREUR'), ...by(o => o.closer, 'PAR CLOSEUSE'), '', SLOGAN].join('\n');
}
function resumeView() {
  const base = dayList(V.day), l = opsList(), isToday = V.day === today(), [a, b] = dayB(V.day);
  const dep = S.moves.filter(m => m.type === 'dep' && m.at >= a && m.at < b), ventes = sum(l, o => o.price), frais = sum(l, wfee);
  const wait = S.orders.filter(o => o.status === 'livre_livreur').length, run = S.orders.filter(o => o.status === 'assigne').length;
  const people = f => { const g = group(l, f).sort((x, y) => y.n - x.n); return g.length ? g.map((x, i) => lrow(esc(uname(x.k)), `${sp(x.cash)} F encaissés`, `<b class="num">${x.n} livraison${x.n > 1 ? 's' : ''}</b>`, av(uname(x.k), i))).join('') : empty('Aucune livraison'); };
  return (isToday ? hero(`${base.length} livraison(s) validée(s) aujourd'hui · ${run} en cours · ${wait} à valider par les closeuses.`, teamDone(), GOAL()) : '') +
    head('Résumé du jour', 'Tout ce qui a été livré, par qui, pour qui', `<div class="actions"><button class="btn" data-a="dep-add">${ico('plus')} Dépense</button><button class="btn primary" data-a="eod-day">${ico('doc')} Résumé à envoyer</button></div>`) +
    feeQueue() + '<div style="height:14px"></div>' + dayPicker() + shopChips(base) +
    `<div class="kpis" style="margin:14px 0">${kpi('Livraisons', l.length, V.shop || 'toutes les boutiques', true)}${kpi('Ventes encaissées', F(ventes))}${kpi('Frais Wassi', F(frais))}${kpi('Gain des boutiques', F(ventes - frais))}${kpi('Dépenses du jour', F(sum(dep, m => m.amt)), dep.length + ' ligne(s)')}</div>
    <div class="grid g-2">${box('Livreurs', people(o => o.driver))}${box('Closeuses', people(o => o.closer))}</div>
    <div class="section"><div class="actions" style="margin-bottom:12px">${searchBox('Produit, lieu, boutique…')}
      <button class="btn" data-a="copy" ${l.length ? '' : 'disabled'}>Copier</button><button class="btn" data-a="csv" ${l.length ? '' : 'disabled'}>Excel / CSV</button>
      ${V.shop ? `<button class="btn primary" data-a="report" data-id="${esc(V.shop)}">${ico('doc')} Rapport ${esc(V.shop)}</button>` : ''}</div>` +
    (l.length ? `<div class="table-wrap"><table><thead><tr><th>Heure</th><th>Boutique</th><th>Produit</th><th>Lieu</th><th class="r">Montant</th><th class="r">Frais Wassi</th><th>Livreur</th><th>Closeuse</th></tr></thead><tbody>
      ${l.slice(0, 300).map(o => `<tr data-a="open" data-id="${esc(o.id)}"><td class="num">${o.old ? '—' : hm(actT(o))}</td><td><span class="tag">${esc(o.shop)}</span></td><td>${esc(o.product)}${o.qty > 1 ? ' × ' + o.qty : ''}</td><td>${esc(o.zone)}</td>
        <td class="r num"><b>${fmt(o.price)}</b></td><td class="r num">${feeOk(o) ? fmt(wfee(o)) : '<span class="badge st-check">à préciser</span>'}</td><td>${esc(uname(o.driver))}</td><td>${esc(uname(o.closer))}</td></tr>`).join('')}</tbody></table></div>` : empty('Aucune livraison ce jour-là', 'Les livraisons validées par les closeuses arrivent ici automatiquement.')) + '</div>';
}
function reportsView() {
  const base = dayList(V.day), g = group(base, o => o.shop).sort((a, b) => b.n - a.n);
  const names = [...g.map(x => x.k), ...S.shops.map(s => s.name).filter(n => !g.some(x => x.k === n)).sort()];
  if (!names.includes(V.repShop)) V.repShop = names[0] || '';
  const noFee = V.repShop ? S.orders.filter(o => o.shop === V.repShop && o.status === 'livre' && !feeOk(o) && actT(o) >= dayB(V.day)[0] && actT(o) < dayB(V.day)[1]).length : 0;
  const text = V.repShop ? reportText(V.repShop, V.day) : '', ph = shopPhone(V.repShop), i = g.findIndex(x => x.k === V.repShop), next = g[i + 1];
  return head('Rapports journaliers', 'Choisissez la date et la boutique : le rapport est prêt à envoyer') + dayPicker() +
    `<div class="grid g-2" style="align-items:start"><div class="card"><label class="field" style="margin:0"><span>E-commerçant</span><select class="input" data-set="repShop">${names.map(n => { const x = g.find(y => y.k === n);
        return `<option value="${esc(n)}" ${n === V.repShop ? 'selected' : ''}>${esc(n)}${x ? ` — ${x.n} livraison${x.n > 1 ? 's' : ''}` : ''}</option>`; }).join('')}</select></label>
      ${noFee ? `<div class="insight alert" style="margin-top:12px">${ico('alert')}<div>${noFee} livraison(s) de cette boutique n'ont pas encore de frais validés : elles ne sont pas dans ce rapport. Validez-les dans Résumé.</div></div>` : ''}
      ${text ? `<pre class="report" style="margin-top:12px;max-height:none">${esc(text)}</pre>
      <div class="actions fill" style="margin-top:12px"><button class="btn" data-a="rep-copy2">Copier</button><a class="btn primary" target="_blank" rel="noopener" href="${esc(ph ? waTo(ph, text) : 'https://wa.me/?text=' + encodeURIComponent(text))}">${ico('chat')} Envoyer sur WhatsApp</a></div>
      ${next ? `<button class="btn line block" style="margin-top:8px" data-a="rep-pick" data-id="${esc(next.k)}">Boutique suivante : ${esc(next.k)} →</button>` : ''}` : empty('Aucune boutique')}</div>
    ${box(`Boutiques livrées le ${dmy(dayB(V.day)[0])} · ${g.length}`, g.length ? g.map(x => `<div class="list-row" data-a="rep-pick" data-id="${esc(x.k)}" style="cursor:pointer"><div class="grow"><b>${esc(x.k)}${x.k === V.repShop ? ' ·  affiché' : ''}</b><small>${x.n} livraison(s) · ventes ${F(x.cash)} · gain ${F(x.cash - x.fees)}</small></div><b class="num">${F(balanceAt(x.k, dayB(V.day)[1]))}</b></div>`).join('')
      : empty('Aucune livraison ce jour-là'))}</div>`;
}
function shopsView() {
  const ceo = U.role === 'ceo', s = V.sub && S.shops.find(x => x.id === V.sub);
  if (s) {
    const st = shopStock(s.name), bal = balance(s.name), m30 = stats(S.orders.filter(o => o.shop === s.name && inRange(actT(o), '30')));
    const mv = S.moves.filter(m => m.shop === s.name).sort((a, b) => b.at - a.at).slice(0, 15), acc = S.users.find(u => u.role === 'marchand' && u.shop === s.name);
    const due = s.storageDue && s.storageDue <= today();
    return `<button class="btn line sm" data-a="back" style="margin-bottom:12px">${ico('back')} Toutes les boutiques</button>` + head(esc(s.name), 'Solde, stock, Google Sheet et accès', planBadge(s)) +
      `<div class="kpis">${kpi('Solde à reverser', F(bal), 'ventes − frais Wassi − reversements', true)}${kpi('Stock total', pcs(sum(st, x => x.i.qty + x.out)), `${sum(st, x => x.out)} chez les livreurs`)}${kpi('Livrées (30 jours)', m30.liv, 'taux ' + m30.rate + ' %')}${kpi('Ventes (30 jours)', F(m30.cash))}</div>
      <div class="section grid g-2" style="align-items:start">
      ${box('Stock', (st.length ? `<div class="table-wrap flat"><table><thead><tr><th>Produit</th><th class="r">Au bureau</th><th class="r">Livreurs</th><th></th></tr></thead><tbody>${st.map(({ i, out }) => `<tr><td class="wrap"><b>${esc(i.product)}</b></td>
          <td class="r num"><b class="${i.qty <= 5 ? 'low' : ''}">${i.qty}</b></td><td class="r num">${out}</td><td class="r"><button class="btn sm line" data-a="stock-set" data-id="${esc(i.id)}">Corriger</button>${del('stock-del', i.id, 'Supprimer ce produit')}</td></tr>`).join('')}</tbody></table></div>` : empty('Aucun produit en stock')),
        `<button class="btn sm primary" data-a="stock-add" data-id="${esc(s.name)}">${ico('plus')} Ajouter</button>`)}
      ${box('Compte de la boutique', `<div class="actions fill" style="margin:6px 0 4px"><button class="btn primary" data-a="pay-out" data-id="${esc(s.name)}">Reverser</button><button class="btn" data-a="bal-adj" data-id="${esc(s.name)}">Ajuster le solde</button><button class="btn" data-a="report" data-id="${esc(s.name)}">Rapport du jour</button></div>
        ${mv.length ? mv.map(m => lrow(esc(m.note || (m.type === 'pay' ? 'Reversement' : 'Ajustement')), `${dmy(m.at)}${m.by ? ' · ' + esc(m.by) : ''}`, `<b class="num ${m.amt < 0 ? '' : 'pos'}">${m.amt < 0 ? '−' : '+'} ${F(Math.abs(m.amt))}</b>${del('move-del', m.id, 'Supprimer cette ligne')}`)).join('') : empty('Aucun reversement pour le moment')}`)}
      ${box('Google Sheet des commandes', `<p class="note">${s.sheetId ? `<span class="badge st-ok">Lié</span> ${Remote.on ? 'Les nouvelles lignes du Sheet arrivent chez les closeuses chaque minute.' : 'Le lien est enregistré. Les commandes arriveront dès que l\'app sera reliée au serveur Google (Réglages).'}` : '<span class="badge st-wait">Non lié</span> Collez le lien du Google Sheet où cette boutique reçoit ses commandes.'}</p>
        <div class="actions">${act('shop-sheet', s.id, s.sheetId ? 'Modifier le lien' : 'Lier le Google Sheet', s.sheetId ? 'line' : 'primary')}</div>`)}
      ${box('Abonnement et accès', `${lrow('Abonnement à l\'application', s.plan === 'actif' ? 'Actif' : locked(s) ? 'Essai terminé : l\'espace de la boutique est bloqué' : 'Essai gratuit jusqu\'au ' + dmy(s.trialEnd), ceo ? (s.plan === 'actif' ? act('shop-plan', s.id, 'Repasser en essai', 'line') : act('shop-trial', s.id, '+30 j', 'line') + act('shop-plan', s.id, 'Activer', 'primary')) : planBadge(s))}
        ${lrow('Accès de l\'e-commerçant', acc ? esc(acc.email || 'e-mail à renseigner') + (acc.status === 'pending' ? ' · en attente de validation' : '') : 'Aucun compte pour cette boutique', ceo ? act('shop-access', s.id, acc ? 'Réinitialiser' : 'Créer l\'accès', acc ? 'line' : 'primary') : '')}
        ${ceo && !Remote.on ? lrow('Voir l\'espace de cette boutique', 'Ce que l\'e-commerçant voit dans son application', `<button class="btn sm line" data-a="preview" data-id="${esc(s.id)}">Aperçu</button>`) : ''}
        ${lrow('Frais de stockage', s.storageDue ? `Prochaine échéance : ${dmy(dayB(s.storageDue)[0])}${due ? ' — à régler' : ''}` : 'Aucune échéance enregistrée', act('shop-storage', s.id, 'Renouveler 3 mois', due ? 'primary' : 'line'))}`)}</div>`;
  }
  const rows = S.shops.map(x => ({ s: x, bal: balance(x.name), pcs: sum(S.stock.filter(i => i.shop === x.name), i => i.qty) + sum(S.takes.filter(t => t.shop === x.name), t => t.qty) })).filter(r => !V.q || norm(r.s.name).includes(norm(V.q))).sort((a, b) => b.bal - a.bal);
  const linked = S.shops.filter(x => x.sheetId).length;
  return head('Boutiques', 'Soldes, stocks et Google Sheets de chaque e-commerçant', `<button class="btn primary" data-a="shop-add">${ico('plus')} Ajouter une boutique</button>`) +
    `<div class="kpis">${kpi('Dû aux boutiques', F(sum(rows, r => Math.max(0, r.bal))), 'total des soldes', true)}${kpi('Pièces en stock', fmt(sum(rows, r => r.pcs)), 'bureau + livreurs')}${kpi('Google Sheets liés', `${linked} / ${S.shops.length}`, linked < S.shops.length ? 'ouvrez une boutique pour lier son Sheet' : 'toutes les boutiques')}${kpi('Essais terminés', S.shops.filter(locked).length, 'espaces bloqués')}</div>
    <div class="actions" style="margin:14px 0 12px">${searchBox('Rechercher une boutique…')}</div>` +
    (rows.length ? `<div class="table-wrap"><table><thead><tr><th>Boutique</th><th class="r">Solde</th><th class="r">Stock</th><th>Google Sheet</th><th>Application</th><th></th></tr></thead><tbody>
      ${rows.map(({ s: x, bal, pcs: p }) => `<tr data-a="sub" data-id="${esc(x.id)}"><td><b>${esc(x.name)}</b></td><td class="r num"><b>${fmt(bal)}</b></td><td class="r num">${p}</td>
        <td>${x.sheetId ? '<span class="badge st-ok">Lié</span>' : '<span class="badge st-wait">Non lié</span>'}</td><td>${planBadge(x)}</td><td class="r">${ico('back').replace('class="i"', 'class="i" style="transform:scaleX(-1)"')}</td></tr>`).join('')}</tbody></table></div>` : empty('Aucune boutique'));
}
function driversView() {
  const sod = startOfDay();
  return head('Livreurs', 'Argent à récupérer et stock que chaque livreur a avec lui', `<button class="btn primary" data-a="take-add">${ico('plus')} Passage au bureau</button>`) +
    `<div class="grid g-2" style="align-items:start">${byRole('livreur').map(u => { const due = cashDue(u.id), amt = sum(due, o => o.price), hand = handList(u.id), p = S.pos[u.id];
      const run = S.orders.filter(o => o.driver === u.id && o.status === 'assigne').length, done = S.orders.filter(o => o.driver === u.id && DONE.includes(o.status) && o.deliveredAt >= sod).length;
      const pass = S.takes.filter(t => t.driver === u.id && t.kind !== 'liv').sort((a, b) => b.at - a.at).slice(0, 4);
      return `<div class="card"><div class="list-row" style="padding-top:0">${av(u.name)}<div class="grow"><b style="font-size:16px">${esc(u.name)}</b><small>${run} en cours · ${done} livrée(s) aujourd'hui${p && Date.now() - p.at < 15 * MIN ? ' · position partagée' : ''}</small></div>
          <button class="btn sm line" data-a="take-add" data-id="${esc(u.id)}">Passage</button></div>
        ${lrow('Argent à remettre', `${due.length} livraison(s) non versée(s)`, `<b class="num">${F(amt)}</b>${due.length ? `<button class="btn sm ok" data-a="cash-in" data-id="${esc(u.id)}">Reçu</button>` : '<span class="badge st-ok">À jour</span>'}`)}
        <div class="sub-h">Stock avec lui · ${pcs(sum(hand, h => h.qty))}</div>${hand.length ? hand.map(h => lrow(esc(h.product), esc(h.shop), `<b class="num">${h.qty}</b>`)).join('') : '<p class="note">Aucune pièce avec lui.</p>'}
        ${pass.length ? `<div class="sub-h">Derniers passages au bureau</div>${pass.map(t => lrow(`${t.qty > 0 ? 'Pris' : 'Rendu'} ${Math.abs(t.qty)} × ${esc(t.product)}`, `${esc(t.shop)} · ${dmy(t.at).slice(0, 5)} à ${hm(t.at)}`, del('take-del', t.id, 'Supprimer ce passage'))).join('')}` : ''}</div>`; }).join('') || empty('Aucun livreur', 'Ajoutez les livreurs dans Réglages.')}</div>`;
}
function mapView(embed) {
  const m = U.role === 'marchand', f = m ? (o => o.shop === U.shop) : ALL, spots = driverSpots(f), dests = S.orders.filter(o => o.status === 'assigne' && f(o));
  const list = spots.length ? spots.map(s => `<div class="card ${V.mapSel === s.u.id ? 'sel' : ''}"><div class="list-row" style="padding:0;cursor:pointer" data-a="map-pick" data-id="${esc(s.u.id)}">${av(s.u.name)}<div class="grow"><b>${esc(s.u.name)}</b>
        <small>${s.live ? 'Position en direct · ' + ago(s.since) : 'Position estimée d\'après le quartier de sa livraison'}</small></div><b class="num">${s.run.length} colis</b></div>
      ${s.run.map(o => `<div class="list-row" data-a="open" data-id="${esc(o.id)}" style="cursor:pointer"><div class="grow"><b>${esc(o.product)}${o.qty > 1 ? ' × ' + o.qty : ''} → ${esc(o.zone)}</b><small>${m ? '' : esc(o.shop) + ' · '}en route depuis ${ago(o.assignedAt).replace('il y a ', '')}</small></div><b class="num">${F(o.price)}</b></div>`).join('')}</div>`).join('')
    : empty(m ? 'Aucun de vos produits n\'est en route' : 'Aucun livreur en tournée', 'Dès qu\'une commande est confiée à un livreur, il apparaît sur la carte.');
  return (embed ? '' : head('Carte des livreurs', m ? 'Vos produits en cours de livraison' : 'Qui livre quoi, et où, en ce moment')) + mapHtml(spots, dests) +
    `<p class="hint" style="margin:8px 0 12px;color:var(--ink-3);font-size:12.500px">Rond doré : livreur. Point noir : adresse d'une livraison en cours. Les positions sont exactes quand le livreur partage sa position, sinon estimées d'après le quartier.</p><div class="grid g-2">${list}</div>`;
}
VIEWS.assistante = () => ({ resume: resumeView, dispatch: dispatchView, reports: reportsView, shops: shopsView, drivers: driversView, map: mapView }[V.tab])();

/* ================= CEO ================= */
function perfView() {
  const all = S.orders.filter(o => inRange(actT(o), V.range)), ex = exoResult(), prime = id => (ex.rows.find(r => r.u.id === id) || {}).prime || 0;
  const people = role => S.users.filter(u => u.role === role && u.status !== 'pending').map(u => { const mine = all.filter(o => (role === 'livreur' ? o.driver : o.closer) === u.id); return { u, ...stats(mine), run: mine.filter(o => o.status === 'assigne').length }; })
    .filter(r => !r.u.gone || r.n).sort((a, b) => b.liv - a.liv || b.n - a.n);
  const drv = people('livreur'), clo = people('closeuse'), liv = all.filter(o => o.status === 'livre');
  const prod = group(liv, o => o.product).sort((a, b) => b.n - a.n), shops = group(liv, o => o.shop).sort((a, b) => b.cash - a.cash), zon = group(liv, o => o.zone).sort((a, b) => b.n - a.n);
  const champ = (t, r, v) => `<div class="champ">${ico('star')}<small>${t}</small><b>${r ? esc(r) : '—'}</b><em>${r ? v : 'pas encore de données'}</em></div>`;
  const medal = i => i < 3 ? `<span class="avatar" ${i ? 'style="background:var(--surface-2);color:var(--ink-2)"' : ''}>${i + 1}</span>` : `<span class="avatar" style="background:none;color:var(--ink-3)">${i + 1}</span>`;
  const table = (rows, closer) => rows.length ? `<div class="table-wrap flat"><table><thead><tr><th></th><th>Nom</th>${closer ? '<th class="r">Traitées</th>' : ''}<th class="r">Livrées</th>${closer ? '<th class="r">Taux</th>' : '<th class="r">En cours</th>'}<th class="r">Encaissé</th><th class="r">Frais Wassi</th><th class="r">Prime exercice</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td>${medal(i)}</td><td><b>${esc(r.u.name)}</b>${r.u.gone ? ' <small style="color:var(--ink-3)">(ancien)</small>' : r.u.free ? ' <small style="color:var(--ink-3)">(freelance)</small>' : ''}</td>${closer ? `<td class="r num">${r.n}</td>` : ''}<td class="r num"><b>${r.liv}</b></td>
      <td class="r num">${closer ? r.rate + ' %' : r.run}</td><td class="r num">${fmt(r.cash)}</td><td class="r num">${fmt(r.fees)}</td><td class="r num">${r.u.gone ? '—' : fmt(prime(r.u.id))}</td></tr>`).join('')}</tbody></table></div>` : empty('Personne sur cette période');
  return head('Performance', 'Qui livre le plus, quoi, et pour quelle boutique') + rangeChips() +
    `<div class="champs">${champ('Meilleur livreur', drv[0] && drv[0].liv ? drv[0].u.name : '', drv[0] ? drv[0].liv + ' livraisons' : '')}${champ('Meilleure closeuse', clo[0] && clo[0].liv ? clo[0].u.name : '', clo[0] ? `${clo[0].liv} livrées · ${clo[0].rate} %` : '')}
      ${champ('Produit le plus livré', prod[0] ? prod[0].k : '', prod[0] ? `${sum(prod[0].list, o => o.qty || 1)} pièces · ${prod[0].n} livraisons` : '')}${champ('Boutique n°1 en chiffre', shops[0] ? shops[0].k : '', shops[0] ? F(shops[0].cash) + ' de ventes' : '')}</div>
    <div class="section"><h3>Livreurs</h3>${table(drv)}</div><div class="section"><h3>Closeuses</h3>${table(clo, true)}</div>
    <div class="section grid g-2">
      ${box('Produits les plus livrés', bars(prod.slice(0, 10).map(p => ({ ...p, w: p.n })), { val: r => r.n + ' livr.' }))}
      ${box('Boutiques — chiffre de ventes', bars(shops.slice(0, 10).map(s => ({ ...s, w: s.cash })), { val: r => fmt(r.cash) + ' F' }))}
      ${box('Boutiques — frais Wassi rapportés', bars(shops.slice().sort((a, b) => b.fees - a.fees).slice(0, 10).map(s => ({ ...s, w: s.fees })), { val: r => fmt(r.fees) + ' F', cls: () => 'ok' }))}
      ${box('Zones les plus livrées', bars(zon.slice(0, 10).map(z => ({ ...z, w: z.n })), { val: r => r.n + ' livr.' }))}</div>`;
}
function moneyView() {
  const inR = t => inRange(t, V.range), liv = S.orders.filter(o => o.status === 'livre' && inR(actT(o))), ent = sum(liv, wfee);
  const deps = S.moves.filter(m => m.type === 'dep' && inR(m.at)), sor = sum(deps, m => m.amt), adj = sum(S.moves.filter(m => m.type === 'adj' && inR(m.at)), m => m.amt);
  const owed = sum(S.shops, s => Math.max(0, balance(s.name))), drvCash = sum(byRole('livreur'), u => sum(cashDue(u.id), o => o.price)), ex = exoResult();
  const days = new Map(), dget = t => { const k = dayKey(t); if (!days.has(k)) days.set(k, { k, n: 0, e: 0, s: 0 }); return days.get(k); };
  liv.forEach(o => { const d = dget(actT(o)); d.n++; d.e += wfee(o); }); deps.forEach(m => { dget(m.at).s += m.amt; });
  const dl = [...days.values()].sort((a, b) => b.k.localeCompare(a.k)).slice(0, 14), cats = group(deps.map(m => ({ ...m, status: 'x' })), m => m.cat || 'Autre').map(g => ({ k: g.k, w: sum(g.list, m => m.amt) })).sort((a, b) => b.w - a.w);
  const mv = S.moves.filter(m => m.type === 'dep' || m.type === 'adj').sort((a, b) => b.at - a.at).slice(0, 25);
  const line = (l, v, strong) => `<div class="list-row"><div class="grow">${strong ? `<b>${l}</b>` : l}</div><b class="num">${v}</b></div>`;
  return head('Caisse Wassi', 'Entrées et sorties d\'argent de l\'entreprise', `<div class="actions"><button class="btn" data-a="adj-add">Ajuster la caisse</button><button class="btn primary" data-a="dep-add">${ico('plus')} Dépense</button></div>`) +
    feeQueue() + `<div class="kpis" style="margin-top:14px">${kpi('Solde de la caisse', F(caisse()), 'frais encaissés − dépenses ± ajustements', true)}${kpi('Chez les livreurs', F(drvCash), 'ventes à récupérer')}${kpi('Dû aux boutiques', F(owed), 'argent des e-commerçants')}</div>
    <div class="section" style="margin-top:18px">${rangeChips()}<div class="kpis" style="margin-top:12px">${kpi('Entrées', F(ent), liv.length + ' livraisons · frais Wassi')}${kpi('Sorties', F(sor), deps.length + ' dépense(s)')}${kpi('Résultat de la période', F(ent - sor), adj ? 'hors ajustements : ' + F(adj) : 'entrées − sorties')}</div></div>
    <div class="section grid g-2" style="align-items:start">
      ${box('Entrées et sorties par jour', dl.length ? `<div class="table-wrap flat"><table><thead><tr><th>Jour</th><th class="r">Livr.</th><th class="r">Entrées</th><th class="r">Sorties</th><th class="r">Net</th></tr></thead><tbody>${dl.map(d => `<tr><td class="num">${dmy(dayB(d.k)[0]).slice(0, 5)}</td><td class="r num">${d.n}</td><td class="r num">${fmt(d.e)}</td><td class="r num">${fmt(d.s)}</td><td class="r num"><b class="${d.e - d.s < 0 ? 'low' : ''}">${fmt(d.e - d.s)}</b></td></tr>`).join('')}</tbody></table></div>` : empty('Aucun mouvement sur cette période'))}
      ${box('Dépenses par type', bars(cats, { val: r => fmt(r.w) + ' F', cls: () => 'bad' }))}
      ${box('Résultat de l\'exercice en cours', `<p class="note">Depuis le ${dmy(ex.a)} · ${ex.n} livraisons</p>${line('Frais Wassi encaissés', F(ex.ca))}${line('Salaires et charges fixes', '− ' + F(ex.sal))}${line('Primes de l\'équipe', '− ' + F(ex.primes))}${line('Dépenses', '− ' + F(ex.dep))}
        ${line('Recette nette', F(ex.netR), 1)}${line('Caisse de secours (10 %)', '− ' + F(ex.secours))}${line('Bénéfice net', F(ex.benef), 1)}`)}
      ${box('Derniers mouvements', mv.length ? mv.map(m => { const out = m.type === 'dep' || m.amt < 0; return lrow(esc(m.type === 'dep' ? (m.cat || 'Dépense') : 'Ajustement') + (m.note ? ' · ' + esc(m.note) : ''), `${dmy(m.at)}${m.by ? ' · ' + esc(m.by) : ''}`,
        `<b class="num ${out ? '' : 'pos'}">${out ? '−' : '+'} ${F(Math.abs(m.amt))}</b>${del('move-del', m.id, 'Supprimer cette ligne')}`); }).join('') : empty('Aucun mouvement'))}
      ${box('Épargnes et objectifs', S.goals.length ? S.goals.map(g => `<div class="list-row"><div class="grow"><b>${esc(g.name)}</b><small>${g.target ? `${F(g.current)} sur ${F(g.target)} · ${Math.min(100, pct(g.current, g.target))} %` : F(g.current) + ' mis de côté'}</small>
          ${g.target ? `<span class="track"><span class="fill" style="width:${Math.min(100, pct(g.current, g.target))}%"></span></span>` : ''}</div><button class="btn sm line" data-a="goal-set" data-id="${esc(g.id)}">Modifier</button>${del('goal-del', g.id, 'Supprimer')}</div>`).join('') : empty('Aucune épargne pour le moment'),
        `<button class="btn sm primary" data-a="goal-add">${ico('plus')} Ajouter</button>`)}
      ${box('Charges fixes par mois', (S.charges.length ? S.charges.map(c => lrow(esc(c.name), '', `<b class="num">${F(c.amt)}</b>${del('charge-del', c.id, 'Supprimer')}`)).join('') : '<p class="note">Salaire du CEO, internet, loyer… Elles sont comptées dans le résultat de l\'exercice, avec les salaires de l\'équipe.</p>'),
        `<button class="btn sm primary" data-a="charge-add">${ico('plus')} Ajouter</button>`)}</div>`;
}
function settingsView() {
  const pend = S.users.filter(u => u.status === 'pending'), team = S.users.filter(u => u.role !== 'marchand' && !u.gone && u.status !== 'pending'), gone = S.users.filter(u => u.gone).length;
  const steps = [[!!S.importedAt, 'Reprendre les données de l\'ancienne application'], [!/@wassi\.demo$/.test(U.email || ''), 'Mettre mon vrai e-mail et mon mot de passe de CEO'],
    [team.filter(u => u.role !== 'ceo').every(u => u.email), 'Donner un e-mail et un code à chaque membre de l\'équipe'], [S.shops.some(s => s.sheetId), 'Lier le Google Sheet d\'au moins une boutique'],
    [Remote.on, 'Relier l\'app au serveur Google (adresse du script)'], [matchMedia('(display-mode: standalone)').matches, 'Installer l\'app sur l\'écran d\'accueil']];
  const note = t => `<p class="note">${t}</p>`;
  return head('Réglages', 'Mon compte, équipe, connexion et données') +
    (pend.length ? `<div class="card" style="margin-bottom:12px;border-color:var(--gold)"><div class="card-h"><h3 class="tag">Demandes de compte à valider · ${pend.length}</h3></div>${pend.map(u => lrow(esc(u.contact || u.name), `${ROLES[u.role]}${u.shop ? ' · ' + esc(u.shop) : ''} · ${esc(u.email)}${u.phone ? ' · ' + esc(u.phone) : ''}`,
      `<button class="btn sm danger" data-a="user-no" data-id="${esc(u.id)}">Refuser</button><button class="btn sm ok" data-a="user-ok" data-id="${esc(u.id)}">Valider</button>`, av(u.name))).join('')}</div>` : '') +
    `<div class="grid g-2" style="align-items:start">
    ${box('Pays', lrow(flag(CC) + ' ' + esc(PAYS.name), esc(PAYS.city) + ' · données séparées des autres pays', '<button class="btn sm line" data-a="country-change">Changer de pays</button>') + note('Votre e-mail et votre mot de passe de CEO fonctionnent dans tous les pays. Chaque pays a ses commandes, ses boutiques, son équipe et sa caisse.'))}
    ${box('Mon compte CEO', lrow(esc(U.name), esc(U.email || '')) + `<div class="actions"><button class="btn" data-a="my-email">Changer mon e-mail</button><button class="btn" data-a="my-pass">Changer mon mot de passe</button></div>${note('Votre e-mail et votre mot de passe ouvrent directement l\'espace CEO, sans choisir de rôle.')}`)}
    ${box(`Mise en route · ${steps.filter(x => x[0]).length} / ${steps.length}`, steps.map(([ok, t]) => `<div class="list-row"><span class="avatar" style="${ok ? 'background:var(--ok);color:#fff' : 'background:var(--surface-2);color:var(--ink-3)'}">${ico(ok ? 'check' : 'clock')}</span><div class="grow">${ok ? `<s style="color:var(--ink-3)">${t}</s>` : `<b>${t}</b>`}</div></div>`).join(''))}
    ${box('Sauvegarde et reprise de données', note('<b>Importer</b> accepte une sauvegarde de cette app ou le fichier .json de l\'ancienne application : livraisons, soldes, stocks, équipe, dépenses et caisse sont repris.') +
      `<div class="actions"><button class="btn primary" data-a="restore">Importer un fichier .json</button><button class="btn" data-a="backup">Exporter une sauvegarde</button><input type="file" id="restore" accept="application/json,.json" hidden>
      ${Remote.on ? (!S.orders.length && localBackup() ? '<button class="btn primary" data-a="upload-ask">Envoyer les données de cet appareil</button>' : '') : '<button class="btn danger" data-a="reset">Revenir aux données d\'exemple</button>'}</div>`)}
    ${box('Objectif du jour', note('Nombre de livraisons visé chaque jour, réparti entre les closeuses et les livreurs.') + `<div class="actions"><input class="input num" id="goal" inputmode="numeric" style="max-width:120px" value="${GOAL()}"><button class="btn primary" data-a="goal-save">Enregistrer</button></div>`)}
    ${box('Connexion Google Sheets', note(Remote.on ? 'Application connectée au serveur Wassi.' : 'Collez ici l\'adresse du script Google (voir le guide fourni) pour relier tous les téléphones et les Google Sheets des boutiques.') +
      `<label class="field"><span>Adresse du script (se termine par /exec)</span><input class="input" id="api" value="${esc(Remote.api)}" placeholder="https://script.google.com/macros/s/…/exec"></label>
      <div class="actions" style="margin-top:12px"><button class="btn primary" data-a="api-save">Enregistrer</button>${Remote.on ? '<button class="btn danger" data-a="api-off">Revenir en démonstration</button>' : ''}</div>`)}
    ${box('Installer sur le téléphone', note('<b>Android (Chrome)</b> : menu ⋮ puis « Ajouter à l\'écran d\'accueil ».<br><b>iPhone (Safari)</b> : bouton Partager puis « Sur l\'écran d\'accueil ».') + (deferredInstall ? '<button class="btn primary" data-a="install">Installer maintenant</button>' : '') +
      `<div class="actions" style="margin-top:8px"><button class="btn line" data-a="w-replay">Revoir la présentation</button>${Remote.on ? '' : `<button class="btn line" data-a="simulate">${ico('plus')} Simuler une commande</button>`}</div>`)}</div>
    ${Remote.on ? '' : `<div class="section">${box('Voir l\'app comme…', note('Ouvrez l\'espace d\'un autre rôle pour vérifier ce que chacun voit. Déconnectez-vous pour revenir à votre espace CEO.') + `<div class="chips wrap"><button class="chip" data-a="preview">Responsable des opérations</button>${[byRole('closeuse')[0], byRole('livreur')[0]].filter(Boolean).map(u => `<button class="chip" data-a="preview" data-u="${esc(u.id)}">${ROLES[u.role]} · ${esc(u.name)}</button>`).join('')}<button class="chip" data-a="tab" data-id="shops">E-commerçant : ouvrez une boutique, puis « Aperçu »</button></div>`)}</div>`}
    <div class="section"><div class="head"><h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3)">Équipe · ${team.length} membres${gone ? ` · ${gone} ancien(s) gardé(s) dans l'historique` : ''}</h3><button class="btn sm primary" data-a="user-add">${ico('plus')} Ajouter</button></div>
    <div class="card">${team.map(u => `<div class="list-row wrap">${av(u.name)}<div class="grow"><b>${esc(u.name)}</b><small>${ROLES[u.role]}${u.free ? ' · freelance' : u.salary ? ' · ' + F(u.salary) + ' / mois' : ''} · ${u.email ? esc(u.email) : '<span style="color:var(--bad)">e-mail à renseigner</span>'}${u.pass ? ' · code ' + esc(u.pass) : ''}</small></div>
      <div class="actions"><button class="btn sm line" data-a="user-edit" data-id="${esc(u.id)}">Modifier</button>${u.id === U.id ? '' : `<button class="btn sm line" data-a="user-code" data-id="${esc(u.id)}">${u.pass ? 'Nouveau code' : 'Créer le code'}</button>${u.pass ? `<button class="btn sm line" data-a="user-show" data-id="${esc(u.id)}">Envoyer</button>` : ''}
        <button class="btn sm danger" data-a="user-del" data-id="${esc(u.id)}">Retirer</button>`}</div></div>`).join('')}</div></div>`;
}
VIEWS.ceo = () => {
  const other = { dispatch: dispatchView, accounts: accountsView, perf: perfView, money: moneyView, shops: shopsView, drivers: driversView, reports: reportsView, map: mapView, settings: settingsView, orders: () => allOrders(S.orders, true) }[V.tab];
  if (other) return other();
  const all = S.orders.filter(o => inRange(actT(o), V.range)), st = stats(all), late = S.orders.filter(isLate);
  const conf = all.filter(o => o.status !== 'nouveau' && !['annule', 'injoignable'].includes(o.status)).length;
  const pipe = Object.keys(ST).map(k => ({ k, n: all.filter(o => o.status === k).length })).filter(x => x.n);
  const drv = byRole('livreur').map(u => { const d = all.filter(o => o.driver === u.id && DONE.includes(o.status));
    return { u, run: S.orders.filter(o => o.driver === u.id && o.status === 'assigne').length, liv: d.length, cash: sum(cashDue(u.id), o => o.price) }; }).sort((a, b) => b.liv - a.liv);
  const clo = byRole('closeuse').map(u => ({ u, ...stats(all.filter(o => o.closer === u.id)) })).sort((a, b) => b.liv - a.liv);
  const shops = group(all, o => o.shop).sort((a, b) => b.cash - a.cash), prod = group(st.livList, o => o.product).sort((a, b) => b.n - a.n);
  const pv = prevStats(V.range) || { n: 0, liv: 0, cash: 0 };
  const feed = S.orders.filter(o => !o.old && (o.updatedAt || o.createdAt) > Date.now() - 2 * DAY).flatMap(o => o.history.map(h => ({ h, o }))).sort((a, b) => b.h.at - a.h.at).slice(0, 7);
  const pend = S.users.filter(u => u.status === 'pending').length, low = S.stock.filter(i => i.qty + outHand(i.shop, i.product) <= 5 && S.orders.some(o => o.shop === i.shop && norm(o.product) === norm(i.product) && actT(o) > Date.now() - 21 * DAY));
  const stor = S.shops.filter(s => s.storageDue && s.storageDue <= today()), ended = S.shops.filter(locked);
  const alerts = [pend && [`${pend} demande(s) de compte à valider`, 'settings'], low.length && [`Stock presque épuisé : ${low.slice(0, 4).map(i => `${i.product} (${i.qty + outHand(i.shop, i.product)})`).join(', ')}${low.length > 4 ? '…' : ''}`, 'shops'],
    stor.length && [`Frais de stockage à régler : ${stor.map(s => s.name).join(', ')}`, 'shops'], ended.length && [`Essai terminé (espace bloqué) : ${ended.map(s => s.name).slice(0, 5).join(', ')}${ended.length > 5 ? '…' : ''}`, 'shops']].filter(Boolean);
  const champ = (t, r, v) => `<div class="champ">${ico('star')}<small>${t}</small><b>${r ? esc(r) : '—'}</b><em>${r ? v : 'pas encore de données'}</em></div>`;
  return hero(`${S.orders.filter(o => !CLOSED.includes(o.status)).length} commande(s) en cours · ${late.length} en retard · caisse ${F(caisse())}.`, teamDone(), GOAL()) +
    head('Tableau de bord', dmy(Date.now()) + ' · vue d\'ensemble', `<button class="btn primary" data-a="eod">${ico('doc')} Rapport global</button>`) + rangeChips() +
    `<div class="kpis" style="margin-top:14px">${kpi('Commandes', st.n, delta(st.n, pv.n))}${kpi('Confirmées', pct(conf, st.n) + ' %', conf + ' commandes')}${kpi('Livrées', st.liv, 'taux ' + st.rate + ' %' + (pv.liv ? ' · ' + delta(st.liv, pv.liv).split(' vs')[0] : ''), true)}
      ${kpi('Ventes encaissées', F(st.cash), delta(st.cash, pv.cash) || 'marchandises')}${kpi('Revenu Wassi', F(st.fees), 'frais de livraison et closing')}${kpi('En retard', late.length, late.length ? 'à traiter' : 'tout va bien')}</div>
    ${alerts.length ? `<div class="section"><h3>À surveiller</h3><div class="grid">${alerts.map(([t, tab]) => `<button class="insight alert" data-a="tab" data-id="${tab}">${ico('alert')}<div>${esc(t)}</div></button>`).join('')}</div></div>` : ''}
    <div class="champs">${champ('Meilleur livreur', drv[0] && drv[0].liv ? drv[0].u.name : '', drv[0] ? drv[0].liv + ' livraisons' : '')}${champ('Meilleure closeuse', clo[0] && clo[0].liv ? clo[0].u.name : '', clo[0] ? `${clo[0].liv} livrées · ${clo[0].rate} %` : '')}
      ${champ('Produit le plus livré', prod[0] ? prod[0].k : '', prod[0] ? prod[0].n + ' livraisons' : '')}${champ('Boutique n°1 en chiffre', shops[0] && shops[0].cash ? shops[0].k : '', shops[0] ? F(shops[0].cash) : '')}</div>
    ${pipe.length ? `<div class="section"><h3>Où en sont les commandes</h3><div class="card"><div class="pipe">${pipe.map(p => `<i style="flex:${p.n};background:${ST[p.k].col}" title="${ST[p.k].l} : ${p.n}"></i>`).join('')}</div>
      <div class="legend" style="flex-wrap:wrap">${pipe.map(p => `<span><i style="background:${ST[p.k].col}"></i>${ST[p.k].l} ${p.n}</span>`).join('')}</div></div></div>` : ''}
    ${late.length ? `<div class="section"><h3>Alertes — commandes en retard</h3>${grid(late.slice(0, 6), o => card(o))}</div>` : ''}
    ${feed.length ? `<div class="section"><h3>Activité en direct</h3><div class="card">${feed.map(({ h, o }) => `<div class="list-row" data-a="open" data-id="${esc(o.id)}" style="cursor:pointer"><div class="grow"><b>${esc(h.text)}</b><small>${esc(h.by)} · ${esc(o.client)} · ${esc(o.shop)}</small></div><small class="num" style="color:var(--ink-3)">${ago(h.at)}</small></div>`).join('')}</div></div>` : ''}
    <div class="section grid g-2">
      ${box('Livreurs', drv.map(d => lrow(esc(d.u.name), `${d.run} en cours · ${F(d.cash)} à remettre`, `<b class="num">${d.liv} livrées</b>`, av(d.u.name))).join('') || empty('Aucun livreur'), `<button class="btn sm line" data-a="tab" data-id="perf">Détail</button>`)}
      ${box('Closeuses', clo.map(c => lrow(esc(c.u.name), `${c.n} traitées · taux de livraison ${c.rate} %`, `<b class="num">${c.liv} livrées</b>`, av(c.u.name))).join('') || empty('Aucune closeuse'), `<button class="btn sm line" data-a="tab" data-id="perf">Détail</button>`)}
      ${box('Boutiques — chiffre de ventes', bars(shops.slice(0, 8).map(s => ({ ...s, w: s.cash })), { val: r => fmt(r.cash) + ' F' }))}
      ${box('14 derniers jours', columns(S.orders))}</div>`;
};

/* ================= E-commerçant ================= */
VIEWS.marchand = () => {
  const sh = shopOf(U.shop) || {}, mine = S.orders.filter(o => o.shop === U.shop);
  if (locked(sh)) return `<div class="card lock">${ico('lock')}<h3>Votre essai gratuit de 30 jours est terminé</h3>
    <p>Votre espace est bloqué : suivi des livraisons, compte, statistiques et stock. Vos livraisons continuent normalement avec Wassi Delivery. Activez votre abonnement pour tout retrouver.</p>
    <a class="btn primary" target="_blank" rel="noopener" href="https://wa.me/${WASSI_WA}?text=${encodeURIComponent('Bonjour Wassi Delivery, je souhaite activer mon abonnement pour ' + U.shop + '.')}">${ico('chat')} Activer sur WhatsApp</a></div>`;
  const left = Math.ceil((sh.trialEnd - Date.now()) / DAY), sod = startOfDay();
  const trial = sh.plan === 'actif' ? '' : `<div class="insight" style="margin-bottom:14px">${ico('clock')}<div><b>Essai gratuit : ${left} jour(s) restant(s).</b> À la fin de l'essai, votre espace se bloque jusqu'à l'activation de l'abonnement.</div></div>`;
  if (V.tab === 'orders') return marketBar() + allOrders(mine, false);
  const st0 = shopStock(U.shop), bal = balance(U.shop);
  if (V.tab === 'over') {
    const run = mine.filter(o => o.status === 'assigne'), wait = mine.filter(o => ['nouveau', 'confirme'].includes(o.status)), done = mine.filter(o => DONE.includes(o.status) && o.deliveredAt >= sod);
    return marketBar() + hero(`${run.length} colis en route · ${wait.length} en préparation · ${done.length} livré(s) aujourd'hui.`) + trial + marketsCard() +
      `<div class="kpis">${kpi('En route', run.length, 'chez les livreurs', true)}${kpi('En préparation', wait.length, 'appel et confirmation')}${kpi('Livrées aujourd\'hui', done.length, F(sum(done, o => o.price)))}${kpi('Solde à recevoir', F(bal))}</div>
      <div class="section"><h3>Suivi en direct sur la carte</h3>${mapView(true)}</div>
      ${wait.length ? `<div class="section"><h3>En préparation</h3>${grid(wait.slice(0, 9), o => card(o))}</div>` : ''}
      ${done.length ? `<div class="section"><h3>Livrées aujourd'hui</h3>${grid(done.slice(0, 9), o => card(o))}</div>` : ''}`;
  }
  if (V.tab === 'compte') {
    const livAll = mine.filter(o => o.status === 'livre'), liv = livAll.filter(feeOk), pendN = livAll.length - liv.length, mv = S.moves.filter(m => m.shop === U.shop).sort((a, b) => b.at - a.at).slice(0, 20);
    const days = group(liv.filter(o => actT(o) >= sod - 13 * DAY), o => dayKey(actT(o))).sort((a, b) => b.k.localeCompare(a.k));
    return marketBar() + head('Mon compte', 'Votre argent chez Wassi Delivery') + trial +
      (pendN ? `<div class="insight" style="margin-bottom:14px">${ico('clock')}<div><b>${pendN} livraison(s) en attente de frais.</b> Wassi Delivery précise les frais de livraison ; elles seront ajoutées à votre solde juste après.</div></div>` : '') +
      `<div class="kpis">${kpi('Solde à recevoir', F(bal), 'ventes − frais Wassi − reversements', true)}${kpi('Ventes livrées', F(sum(liv, o => o.price)), liv.length + ' livraisons')}${kpi('Frais Wassi', F(sum(liv, wfee)))}${kpi('Déjà reversé', F(-sum(S.moves.filter(m => m.shop === U.shop && m.type === 'pay'), m => m.amt)))}</div>
      <div class="section grid g-2" style="align-items:start">
      ${box('Gain par jour (14 derniers jours)', days.length ? `<div class="table-wrap flat"><table><thead><tr><th>Jour</th><th class="r">Livr.</th><th class="r">Ventes</th><th class="r">Frais</th><th class="r">Gain</th></tr></thead><tbody>${days.map(d => `<tr><td class="num">${dmy(dayB(d.k)[0]).slice(0, 5)}</td><td class="r num">${d.n}</td><td class="r num">${fmt(d.cash)}</td><td class="r num">${fmt(d.fees)}</td><td class="r num"><b>${fmt(d.cash - d.fees)}</b></td></tr>`).join('')}</tbody></table></div>` : empty('Aucune livraison récente'))}
      ${box('Reversements et ajustements', mv.length ? mv.map(m => lrow(esc(m.note || (m.type === 'pay' ? 'Reversement' : 'Ajustement')), dmy(m.at), `<b class="num ${m.amt < 0 ? '' : 'pos'}">${m.amt < 0 ? '−' : '+'} ${F(Math.abs(m.amt))}</b>`)).join('') : empty('Aucun reversement pour le moment'))}
      ${box('Abonnement', lrow(sh.plan === 'actif' ? 'Abonnement actif' : 'Essai gratuit', sh.plan === 'actif' ? 'Merci de votre confiance.' : `Jusqu'au ${dmy(sh.trialEnd)} · ${left} jour(s) restant(s)`, planBadge(sh)) + (sh.storageDue ? lrow('Frais de stockage', 'Prochaine échéance : ' + dmy(dayB(sh.storageDue)[0])) : ''))}
      ${box('Sécurité', lrow(esc(U.contact || U.name), esc(U.email || '')) + '<div class="actions"><button class="btn" data-a="my-pass">Changer mon mot de passe</button></div>')}</div>`;
  }
  if (V.tab === 'stock') {
    const sold = p => sum(mine.filter(o => o.status === 'livre' && norm(o.product) === norm(p) && actT(o) >= sod - 13 * DAY), o => o.qty || 1);
    return head('Mon stock', 'Vos produits chez Wassi Delivery') + trial +
      `<div class="kpis">${kpi('Pièces en stock', sum(st0, x => x.i.qty + x.out), 'au bureau et chez les livreurs', true)}${kpi('Produits', st0.length)}${kpi('À réapprovisionner', st0.filter(x => x.i.qty + x.out <= 5).length, '5 pièces ou moins')}</div>
      <div class="section">${st0.length ? `<div class="table-wrap"><table><thead><tr><th>Produit</th><th class="r">Au bureau</th><th class="r">Chez les livreurs</th><th class="r">Total</th><th class="r">Vendu (14 j)</th><th>Autonomie</th></tr></thead><tbody>
        ${st0.map(({ i, out }) => { const t = i.qty + out, s = sold(i.product), d = s ? Math.floor(t / (s / 14)) : null;
          return `<tr><td><b>${esc(i.product)}</b></td><td class="r num">${i.qty}</td><td class="r num">${out}</td><td class="r num"><b class="${t <= 5 ? 'low' : ''}">${t}</b></td><td class="r num">${s}</td>
            <td>${t <= 0 ? '<span class="badge st-bad">Épuisé</span>' : d === null ? '<span class="badge st-wait">Pas de vente récente</span>' : d <= 5 ? `<span class="badge st-bad">≈ ${d} jour(s)</span>` : `<span class="badge st-ok">≈ ${d} jours</span>`}</td></tr>`; }).join('')}</tbody></table></div>
        <p class="hint" style="margin-top:10px;color:var(--ink-3);font-size:13px">L'autonomie estime combien de jours votre stock tient au rythme des 14 derniers jours.</p>` : empty('Aucun produit enregistré', 'Wassi Delivery ajoute votre stock à la réception de vos produits.')}</div>`;
  }
  const l = mine.filter(o => actT(o) >= sod - (V.period - 1) * DAY), st = stats(l);
  const per = `<div class="chips">${[[7, '7 jours'], [30, '30 jours'], [3650, 'Tout']].map(([d, t]) => `<button class="chip ${V.period === d ? 'on' : ''}" data-a="period" data-id="${d}">${t}</button>`).join('')}</div>`;
  const prod = group(l, o => o.product).sort((a, b) => b.liv - a.liv), zon = group(l, o => o.zone).sort((a, b) => b.liv - a.liv);
  const sex = group(l.filter(o => o.status === 'livre' && o.sexe), o => o.sexe === 'F' ? 'Femmes' : 'Hommes').sort((a, b) => b.n - a.n);
  const fail = group(l.filter(o => o.reason && o.status !== 'livre'), o => o.reason).sort((a, b) => b.n - a.n);
  const dl = l.filter(o => o.status === 'livre' && o.deliveredAt && !o.old), avg = dl.length ? sum(dl, o => o.deliveredAt - o.createdAt) / dl.length / 36e5 : 0;
  const rateCls = r => r.rate >= 70 ? 'ok' : r.rate < 45 ? 'bad' : '', tips = insights(l, prod, zon);
  return head('Statistiques', 'Ce qui se vend, où, et à qui') + trial + per +
    `<div class="kpis" style="margin-top:14px">${kpi('Livrées', st.liv, `sur ${st.n} commandes`, true)}${kpi('Taux de livraison', st.rate + ' %', `${st.closed} clôturées`)}${kpi('Chiffre livré', F(st.cash))}${kpi('Panier moyen', F(st.liv ? st.cash / st.liv : 0))}${kpi('Délai moyen', avg ? avg.toFixed(1).replace('.', ',') + ' h' : '—', 'commande → livraison')}</div>
    <div class="section"><h3>Détail par produit</h3>${prod.length ? `<div class="table-wrap"><table><thead><tr><th>Produit</th><th class="r">Commandes</th><th class="r">Livrées</th><th class="r">Taux</th><th class="r">Pièces vendues</th><th class="r">Chiffre</th><th class="r">Gain net</th></tr></thead><tbody>
      ${prod.map(p => `<tr><td><b>${esc(p.k)}</b></td><td class="r num">${p.n}</td><td class="r num"><b>${p.liv}</b></td><td class="r num">${p.rate} %</td><td class="r num">${sum(p.livList, o => o.qty || 1)}</td><td class="r num">${fmt(p.cash)}</td><td class="r num"><b>${fmt(net(p.livList.filter(feeOk)))}</b></td></tr>`).join('')}</tbody></table></div>` : empty('Aucune commande sur cette période')}</div>
    ${tips.length ? `<div class="section"><h3>Conseils pour vendre plus</h3><div class="grid">${tips.map(t => `<div class="insight">${ico('bulb')}<div>${t}</div></div>`).join('')}</div></div>` : ''}
    <div class="section grid g-2">
      ${box('Produits les plus livrés', bars(prod.slice(0, 8).map(p => ({ ...p, w: p.liv })), { val: r => r.liv + ' livrées' }))}
      ${box('Taux de livraison par produit', bars(prod.filter(p => p.closed >= 2).sort((a, b) => b.rate - a.rate).slice(0, 8).map(p => ({ ...p, w: p.rate })), { max: 100, val: r => r.rate + ' %', cls: rateCls }))}
      ${box('Zones les plus livrées', bars(zon.slice(0, 8).map(z => ({ ...z, w: z.liv })), { val: r => `${r.liv} livr.` }))}
      ${box('14 derniers jours', columns(mine))}
      ${sex.length ? box('Qui achète (clients livrés)', bars(sex.map(x => ({ ...x, w: x.n })), { val: r => `${r.n} · ${pct(r.n, sum(sex, x => x.n))} %` })) : ''}
      ${fail.length ? box('Pourquoi ça n\'a pas été livré', bars(fail.map(f => ({ ...f, w: f.n })), { val: r => r.n, cls: () => 'bad' })) : ''}</div>`;
};

Object.assign(A, {
  'eod-day': () => { V.modal = { t: 'report', title: 'Résumé du ' + dmy(dayB(V.day)[0]), text: dayText(V.day) }; renderModal(); },
  'rep-copy2': () => copyText(reportText(V.repShop, V.day)),
  'rep-pick': d => { V.repShop = d.id; render(); window.scrollTo(0, 0); }
});

/* ================= Démarrage ================= */
(async function start() {
  const saved = (Remote.on ? localStorage : sessionStorage).getItem(LS('wassi.user'));
  U = (saved && user(saved)) || null;
  markSeen();
  render();
  if (U && U.role === 'livreur' && Gps.on) Gps.start();
  if (U) setTimeout(pushSetup, 3000);
  const sp0 = $('#splash'); if (sp0) setTimeout(() => { sp0.classList.add('out'); setTimeout(() => sp0.remove(), 700); }, sessionStorage.getItem('wassi.seen') ? 700 : 2900);
  sessionStorage.setItem('wassi.seen', '1');
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  setInterval(() => { if (Remote.on) Remote.pull(); else if (U && !V.modal && !document.hidden && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) render(); }, Remote.on ? 10000 : 60000);
  if (Remote.on) Remote.pull().then(() => offerUpload());
})();
