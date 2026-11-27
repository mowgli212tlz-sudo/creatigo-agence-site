/* Administration : devis, contrats et finances (phase 4).
   - devis : client relié, options, TVA, acompte, validité, conditions, partage avec le client, suivi de l'acceptation, contrat, PDF
   - factures : type (facture, acompte, avoir), TVA, paiements (qui soldent la facture côté base), échéancier, envoi au client, avoir, PDF
   - centre financier : indicateurs, alertes, échéancier, revenus par client et par prestation, dépenses et charges récurrentes,
     contrats, informations légales de l'agence, exports comptables CSV
   Les montants sont des estimations de gestion, pas une comptabilité officielle. Paiement en ligne (Stripe) et signature certifiée :
   non connectés, affichés comme tels.
   Tout texte venant des données passe par UI.h (textContent) ; les PDF sont produits par un document HTML dont chaque valeur est échappée. */
(function () {
  var K = function () { return window.AdminKit }
  var UI = function () { return window.UI }
  var M = window.AdminModules = window.AdminModules || {}

  var CONDITIONS = ['À réception de facture', '30 jours après réception de facture', '50 % à la commande, 50 % à la livraison', '30 % à la commande, solde à la livraison', 'En 3 fois : commande, maquettes validées, livraison', 'Mensuel, en début de mois']
  var CAT_DEP = [['logiciel', 'Logiciels et abonnements'], ['hebergement', 'Hébergement et domaines'], ['sous-traitance', 'Sous-traitance'], ['publicite', 'Publicité'], ['materiel', 'Matériel'], ['deplacement', 'Déplacements'], ['formation', 'Formation'], ['frais-bancaires', 'Frais bancaires'], ['loyer', 'Loyer et bureaux'], ['autre', 'Autre']]
  var RECUR = [['aucune', 'Ponctuelle'], ['mensuelle', 'Mensuelle'], ['trimestrielle', 'Trimestrielle'], ['annuelle', 'Annuelle']]
  var MODES = [['virement', 'Virement'], ['carte', 'Carte'], ['cheque', 'Chèque'], ['especes', 'Espèces'], ['prelevement', 'Prélèvement'], ['autre', 'Autre']]
  var TYPES_F = [['facture', 'Facture'], ['acompte', 'Facture d’acompte'], ['avoir', 'Avoir']]

  function S() { return K().S }
  function enLigne() { return S().sb && S().sb.on() }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) }
  function plus(iso, n) { var d = new Date((iso || today()) + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) }
  function jours(a, b) { return Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 864e5) }
  function eur(n) { return S().eur(n) }
  function lab(t, v) { var r = t.filter(function (x) { return x[0] === v })[0]; return r ? r[1] : v }
  function nomC(c) { return c ? (c.societe ? c.societe + (c.nom ? ' · ' + c.nom : '') : c.nom) || 'Sans nom' : '—' }
  function ttc(x) { var t = S().calc(x); return t.uniqueTTC + t.mensuelTTC }
  function ht(x) { var t = S().calc(x); return t.uniqueHT + t.mensuelHT }

  /* ---------- informations légales de l'agence (mentions des PDF) : réglage « agence » ---------- */
  var AGENCE_VIDE = { nom: 'Creatigo', adresse: '', siret: '', tvaIntra: '', email: '', tel: '', iban: '', bic: '', mentions: '' }
  var agenceCache = null
  function agence() {
    if (agenceCache) return Promise.resolve(agenceCache)
    if (!enLigne()) { try { agenceCache = Object.assign({}, AGENCE_VIDE, JSON.parse(localStorage.getItem('creatigo.agence') || '{}')) } catch (e) { agenceCache = Object.assign({}, AGENCE_VIDE) } return Promise.resolve(agenceCache) }
    return S().sb.get('settings?key=eq.agence&select=value').then(function (l) { agenceCache = Object.assign({}, AGENCE_VIDE, (l[0] && l[0].value) || {}); return agenceCache }, function () { return Object.assign({}, AGENCE_VIDE) })
  }
  function sauverAgence(a) {
    agenceCache = a
    if (!enLigne()) { try { localStorage.setItem('creatigo.agence', JSON.stringify(a)) } catch (e) {} return Promise.resolve() }
    return S().sb.upsert('settings?on_conflict=key', [{ key: 'agence', value: a }])
  }

  /* =====================================================================================
     PDF : document HTML imprimable aux couleurs de Creatigo (chaque valeur est échappée)
     ===================================================================================== */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  function frDate(iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '' }
  var LOGO = '<svg viewBox="0 0 64 64" width="38" height="38" aria-hidden="true"><g fill="none" stroke="#0055ff" stroke-width="6.5" stroke-linecap="round"><path d="M25.5 14.15A19 19 0 1 0 48.45 41.5"/><path d="M38.72 25.28A9.5 9.5 0 1 0 38.72 38.72"/></g></svg>'
  function enveloppe(titre, corps) {
    return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>' + esc(titre) + '</title><style>' +
      '@page{size:A4;margin:16mm 14mm}*{box-sizing:border-box}body{font:11pt/1.45 "Segoe UI",Arial,sans-serif;color:#0e0f13;margin:0}' +
      '.tete{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0055ff;padding-bottom:14px;margin-bottom:22px}' +
      '.marque{display:flex;align-items:center;gap:10px;font:800 22pt/1 Arial,sans-serif;letter-spacing:-.04em}.marque b{color:#0055ff}' +
      '.ag{font-size:9pt;color:#555;text-align:right;line-height:1.5}h1{font-size:20pt;margin:0 0 4px;letter-spacing:-.02em}.ref{color:#0055ff;font-weight:700}' +
      '.cols{display:flex;gap:24px;margin:18px 0}.cols>div{flex:1;background:#f3f5fa;border-radius:10px;padding:12px 14px}.cols h3{margin:0 0 6px;font-size:9pt;text-transform:uppercase;letter-spacing:.08em;color:#0055ff}' +
      'table{width:100%;border-collapse:collapse;margin:14px 0}th{background:#0b1230;color:#fff;font-size:9pt;text-align:left;padding:8px 10px}td{padding:9px 10px;border-bottom:1px solid #e3e6ee;vertical-align:top}td.n,th.n{text-align:right;white-space:nowrap}' +
      '.desc{color:#666;font-size:9pt}.opt{color:#0055ff;font-size:8.5pt;font-weight:700}.tot{margin-left:auto;width:300px}.tot div{display:flex;justify-content:space-between;padding:4px 0}.tot .big{border-top:2px solid #0b1230;margin-top:4px;padding-top:8px;font-size:13pt;font-weight:800;color:#0055ff}' +
      '.bloc{margin-top:16px;font-size:9.5pt}.bloc h3{font-size:10pt;margin:0 0 4px}.sign{display:flex;gap:24px;margin-top:26px}.sign>div{flex:1;border:1px solid #cdd2dd;border-radius:10px;padding:12px;min-height:90px;font-size:9.5pt}' +
      '.pied{margin-top:26px;border-top:1px solid #e3e6ee;padding-top:8px;font-size:8pt;color:#777}.contrat{white-space:pre-wrap;font-size:10.5pt}.ok{color:#0a6b3a;font-weight:700}' +
      '</style></head><body>' + corps + '</body></html>'
  }
  function enteteDoc(a, titre, ref, sous) {
    return '<div class="tete"><div><div class="marque">' + LOGO + '<span>Creati<b>go</b></span></div></div><div class="ag">' +
      [esc(a.nom), esc(a.adresse).replace(/\n/g, '<br>'), a.siret ? 'SIRET ' + esc(a.siret) : '', a.tvaIntra ? 'TVA ' + esc(a.tvaIntra) : '', esc(a.email), esc(a.tel)].filter(Boolean).join('<br>') +
      '</div></div><h1>' + esc(titre) + ' <span class="ref">' + esc(ref || '') + '</span></h1><div style="color:#555">' + esc(sous || '') + '</div>'
  }
  function lignesDoc(x) {
    var s = '<table><thead><tr><th>Désignation</th><th class="n">Qté</th><th class="n">Prix unitaire HT</th><th class="n">Total HT</th></tr></thead><tbody>'
    ;(x.lignes || []).forEach(function (l) {
      var exclue = l.option && !l.choisie
      s += '<tr' + (exclue ? ' style="color:#888"' : '') + '><td><b>' + esc(l.nom) + '</b>' + (l.option ? ' <span class="opt">' + (exclue ? 'OPTION (non incluse)' : 'OPTION RETENUE') + '</span>' : '') + (l.desc ? '<div class="desc">' + esc(l.desc) + '</div>' : '') + (l.rec ? '<div class="desc">facturé chaque mois</div>' : '') +
        '</td><td class="n">' + esc(l.qty) + '</td><td class="n">' + esc(eur(l.prix)) + '</td><td class="n">' + esc(eur((+l.prix || 0) * (+l.qty || 0))) + '</td></tr>'
    })
    return s + '</tbody></table>'
  }
  function totauxDoc(x) {
    var t = S().calc(x), s = '<div class="tot">'
    if (t.remiseMontant) s += '<div><span>Total brut HT</span><b>' + esc(eur(t.brutHT)) + '</b></div><div><span>Remise ' + esc(x.remise) + ' %</span><b>− ' + esc(eur(t.remiseMontant)) + '</b></div>'
    s += '<div><span>Total HT</span><b>' + esc(eur(t.uniqueHT)) + '</b></div>'
    if (t.tauxTVA) s += '<div><span>TVA ' + Math.round(t.tauxTVA * 100) + ' %</span><b>' + esc(eur(t.uniqueHT * t.tauxTVA)) + '</b></div>'
    s += '<div class="big"><span>Total ' + (t.tauxTVA ? 'TTC' : '') + '</span><b>' + esc(eur(t.uniqueTTC)) + '</b></div>'
    if (t.mensuelHT) s += '<div><span>Puis chaque mois HT</span><b>' + esc(eur(t.mensuelHT)) + '</b></div><div><span>Chaque mois ' + (t.tauxTVA ? 'TTC' : '') + '</span><b>' + esc(eur(t.mensuelTTC)) + '</b></div>'
    if (!t.tauxTVA) s += '<div class="desc">TVA non applicable, art. 293 B du CGI</div>'
    return s + '</div>'
  }
  function clientDoc(c) { c = c || {}; return '<b>' + esc(c.societe || c.nom || '—') + '</b>' + (c.societe && c.nom ? '<br>' + esc(c.nom) : '') + (c.adresse ? '<br>' + esc(c.adresse) : '') + (c.email ? '<br>' + esc(c.email) : '') + (c.tel ? '<br>' + esc(c.tel) : '') }
  function piedDoc(a) { return '<div class="pied">' + esc(a.nom) + (a.siret ? ' · SIRET ' + esc(a.siret) : '') + (a.mentions ? ' · ' + esc(a.mentions) : '') + ' · Document généré par l’espace agence Creatigo.</div>' }

  function htmlDevis(d, a) {
    var t = S().calc(d), acompte = +d.acompte || 0
    var acc = d.acceptation
    return enveloppe('Devis ' + d.ref, enteteDoc(a, 'Devis', d.ref, 'Émis le ' + frDate(d.creeLe) + (d.valableJusqu ? ' · valable jusqu’au ' + frDate(d.valableJusqu) : '')) +
      '<div class="cols"><div><h3>Client</h3>' + clientDoc(d.client) + '</div><div><h3>Projet</h3>' + esc(d.titreProjet || 'Prestation Creatigo') + (d.notes ? '<div class="desc" style="margin-top:6px">' + esc(d.notes) + '</div>' : '') + '</div></div>' +
      lignesDoc(d) + totauxDoc(d) +
      (acompte ? '<div class="bloc"><h3>Acompte</h3>' + esc(acompte) + ' % à la commande, soit ' + esc(eur(t.uniqueTTC * acompte / 100)) + (t.tauxTVA ? ' TTC' : '') + '.</div>' : '') +
      (d.conditionsPaiement ? '<div class="bloc"><h3>Conditions de paiement</h3>' + esc(d.conditionsPaiement) + '</div>' : '') +
      (d.conditionsParticulieres ? '<div class="bloc"><h3>Conditions particulières</h3>' + esc(d.conditionsParticulieres).replace(/\n/g, '<br>') + '</div>' : '') +
      '<div class="bloc">Montants hors budget publicitaire éventuel. Pénalités de retard au taux légal et indemnité forfaitaire de recouvrement de 40 € en cas de retard de paiement.</div>' +
      '<div class="sign"><div><b>Pour Creatigo</b></div><div><b>Bon pour accord du client</b><br>' + (acc ? '<span class="ok">Accepté électroniquement le ' + esc(frDate(acc.le)) + ' par ' + esc(acc.signataire) + '</span><br><span class="desc">Empreinte de la version acceptée : ' + esc(acc.version) + '</span>' : '<span class="desc">Date, nom et signature, précédés de « Bon pour accord »</span>') + '</div></div>' + piedDoc(a))
  }
  function htmlFacture(f, a, paiements) {
    var t = S().calc(f), titre = { acompte: 'Facture d’acompte', avoir: 'Avoir' }[f.type] || 'Facture'
    var paye = (paiements || []).reduce(function (s, p) { return s + (+p.montant || 0) }, 0)
    return enveloppe(titre + ' ' + f.ref, enteteDoc(a, titre, f.ref, 'Émise le ' + frDate(f.date) + (f.echeance && f.type !== 'avoir' ? ' · à régler avant le ' + frDate(f.echeance) : '') + (f.devisRef ? ' · devis ' + f.devisRef : '')) +
      '<div class="cols"><div><h3>Facturé à</h3>' + clientDoc(f.client) + '</div><div><h3>Règlement</h3>' + (a.iban ? 'Virement : IBAN ' + esc(a.iban) + (a.bic ? '<br>BIC ' + esc(a.bic) : '') : 'Coordonnées bancaires sur demande') + (f.notes ? '<div class="desc" style="margin-top:6px">' + esc(f.notes) + '</div>' : '') + '</div></div>' +
      lignesDoc(f) + totauxDoc(f) +
      (paye ? '<div class="tot"><div><span>Déjà réglé</span><b>' + esc(eur(paye)) + '</b></div><div class="big"><span>Reste à payer</span><b>' + esc(eur(Math.max(0, t.uniqueTTC + t.mensuelTTC - paye))) + '</b></div></div>' : '') +
      ((f.echeancier || []).length ? '<div class="bloc"><h3>Échéancier</h3>' + f.echeancier.map(function (e) { return esc(frDate(e.date)) + ' : ' + esc(eur(e.montant)) }).join('<br>') + '</div>' : '') +
      '<div class="bloc">En cas de retard de paiement : pénalités au taux légal et indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 du Code de commerce). Pas d’escompte pour paiement anticipé.</div>' + piedDoc(a))
  }
  function htmlContrat(k, a, client) {
    return enveloppe(k.titre + ' ' + (k.ref || ''), enteteDoc(a, k.titre, k.ref, (k.date_debut ? 'Du ' + frDate(k.date_debut) : '') + (k.date_fin ? ' au ' + frDate(k.date_fin) : '')) +
      '<div class="cols"><div><h3>Prestataire</h3><b>' + esc(a.nom) + '</b>' + (a.siret ? '<br>SIRET ' + esc(a.siret) : '') + '</div><div><h3>Client</h3>' + clientDoc(client) + '</div></div>' +
      '<div class="contrat">' + esc(k.contenu) + '</div>' +
      '<div class="sign"><div><b>Pour Creatigo</b></div><div><b>Le client</b><br>' + (k.signature ? '<span class="ok">Signé électroniquement le ' + esc(frDate(k.signature.le)) + ' par ' + esc(k.signature.signataire) + '</span><br><span class="desc">' + esc(k.signature.methode || '') + ' · empreinte ' + esc(k.signature.version) + '</span>' : '<span class="desc">Lu et approuvé, date et signature</span>') + '</div></div>' + piedDoc(a))
  }
  // impression dans un cadre caché : le navigateur propose « Enregistrer au format PDF »
  function imprimer(html) {
    var f = document.createElement('iframe')
    f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    document.body.append(f)
    f.srcdoc = html
    f.onload = function () { setTimeout(function () { try { f.contentWindow.focus(); f.contentWindow.print() } catch (e) {} setTimeout(function () { f.remove() }, 60000) }, 150) }
  }

  /* =====================================================================================
     DEVIS : conditions, options, partage, acceptation, contrat, PDF
     ===================================================================================== */
  function devisExtra(d, main, save, ctx) {
    var U = UI(), h = U.h, fmt = U.fmt
    if (!d.valableJusqu) d.valableJusqu = plus((d.creeLe || today()).slice(0, 10), 30)
    S().list('clients').then(function (cl) {
      var mail = ((d.client || {}).email || '').toLowerCase()
      if (!d.clientId && mail) { var trouve = cl.filter(function (c) { return (c.email || '').toLowerCase() === mail })[0]; if (trouve) d.clientId = trouve.id }
      var fc = h('select', {}, h('option', { value: '' }, '— Aucune fiche —'), cl.map(function (c) { return h('option', { value: c.id, selected: c.id === d.clientId }, nomC(c)) }))
      var ftva = h('select', {}, h('option', { value: 'oui', selected: d.tva !== false }, 'TVA 20 %'), h('option', { value: 'non', selected: d.tva === false }, 'TVA non applicable (art. 293 B)'))
      var fac = h('input', { type: 'number', min: '0', max: '100', step: '5', value: d.acompte || '' , placeholder: 'ex. 30' })
      var fval = h('input', { type: 'date', value: d.valableJusqu || '' })
      var fcp = h('input', { list: 'fi-conditions', value: d.conditionsPaiement || '', placeholder: 'Choisir ou écrire…' })
      var dl = h('datalist', { id: 'fi-conditions' }, CONDITIONS.map(function (c) { return h('option', { value: c }) }))
      var fcs = h('textarea', { rows: '3', maxlength: '4000' }); fcs.value = d.conditionsParticulieres || ''
      var ftitre = h('input', { value: d.titreProjet || '', placeholder: 'ex. Site vitrine de la boulangerie', maxlength: '160' })
      var MOD = M.MODELES_PROJET || {}
      var ftype = h('select', {}, h('option', { value: '' }, '— Non précisé —'), Object.keys(MOD).map(function (k) { return h('option', { value: k, selected: k === d.typeProjet }, MOD[k][0]) }))
      var opts = h('div', { class: 'fi-options' })
      function dessinerOptions() {
        opts.textContent = ''
        if (!(d.lignes || []).length) { opts.append(h('p', { class: 'discret' }, 'Ajoutez des lignes au devis pour en proposer certaines en option.')); return }
        d.lignes.forEach(function (l) {
          var cb = h('input', { type: 'checkbox', checked: !!l.option })
          cb.addEventListener('change', function () { l.option = cb.checked; if (!cb.checked) delete l.choisie; ctx.totaux() })
          opts.append(h('label', { class: 'crm-chk' }, cb, l.nom + ' (' + eur((+l.prix || 0) * (+l.qty || 0)) + ')'))
        })
      }
      dessinerOptions()
      function lire() {
        d.clientId = fc.value; d.tva = ftva.value !== 'non'; d.acompte = fac.value === '' ? 0 : Math.max(0, Math.min(100, +fac.value)); d.valableJusqu = fval.value
        d.conditionsPaiement = fcp.value.trim(); d.conditionsParticulieres = fcs.value; d.titreProjet = ftitre.value.trim(); d.typeProjet = ftype.value
      }
      ftva.addEventListener('change', function () { lire(); ctx.totaux() })
      var champ = function (l, i, large) { return h('label', { class: large ? 'pj-large' : null }, l, i) }
      var etat = h('div', { class: 'fi-etat' })
      function dessinerEtat() {
        etat.textContent = ''
        var acc = d.acceptation, ref = d.refus
        if (acc) etat.append(h('div', { class: 'fi-ok' }, U.icone('circle-check', 18), h('div', {}, h('b', {}, 'Accepté par le client le ' + fmt.dateHeure(acc.le)), h('span', {}, 'Signataire : ' + (acc.signataire || '—') + ' · ' + (acc.par || '')), h('small', { class: 'discret' }, 'Empreinte de la version acceptée : ' + acc.version))))
        else if (ref) etat.append(h('div', { class: 'fi-ko' }, U.icone('circle-x', 18), h('div', {}, h('b', {}, 'Refusé par le client le ' + fmt.dateHeure(ref.le)), ref.motif ? h('span', {}, 'Motif : ' + ref.motif) : null)))
        else if (d.partage) etat.append(h('div', { class: 'fi-info' }, U.icone('send', 18), h('div', {}, h('b', {}, 'Partagé avec le client'), h('span', {}, d.valableJusqu && d.valableJusqu < today() ? 'Expiré depuis le ' + fmt.date(d.valableJusqu) + ' : prolongez la validité ou faites une nouvelle version.' : 'Il peut le consulter, choisir les options et l’accepter depuis son espace.'))))
        else etat.append(h('div', { class: 'fi-info' }, U.icone('info', 18), h('div', {}, h('b', {}, 'Pas encore partagé'), h('span', {}, 'Reliez une fiche client, puis partagez : le client recevra une notification dans son espace.'))))
        if (d.projetId) etat.append(h('p', {}, h('a', { href: '#projets/' + d.projetId }, 'Voir le projet créé à l’acceptation →')))
        if (d.factureAcompteId) etat.append(h('p', {}, h('a', { href: '#factures/' + d.factureAcompteId }, 'Vérifier et envoyer la facture d’acompte →')))
      }
      dessinerEtat()
      var verrou = !!d.acceptation
      var panneau = h('section', { class: 'carte fi-carte noprint' }, h('header', {}, h('h2', {}, 'Conditions, envoi et signature'), h('span', { class: 'discret' }, verrou ? 'devis accepté : la version signée est conservée' : 'ce que le client verra et acceptera')),
        etat,
        h('div', { class: 'pj-grille' }, champ('Fiche client', fc), champ('TVA', ftva), champ('Acompte à la commande (%)', fac), champ('Valable jusqu’au', fval), champ('Conditions de paiement', h('span', {}, fcp, dl)), champ('Titre du projet', ftitre), champ('Type de prestation (projet créé à l’acceptation)', ftype), champ('Conditions particulières', fcs, true)),
        h('fieldset', { class: 'crm-fs' }, h('legend', {}, 'Lignes proposées en option (le client choisit)'), opts),
        h('div', { class: 'cta' },
          h('button', { class: 'btn principal', type: 'button', disabled: verrou, onclick: function () { lire(); save().then(function () { U.toast('Conditions enregistrées.', 'bon') }) } }, 'Enregistrer'),
          !d.partage ? h('button', { class: 'btn', type: 'button', disabled: verrou, onclick: function () {
            lire()
            if (!d.clientId) { U.toast('Reliez d’abord le devis à une fiche client.', 'erreur'); fc.focus(); return }
            if (!(d.lignes || []).length) { U.toast('Le devis est vide.', 'erreur'); return }
            if (d.valableJusqu && d.valableJusqu < today()) { U.toast('La date de validité est passée.', 'erreur'); fval.focus(); return }
            d.partage = true; d.statut = 'envoye'; ctx.statut('envoye')
            save().then(function () { U.toast('Devis partagé : le client est prévenu dans son espace.', 'bon'); K().route() })
          } }, U.icone('send', 15), 'Partager avec le client') : h('button', { class: 'btn', type: 'button', disabled: verrou, onclick: function () { d.partage = false; save().then(function () { U.toast('Le client ne voit plus ce devis.', 'bon'); K().route() }) } }, 'Retirer le partage'),
          h('button', { class: 'btn', type: 'button', onclick: function () { lire(); agence().then(function (a) { imprimer(htmlDevis(d, a)) }) } }, U.icone('file-down', 15), 'PDF du devis'),
          h('button', { class: 'btn', type: 'button', onclick: function () { lire(); save().then(function () { nouveauContrat(d) }) } }, U.icone('file-signature', 15), 'Préparer le contrat')))
      main.append(panneau)
      if (verrou) panneau.querySelectorAll('input,select,textarea').forEach(function (x) { x.disabled = true })
    })
  }

  /* =====================================================================================
     FACTURES : type, TVA, paiements, échéancier, avoir, envoi, PDF
     ===================================================================================== */
  function factureExtra(f, main, save, ctx) {
    var U = UI(), h = U.h, fmt = U.fmt
    f.echeancier = Array.isArray(f.echeancier) ? f.echeancier : []
    var ftype = h('select', {}, TYPES_F.map(function (x) { return h('option', { value: x[0], selected: x[0] === (f.type || 'facture') }, x[1]) }))
    var ftva = h('select', {}, h('option', { value: 'oui', selected: f.tva !== false }, 'TVA 20 %'), h('option', { value: 'non', selected: f.tva === false }, 'TVA non applicable (art. 293 B)'))
    ftva.addEventListener('change', function () { f.tva = ftva.value !== 'non'; ctx.totaux() })
    ftype.addEventListener('change', function () { f.type = ftype.value })
    var payZone = h('div'), echZone = h('div')
    var paiements = []
    function chargerPaiements() {
      payZone.textContent = ''
      if (!enLigne()) { payZone.append(h('p', { class: 'discret' }, 'Le suivi des paiements est disponible quand l’administration est connectée à la base.')); return Promise.resolve() }
      return S().sb.get('payments?invoice_id=eq.' + encodeURIComponent(f.id) + '&select=*&order=date_paiement').then(function (l) {
        paiements = l
        var total = ttc(f), paye = l.reduce(function (s, p) { return s + (+p.montant || 0) }, 0)
        payZone.append(h('div', { class: 'fi-solde' }, h('span', {}, 'Total ', h('b', {}, eur(total))), h('span', {}, 'Réglé ', h('b', {}, eur(paye))), h('span', { class: total - paye > 0.01 ? 'fi-reste' : 'fi-solde-ok' }, 'Reste ', h('b', {}, eur(Math.max(0, total - paye))))))
        if (l.length) payZone.append(U.tableau([{ titre: 'Date' }, { titre: 'Mode' }, { titre: 'Référence' }, { titre: 'Montant', num: true }, { titre: '' }], l.map(function (p) {
          return [fmt.date(p.date_paiement), lab(MODES, p.mode), p.reference || '—', eur(p.montant), h('button', { class: 'btn lien petit', type: 'button', onclick: function () {
            U.confirmer({ titre: 'Annuler ce paiement ?', texte: 'La facture sera rouverte si elle n’est plus soldée.', bouton: 'Annuler le paiement', danger: true }).then(function (ok) { if (ok) S().sb.del('payments?id=eq.' + encodeURIComponent(p.id)).then(apresPaiement) })
          } }, 'Annuler')]
        }), { legende: 'Paiements reçus' }))
        var dp = h('input', { type: 'date', value: today(), 'aria-label': 'Date du paiement' }), mt = h('input', { type: 'number', step: '0.01', value: Math.max(0, Math.round((total - paye) * 100) / 100) || '', 'aria-label': 'Montant TTC' })
        var md = h('select', { 'aria-label': 'Mode' }, MODES.map(function (m) { return h('option', { value: m[0] }, m[1]) })), rf = h('input', { placeholder: 'Référence (facultatif)', maxlength: '200', 'aria-label': 'Référence' })
        payZone.append(h('div', { class: 'fi-ajout' }, h('label', {}, 'Date', dp), h('label', {}, 'Montant TTC', mt), h('label', {}, 'Mode', md), h('label', {}, 'Référence', rf),
          h('button', { class: 'btn principal', type: 'button', onclick: function () {
            if (!(+mt.value)) { U.toast('Indiquez un montant.', 'erreur'); return }
            save().then(function () { return S().sb.post('payments', { invoice_id: f.id, date_paiement: dp.value || today(), montant: Math.round(+mt.value * 100) / 100, mode: md.value, reference: rf.value.trim() }) })
              .then(apresPaiement).catch(function (er) { U.toast('Impossible : ' + er.message, 'erreur') })
          } }, U.icone('plus', 15), 'Enregistrer le paiement')))
      })
    }
    function apresPaiement() {
      S().flush('factures')
      return S().sb.get('invoices?id=eq.' + encodeURIComponent(f.id) + '&select=statut,paye').then(function (r) {
        if (r[0]) { f.statut = r[0].statut; f.paye = r[0].paye; ctx.statut(r[0].statut) }
        U.toast(f.statut === 'payee' ? 'Facture soldée.' : 'Paiement enregistré.', 'bon'); return chargerPaiements()
      })
    }
    function dessinerEcheancier() {
      echZone.textContent = ''
      var total = ttc(f), prevu = f.echeancier.reduce(function (s, e) { return s + (+e.montant || 0) }, 0)
      echZone.append(f.echeancier.length ? h('ul', { class: 'fi-ech' }, f.echeancier.map(function (e, i) {
        var passe = e.date < today()
        return h('li', {}, h('span', { class: passe ? 'pj-retard' : '' }, fmt.date(e.date)), h('b', {}, eur(e.montant)), h('button', { class: 'btn lien petit', type: 'button', onclick: function () { f.echeancier.splice(i, 1); dessinerEcheancier() } }, 'Retirer'))
      })) : h('p', { class: 'discret' }, 'Paiement en une fois. Ajoutez des échéances pour un paiement en plusieurs fois.'))
      if (f.echeancier.length && Math.abs(prevu - total) > 0.01) echZone.append(h('p', { class: 'pj-retard' }, 'Les échéances totalisent ' + eur(prevu) + ' pour ' + eur(total) + ' à payer.'))
      var de = h('input', { type: 'date', value: plus(f.echeancier.length ? f.echeancier[f.echeancier.length - 1].date : f.date, 30), 'aria-label': 'Date de l’échéance' }), me = h('input', { type: 'number', step: '0.01', 'aria-label': 'Montant de l’échéance', value: Math.max(0, Math.round((total - prevu) * 100) / 100) || '' })
      echZone.append(h('div', { class: 'fi-ajout' }, h('label', {}, 'Date', de), h('label', {}, 'Montant TTC', me),
        h('button', { class: 'btn', type: 'button', onclick: function () { if (!(+me.value) || !de.value) return; f.echeancier.push({ date: de.value, montant: Math.round(+me.value * 100) / 100 }); f.echeancier.sort(function (a, b) { return a.date < b.date ? -1 : 1 }); dessinerEcheancier() } }, 'Ajouter l’échéance'),
        h('button', { class: 'btn lien', type: 'button', onclick: function () {
          var n = +window.prompt('Payer en combien de fois ?', '3'); if (!(n >= 2 && n <= 24)) return
          var part = Math.floor(total / n * 100) / 100; f.echeancier = []
          for (var i = 0; i < n; i++) f.echeancier.push({ date: plus(f.date || today(), 30 * i), montant: i === n - 1 ? Math.round((total - part * (n - 1)) * 100) / 100 : part })
          dessinerEcheancier()
        } }, 'Répartir en plusieurs fois')))
    }
    var champ = function (l, i) { return h('label', {}, l, i) }
    var envoye = f.statut === 'envoyee' || f.statut === 'payee' || f.statut === 'retard'
    main.append(h('section', { class: 'carte fi-carte noprint' }, h('header', {}, h('h2', {}, 'Type, paiements et envoi'), h('span', { class: 'discret' }, f.clientId ? 'le client voit la facture dans son espace dès qu’elle est envoyée' : 'reliez un client pour qu’il la voie dans son espace')),
      h('div', { class: 'pj-grille' }, champ('Type de document', ftype), champ('TVA', ftva)),
      h('h3', {}, 'Paiements'), payZone,
      h('h3', {}, 'Échéancier'), echZone,
      h('div', { class: 'cta' },
        h('button', { class: 'btn principal', type: 'button', onclick: function () { save().then(function () { U.toast('Facture enregistrée.', 'bon') }) } }, 'Enregistrer'),
        !envoye ? h('button', { class: 'btn', type: 'button', onclick: function () {
          if (!(f.lignes || []).length) { U.toast('La facture est vide.', 'erreur'); return }
          U.confirmer({ titre: 'Envoyer la facture ' + f.ref + ' ?', texte: f.clientId ? 'Elle apparaît dans l’espace du client, qui est prévenu. Une facture envoyée ne se supprime pas : on la corrige par un avoir.' : 'Aucun client relié : elle ne sera pas visible dans un espace client.', bouton: 'Envoyer' }).then(function (ok) {
            if (!ok) return; f.statut = 'envoyee'; ctx.statut('envoyee'); save().then(function () { U.toast('Facture envoyée.', 'bon'); K().route() })
          })
        } }, U.icone('send', 15), 'Envoyer au client') : null,
        h('button', { class: 'btn', type: 'button', onclick: function () { agence().then(function (a) { imprimer(htmlFacture(f, a, paiements)) }) } }, U.icone('file-down', 15), 'PDF'),
        f.type !== 'avoir' && envoye ? h('button', { class: 'btn', type: 'button', onclick: function () {
          U.confirmer({ titre: 'Créer un avoir ?', texte: 'Un avoir reprend les lignes de la facture ' + f.ref + ' en négatif. Vous pourrez l’ajuster pour un avoir partiel.', bouton: 'Créer l’avoir' }).then(function (ok) {
            if (!ok) return
            S().put('factures', { type: 'avoir', statut: 'brouillon', date: today(), echeance: today(), client: JSON.parse(JSON.stringify(f.client || {})), clientId: f.clientId || '', tva: f.tva, remise: f.remise || 0, factureRef: f.ref,
              lignes: (f.lignes || []).filter(function (l) { return !(l.option && !l.choisie) }).map(function (l) { return { itemId: l.itemId, nom: 'Avoir sur ' + f.ref + ' : ' + l.nom, desc: l.desc || '', prix: -Math.abs(+l.prix || 0), qty: l.qty, unite: l.unite, rec: false } }), notes: 'Avoir sur la facture ' + f.ref })
              .then(function (x) { K().go('factures/' + x.id) })
          })
        } }, 'Créer un avoir') : null,
        h('span', { class: 'discret fi-stripe' }, U.icone('lock', 13), 'Paiement en ligne (Stripe) : non connecté'))))
    dessinerEcheancier(); chargerPaiements()
  }

  /* =====================================================================================
     CONTRATS
     ===================================================================================== */
  function texteContrat(d, a, client) {
    var t = S().calc(d), lignes = (d.lignes || []).filter(function (l) { return !(l.option && !l.choisie) })
    return 'CONTRAT DE PRESTATION DE SERVICES\n\nEntre ' + (a.nom || 'Creatigo') + (a.siret ? ' (SIRET ' + a.siret + ')' : '') + ', ci-après « le Prestataire »,\net ' + (nomC(client) || 'le client') + ', ci-après « le Client ».\n\n' +
      'Article 1 – Objet\nLe Prestataire réalise pour le Client : ' + (d.titreProjet || 'la prestation décrite au devis ' + d.ref) + ', selon le devis ' + d.ref + ' qui fait partie intégrante du présent contrat.\n\n' +
      'Article 2 – Prestations\n' + lignes.map(function (l) { return '• ' + l.nom + (l.qty > 1 ? ' (× ' + l.qty + ')' : '') + (l.rec ? ', mensuel' : '') }).join('\n') + '\n\n' +
      'Article 3 – Prix\nMontant ponctuel : ' + eur(t.uniqueHT) + ' HT' + (t.tauxTVA ? ', soit ' + eur(t.uniqueTTC) + ' TTC' : ' (TVA non applicable, art. 293 B du CGI)') + '.' + (t.mensuelHT ? '\nAbonnement : ' + eur(t.mensuelHT) + ' HT par mois.' : '') +
      (+d.acompte ? '\nUn acompte de ' + d.acompte + ' % est dû à la signature.' : '') + (d.conditionsPaiement ? '\nConditions de paiement : ' + d.conditionsPaiement + '.' : '') + '\n\n' +
      'Article 4 – Obligations du Client\nLe Client fournit les contenus, accès et validations nécessaires dans des délais raisonnables. Les retards du Client décalent le planning d’autant.\n\n' +
      'Article 5 – Validation et livraison\nChaque étape est soumise à la validation du Client dans son espace client. Deux allers-retours de modifications sont inclus par maquette, sauf mention contraire au devis.\n\n' +
      'Article 6 – Propriété intellectuelle\nLes droits d’utilisation des livrables sont cédés au Client à compter du paiement intégral du prix.\n\n' +
      'Article 7 – Durée et résiliation\nLe contrat prend effet à sa signature. Les abonnements sont reconduits chaque mois et résiliables avec un préavis d’un mois.\n\n' +
      (d.conditionsParticulieres ? 'Article 8 – Conditions particulières\n' + d.conditionsParticulieres + '\n\n' : '') +
      'Fait en deux exemplaires, signé électroniquement depuis l’espace client Creatigo.'
  }
  function nouveauContrat(d) {
    var U = UI()
    if (!enLigne()) { U.toast('Les contrats sont disponibles quand l’administration est connectée à la base.', 'erreur'); return }
    if (!d.clientId) { U.toast('Reliez d’abord le devis à une fiche client.', 'erreur'); return }
    Promise.all([agence(), S().list('clients')]).then(function (r) {
      var c = r[1].filter(function (x) { return x.id === d.clientId })[0]
      return S().sb.post('contracts', { client_id: d.clientId, quote_id: d.id, titre: 'Contrat de prestation' + (d.titreProjet ? ' – ' + d.titreProjet : ''), contenu: texteContrat(d, r[0], c), statut: 'brouillon', date_debut: today() })
    }).then(function (k) { U.toast('Contrat préparé : relisez-le avant de l’envoyer.', 'bon'); K().go('finances/contrats/' + k[0].id) }).catch(function (er) { U.toast('Impossible : ' + er.message, 'erreur') })
  }

  /* =====================================================================================
     CENTRE FINANCIER : #finances, #finances/depenses, #finances/contrats(/id), #finances/agence
     ===================================================================================== */
  function finances(onglet, id) {
    var U = UI(), h = U.h, main = K().main
    onglet = onglet || 'apercu'
    main.append(U.entete('Centre financier', 'Factures, paiements, dépenses, contrats et exports. Des estimations de gestion : pas une comptabilité officielle.', null))
    main.append(h('nav', { class: 'pj-onglets noprint', 'aria-label': 'Sections du centre financier' }, [['apercu', 'Vue d’ensemble', '#finances', 'gauge'], ['depenses', 'Dépenses', '#finances/depenses', 'wallet'], ['contrats', 'Contrats', '#finances/contrats', 'file-signature'], ['agence', 'Informations légales', '#finances/agence', 'building-2']].map(function (o) {
      return h('a', { href: o[2], class: o[0] === onglet ? 'actif' : null, 'aria-current': o[0] === onglet ? 'page' : null }, U.icone(o[3], 15), o[1])
    })))
    var zone = h('div'); main.append(zone)
    if (onglet === 'agence') return vueAgence(zone)
    if (!enLigne()) { zone.append(U.etatVide('Le centre financier est disponible quand l’administration est connectée à la base.', 'database')); return }
    if (onglet === 'depenses') return vueDepenses(zone)
    if (onglet === 'contrats') return id ? ficheContrat(zone, id) : vueContrats(zone)
    return apercu(zone)
  }

  function apercu(zone) {
    var U = UI(), h = U.h, fmt = U.fmt, G = U.G, t = today()
    Promise.all([S().list('factures'), S().list('clients'), S().devisList(), S().sb.get('payments?select=*&order=date_paiement.desc&limit=2000'), S().sb.get('expenses?deleted_at=is.null&select=*&order=date_depense.desc'), S().sb.get('contracts?deleted_at=is.null&select=id,ref,titre,statut,date_fin,client_id'), S().catalogue()]).then(function (r) {
      var fa = r[0].filter(function (f) { return f.statut !== 'brouillon' }), cl = r[1], dv = r[2], pay = r[3], dep = r[4], ctr = r[5], cat = r[6]
      var an = t.slice(0, 4), moisC = t.slice(0, 7)
      var deLAnnee = fa.filter(function (f) { return (f.date || '').slice(0, 4) === an })
      var caHT = deLAnnee.reduce(function (s, f) { return s + ht(f) }, 0)
      var tvaCol = deLAnnee.reduce(function (s, f) { return s + ttc(f) - ht(f) }, 0)
      var encaisse = pay.filter(function (p) { return (p.date_paiement || '').slice(0, 4) === an }).reduce(function (s, p) { return s + (+p.montant || 0) }, 0)
      var ouvertes = fa.filter(function (f) { return f.statut === 'envoyee' || f.statut === 'retard' })
      // réglé : somme des paiements enregistrés (la base tient aussi f.paye à jour)
      var regle = {}; pay.forEach(function (p) { regle[p.invoice_id] = (regle[p.invoice_id] || 0) + (+p.montant || 0) })
      var reste = function (f) { return Math.max(0, ttc(f) - Math.max(+f.paye || 0, regle[f.id] || 0)) }
      var du = ouvertes.reduce(function (s, f) { return s + reste(f) }, 0)
      // dépenses de l'année (récurrentes : chaque occurrence jusqu'à aujourd'hui ou leur fin)
      function occurrences(e, debut, fin) {
        var pas = { mensuelle: 1, trimestrielle: 3, annuelle: 12 }[e.recurrence], out = [], d = new Date(e.date_depense + 'T12:00:00'), stop = e.fin && e.fin < fin ? e.fin : fin
        if (!pas) return e.date_depense >= debut && e.date_depense <= fin ? [e.date_depense] : []
        while (true) { var iso = d.toISOString().slice(0, 10); if (iso > stop) break; if (iso >= debut) out.push(iso); d.setMonth(d.getMonth() + pas); if (out.length > 400) break }
        return out
      }
      var depAn = dep.reduce(function (s, e) { return s + occurrences(e, an + '-01-01', t).length * (+e.montant_ht || 0) }, 0)
      var marge = caHT - depAn
      var mensuelRecettes = 0
      dv.filter(function (d) { return d.statut === 'accepte' }).forEach(function (d) { mensuelRecettes += S().calc(d).mensuelHT })
      var mensuelCharges = dep.filter(function (e) { return e.recurrence !== 'aucune' && (!e.fin || e.fin >= t) }).reduce(function (s, e) { return s + (+e.montant_ht || 0) / ({ mensuelle: 1, trimestrielle: 3, annuelle: 12 }[e.recurrence] || 1) }, 0)

      zone.append(h('div', { class: 'grille kpi' },
        U.tuile('Chiffre d’affaires ' + an, fmt.euros(caHT), 'HT facturé · TVA collectée ' + fmt.euros(tvaCol), false, { icone: 'euro' }),
        U.tuile('Encaissé ' + an, fmt.euros(encaisse), 'TTC, paiements enregistrés', false, { icone: 'wallet' }),
        U.tuile('Reste à encaisser', fmt.euros(du), fmt.pluriel(ouvertes.length, 'facture') + ' ouverte(s)', ouvertes.some(function (f) { return f.echeance && f.echeance < t }), { icone: 'receipt-text' }),
        U.tuile('Dépenses ' + an, fmt.euros(depAn), 'HT, dont charges récurrentes', false, { icone: 'calculator' }),
        U.tuile('Marge estimée ' + an, fmt.euros(marge), 'CA HT − dépenses HT (estimation)', marge < 0, { icone: 'trending-up', ton: marge >= 0 ? 'bon' : 'attention' }),
        U.tuile('Récurrent mensuel', fmt.euros(mensuelRecettes - mensuelCharges), 'abonnements ' + fmt.euros(mensuelRecettes) + ' − charges ' + fmt.euros(mensuelCharges), false, { icone: 'refresh-cw' })))

      // ---- alertes
      var al = []
      ouvertes.forEach(function (f) {
        var j = f.echeance ? jours(t, f.echeance) : null
        if (j != null && j < 0) al.push({ ic: 'circle-alert', ton: 'critique', t: 'Facture ' + f.ref + ' en retard de ' + fmt.pluriel(-j, 'jour') + ' · ' + eur(reste(f)), h: '#factures/' + f.id })
        else if (j != null && j <= 7) al.push({ ic: 'clock', ton: 'attention', t: 'Facture ' + f.ref + ' à échéance ' + (j ? 'dans ' + fmt.pluriel(j, 'jour') : 'aujourd’hui') + ' · ' + eur(reste(f)), h: '#factures/' + f.id })
        ;(f.echeancier || []).forEach(function (e) { var je = jours(t, e.date); if (je >= 0 && je <= 7) al.push({ ic: 'calendar-clock', ton: 'attention', t: 'Échéance de ' + eur(e.montant) + ' le ' + fmt.date(e.date) + ' (' + f.ref + ')', h: '#factures/' + f.id }) })
      })
      pay.filter(function (p) { return jours(p.date_paiement, t) <= 7 }).slice(0, 5).forEach(function (p) { var f = fa.filter(function (x) { return x.id === p.invoice_id })[0]; al.push({ ic: 'circle-check', ton: 'bon', t: 'Paiement reçu : ' + eur(p.montant) + (f ? ' (' + f.ref + ')' : '') + ' le ' + fmt.date(p.date_paiement), h: f ? '#factures/' + f.id : '#factures' }) })
      dep.filter(function (e) { return e.recurrence === 'annuelle' && (!e.fin || e.fin >= t) }).forEach(function (e) {
        var prochaine = occurrences(e, t, plus(t, 30))[0]; if (prochaine) al.push({ ic: 'refresh-cw', ton: 'attention', t: 'Abonnement à renouveler le ' + fmt.date(prochaine) + ' : ' + (e.libelle || e.fournisseur) + ' (' + eur(e.montant_ht) + ' HT)', h: '#finances/depenses' })
      })
      ctr.filter(function (k) { return k.statut === 'signe' && k.date_fin && jours(t, k.date_fin) >= 0 && jours(t, k.date_fin) <= 30 }).forEach(function (k) { al.push({ ic: 'file-signature', ton: 'attention', t: 'Contrat ' + k.ref + ' arrive à échéance le ' + fmt.date(k.date_fin), h: '#finances/contrats/' + k.id }) })
      var alertes = U.carte('Alertes', al.length ? fmt.pluriel(al.length, 'point') + ' à regarder' : 'tout est à jour', al.length ? h('ul', { class: 'fi-alertes' }, al.map(function (a) { return h('li', { class: a.ton }, U.icone(a.ic, 15), h('a', { href: a.h }, a.t)) })) : U.etatVide('Rien à signaler.', 'circle-check'))

      // ---- échéancier : ce qui doit rentrer dans les 90 jours
      var aVenir = []
      ouvertes.forEach(function (f) {
        if ((f.echeancier || []).length) f.echeancier.forEach(function (e) { if (e.date <= plus(t, 90)) aVenir.push({ d: e.date, m: +e.montant || 0, f: f }) })
        else if (f.echeance) aVenir.push({ d: f.echeance, m: reste(f), f: f })
      })
      aVenir.sort(function (a, b) { return a.d < b.d ? -1 : 1 })
      var echeancier = U.carte('Échéancier des encaissements', '90 prochains jours (et retards)', U.tableau([{ titre: 'Date' }, { titre: 'Facture' }, { titre: 'Client' }, { titre: 'Montant TTC', num: true }],
        aVenir.map(function (x) { return [h('span', { class: x.d < t ? 'pj-retard' : '' }, fmt.date(x.d)), h('a', { href: '#factures/' + x.f.id }, x.f.ref), nomC(x.f.client), eur(x.m)] }), { vide: 'Aucun encaissement attendu.', legende: 'Échéancier' }))
      zone.append(h('div', { class: 'rangee r11' }, alertes, echeancier))

      // ---- revenus par client et par prestation (année en cours)
      var parClient = {}; deLAnnee.forEach(function (f) { var k = f.clientId || nomC(f.client); parClient[k] = (parClient[k] || 0) + ht(f) })
      var nomDe = function (k) { var c = cl.filter(function (x) { return x.id === k })[0]; return c ? nomC(c) : k }
      var lc = Object.keys(parClient).sort(function (a, b) { return parClient[b] - parClient[a] }).slice(0, 10).map(function (k) { return { libelle: nomDe(k), valeur: parClient[k] } })
      var fam = {}; cat.forEach(function (g) { g.items.forEach(function (it) { fam[it.id] = g.nom.replace(/\s*\(.*\)$/, '') }) })
      var parPresta = {}; deLAnnee.forEach(function (f) { var rm = 1 - Math.min(Math.max(+f.remise || 0, 0), 100) / 100; (f.lignes || []).forEach(function (l) { if (l.option && !l.choisie) return; var k = fam[l.itemId] || (l.itemId === 'acompte' ? 'Acomptes' : 'Autres prestations'); parPresta[k] = (parPresta[k] || 0) + (+l.prix || 0) * (+l.qty || 0) * rm }) })
      var lp = Object.keys(parPresta).map(function (k) { return { libelle: k, valeur: parPresta[k] } }).sort(function (a, b) { return b.valeur - a.valeur })
      zone.append(h('div', { class: 'rangee r11' },
        U.carte('Revenus par client', an + ', HT facturé', lc.length ? G.barres(lc, { format: fmt.euros, description: 'Revenus par client' }) : U.etatVide('Aucune facture cette année.', 'users')),
        U.carte('Rentabilité par prestation', an + ', HT facturé par famille du catalogue', lp.length ? G.barres(lp, { format: fmt.euros, description: 'Chiffre d’affaires par prestation' }) : U.etatVide('Aucune facture cette année.', 'chart-column'))))

      // ---- exports comptables
      function csv(nom, entetes, lignes) {
        var q = function (v) { v = v == null ? '' : String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v }
        var n = function (v) { return typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : v }
        var txt = '﻿' + [entetes].concat(lignes).map(function (l) { return l.map(function (v) { return q(n(v)) }).join(';') }).join('\r\n')
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' })); a.download = nom + '-' + t + '.csv'; document.body.append(a); a.click(); a.remove()
        if (S().rpc) S().rpc('log_event', { kind: 'export', detail: { fichier: nom } }).catch(function () {})
        U.toast('Export téléchargé.', 'bon')
      }
      zone.append(U.carte('Exports comptables', 'CSV lisibles par Excel et par votre expert-comptable', h('div', { class: 'cta' },
        h('button', { class: 'btn', type: 'button', onclick: function () { csv('factures', ['Numéro', 'Type', 'Date', 'Échéance', 'Client', 'Statut', 'Total HT', 'TVA', 'Total TTC', 'Réglé', 'Reste'], r[0].map(function (f) { var a = ht(f), b = ttc(f); return [f.ref, lab(TYPES_F, f.type || 'facture'), f.date, f.echeance, nomC(f.client), f.statut, a, b - a, b, +f.paye || 0, Math.max(0, b - (+f.paye || 0))] })) } }, U.icone('download', 15), 'Factures et avoirs'),
        h('button', { class: 'btn', type: 'button', onclick: function () { csv('paiements', ['Date', 'Facture', 'Client', 'Mode', 'Référence', 'Montant TTC'], pay.map(function (p) { var f = r[0].filter(function (x) { return x.id === p.invoice_id })[0]; return [p.date_paiement, f ? f.ref : '', f ? nomC(f.client) : '', lab(MODES, p.mode), p.reference, +p.montant] })) } }, U.icone('download', 15), 'Paiements'),
        h('button', { class: 'btn', type: 'button', onclick: function () { csv('depenses', ['Date', 'Fournisseur', 'Catégorie', 'Libellé', 'Montant HT', 'TVA %', 'Montant TTC', 'Récurrence'], dep.map(function (e) { return [e.date_depense, e.fournisseur, lab(CAT_DEP, e.categorie), e.libelle, +e.montant_ht, +e.taux_tva, (+e.montant_ht) * (1 + (+e.taux_tva) / 100), lab(RECUR, e.recurrence)] })) } }, U.icone('download', 15), 'Dépenses')),
        h('p', { class: 'discret' }, U.icone('info', 13), ' Le paiement en ligne (Stripe) n’est pas encore connecté : les paiements sont saisis à la main dans chaque facture.')))
    }).catch(function (er) { zone.append(h('p', { class: 'msg' }, 'Données indisponibles : ' + er.message)) })
  }

  function vueDepenses(zone) {
    var U = UI(), h = U.h, fmt = U.fmt
    Promise.all([S().sb.get('expenses?deleted_at=is.null&select=*&order=date_depense.desc'), S().list('projets')]).then(function (r) {
      var dep = r[0], pr = r[1]
      var f = { date: h('input', { type: 'date', value: today() }), fournisseur: h('input', { maxlength: '160', placeholder: 'ex. OVH' }), categorie: h('select', {}, CAT_DEP.map(function (c) { return h('option', { value: c[0] }, c[1]) })),
        libelle: h('input', { maxlength: '300', placeholder: 'ex. Hébergement serveur' }), montant: h('input', { type: 'number', min: '0', step: '0.01' }), tva: h('input', { type: 'number', min: '0', max: '30', step: '0.1', value: '20' }),
        recurrence: h('select', {}, RECUR.map(function (c) { return h('option', { value: c[0] }, c[1]) })), fin: h('input', { type: 'date' }),
        projet: h('select', {}, h('option', { value: '' }, '— Aucun —'), pr.map(function (p) { return h('option', { value: p.id }, p.titre || 'Projet') })) }
      var champ = function (l, i) { return h('label', {}, l, i) }
      zone.append(U.carte('Ajouter une dépense', 'ponctuelle ou récurrente (abonnements, hébergement, logiciels…)', h('div', { class: 'pj-grille' }, champ('Date', f.date), champ('Fournisseur', f.fournisseur), champ('Catégorie', f.categorie), champ('Libellé', f.libelle), champ('Montant HT (€)', f.montant), champ('TVA (%)', f.tva), champ('Récurrence', f.recurrence), champ('Fin (récurrente)', f.fin), champ('Projet lié', f.projet)),
        h('div', { class: 'cta' }, h('button', { class: 'btn principal', type: 'button', onclick: function () {
          if (!(+f.montant.value >= 0) || f.montant.value === '') { U.toast('Indiquez un montant.', 'erreur'); f.montant.focus(); return }
          S().sb.post('expenses', { date_depense: f.date.value || today(), fournisseur: f.fournisseur.value.trim(), categorie: f.categorie.value, libelle: f.libelle.value.trim(), montant_ht: Math.round(+f.montant.value * 100) / 100, taux_tva: +f.tva.value || 0, recurrence: f.recurrence.value, fin: f.fin.value || null, project_id: f.projet.value || null })
            .then(function () { U.toast('Dépense enregistrée.', 'bon'); K().route() }).catch(function (er) { U.toast('Impossible : ' + er.message, 'erreur') })
        } }, U.icone('plus', 15), 'Enregistrer la dépense'))))
      var total = dep.reduce(function (s, e) { return s + (+e.montant_ht || 0) }, 0)
      zone.append(U.carte('Dépenses', fmt.pluriel(dep.length, 'ligne') + ' · ' + eur(total) + ' HT (montants unitaires)', dep.length ? U.tableauInteractif(
        [{ titre: 'Date' }, { titre: 'Fournisseur' }, { titre: 'Catégorie' }, { titre: 'Libellé' }, { titre: 'Montant HT', num: true }, { titre: 'TVA', num: true }, { titre: 'Récurrence' }, { titre: 'Projet' }, { titre: '' }],
        dep.map(function (e) {
          var p = pr.filter(function (x) { return x.id === e.project_id })[0]
          return [fmt.date(e.date_depense), e.fournisseur || '—', lab(CAT_DEP, e.categorie), e.libelle || '—', eur(e.montant_ht), (+e.taux_tva).toLocaleString('fr-FR') + ' %', lab(RECUR, e.recurrence) + (e.fin ? ' jusqu’au ' + fmt.date(e.fin) : ''), p ? h('a', { href: '#projets/' + p.id }, p.titre) : '—',
            h('button', { class: 'btn lien petit', type: 'button', onclick: function () { U.confirmer({ titre: 'Retirer cette dépense ?', texte: 'Elle est mise à la corbeille.', bouton: 'Retirer', danger: true }).then(function (ok) { if (ok) S().sb.patch('expenses?id=eq.' + encodeURIComponent(e.id), { deleted_at: new Date().toISOString() }).then(function () { K().route() }) }) } }, 'Retirer')]
        }), { placeholder: 'Rechercher une dépense…', legende: 'Dépenses', nom: 'dépense' }).element : U.etatVide('Aucune dépense enregistrée.', 'wallet')))
    }).catch(function (er) { zone.append(h('p', { class: 'msg' }, 'Dépenses indisponibles : ' + er.message)) })
  }

  var ST_CTR = [['brouillon', 'Brouillon', ''], ['envoye', 'À signer', 'attention'], ['signe', 'Signé', 'bon'], ['refuse', 'Refusé', 'critique']]
  function vueContrats(zone) {
    var U = UI(), h = U.h, fmt = U.fmt
    Promise.all([S().sb.get('contracts?deleted_at=is.null&select=id,ref,titre,statut,client_id,date_debut,date_fin,created_at,signature&order=created_at.desc'), S().list('clients')]).then(function (r) {
      var cl = r[1]
      zone.append(U.carte('Contrats', fmt.pluriel(r[0].length, 'contrat') + ' · préparez-en un depuis un devis (bouton « Préparer le contrat »)', r[0].length ? U.tableau([{ titre: 'Numéro' }, { titre: 'Titre' }, { titre: 'Client' }, { titre: 'Statut' }, { titre: 'Début' }, { titre: 'Fin' }, { titre: 'Signé le' }],
        r[0].map(function (k) { var st = ST_CTR.filter(function (x) { return x[0] === k.statut })[0] || ST_CTR[0]; return [h('a', { href: '#finances/contrats/' + k.id }, k.ref || '—'), k.titre, nomC(cl.filter(function (c) { return c.id === k.client_id })[0]), U.badge(st[1], st[2]), fmt.date(k.date_debut), fmt.date(k.date_fin), k.signature ? fmt.date(k.signature.le) : '—'] }), { legende: 'Contrats' }) : U.etatVide('Aucun contrat. Ouvrez un devis et cliquez sur « Préparer le contrat ».', 'file-signature'),
        h('p', { class: 'discret' }, U.icone('info', 13), ' Signature électronique simple dans l’espace client (nom, accord, date, empreinte du texte). Un prestataire de signature certifiée (Yousign, DocuSeal…) n’est pas encore connecté.')))
    }).catch(function (er) { zone.append(h('p', { class: 'msg' }, 'Contrats indisponibles : ' + er.message)) })
  }

  function ficheContrat(zone, id) {
    var U = UI(), h = U.h, fmt = U.fmt
    Promise.all([S().sb.get('contracts?id=eq.' + encodeURIComponent(id) + '&select=*'), S().list('clients')]).then(function (r) {
      var k = r[0][0]; if (!k) { zone.append(U.etatVide('Contrat introuvable.', 'file-signature')); return }
      var client = r[1].filter(function (c) { return c.id === k.client_id })[0]
      var signe = k.statut === 'signe'
      var titre = h('input', { value: k.titre, maxlength: '200', disabled: signe }), debut = h('input', { type: 'date', value: k.date_debut || '', disabled: signe }), fin = h('input', { type: 'date', value: k.date_fin || '', disabled: signe })
      var texte = h('textarea', { rows: '22', maxlength: '60000', disabled: signe, class: 'fi-contrat' }); texte.value = k.contenu
      var st = ST_CTR.filter(function (x) { return x[0] === k.statut })[0] || ST_CTR[0]
      function enreg(extra) { return S().sb.patch('contracts?id=eq.' + encodeURIComponent(k.id), Object.assign({ titre: titre.value.trim() || k.titre, date_debut: debut.value || null, date_fin: fin.value || null, contenu: texte.value }, extra || {})) }
      zone.append(h('p', {}, h('a', { href: '#finances/contrats' }, '← Tous les contrats')),
        h('section', { class: 'carte fi-carte' }, h('header', {}, h('h2', {}, (k.ref || 'Contrat') + ' · ' + nomC(client)), U.badge(st[1], st[2])),
          k.signature ? h('div', { class: 'fi-ok' }, U.icone('circle-check', 18), h('div', {}, h('b', {}, 'Signé le ' + fmt.dateHeure(k.signature.le) + ' par ' + k.signature.signataire), h('span', {}, k.signature.methode || ''), h('small', { class: 'discret' }, 'Empreinte du texte signé : ' + k.signature.version))) : null,
          h('div', { class: 'pj-grille' }, h('label', {}, 'Titre', titre), h('label', {}, 'Début', debut), h('label', {}, 'Fin (échéance)', fin), h('label', { class: 'pj-large' }, 'Texte du contrat', texte)),
          h('div', { class: 'cta' },
            !signe ? h('button', { class: 'btn principal', type: 'button', onclick: function () { enreg().then(function () { U.toast('Contrat enregistré.', 'bon') }, function (er) { U.toast(er.message, 'erreur') }) } }, 'Enregistrer') : null,
            k.statut === 'brouillon' ? h('button', { class: 'btn', type: 'button', onclick: function () {
              if (!k.client_id) { U.toast('Ce contrat n’est relié à aucun client.', 'erreur'); return }
              U.confirmer({ titre: 'Envoyer le contrat au client ?', texte: 'Il le lira et le signera depuis son espace. Une fois signé, le texte ne peut plus changer.', bouton: 'Envoyer' }).then(function (ok) { if (ok) enreg({ statut: 'envoye' }).then(function () { U.toast('Contrat envoyé au client.', 'bon'); K().route() }) })
            } }, U.icone('send', 15), 'Envoyer pour signature') : null,
            k.statut === 'envoye' ? h('button', { class: 'btn', type: 'button', onclick: function () { enreg({ statut: 'brouillon' }).then(function () { K().route() }) } }, 'Retirer l’envoi') : null,
            h('button', { class: 'btn', type: 'button', onclick: function () { agence().then(function (a) { imprimer(htmlContrat(Object.assign({}, k, { titre: titre.value, contenu: texte.value, date_debut: debut.value, date_fin: fin.value }), a, client)) }) } }, U.icone('file-down', 15), 'PDF'),
            !signe ? h('button', { class: 'btn', type: 'button', onclick: function () { U.confirmer({ titre: 'Mettre ce contrat à la corbeille ?', texte: 'La direction peut le restaurer.', bouton: 'Corbeille', danger: true }).then(function (ok) { if (ok) S().sb.patch('contracts?id=eq.' + encodeURIComponent(k.id), { deleted_at: new Date().toISOString() }).then(function () { K().go('finances/contrats') }) }) } }, 'Corbeille') : null)))
    }).catch(function (er) { zone.append(h('p', { class: 'msg' }, 'Contrat indisponible : ' + er.message)) })
  }

  function vueAgence(zone) {
    var U = UI(), h = U.h
    agence().then(function (a) {
      var f = {}; var champ = function (k, l, large, area) { f[k] = area ? h('textarea', { rows: '3' }) : h('input', { value: a[k] || '' }); if (area) f[k].value = a[k] || ''; return h('label', { class: large ? 'pj-large' : null }, l, f[k]) }
      zone.append(U.carte('Informations légales', 'elles apparaissent sur les devis, factures et contrats en PDF', h('div', { class: 'pj-grille' },
        champ('nom', 'Raison sociale'), champ('siret', 'SIRET'), champ('tvaIntra', 'N° de TVA intracommunautaire'), champ('email', 'E-mail'), champ('tel', 'Téléphone'), champ('iban', 'IBAN'), champ('bic', 'BIC'), champ('adresse', 'Adresse', true, true), champ('mentions', 'Mentions de bas de page (forme juridique, capital, RCS…)', true)),
        h('div', { class: 'cta' }, h('button', { class: 'btn principal', type: 'button', onclick: function () {
          var n = {}; Object.keys(f).forEach(function (k) { n[k] = f[k].value.trim() })
          sauverAgence(n).then(function () { U.toast('Informations enregistrées.', 'bon') }, function (er) { U.toast('Impossible : ' + er.message, 'erreur') })
        } }, 'Enregistrer')),
        h('p', { class: 'discret' }, 'Vérifiez avec votre expert-comptable les mentions obligatoires de vos factures.')))
    })
  }

  M.devisExtra = devisExtra
  M.factureExtra = factureExtra
  M.finances = finances
  M.financesOutils = { htmlDevis: htmlDevis, htmlFacture: htmlFacture, htmlContrat: htmlContrat, texteContrat: texteContrat, esc: esc }
})()
