/* Espace client (phase 7) : « Mon site » (maintenance, contrôles réels, interventions, incidents) et « Performances ».
   Le client lit la vue client_sites (sans notes internes), ses interventions et incidents visibles, et les mesures des services souscrits
   (supabase/sites.sql). Aucun statut n'est supposé : l'état affiché est celui du dernier contrôle réel, daté. */
(function () {
  var enc = encodeURIComponent
  function sur(p) { return p.catch(function () { return [] }) }
  function dfr(iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—' }
  function quand(iso) { var d = new Date(iso); return d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  function jours(iso) { var t = new Date(); t.setHours(12, 0, 0, 0); return iso ? Math.round((Date.parse(String(iso).slice(0, 10) + 'T12:00:00') - t) / 864e5) : null }
  var TYPES = { plugins: 'Mise à jour', bug: 'Correction de bug', contenu: 'Modification de contenu', performance: 'Optimisation des performances', sauvegarde: 'Sauvegarde', securite: 'Sécurité', autre: 'Intervention' }
  var MAINT = { active: ['Maintenance active', 'bon'], suspendue: ['Maintenance suspendue', 'attention'], aucune: ['Sans contrat de maintenance', ''] }

  function site(ctx) {
    var h = ctx.h, UI = ctx.UI, S = ctx.S, ic = ctx.ic
    return Promise.all([sur(S.sb.get('client_sites?select=*&order=nom')), sur(S.sb.get('site_interventions?select=*&order=created_at.desc')), sur(S.sb.get('site_incidents?select=*&order=debut.desc'))]).then(function (r) {
      var sites = r[0], inter = r[1], inc = r[2]
      var tete = ctx.enTetePage('Mon', 'site', 'Hébergement, sécurité, maintenance et historique des interventions sur votre site.',
        h('a', { class: 'btn', href: '#nouvelle' }, ic('headset', 16), 'Signaler un problème'))
      if (!sites.length) return [tete, h('section', { class: 'carte' }, UI.etatVide('Aucun site suivi pour le moment. Il apparaîtra ici après sa mise en ligne.', 'globe'))]
      return [tete].concat(sites.map(function (s) {
        var mi = inter.filter(function (x) { return x.site_id === s.id }), ic2 = inc.filter(function (x) { return x.site_id === s.id })
        var faites = mi.filter(function (x) { return x.statut === 'faite' }), prevues = mi.filter(function (x) { return x.statut === 'planifiee' }).sort(function (a, b) { return (a.date_prevue || '') < (b.date_prevue || '') ? -1 : 1 })
        var nssl = jours(s.ssl_expire), ouverts = ic2.filter(function (x) { return x.statut === 'ouvert' })
        var etat = !s.derniere_verif ? ['Pas encore contrôlé', 'Le premier contrôle technique n’a pas encore été fait.', ''] :
          s.verif_ok ? ['Répondait normalement', 'Dernier contrôle le ' + quand(s.derniere_verif) + (s.temps_ms != null ? ' · réponse en ' + s.temps_ms + ' ms' : ''), 'bon'] :
          ['Problème détecté', 'Dernier contrôle le ' + quand(s.derniere_verif) + ' : l’équipe est prévenue.', 'critique']
        var info = [['Adresse', h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.url)], ['Domaine', s.domaine || '—'], ['Hébergement', s.hebergeur || '—'], ['Technologie', s.technologie || '—'],
          ['Mise en ligne', dfr(s.mise_en_ligne)], ['Renouvellement du domaine', dfr(s.domaine_expire)], ['Formule', s.formule || '—'], ['Sauvegardes', s.sauvegarde || '—']]
        return h('section', { class: 'pp-site' },
          h('div', { class: 'carte pp-site-tete' }, h('div', {}, h('h2', {}, ic('globe', 20), s.nom || s.domaine), h('p', { class: 'discret' }, s.url)), UI.badge(MAINT[s.maintenance][0], MAINT[s.maintenance][1])),
          h('div', { class: 'grille kpi' },
            UI.tuile('État technique', etat[0], etat[1], etat[2] === 'critique', { ton: etat[2] || null }),
            UI.tuile('Certificat de sécurité (HTTPS)', s.ssl_expire ? (nssl < 0 ? 'Expiré' : 'Valide') : '—', s.ssl_expire ? 'jusqu’au ' + dfr(s.ssl_expire) + (s.ssl_emetteur ? ' · ' + s.ssl_emetteur : '') : 'pas encore vérifié', nssl !== null && nssl < 0, { ton: nssl !== null && nssl > 21 ? 'bon' : null }),
            UI.tuile('Interventions réalisées', String(faites.length), faites[0] ? 'dernière le ' + dfr(faites[0].date_faite) : 'aucune pour le moment'),
            UI.tuile('Incidents en cours', String(ouverts.length), ouverts.length ? 'suivis par l’équipe' : 'aucun', ouverts.length > 0)),
          h('div', { class: 'pp-grille' },
            h('section', { class: 'carte' }, h('header', {}, h('h2', {}, 'Historique des interventions')), mi.length ? h('ul', { class: 'pp-histo' }, prevues.concat(faites).map(function (x) {
              return h('li', { class: x.statut }, h('div', {}, h('b', {}, x.titre), ' ', UI.badge(x.statut === 'faite' ? 'Faite' : 'Prévue', x.statut === 'faite' ? 'bon' : 'info')),
                h('small', { class: 'discret' }, TYPES[x.type] + ' · ' + (x.statut === 'faite' ? 'le ' + dfr(x.date_faite) : 'prévue le ' + dfr(x.date_prevue))), x.description ? h('p', {}, x.description) : null)
            })) : UI.etatVide('Aucune intervention enregistrée.', 'settings')),
            h('div', { class: 'pp-cote' },
              h('section', { class: 'carte' }, h('header', {}, h('h2', {}, 'Informations')), h('dl', { class: 'pp-infos' }, info.map(function (i) { return [h('dt', {}, i[0]), h('dd', {}, i[1])] }))),
              h('section', { class: 'carte' }, h('header', {}, h('h2', {}, 'Incidents')), ic2.length ? h('ul', { class: 'pp-histo' }, ic2.map(function (x) {
                return h('li', { class: x.statut }, h('div', {}, h('b', {}, x.titre), ' ', UI.badge(x.statut === 'ouvert' ? 'En cours' : 'Résolu', x.statut === 'ouvert' ? 'critique' : 'bon')),
                  h('small', { class: 'discret' }, 'depuis le ' + quand(x.debut) + (x.fin ? ' · résolu le ' + quand(x.fin) : '')), x.resolution ? h('p', {}, x.resolution) : null)
              })) : UI.etatVide('Aucun incident signalé.', 'circle-check')))))
      }))
    })
  }

  function performances(ctx, periode) {
    var h = ctx.h, UI = ctx.UI, S = ctx.S, P = window.CreatigoPerf
    var jours = +periode === 90 || +periode === 365 ? +periode : 30
    return Promise.all([sur(S.sb.get('perf_sources?select=source,souscrit,fournisseur,statut,maj')), sur(S.sb.get('perf_metrics?select=source,metrique,jour,dimension,valeur&limit=50000'))]).then(function (r) {
      var tete = ctx.enTetePage('Mes', 'performances', 'Les chiffres réels de vos services : site, référencement, visibilité IA, publicité et réseaux sociaux.',
        r[0].length ? P.choixPeriode(h, jours, function (p) { location.hash = 'performances/' + p }) : null)
      return [tete, h('div', { class: 'pf-liste' }, P.tableau({ h: h, UI: UI, G: ctx.G }, { sources: r[0], mesures: r[1], jours: jours }))]
    })
  }

  window.PortailPerf = { site: site, performances: performances }
})()
