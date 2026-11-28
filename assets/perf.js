/* Performances digitales (phase 7), commun à l'admin et à l'espace client.
   Uniquement des mesures RÉELLES : importées depuis les exports des outils (Google Analytics, Search Console, Google Ads, Meta…),
   saisies par l'équipe ou mesurées (Google PageSpeed). Sans donnée : « Non connecté », jamais un chiffre inventé. */
(function () {
  var SOURCES = {
    site: { l: 'Site web', ic: 'globe', def: 'Google Analytics 4',
      kpis: [{ c: 'visites', l: 'Visites' }, { c: 'visiteurs', l: 'Visiteurs uniques' }, { c: 'conversions', l: 'Conversions' },
        { c: 'score_mobile', l: 'Performance technique (mobile)', agg: 'dernier', f: 'score' }, { c: 'lcp_ms', l: 'Affichage principal (LCP)', agg: 'dernier', f: 'ms', inverse: true }],
      courbe: ['visites', 'visiteurs'], tops: [{ c: 'vues', l: 'Pages les plus consultées' }, { c: 'visites', l: 'Sources du trafic' }] },
    seo: { l: 'Référencement naturel (SEO)', ic: 'search', def: 'Google Search Console',
      kpis: [{ c: 'impressions', l: 'Impressions Google' }, { c: 'clics', l: 'Clics' }, { c: 'ctr', l: 'CTR', calc: function (v) { return v.impressions ? v.clics / v.impressions * 100 : null }, f: 'pct' },
        { c: 'position', l: 'Position moyenne', agg: 'moyenne', f: 'dec', inverse: true }, { c: 'pages_indexees', l: 'Pages indexées', agg: 'dernier' }],
      courbe: ['clics', 'impressions'], tops: [{ c: 'position', l: 'Positions des mots-clés', agg: 'dernier', f: 'dec', inverse: true }] },
    geo: { l: 'Visibilité IA (GEO)', ic: 'sparkles', def: 'Suivi des moteurs IA (ChatGPT, Perplexity, Gemini…)',
      kpis: [{ c: 'presence', l: 'Présence dans les réponses IA', dim: true, agg: 'moyenne', f: 'part' }, { c: 'mentions', l: 'Mentions de la marque' },
        { c: 'requetes', l: 'Requêtes suivies', calc: function (v, r) { return r.requetes || null } }],
      courbe: ['mentions'], tops: [{ c: 'presence', l: 'Présence par requête suivie', agg: 'moyenne', f: 'part' }] },
    ads: { l: 'Google Ads', ic: 'megaphone', def: 'Google Ads',
      kpis: [{ c: 'depenses', l: 'Dépenses', f: 'euros' }, { c: 'clics', l: 'Clics' }, { c: 'impressions', l: 'Impressions' },
        { c: 'cpc', l: 'CPC moyen', calc: function (v) { return v.clics ? v.depenses / v.clics : null }, f: 'euros2', inverse: true }, { c: 'conversions', l: 'Conversions' },
        { c: 'cpa', l: 'Coût par acquisition', calc: function (v) { return v.conversions ? v.depenses / v.conversions : null }, f: 'euros2', inverse: true }],
      courbe: ['clics', 'conversions'], tops: [{ c: 'depenses', l: 'Dépenses par campagne', f: 'euros' }] },
    social: { l: 'Réseaux sociaux', ic: 'users-round', def: 'Meta Business Suite / LinkedIn',
      kpis: [{ c: 'abonnes', l: 'Abonnés', agg: 'dernier' }, { c: 'portee', l: 'Portée' }, { c: 'engagement', l: 'Engagements' }, { c: 'publications', l: 'Publications' },
        { c: 'taux', l: 'Taux d’engagement', calc: function (v) { return v.portee ? v.engagement / v.portee * 100 : null }, f: 'pct' }],
      courbe: ['portee', 'engagement'], tops: [{ c: 'portee', l: 'Performances des campagnes' }] },
  }
  var STATUTS = { non_connecte: ['Non connecté', ''], import: ['Données importées', 'info'], connecte: ['Connecté', 'bon'], erreur: ['Erreur de connexion', 'critique'] }

  function nb(n, d) { return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }) }
  function format(f, v) {
    if (v === null || v === undefined || isNaN(v)) return '–'
    return f === 'euros' ? nb(v) + ' €' : f === 'euros2' ? nb(v, 2) + ' €' : f === 'pct' ? nb(v, 1) + ' %' : f === 'part' ? nb(v * 100, 0) + ' %'
      : f === 'score' ? nb(v) + ' / 100' : f === 'ms' ? nb(v / 1000, 1) + ' s' : f === 'dec' ? nb(v, 1) : nb(v)
  }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
  function ajout(j, n) { var d = new Date(j + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d) }

  // agrège une métrique sur une période
  function agreger(rows, agg) {
    if (!rows.length) return null
    if (agg === 'dernier') { var r = rows.slice().sort(function (a, b) { return a.jour < b.jour ? -1 : 1 }); return +r[r.length - 1].valeur }
    var s = rows.reduce(function (t, x) { return t + (+x.valeur || 0) }, 0)
    return agg === 'moyenne' ? s / rows.length : s
  }
  function valeurs(def, rows) {
    var v = {}, info = {}
    def.kpis.forEach(function (k) { if (k.calc) return; v[k.c] = agreger(rows.filter(function (x) { return x.metrique === k.c && (k.dim ? x.dimension !== '' : x.dimension === '') }), k.agg) })
    info.requetes = {}; rows.forEach(function (x) { if (x.metrique === 'presence' && x.dimension) info.requetes[x.dimension] = 1 }); info.requetes = Object.keys(info.requetes).length
    def.kpis.forEach(function (k) { if (k.calc) v[k.c] = k.calc(v, info) })
    return v
  }

  // CSV : date;metrique;valeur[;dimension]  (séparateur ; , ou tabulation ; date AAAA-MM-JJ ou JJ/MM/AAAA ; décimales , ou .)
  function lireCsv(texte) {
    var lignes = [], erreurs = []
    String(texte || '').replace(/^﻿/, '').split(/\r?\n/).forEach(function (l, i) {
      if (!l.trim()) return
      var sep = l.indexOf('\t') >= 0 ? '\t' : l.indexOf(';') >= 0 ? ';' : ','
      var c = l.split(sep).map(function (x) { return x.trim().replace(/^"|"$/g, '') })
      if (i === 0 && !/\d/.test(c[0])) return   // en-tête
      var j = c[0], m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(j); if (m) j = m[3] + '-' + m[2] + '-' + m[1]
      var met = (c[1] || '').toLowerCase(), val = Number(String(c[2] || '').replace(/\s/g, '').replace('%', '').replace(',', '.'))
      if (!/^\d{4}-\d{2}-\d{2}$/.test(j) || isNaN(Date.parse(j))) { erreurs.push('Ligne ' + (i + 1) + ' : date invalide'); return }
      if (!/^[a-z][a-z0-9_]{0,39}$/.test(met)) { erreurs.push('Ligne ' + (i + 1) + ' : métrique invalide'); return }
      if (c[2] === undefined || c[2] === '' || isNaN(val)) { erreurs.push('Ligne ' + (i + 1) + ' : valeur invalide'); return }
      lignes.push({ jour: j, metrique: met, valeur: val, dimension: (c[3] || '').slice(0, 300) })
    })
    return { lignes: lignes, erreurs: erreurs }
  }

  // une rubrique (source) : état, indicateurs comparés à la période précédente, courbe, classements
  function rubrique(ctx, src, source, mesures, jours, aujourdhui) {
    var h = ctx.h, UI = ctx.UI, G = ctx.G, def = SOURCES[src]
    var st = STATUTS[(source && source.statut) || 'non_connecte'] || STATUTS.non_connecte
    var rows = mesures.filter(function (x) { return x.source === src })
    var fournisseur = (source && source.fournisseur) || def.def
    var tete = h('div', { class: 'pf-tete' }, h('h2', {}, UI.icone(def.ic, 18), def.l), UI.badge(rows.length ? st[0] : 'Non connecté', rows.length ? st[1] : ''))
    if (!rows.length) {
      return h('section', { class: 'carte pf-rubrique' }, tete,
        h('div', { class: 'pf-vide' }, UI.icone('database', 22), h('div', {}, h('b', {}, 'Non connecté'),
          h('p', { class: 'discret' }, fournisseur + ' n’est pas encore relié. Les chiffres apparaîtront ici dès l’arrivée des premières données réelles ; rien n’est estimé en attendant.'))))
    }
    var debut = ajout(aujourdhui, -jours + 1), avant = ajout(debut, -jours)
    var cur = rows.filter(function (x) { return x.jour >= debut && x.jour <= aujourdhui }), prev = rows.filter(function (x) { return x.jour >= avant && x.jour < debut })
    var derniere = rows.reduce(function (m, x) { return x.jour > m ? x.jour : m }, '')
    var info = h('p', { class: 'discret pf-source' }, 'Source : ' + fournisseur + (source && source.maj ? ' · données mises à jour le ' + new Date(source.maj).toLocaleDateString('fr-FR') : '') + ' · dernière mesure du ' + derniere.split('-').reverse().join('/'))
    if (!cur.length) return h('section', { class: 'carte pf-rubrique' }, tete, info, UI.etatVide('Aucune mesure sur cette période.', 'chart-column'))
    var v = valeurs(def, cur), vp = prev.length ? valeurs(def, prev) : {}
    var tuiles = h('div', { class: 'grille kpi' }, def.kpis.filter(function (k) { return v[k.c] !== null && v[k.c] !== undefined }).map(function (k) {
      var d = null
      if (vp[k.c] !== null && vp[k.c] !== undefined && vp[k.c] !== 0 && k.agg !== 'dernier') {
        var e = (v[k.c] - vp[k.c]) / Math.abs(vp[k.c]) * 100, bon = k.inverse ? e < 0 : e > 0
        d = UI.delta((e > 0 ? '+' : e < 0 ? '−' : '') + nb(Math.abs(e), 1) + ' %', Math.abs(e) < 0.05 ? 'neutre' : bon ? 'haut' : 'bas')
      }
      return UI.tuile(k.l, format(k.f, v[k.c]), d ? 'vs période précédente' : '', false, { delta: d })
    }))
    var corps = [tete, info, tuiles]
    // courbe : par jour (≤ 90 jours) ou par mois
    var series = def.courbe.filter(function (c) { return cur.some(function (x) { return x.metrique === c && x.dimension === '' }) })
    if (series.length) {
      // regroupement : jour (30 j), semaine (90 j), mois (12 mois) ; la courbe commence et finit aux vraies mesures (pas de zéros inventés)
      var pts = cur.filter(function (x) { return x.dimension === '' && series.indexOf(x.metrique) >= 0 })
      var d1 = pts.reduce(function (m, x) { return x.jour < m ? x.jour : m }, aujourdhui), d2 = pts.reduce(function (m, x) { return x.jour > m ? x.jour : m }, debut)
      var cle = function (j) { if (jours > 90) return j.slice(0, 7); if (jours <= 31) return j; var d = new Date(j + 'T12:00:00'); return ajout(j, -((d.getDay() + 6) % 7)) }
      var cles = [], idx = {}
      for (var j = d1; j <= d2; j = ajout(j, 1)) { var k = cle(j); if (!(k in idx)) { idx[k] = cles.length; cles.push({ x: jours > 90 ? k.slice(5) + '/' + k.slice(2, 4) : k.slice(8) + '/' + k.slice(5, 7) }) } }
      pts.forEach(function (x) { var l = cles[idx[cle(x.jour)]]; if (l) l[x.metrique] = (l[x.metrique] || 0) + (+x.valeur || 0) })
      var noms = {}; def.kpis.forEach(function (k) { noms[k.c] = k.l })
      corps.push(h('div', { class: 'pf-courbe' }, G.airesLisses(cles, series.map(function (c, i) { return { cle: c, libelle: noms[c] || c, couleur: 'var(--serie-' + (i + 1) + ')' } }), { format: function (n) { return nb(n) }, description: def.l + ' sur la période' })))
    }
    var tops = def.tops.map(function (t) {
      var par = {}; cur.forEach(function (x) { if (x.metrique === t.c && x.dimension) (par[x.dimension] = par[x.dimension] || []).push(x) })
      var l = Object.keys(par).map(function (d) { return { libelle: d, valeur: agreger(par[d], t.agg) } })
      if (!l.length) return null
      l.sort(function (a, b) { return t.inverse ? a.valeur - b.valeur : b.valeur - a.valeur })
      return h('div', { class: 'pf-top' }, h('h3', {}, t.l), G.barres(l.slice(0, 10), { format: function (n) { return format(t.f, n) }, description: t.l }))
    }).filter(Boolean)
    if (tops.length) corps.push(h('div', { class: 'pf-tops' }, tops))
    return h('section', { class: 'carte pf-rubrique' }, corps)
  }

  // tableau complet ; o = { sources: lignes perf_sources, mesures, jours, aujourdhui, toutes (admin : aussi les non souscrites) }
  function tableau(ctx, o) {
    var h = ctx.h, par = {}; (o.sources || []).forEach(function (s) { par[s.source] = s })
    var liste = Object.keys(SOURCES).filter(function (s) { return o.toutes || (par[s] && par[s].souscrit) })
    if (!liste.length) return [ctx.UI.etatVide('Aucun service de performance suivi pour le moment.', 'chart-column')]
    return liste.map(function (s) { return rubrique(ctx, s, par[s], o.mesures || [], o.jours || 30, o.aujourdhui || iso(new Date())) })
  }
  function choixPeriode(h, jours, change) {
    return h('div', { class: 'pf-periodes', role: 'group', 'aria-label': 'Période' }, [[30, '30 jours'], [90, '90 jours'], [365, '12 mois']].map(function (p) {
      return h('button', { type: 'button', 'aria-pressed': String(p[0] === jours), onclick: function () { change(p[0]) } }, p[1])
    }))
  }

  window.CreatigoPerf = { SOURCES: SOURCES, STATUTS: STATUTS, lireCsv: lireCsv, tableau: tableau, choixPeriode: choixPeriode, format: format, iso: iso, ajout: ajout }
})()
