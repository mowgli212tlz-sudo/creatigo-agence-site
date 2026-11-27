/* Rapport d'activité imprimable (direction) : bilan de la période, impayés, projets à risque, devis à relancer, avec les chiffres réels de /api/jarvis-rapport.
   « Imprimer / Enregistrer en PDF » utilise l'impression du navigateur (choisir « Enregistrer au format PDF »). Tout texte passe par textContent. */
(function () {
  function apiJarvis(n) { var b = window.CREATIGO_SB && window.CREATIGO_SB.api; return (b ? String(b).replace(/\/$/, '') : '/api') + '/' + n }
  var UI = window.UI, S = window.CreatigoStore
  if (!UI || !S) return
  var h = UI.h, ic = UI.icone
  var NOMS = { semaine: 'de la semaine', mois: 'du mois', trimestre: 'du trimestre', annee: 'de l’année' }
  var eur = function (n) { return (Math.round((+n || 0) * 100) / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) }
  var jour = function (iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—' }
  var pct = function (v) { return v === null || v === undefined ? '' : (v > 0 ? '▲ ' : v < 0 ? '▼ ' : '= ') + Math.abs(v) + ' %' }
  var racine = null

  function kpi(titre, valeur, v) { return h('div', { class: 'jr-kpi' }, h('small', {}, titre), h('b', {}, valeur), v === null || v === undefined ? null : h('span', { class: 'jr-var ' + (v > 0 ? 'haut' : v < 0 ? 'bas' : '') }, pct(v) + ' vs période précédente')) }
  function barres(titre, a, b, fmt) {
    var max = Math.max(a, b, 1)
    return h('div', { class: 'jr-barres' }, h('b', {}, titre),
      [['Période en cours', a, 'actuel'], ['Période précédente', b, 'avant']].map(function (x) { return h('div', { class: 'jr-barre' }, h('span', {}, x[0]), h('div', { class: 'jr-piste' }, h('i', { class: x[2], style: 'width:' + Math.max(2, Math.round(100 * x[1] / max)) + '%' })), h('em', {}, fmt(x[1]))) }))
  }
  // répartition des impayés par ancienneté de retard : une barre empilée lisible d'un coup d'œil
  function anciennete(i) {
    var t = i.par_anciennete_TTC, total = Math.max(i.solde_total_TTC, 1)
    var tr = [['Pas échu', t.pas_echu, 'a0'], ['1 à 30 j', t.de_1_a_30_j, 'a1'], ['31 à 60 j', t.de_31_a_60_j, 'a2'], ['Plus de 60 j', t.plus_de_60_j, 'a3']]
    return h('section', { class: 'jr-bloc' }, h('h3', {}, 'Impayés par ancienneté'),
      h('div', { class: 'jr-pile' }, tr.filter(function (x) { return x[1] > 0 }).map(function (x) { return h('i', { class: x[2], style: 'flex:' + x[1], title: x[0] + ' : ' + eur(x[1]) }) })),
      h('ul', { class: 'jr-legende' }, tr.map(function (x) { return h('li', {}, h('span', { class: 'jr-pt ' + x[2] }), x[0] + ' : ', h('b', {}, eur(x[1]))) })))
  }
  function tableau(titre, colonnes, lignes, vide) {
    return h('section', { class: 'jr-bloc' }, h('h3', {}, titre), lignes.length ? h('table', {}, h('thead', {}, h('tr', {}, colonnes.map(function (c) { return h('th', {}, c) }))), h('tbody', {}, lignes.map(function (l) { return h('tr', {}, l.map(function (c) { return h('td', {}, String(c)) })) }))) : h('p', { class: 'jr-vide' }, vide))
  }
  function corps(d) {
    var e = d.en_cours, p = d.precedente, v = d.variation_pct || {}
    return [
      h('section', { class: 'jr-bloc' }, h('h3', {}, 'Points clés'), h('ul', { class: 'jr-points' }, d.points.map(function (t) { return h('li', {}, t) }))),
      h('section', { class: 'jr-bloc' }, h('h3', {}, 'Chiffres de la période'), h('div', { class: 'jr-kpis' },
        kpi('Facturé HT', eur(e.facture_HT), v.facture_HT), kpi('Encaissé TTC', eur(e.encaisse_TTC), v.encaisse_TTC), kpi('Devis acceptés', String(e.devis_acceptes), v.devis_acceptes),
        kpi('Devis créés', String(e.devis_crees), v.devis_crees), kpi('Nouveaux clients', String(e.nouveaux_clients), v.nouveaux_clients), kpi('Projets livrés', String(e.projets_livres), v.projets_livres),
        kpi('Rendez-vous réalisés', String(e.rdv_realises), v.rdv_realises), kpi('Messages du site', String(e.messages_site), v.messages_site)),
        h('div', { class: 'jr-graphes' }, barres('Facturé HT', e.facture_HT, p.facture_HT, eur), barres('Encaissé TTC', e.encaisse_TTC, p.encaisse_TTC, eur))),
      d.impayes && d.impayes.total_factures ? anciennete(d.impayes) : null,
      tableau('Impayés' + (d.impayes ? ' · ' + eur(d.impayes.solde_total_TTC) + ' TTC' : ''), ['Facture', 'Client', 'Échéance', 'Retard', 'Solde TTC'],
        ((d.impayes && d.impayes.factures) || []).slice(0, 12).map(function (f) { return [f.ref || '', f.client || '', jour(f.echeance), f.jours_de_retard ? f.jours_de_retard + ' j' : 'pas échue', eur(f.solde_TTC)] }), 'Aucune facture impayée.'),
      tableau('Projets à risque', ['Projet', 'Client', 'Niveau', 'Avancement', 'Raisons'],
        ((d.risques && d.risques.projets) || []).slice(0, 8).map(function (x) { return [x.projet, x.client || '', x.niveau, x.avancement + ' %', (x.raisons || []).slice(0, 2).join(' · ')] }), 'Aucun projet à risque notable.'),
      tableau('Devis à relancer' + (d.devis ? ' · ' + eur(d.devis.en_jeu_HT) + ' HT en jeu' : ''), ['Devis', 'Client', 'Envoyé depuis', 'Total HT'],
        ((d.devis && d.devis.devis) || []).slice(0, 10).map(function (x) { return [x.ref || '', x.client || '', x.envoye_depuis_jours + ' j', eur(x.total_HT)] }), 'Aucun devis en attente de réponse.'),
      h('p', { class: 'jr-pied' }, 'Généré par Jarvis le ' + jour(d.genere_le) + ' à partir des données de la plateforme. ' + (d.remarque || ''))
    ]
  }
  function fermer() { if (racine) { racine.remove(); racine = null; document.documentElement.classList.remove('jr-ouvert') } }
  function ouvrir(periode) {
    fermer()
    var contenu = h('div', { class: 'jr-feuille' }, h('p', { class: 'jr-vide' }, 'Préparation du rapport…'))
    var barre = h('div', { class: 'jr-barre-outils' }, h('b', {}, 'Rapport d’activité'),
      h('div', {}, h('button', { type: 'button', class: 'jr-btn', onclick: function () { window.print() } }, ic('printer', 15), 'Imprimer / PDF'), h('button', { type: 'button', class: 'jr-btn clair', onclick: fermer }, 'Fermer')))
    racine = h('div', { class: 'jr-racine', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Rapport d’activité' }, barre, contenu)
    document.body.append(racine); document.documentElement.classList.add('jr-ouvert')
    racine.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer() }); racine.tabIndex = -1; racine.focus()
    return S.auth.token().then(function (jeton) { return fetch(apiJarvis('jarvis-rapport') + '?periode=' + encodeURIComponent(periode || 'mois'), { headers: { Authorization: 'Bearer ' + jeton } }) })
      .then(function (r) { return r.json().catch(function () { return {} }).then(function (j) { if (!r.ok) throw new Error(j.erreur || 'Rapport indisponible.'); return j }) })
      .then(function (d) {
        contenu.replaceChildren(h('header', { class: 'jr-couv' },
          h('div', { class: 'jr-couv-haut' }, h('span', { class: 'jr-logo' }, h('img', { src: '../assets/logo.svg', alt: '', width: '34', height: '34' }), h('b', {}, 'Creati', h('em', {}, 'go'))), h('span', { class: 'jr-conf' }, 'Confidentiel · usage interne')),
          h('h2', {}, 'Rapport d’activité ' + (NOMS[d.periode] || '')),
          h('p', { class: 'jr-periode' }, 'Du ' + jour(d.du) + ' au ' + jour(d.au)), h('p', { class: 'jr-compare' }, 'Comparé à la période précédente (' + jour(d.precedente.du) + ' – ' + jour(d.precedente.au) + ')')),
          ...corps(d))
        return { ok: true, periode: d.periode }
      }).catch(function (e) { contenu.replaceChildren(h('p', { class: 'jr-vide' }, e.message)); return { ok: false, erreur: e.message } })
  }
  window.RapportJarvis = { ouvrir: ouvrir, fermer: fermer }
})()
