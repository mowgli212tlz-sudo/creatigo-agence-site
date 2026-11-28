/* Administration Creatigo : tableau de bord, devis, catalogue, clients, données.
   Tout le texte saisi passe par textContent / value (jamais innerHTML) : une demande de devis venant du site est une donnée non fiable.
   shortcut: le code d’accès est vérifié dans le navigateur — ce n’est PAS une sécurité. À remplacer par une vraie authentification serveur avec la base. */
(function () {
  var S = window.CreatigoStore
  var CODE = 'creatigo' // à changer
  var main = document.getElementById('main'), menu = document.getElementById('menu')
  var VUES = [['dashboard', 'Tableau de bord', 'Pilotage'], ['cockpit', 'Cockpit', 'Pilotage'], ['pipeline', 'Pipeline commercial', 'Relation client'], ['clients', 'Clients', 'Relation client'], ['messages', 'Messagerie', 'Relation client'], ['demandes', 'Demandes clients', 'Relation client'], ['rdv', 'Rendez-vous', 'Relation client'], ['devis', 'Devis', 'Ventes'], ['factures', 'Factures', 'Ventes'], ['catalogue', 'Catalogue & tarifs', 'Ventes'], ['finances', 'Centre financier', 'Ventes'], ['projets', 'Projets', 'Production'], ['studio', 'Studio de validation', 'Production'], ['sites', 'Sites & maintenance', 'Production'], ['performances', 'Performances clients', 'Production'], ['site', 'Site & messages', 'Site'], ['donnees', 'Données', 'Système'], ['automatisations', 'Automatisations', 'Système'], ['integrations', 'Intégrations', 'Système'], ['ia', 'Assistant IA', 'Système'], ['equipe', 'Équipe & accès', 'Système'], ['journal', 'Journal & corbeille', 'Système']]

  var ICO = { dashboard: 'layout-dashboard', cockpit: 'gauge', pipeline: 'trending-up', finances: 'wallet', messages: 'message-circle', studio: 'palette', sites: 'server', performances: 'chart-column', automatisations: 'sliders-horizontal', integrations: 'cpu', clients: 'users', demandes: 'mail', rdv: 'calendar-days', devis: 'file-text', factures: 'receipt-text', projets: 'rocket', site: 'globe', catalogue: 'shopping-cart', donnees: 'server', equipe: 'users', journal: 'clock', ia: 'sparkles' }
  function el(t, a, kids) {
    var e = document.createElement(t)
    for (var k in a || {}) {
      if (k === 'text') e.textContent = a[k]
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), a[k])
      else if (a[k] !== false && a[k] != null) e.setAttribute(k, a[k] === true ? '' : a[k])
    }
    ;(kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c) })
    return e
  }
  function field(label, input) { return el('label', {}, [label, input]) }
  function badge(s) { return el('span', { class: 'badge b-' + s, text: S.statutLabel(s) }) }
  function date(iso) { return iso ? new Date(iso).toLocaleDateString('fr-FR') : '' }
  function clear() { main.textContent = '' }
  function go(h) { location.hash = h }

  window.AdminKit = { S: S, el: el, field: field, date: date, go: go, main: main, role: function () { return ROLE }, route: function () { route() } }
  // rôle de la personne connectée (donné par la base) : sert à masquer les vues inutiles ; la base refuse de toute façon les données interdites
  var ROLE = 'super_admin'
  function masque() { var M = window.AdminModules || {}; return (M.MASQUE && M.MASQUE[ROLE]) || [] }

  // ---------- accès ----------
  function showApp(on) {
    document.getElementById('login').hidden = on
    document.getElementById('app').hidden = !on
    if (!on) return
    if (!(BASE && S.auth.session())) { ROLE = 'super_admin'; route(); return }
    S.auth.role().then(function (r) {
      ROLE = r || 'super_admin'   // base pas encore à jour (pas de rôles) : l'accès a déjà été vérifié par is_admin()
      var M = window.AdminModules || {}, lib = M.ROLES ? (M.ROLES.filter(function (x) { return x[0] === ROLE })[0] || [0, ROLE])[1] : ROLE
      var mail = S.auth.email() || ''
      var p = document.querySelector('.profil'); if (p) { p.querySelector('.nom').textContent = mail.split('@')[0] || 'Mon compte'; p.querySelector('.role').textContent = lib; p.querySelector('.avatar').textContent = (mail[0] || 'C').toUpperCase() + (mail.split('@')[0][1] || '').toUpperCase() }
      var pd = document.querySelector('.puce-date'); if (pd) { pd.querySelector('.pd-t').textContent = 'Base de l’agence'; pd.title = 'Les données sont enregistrées dans la base de l’agence' }
      route()
    })
  }
  // base configurée : connexion par compte (e-mail + mot de passe, vérifiés par Supabase) ; sinon l'ancien code de démonstration
  var BASE = !!(S.auth && S.auth.enabled)
  if (BASE) {
    document.getElementById('email-l').hidden = false; document.getElementById('email').required = true
    document.getElementById('code-t').textContent = 'Mot de passe'
    document.querySelector('#lf .mut').textContent = 'Accédez à l’espace de gestion de l’agence avec votre compte.'
    document.querySelector('#lf .lg-note-t').textContent = 'Les données sont enregistrées dans la base de l’agence et partagées entre les comptes autorisés.'
  }
  document.getElementById('lf').addEventListener('submit', function (e) {
    e.preventDefault()
    var lerr = document.getElementById('lerr'); lerr.textContent = ''
    if (BASE) {
      S.auth.signIn(document.getElementById('email').value.trim(), document.getElementById('code').value).then(function () {
        document.getElementById('code').value = ''
        return S.auth.isAdmin().then(function (ok) { if (ok) showApp(true); else return S.auth.signOut().then(function () { lerr.textContent = 'Ce compte n’a pas accès à l’administration. L’espace client est sur /espace-client/.' }) })
      }, function () { lerr.textContent = 'Connexion refusée : e-mail ou mot de passe incorrect.' })
    } else if (document.getElementById('code').value === CODE) { sessionStorage.setItem('creatigo.admin', '1'); showApp(true) }
    else lerr.textContent = 'Code incorrect.'
  })
  document.getElementById('out').addEventListener('click', function () { if (BASE) S.auth.signOut().then(function () { showApp(false) }); else { sessionStorage.removeItem('creatigo.admin'); showApp(false) } })
  // session expirée ou base injoignable : message clair au lieu d'une page vide
  addEventListener('unhandledrejection', function (e) {
    var m = String((e.reason && e.reason.message) || e.reason || '')
    if (/non connecté|session expirée/.test(m)) { S.auth.signOut().then(function () { showApp(false) }); return }
    if (/PGRST20[25]/.test(m)) { if (!main.querySelector('.msg-maj')) main.insertBefore(el('p', { class: 'msg msg-maj', role: 'alert', text: 'La base de l’agence n’est pas encore à jour : lancez supabase/platform.sql dans Supabase (SQL Editor), puis rechargez la page.' }), main.firstChild); return }
    if (/^Base :|Failed to fetch|NetworkError/.test(m)) main.insertBefore(el('p', { class: 'msg', role: 'alert', text: 'La base de données ne répond pas. Vérifiez votre connexion puis rechargez la page.' }), main.firstChild)
  })

  // ---------- routeur ----------
  function route() {
    var h = (location.hash || '#dashboard').slice(1).split('/'), v = h[0]
    menu.textContent = ''
    var sec = ''
    var cache = masque()
    if (cache.indexOf(v) >= 0) v = 'refuse'
    VUES.forEach(function (x) {
      if (cache.indexOf(x[0]) >= 0) return
      if (x[2] !== sec) { sec = x[2]; menu.appendChild(el('div', { class: 'nav-titre', text: sec })) }
      var a = el('a', { href: '#' + x[0], title: x[1], 'data-icone': ICO[x[0]] }); a.innerHTML = window.icone(ICO[x[0]], 18); a.appendChild(el('span', { class: 'nav-texte', text: x[1] }))
      if (x[0] === 'dashboard') a.appendChild(el('span', { class: 'pastille pastille-alertes', hidden: true }))
      if (x[0] === v) { a.setAttribute('aria-current', 'page'); document.getElementById('titre-page').textContent = x[1]; document.title = x[1] + ' | Administration Creatigo' }
      menu.appendChild(a)
    })
    document.getElementById('app').classList.remove('menu-ouvert'); cloche()
    clear(); main.setAttribute('data-vue', v); document.documentElement.dataset.route = v
    ;var M = window.AdminModules || {}
    ;({ dashboard: dashboard, cockpit: function () { return M.cockpit() }, finances: function () { return M.finances(h[1], h[2]) }, studio: function () { return M.studio(h[1]) }, sites: function () { return M.sites(h[1], h[2]) }, performances: function () { return M.performances(h[1]) }, automatisations: function () { return M.automatisations(h[1]) }, integrations: function () { return M.integrations() }, messages: function () { return M.messagerie(h[1], h[2]) }, pipeline: function () { return M.pipeline() }, devis: h[1] ? function () { return fiche(h[1]) } : liste, catalogue: catalogue, clients: function () { return M.clients(h[1]) }, demandes: function () { return M.demandes(h[1]) }, rdv: function () { return M.rdv(h[1]) }, factures: function () { return M.factures(h[1]) }, projets: function () { return M.projets(h[1]) }, site: function () { return M.site(h[1], h[2]) }, donnees: donnees, ia: function () { return M.ia() }, equipe: function () { return M.equipe() }, journal: function () { return M.journal() }, refuse: refuse }[v] || dashboard)()
    main.focus()
  }
  function refuse() { document.getElementById('titre-page').textContent = 'Accès réservé'; main.appendChild(el('h1', { text: 'Accès réservé' })); main.appendChild(el('p', { class: 'lead', text: 'Cette partie est réservée à la direction. Demandez à un super administrateur si vous en avez besoin.' })) }
  // cloche : notifications de la base (demandes du site, messages clients…) + ce qui est à traiter (relances, retards)
  var cl = document.getElementById('cloche'), clp = document.getElementById('cloche-p'), cln = document.getElementById('cloche-n')
  document.getElementById('cloche-i').innerHTML = window.icone('bell', 18)
  function cloche() {
    var M = window.AdminModules, UI = window.UI
    Promise.all([M.notifications ? M.notifications() : [], M.alertes()]).then(function (r) {
      var nv = r[0], l = r[1], n = nv.length + l.length
      cln.hidden = !n; cln.textContent = n > 99 ? '99+' : String(n)
      cl.classList.toggle('a-traiter', n > 0)
      cl.setAttribute('aria-label', n ? 'À traiter : ' + n : 'À traiter : rien')
      var pa = document.querySelectorAll('.pastille-alertes'); for (var i = 0; i < pa.length; i++) { pa[i].textContent = String(l.length); pa[i].hidden = !l.length }
      clp.textContent = ''
      function ferme() { clp.hidden = true; cl.setAttribute('aria-expanded', 'false') }
      function ligne(x, ton, meta) {
        return el('a', { class: 'cloche-ligne', href: x.h, onclick: function () { ferme(); if (x.id) M.marquerLu(x.id).then(cloche) } }, [
          el('span', { class: 'cloche-gravite ' + ton }),
          el('span', { class: 'cloche-texte' }, [el('span', { class: 'cloche-titre', text: x.t }), el('span', { class: 'cloche-meta', text: meta })])])
      }
      if (nv.length) {
        clp.appendChild(el('div', { class: 'cloche-tete' }, [el('b', { text: 'Nouveautés' }), el('button', { class: 'btn lien', type: 'button', text: 'Tout marquer lu', onclick: function () { M.toutLu().then(cloche) } })]))
        clp.appendChild(el('div', { class: 'cloche-liste' }, nv.slice(0, 5).map(function (x) { return ligne(x, 'info', 'Nouveau') })))
      }
      clp.appendChild(el('div', { class: 'cloche-tete' }, [el('b', { text: 'À traiter' }), el('span', { class: 'discret petit', text: l.length ? l.length + ' en attente' : 'Tout est à jour' })]))
      if (!l.length) { var v = el('div', { class: 'cloche-vide' }); v.appendChild(UI.icone('circle-check', 22)); v.appendChild(document.createTextNode('Rien d’urgent pour le moment.')); clp.appendChild(v) }
      else clp.appendChild(el('div', { class: 'cloche-liste' }, l.slice(0, 7).map(function (x) { return ligne(x, x.warn ? 'critique' : 'importante', x.warn ? 'En retard' : 'À faire') })))
      var pied = el('a', { class: 'cloche-pied', href: '#dashboard', text: 'Ouvrir le tableau de bord', onclick: ferme }); pied.appendChild(UI.icone('chevron-right', 15)); clp.appendChild(pied)
    })
  }
  cl.addEventListener('click', function () { clp.hidden = !clp.hidden; cl.setAttribute('aria-expanded', String(!clp.hidden)) })
  document.addEventListener('click', function (e) { if (!clp.hidden && !e.target.closest('.cloche-zone')) { clp.hidden = true; cl.setAttribute('aria-expanded', 'false') } })
  window.addEventListener('hashchange', function () { if (!document.getElementById('app').hidden) route() })

  // ---------- tableau de bord (modules.js) ----------
  function dashboard() { window.AdminModules.tableau() }

  // ---------- liste des devis ----------
  function tableDevis(l) {
    if (!l.length) return el('p', { class: 'empty', text: 'Aucun devis pour le moment.' })
    var tb = el('tbody')
    l.forEach(function (d) {
      var t = S.calc(d)
      tb.appendChild(el('tr', {}, [
        el('td', {}, [el('a', { href: '#devis/' + d.id, text: d.ref })]),
        el('td', { text: date(d.creeLe) }),
        el('td', { text: (d.client && (d.client.societe || d.client.nom)) || '—' }),
        el('td', {}, [badge(d.statut)]),
        el('td', { class: 'n', text: S.eur(t.uniqueHT) }),
        el('td', { class: 'n', text: t.mensuelHT ? S.eur(t.mensuelHT) + ' /mois' : '—' }),
      ]))
    })
    return el('div', { class: 'tw' }, [el('table', {}, [el('thead', {}, [el('tr', {}, ['Référence', 'Date', 'Client', 'Statut', 'Ponctuel HT', 'Mensuel HT'].map(function (x) { return el('th', { text: x }) }))]), tb])])
  }
  function liste() {
    main.appendChild(el('h1', { text: 'Devis' }))
    var q = el('input', { type: 'search', placeholder: 'Client, société, référence…' })
    var st = el('select', {}, [el('option', { value: '', text: 'Tous les statuts' })].concat(S.STATUTS.map(function (s) { return el('option', { value: s[0], text: s[1] }) })))
    var zone = el('div')
    main.appendChild(el('div', { class: 'bar' }, [field('Recherche', q), field('Statut', st),
      el('button', { class: 'btn', type: 'button', text: 'Nouveau devis', onclick: function () { S.saveDevis({ statut: 'nouveau', source: 'admin', remise: 0, client: { nom: '', email: '', tel: '', societe: '' }, notes: '', lignes: [] }).then(function (d) { go('devis/' + d.id) }) } })]))
    main.appendChild(zone)
    window.AdminModules.colonnes(function (side) { S.devisList().then(function (l) { window.AdminModules.repartDevis(side, l) }) })
    S.devisList().then(function (all) {
      function draw() {
        var s = q.value.toLowerCase()
        zone.textContent = ''
        zone.appendChild(tableDevis(all.filter(function (d) {
          var c = d.client || {}
          return (!st.value || d.statut === st.value) && (!s || [d.ref, c.nom, c.societe, c.email].join(' ').toLowerCase().indexOf(s) > -1)
        })))
      }
      q.addEventListener('input', draw); st.addEventListener('change', draw); draw()
    })
  }

  // ---------- fiche devis ----------
  function fiche(id) {
    Promise.all([S.devisList(), S.catalogue()]).then(function (r) {
      var d = r[0].filter(function (x) { return x.id === id })[0], cat = r[1]
      if (!d) { main.appendChild(el('p', { class: 'empty', text: 'Devis introuvable.' })); return }
      d.client = d.client || {}; d.lignes = d.lignes || []
      var msg = el('p', { class: 'msg noprint', role: 'status' }), totbox = el('div', { class: 'totbox' }), lb = el('tbody')
      var nom = el('input', { value: d.client.nom || '' }), soc = el('input', { value: d.client.societe || '' }), mail = el('input', { type: 'email', value: d.client.email || '' }), tel = el('input', { value: d.client.tel || '' })
      var stat = el('select', {}, S.STATUTS.map(function (s) { return el('option', { value: s[0], text: s[1], selected: s[0] === d.statut }) }))
      var rem = el('input', { type: 'number', min: '0', max: '100', step: '1', value: String(d.remise || 0) })
      var notes = el('textarea', { rows: '3' }); notes.value = d.notes || ''

      function totaux() {
        d.remise = +rem.value || 0
        var t = S.calc(d); totbox.textContent = ''
        function row(a, b, c) { totbox.appendChild(el('div', { class: c || '' }, [el('span', { text: a }), el('b', { text: b })])) }
        row('Total brut HT', S.eur(t.brutHT))
        if (t.remiseMontant) row('Remise ' + d.remise + ' %', '− ' + S.eur(t.remiseMontant))
        row('Ponctuel HT', S.eur(t.uniqueHT)); row(t.tauxTVA ? 'Ponctuel TTC (TVA ' + Math.round(t.tauxTVA * 100) + ' %)' : 'Ponctuel (TVA non applicable)', S.eur(t.uniqueTTC), 'big')
        if (t.optionsHT) row('Options proposées (non comptées)', S.eur(t.optionsHT))
        if (t.mensuelHT) { row('Mensuel HT', S.eur(t.mensuelHT)); row('Mensuel TTC', S.eur(t.mensuelTTC), 'big') }
      }
      function lignes() {
        lb.textContent = ''
        if (!d.lignes.length) lb.appendChild(el('tr', {}, [el('td', { colspan: '6', class: 'empty', text: 'Aucune ligne : ajoutez un service ci-dessous.' })]))
        d.lignes.forEach(function (l, i) {
          var q = el('input', { type: 'number', min: '0', step: '1', value: String(l.qty), 'aria-label': 'Quantité ' + l.nom, style: 'width:76px' })
          var p = el('input', { type: 'number', min: '0', step: '1', value: String(l.prix), 'aria-label': 'Prix ' + l.nom, style: 'width:100px' })
          q.addEventListener('input', function () { l.qty = +q.value || 0; tot.textContent = S.eur(l.qty * l.prix); totaux() })
          p.addEventListener('input', function () { l.prix = +p.value || 0; tot.textContent = S.eur(l.qty * l.prix); totaux() })
          var tot = el('td', { class: 'n', text: S.eur(l.qty * l.prix) })
          lb.appendChild(el('tr', {}, [el('td', {}, [el('b', { text: l.nom }), l.desc ? el('div', { class: 'mut', text: l.desc, style: 'font-size:.85rem' }) : null]), el('td', {}, [q]), el('td', {}, [p]), el('td', { text: l.rec ? 'par mois' : 'par ' + l.unite }), tot,
            el('td', { class: 'noprint' }, [el('button', { class: 'lnk danger', type: 'button', 'aria-label': 'Retirer ' + l.nom, text: 'Retirer', onclick: function () { d.lignes.splice(i, 1); lignes(); totaux() } })])]))
        })
      }
      var all = []; cat.forEach(function (c) { c.items.forEach(function (it) { all.push(it) }) })
      var pick = el('select', {}, [el('option', { value: '', text: 'Ajouter un service du catalogue…' })].concat(cat.map(function (c) { return el('optgroup', { label: c.nom }, c.items.map(function (it) { return el('option', { value: it.id, text: it.nom + ' — ' + S.eur(it.prix) }) })) })))
      pick.addEventListener('change', function () {
        var it = all.filter(function (x) { return x.id === pick.value })[0]
        if (it) { d.lignes.push(S.ligne(it, 1)); lignes(); totaux() }
        pick.value = ''
      })
      function save() {
        d.client = { nom: nom.value, societe: soc.value, email: mail.value, tel: tel.value }
        d.statut = stat.value; d.notes = notes.value; d.remise = +rem.value || 0
        return S.saveDevis(d).then(function () { msg.textContent = 'Enregistré.' })
      }

      main.appendChild(el('p', { class: 'noprint' }, [el('a', { href: '#devis', text: '← Tous les devis' })]))
      main.appendChild(el('h1', { text: 'Devis ' + d.ref }))
      main.appendChild(el('div', { class: 'panel' }, [el('div', { class: 'grid2' }, [field('Nom du contact', nom), field('Société', soc), field('E-mail', mail), field('Téléphone', tel), field('Statut', stat), field('Remise globale (%)', rem)]), field('Notes / précisions du client', notes),
        el('p', { class: 'mut', text: 'Créé le ' + date(d.creeLe) + (d.source === 'site' ? ' · demande reçue depuis le site' : ' · créé dans l’admin') })]))
      main.appendChild(el('div', { class: 'tw' }, [el('table', {}, [el('thead', {}, [el('tr', {}, ['Service', 'Qté', 'Prix unitaire HT', 'Unité', 'Total HT', ''].map(function (x) { return el('th', { text: x }) }))]), lb])]))
      main.appendChild(el('div', { class: 'bar noprint', style: 'margin-top:14px' }, [field('Ajouter', pick),
        el('button', { class: 'btn ghost', type: 'button', text: 'Ligne libre', onclick: function () { d.lignes.push({ itemId: 'libre', nom: 'Prestation personnalisée', desc: '', prix: 0, unite: 'forfait', rec: false, qty: 1 }); lignes(); totaux() } })]))
      main.appendChild(el('div', { class: 'panel' }, [totbox, el('p', { class: 'mut', text: 'Montants hors budget publicitaire. Devis valable 30 jours.', style: 'margin-top:10px' })]))
      main.appendChild(el('div', { class: 'cta noprint' }, [
        el('button', { class: 'btn', type: 'button', text: 'Enregistrer', onclick: save }),
        el('button', { class: 'btn ghost', type: 'button', text: 'Imprimer / PDF', onclick: function () { save().then(function () { window.print() }) } }),
        mail.value ? el('a', { class: 'btn ghost', href: '#', text: 'Écrire au client', onclick: function (e) { e.preventDefault(); location.href = 'mailto:' + encodeURIComponent(mail.value) + '?subject=' + encodeURIComponent('Votre devis ' + d.ref) } }) : null,
        el('button', { class: 'btn ghost', type: 'button', text: 'Supprimer', onclick: function () { if (confirm('Supprimer définitivement le devis ' + d.ref + ' ?')) S.deleteDevis(d.id).then(function () { go('devis') }) } }),
      ]))
      main.appendChild(msg)
      lignes(); totaux()
      // conditions, options, partage avec le client, acceptation, contrat, PDF (admin/finances.js)
      if (window.AdminModules.devisExtra) window.AdminModules.devisExtra(d, main, save, { statut: function (v) { stat.value = v }, totaux: function () { lignes(); totaux() } })
    })
  }

  // ---------- catalogue ----------
  function catalogue() {
    S.catalogue().then(function (cat) {
      var msg = el('p', { class: 'msg', role: 'status' })
      main.appendChild(el('h1', { text: 'Catalogue & tarifs' }))
      main.appendChild(el('p', { class: 'lead', text: 'Tous les services mis en vente. Les prix sont en € HT. Modifier un tarif n’altère pas les devis déjà créés (chaque devis garde son prix).' }))
      cat.forEach(function (c) {
        var tb = el('tbody')
        function rows() {
          tb.textContent = ''
          c.items.forEach(function (it, i) {
            function inp(k, type, w) { var x = el('input', { type: type || 'text', value: String(it[k] == null ? '' : it[k]), 'aria-label': k + ' ' + it.nom, style: w ? 'width:' + w : '' }); x.addEventListener('input', function () { it[k] = type === 'number' ? (+x.value || 0) : x.value }); return x }
            var rec = el('input', { type: 'checkbox', 'aria-label': 'Mensuel : ' + it.nom, checked: !!it.rec, style: 'width:auto;min-height:0' })
            rec.addEventListener('change', function () { it.rec = rec.checked })
            tb.appendChild(el('tr', {}, [el('td', {}, [inp('nom')]), el('td', {}, [inp('desc')]), el('td', {}, [inp('prix', 'number', '100px')]), el('td', {}, [inp('unite', 'text', '90px')]), el('td', {}, [rec]),
              el('td', {}, [el('button', { class: 'lnk danger', type: 'button', text: 'Supprimer', 'aria-label': 'Supprimer ' + it.nom, onclick: function () { c.items.splice(i, 1); rows() } })])]))
          })
        }
        rows()
        main.appendChild(el('h2', { text: c.nom }))
        main.appendChild(el('div', { class: 'tw' }, [el('table', {}, [el('thead', {}, [el('tr', {}, ['Service', 'Description', 'Prix HT', 'Unité', 'Mensuel', ''].map(function (x) { return el('th', { text: x }) }))]), tb])]))
        main.appendChild(el('button', { class: 'lnk', type: 'button', text: '+ Ajouter un service à « ' + c.nom + ' »', onclick: function () { c.items.push({ id: 'x' + Date.now().toString(36), nom: 'Nouveau service', desc: '', prix: 0, unite: 'forfait', rec: false }); rows() } }))
      })
      main.appendChild(el('div', { class: 'cta' }, [
        el('button', { class: 'btn', type: 'button', text: 'Enregistrer le catalogue', onclick: function () { S.saveCatalogue(cat).then(function () { msg.textContent = 'Catalogue enregistré : la page /devis/ utilise ces tarifs.' }) } }),
        el('button', { class: 'btn ghost', type: 'button', text: 'Rétablir les tarifs de départ', onclick: function () { if (confirm('Remplacer tout le catalogue par les tarifs de départ ?')) S.saveCatalogue(S.defaultCatalogue()).then(route) } })]))
      main.appendChild(msg)
    })
  }

  // ---------- données ----------
  function donnees() {
    main.appendChild(el('h1', { text: 'Données' }))
    var msg = el('p', { class: 'msg', role: 'status' })
    var enligne = BASE && S.auth.session()
    main.appendChild(el('p', { class: 'lead', text: enligne ? 'Les données sont dans la base de l’agence (partagées entre les comptes). Exportez-les régulièrement pour avoir une sauvegarde. Un import remplace les listes actuelles : les anciennes vont à la corbeille (restaurables).' : 'Pour l’instant, les données vivent dans ce navigateur. Exportez-les pour les sauvegarder ou les importer dans la base de données plus tard.' }))
    if (enligne) main.appendChild(el('div', { class: 'panel', style: 'margin-bottom:18px' }, [el('p', { class: 'mut', text: 'Des clients, devis ou factures ont été saisis dans ce navigateur avant la connexion à la base ? Envoyez-les dans la base (rien n’est supprimé, les éléments déjà présents sont mis à jour).' }), el('button', { class: 'btn ghost', type: 'button', text: 'Envoyer les données de ce navigateur vers la base', onclick: function () { msg.textContent = 'Envoi en cours…'; S.sendLocal().then(function (n) { msg.textContent = n + ' élément(s) envoyé(s) dans la base.' }, function (er) { msg.textContent = 'Envoi impossible : ' + er.message }) } })]))
    var file = el('input', { type: 'file', accept: 'application/json', 'aria-label': 'Fichier à importer' })
    file.addEventListener('change', function () {
      var f = file.files[0]; if (!f) return
      f.text().then(function (t) {
        var o; try { o = JSON.parse(t) } catch (e) { msg.textContent = 'Fichier illisible.'; return }
        if (!Array.isArray(o.devis) && !Array.isArray(o.catalogue)) { msg.textContent = 'Format inattendu.'; return }
        if (confirm('Importer ces données ? Elles remplacent celles ' + (enligne ? 'de la base.' : 'de ce navigateur.'))) S.replaceAll(o).then(function () { msg.textContent = 'Import terminé.' })
      })
    })
    main.appendChild(el('div', { class: 'cta' }, [el('button', { class: 'btn', type: 'button', text: 'Exporter (JSON)', onclick: function () {
      Promise.resolve(S.exportAll()).then(function (o) {
        if (S.rpc && S.sb && S.sb.on()) S.rpc('log_event', { kind: 'export' }).catch(function () {})
        var a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(o, null, 2)], { type: 'application/json' })), download: 'creatigo-' + new Date().toISOString().slice(0, 10) + '.json' })
        a.click()
      })
    } })]))
    main.appendChild(el('div', { class: 'panel', style: 'margin-top:18px' }, [field('Importer un export JSON', file)]))
    main.appendChild(msg)
  }

  if (BASE && S.auth.session()) S.auth.isAdmin().then(function (ok) { if (ok) showApp(true); else S.auth.signOut().then(function () { showApp(false) }) })
  else showApp(BASE ? false : sessionStorage.getItem('creatigo.admin') === '1')
})()
