/* Modules de l'administration : clients (CRM), rendez-vous, factures, projets, site & messages.
   Chargé avant admin.js ; admin.js expose window.AdminKit (outils communs) et appelle ces vues par le routeur.
   Tout texte saisi passe par textContent / value (jamais innerHTML).
   shortcut: les demandes du site (rendez-vous, contact) arrivent dans Netlify Forms, pas dans ce navigateur : on les importe par CSV (Site & messages) — à remplacer par la base. */
(function () {
  function K() { return window.AdminKit }
  var today = function () { return new Date().toISOString().slice(0, 10) }
  var plus = function (j) { var d = new Date(); d.setDate(d.getDate() + j); return d.toISOString().slice(0, 10) }
  var fr = function (iso) { return iso ? new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('fr-FR') : '—' }
  var CLIENT_ST = [['prospect', 'Prospect'], ['actif', 'Client actif'], ['inactif', 'Inactif']]
  var RDV_ST = [['avenir', 'À venir'], ['fait', 'Réalisé'], ['annule', 'Annulé']]
  var FAC_ST = [['brouillon', 'Brouillon'], ['envoyee', 'Envoyée'], ['payee', 'Payée'], ['retard', 'En retard']]
  var PRJ_ST = [['afaire', 'À faire'], ['encours', 'En cours'], ['relecture', 'En relecture'], ['livre', 'Livré']]
  var BLOG_ST = [['idee', 'Idée'], ['redaction', 'Rédaction'], ['relecture', 'Relecture'], ['publie', 'Publié']]
  var lab = function (t, v) { var r = t.filter(function (x) { return x[0] === v })[0]; return r ? r[1] : v || '—' }

  function ttc(f) { var t = window.AdminKit.S.calc(f); return (t.uniqueHT + t.mensuelHT) * (1 + window.AdminKit.S.TVA) }
  function pill(t, v) { return K().el('span', { class: 'badge b-' + v, text: lab(t, v) }) }
  function tbl(heads, rows, vide) {
    var e = K().el
    if (!rows.length) return e('p', { class: 'empty', text: vide || 'Rien pour le moment.' })
    return e('div', { class: 'tw' }, [e('table', {}, [e('thead', {}, [e('tr', {}, heads.map(function (h) { return e('th', { text: h }) }))]), e('tbody', {}, rows)])])
  }
  function td(x, c) { return K().el('td', { class: c || '' }, [typeof x === 'string' ? document.createTextNode(x) : x]) }
  function lien(h, t) { return K().el('a', { href: h, text: t }) }
  function btn(t, f, c) { return K().el('button', { class: c || 'btn', type: 'button', text: t, onclick: f }) }
  function opts(list, sel, tout) { return (tout ? [K().el('option', { value: '', text: tout })] : []).concat(list.map(function (s) { return K().el('option', { value: s[0], text: s[1], selected: s[0] === sel }) })) }
  function nomClient(c) { return c ? (c.societe ? c.societe + (c.nom ? ' · ' + c.nom : '') : c.nom) || 'Sans nom' : '—' }
  function byId(l, id) { return l.filter(function (x) { return x.id === id })[0] }

  /* ---------- fiche générique : une liste de champs, Enregistrer / Supprimer ---------- */
  function fiche(coll, id, titre, champs, retour, extra) {
    var e = K().el, S = K().S, main = K().main
    Promise.all([S.list(coll), S.list('clients')]).then(function (r) {
      var o = id === 'new' ? { id: '' } : byId(r[0], id)
      if (!o) { main.appendChild(e('p', { class: 'empty', text: 'Fiche introuvable.' })); return }
      var ins = {}, msg = e('p', { class: 'msg', role: 'status' })
      var cl = r[1].map(function (c) { return [c.id, nomClient(c)] })
      main.appendChild(e('p', {}, [lien('#' + retour, '← Retour')]))
      main.appendChild(e('h1', { text: id === 'new' ? 'Nouveau — ' + titre : titre }))
      var grille = e('div', { class: 'grid2' })
      champs.forEach(function (c) {
        var i
        if (c.t === 'area') { i = e('textarea', { rows: c.rows || '4' }); i.value = o[c.k] || '' }
        else if (c.t === 'select') i = e('select', {}, opts(c.o, o[c.k] || c.d))
        else if (c.t === 'client') i = e('select', {}, opts(cl, o[c.k], '— Aucun —'))
        else i = e('input', { type: c.t || 'text', value: o[c.k] == null ? (c.d || '') : String(o[c.k]) })
        ins[c.k] = i
        var f = K().field(c.l, i); if (c.t === 'area') f.style.gridColumn = '1/-1'
        grille.appendChild(f)
      })
      main.appendChild(e('div', { class: 'panel' }, [grille]))
      if (extra) extra(o, main)
      function enregistre() {
        champs.forEach(function (c) { o[c.k] = c.t === 'number' ? +ins[c.k].value || 0 : ins[c.k].value })
        return S.put(coll, o)
      }
      main.appendChild(e('div', { class: 'cta' }, [
        btn('Enregistrer', function () { enregistre().then(function () { K().go(retour) }) }),
        id === 'new' ? null : btn('Supprimer', function () { if (confirm('Supprimer définitivement cette fiche ?')) S.del(coll, o.id).then(function () { K().go(retour) }) }, 'btn ghost')]))
      main.appendChild(msg)
    })
  }


  /* ---------- mise en page à deux colonnes : contenu à gauche, colonne de repères à droite ---------- */
  function colonnes(remplit) {
    var e = K().el, main = K().main, h1 = main.querySelector('h1')
    var cols = e('div', { class: 'page' }), m = e('div', { class: 'page-main' }), s = e('aside', { class: 'page-side', 'aria-label': 'Repères' })
    ;[].slice.call(main.children).forEach(function (c) { if (c !== h1) m.appendChild(c) })
    cols.appendChild(m); cols.appendChild(s); main.appendChild(cols)
    remplit(s)
  }
  function carte2(titre, sous, corps, cls) {
    var e = K().el
    return e('section', { class: 'carte ' + (cls || '') }, [e('div', { class: 'carte-h' }, [e('h2', { text: titre }), sous ? e('small', { text: sous }) : null]), corps])
  }
  function puits(n) { return K().el('div', { class: 'puits' }, [n]) }
  function comptes(liste, table, cle, couleurs) {
    return table.map(function (t) { return { l: t[1], n: liste.filter(function (x) { return (x[cle] || table[0][0]) === t[0] }).length, c: couleurs[t[0]] || C.gris } })
  }
  function repart(s, titre, sous, rows) { s.appendChild(carte2(titre, sous, puits(lignes(rows)))) }
  // calendrier du mois : les jours avec rendez-vous sont marqués
  function calendrier(rd) {
    var e = K().el, d = new Date(), an = d.getFullYear(), mo = d.getMonth(), t = today()
    var dec = (new Date(an, mo, 1).getDay() + 6) % 7, nb = new Date(an, mo + 1, 0).getDate(), g = e('div', { class: 'cal' })
    ;['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(function (j) { g.appendChild(e('span', { class: 'cal-j', text: j })) })
    for (var i = 0; i < dec; i++) g.appendChild(e('span'))
    for (var j = 1; j <= nb; j++) {
      var iso = an + '-' + ('0' + (mo + 1)).slice(-2) + '-' + ('0' + j).slice(-2)
      var r = rd.filter(function (x) { return x.date === iso && x.statut !== 'annule' })
      var c = r.length ? e('a', { class: 'cal-d rdv' + (iso === t ? ' auj' : ''), href: '#rdv/' + r[0].id, text: String(j), 'data-bulle': r.length + ' rendez-vous' }) : e('span', { class: 'cal-d' + (iso === t ? ' auj' : ''), text: String(j) })
      g.appendChild(c)
    }
    return carte2(d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), 'les jours en bleu ont un rendez-vous', puits(g))
  }

  /* ---------- clients ---------- */
  var F_CLIENT = [{ k: 'nom', l: 'Nom du contact' }, { k: 'societe', l: 'Société' }, { k: 'email', l: 'E-mail', t: 'email' }, { k: 'tel', l: 'Téléphone' },
    { k: 'adresse', l: 'Adresse' }, { k: 'statut', l: 'Statut', t: 'select', o: CLIENT_ST, d: 'prospect' }, { k: 'rappel', l: 'Rappel (relancer le…)', t: 'date' },
    { k: 'notes', l: 'Notes (échanges, besoins, préférences)', t: 'area', rows: 6 }]

  function clients(id) {
    var e = K().el, S = K().S, main = K().main
    if (id) return fiche('clients', id, 'Fiche client', F_CLIENT, 'clients', function (c, box) {
      if (!c.id) return
      Promise.all([S.devisList(), S.list('rdv'), S.list('factures'), S.list('projets')]).then(function (r) {
        var mail = (c.email || '').toLowerCase()
        var dv = r[0].filter(function (d) { return mail && ((d.client || {}).email || '').toLowerCase() === mail })
        function bloc(t, rows, nouveau) { box.appendChild(e('h2', { text: t })); box.appendChild(rows.length ? e('ul', { class: 'liste' }, rows) : e('p', { class: 'mut', text: 'Aucun.' })); if (nouveau) box.appendChild(nouveau) }
        bloc('Devis', dv.map(function (d) { return e('li', {}, [lien('#devis/' + d.id, d.ref), ' · ' + lab(S.STATUTS, d.statut) + ' · ' + S.eur(S.calc(d).uniqueHT) + ' HT']) }))
        bloc('Rendez-vous', r[1].filter(function (x) { return x.clientId === c.id }).map(function (x) { return e('li', {}, [lien('#rdv/' + x.id, fr(x.date) + ' ' + (x.heure || '')), ' · ' + (x.objet || '') + ' · ' + lab(RDV_ST, x.statut)]) }),
          btn('+ Rendez-vous', function () { S.put('rdv', { clientId: c.id, date: today(), heure: '10:00', statut: 'avenir', objet: '' }).then(function (x) { K().go('rdv/' + x.id) }) }, 'lnk'))
        bloc('Factures', r[2].filter(function (x) { return x.clientId === c.id }).map(function (x) { return e('li', {}, [lien('#factures/' + x.id, x.ref), ' · ' + lab(FAC_ST, x.statut) + ' · ' + S.eur(ttc(x)) + ' TTC']) }))
        bloc('Projets', r[3].filter(function (x) { return x.clientId === c.id }).map(function (x) { return e('li', {}, [lien('#projets/' + x.id, x.titre), ' · ' + lab(PRJ_ST, x.statut)]) }),
          btn('+ Projet', function () { S.put('projets', { clientId: c.id, titre: 'Nouveau projet', statut: 'afaire', taches: [] }).then(function (x) { K().go('projets/' + x.id) }) }, 'lnk'))
        if (S.sb && S.sb.on() && window.AdminModules.portalBloc) window.AdminModules.portalBloc(c, box)
      })
    })
    main.appendChild(e('h1', { text: 'Clients' }))
    var q = e('input', { type: 'search', placeholder: 'Nom, société, e-mail…' })
    var st = e('select', {}, opts(CLIENT_ST, '', 'Tous les statuts'))
    var zone = e('div'), msg = e('p', { class: 'msg', role: 'status' })
    main.appendChild(e('div', { class: 'bar' }, [K().field('Recherche', q), K().field('Statut', st),
      btn('Nouveau client', function () { K().go('clients/new') }),
      btn('Importer depuis les devis', function () {
        Promise.all([S.list('clients'), S.devisList()]).then(function (r) {
          var n = 0, vus = r[0].map(function (c) { return (c.email || c.nom || '').toLowerCase() })
          function suite(i) {
            if (i >= r[1].length) { msg.textContent = n + ' client(s) créé(s).'; return K().route() }
            var d = r[1][i], c = d.client || {}, k = (c.email || c.nom || '').toLowerCase()
            if (!k || vus.indexOf(k) > -1) return suite(i + 1)
            vus.push(k); n++
            S.put('clients', { nom: c.nom || '', societe: c.societe || '', email: c.email || '', tel: c.tel || '', statut: d.statut === 'accepte' ? 'actif' : 'prospect', notes: '', adresse: '' }).then(function () { suite(i + 1) })
          }
          suite(0)
        })
      }, 'btn ghost')]))
    main.appendChild(zone); main.appendChild(msg)
    colonnes(function (side) {
      S.list('clients').then(function (l) {
        repart(side, 'Par statut', 'où en sont vos contacts', comptes(l, CLIENT_ST, 'statut', COUL))
        var due = l.filter(function (c) { return c.rappel && c.rappel <= today() })
        side.appendChild(carte2('À relancer', due.length ? due.length + ' contact(s)' : 'personne pour le moment', due.length ? e('ul', { class: 'liste' }, due.slice(0, 6).map(function (c) { return e('li', {}, [lien('#clients/' + c.id, nomClient(c)), ' · ' + fr(c.rappel)]) })) : e('p', { class: 'mut', text: 'Fixez une date de rappel dans une fiche client : elle apparaîtra ici.' })))
      })
    })
    Promise.all([S.list('clients'), S.devisList()]).then(function (r) {
      function draw() {
        var s = q.value.toLowerCase(); zone.textContent = ''
        var rows = r[0].filter(function (c) { return (!st.value || c.statut === st.value) && (!s || [c.nom, c.societe, c.email].join(' ').toLowerCase().indexOf(s) > -1) }).map(function (c) {
          var mail = (c.email || '').toLowerCase(), ca = 0
          r[1].forEach(function (d) { if (mail && ((d.client || {}).email || '').toLowerCase() === mail && d.statut === 'accepte') ca += S.calc(d).uniqueHT })
          var due = c.rappel && c.rappel <= today()
          return e('tr', {}, [td(lien('#clients/' + c.id, nomClient(c))), td(c.email || '—'), td(c.tel || '—'), td(pill(CLIENT_ST, c.statut || 'prospect')), td(c.rappel ? (due ? '⚠ ' : '') + fr(c.rappel) : '—'), td(S.eur(ca), 'n')])
        })
        zone.appendChild(tbl(['Client', 'E-mail', 'Téléphone', 'Statut', 'Rappel', 'CA accepté HT'], rows, 'Aucun client : créez-en un ou importez-les depuis vos devis.'))
      }
      q.addEventListener('input', draw); st.addEventListener('change', draw); draw()
    })
  }

  /* ---------- rendez-vous ---------- */
  function rdv(id) {
    var e = K().el, S = K().S, main = K().main
    if (id) return fiche('rdv', id, 'Rendez-vous', [{ k: 'date', l: 'Date', t: 'date', d: today() }, { k: 'heure', l: 'Heure', t: 'time', d: '10:00' }, { k: 'clientId', l: 'Client', t: 'client' },
      { k: 'nom', l: 'Ou nom (si pas encore client)' }, { k: 'objet', l: 'Objet (site, SEO, appli…)' }, { k: 'lieu', l: 'Lieu ou lien visio' }, { k: 'statut', l: 'Statut', t: 'select', o: RDV_ST, d: 'avenir' },
      { k: 'notes', l: 'Notes / compte rendu', t: 'area' }], 'rdv')
    main.appendChild(e('h1', { text: 'Rendez-vous' }))
    var st = e('select', {}, opts(RDV_ST, 'avenir', 'Tous'))
    var zone = e('div')
    main.appendChild(e('div', { class: 'bar' }, [K().field('Afficher', st), btn('Nouveau rendez-vous', function () { K().go('rdv/new') })]))
    main.appendChild(e('p', { class: 'mut', text: 'Les rendez-vous pris sur le site arrivent dans Netlify : importez-les depuis « Site & messages », ou ajoutez-les ici.' }))
    main.appendChild(zone)
    colonnes(function (side) {
      S.list('rdv').then(function (l) {
        side.appendChild(calendrier(l))
        repart(side, 'Par statut', 'tous vos rendez-vous', comptes(l, RDV_ST, 'statut', COUL))
      })
    })
    Promise.all([S.list('rdv'), S.list('clients')]).then(function (r) {
      function draw() {
        zone.textContent = ''
        var l = r[0].filter(function (x) { return !st.value || x.statut === st.value }).sort(function (a, b) { return (a.date + (a.heure || '')) < (b.date + (b.heure || '')) ? -1 : 1 })
        zone.appendChild(tbl(['Date', 'Heure', 'Avec', 'Objet', 'Statut', ''], l.map(function (x) {
          var c = byId(r[1], x.clientId)
          return e('tr', {}, [td(lien('#rdv/' + x.id, fr(x.date))), td(x.heure || '—'), td(c ? nomClient(c) : x.nom || '—'), td(x.objet || '—'), td(pill(RDV_ST, x.statut || 'avenir')),
            td(x.statut === 'avenir' ? btn('Marquer réalisé', function () { x.statut = 'fait'; S.put('rdv', x).then(draw) }, 'lnk') : '')])
        }), 'Aucun rendez-vous.'))
      }
      st.addEventListener('change', draw); draw()
    })
  }

  /* ---------- factures ---------- */
  function factures(id) {
    var e = K().el, S = K().S, main = K().main
    if (id) return factureFiche(id)
    main.appendChild(e('h1', { text: 'Factures' }))
    var zone = e('div')
    Promise.all([S.list('factures'), S.list('clients'), S.devisList()]).then(function (r) {
      var acc = r[2].filter(function (d) { return d.statut === 'accepte' })
      var pick = e('select', {}, [e('option', { value: '', text: 'Créer depuis un devis accepté…' })].concat(acc.map(function (d) { return e('option', { value: d.id, text: d.ref + ' · ' + ((d.client || {}).societe || (d.client || {}).nom || '') }) })))
      pick.addEventListener('change', function () {
        var d = byId(acc, pick.value); if (!d) return
        var c = d.client || {}, mail = (c.email || '').toLowerCase()
        var cli = r[1].filter(function (x) { return mail && (x.email || '').toLowerCase() === mail })[0]
        S.put('factures', { ref: S.nextRef('FAC', r[0]), statut: 'brouillon', date: today(), echeance: plus(30), client: JSON.parse(JSON.stringify(c)), clientId: cli ? cli.id : '', lignes: JSON.parse(JSON.stringify(d.lignes || [])), remise: d.remise || 0, devisRef: d.ref, notes: '' }).then(function (f) { K().go('factures/' + f.id) })
      })
      main.appendChild(e('div', { class: 'bar' }, [K().field('Nouvelle facture', pick),
        btn('Facture vide', function () { S.put('factures', { ref: S.nextRef('FAC', r[0]), statut: 'brouillon', date: today(), echeance: plus(30), client: { nom: '', societe: '', email: '', tel: '' }, lignes: [], remise: 0, notes: '' }).then(function (f) { K().go('factures/' + f.id) }) }, 'btn ghost')]))
      var du = 0
      r[0].forEach(function (f) { if (f.statut === 'envoyee' || f.statut === 'retard') du += ttc(f) })
      main.appendChild(zone)
      colonnes(function (side) {
        repart(side, 'Par statut', 'état de vos factures', comptes(r[0], FAC_ST, 'statut', COUL))
        var tot = r[0].filter(function (f) { return f.statut === 'payee' }).reduce(function (a, f) { return a + ttc(f) }, 0)
        side.appendChild(carte2('Encaissé', 'factures payées, TTC', e('b', { class: 'gros', text: S.eur(tot) })))
        // ancienneté des sommes dues : ce qui n'est pas encore échu, puis le retard par tranche
        var tr = [['Pas encore échues', 'var(--serie-1)', 0], ['Retard de 1 à 30 j', 'var(--attention)', 0], ['Retard de 31 à 60 j', 'var(--serie-2)', 0], ['Retard de plus de 60 j', 'var(--critique)', 0]], tj = Date.now()
        r[0].forEach(function (f) {
          if (f.statut !== 'envoyee' && f.statut !== 'retard') return
          var j = f.echeance ? Math.floor((tj - new Date(f.echeance + 'T12:00:00').getTime()) / 864e5) : 0
          tr[j <= 0 ? 0 : j <= 30 ? 1 : j <= 60 ? 2 : 3][2] += ttc(f)
        })
        side.appendChild(window.UI.carte('Sommes dues', 'TTC, selon le retard', tr.some(function (x) { return x[2] }) ? window.UI.h('div', { style: 'display:grid;gap:14px' },
          window.UI.G.progression(tr.map(function (x) { return { valeur: Math.round(x[2]), couleur: x[1], libelle: x[0] } }), { description: 'Sommes dues par ancienneté' }),
          window.UI.h('div', { class: 'cles' }, tr.map(function (x) { return window.UI.h('div', {}, window.UI.h('span', { style: 'display:inline-flex;align-items:center;gap:8px' }, window.UI.h('i', { style: 'width:9px;height:9px;border-radius:50%;display:inline-block;background:' + x[1] }), x[0]), window.UI.h('b', {}, S.eur(x[2]))) }))) : window.UI.etatVide('Rien à encaisser.', 'circle-check')))
      })
      zone.appendChild(tbl(['N°', 'Date', 'Client', 'Échéance', 'Statut', 'Total TTC'], r[0].map(function (f) {
        var late = f.statut === 'envoyee' && f.echeance && f.echeance < today()
        return e('tr', {}, [td(lien('#factures/' + f.id, f.ref)), td(fr(f.date)), td(nomClient(f.client)), td(fr(f.echeance)), td(pill(FAC_ST, late ? 'retard' : f.statut)), td(S.eur(ttc(f)), 'n')])
      }), 'Aucune facture. Créez-en une depuis un devis accepté.'))
    })
  }
  function factureFiche(id) {
    var e = K().el, S = K().S, main = K().main
    Promise.all([S.list('factures'), S.catalogue()]).then(function (r) {
      var f = byId(r[0], id), cat = r[1]
      if (!f) { main.appendChild(e('p', { class: 'empty', text: 'Facture introuvable.' })); return }
      f.client = f.client || {}; f.lignes = f.lignes || []
      var msg = e('p', { class: 'msg noprint', role: 'status' }), tot = e('div', { class: 'totbox' }), lb = e('tbody')
      var nom = e('input', { value: f.client.nom || '' }), soc = e('input', { value: f.client.societe || '' }), mail = e('input', { type: 'email', value: f.client.email || '' })
      var adr = e('input', { value: f.client.adresse || '' }), dt = e('input', { type: 'date', value: f.date || today() }), ech = e('input', { type: 'date', value: f.echeance || plus(30) })
      var stat = e('select', {}, opts(FAC_ST, f.statut)), rem = e('input', { type: 'number', min: '0', max: '100', value: String(f.remise || 0) })
      var notes = e('textarea', { rows: '3' }); notes.value = f.notes || ''
      function totaux() {
        f.remise = +rem.value || 0; var t = S.calc(f); tot.textContent = ''
        function row(a, b, c) { tot.appendChild(e('div', { class: c || '' }, [e('span', { text: a }), e('b', { text: b })])) }
        row('Total HT', S.eur(t.uniqueHT + t.mensuelHT)); row('TVA ' + Math.round(S.TVA * 100) + ' %', S.eur((t.uniqueHT + t.mensuelHT) * S.TVA)); row('Total TTC', S.eur((t.uniqueHT + t.mensuelHT) * (1 + S.TVA)), 'big')
      }
      function lignes() {
        lb.textContent = ''
        f.lignes.forEach(function (l, i) {
          var q = e('input', { type: 'number', min: '0', value: String(l.qty), 'aria-label': 'Quantité', style: 'width:76px' }), p = e('input', { type: 'number', min: '0', value: String(l.prix), 'aria-label': 'Prix unitaire', style: 'width:100px' })
          var nm = e('input', { value: l.nom, 'aria-label': 'Désignation' }), st = e('td', { class: 'n', text: S.eur(l.qty * l.prix) })
          nm.addEventListener('input', function () { l.nom = nm.value })
          q.addEventListener('input', function () { l.qty = +q.value || 0; st.textContent = S.eur(l.qty * l.prix); totaux() })
          p.addEventListener('input', function () { l.prix = +p.value || 0; st.textContent = S.eur(l.qty * l.prix); totaux() })
          lb.appendChild(e('tr', {}, [td(nm), td(q), td(p), st, e('td', { class: 'noprint' }, [btn('Retirer', function () { f.lignes.splice(i, 1); lignes(); totaux() }, 'lnk danger')])]))
        })
        if (!f.lignes.length) lb.appendChild(e('tr', {}, [e('td', { colspan: '5', class: 'empty', text: 'Aucune ligne.' })]))
      }
      var all = []; cat.forEach(function (c) { c.items.forEach(function (it) { all.push(it) }) })
      var pick = e('select', {}, [e('option', { value: '', text: 'Ajouter un service du catalogue…' })].concat(cat.map(function (c) { return e('optgroup', { label: c.nom }, c.items.map(function (it) { return e('option', { value: it.id, text: it.nom }) })) })))
      pick.addEventListener('change', function () { var it = all.filter(function (x) { return x.id === pick.value })[0]; if (it) { f.lignes.push(S.ligne(it, 1)); lignes(); totaux() } pick.value = '' })
      function save() {
        f.client = { nom: nom.value, societe: soc.value, email: mail.value, adresse: adr.value, tel: f.client.tel || '' }
        f.date = dt.value; f.echeance = ech.value; f.statut = stat.value; f.notes = notes.value; f.remise = +rem.value || 0
        return S.put('factures', f).then(function () { msg.textContent = 'Enregistré.' })
      }
      main.appendChild(e('p', { class: 'noprint' }, [lien('#factures', '← Toutes les factures')]))
      main.appendChild(e('h1', { text: 'Facture ' + f.ref }))
      main.appendChild(e('div', { class: 'panel' }, [e('div', { class: 'grid2' }, [K().field('Contact', nom), K().field('Société', soc), K().field('E-mail', mail), K().field('Adresse de facturation', adr),
        K().field('Date d’émission', dt), K().field('Échéance de paiement', ech), K().field('Statut', stat), K().field('Remise (%)', rem)]), K().field('Notes / coordonnées de paiement (IBAN…)', notes),
        f.devisRef ? e('p', { class: 'mut', text: 'Établie depuis le devis ' + f.devisRef }) : null]))
      main.appendChild(e('div', { class: 'tw' }, [e('table', {}, [e('thead', {}, [e('tr', {}, ['Désignation', 'Qté', 'Prix unitaire HT', 'Total HT', ''].map(function (x) { return e('th', { text: x }) }))]), lb])]))
      main.appendChild(e('div', { class: 'bar noprint', style: 'margin-top:14px' }, [K().field('Ajouter', pick), btn('Ligne libre', function () { f.lignes.push({ itemId: 'libre', nom: 'Prestation', desc: '', prix: 0, unite: 'forfait', rec: false, qty: 1 }); lignes(); totaux() }, 'btn ghost')]))
      main.appendChild(e('div', { class: 'panel' }, [tot, e('p', { class: 'mut', text: 'Pénalités de retard et indemnité de recouvrement de 40 € applicables selon la loi. Vérifiez les mentions obligatoires (SIRET, TVA) avant envoi.', style: 'margin-top:10px' })]))
      main.appendChild(e('div', { class: 'cta noprint' }, [btn('Enregistrer', save), btn('Imprimer / PDF', function () { save().then(function () { window.print() }) }, 'btn ghost'),
        btn('Marquer payée', function () { stat.value = 'payee'; save() }, 'btn ghost'),
        btn('Supprimer', function () { if (confirm('Supprimer la facture ' + f.ref + ' ?')) S.del('factures', f.id).then(function () { K().go('factures') }) }, 'btn ghost')]))
      main.appendChild(msg); lignes(); totaux()
    })
  }

  /* ---------- projets : tableau en colonnes ---------- */
  function projets(id) {
    var e = K().el, S = K().S, main = K().main
    if (id) return fiche('projets', id, 'Projet', [{ k: 'titre', l: 'Titre du projet' }, { k: 'clientId', l: 'Client', t: 'client' }, { k: 'statut', l: 'Étape', t: 'select', o: PRJ_ST, d: 'afaire' },
      { k: 'debut', l: 'Début', t: 'date' }, { k: 'echeance', l: 'Échéance', t: 'date' }, { k: 'visibleClient', l: 'Espace client', t: 'select', o: [['oui', 'Visible : le client suit ce projet'], ['non', 'Interne : le client ne le voit pas']], d: 'oui' }, { k: 'budget', l: 'Budget HT (€)', t: 'number' }, { k: 'desc', l: 'Description / cahier des charges', t: 'area' }], 'projets', function (p, box) {
      p.taches = p.taches || []
      var ul = e('ul', { class: 'liste taches' })
      function dessine() {
        ul.textContent = ''
        p.taches.forEach(function (t, i) {
          var c = e('input', { type: 'checkbox', checked: !!t.ok, 'aria-label': 'Fait : ' + t.t, style: 'width:auto;min-height:0' })
          c.addEventListener('change', function () { t.ok = c.checked; if (p.id) S.put('projets', p) })
          ul.appendChild(e('li', {}, [c, ' ' + t.t + ' ', btn('Retirer', function () { p.taches.splice(i, 1); if (p.id) S.put('projets', p); dessine() }, 'lnk danger')]))
        })
      }
      var nt = e('input', { placeholder: 'Nouvelle tâche…' })
      box.appendChild(e('h2', { text: 'Tâches' })); box.appendChild(ul)
      box.appendChild(e('div', { class: 'bar' }, [K().field('Ajouter une tâche', nt), btn('Ajouter', function () { if (!nt.value.trim()) return; p.taches.push({ t: nt.value.trim(), ok: false }); nt.value = ''; if (p.id) S.put('projets', p); dessine() }, 'btn ghost')]))
      dessine()
    })
    main.appendChild(e('h1', { text: 'Projets' }))
    main.appendChild(e('div', { class: 'bar' }, [btn('Nouveau projet', function () { K().go('projets/new') })]))
    var plan = e('div'); main.appendChild(plan)
    var board = e('div', { class: 'kan' }); main.appendChild(board)
    Promise.all([S.list('projets'), S.list('clients')]).then(function (r) {
      if (r[0].length) plan.appendChild(window.UI.carte('Planning', 'chaque projet du début à l’échéance ; la ligne rouge marque aujourd’hui', planningProjets(r[0], r[1]), legendePlanning()))
      PRJ_ST.forEach(function (col, ci) {
        var items = r[0].filter(function (p) { return (p.statut || 'afaire') === col[0] })
        var box = e('section', { class: 'kcol', 'aria-label': col[1] }, [e('h2', { text: col[1] + ' · ' + items.length })])
        items.forEach(function (p) {
          var tk = p.taches || [], ok = tk.filter(function (t) { return t.ok }).length
          var late = p.echeance && p.echeance < today() && p.statut !== 'livre'
          function move(d) { p.statut = PRJ_ST[ci + d][0]; S.put('projets', p).then(K().route) }
          box.appendChild(e('article', { class: 'kc' }, [e('b', {}, [lien('#projets/' + p.id, p.titre || 'Sans titre')]), e('small', { text: nomClient(byId(r[1], p.clientId)) }),
            e('small', { class: late ? 'late' : '', text: (p.echeance ? 'Échéance ' + fr(p.echeance) : 'Sans échéance') + (tk.length ? ' · ' + ok + '/' + tk.length + ' tâches' : '') }),
            e('div', { class: 'kmv' }, [ci > 0 ? btn('‹ ' + PRJ_ST[ci - 1][1], function () { move(-1) }, 'lnk') : null, ci < PRJ_ST.length - 1 ? btn(PRJ_ST[ci + 1][1] + ' ›', function () { move(1) }, 'lnk') : null])]))
        })
        board.appendChild(box)
      })
    })
  }

  /* ---------- site & messages ---------- */
  // CSV d'export Netlify Forms : en-têtes variables, champs entre guillemets possibles
  function csv(t) {
    var rows = [], row = [], cur = '', q = false
    for (var i = 0; i < t.length; i++) {
      var ch = t[i]
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += ch }
      else if (ch === '"') q = true
      else if (ch === ',' || ch === ';') { row.push(cur); cur = '' }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.length > 1 || row[0]) rows.push(row); row = [] }
      else cur += ch
    }
    row.push(cur); if (row.length > 1 || row[0]) rows.push(row)
    return rows
  }
  function site(a, b) {
    var e = K().el, S = K().S, main = K().main
    if (a === 'message' && b) return fiche('messages', b, 'Message', [{ k: 'nom', l: 'Nom' }, { k: 'email', l: 'E-mail', t: 'email' }, { k: 'sujet', l: 'Sujet' }, { k: 'traite', l: 'Statut', t: 'select', o: [['non', 'À traiter'], ['oui', 'Traité']], d: 'non' }, { k: 'texte', l: 'Message', t: 'area', rows: 7 }], 'site')
    if (a === 'blog' && b) return fiche('blog', b, 'Article de blog', [{ k: 'titre', l: 'Titre' }, { k: 'motcle', l: 'Mot-clé visé' }, { k: 'date', l: 'Publication prévue', t: 'date' }, { k: 'statut', l: 'Étape', t: 'select', o: BLOG_ST, d: 'idee' }, { k: 'notes', l: 'Plan, idées, liens', t: 'area', rows: 6 }], 'site')
    main.appendChild(e('h1', { text: 'Site & messages' }))
    var liens = e('div', { class: 'carte' }, [e('h2', { text: 'Gérer le site', style: 'margin-top:0' }),
      e('p', { class: 'mut', text: 'Le site est statique : les pages se modifient dans le code (build.mjs) puis se déploient. Voici les accès utiles.' }),
      e('div', { class: 'cta' }, [e('a', { class: 'btn ghost', href: '../', target: '_blank', rel: 'noopener', text: 'Voir le site' }),
        e('a', { class: 'btn ghost', href: 'https://app.netlify.com/projects/creatigo-agence-demo/forms', target: '_blank', rel: 'noopener', text: 'Formulaires reçus (Netlify)' }),
        e('a', { class: 'btn ghost', href: 'https://app.netlify.com/projects/creatigo-agence-demo/deploys', target: '_blank', rel: 'noopener', text: 'Mises en ligne (Netlify)' }),
        e('a', { class: 'btn ghost', href: '../sitemap.xml', target: '_blank', rel: 'noopener', text: 'Plan du site' })])])
    // messages
    main.appendChild(e('h2', { text: 'Messages de contact' }))
    var msg = e('p', { class: 'msg', role: 'status' }), zm = e('div')
    var file = e('input', { type: 'file', accept: '.csv,text/csv', 'aria-label': 'Export CSV Netlify' })
    file.addEventListener('change', function () {
      var f = file.files[0]; if (!f) return
      f.text().then(function (t) {
        var rows = csv(t); if (rows.length < 2) { msg.textContent = 'Fichier vide ou illisible.'; return }
        var h = rows[0].map(function (x) { return x.trim().toLowerCase() }), ix = function (re) { for (var i = 0; i < h.length; i++) if (re.test(h[i])) return i; return -1 }
        var iN = ix(/^(name|nom)/), iE = ix(/mail/), iM = ix(/message|texte|projet|need|besoin/), iS = ix(/subject|sujet|objet/), iD = ix(/creat|date/)
        S.list('messages').then(function (ex) {
          var vus = ex.map(function (m) { return m.cle }), n = 0
          var suite = function (i) {
            if (i >= rows.length) { msg.textContent = n + ' message(s) importé(s).'; return K().route() }
            var r = rows[i], cle = (iD > -1 ? r[iD] : '') + '|' + (iE > -1 ? r[iE] : '') + '|' + (iM > -1 ? r[iM] : '').slice(0, 40)
            if (vus.indexOf(cle) > -1) return suite(i + 1)
            vus.push(cle); n++
            S.put('messages', { cle: cle, nom: iN > -1 ? r[iN] : '', email: iE > -1 ? r[iE] : '', sujet: iS > -1 ? r[iS] : '', texte: iM > -1 ? r[iM] : '', recu: iD > -1 ? r[iD] : '', traite: 'non' }).then(function () { suite(i + 1) })
          }
          suite(1)
        })
      })
    })
    main.appendChild(e('div', { class: 'bar' }, [btn('Ajouter un message', function () { K().go('site/message/new') }), K().field('Importer l’export CSV de Netlify (Forms → Export)', file)]))
    main.appendChild(zm); main.appendChild(msg)
    S.list('messages').then(function (l) {
      zm.appendChild(tbl(['Reçu', 'De', 'Message', 'Statut', ''], l.map(function (m) {
        return e('tr', {}, [td(m.recu ? String(m.recu).slice(0, 10) : fr(m.creeLe)), td(lien('#site/message/' + m.id, m.nom || m.email || 'Sans nom')), td((m.texte || '').slice(0, 90) + ((m.texte || '').length > 90 ? '…' : '')), td(pill([['non', 'À traiter'], ['oui', 'Traité']], m.traite || 'non')),
          td(m.email ? e('a', { class: 'lnk', href: 'mailto:' + encodeURIComponent(m.email), text: 'Répondre' }) : '')])
      }), 'Aucun message. Importez l’export de Netlify ou ajoutez-en un.'))
    })
    // blog
    main.appendChild(e('h2', { text: 'Calendrier du blog' }))
    var zb = e('div')
    main.appendChild(e('div', { class: 'bar' }, [btn('Nouvel article', function () { K().go('site/blog/new') })])); main.appendChild(zb)
    colonnes(function (side) { side.appendChild(liens) })
    S.list('blog').then(function (l) {
      l.sort(function (x, y) { return (x.date || '9') < (y.date || '9') ? -1 : 1 })
      zb.appendChild(tbl(['Publication', 'Titre', 'Mot-clé', 'Étape'], l.map(function (x) { return e('tr', {}, [td(fr(x.date)), td(lien('#site/blog/' + x.id, x.titre || 'Sans titre')), td(x.motcle || '—'), td(pill(BLOG_ST, x.statut || 'idee'))]) }), 'Aucun article planifié.'))
    })
  }

  // « à traiter » : uniquement des faits calculés sur les données
  function aFaire(dv, fa, rd, pr, cl, ms) {
    var S = K().S, t = today(), todo = []
    var nomC = function (id) { var c = byId(cl, id); return c ? nomClient(c) : '' }
    var prjRetard = pr.filter(function (p) { return p.echeance && p.echeance < t && p.statut !== 'livre' })
    var todo = []
    rd.filter(function (x) { return x.statut === 'avenir' && (x.date === t || x.date === plus(1)) }).forEach(function (x) { todo.push({ ic: 'calendar-days', h: '#rdv/' + x.id, t: 'Rendez-vous ' + (x.date === t ? 'aujourd’hui' : 'demain') + ' à ' + (x.heure || '—') + (nomC(x.clientId) || x.nom ? ' avec ' + (nomC(x.clientId) || x.nom) : '') }) })
    fa.filter(function (f) { return (f.statut === 'envoyee' || f.statut === 'retard') && f.echeance && f.echeance < t }).forEach(function (f) { todo.push({ ic: 'receipt-text', h: '#factures/' + f.id, t: 'Facture ' + f.ref + ' en retard (' + nomClient(f.client) + ')', warn: 1 }) })
    cl.filter(function (c) { return c.rappel && c.rappel <= t }).forEach(function (c) { todo.push({ ic: 'bell', h: '#clients/' + c.id, t: 'Relancer ' + nomClient(c) }) })
    ms.filter(function (m) { return m.traite !== 'oui' }).slice(0, 3).forEach(function (m) { todo.push({ ic: 'mail', h: '#site/message/' + m.id, t: 'Répondre à ' + (m.nom || m.email || 'un message') }) })
    dv.filter(function (d) { return d.statut === 'nouveau' }).slice(0, 3).forEach(function (d) { todo.push({ ic: 'file-text', h: '#devis/' + d.id, t: 'Chiffrer la demande ' + d.ref }) })
    dv.filter(function (d) { return d.statut === 'envoye' && d.creeLe && (Date.now() - new Date(d.creeLe)) > 7 * 864e5 }).slice(0, 2).forEach(function (d) { todo.push({ ic: 'clock', h: '#devis/' + d.id, t: 'Devis ' + d.ref + ' sans réponse depuis plus de 7 jours' }) })
    prjRetard.slice(0, 2).forEach(function (p) { todo.push({ ic: 'rocket', h: '#projets/' + p.id, t: 'Projet « ' + (p.titre || 'sans titre') + ' » en retard', warn: 1 }) })

    return todo
  }
  function alertes() { var S = K().S; return Promise.all([S.devisList(), S.list('factures'), S.list('rdv'), S.list('projets'), S.list('clients'), S.list('messages')]).then(function (r) { return aFaire(r[0], r[1].filter(function (f) { return f.statut !== 'brouillon' }), r[2], r[3], r[4], r[5]) }) }

  /* ---------- tableau de bord : accueil, indicateurs, graphiques dessinés à la main (SVG), assistant ---------- */
  var SVGNS = 'http://www.w3.org/2000/svg'
  function sv(t, a) {
    var n = document.createElementNS(SVGNS, t)
    for (var k in a || {}) if (a[k] != null) n.setAttribute(k, a[k])
    for (var i = 2; i < arguments.length; i++) if (arguments[i] != null) n.appendChild(typeof arguments[i] === 'string' ? document.createTextNode(arguments[i]) : arguments[i])
    return n
  }
  var C = { bleu: '#0055ff', ciel: '#9db9ff', cyan: '#22b8e8', vert: '#12a36b', rouge: '#e5484d', ambre: '#f5a524', gris: '#d5d7de', encre: '#0e0f13' }
  var COUL = { prospect: C.ciel, actif: C.vert, inactif: C.gris, nouveau: C.ciel, envoye: C.cyan, accepte: C.vert, refuse: C.rouge, brouillon: C.gris, envoyee: C.cyan, payee: C.vert, retard: C.rouge, avenir: C.bleu, fait: C.vert, annule: C.gris }
  function ht(f) { var t = K().S.calc(f); return t.uniqueHT + t.mensuelHT }
  function eur0(n) { return Math.round(n).toLocaleString('fr-FR') + ' €' }
  function mois(n) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return d }
  function bulles() {
    if (window.__bulles) return; window.__bulles = true
    var b = document.getElementById('bulle')
    document.addEventListener('mousemove', function (ev) {
      var c = ev.target.closest && ev.target.closest('[data-bulle]')
      if (!c) { b.hidden = true; return }
      b.textContent = c.getAttribute('data-bulle'); b.hidden = false
      var r = b.getBoundingClientRect()
      b.style.left = Math.max(8, Math.min(ev.clientX + 12, innerWidth - r.width - 8)) + 'px'; b.style.top = Math.max(8, ev.clientY - r.height - 12) + 'px'
    })
  }
  function pas(max) { var n = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000]; for (var i = 0; i < n.length; i++) if (n[i] >= max) return n[i]; return Math.ceil(max / 1e5) * 1e5 }

  // barres empilées : encaissé / en attente, un mois par colonne
  function barres(ms) {
    var W = 560, H = 236, L = 46, B = 30, T = 14, R = 8
    var top = pas(Math.max.apply(null, ms.map(function (m) { return m.paye + m.attente }).concat([1]))), vide = ms.every(function (m) { return !m.paye && !m.attente })
    var g = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Chiffre d’affaires facturé par mois', class: 'a-chart' })
    var y = function (v) { return T + (H - T - B) * (1 - v / top) }
    for (var i = 0; i <= 4; i++) {
      var v = top * i / 4
      g.appendChild(sv('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: i ? 'gl' : 'gl0', 'stroke-width': 1 }))
      g.appendChild(sv('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'ax' }, v >= 1000 ? (v / 1000) + ' k€' : '0'))
    }
    var slot = (W - L - R) / ms.length, bw = Math.min(34, slot * .5)
    ms.forEach(function (m, i) {
      var x = L + slot * i + (slot - bw) / 2, tot = m.paye + m.attente
      var grp = sv('g', { 'data-bulle': m.l + ' : ' + eur0(m.paye) + ' encaissés, ' + eur0(m.attente) + ' en attente' })
      grp.appendChild(sv('rect', { x: L + slot * i, y: T, width: slot, height: H - T - B, fill: 'transparent' }))
      if (m.paye) grp.appendChild(sv('rect', { x: x, y: y(m.paye), width: bw, height: y(0) - y(m.paye), rx: 7, fill: C.bleu, class: 'bcol', style: 'animation-delay:' + (i * 70) + 'ms' }))
      if (m.attente) grp.appendChild(sv('rect', { x: x, y: y(tot), width: bw, height: y(m.paye) - y(tot) + (m.paye ? 8 : 0), rx: 7, fill: C.ciel, class: 'bcol', style: 'animation-delay:' + (i * 70 + 40) + 'ms', transform: '' }))
      grp.appendChild(sv('text', { x: x + bw / 2, y: H - 9, 'text-anchor': 'middle', class: 'ax' }, m.c))
      g.appendChild(grp)
    })
    if (vide) g.appendChild(sv('text', { x: W / 2, y: H / 2 - 4, 'text-anchor': 'middle', class: 'ax vide' }, 'Pas encore de factures'))
    return g
  }
  // courbe miniature (indicateurs)
  function spark(vals) {
    var W = 120, H = 34, mx = Math.max.apply(null, vals.concat([1])), pts = vals.map(function (v, i) { return [i * (W - 4) / Math.max(vals.length - 1, 1) + 2, H - 4 - (H - 10) * v / mx] })
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1) }).join(' ')
    var g = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'spark', 'aria-hidden': 'true' })
    g.appendChild(sv('path', { d: d + ' L' + pts[pts.length - 1][0] + ' ' + H + ' L2 ' + H + ' Z', fill: 'url(#sg)', opacity: .5 }))
    g.appendChild(sv('defs', {}, sv('linearGradient', { id: 'sg', x1: 0, y1: 0, x2: 0, y2: 1 }, sv('stop', { offset: 0, 'stop-color': C.bleu, 'stop-opacity': .35 }), sv('stop', { offset: 1, 'stop-color': C.bleu, 'stop-opacity': 0 }))))
    g.appendChild(sv('path', { d: d, fill: 'none', stroke: C.bleu, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
    g.appendChild(sv('circle', { cx: pts[pts.length - 1][0], cy: pts[pts.length - 1][1], r: 3, fill: C.bleu }))
    return g
  }
  // anneau : répartition (devis par statut)
  function anneau(parts) {
    var tot = parts.reduce(function (a, p) { return a + p.n }, 0), R = 54, circ = 2 * Math.PI * R, off = 0
    var g = sv('svg', { viewBox: '0 0 140 140', class: 'donut', role: 'img', 'aria-label': 'Répartition des devis par statut' })
    g.appendChild(sv('circle', { cx: 70, cy: 70, r: R, fill: 'none', class: 'dtk', 'stroke-width': 16 }))
    if (tot) parts.forEach(function (p) {
      if (!p.n) return
      var len = circ * p.n / tot
      g.appendChild(sv('circle', { cx: 70, cy: 70, r: R, fill: 'none', stroke: p.c, 'stroke-width': 16, 'stroke-dasharray': Math.max(len - 3, 1) + ' ' + circ, 'stroke-dashoffset': -off, transform: 'rotate(-90 70 70)', 'stroke-linecap': 'round', 'data-bulle': p.l + ' : ' + p.n }))
      off += len
    })
    g.appendChild(sv('text', { x: 70, y: 68, 'text-anchor': 'middle', class: 'dn' }, String(tot)))
    g.appendChild(sv('text', { x: 70, y: 86, 'text-anchor': 'middle', class: 'ax' }, tot > 1 ? 'devis' : 'devis'))
    return g
  }
  // barres horizontales : entonnoir et projets
  function lignes(rows) {
    var mx = Math.max.apply(null, rows.map(function (r) { return r.n }).concat([1])), e = K().el
    return e('ul', { class: 'a-hb' }, rows.map(function (r) {
      var i = e('i', { style: 'width:' + Math.max(r.n / mx * 100, r.n ? 6 : 0) + '%;background:' + r.c }); i.setAttribute('data-bulle', r.l + ' : ' + r.n)
      return e('li', {}, [e('span', { text: r.l }), e('div', { class: 'hbt' }, [i]), e('b', { text: String(r.n) })])
    }))
  }

  // fenêtre de navigateur + téléphone, avec les vraies captures du site (styles .y-win / .y-ph de style.css)
  function duo(fenetre, tel, cls) {
    var e = K().el, sh = function (n) { return '../assets/shots/' + n + '.webp' }
    return e('div', { class: 'duo ' + (cls || ''), 'aria-hidden': 'true' }, [
      e('span', { class: 'y-win' }, [e('span', { class: 'y-bar' }, [e('i'), e('i'), e('i'), e('em')]), e('img', { src: sh(fenetre), alt: '', width: '1200', height: '750' })]),
      e('span', { class: 'y-ph' }, [e('span', { class: 'y-scr' }, [e('img', { class: 'y-fill', src: sh(tel), alt: '', width: '1020', height: '2208' })])])])
  }
  function salut() { var h = new Date().getHours(); return h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour' }

  // Tableau de bord : même structure que celui de l'appli RH (bandeau d'accueil, jauge, anneau, rangée d'indicateurs
  // illustrés, courbes, barres fines, tableau, activité), calculée sur les données de l'agence.
  function tableau() {
    var e = K().el, S = K().S, main = K().main, t = today(), UI = window.UI, h = UI.h, G = UI.G, ic = UI.icone
    Promise.all([S.devisList(), S.list('factures'), S.list('rdv'), S.list('projets'), S.list('clients'), S.list('messages'), S.catalogue()]).then(function (r) {
      var dv = r[0], fa = r[1].filter(function (f) { return f.statut !== 'brouillon' }), rd = r[2], pr = r[3], cl = r[4], ms = r[5], cat = r[6]
      var vide = !(dv.length + r[1].length + rd.length + pr.length + cl.length + ms.length)
      var demoOn = [dv, r[1], rd, pr, cl, ms].some(function (l) { return l.some(function (x) { return x.demo }) })
      var nomC = function (id) { var c = byId(cl, id); return c ? nomClient(c) : '' }
      var n0 = function (n) { return Math.round(n).toLocaleString('fr-FR') }
      var pct = function (n) { return n == null ? '–' : n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %' }
      var pl = function (n, a, b) { return n0(n) + ' ' + (Math.abs(n) >= 2 ? (b || a + 's') : a) }

      // facturation des 12 derniers mois (courbes) et des 6 derniers (indicateurs)
      var M = []; for (var k = -11; k <= 0; k++) { var d0 = mois(k); M.push({ k: d0.toISOString().slice(0, 7), l: d0.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), c: d0.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''), paye: 0, attente: 0 }) }
      fa.forEach(function (f) { var m = M.filter(function (x) { return x.k === (f.date || '').slice(0, 7) })[0]; if (m) { if (f.statut === 'payee') m.paye += ht(f); else m.attente += ht(f) } })
      var M6 = M.slice(6)
      var ca6 = M6.reduce(function (a, m) { return a + m.paye + m.attente }, 0), paye6 = M6.reduce(function (a, m) { return a + m.paye }, 0)
      var du = 0, retard = 0
      fa.forEach(function (f) { if (f.statut === 'envoyee' || f.statut === 'retard') { du += ht(f) * (1 + S.TVA); if (f.statut === 'retard' || (f.echeance && f.echeance < t)) retard++ } })
      var enCours = dv.filter(function (d) { return d.statut === 'nouveau' || d.statut === 'envoye' })
      var pip = enCours.reduce(function (a, d) { return a + S.calc(d).uniqueHT }, 0)
      var nAcc = dv.filter(function (d) { return d.statut === 'accepte' }).length, nRef = dv.filter(function (d) { return d.statut === 'refuse' }).length
      var tx = nAcc + nRef ? 100 * nAcc / (nAcc + nRef) : null
      var prjActifs = pr.filter(function (p) { return p.statut === 'encours' || p.statut === 'relecture' }), prjRetard = pr.filter(function (p) { return p.echeance && p.echeance < t && p.statut !== 'livre' })
      var actifs = cl.filter(function (c) { return c.statut === 'actif' }).length
      var aVenir = rd.filter(function (x) { return x.statut === 'avenir' && x.date >= t }).sort(function (a, b) { return (a.date + (a.heure || '')) < (b.date + (b.heure || '')) ? -1 : 1 })
      var todo = aFaire(dv, fa, rd, pr, cl, ms), urgents = todo.filter(function (x) { return x.warn }).length

      // ---------- accueil : bandeau + jauge + anneau
      var heure = new Date().getHours(), salutTxt = heure < 5 || heure >= 18 ? 'Bonsoir' : 'Bonjour'
      var nom = ((document.querySelector('.profil .nom') || {}).textContent || '').trim() || 'Creatigo Agence'
      var hero = h('section', { class: 'accueil-hero' },
        h('div', { class: 'accueil-fond', 'aria-hidden': 'true' }), UI.mascotte('mascotte3', 'accueil-masc'),
        h('div', { class: 'accueil-texte' },
          h('span', { class: 'accueil-sur' }, salutTxt + ','),
          h('h1', {}, h('em', {}, nom), '.'),
          h('p', {}, vide ? 'Votre tableau de bord se remplit au fil de vos clients, devis, rendez-vous et factures.'
            : 'Situation de l’agence au ' + fr(t) + ' : ' + pl(actifs, 'client actif', 'clients actifs') + ', ' + pl(enCours.length, 'devis en cours', 'devis en cours') + ', ' + pl(todo.length, 'action', 'actions') + ' à traiter.'),
          urgents ? h('a', { class: 'accueil-puce critique', href: todo.filter(function (x) { return x.warn })[0].h }, h('i'), pl(urgents, 'point urgent', 'points urgents') + ' à regarder', ic('chevron-right', 14))
            : h('span', { class: 'accueil-puce' }, h('i'), vide ? 'Aucune donnée pour le moment' : 'Rien d’urgent aujourd’hui'),
          h('div', { class: 'accueil-actions' },
            vide ? h('button', { class: 'btn principal', type: 'button', onclick: function () { demo().then(K().route) } }, ic('sparkles', 15), 'Voir avec des exemples')
              : h('a', { class: 'btn principal', href: '#clients/new' }, ic('user-plus', 15), 'Nouveau client'),
            h('a', { class: 'btn verre', href: vide ? '#clients/new' : '#devis' }, vide ? 'Nouveau client' : 'Voir les devis', ic('arrow-right', 15)))))
      var jaugeCarte = h('section', { class: 'carte carte-jauge' },
        h('header', {}, h('h2', {}, 'Devis acceptés'), h('span', { class: 'discret' }, 'sur les devis tranchés')),
        G.jauge(tx || 0, { libelle: nAcc + nRef ? nAcc + ' sur ' + (nAcc + nRef) : 'aucun devis tranché', description: 'Part des devis acceptés parmi les devis acceptés ou refusés' }),
        h('div', { class: 'jauge-legende' },
          h('span', {}, h('i', { style: 'background:var(--serie-2)' }), 'En cours ' + n0(enCours.length)),
          h('span', {}, h('i', { style: 'background:var(--critique)' }), 'Refusés ' + n0(nRef)),
          h('span', {}, h('i', { style: 'background:var(--serie-neutre)' }), 'Total ' + n0(dv.length))))
      var partPaye = ca6 ? 100 * paye6 / ca6 : 0
      var scoreCarte = h('section', { class: 'carte carte-score' },
        h('header', {}, h('h2', {}, 'Encaissement'), h('span', { class: 'discret' }, '6 derniers mois')),
        h('div', { class: 'score-corps' },
          h('div', { class: 'score-boites' },
            h('div', { class: 'score-boite' }, h('span', {}, 'Facturé HT'), h('b', {}, eur0(ca6))),
            h('div', { class: 'score-boite' }, h('span', {}, 'Encaissé HT'), h('b', {}, eur0(paye6)))),
          G.anneauScore(partPaye, { libelle: 'Encaissé', valeur: pct(ca6 ? partPaye : null), sous: 'du facturé', description: 'Part du chiffre d’affaires facturé déjà encaissée' })))
      main.appendChild(h('div', { class: 'accueil' }, hero, jaugeCarte, scoreCarte))

      // ---------- rangée d'indicateurs illustrés
      main.appendChild(h('div', { class: 'grille kpi' },
        UI.tuile('Chiffre d’affaires, 6 mois', eur0(ca6), 'HT · ' + (M6[5].paye + M6[5].attente ? eur0(M6[5].paye + M6[5].attente) + ' ce mois-ci' : 'rien facturé ce mois-ci'), false, { icone: 'chart-column', visuel: G.courbeMini(M6.map(function (m) { return m.paye + m.attente }), { description: 'Chiffre d’affaires facturé par mois' }) }),
        UI.tuile('À encaisser', eur0(du), retard ? pl(retard, 'facture') + ' en retard' : 'TTC · aucun retard', retard > 0, { icone: 'euro' }),
        UI.tuile('Devis en cours', n0(enCours.length), pip ? eur0(pip) + ' HT en jeu' : 'aucun en attente', false, { icone: 'file-signature',
          visuel: G.progression([{ valeur: dv.filter(function (d) { return d.statut === 'nouveau' }).length, couleur: 'var(--serie-1)', libelle: 'Nouveaux' }, { valeur: dv.filter(function (d) { return d.statut === 'envoye' }).length, couleur: 'var(--serie-2)', libelle: 'Envoyés' }, { valeur: nAcc, couleur: 'var(--bon)', libelle: 'Acceptés' }, { valeur: nRef, couleur: 'var(--critique)', libelle: 'Refusés' }], { description: 'Devis par état' }) }),
        UI.tuile('Projets actifs', n0(prjActifs.length), prjRetard.length ? pl(prjRetard.length, 'projet') + ' en retard' : 'dans les temps', prjRetard.length > 0, { icone: 'hourglass' }),
        UI.tuile('Clients actifs', n0(actifs), pl(cl.filter(function (c) { return c.statut === 'prospect' }).length, 'prospect') + ' · ' + pl(cl.length, 'fiche'), false, { icone: 'users' }),
        UI.tuile('Rendez-vous à venir', n0(aVenir.length), aVenir.length ? 'prochain le ' + fr(aVenir[0].date) : 'aucun de prévu', false, { icone: 'calendar-clock' }),
        UI.tuile('Taux d’acceptation', tx == null ? '–' : pct(tx), nAcc + nRef ? pl(nAcc, 'devis accepté', 'devis acceptés') : 'pas encore de devis tranché', false, { icone: 'percent',
          ton: tx == null ? '' : tx >= 50 ? 'bon' : 'attention', delta: tx == null ? null : UI.delta(tx >= 50 ? 'bon rythme' : 'à relancer', tx >= 50 ? 'haut' : 'bas') }),
        UI.tuile('À traiter', n0(todo.length), urgents ? pl(urgents, 'point urgent', 'points urgents') : 'rien d’urgent', urgents > 0, { icone: 'bell',
          visuel: G.progression([{ valeur: urgents, couleur: 'var(--critique)', libelle: 'Urgents' }, { valeur: todo.length - urgents, couleur: 'var(--attention)', libelle: 'À faire' }], { description: 'Actions à traiter' }) })))

      // ---------- courbes de facturation + chiffre d'affaires par service (barres fines)
      var details = function (cols, lignes) { return h('details', { class: 'donnees' }, h('summary', {}, ic('chevron-right', 14), 'Voir les données'), UI.tableau(cols.map(function (c, i) { return { titre: c, num: i > 0 } }), lignes)) }
      var courbes = UI.carte('Chiffre d’affaires facturé', '12 derniers mois, HT',
        G.airesLisses(M.map(function (m) { return { x: m.c, paye: m.paye, attente: m.attente } }),
          [{ cle: 'paye', libelle: 'Encaissé', couleur: 'var(--serie-1)' }, { cle: 'attente', libelle: 'En attente', couleur: 'var(--serie-2)' }],
          { format: function (v) { return n0(v / 1000) + ' k€' }, description: 'Chiffre d’affaires encaissé et en attente par mois' }),
        details(['Mois', 'Encaissé HT', 'En attente HT'], M.map(function (m) { return [m.l, eur0(m.paye), eur0(m.attente)] })))
      courbes.classList.add('large')
      var famille = {}; cat.forEach(function (c) { c.items.forEach(function (it) { famille[it.id] = c.nom }) })
      var parService = {}
      fa.concat(dv.filter(function (d) { return d.statut === 'accepte' })).forEach(function (x) { (x.lignes || []).forEach(function (l) { var f = famille[l.itemId] || 'Autres'; parService[f] = (parService[f] || 0) + (l.qty || 0) * (l.prix || 0) }) })
      var services = Object.keys(parService).map(function (f) { return { libelle: f.replace(/\s*\(.*\)$/, ''), valeur: parService[f] } }).sort(function (a, b) { return b.valeur - a.valeur })
      var miniStat = function (i, l, v) { return h('div', { class: 'mini-stat' }, h('span', { class: 'mini-ico' }, ic(i, 14)), h('span', { class: 'mini-lib' }, l), h('b', {}, v)) }
      var totalServ = services.reduce(function (a, x) { return a + x.valeur }, 0)
      var servCarte = UI.carte('Ventes par service', 'devis acceptés et factures, HT',
        services.length ? h('div', { class: 'bf-panneau' }, G.barresFines(services, { format: function (v) { return n0(v / 1000) + ' k€' }, description: 'Montant vendu par service' })) : UI.etatVide('Pas encore de vente.', 'chart-column'),
        h('div', { class: 'mini-stats' },
          miniStat('shopping-cart', 'Services', n0(services.length)),
          miniStat('euro', 'Total', eur0(totalServ)),
          miniStat('arrow-up', 'Premier', services[0] ? services[0].libelle.split(' ')[0] : '–'),
          miniStat('file-text', 'Devis', n0(dv.length))))
      servCarte.classList.add('salaires-carte')
      main.appendChild(h('div', { class: 'rangee r21' }, courbes, servCarte))

      // ---------- dernières factures (tableau) + activité (ce qui attend une action)
      var dern = fa.slice().sort(function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1 }).slice(0, 6)
      var maxF = Math.max.apply(null, dern.map(function (f) { return ht(f) }).concat([1]))
      var TONS = { envoyee: 'attention', payee: 'bon', retard: 'critique', brouillon: 'info' }
      var tableF = h('section', { class: 'carte sans-marge' },
        h('header', { class: 'tete-tableau' }, h('div', {}, h('h2', {}, 'Dernières factures'), h('span', { class: 'discret petit' }, pl(fa.length, 'facture') + ' émise' + (fa.length > 1 ? 's' : '') + ' · ' + eur0(du) + ' TTC à encaisser'))),
        dern.length ? h('div', { class: 'table-zone', tabindex: '0', role: 'region', 'aria-label': 'Dernières factures' },
          h('table', { class: 'table-services' },
            h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Client'), h('th', { scope: 'col' }, 'Montant'), h('th', { scope: 'col' }, 'Statut'), h('th', { scope: 'col', class: 'num' }, 'Échéance'))),
            h('tbody', {}, dern.map(function (f) {
              return h('tr', {},
                h('td', {}, h('a', { class: 'service-nom lien-ligne', href: '#factures/' + f.id }, h('span', { class: 'service-ini', 'aria-hidden': 'true' }, ic('receipt-text', 15)), h('span', {}, nomClient(f.client), h('small', { class: 'discret', style: 'display:block;font-weight:400' }, f.ref)))),
                h('td', {}, h('div', { class: 'part-cellule' }, h('b', {}, eur0(ht(f))), h('span', {}, 'HT'), h('div', { class: 'part-piste' }, h('i', { style: 'width:' + (ht(f) / maxF * 100) + '%' })))),
                h('td', {}, UI.badge(lab(FAC_ST, f.statut), TONS[f.statut] || '')),
                h('td', { class: 'num' }, fr(f.echeance)))
            })))) : UI.etatVide('Aucune facture pour le moment.', 'receipt-text'),
        h('div', { style: 'padding:12px 22px 18px' }, h('a', { class: 'btn lien petit', href: '#factures' }, 'Toutes les factures', ic('arrow-right', 14))))
      var nbAt = function (w) { return todo.filter(function (x) { return !!x.warn === w }).length }
      var activite = UI.carte('À traiter', 'votre assistant a trié ce qui compte',
        todo.length ? h('div', { class: 'activite' }, h('div', { class: 'activite-contenu' },
          h('div', { class: 'activite-bilan' }, h('div', { class: 'activite-chiffres' },
            h('div', { class: 'critique' }, h('b', {}, n0(nbAt(true))), h('span', {}, 'Urgents')),
            h('div', { class: 'importante' }, h('b', {}, n0(nbAt(false))), h('span', {}, 'À faire')),
            h('div', { class: 'info' }, h('b', {}, n0(ms.filter(function (m) { return m.traite !== 'oui' }).length)), h('span', {}, 'Messages')))),
          h('ol', { class: 'fil-activite riche' }, todo.slice(0, 6).map(function (x) {
            return h('li', { class: x.warn ? 'critique' : 'importante' },
              h('span', { class: 'fil-point', 'aria-hidden': 'true' }, ic(x.ic || 'info', 15)),
              h('div', {}, h('div', { class: 'fil-ligne' }, h('a', { href: x.h, style: 'color:inherit;text-decoration:none' }, h('b', { title: x.t }, x.t)), UI.badge(x.warn ? 'Urgent' : 'À faire', x.warn ? 'critique' : 'attention')),
                h('span', {}, x.warn ? 'en retard · à traiter en priorité' : 'à traiter aujourd’hui')))
          })),
          h('p', { class: 'activite-pied' }, ic('refresh-cw', 13), 'Calculé à l’ouverture de la page, le ' + fr(t))))
          : UI.etatVide(vide ? 'Les relances, retards et rendez-vous apparaîtront ici.' : 'Aucun retard, aucune relance due.', 'circle-check'))
      activite.classList.add('activite-carte')
      main.appendChild(h('div', { class: 'rangee r21' }, tableF, activite))

      // ---------- répartitions : devis par état (anneau) + parcours client et projets (barres)
      var parts = [['nouveau', 'Nouveaux'], ['envoye', 'Envoyés'], ['accepte', 'Acceptés'], ['refuse', 'Refusés']].map(function (x) { var n = dv.filter(function (d) { return d.statut === x[0] }).length; return { libelle: x[1], nombre: n, part: dv.length ? 100 * n / dv.length : 0 } })
      var coul = { Nouveaux: 'var(--serie-1)', 'Envoyés': 'var(--serie-2)', 'Acceptés': 'var(--serie-3)', 'Refusés': 'var(--serie-4)' }
      var ent = [['Prospects', cl.filter(function (c) { return c.statut === 'prospect' }).length], ['Devis envoyés', dv.filter(function (d) { return d.statut !== 'nouveau' }).length], ['Devis acceptés', nAcc], ['Clients actifs', actifs], ['Factures payées', fa.filter(function (f) { return f.statut === 'payee' }).length]]
      var prl = PRJ_ST.map(function (x) { return { libelle: x[1], valeur: pr.filter(function (p) { return (p.statut || 'afaire') === x[0] }).length } })
      main.appendChild(h('div', { class: 'rangee r11' },
        UI.carte('Devis par état', pl(dv.length, 'devis', 'devis'), dv.length ? G.anneau(parts, coul, { total: dv.length, libelleTotal: 'devis', description: 'Répartition des devis par état' }) : UI.etatVide('Aucun devis.', 'file-text')),
        UI.carte('Entonnoir commercial', 'de la prospection au paiement', UI.entonnoir([
          { libelle: 'Contacts', valeur: cl.length, ic: 'users', detail: pl(cl.filter(function (c) { return c.statut === 'prospect' }).length, 'prospect') },
          { libelle: 'Devis envoyés', valeur: dv.filter(function (d) { return d.statut !== 'nouveau' }).length, ic: 'send', detail: eur0(dv.filter(function (d) { return d.statut !== 'nouveau' }).reduce(function (a, d) { return a + S.calc(d).uniqueHT }, 0)) + ' HT proposés' },
          { libelle: 'Devis acceptés', valeur: nAcc, ic: 'file-signature', detail: eur0(dv.filter(function (d) { return d.statut === 'accepte' }).reduce(function (a, d) { return a + S.calc(d).uniqueHT }, 0)) + ' HT signés' },
          { libelle: 'Clients actifs', valeur: actifs, ic: 'euro', detail: eur0(fa.filter(function (f) { return f.statut === 'payee' }).reduce(function (a, f) { return a + ht(f) }, 0)) + ' HT déjà encaissés' }],
          { description: 'Entonnoir commercial : contacts, devis envoyés, devis acceptés, factures payées' }))))
      var agenda = aVenir.length ? h('ul', { class: 'ag' }, aVenir.slice(0, 5).map(function (x) {
        var d1 = new Date(x.date + 'T12:00:00')
        return h('li', {}, h('div', { class: 'jr' }, h('b', {}, String(d1.getDate())), h('small', {}, d1.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''))),
          h('div', {}, h('a', { href: '#rdv/' + x.id }, nomC(x.clientId) || x.nom || 'Rendez-vous'), h('small', {}, (x.heure || '') + (x.objet ? ' · ' + x.objet : ''))))
      })) : UI.etatVide('Aucun rendez-vous à venir.', 'calendar-days')
      main.appendChild(h('div', { class: 'rangee r11' },
        UI.carte('Planning des projets', pl(pr.length, 'projet') + ', du début à l’échéance', planningProjets(pr, cl), legendePlanning()),
        UI.carte('Prochains rendez-vous', aVenir.length ? pl(aVenir.length, 'à venir', 'à venir') : 'agenda', agenda)))
      var src = h('p', { class: 'discret petit', style: 'display:flex;align-items:center;gap:6px' }, ic('database', 14), 'Source : devis, factures, rendez-vous, projets, clients et messages ' + (K().S.auth && K().S.auth.session && K().S.auth.session() ? 'de la base de l’agence.' : 'de ce navigateur.'))
      main.appendChild(src)
      if (demoOn) main.appendChild(h('p', { class: 'demo' }, 'Ces chiffres sont des exemples.', h('button', { class: 'btn lien petit', type: 'button', onclick: function () { retireDemo().then(K().route) } }, 'Retirer les exemples')))
    })
  }

  /* ---------- jeu d'exemple, marqué demo:true pour pouvoir le retirer ---------- */
  function demo() {
    var S = K().S, enchaine = function (fns) { return fns.reduce(function (p, f) { return p.then(f) }, Promise.resolve()) }
    return S.catalogue().then(function (cat) {
      var it = []; cat.forEach(function (c) { c.items.forEach(function (x) { it.push(x) }) })
      var D = function (o) { o.demo = true; return o }
      var cli = [['Boulangerie Soleil', 'Karim Benali', 'actif'], ['Cabinet Moreau', 'Claire Moreau', 'actif'], ['Studio Lumen', 'Hugo Petit', 'prospect'], ['Garage du Midi', 'Sofia Ramos', 'actif'], ['Fleurs & Co', 'Inès Dupont', 'prospect'], ['Le Petit Bistrot', 'Marc Leroy', 'inactif']]
      var ids = [], fl = [], jours = function (n) { return plus(n) }
      var etapes = cli.map(function (c, i) { return function () { return S.put('clients', D({ nom: c[1], societe: c[0], email: c[1].split(' ')[0].toLowerCase() + '@exemple.fr', tel: '06 00 00 00 0' + i, statut: c[2], adresse: '', notes: '', rappel: i === 2 ? plus(-2) : '' })).then(function (o) { ids.push(o.id) }) } })
      ;['accepte', 'accepte', 'envoye', 'accepte', 'nouveau', 'refuse'].forEach(function (st, i) { etapes.push(function () { return S.saveDevis(D({ statut: st, source: 'admin', remise: 0, notes: '', client: { nom: cli[i][1], societe: cli[i][0], email: cli[i][1].split(' ')[0].toLowerCase() + '@exemple.fr', tel: '' }, lignes: [S.ligne(it[(i * 3) % it.length], 1), S.ligne(it[(i * 5 + 2) % it.length], 1)] })) }) })
      ;[[-150, 'payee', 0], [-120, 'payee', 1], [-100, 'payee', 3], [-70, 'payee', 0], [-40, 'payee', 1], [-12, 'envoyee', 3], [-55, 'envoyee', 0], [-3, 'brouillon', 1]].forEach(function (f, k) {
        etapes.push(function () { return S.list('factures').then(function (l) { return S.put('factures', D({ ref: S.nextRef('FAC', l), statut: f[1], date: jours(f[0]), echeance: jours(f[0] + 30), clientId: ids[f[2]], client: { nom: cli[f[2]][1], societe: cli[f[2]][0], email: '' }, lignes: [S.ligne(it[(k * 2 + 1) % it.length], 1), S.ligne(it[(k * 4 + 3) % it.length], 1)], remise: 0, notes: '' })) }) })
      })
      ;[[0, '14:30', 'avenir', 'Site vitrine'], [1, '10:00', 'avenir', 'Refonte du site'], [4, '16:00', 'avenir', 'SEO local'], [-3, '11:00', 'fait', 'Cadrage'], [-9, '15:00', 'fait', 'Premier échange']].forEach(function (x, k) {
        etapes.push(function () { return S.put('rdv', D({ clientId: ids[(k + 2) % 6], date: jours(x[0]), heure: x[1], statut: x[2], objet: x[3], lieu: '', notes: '' })) })
      })
      ;[['Site de la boulangerie', 0, 'encours', 12, [['Maquette', 1], ['Intégration', 1], ['Contenus', 0], ['Mise en ligne', 0]], -38], ['Refonte cabinet', 1, 'relecture', 4, [['Audit', 1], ['Nouvelle charte', 1], ['Relecture client', 0]], -52], ['Campagne Ads garage', 3, 'afaire', -2, [['Mots-clés', 0]], -16], ['SEO bistrot', 5, 'livre', -20, [['Audit', 1], ['Rapport', 1]], -75]].forEach(function (p) {
        etapes.push(function () { return S.put('projets', D({ titre: p[0], clientId: ids[p[1]], statut: p[2], debut: jours(p[5]), echeance: jours(p[3]), taches: p[4].map(function (t) { return { t: t[0], ok: !!t[1] } }) })) })
      })
      etapes.push(function () { return S.put('messages', D({ nom: 'Léa Garnier', email: 'lea@exemple.fr', texte: 'Bonjour, je voudrais un site pour mon activité de coach. Pouvez-vous me rappeler ?', traite: 'non' })) })
      etapes.push(function () { return S.put('blog', D({ titre: 'Réussir son référencement local', motcle: 'seo local toulouse', date: jours(10), statut: 'redaction' })) })
      return enchaine(etapes)
    })
  }
  function retireDemo() {
    var S = K().S, o = {}
    return Promise.all(S.COLLS.concat(['devis']).map(function (n) { return (n === 'devis' ? S.devisList() : S.list(n)).then(function (l) { o[n] = l.filter(function (x) { return !x.demo }) }) })).then(function () { return S.replaceAll(o) })
  }

  /* ---------- planning des projets (Gantt) : du début à l'échéance, avancement = tâches faites ---------- */
  function planningProjets(pr, cl) {
    var t = today()
    var l = pr.slice().sort(function (a, b) { return (a.echeance || '9') < (b.echeance || '9') ? -1 : 1 }).map(function (p) {
      var tk = p.taches || [], ok = tk.filter(function (x) { return x.ok }).length
      var fini = p.statut === 'livre', retard = !fini && p.echeance && p.echeance < t
      return { libelle: p.titre || 'Sans titre', sous: nomClient(byId(cl, p.clientId)) + ' · ' + lab(PRJ_ST, p.statut || 'afaire'), debut: p.debut || (p.creeLe || '').slice(0, 10) || t, fin: p.echeance, href: '#projets/' + p.id, ton: fini ? 'fini' : retard ? 'retard' : '', avance: fini ? 100 : tk.length ? 100 * ok / tk.length : 0 }
    })
    return window.UI.planning(l, { description: 'Planning des projets, du début à l’échéance' })
  }
  function legendePlanning() {
    var h = window.UI.h
    return h('div', { class: 'jauge-legende', style: 'justify-content:flex-start' },
      h('span', {}, h('i', { style: 'background:var(--accent)' }), 'En cours (partie pleine : tâches faites)'),
      h('span', {}, h('i', { style: 'background:var(--critique)' }), 'En retard'),
      h('span', {}, h('i', { style: 'background:var(--bon)' }), 'Livré'))
  }

  /* ---------- rangées d'indicateurs en tête de chaque page (même rangée que l'appli RH) ---------- */
  function kpiPages() {
    var S = K().S, UI = window.UI, t = today()
    var n0 = function (n) { return Math.round(n).toLocaleString('fr-FR') }
    var pl = function (n, a, b) { return n0(n) + ' ' + (Math.abs(n) >= 2 ? (b || a + 's') : a) }
    var T = UI.tuile, P = UI.G.progression
    return {
      clients: function () { return Promise.all([S.list('clients'), S.devisList()]).then(function (r) {
        var c = r[0], n = function (st) { return c.filter(function (x) { return x.statut === st }).length }, rel = c.filter(function (x) { return x.rappel && x.rappel <= t }).length
        return [T('Fiches clients', n0(c.length), pl(n('prospect'), 'prospect') + ' · ' + pl(n('inactif'), 'inactif'), false, { icone: 'users', visuel: P([{ valeur: n('actif'), couleur: 'var(--serie-1)', libelle: 'Actifs' }, { valeur: n('prospect'), couleur: 'var(--serie-2)', libelle: 'Prospects' }, { valeur: n('inactif'), couleur: 'var(--serie-neutre)', libelle: 'Inactifs' }], { description: 'Clients par statut' }) }),
          T('Clients actifs', n0(n('actif')), 'avec un projet ou un contrat en cours', false, { icone: 'briefcase' }),
          T('Devis acceptés', n0(r[1].filter(function (d) { return d.statut === 'accepte' }).length), 'sur ' + pl(r[1].length, 'devis', 'devis'), false, { icone: 'file-signature' }),
          T('À relancer', n0(rel), rel ? 'rappel arrivé à échéance' : 'personne pour le moment', rel > 0, { icone: 'bell' })]
      }) },
      devis: function () { return S.devisList().then(function (l) {
        var n = function (st) { return l.filter(function (d) { return d.statut === st }).length }, enJeu = l.filter(function (d) { return d.statut === 'nouveau' || d.statut === 'envoye' }).reduce(function (a, d) { return a + S.calc(d).uniqueHT }, 0)
        var tr = n('accepte') + n('refuse'), tx = tr ? 100 * n('accepte') / tr : null
        return [T('Devis', n0(l.length), pl(n('nouveau'), 'nouveau', 'nouveaux') + ' · ' + pl(n('envoye'), 'envoyé'), false, { icone: 'file-signature', visuel: P([{ valeur: n('nouveau'), couleur: 'var(--serie-1)', libelle: 'Nouveaux' }, { valeur: n('envoye'), couleur: 'var(--serie-2)', libelle: 'Envoyés' }, { valeur: n('accepte'), couleur: 'var(--bon)', libelle: 'Acceptés' }, { valeur: n('refuse'), couleur: 'var(--critique)', libelle: 'Refusés' }], { description: 'Devis par état' }) }),
          T('En jeu', eur0(enJeu), 'HT, devis nouveaux et envoyés', false, { icone: 'euro' }),
          T('Taux d’acceptation', tx == null ? '–' : tx.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %', pl(n('accepte'), 'accepté') + ' · ' + pl(n('refuse'), 'refusé'), false, { icone: 'percent' }),
          T('Demandes du site', n0(l.filter(function (d) { return d.source === 'site' }).length), 'reçues depuis la page devis', false, { icone: 'message-square' })]
      }) },
      factures: function () { return S.list('factures').then(function (l) {
        var du = 0, paye = 0, ret = 0
        l.forEach(function (f) { var v = ttc(f); if (f.statut === 'payee') paye += v; else if (f.statut === 'envoyee' || f.statut === 'retard') { du += v; if (f.statut === 'retard' || (f.echeance && f.echeance < t)) ret++ } })
        var n = function (st) { return l.filter(function (f) { return f.statut === st }).length }
        return [T('À encaisser', eur0(du), 'TTC · ' + pl(n('envoyee') + n('retard'), 'facture') + ' en attente', false, { icone: 'euro' }),
          T('Encaissé', eur0(paye), 'TTC · ' + pl(n('payee'), 'facture payée', 'factures payées'), false, { icone: 'chart-column', visuel: P([{ valeur: n('payee'), couleur: 'var(--bon)', libelle: 'Payées' }, { valeur: n('envoyee'), couleur: 'var(--serie-2)', libelle: 'Envoyées' }, { valeur: n('retard'), couleur: 'var(--critique)', libelle: 'En retard' }, { valeur: n('brouillon'), couleur: 'var(--serie-neutre)', libelle: 'Brouillons' }], { description: 'Factures par statut' }) }),
          T('En retard', n0(ret), ret ? 'à relancer' : 'aucun retard', ret > 0, { icone: 'calendar-clock' }),
          T('Brouillons', n0(n('brouillon')), 'pas encore envoyées', false, { icone: 'file-text' })]
      }) },
      projets: function () { return S.list('projets').then(function (l) {
        var n = function (st) { return l.filter(function (p) { return (p.statut || 'afaire') === st }).length }, ret = l.filter(function (p) { return p.echeance && p.echeance < t && p.statut !== 'livre' }).length
        var tk = [].concat.apply([], l.map(function (p) { return p.taches || [] })), ok = tk.filter(function (x) { return x.ok }).length
        return [T('Projets actifs', n0(n('encours') + n('relecture')), pl(n('afaire'), 'projet') + ' à démarrer', false, { icone: 'hourglass', visuel: P(PRJ_ST.map(function (x, i) { return { valeur: n(x[0]), couleur: ['var(--serie-neutre)', 'var(--serie-1)', 'var(--serie-4)', 'var(--bon)'][i], libelle: x[1] } }), { description: 'Projets par étape' }) }),
          T('En relecture', n0(n('relecture')), 'en attente du client', false, { icone: 'eye' }),
          T('Livrés', n0(n('livre')), pl(l.length, 'projet') + ' au total', false, { icone: 'clipboard-check' }),
          T('En retard', n0(ret), ret ? 'échéance dépassée' : 'tout est dans les temps', ret > 0, { icone: 'triangle-alert', delta: tk.length ? UI.delta(Math.round(100 * ok / tk.length) + ' % des tâches faites', 'neutre') : null })]
      }) },
      rdv: function () { return S.list('rdv').then(function (l) {
        var n = function (st) { return l.filter(function (x) { return x.statut === st }).length }, aVenir = l.filter(function (x) { return x.statut === 'avenir' && x.date >= t }), auj = l.filter(function (x) { return x.statut === 'avenir' && x.date === t }).length
        return [T('À venir', n0(aVenir.length), aVenir.length ? 'prochain le ' + fr(aVenir.map(function (x) { return x.date }).sort()[0]) : 'aucun de prévu', false, { icone: 'calendar-clock' }),
          T('Aujourd’hui', n0(auj), auj ? 'à préparer' : 'journée libre', false, { icone: 'clock' }),
          T('Réalisés', n0(n('fait')), pl(l.length, 'rendez-vous', 'rendez-vous') + ' au total', false, { icone: 'clipboard-check', visuel: P([{ valeur: n('avenir'), couleur: 'var(--serie-1)', libelle: 'À venir' }, { valeur: n('fait'), couleur: 'var(--bon)', libelle: 'Réalisés' }, { valeur: n('annule'), couleur: 'var(--serie-neutre)', libelle: 'Annulés' }], { description: 'Rendez-vous par statut' }) }),
          T('Annulés', n0(n('annule')), 'reportés ou annulés', false, { icone: 'calendar-clock' })]
      }) },
    }
  }
  var kpiCache = null
  window.CoqueKpi = new Proxy({}, { get: function (o, k) { kpiCache = kpiCache || kpiPages(); return kpiCache[k] } })
  // recherche de la barre du haut : clients, devis, factures, projets
  window.CoqueRecherche = function () {
    var S = K().S
    return Promise.all([S.list('clients'), S.devisList(), S.list('factures'), S.list('projets')]).then(function (r) {
      return r[0].map(function (c) { return { t: nomClient(c), s: c.email || lab(CLIENT_ST, c.statut), h: '#clients/' + c.id, ic: 'user', g: 'Clients' } })
        .concat(r[1].map(function (d) { return { t: d.ref + ' · ' + nomClient(d.client), s: lab(S.STATUTS, d.statut), h: '#devis/' + d.id, ic: 'file-text', g: 'Devis' } }))
        .concat(r[2].map(function (f) { return { t: f.ref + ' · ' + nomClient(f.client), s: lab(FAC_ST, f.statut), h: '#factures/' + f.id, ic: 'receipt-text', g: 'Factures' } }))
        .concat(r[3].map(function (p) { return { t: p.titre || 'Projet', s: lab(PRJ_ST, p.statut || 'afaire'), h: '#projets/' + p.id, ic: 'rocket', g: 'Projets' } }))
    })
  }
  window.AdminModules = { colonnes: colonnes, repartDevis: function (s, l) { repart(s, 'Par statut', 'état de vos devis', comptes(l, K().S.STATUTS, 'statut', COUL)) }, clients: clients, rdv: rdv, factures: factures, projets: projets, site: site, tableau: tableau, alertes: alertes }
})()
