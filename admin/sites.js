/* Administration : sites livrés, maintenance et performances digitales (phase 7).
   - #sites : liste des sites (état du dernier contrôle RÉEL, SSL, domaine, incidents), alertes, nouveau site, tout vérifier
   - #sites/calendrier(/AAAA-MM) : calendrier de maintenance (interventions prévues et faites, expirations SSL et domaines)
   - #sites/<id> : fiche (informations, contrôles, interventions, incidents)
   - #performances(/<client>) : sources suivies par client, import des exports réels (CSV), saisie, mesure PageSpeed, aperçu client
   Contrôles : fonction Netlify /api/site-check (jamais de statut supposé). Sécurité dans la base (supabase/sites.sql). */
(function () {
  var K = function () { return window.AdminKit }
  var UI = function () { return window.UI }
  var M = window.AdminModules = window.AdminModules || {}
  var P = function () { return window.CreatigoPerf }
  var enc = encodeURIComponent
  function S() { return K().S }
  function enLigne() { return S().sb && S().sb.on() }
  function nomC(c) { return c ? (c.societe ? c.societe + (c.nom ? ' · ' + c.nom : '') : c.nom) || 'Sans nom' : '—' }
  function auj() { return P().iso(new Date()) }
  function jours(iso) { return iso ? Math.round((Date.parse(String(iso).slice(0, 10) + 'T12:00:00') - Date.parse(auj() + 'T12:00:00')) / 864e5) : null }
  function dfr(iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—' }
  function quand(iso) { var d = new Date(iso); return d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  function erreur(er) { var m = String((er && er.message) || er); var x = /"message":"([^"]+)"/.exec(m); return x ? x[1] : m }
  var TYPES = { plugins: 'Mise à jour (extensions, CMS)', bug: 'Correction de bug', contenu: 'Modification de contenu', performance: 'Optimisation des performances', sauvegarde: 'Sauvegarde', securite: 'Intervention de sécurité', autre: 'Autre' }
  var MAINT = { active: ['Maintenance active', 'bon'], suspendue: ['Maintenance suspendue', 'attention'], aucune: ['Sans maintenance', ''] }
  var GRAV = { mineure: ['Mineur', ''], majeure: ['Majeur', 'attention'], critique: ['Critique', 'critique'] }
  function hors(main) { main.append(UI().etatVide('Disponible quand l’administration est connectée à la base (script supabase/sites.sql).', 'database')) }
  function onglets(actif) {
    var U = UI(), h = U.h
    return h('nav', { class: 'pj-onglets noprint', 'aria-label': 'Sections' }, [['sites', 'Sites', '#sites', 'globe'], ['calendrier', 'Calendrier de maintenance', '#sites/calendrier', 'calendar-days'], ['performances', 'Performances clients', '#performances', 'chart-column']].map(function (o) {
      return h('a', { href: o[2], class: o[0] === actif ? 'actif' : null, 'aria-current': o[0] === actif ? 'page' : null }, U.icone(o[3], 15), o[1])
    }))
  }

  // état affiché = dernier contrôle réel, daté ; sans contrôle : « jamais vérifié »
  function etat(s) {
    var U = UI()
    if (!s.derniere_verif) return U.badge('Jamais vérifié', '')
    return s.verif_ok ? U.badge('Répondait (' + s.http_statut + ') le ' + dfr(s.derniere_verif), 'bon') : U.badge((s.verif_erreur || 'En erreur') + ' le ' + dfr(s.derniere_verif), 'critique')
  }
  function ssl(s) {
    var U = UI(), n = jours(s.ssl_expire)
    if (n === null) return U.badge(/^https:/i.test(s.url) ? 'SSL non vérifié' : 'Pas de HTTPS', /^https:/i.test(s.url) ? '' : 'attention')
    return U.badge(n < 0 ? 'SSL expiré' : 'SSL : ' + n + ' j', n < 0 ? 'critique' : n <= 21 ? 'attention' : 'bon')
  }
  function controler(id) {
    return S().auth.token().then(function (j) { return fetch('/api/site-check', { method: 'POST', headers: { Authorization: 'Bearer ' + j, 'Content-Type': 'application/json' }, body: JSON.stringify({ site: id }) }) })
      .then(function (r) { return r.json().catch(function () { return {} }).then(function (b) { if (!r.ok && !('ok' in b)) throw new Error(r.status === 404 ? 'service de contrôle indisponible ici (fonction Netlify /api/site-check non déployée)' : (b.erreur || 'erreur ' + r.status)); return b }) })
  }

  /* ---------- liste ---------- */
  function liste(main) {
    var U = UI(), h = U.h
    Promise.all([S().sb.get('sites?deleted_at=is.null&select=*&order=nom'), S().list('clients'), S().list('projets'), S().sb.get('site_incidents?statut=eq.ouvert&select=site_id,gravite'), S().sb.get('site_interventions?statut=eq.planifiee&select=site_id,date_prevue,titre')]).then(function (r) {
      var sites = r[0], cl = {}, inc = {}, prev = {}; r[1].forEach(function (c) { cl[c.id] = c }); r[3].forEach(function (x) { inc[x.site_id] = (inc[x.site_id] || 0) + 1 })
      r[4].forEach(function (x) { if (x.date_prevue && (!prev[x.site_id] || x.date_prevue < prev[x.site_id].date_prevue)) prev[x.site_id] = x })
      var alertes = []
      sites.forEach(function (s) {
        var n = s.nom || s.url, j = jours(s.ssl_expire), d = jours(s.domaine_expire)
        if (s.derniere_verif && !s.verif_ok) alertes.push([n + ' : ' + (s.verif_erreur || 'erreur') + ' au dernier contrôle (' + quand(s.derniere_verif) + ')', 'critique', s.id])
        if (j !== null && j <= 21) alertes.push([n + ' : certificat SSL ' + (j < 0 ? 'expiré' : 'expire dans ' + j + ' j'), j < 0 ? 'critique' : 'attention', s.id])
        if (d !== null && d <= 30) alertes.push([n + ' : nom de domaine ' + (d < 0 ? 'expiré' : 'à renouveler dans ' + d + ' j'), d < 0 ? 'critique' : 'attention', s.id])
        if (inc[s.id]) alertes.push([n + ' : ' + U.fmt.pluriel(inc[s.id], 'incident ouvert', 'incidents ouverts'), 'attention', s.id])
        if (prev[s.id] && prev[s.id].date_prevue < auj()) alertes.push([n + ' : intervention en retard (' + prev[s.id].titre + ', prévue le ' + dfr(prev[s.id].date_prevue) + ')', 'attention', s.id])
      })
      var actifs = sites.filter(function (s) { return s.maintenance === 'active' }).length
      main.append(h('div', { class: 'grille kpi' },
        U.tuile('Sites suivis', String(sites.length), actifs + ' sous maintenance', false, { icone: 'globe' }),
        U.tuile('En erreur au dernier contrôle', String(sites.filter(function (s) { return s.derniere_verif && !s.verif_ok }).length), 'contrôles réels uniquement', sites.some(function (s) { return s.derniere_verif && !s.verif_ok }), { icone: 'activity' }),
        U.tuile('SSL à renouveler', String(sites.filter(function (s) { var j = jours(s.ssl_expire); return j !== null && j <= 21 }).length), 'sous 21 jours', false, { icone: 'lock' }),
        U.tuile('Jamais vérifiés', String(sites.filter(function (s) { return !s.derniere_verif }).length), 'lancez un contrôle', false, { icone: 'shield-check' })))
      var tout = h('button', { class: 'btn', type: 'button', disabled: !sites.length, onclick: function (e) {
        var b = e.currentTarget; b.disabled = true; var i = 0, ko = null
        sites.reduce(function (p, s) { return p.then(function () { b.textContent = 'Contrôle ' + (++i) + ' / ' + sites.length + '…'; return controler(s.id).catch(function (er) { ko = er }) }) }, Promise.resolve()).then(function () {
          if (ko) U.toast(erreur(ko), 'erreur'); else U.toast('Contrôles terminés.', 'bon'); K().route()
        })
      } }, U.icone('refresh-cw', 15), 'Tout vérifier maintenant')
      main.append(h('div', { class: 'rangee r21' },
        U.carte('Alertes', alertes.length ? U.fmt.pluriel(alertes.length, 'point') + ' à traiter' : 'rien à signaler', alertes.length ? h('ul', { class: 'sm-alertes' }, alertes.map(function (a) { return h('li', { class: a[1] }, h('a', { href: '#sites/' + a[2] }, a[0])) })) : U.etatVide('Aucune alerte d’après les derniers contrôles et les dates saisies.', 'circle-check')),
        U.carte('Contrôle technique', 'code HTTP, temps de réponse, certificat SSL', h('p', { class: 'discret' }, 'Chaque contrôle interroge réellement le site depuis le serveur et enregistre le résultat daté. Aucun état n’est affiché sans contrôle.'), h('div', { class: 'cta' }, tout))))
      main.append(U.carte('Sites', U.fmt.pluriel(sites.length, 'site'), sites.length ? h('div', { class: 'sm-table' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['Site', 'Client', 'Maintenance', 'Dernier contrôle', 'Certificat', 'Prochaine intervention'].map(function (t) { return h('th', {}, t) }))),
        h('tbody', {}, sites.map(function (s) {
          return h('tr', {}, h('td', {}, h('a', { href: '#sites/' + s.id }, h('b', {}, s.nom || s.domaine || s.url)), h('br'), h('small', { class: 'discret' }, s.url)),
            h('td', {}, nomC(cl[s.client_id])), h('td', {}, U.badge(MAINT[s.maintenance][0], MAINT[s.maintenance][1])), h('td', {}, etat(s), s.temps_ms != null && s.verif_ok ? h('small', { class: 'discret' }, ' ' + s.temps_ms + ' ms') : null), h('td', {}, ssl(s)),
            h('td', {}, prev[s.id] ? dfr(prev[s.id].date_prevue) + ' · ' + prev[s.id].titre : '—'))
        })))) : U.etatVide('Aucun site enregistré. Ajoutez le premier site livré ci-dessous.', 'globe')))
      main.append(formSite(null, r[1], r[2]))
    }).catch(function (er) { main.append(UI().etatVide('Lecture impossible : ' + erreur(er) + '. Le script supabase/sites.sql a-t-il été lancé ?', 'database')) })
  }

  function formSite(s, clients, projets) {
    var U = UI(), h = U.h; s = s || {}
    var f = {
      nom: h('input', { maxlength: '200', value: s.nom || '', placeholder: 'ex. Site vitrine' }), url: h('input', { type: 'url', required: true, maxlength: '500', value: s.url || '', placeholder: 'https://www.client.fr' }),
      client: h('select', { required: true }, h('option', { value: '' }, 'Choisir…'), clients.map(function (c) { return h('option', { value: c.id, selected: c.id === s.client_id }, nomC(c)) })),
      projet: h('select', {}, h('option', { value: '' }, 'Aucun'), projets.map(function (p) { return h('option', { value: p.id, selected: p.id === s.project_id }, p.titre || p.id) })),
      domaine: h('input', { maxlength: '253', value: s.domaine || '', placeholder: 'déduit de l’adresse si vide' }), domaine_expire: h('input', { type: 'date', value: s.domaine_expire || '' }),
      registraire: h('input', { maxlength: '120', value: s.registraire || '', placeholder: 'ex. OVHcloud, Gandi' }), hebergeur: h('input', { maxlength: '120', value: s.hebergeur || '', placeholder: 'ex. Netlify, o2switch' }),
      technologie: h('input', { maxlength: '120', value: s.technologie || '', placeholder: 'ex. WordPress 6, Shopify, statique' }), mise_en_ligne: h('input', { type: 'date', value: s.mise_en_ligne || '' }),
      maintenance: h('select', {}, Object.keys(MAINT).map(function (k) { return h('option', { value: k, selected: k === (s.maintenance || 'aucune') }, MAINT[k][0]) })),
      formule: h('input', { maxlength: '200', value: s.formule || '', placeholder: 'ex. Maintenance essentielle, 2 h / mois' }), sauvegarde: h('input', { maxlength: '200', value: s.sauvegarde || '', placeholder: 'ex. quotidienne, hébergeur + copie externe' }),
      visible: h('input', { type: 'checkbox', checked: s.visible_client !== false }), notes: h('textarea', { rows: '3', maxlength: '4000', placeholder: 'Notes internes (jamais montrées au client). Pas de mot de passe ici.' }, s.notes || ''),
    }
    var c = function (l, i) { return h('label', {}, l, i) }
    var b = h('button', { class: 'btn principal', type: 'submit' }, s.id ? 'Enregistrer' : 'Ajouter le site')
    var form = h('form', { onsubmit: function (e) {
      e.preventDefault()
      if (!/^https?:\/\/\S+$/i.test(f.url.value.trim())) { U.toast('Adresse invalide : elle doit commencer par https:// ou http://', 'erreur'); return }
      if (!f.client.value) { U.toast('Choisissez le client.', 'erreur'); return }
      var o = { nom: f.nom.value.trim(), url: f.url.value.trim(), client_id: f.client.value, project_id: f.projet.value || null, domaine: f.domaine.value.trim().toLowerCase(), domaine_expire: f.domaine_expire.value || null,
        registraire: f.registraire.value.trim(), hebergeur: f.hebergeur.value.trim(), technologie: f.technologie.value.trim(), mise_en_ligne: f.mise_en_ligne.value || null, maintenance: f.maintenance.value,
        formule: f.formule.value.trim(), sauvegarde: f.sauvegarde.value.trim(), visible_client: f.visible.checked, notes: f.notes.value }
      b.disabled = true
      ;(s.id ? S().sb.patch('sites?id=eq.' + enc(s.id), o) : S().sb.post('sites', o)).then(function (x) { U.toast('Site enregistré.', 'bon'); if (s.id) K().route(); else K().go('sites/' + x[0].id) }, function (er) { b.disabled = false; U.toast('Impossible : ' + erreur(er), 'erreur') })
    } }, h('div', { class: 'pj-grille' }, c('Nom', f.nom), c('Adresse (URL)', f.url), c('Client', f.client), c('Projet d’origine', f.projet), c('Domaine', f.domaine), c('Renouvellement du domaine', f.domaine_expire),
      c('Registraire', f.registraire), c('Hébergement', f.hebergeur), c('Technologie', f.technologie), c('Mise en ligne', f.mise_en_ligne), c('Maintenance', f.maintenance), c('Formule', f.formule), c('Sauvegardes', f.sauvegarde)),
      h('label', { class: 'sm-chk' }, f.visible, 'Visible dans l’espace du client'), c('Notes internes', f.notes), h('div', { class: 'cta' }, b))
    return U.carte(s.id ? 'Informations du site' : 'Ajouter un site', s.id ? '' : 'site livré ou repris en maintenance', form)
  }

  /* ---------- fiche ---------- */
  function fiche(main, id) {
    var U = UI(), h = U.h
    Promise.all([S().sb.get('sites?id=eq.' + enc(id) + '&select=*'), S().list('clients'), S().list('projets'), S().sb.get('site_checks?site_id=eq.' + enc(id) + '&select=*&order=created_at.desc&limit=15'),
      S().sb.get('site_interventions?site_id=eq.' + enc(id) + '&select=*&order=created_at.desc'), S().sb.get('site_incidents?site_id=eq.' + enc(id) + '&select=*&order=debut.desc')]).then(function (r) {
      var s = r[0][0]; if (!s) { main.append(U.etatVide('Site introuvable.', 'globe')); return }
      var cl = r[1].filter(function (c) { return c.id === s.client_id })[0]
      main.append(U.entete(s.nom || s.domaine || s.url, nomC(cl) + ' · ' + s.url, null, U.badge(MAINT[s.maintenance][0], MAINT[s.maintenance][1])))
      var bv = h('button', { class: 'btn principal', type: 'button', onclick: function () {
        bv.disabled = true; bv.textContent = 'Contrôle en cours…'
        controler(s.id).then(function (x) { U.toast(x.ok ? 'Le site répond (' + x.http_statut + ', ' + x.temps_ms + ' ms).' : 'Échec : ' + (x.erreur || 'erreur'), x.ok ? 'bon' : 'erreur'); K().route() }, function (er) { bv.disabled = false; bv.textContent = 'Vérifier maintenant'; U.toast(erreur(er), 'erreur') })
      } }, U.icone('refresh-cw', 15), 'Vérifier maintenant')
      var ctrl = r[3]
      main.append(h('div', { class: 'grille kpi' },
        U.tuile('Dernier contrôle', s.derniere_verif ? (s.verif_ok ? 'Répondait' : 'En erreur') : 'Jamais vérifié', s.derniere_verif ? quand(s.derniere_verif) + (s.http_statut ? ' · code ' + s.http_statut : '') + (s.verif_erreur ? ' · ' + s.verif_erreur : '') : 'aucune donnée', s.derniere_verif && !s.verif_ok, { icone: 'activity', ton: s.verif_ok ? 'bon' : null }),
        U.tuile('Temps de réponse', s.temps_ms != null ? s.temps_ms + ' ms' : '–', 'au dernier contrôle', false, { icone: 'timer' }),
        U.tuile('Certificat SSL', s.ssl_expire ? dfr(s.ssl_expire) : '–', s.ssl_expire ? 'expiration · ' + (s.ssl_emetteur || '') : 'non lu', jours(s.ssl_expire) !== null && jours(s.ssl_expire) <= 21, { icone: 'lock' }),
        U.tuile('Nom de domaine', s.domaine_expire ? dfr(s.domaine_expire) : '–', s.domaine_expire ? 'renouvellement · ' + (s.registraire || '') : 'date non saisie', jours(s.domaine_expire) !== null && jours(s.domaine_expire) <= 30, { icone: 'globe' })))
      main.append(h('div', { class: 'rangee r21' }, interventions(s, r[4]),
        h('div', { class: 'sm-cote' },
          U.carte('Contrôles', 'les 15 derniers', h('div', { class: 'cta' }, bv), ctrl.length ? h('ul', { class: 'sm-ctrl' }, ctrl.map(function (c) { return h('li', { class: c.ok ? 'ok' : 'ko' }, h('b', {}, c.ok ? 'OK ' + c.http_statut : (c.erreur || 'Erreur')), h('span', { class: 'discret' }, quand(c.created_at) + (c.temps_ms != null ? ' · ' + c.temps_ms + ' ms' : ''))) })) : U.etatVide('Aucun contrôle encore.', 'activity')),
          incidents(s, r[5]))))
      main.append(formSite(s, r[1], r[2]))
      main.append(h('div', { class: 'cta' }, h('button', { class: 'btn', type: 'button', onclick: function () {
        U.confirmer({ titre: 'Retirer ce site ?', texte: 'Il part dans la corbeille, avec son historique.', bouton: 'Retirer', danger: true }).then(function (ok) { if (ok) S().sb.patch('sites?id=eq.' + enc(s.id), { deleted_at: new Date().toISOString() }).then(function () { K().go('sites') }) })
      } }, 'Retirer le site')))
    }).catch(function (er) { main.append(UI().etatVide('Lecture impossible : ' + erreur(er), 'database')) })
  }

  function interventions(s, l) {
    var U = UI(), h = U.h
    var f = { type: h('select', {}, Object.keys(TYPES).map(function (k) { return h('option', { value: k }, TYPES[k]) })), titre: h('input', { maxlength: '200', required: true, placeholder: 'ex. Mise à jour WordPress et extensions' }),
      statut: h('select', {}, h('option', { value: 'planifiee' }, 'Planifiée'), h('option', { value: 'faite' }, 'Faite')), date: h('input', { type: 'date', value: auj() }), duree: h('input', { type: 'number', min: '0', step: '5', placeholder: 'min' }),
      desc: h('textarea', { rows: '2', maxlength: '4000', placeholder: 'Détail (visible par le client si la case est cochée)' }), vis: h('input', { type: 'checkbox', checked: true }) }
    var c = function (a, b) { return h('label', {}, a, b) }
    var form = h('form', { class: 'sm-form', onsubmit: function (e) {
      e.preventDefault(); if (!f.titre.value.trim()) return
      S().sb.post('site_interventions', { site_id: s.id, type: f.type.value, titre: f.titre.value.trim(), statut: f.statut.value, date_prevue: f.date.value || null, duree_min: f.duree.value ? +f.duree.value : null, description: f.desc.value.trim(), visible_client: f.vis.checked })
        .then(function () { U.toast('Intervention enregistrée.', 'bon'); K().route() }, function (er) { U.toast(erreur(er), 'erreur') })
    } }, h('div', { class: 'pj-grille' }, c('Type', f.type), c('Intitulé', f.titre), c('Statut', f.statut), c('Date (prévue ou faite)', f.date), c('Durée (min)', f.duree)), f.desc, h('label', { class: 'sm-chk' }, f.vis, 'Visible par le client'), h('div', { class: 'cta' }, h('button', { class: 'btn principal', type: 'submit' }, 'Ajouter')))
    var ST = { planifiee: ['Planifiée', 'info'], faite: ['Faite', 'bon'], annulee: ['Annulée', ''] }
    return U.carte('Interventions', 'historique et planning', l.length ? h('ul', { class: 'sm-inter' }, l.map(function (x) {
      var retard = x.statut === 'planifiee' && x.date_prevue && x.date_prevue < auj()
      return h('li', {}, h('div', {}, h('b', {}, x.titre), ' ', U.badge(retard ? 'En retard' : ST[x.statut][0], retard ? 'attention' : ST[x.statut][1]), x.visible_client ? null : U.badge('Interne', '')),
        h('small', { class: 'discret' }, TYPES[x.type] + ' · ' + (x.statut === 'faite' ? 'faite le ' + dfr(x.date_faite) : 'prévue le ' + dfr(x.date_prevue)) + (x.duree_min ? ' · ' + x.duree_min + ' min' : '')),
        x.description ? h('p', {}, x.description) : null,
        x.statut === 'planifiee' ? h('div', { class: 'sm-act' }, h('button', { class: 'btn lien petit', type: 'button', onclick: function () { S().sb.patch('site_interventions?id=eq.' + enc(x.id), { statut: 'faite' }).then(K().route) } }, 'Marquer faite'),
          h('button', { class: 'btn lien petit', type: 'button', onclick: function () { S().sb.patch('site_interventions?id=eq.' + enc(x.id), { statut: 'annulee' }).then(K().route) } }, 'Annuler')) : null)
    })) : U.etatVide('Aucune intervention enregistrée.', 'settings'), h('h3', { class: 'sm-sous' }, 'Nouvelle intervention'), form)
  }

  function incidents(s, l) {
    var U = UI(), h = U.h
    var f = { titre: h('input', { maxlength: '200', required: true, placeholder: 'ex. Formulaire de contact en panne' }), grav: h('select', {}, Object.keys(GRAV).map(function (k) { return h('option', { value: k }, GRAV[k][0]) })), vis: h('input', { type: 'checkbox', checked: true }) }
    var form = h('form', { class: 'sm-form', onsubmit: function (e) {
      e.preventDefault(); if (!f.titre.value.trim()) return
      S().sb.post('site_incidents', { site_id: s.id, titre: f.titre.value.trim(), gravite: f.grav.value, visible_client: f.vis.checked }).then(function () { U.toast('Incident ouvert.', 'bon'); K().route() }, function (er) { U.toast(erreur(er), 'erreur') })
    } }, h('div', { class: 'pj-grille' }, h('label', {}, 'Incident', f.titre), h('label', {}, 'Gravité', f.grav)), h('label', { class: 'sm-chk' }, f.vis, 'Prévenir le client'), h('div', { class: 'cta' }, h('button', { class: 'btn', type: 'submit' }, 'Ouvrir un incident')))
    return U.carte('Incidents', U.fmt.pluriel(l.filter(function (x) { return x.statut === 'ouvert' }).length, 'ouvert'), l.length ? h('ul', { class: 'sm-inter' }, l.map(function (x) {
      return h('li', {}, h('div', {}, h('b', {}, x.titre), ' ', U.badge(GRAV[x.gravite][0], GRAV[x.gravite][1]), ' ', U.badge(x.statut === 'ouvert' ? 'Ouvert' : 'Résolu', x.statut === 'ouvert' ? 'critique' : 'bon')),
        h('small', { class: 'discret' }, 'depuis le ' + quand(x.debut) + (x.fin ? ' · résolu le ' + quand(x.fin) : '')), x.resolution ? h('p', {}, x.resolution) : null,
        x.statut === 'ouvert' ? h('div', { class: 'sm-act' }, h('button', { class: 'btn lien petit', type: 'button', onclick: function () {
          var t = window.prompt('Comment l’incident a-t-il été résolu ? (visible par le client)') ; if (t === null) return
          S().sb.patch('site_incidents?id=eq.' + enc(x.id), { statut: 'resolu', resolution: t.slice(0, 4000) }).then(K().route)
        } }, 'Marquer résolu')) : null)
    })) : U.etatVide('Aucun incident.', 'circle-check'), form)
  }

  /* ---------- calendrier ---------- */
  function calendrier(main, mois) {
    var U = UI(), h = U.h
    mois = /^\d{4}-\d{2}$/.test(mois || '') ? mois : auj().slice(0, 7)
    Promise.all([S().sb.get('sites?deleted_at=is.null&select=id,nom,url,domaine,ssl_expire,domaine_expire'), S().sb.get('site_interventions?statut=neq.annulee&select=id,site_id,titre,type,statut,date_prevue,date_faite')]).then(function (r) {
      var sites = {}; r[0].forEach(function (s) { sites[s.id] = s })
      var ev = {}
      var ajouter = function (j, o) { if (j && j.slice(0, 7) === mois) (ev[j.slice(0, 10)] = ev[j.slice(0, 10)] || []).push(o) }
      r[1].forEach(function (x) { var s = sites[x.site_id]; if (!s) return; var j = x.statut === 'faite' ? String(x.date_faite || '').slice(0, 10) : x.date_prevue; ajouter(j, { t: x.titre + ' · ' + (s.nom || s.domaine), c: x.statut === 'faite' ? 'fait' : (j < auj() ? 'retard' : 'prevu'), l: '#sites/' + s.id }) })
      r[0].forEach(function (s) { if (s.ssl_expire) ajouter(String(s.ssl_expire).slice(0, 10), { t: 'Expiration SSL · ' + (s.nom || s.domaine), c: 'echeance', l: '#sites/' + s.id }); if (s.domaine_expire) ajouter(s.domaine_expire, { t: 'Renouvellement domaine · ' + (s.nom || s.domaine), c: 'echeance', l: '#sites/' + s.id }) })
      var d0 = new Date(mois + '-01T12:00:00'), dec = (d0.getDay() + 6) % 7, nbj = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate()
      var autre = function (n) { var d = new Date(d0); d.setMonth(d.getMonth() + n); return P().iso(d).slice(0, 7) }
      var cases = []; for (var i = 0; i < dec; i++) cases.push(h('div', { class: 'sm-jour vide', 'aria-hidden': 'true' }))
      for (var j = 1; j <= nbj; j++) {
        var k = mois + '-' + String(j).padStart(2, '0')
        cases.push(h('div', { class: 'sm-jour' + (k === auj() ? ' auj' : '') }, h('span', { class: 'sm-num' }, String(j)), (ev[k] || []).map(function (e) { return h('a', { class: 'sm-ev ' + e.c, href: e.l, title: e.t }, e.t) })))
      }
      main.append(U.carte(d0.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), 'interventions, expirations SSL et renouvellements de domaines',
        h('div', { class: 'sm-cal-nav' }, h('a', { class: 'btn petit', href: '#sites/calendrier/' + autre(-1) }, U.icone('chevron-left', 15), 'Mois précédent'), h('a', { class: 'btn petit', href: '#sites/calendrier' }, 'Aujourd’hui'), h('a', { class: 'btn petit', href: '#sites/calendrier/' + autre(1) }, 'Mois suivant', U.icone('chevron-right', 15))),
        h('div', { class: 'sm-legende' }, [['prevu', 'Prévue'], ['retard', 'En retard'], ['fait', 'Faite'], ['echeance', 'Échéance']].map(function (x) { return h('span', {}, h('i', { class: 'sm-ev ' + x[0] }), x[1]) })),
        h('div', { class: 'sm-cal' }, ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(function (x) { return h('div', { class: 'sm-jsem' }, x) }), cases)))
    }).catch(function (er) { main.append(UI().etatVide('Lecture impossible : ' + erreur(er), 'database')) })
  }

  function sites(id, mois) {
    var U = UI(), main = K().main
    main.append(U.entete('Sites et maintenance', 'Sites livrés, contrôles techniques réels, interventions et incidents.', null))
    main.append(onglets(id === 'calendrier' ? 'calendrier' : 'sites'))
    if (!enLigne()) return hors(main)
    if (id === 'calendrier') return calendrier(main, mois)
    return id ? fiche(main, id) : liste(main)
  }

  /* =====================================================================================
     PERFORMANCES
     ===================================================================================== */
  function performances(cid) {
    var U = UI(), h = U.h, main = K().main
    main.append(U.entete('Performances clients', 'Site, SEO, GEO, Google Ads et réseaux sociaux : uniquement des données réelles, importées ou mesurées.', null))
    main.append(onglets('performances'))
    if (!enLigne()) return hors(main)
    Promise.all([S().list('clients'), S().sb.get('perf_sources?select=*'), S().sb.get('perf_metrics?select=client_id,source,jour&order=jour.desc&limit=20000')]).then(function (r) {
      var cl = r[0].filter(function (c) { return c.statut !== 'prospect' || c.id === cid }), src = r[1], mes = r[2]
      if (cid) return ficheClient(main, r[0].filter(function (c) { return c.id === cid })[0], src.filter(function (s) { return s.client_id === cid }))
      var actifs = cl.filter(function (c) { return src.some(function (s) { return s.client_id === c.id && s.souscrit }) })
      main.append(U.carte('Clients suivis', U.fmt.pluriel(actifs.length, 'client'), actifs.length ? h('ul', { class: 'pf-clients' }, actifs.map(function (c) {
        var ss = src.filter(function (s) { return s.client_id === c.id && s.souscrit })
        return h('li', {}, h('a', { href: '#performances/' + c.id }, h('b', {}, nomC(c))), h('div', { class: 'pf-pastilles' }, ss.map(function (s) {
          var n = mes.filter(function (m) { return m.client_id === c.id && m.source === s.source }).length, st = P().STATUTS[n ? s.statut : 'non_connecte']
          return U.badge(P().SOURCES[s.source].l + ' : ' + st[0], st[1])
        })))
      })) : U.etatVide('Aucun client suivi. Ouvrez un client ci-dessous pour activer ses services.', 'chart-column')))
      var sel = h('select', {}, h('option', { value: '' }, 'Choisir un client…'), cl.map(function (c) { return h('option', { value: c.id }, nomC(c)) }))
      main.append(U.carte('Configurer un client', '', h('div', { class: 'ps-depot' }, sel, h('button', { class: 'btn principal', type: 'button', onclick: function () { if (sel.value) K().go('performances/' + sel.value) } }, 'Ouvrir'))))
    }).catch(function (er) { main.append(UI().etatVide('Lecture impossible : ' + erreur(er) + '. Le script supabase/sites.sql a-t-il été lancé ?', 'database')) })
  }

  function ficheClient(main, c, src) {
    var U = UI(), h = U.h, SO = P().SOURCES
    if (!c) { main.append(U.etatVide('Client introuvable.', 'users')); return }
    var par = {}; src.forEach(function (s) { par[s.source] = s })
    main.append(h('h2', { class: 'pf-titre' }, nomC(c)))
    // 1. services suivis
    var lignes = Object.keys(SO).map(function (k) {
      var s = par[k] || {}, f = { sous: h('input', { type: 'checkbox', checked: !!s.souscrit }), four: h('input', { maxlength: '120', value: s.fournisseur || '', placeholder: SO[k].def }), id: h('input', { maxlength: '200', value: s.identifiant || '', placeholder: 'propriété, compte, page…' }) }
      var st = P().STATUTS[s.statut || 'non_connecte']
      return h('tr', {}, h('td', {}, h('label', { class: 'sm-chk' }, f.sous, SO[k].l)), h('td', {}, f.four), h('td', {}, f.id), h('td', {}, U.badge(st[0], st[1]), s.maj ? h('small', { class: 'discret' }, ' ' + dfr(s.maj)) : null),
        h('td', {}, h('button', { class: 'btn petit', type: 'button', onclick: function () {
          S().sb.upsert('perf_sources?on_conflict=client_id,source', [{ client_id: c.id, source: k, souscrit: f.sous.checked, fournisseur: f.four.value.trim(), identifiant: f.id.value.trim(), updated_at: new Date().toISOString() }]).then(function () { U.toast('Enregistré.', 'bon'); K().route() }, function (er) { U.toast(erreur(er), 'erreur') })
        } }, 'Enregistrer')))
    })
    main.append(U.carte('Services suivis', 'une rubrique cochée apparaît dans l’espace du client', h('div', { class: 'sm-table' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['Service', 'Outil source', 'Identifiant', 'État', ''].map(function (t) { return h('th', {}, t) }))), h('tbody', {}, lignes))),
      h('p', { class: 'discret' }, 'Le raccordement automatique aux API Google et Meta (OAuth) arrive avec la phase intégrations. D’ici là : export CSV depuis l’outil, puis import ci-dessous. L’état « Connecté » est réservé à ce raccordement.')))
    // 2. import CSV
    var srcSel = h('select', {}, Object.keys(SO).map(function (k) { return h('option', { value: k }, SO[k].l) }))
    var fic = h('input', { type: 'file', accept: '.csv,text/csv,text/plain' }), zone = h('textarea', { rows: '5', placeholder: 'date;metrique;valeur;dimension\n2026-11-01;clics;42;\n2026-11-01;position;4,2;agence web toulouse' })
    var rapport = h('div', { class: 'discret', role: 'status' })
    fic.addEventListener('change', function () { var f = fic.files[0]; if (!f) return; if (f.size > 5 * 1024 * 1024) { U.toast('5 Mo maximum.', 'erreur'); return } f.text().then(function (t) { zone.value = t }) })
    var bi = h('button', { class: 'btn principal', type: 'button', onclick: function () {
      var lu = P().lireCsv(zone.value)
      if (lu.erreurs.length) { rapport.textContent = lu.erreurs.slice(0, 5).join(' · ') + (lu.erreurs.length > 5 ? ' …' : ''); if (!lu.lignes.length) return }
      if (!lu.lignes.length) { U.toast('Aucune ligne à importer.', 'erreur'); return }
      bi.disabled = true
      S().rpc('perf_importer', { cid: c.id, src: srcSel.value, lignes: lu.lignes, orig: 'import' }).then(function (n) { U.toast(n + ' mesure(s) importée(s).', 'bon'); K().route() }, function (er) { bi.disabled = false; U.toast(erreur(er), 'erreur') })
    } }, U.icone('upload', 15), 'Importer')
    var metriques = Object.keys(SO).map(function (k) { return SO[k].l + ' : ' + SO[k].kpis.filter(function (x) { return !x.calc }).map(function (x) { return x.c }).concat(SO[k].tops.map(function (t) { return t.c + ' + dimension' })).filter(function (v, i, a) { return a.indexOf(v) === i }).join(', ') })
    main.append(U.carte('Importer des données réelles', 'export CSV de Google Analytics, Search Console, Google Ads, Meta…',
      h('div', { class: 'ps-depot' }, h('label', {}, 'Service ', srcSel), fic), zone, rapport, h('div', { class: 'cta' }, bi),
      h('details', { class: 'pf-aide' }, h('summary', {}, 'Format attendu et métriques reconnues'), h('p', {}, 'Une ligne par mesure : date ; métrique ; valeur ; dimension (facultative : page, source de trafic, mot-clé, requête « moteur | question », campagne…). Une valeur déjà importée pour le même jour, la même métrique et la même dimension est remplacée.'), h('ul', {}, metriques.map(function (m) { return h('li', {}, m) })))))
    // 3. mesure PageSpeed (performance technique réelle)
    S().sb.get('sites?client_id=eq.' + enc(c.id) + '&deleted_at=is.null&select=id,nom,url').then(function (ss) {
      if (!ss.length) return
      main.insertBefore(U.carte('Performance technique', 'mesure Google PageSpeed (mobile), enregistrée dans « Site web »', h('ul', { class: 'pf-clients' }, ss.map(function (s) {
        var b = h('button', { class: 'btn petit', type: 'button', onclick: function () {
          b.disabled = true; b.textContent = 'Mesure en cours (jusqu’à 1 min)…'
          fetch('https://www.googleapis.com/pagespeedonline/v5/runPagespeed?category=performance&strategy=mobile&url=' + enc(s.url)).then(function (r) { return r.json() }).then(function (j) {
            var lh = j && j.lighthouseResult; if (!lh) throw new Error((j && j.error && j.error.message) || 'mesure indisponible')
            var lignes = [{ jour: auj(), metrique: 'score_mobile', valeur: Math.round(lh.categories.performance.score * 100), dimension: '' }]
            var lcp = lh.audits && lh.audits['largest-contentful-paint']; if (lcp && lcp.numericValue) lignes.push({ jour: auj(), metrique: 'lcp_ms', valeur: Math.round(lcp.numericValue), dimension: '' })
            return S().rpc('perf_importer', { cid: c.id, src: 'site', lignes: lignes, orig: 'api' }).then(function () { U.toast('Score mobile : ' + lignes[0].valeur + ' / 100.', 'bon'); K().route() })
          }).catch(function (er) { b.disabled = false; b.textContent = 'Mesurer'; U.toast('PageSpeed : ' + erreur(er), 'erreur') })
        } }, 'Mesurer')
        return h('li', {}, h('span', {}, h('b', {}, s.nom || s.url), ' ', h('small', { class: 'discret' }, s.url)), b)
      }))), apercuCarte)
    }).catch(function () {})
    // 4. aperçu identique à l'espace client
    var periode = 90, boite = h('div', { class: 'pf-liste' })
    var apercuCarte = U.carte('Aperçu de l’espace client', 'toutes les rubriques, souscrites ou non', h('div', { class: 'pf-barre' }, h('span', { class: 'pf-p' })), boite)
    main.append(apercuCarte)
    function dessiner() {
      apercuCarte.querySelector('.pf-p').replaceChildren(P().choixPeriode(h, periode, function (p) { periode = p; dessiner() }))
      S().sb.get('perf_metrics?client_id=eq.' + enc(c.id) + '&select=source,metrique,jour,dimension,valeur&limit=50000').then(function (m) {
        boite.replaceChildren.apply(boite, P().tableau({ h: h, UI: U, G: U.G }, { sources: src.map(function (s) { return Object.assign({}, s, { souscrit: true }) }), mesures: m, jours: periode, toutes: true }))
        var del = h('div', { class: 'cta' }, h('button', { class: 'btn', type: 'button', onclick: function () {
          var k = window.prompt('Effacer toutes les mesures d’un service. Tapez son code : ' + Object.keys(SO).join(', ')); if (!k || !SO[k]) return
          U.confirmer({ titre: 'Effacer les mesures « ' + SO[k].l + ' » ?', texte: 'Elles disparaîtront aussi de l’espace du client. Vous pourrez les réimporter.', bouton: 'Effacer', danger: true }).then(function (ok) {
            if (ok) S().sb.del('perf_metrics?client_id=eq.' + enc(c.id) + '&source=eq.' + enc(k)).then(function () { U.toast('Mesures effacées.', 'bon'); K().route() }, function (er) { U.toast(erreur(er), 'erreur') })
          })
        } }, 'Effacer les mesures d’un service'))
        boite.append(del)
      })
    }
    dessiner()
  }

  M.sites = sites
  M.performances = performances
})()
