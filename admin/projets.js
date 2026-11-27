/* Administration : gestion avancée des projets (phase 3).
   - fiche de pilotage : informations, étapes (jalons) configurables par type de prestation, tâches avec sous-tâches, dépendances,
     commentaires, responsable, échéances et temps passé, planning (Gantt) des tâches, pièces jointes (stockage privé « documents »)
   - vues : Kanban (celle d'origine, admin/modules.js), Liste détaillée, Calendrier, Timeline (Gantt de tous les projets)
   L'avancement n'est jamais saisi : il est calculé à partir des tâches (côté base aussi, voir derive_projects dans supabase/platform.sql).
   Tout texte venant des données passe par UI.h (textContent), jamais par innerHTML. */
(function () {
  var K = function () { return window.AdminKit }
  var UI = function () { return window.UI }
  var M = window.AdminModules = window.AdminModules || {}
  var kanbanOrigine = M.projets   // vue Kanban et planning d'origine (modules.js), gardée telle quelle

  var STATUTS = [['afaire', 'À faire'], ['encours', 'En cours'], ['relecture', 'En relecture'], ['livre', 'Livré']]
  var PRIORITES = [['haute', 'Haute', 'critique'], ['normale', 'Normale', ''], ['basse', 'Basse', 'neutre']]
  var PHASES = ['', 'Découverte', 'Conception', 'Lancement', 'Suivi']
  // modèles d'étapes par type de prestation : [nom, phase côté client (1 à 4)]
  var MODELES = {
    'site-vitrine': ['Site vitrine', [['Découverte et cahier des charges', 1], ['Validation du devis', 1], ['Collecte des contenus', 2], ['Conception UX/UI', 2], ['Validation des maquettes', 2], ['Développement frontend', 3], ['Développement backend', 3], ['Intégration des contenus', 3], ['Tests et optimisation', 3], ['Validation client', 3], ['Mise en production', 3], ['Livraison', 4], ['Maintenance', 4]]],
    'site-ecommerce': ['Site e-commerce', [['Découverte et cahier des charges', 1], ['Validation du devis', 1], ['Collecte des contenus et du catalogue', 2], ['Conception UX/UI', 2], ['Validation des maquettes', 2], ['Développement frontend', 3], ['Développement backend', 3], ['Paiement, livraison et catalogue', 3], ['Intégration des contenus', 3], ['Tests et optimisation', 3], ['Validation client', 3], ['Mise en production', 3], ['Livraison et formation', 4], ['Maintenance', 4]]],
    'landing': ['Landing page', [['Brief et objectif de conversion', 1], ['Validation du devis', 1], ['Rédaction et contenus', 2], ['Maquette', 2], ['Validation de la maquette', 2], ['Intégration', 3], ['Suivi des conversions et tests', 3], ['Mise en ligne', 3], ['Optimisation après lancement', 4]]],
    'refonte': ['Refonte de site', [['Audit de l’existant', 1], ['Cahier des charges', 1], ['Validation du devis', 1], ['Maquettes', 2], ['Validation des maquettes', 2], ['Développement', 3], ['Migration des contenus et redirections', 3], ['Tests et optimisation', 3], ['Mise en production', 3], ['Suivi du référencement', 4]]],
    'maintenance': ['Maintenance', [['Audit initial', 1], ['Sauvegardes et supervision', 2], ['Mises à jour et sécurité', 3], ['Rapport mensuel', 4]]],
    'seo': ['SEO', [['Audit SEO', 1], ['Recherche de mots-clés', 1], ['Optimisations techniques', 2], ['Contenus optimisés', 3], ['Netlinking', 3], ['Suivi des positions et rapport', 4]]],
    'geo': ['GEO (référencement IA)', [['Audit de visibilité dans les IA', 1], ['Structuration des contenus', 2], ['Signaux d’autorité', 3], ['Suivi des réponses des IA', 4]]],
    'ads': ['Google Ads', [['Stratégie et mots-clés', 1], ['Création des campagnes', 2], ['Suivi des conversions', 3], ['Lancement', 3], ['Optimisation et rapport', 4]]],
    'social': ['Réseaux sociaux', [['Stratégie éditoriale', 1], ['Calendrier de publication', 2], ['Création des visuels', 2], ['Publication et animation', 3], ['Rapport mensuel', 4]]],
    'application': ['Application', [['Cadrage', 1], ['Spécifications', 1], ['Conception UX/UI', 2], ['Validation des maquettes', 2], ['Développement frontend', 3], ['Développement backend', 3], ['Tests', 3], ['Recette client', 3], ['Mise en production', 3], ['Maintenance', 4]]],
    'automatisation': ['Automatisation', [['Analyse des processus', 1], ['Conception du workflow', 2], ['Développement', 3], ['Tests', 3], ['Déploiement', 3], ['Suivi', 4]]],
    'sur-mesure': ['Développement sur mesure', [['Découverte', 1], ['Cahier des charges', 1], ['Conception', 2], ['Développement', 3], ['Tests', 3], ['Livraison', 4], ['Suivi', 4]]],
  }

  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) }
  function idNeuf(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }
  function lab(t, v) { var r = t.filter(function (x) { return x[0] === v })[0]; return r ? r[1] : v }
  function nomC(c) { return c ? (c.societe ? c.societe + (c.nom ? ' · ' + c.nom : '') : c.nom) || 'Sans nom' : '—' }
  function heures(n) { n = Math.round((+n || 0) * 10) / 10; return n.toLocaleString('fr-FR') + ' h' }

  /* ---------- lecture / normalisation d'un projet (compatibles avec les anciens projets : tâches { t, ok }) ---------- */
  function normaliser(p) {
    p.etapes = Array.isArray(p.etapes) ? p.etapes : []
    p.taches = (Array.isArray(p.taches) ? p.taches : []).map(function (t) {
      if (!t.id) t.id = idNeuf('t')
      t.sous = Array.isArray(t.sous) ? t.sous : []; t.dependances = Array.isArray(t.dependances) ? t.dependances : []; t.commentaires = Array.isArray(t.commentaires) ? t.commentaires : []
      return t
    })
    return p
  }
  function avancement(p) { var tk = p.taches || []; if (p.statut === 'livre') return 100; return tk.length ? Math.round(100 * tk.filter(function (t) { return t.ok }).length / tk.length) : 0 }
  function tempsPasse(p) { return (p.taches || []).reduce(function (a, t) { return a + (+t.temps || 0) }, 0) }
  function bloquante(p, t) { return t.dependances.map(function (id) { return p.taches.filter(function (x) { return x.id === id })[0] }).filter(function (x) { return x && !x.ok }) }
  // dépendances sans boucle : a ne peut pas dépendre de b si b dépend déjà (même indirectement) de a
  function creeBoucle(p, a, b) {
    var vus = {}, pile = [b]
    while (pile.length) { var x = pile.pop(); if (x === a) return true; if (vus[x]) continue; vus[x] = 1; var t = p.taches.filter(function (y) { return y.id === x })[0]; if (t) pile = pile.concat(t.dependances) }
    return false
  }
  function etapeCourante(p) {
    for (var i = 0; i < p.etapes.length; i++) { var e = p.etapes[i]; if (p.taches.some(function (t) { return t.etape === e.id && !t.ok })) return e }
    return null
  }
  function appliquerModele(p, type) {
    var m = MODELES[type]; if (!m) return
    p.type = type
    p.etapes = m[1].map(function (x) { return { id: idNeuf('e'), nom: x[0], phase: x[1] } })
    // une tâche par étape pour démarrer (elle porte le jalon) ; les anciennes tâches sont gardées, rattachées à la première étape
    var anciennes = p.taches.map(function (t) { if (!t.etape) t.etape = p.etapes[0].id; return t })
    p.taches = anciennes.concat(p.etapes.map(function (e) { return { id: idNeuf('t'), t: e.nom, ok: false, etape: e.id, sous: [], dependances: [], commentaires: [] } }))
    // chaque jalon dépend du précédent : on ne valide pas les maquettes avant de les avoir conçues
    var jalons = p.taches.slice(anciennes.length)
    for (var i = 1; i < jalons.length; i++) jalons[i].dependances = [jalons[i - 1].id]
  }

  /* ---------- routage : #projets (Kanban d'origine), #projets/v/liste|calendrier|timeline, #projets/<id>, #projets/new ---------- */
  function projets(id) {
    var S = K().S
    var vue = (location.hash.split('/')[2] || '')
    if (id === 'new') {
      return S.put('projets', { titre: 'Nouveau projet', statut: 'afaire', debut: today(), priorite: 'normale', taches: [], etapes: [], visibleClient: 'oui' }).then(function (p) { location.replace('#projets/' + p.id) })
    }
    if (id && id !== 'v') return fiche(id)
    if (id === 'v' && vue && vue !== 'kanban') return vues(vue)
    if (kanbanOrigine) kanbanOrigine()
    ajouterOnglets('kanban')
  }
  function onglets(actif) {
    var h = UI().h
    return h('nav', { class: 'pj-onglets noprint', 'aria-label': 'Vues des projets' },
      [['kanban', 'Kanban', '#projets', 'layout-grid'], ['liste', 'Liste détaillée', '#projets/v/liste', 'table'], ['calendrier', 'Calendrier', '#projets/v/calendrier', 'calendar-days'], ['timeline', 'Timeline', '#projets/v/timeline', 'chart-column']].map(function (o) {
        return h('a', { href: o[2], class: o[0] === actif ? 'actif' : null, 'aria-current': o[0] === actif ? 'page' : null }, UI().icone(o[3], 15), o[1])
      }))
  }
  function ajouterOnglets(actif) {
    var main = K().main, h1 = main.querySelector('h1')
    var n = onglets(actif)
    if (h1 && h1.parentNode === main) h1.after(n); else main.prepend(n)
  }

  /* =====================================================================================
     VUES : liste détaillée, calendrier, timeline
     ===================================================================================== */
  function vues(vue) {
    var S = K().S, main = K().main, U = UI(), h = U.h, fmt = U.fmt
    main.append(U.entete('Projets', 'Tous les projets de l’agence, vus autrement.', null, h('a', { class: 'btn principal', href: '#projets/new' }, U.icone('plus', 16), 'Nouveau projet')))
    main.append(onglets(vue))
    var zone = h('div'); main.append(zone)
    Promise.all([S.list('projets'), S.list('clients')]).then(function (r) {
      var pr = r[0].map(normaliser), cl = r[1], t = today()
      var client = function (id) { return nomC(cl.filter(function (c) { return c.id === id })[0]) }
      if (!pr.length) { zone.append(U.etatVide('Aucun projet pour le moment.', 'rocket')); return }
      if (vue === 'liste') {
        var lignes = pr.map(function (p) {
          var tk = p.taches, retard = p.statut !== 'livre' && p.echeance && p.echeance < t, ec = etapeCourante(p)
          return [h('a', { href: '#projets/' + p.id }, p.titre || 'Sans titre'), client(p.clientId), MODELES[p.type] ? MODELES[p.type][0] : '—', (p.responsable || '—').split('@')[0],
            fmt.date(p.debut), h('span', { class: retard ? 'pj-retard' : '' }, fmt.date(p.echeance)), avancement(p) + ' %', tk.filter(function (x) { return x.ok }).length + ' / ' + tk.length,
            ec ? ec.nom : (tk.length ? 'Terminé' : '—'), heures(tempsPasse(p)) + (p.tempsEstime ? ' / ' + heures(p.tempsEstime) : ''), p.budget ? fmt.euros(+p.budget) : '—',
            U.badge(lab(STATUTS, p.statut || 'afaire'), p.statut === 'livre' ? 'bon' : retard ? 'critique' : ''), lab(PRIORITES, p.priorite || 'normale')]
        })
        zone.append(U.carte('Liste détaillée', pr.length + ' projet(s)', U.tableauInteractif(
          [{ titre: 'Projet' }, { titre: 'Client' }, { titre: 'Type' }, { titre: 'Responsable' }, { titre: 'Début' }, { titre: 'Échéance' }, { titre: 'Avancement', num: true }, { titre: 'Tâches', num: true }, { titre: 'Étape en cours' }, { titre: 'Temps', num: true }, { titre: 'Budget HT', num: true }, { titre: 'Statut' }, { titre: 'Priorité' }],
          lignes, { placeholder: 'Rechercher un projet, un client…', legende: 'Liste détaillée des projets', nom: 'projet' }).element))
      } else if (vue === 'calendrier') {
        zone.append(calendrier(pr, client))
      } else {
        var avecTaches = h('label', { class: 'crm-chk' }, h('input', { type: 'checkbox' }), 'Afficher les tâches datées')
        var boite = h('div')
        var dessine = function () {
          boite.textContent = ''
          var lignes = []
          pr.slice().sort(function (a, b) { return (a.echeance || '9') < (b.echeance || '9') ? -1 : 1 }).forEach(function (p) {
            var fini = p.statut === 'livre', retard = !fini && p.echeance && p.echeance < t
            lignes.push({ libelle: p.titre || 'Sans titre', sous: client(p.clientId) + ' · ' + lab(STATUTS, p.statut || 'afaire'), debut: p.debut || (p.creeLe || '').slice(0, 10) || t, fin: p.echeance, href: '#projets/' + p.id, ton: fini ? 'fini' : retard ? 'retard' : '', avance: avancement(p) })
            if (avecTaches.querySelector('input').checked) p.taches.filter(function (x) { return x.echeance }).forEach(function (x) { lignes.push({ libelle: '↳ ' + x.t, sous: x.ok ? 'faite' : (x.responsable || '').split('@')[0], debut: x.debut || x.echeance, fin: x.echeance, href: '#projets/' + p.id, ton: x.ok ? 'fini' : x.echeance < t ? 'retard' : '' }) })
          })
          boite.append(U.planning(lignes, { description: 'Timeline des projets et de leurs tâches' }))
        }
        avecTaches.querySelector('input').addEventListener('change', dessine)
        zone.append(U.carte('Timeline', 'chaque projet du début à l’échéance ; la ligne marque aujourd’hui', h('div', { class: 'pj-outils' }, avecTaches), boite))
        dessine()
      }
    })
  }

  function calendrier(pr, client) {
    var U = UI(), h = U.h, t = today()
    var etat = { an: new Date().getFullYear(), mois: new Date().getMonth() }
    var boite = h('div', { class: 'pj-cal-boite' }), titre = h('h2', {})
    var carte = h('section', { class: 'carte' }, h('header', { class: 'pj-cal-tete' },
      h('button', { class: 'btn-icone', type: 'button', 'aria-label': 'Mois précédent', onclick: function () { etat.mois--; if (etat.mois < 0) { etat.mois = 11; etat.an-- } dessine() } }, U.icone('chevron-left', 18)),
      titre,
      h('button', { class: 'btn-icone', type: 'button', 'aria-label': 'Mois suivant', onclick: function () { etat.mois++; if (etat.mois > 11) { etat.mois = 0; etat.an++ } dessine() } }, U.icone('chevron-right', 18)),
      h('button', { class: 'btn lien petit', type: 'button', onclick: function () { etat.an = new Date().getFullYear(); etat.mois = new Date().getMonth(); dessine() } }, 'Aujourd’hui')),
      h('div', { class: 'legende' }, h('span', {}, h('i', { style: 'background:var(--serie-1)' }), 'Début de projet'), h('span', {}, h('i', { style: 'background:var(--critique)' }), 'Échéance de projet'), h('span', {}, h('i', { style: 'background:var(--serie-2)' }), 'Échéance de tâche')),
      boite)
    // événements du calendrier
    var ev = []
    pr.forEach(function (p) {
      if (p.debut) ev.push({ d: p.debut, t: 'Début : ' + (p.titre || 'Projet'), c: 'deb', h: '#projets/' + p.id, s: client(p.clientId) })
      if (p.echeance) ev.push({ d: p.echeance, t: 'Échéance : ' + (p.titre || 'Projet'), c: p.statut === 'livre' ? 'ok' : 'ech', h: '#projets/' + p.id, s: client(p.clientId) })
      p.taches.forEach(function (x) { if (x.echeance) ev.push({ d: x.echeance, t: x.t, c: x.ok ? 'ok' : 'tache', h: '#projets/' + p.id, s: p.titre }) })
    })
    function dessine() {
      var d0 = new Date(etat.an, etat.mois, 1), nb = new Date(etat.an, etat.mois + 1, 0).getDate(), dec = (d0.getDay() + 6) % 7
      titre.textContent = d0.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      boite.textContent = ''
      var g = h('div', { class: 'pj-cal', role: 'grid', 'aria-label': 'Calendrier des projets' })
      ;['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].forEach(function (j) { g.append(h('div', { class: 'pj-cal-j', role: 'columnheader' }, j)) })
      for (var i = 0; i < dec; i++) g.append(h('div', { class: 'pj-cal-c vide', 'aria-hidden': 'true' }))
      for (var j = 1; j <= nb; j++) {
        var iso = etat.an + '-' + ('0' + (etat.mois + 1)).slice(-2) + '-' + ('0' + j).slice(-2)
        var du = ev.filter(function (e) { return e.d === iso })
        g.append(h('div', { class: 'pj-cal-c' + (iso === t ? ' auj' : '') + (iso < t ? ' passe' : ''), role: 'gridcell' },
          h('span', { class: 'pj-cal-n' }, String(j)),
          du.slice(0, 4).map(function (e) { return h('a', { class: 'pj-ev ' + e.c, href: e.h, title: e.t + (e.s ? ' · ' + e.s : '') }, e.t) }),
          du.length > 4 ? h('small', { class: 'discret' }, '+' + (du.length - 4) + ' autre(s)') : null))
      }
      boite.append(g)
    }
    dessine()
    return carte
  }

  /* =====================================================================================
     FICHE DE PILOTAGE D'UN PROJET
     ===================================================================================== */
  function fiche(id) {
    var S = K().S, main = K().main, U = UI(), h = U.h, fmt = U.fmt
    var equipe = S.sb && S.sb.on() ? S.sb.get('staff_members?select=email,nom,actif&actif=eq.true&order=email').catch(function () { return [] }) : Promise.resolve([])
    Promise.all([S.list('projets'), S.list('clients'), equipe]).then(function (r) {
      var p = r[0].filter(function (x) { return x.id === id })[0]
      if (!p) { main.append(h('p', { class: 'vide' }, 'Projet introuvable.')); return }
      normaliser(p)
      var cl = r[1], staff = r[2], t = today()
      var ouvertes = {}   // tâches dont le détail est déplié
      var enregistrement = Promise.resolve()
      function sauver(message) {
        enregistrement = enregistrement.then(function () { return S.put('projets', p) }).then(function (x) {
          if (message) U.toast(message, 'bon'); return x
        }, function (er) { U.toast('Enregistrement impossible : ' + er.message, 'erreur') })
        return enregistrement
      }
      var nomPers = function (mail) { var s = staff.filter(function (x) { return x.email === mail })[0]; return s && s.nom ? s.nom : (mail || '').split('@')[0] }
      var choixResp = function (val) {
        if (!staff.length) return h('input', { type: 'text', value: val || '', placeholder: 'Nom ou e-mail' })
        return h('select', {}, h('option', { value: '' }, '— Personne —'), staff.map(function (s) { return h('option', { value: s.email, selected: s.email === val }, s.nom || s.email) }), val && !staff.some(function (s) { return s.email === val }) ? h('option', { value: val, selected: true }, val) : null)
      }

      main.append(h('p', { class: 'noprint' }, h('a', { href: '#projets' }, '← Tous les projets')))
      var tete = h('div'), infos = h('div'), etapesZone = h('div'), gantt = h('div'), pj = h('div')
      main.append(tete, infos, etapesZone, gantt, pj)

      /* ---- en-tête et indicateurs (recalculés après chaque changement) ---- */
      function dessinerTete() {
        tete.textContent = ''
        var tk = p.taches, faites = tk.filter(function (x) { return x.ok }).length, av = avancement(p), ec = etapeCourante(p)
        var jr = p.echeance ? Math.round((Date.parse(p.echeance + 'T12:00:00') - Date.parse(t + 'T12:00:00')) / 864e5) : null
        var retard = p.statut !== 'livre' && jr != null && jr < 0
        tete.append(U.entete(p.titre || 'Projet sans titre', [nomC(cl.filter(function (c) { return c.id === p.clientId })[0]), MODELES[p.type] ? MODELES[p.type][0] : null, p.responsable ? 'Responsable : ' + nomPers(p.responsable) : null].filter(Boolean).join(' · '), null,
          U.badge(lab(STATUTS, p.statut || 'afaire'), p.statut === 'livre' ? 'bon' : retard ? 'critique' : ''),
          (p.priorite || 'normale') !== 'normale' ? U.badge('Priorité ' + lab(PRIORITES, p.priorite).toLowerCase(), p.priorite === 'haute' ? 'critique' : 'neutre') : null))
        var tempsP = tempsPasse(p), est = +p.tempsEstime || 0
        tete.append(h('div', { class: 'grille kpi' },
          U.tuile('Avancement', av + ' %', tk.length ? 'calculé sur ' + fmt.pluriel(tk.length, 'tâche') : 'ajoutez des tâches pour le calculer', false, { icone: 'gauge', visuel: U.G.progression([{ valeur: faites, couleur: 'var(--serie-1)', libelle: 'Faites' }, { valeur: tk.length - faites, couleur: 'var(--serie-neutre)', libelle: 'Restantes' }], { description: 'Tâches faites et restantes' }) }),
          U.tuile('Étape en cours', ec ? ec.nom : (tk.length ? 'Tout est fait' : '—'), ec ? 'côté client : ' + PHASES[ec.phase || 1] : (p.etapes.length ? 'tous les jalons sont franchis' : 'appliquez un modèle d’étapes'), false, { icone: 'map-pin' }),
          U.tuile('Échéance', p.echeance ? fmt.date(p.echeance) : '—', jr == null ? 'à définir' : retard ? 'en retard de ' + fmt.pluriel(-jr, 'jour') : p.statut === 'livre' ? 'projet livré' : 'dans ' + fmt.pluriel(jr, 'jour'), retard, { icone: 'calendar-clock' }),
          U.tuile('Temps passé', heures(tempsP), est ? 'sur ' + heures(est) + ' estimées' + (tempsP > est ? ' · dépassement' : '') : 'aucune estimation', est && tempsP > est, { icone: 'timer' })))
      }

      /* ---- informations ---- */
      function dessinerInfos() {
        infos.textContent = ''
        var f = {
          titre: h('input', { value: p.titre || '', maxlength: '200' }),
          client: h('select', {}, h('option', { value: '' }, '— Aucun —'), cl.map(function (c) { return h('option', { value: c.id, selected: c.id === p.clientId }, nomC(c)) })),
          type: h('select', {}, h('option', { value: '' }, '— Non précisé —'), Object.keys(MODELES).map(function (k) { return h('option', { value: k, selected: k === p.type }, MODELES[k][0]) })),
          statut: h('select', {}, STATUTS.map(function (s) { return h('option', { value: s[0], selected: s[0] === (p.statut || 'afaire') }, s[1]) })),
          priorite: h('select', {}, PRIORITES.map(function (s) { return h('option', { value: s[0], selected: s[0] === (p.priorite || 'normale') }, s[1]) })),
          responsable: choixResp(p.responsable),
          debut: h('input', { type: 'date', value: p.debut || '' }),
          echeance: h('input', { type: 'date', value: p.echeance || '' }),
          budget: h('input', { type: 'number', min: '0', step: '50', value: p.budget || '' }),
          tempsEstime: h('input', { type: 'number', min: '0', step: '0.5', value: p.tempsEstime || '' }),
          visible: h('select', {}, h('option', { value: 'oui', selected: p.visibleClient !== 'non' }, 'Visible : le client suit ce projet'), h('option', { value: 'non', selected: p.visibleClient === 'non' }, 'Interne : le client ne le voit pas')),
          desc: h('textarea', { rows: '4', maxlength: '5000' }),
        }
        f.desc.value = p.desc || ''
        var champ = function (l, i, large) { return h('label', { class: large ? 'pj-large' : null }, l, i) }
        infos.append(h('section', { class: 'carte pj-infos' }, h('header', {}, h('h2', {}, 'Informations'), h('span', { class: 'discret' }, 'client, prestation, dates, budget')),
          h('div', { class: 'pj-grille' }, champ('Titre', f.titre), champ('Client', f.client), champ('Type de prestation', f.type), champ('Statut', f.statut), champ('Priorité', f.priorite), champ('Responsable', f.responsable),
            champ('Début', f.debut), champ('Livraison prévue', f.echeance), champ('Budget HT (€)', f.budget), champ('Temps estimé (h)', f.tempsEstime), champ('Espace client', f.visible), champ('Description / cahier des charges', f.desc, true)),
          h('div', { class: 'cta' },
            h('button', { class: 'btn principal', type: 'button', onclick: function () {
              if (f.debut.value && f.echeance.value && f.echeance.value < f.debut.value) { U.toast('La livraison prévue est avant le début.', 'erreur'); f.echeance.focus(); return }
              p.titre = f.titre.value.trim() || 'Projet sans titre'; p.clientId = f.client.value; p.type = f.type.value; p.statut = f.statut.value; p.priorite = f.priorite.value; p.responsable = f.responsable.value.trim()
              p.debut = f.debut.value; p.echeance = f.echeance.value; p.budget = f.budget.value === '' ? '' : Math.max(0, +f.budget.value); p.tempsEstime = f.tempsEstime.value === '' ? '' : Math.max(0, +f.tempsEstime.value); p.visibleClient = f.visible.value; p.desc = f.desc.value
              sauver('Projet enregistré.').then(function () { dessinerTete(); dessinerEtapes(); dessinerGantt() })
            } }, 'Enregistrer'),
            h('button', { class: 'btn', type: 'button', onclick: function () {
              U.confirmer({ titre: 'Mettre le projet à la corbeille ?', texte: 'Il disparaît des listes et de l’espace client. La direction peut le restaurer depuis Journal & corbeille.', bouton: 'Mettre à la corbeille', danger: true }).then(function (ok) { if (ok) S.del('projets', p.id).then(function () { K().go('projets') }) })
            } }, 'Mettre à la corbeille'))))
      }

      /* ---- étapes (jalons) et tâches ---- */
      function dessinerEtapes() {
        etapesZone.textContent = ''
        var carte = h('section', { class: 'carte pj-etapes' }, h('header', {}, h('h2', {}, 'Étapes et tâches'), h('span', { class: 'discret' }, 'une étape est franchie quand toutes ses tâches sont faites')))
        var modele = h('select', { 'aria-label': 'Modèle d’étapes' }, Object.keys(MODELES).map(function (k) { return h('option', { value: k, selected: k === (p.type || 'site-vitrine') }, MODELES[k][0]) }))
        carte.append(h('div', { class: 'pj-outils' },
          h('label', {}, 'Modèle', modele),
          h('button', { class: 'btn', type: 'button', onclick: function () {
            var go = function () { appliquerModele(p, modele.value); sauver('Étapes du modèle « ' + MODELES[modele.value][0] + ' » appliquées.').then(tout) }
            if (p.etapes.length) U.confirmer({ titre: 'Remplacer les étapes ?', texte: 'Les étapes actuelles sont remplacées par celles du modèle. Les tâches existantes sont gardées et rattachées à la première étape.', bouton: 'Remplacer' }).then(function (ok) { if (ok) go() })
            else go()
          } }, U.icone('list-checks', 15), p.etapes.length ? 'Remplacer par le modèle' : 'Appliquer le modèle'),
          h('button', { class: 'btn', type: 'button', onclick: function () {
            var nom = window.prompt('Nom de la nouvelle étape')
            if (!nom || !nom.trim()) return
            var ph = Math.max(1, Math.min(4, +(window.prompt('Phase vue par le client : 1 Découverte, 2 Conception, 3 Lancement, 4 Suivi', '2') || 2)))
            p.etapes.push({ id: idNeuf('e'), nom: nom.trim().slice(0, 120), phase: ph }); sauver('Étape ajoutée.').then(tout)
          } }, U.icone('plus', 15), 'Ajouter une étape')))
        var groupes = p.etapes.concat([{ id: '', nom: p.etapes.length ? 'Sans étape' : 'Tâches', phase: 0 }])
        groupes.forEach(function (e, ei) {
          var siennes = p.taches.filter(function (x) { return (x.etape || '') === e.id || (!e.id && !p.etapes.some(function (y) { return y.id === x.etape })) })
          if (!e.id && !siennes.length && p.etapes.length) return
          var faites = siennes.filter(function (x) { return x.ok }).length, franchie = siennes.length && faites === siennes.length
          var sec = h('section', { class: 'pj-etape' + (franchie ? ' franchie' : '') + (etapeCourante(p) === e ? ' courante' : '') })
          var head = h('header', {},
            h('span', { class: 'pj-etape-n', 'aria-hidden': 'true' }, franchie ? U.icone('check', 13) : String(ei + 1)),
            h('div', { class: 'pj-etape-t' }, h('b', {}, e.nom), e.phase ? h('small', { class: 'discret' }, 'Côté client : ' + PHASES[e.phase] + ' · ' + faites + '/' + siennes.length) : null),
            siennes.length ? h('div', { class: 'pj-mini', role: 'img', 'aria-label': faites + ' tâche(s) faite(s) sur ' + siennes.length }, h('i', { style: 'width:' + Math.round(100 * faites / siennes.length) + '%' })) : null)
          if (e.id) head.append(h('div', { class: 'pj-etape-a noprint' },
            h('button', { class: 'btn-icone petit', type: 'button', 'aria-label': 'Monter l’étape ' + e.nom, disabled: ei === 0, onclick: function () { var i = p.etapes.indexOf(e); p.etapes.splice(i, 1); p.etapes.splice(i - 1, 0, e); sauver().then(tout) } }, U.icone('chevron-up', 15)),
            h('button', { class: 'btn-icone petit', type: 'button', 'aria-label': 'Descendre l’étape ' + e.nom, disabled: ei === p.etapes.length - 1, onclick: function () { var i = p.etapes.indexOf(e); p.etapes.splice(i, 1); p.etapes.splice(i + 1, 0, e); sauver().then(tout) } }, U.icone('chevron-down', 15)),
            h('button', { class: 'btn-icone petit', type: 'button', 'aria-label': 'Renommer l’étape ' + e.nom, onclick: function () { var n = window.prompt('Nouveau nom de l’étape', e.nom); if (n && n.trim()) { e.nom = n.trim().slice(0, 120); sauver().then(tout) } } }, U.icone('square-pen', 15)),
            h('button', { class: 'btn-icone petit', type: 'button', 'aria-label': 'Supprimer l’étape ' + e.nom, onclick: function () {
              U.confirmer({ titre: 'Supprimer l’étape « ' + e.nom + ' » ?', texte: 'Ses tâches sont gardées, sans étape.', bouton: 'Supprimer', danger: true }).then(function (ok) { if (!ok) return; p.etapes = p.etapes.filter(function (x) { return x !== e }); p.taches.forEach(function (x) { if (x.etape === e.id) x.etape = '' }); sauver('Étape supprimée.').then(tout) })
            } }, U.icone('trash-2', 15))))
          sec.append(head)
          var ul = h('ul', { class: 'pj-taches' })
          siennes.forEach(function (x) { ul.append(ligneTache(x)) })
          sec.append(ul)
          var nt = h('input', { placeholder: 'Nouvelle tâche…', maxlength: '200', 'aria-label': 'Nouvelle tâche dans ' + e.nom })
          var ajout = function () { if (!nt.value.trim()) return; p.taches.push({ id: idNeuf('t'), t: nt.value.trim(), ok: false, etape: e.id, sous: [], dependances: [], commentaires: [] }); sauver().then(tout) }
          nt.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); ajout() } })
          sec.append(h('div', { class: 'pj-ajout noprint' }, nt, h('button', { class: 'btn petit', type: 'button', onclick: ajout }, U.icone('plus', 14), 'Ajouter')))
          carte.append(sec)
        })
        etapesZone.append(carte)
      }

      function ligneTache(x) {
        var bloq = bloquante(p, x), retard = !x.ok && x.echeance && x.echeance < t
        var c = h('input', { type: 'checkbox', checked: !!x.ok, disabled: !x.ok && bloq.length > 0, 'aria-label': 'Tâche faite : ' + x.t })
        c.addEventListener('change', function () {
          if (c.checked && bloq.length) { c.checked = false; return }
          x.ok = c.checked; if (x.ok) x.faiteLe = today(); else delete x.faiteLe
          sauver().then(tout)
        })
        var sousFaites = x.sous.filter(function (s) { return s.ok }).length
        var li = h('li', { class: 'pj-tache' + (x.ok ? ' faite' : '') + (retard ? ' retard' : '') },
          h('div', { class: 'pj-tache-l' }, c,
            h('button', { class: 'pj-tache-t', type: 'button', 'aria-expanded': ouvertes[x.id] ? 'true' : 'false', onclick: function () { ouvertes[x.id] = !ouvertes[x.id]; tout(true) } }, x.t),
            h('span', { class: 'pj-chips' },
              x.responsable ? h('span', { class: 'pj-chip', title: 'Responsable' }, U.icone('user', 12), nomPers(x.responsable)) : null,
              x.echeance ? h('span', { class: 'pj-chip' + (retard ? ' retard' : '') }, U.icone('calendar-clock', 12), fmt.date(x.echeance)) : null,
              +x.temps ? h('span', { class: 'pj-chip' }, U.icone('timer', 12), heures(x.temps)) : null,
              x.sous.length ? h('span', { class: 'pj-chip' }, U.icone('list-checks', 12), sousFaites + '/' + x.sous.length) : null,
              x.commentaires.length ? h('span', { class: 'pj-chip' }, U.icone('message-square', 12), String(x.commentaires.length)) : null,
              bloq.length ? h('span', { class: 'pj-chip bloque', title: 'Attend : ' + bloq.map(function (b) { return b.t }).join(', ') }, U.icone('lock', 12), 'attend ' + (bloq.length > 1 ? bloq.length + ' tâches' : '« ' + bloq[0].t + ' »')) : null)))
        if (ouvertes[x.id]) li.append(detailTache(x))
        return li
      }

      function detailTache(x) {
        var f = {
          t: h('input', { value: x.t, maxlength: '200' }),
          etape: h('select', {}, h('option', { value: '' }, '— Sans étape —'), p.etapes.map(function (e) { return h('option', { value: e.id, selected: e.id === x.etape }, e.nom) })),
          responsable: choixResp(x.responsable),
          debut: h('input', { type: 'date', value: x.debut || '' }),
          echeance: h('input', { type: 'date', value: x.echeance || '' }),
          temps: h('input', { type: 'number', min: '0', step: '0.25', value: x.temps || '' }),
        }
        var champ = function (l, i) { return h('label', {}, l, i) }
        var deps = h('div', { class: 'pj-deps' }, p.taches.filter(function (y) { return y !== x }).map(function (y) {
          var cb = h('input', { type: 'checkbox', value: y.id, checked: x.dependances.indexOf(y.id) >= 0 })
          return h('label', { class: 'crm-chk' }, cb, y.t)
        }))
        // sous-tâches
        var sous = h('ul', { class: 'pj-sous' })
        function dessinerSous() {
          sous.textContent = ''
          x.sous.forEach(function (s, i) {
            var cb = h('input', { type: 'checkbox', checked: !!s.ok, 'aria-label': 'Sous-tâche faite : ' + s.t })
            cb.addEventListener('change', function () {
              s.ok = cb.checked
              // toutes les sous-tâches faites (et rien qui bloque) : la tâche est faite ; une sous-tâche rouverte rouvre la tâche
              if (x.sous.every(function (y) { return y.ok }) && !bloquante(p, x).length) { x.ok = true; x.faiteLe = today() } else if (!s.ok) { x.ok = false; delete x.faiteLe }
              sauver().then(function () { tout(true) })
            })
            sous.append(h('li', {}, cb, h('span', {}, s.t), h('button', { class: 'btn lien petit', type: 'button', 'aria-label': 'Retirer la sous-tâche ' + s.t, onclick: function () { x.sous.splice(i, 1); sauver().then(function () { tout(true) }) } }, 'Retirer')))
          })
        }
        dessinerSous()
        var ns = h('input', { placeholder: 'Nouvelle sous-tâche…', maxlength: '200', 'aria-label': 'Nouvelle sous-tâche' })
        var ajoutSous = function () { if (!ns.value.trim()) return; x.sous.push({ t: ns.value.trim(), ok: false }); if (x.ok) { x.ok = false; delete x.faiteLe } sauver().then(function () { tout(true) }) }
        ns.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); ajoutSous() } })
        // commentaires
        var fil = h('ol', { class: 'pj-com' }, x.commentaires.length ? x.commentaires.map(function (m) { return h('li', {}, h('b', {}, nomPers(m.auteur) || 'Équipe'), h('span', { class: 'discret' }, ' · ' + fmt.dateHeure(m.date)), h('p', {}, m.texte)) }) : h('li', { class: 'discret' }, 'Aucun commentaire.'))
        var nc = h('textarea', { rows: '2', maxlength: '2000', placeholder: 'Un commentaire pour l’équipe…', 'aria-label': 'Nouveau commentaire' })
        return h('div', { class: 'pj-detail' },
          h('div', { class: 'pj-grille' }, champ('Intitulé', f.t), champ('Étape', f.etape), champ('Responsable', f.responsable), champ('Début', f.debut), champ('Échéance', f.echeance), champ('Temps passé (h)', f.temps)),
          h('div', { class: 'pj-temps noprint' }, h('span', { class: 'discret' }, 'Ajouter du temps :'), [0.25, 0.5, 1, 2].map(function (n) { return h('button', { class: 'btn petit', type: 'button', onclick: function () { f.temps.value = Math.round(((+f.temps.value || 0) + n) * 100) / 100 } }, '+' + n.toLocaleString('fr-FR') + ' h') })),
          h('fieldset', { class: 'crm-fs' }, h('legend', {}, 'Doit attendre que ces tâches soient faites'), p.taches.length > 1 ? deps : h('p', { class: 'discret' }, 'Aucune autre tâche.')),
          h('fieldset', { class: 'crm-fs' }, h('legend', {}, 'Sous-tâches'), sous, h('div', { class: 'pj-ajout' }, ns, h('button', { class: 'btn petit', type: 'button', onclick: ajoutSous }, 'Ajouter'))),
          h('fieldset', { class: 'crm-fs' }, h('legend', {}, 'Commentaires'), fil, h('div', { class: 'pj-ajout' }, nc, h('button', { class: 'btn petit', type: 'button', onclick: function () {
            if (!nc.value.trim()) return
            x.commentaires.push({ auteur: S.auth && S.auth.email ? S.auth.email() : '', date: new Date().toISOString(), texte: nc.value.trim().slice(0, 2000) }); sauver('Commentaire ajouté.').then(function () { tout(true) })
          } }, 'Publier'))),
          h('div', { class: 'cta' },
            h('button', { class: 'btn principal', type: 'button', onclick: function () {
              if (f.debut.value && f.echeance.value && f.echeance.value < f.debut.value) { U.toast('L’échéance est avant le début.', 'erreur'); return }
              var choix = [].slice.call(deps.querySelectorAll('input:checked')).map(function (i) { return i.value })
              var boucle = choix.filter(function (d) { return creeBoucle(p, x.id, d) })
              if (boucle.length) { U.toast('Impossible : cette dépendance créerait une boucle (une tâche qui s’attend elle-même).', 'erreur'); return }
              x.t = f.t.value.trim() || x.t; x.etape = f.etape.value; x.responsable = f.responsable.value.trim(); x.debut = f.debut.value; x.echeance = f.echeance.value; x.temps = f.temps.value === '' ? '' : Math.max(0, +f.temps.value); x.dependances = choix
              if (x.ok && bloquante(p, x).length) { x.ok = false; delete x.faiteLe }
              sauver('Tâche enregistrée.').then(function () { ouvertes[x.id] = false; tout() })
            } }, 'Enregistrer la tâche'),
            h('button', { class: 'btn', type: 'button', onclick: function () {
              U.confirmer({ titre: 'Supprimer la tâche « ' + x.t + ' » ?', texte: 'Ses sous-tâches et commentaires sont supprimés avec elle.', bouton: 'Supprimer', danger: true }).then(function (ok) {
                if (!ok) return
                p.taches = p.taches.filter(function (y) { return y !== x }); p.taches.forEach(function (y) { y.dependances = y.dependances.filter(function (d) { return d !== x.id }) })
                sauver('Tâche supprimée.').then(tout)
              })
            } }, 'Supprimer la tâche')))
      }

      /* ---- planning des tâches (Gantt) ---- */
      function dessinerGantt() {
        gantt.textContent = ''
        var lignes = []
        p.etapes.forEach(function (e) {
          var siennes = p.taches.filter(function (x) { return x.etape === e.id && (x.echeance || x.debut) })
          siennes.forEach(function (x) {
            var bloq = bloquante(p, x)
            lignes.push({ libelle: x.t, sous: e.nom + (bloq.length ? ' · attend « ' + bloq[0].t + ' »' : ''), debut: x.debut || x.echeance, fin: x.echeance || x.debut, ton: x.ok ? 'fini' : x.echeance && x.echeance < t ? 'retard' : '' })
          })
        })
        p.taches.filter(function (x) { return !p.etapes.some(function (e) { return e.id === x.etape }) && (x.echeance || x.debut) }).forEach(function (x) { lignes.push({ libelle: x.t, sous: 'Sans étape', debut: x.debut || x.echeance, fin: x.echeance || x.debut, ton: x.ok ? 'fini' : x.echeance && x.echeance < t ? 'retard' : '' }) })
        gantt.append(U.carte('Planning des tâches', 'diagramme de Gantt : donnez un début et une échéance aux tâches pour les placer', lignes.length ? U.planning(lignes, { description: 'Diagramme de Gantt des tâches du projet' }) : U.etatVide('Aucune tâche datée pour l’instant.', 'calendar-days')))
      }

      /* ---- pièces jointes (stockage privé « documents ») ---- */
      function dessinerPj() {
        pj.textContent = ''
        var carte = h('section', { class: 'carte' }, h('header', {}, h('h2', {}, 'Pièces jointes'), h('span', { class: 'discret' }, 'cahier des charges, maquettes, contrats, livrables')))
        pj.append(carte)
        if (!(S.sb && S.sb.on())) { carte.append(U.etatVide('Disponible quand l’administration est connectée à la base.', 'upload')); return }
        var liste = h('div'), fic = h('input', { type: 'file', 'aria-label': 'Fichier à joindre', multiple: true })
        var cat = h('select', { 'aria-label': 'Catégorie' }, [['livrable', 'Livrable'], ['maquette', 'Maquette'], ['contrat', 'Contrat'], ['technique', 'Document technique'], ['guide', 'Guide d’utilisation'], ['image', 'Image'], ['video', 'Vidéo'], ['logo', 'Logo'], ['autre', 'Autre']].map(function (x) { return h('option', { value: x[0] }, x[1]) }))
        var vis = h('label', { class: 'crm-chk' }, h('input', { type: 'checkbox', checked: p.visibleClient !== 'non' && !!p.clientId, disabled: !p.clientId }), 'Visible par le client')
        var etat = h('p', { class: 'msg', role: 'status' })
        carte.append(h('div', { class: 'pj-outils' }, fic, cat, vis, h('button', { class: 'btn principal', type: 'button', onclick: function () {
          var fs = [].slice.call(fic.files || [])
          if (!fs.length) { U.toast('Choisissez un fichier.', 'erreur'); return }
          var trop = fs.filter(function (f) { return f.size > 50 * 1024 * 1024 })
          if (trop.length) { U.toast('50 Mo maximum par fichier.', 'erreur'); return }
          var visible = vis.querySelector('input').checked && !!p.clientId
          etat.textContent = 'Envoi en cours…'
          fs.reduce(function (prom, f) {
            return prom.then(function () {
              var propre = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80)
              var chemin = (p.clientId ? 'clients/' + p.clientId : 'interne') + '/projets/' + p.id + '/' + Date.now().toString(36) + '-' + propre
              return S.sb.deposer(chemin, f).then(function () {
                return S.sb.post('documents', { client_id: p.clientId || null, project_id: p.id, categorie: cat.value, nom: f.name.slice(0, 200), path: chemin, taille: f.size, mime: f.type || '', visible_client: visible, uploaded_role: 'equipe' })
              })
            })
          }, Promise.resolve()).then(function () { etat.textContent = ''; fic.value = ''; U.toast('Fichier(s) joint(s).', 'bon'); charger() }, function (er) { etat.textContent = 'Envoi impossible : ' + er.message })
        } }, U.icone('upload', 15), 'Joindre')), etat, liste)
        function charger() {
          liste.textContent = ''
          S.sb.get('documents?project_id=eq.' + encodeURIComponent(p.id) + '&deleted_at=is.null&select=id,nom,categorie,taille,visible_client,created_at,path&order=created_at.desc').then(function (docs) {
            if (!docs.length) { liste.append(U.etatVide('Aucune pièce jointe.', 'folder')); return }
            liste.append(U.tableau([{ titre: 'Fichier' }, { titre: 'Catégorie' }, { titre: 'Taille', num: true }, { titre: 'Déposé le' }, { titre: 'Client' }, { titre: '' }], docs.map(function (d) {
              return [h('button', { class: 'btn lien petit', type: 'button', onclick: function () { S.sb.fichier(d.path).then(function (u) { window.open(u, '_blank', 'noopener') }, function (er) { U.toast(er.message, 'erreur') }) } }, U.icone('download', 13), d.nom),
                d.categorie, d.taille ? (d.taille > 1048576 ? (d.taille / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(d.taille / 1024)) + ' Ko') : '—', fmt.date(d.created_at), d.visible_client ? 'Visible' : 'Interne',
                h('button', { class: 'btn lien petit', type: 'button', onclick: function () {
                  U.confirmer({ titre: 'Retirer « ' + d.nom + ' » ?', texte: 'Le document est mis à la corbeille.', bouton: 'Retirer', danger: true }).then(function (ok) { if (ok) S.sb.patch('documents?id=eq.' + encodeURIComponent(d.id), { deleted_at: new Date().toISOString() }).then(charger) })
                } }, 'Retirer')]
            }), { legende: 'Pièces jointes du projet' }))
          }).catch(function (er) { liste.append(h('p', { class: 'msg' }, 'Pièces jointes indisponibles : ' + er.message)) })
        }
        charger()
      }

      // garde l'étape dépliée et la position de lecture quand on redessine
      function tout(garderPosition) {
        var y = window.scrollY
        dessinerTete(); dessinerEtapes(); dessinerGantt()
        if (garderPosition !== false) window.scrollTo(0, y)
      }
      dessinerTete(); dessinerInfos(); dessinerEtapes(); dessinerGantt(); dessinerPj()
    })
  }

  M.projets = projets
  M.MODELES_PROJET = MODELES
  M.projetsOutils = { avancement: avancement, etapeCourante: etapeCourante, bloquante: bloquante, creeBoucle: creeBoucle, appliquerModele: appliquerModele, normaliser: normaliser }
})()
