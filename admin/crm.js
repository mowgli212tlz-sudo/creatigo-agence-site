/* Administration : CRM (pipeline commercial, suivi des prospects) et cockpit de pilotage (périodes, comparaisons, flux d'activité, exports).
   Données : les prospects sont des fiches « clients » (statut prospect) ; le suivi commercial vit dans la fiche (etape, origine, budget,
   services, priorite, proba, interactions, rappel = prochaine relance). Une affaire gagnée devient un client actif : c'est la même fiche.
   Tout est calculé à partir des données réelles ; ce qui n'est pas encore suivi (dépenses, contrats) est affiché comme tel, jamais inventé.
   Tout texte venant des données passe par textContent (UI.h), jamais par innerHTML. */
(function () {
  var K = function () { return window.AdminKit }
  var UI = function () { return window.UI }

  /* ---------- référentiels ---------- */
  var ETAPES = [
    { id: 'nouveau', l: 'Nouveau prospect', p: 10, ic: 'user-plus' },
    { id: 'contact', l: 'Premier contact', p: 20, ic: 'phone' },
    { id: 'qualification', l: 'Qualification', p: 35, ic: 'list-checks' },
    { id: 'rdv', l: 'Rendez-vous', p: 50, ic: 'calendar-days' },
    { id: 'devis', l: 'Devis envoyé', p: 65, ic: 'file-text' },
    { id: 'negociation', l: 'Négociation', p: 80, ic: 'handshake' },
    { id: 'gagne', l: 'Gagné', p: 100, ic: 'circle-check' },
    { id: 'perdu', l: 'Perdu', p: 0, ic: 'circle-x' },
  ]
  var OUVERTES = ['nouveau', 'contact', 'qualification', 'rdv', 'devis', 'negociation']
  var ORIGINES = ['Site web', 'Recommandation', 'Réseaux sociaux', 'Google / publicité', 'Salon / événement', 'Prospection directe', 'Autre']
  var PRIORITES = [['haute', 'Haute', 'critique'], ['normale', 'Normale', ''], ['basse', 'Basse', 'neutre']]
  var TYPES = [['appel', 'Appel', 'phone'], ['email', 'E-mail', 'mail'], ['rdv', 'Rendez-vous', 'calendar-days'], ['message', 'Message', 'message-circle'], ['note', 'Note', 'square-pen'], ['etape', 'Changement d’étape', 'activity']]
  var JOURS_INACTIF = 14

  function etapeInfo(id) { return ETAPES.filter(function (x) { return x.id === id })[0] || ETAPES[0] }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) }
  function jours(a, b) { return Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a.slice(0, 10) + 'T12:00:00')) / 864e5) }
  function nomC(c) { return c ? (c.societe ? c.societe + (c.nom ? ' · ' + c.nom : '') : c.nom) || 'Sans nom' : '—' }
  function lab(t, v) { var r = t.filter(function (x) { return x[0] === v })[0]; return r ? r[1] : v }

  /* ---------- lecture d'une fiche ---------- */
  function etape(c) { return c.etape || (c.statut === 'actif' || c.statut === 'inactif' ? 'gagne' : 'nouveau') }
  function ouverte(c) { return OUVERTES.indexOf(etape(c)) >= 0 }
  function proba(c) { return c.proba !== undefined && c.proba !== null && c.proba !== '' ? Math.max(0, Math.min(100, +c.proba)) : etapeInfo(etape(c)).p }
  function budget(c) { return Math.max(0, +c.budget || 0) }
  function interactions(c) { return Array.isArray(c.interactions) ? c.interactions : [] }
  function derniereActivite(c) {
    var d = (c.creeLe || '').slice(0, 10)
    interactions(c).forEach(function (i) { if (i.date && i.date > d) d = i.date.slice(0, 10) })
    return d || today()
  }
  function sansActivite(c) { return ouverte(c) && jours(derniereActivite(c), today()) > JOURS_INACTIF }
  function relanceDue(c) { return ouverte(c) && c.rappel && c.rappel <= today() }

  /* ---------- changement d'étape (garde l'historique ; gagné = client actif) ---------- */
  function changerEtape(c, nouvelle, raison) {
    var S = K().S, avant = etape(c)
    if (avant === nouvelle) return Promise.resolve(c)
    c.etape = nouvelle
    if (!c.probaPerso) delete c.proba
    c.interactions = interactions(c).concat([{ id: 'i' + Date.now().toString(36), date: today(), type: 'etape', texte: etapeInfo(avant).l + ' → ' + etapeInfo(nouvelle).l + (raison ? ' (' + raison + ')' : ''), auteur: S.auth && S.auth.email ? S.auth.email() : '' }])
    if (nouvelle === 'gagne') { c.statut = 'actif'; c.gagneLe = today(); delete c.perduLe; delete c.raisonPerte }
    else if (nouvelle === 'perdu') { c.perduLe = today(); c.raisonPerte = raison || ''; if (c.statut === 'actif') c.statut = 'inactif' }
    else { if (avant === 'gagne' || avant === 'perdu') { delete c.gagneLe; delete c.perduLe; delete c.raisonPerte } if (c.statut !== 'actif') c.statut = 'prospect' }
    return S.put('clients', c)
  }

  // boîte de dialogue : raison de la perte (facultative)
  function demanderRaison() {
    var h = UI().h
    return new Promise(function (ok) {
      var t = h('textarea', { rows: '3', maxlength: '300', placeholder: 'Prix, délai, concurrent, projet abandonné…', 'aria-label': 'Raison' })
      var d = h('dialog', { 'aria-label': 'Affaire perdue' })
      var fin = function (v) { d.close(); d.remove(); ok(v) }
      d.addEventListener('cancel', function (e) { e.preventDefault(); fin(null) })
      d.append(h('div', { class: 'confirmation' }, h('h2', {}, 'Affaire perdue'), h('p', { class: 'discret' }, 'Pourquoi ? (facultatif, utile pour comprendre ce qui ne convertit pas)'), t,
        h('div', { class: 'boutons' }, h('button', { class: 'btn', type: 'button', onclick: function () { fin(null) } }, 'Annuler'),
          h('button', { class: 'btn principal', type: 'button', onclick: function () { fin(t.value.trim()) } }, 'Marquer perdu'))))
      document.body.append(d); d.showModal(); t.focus()
    })
  }
  function deplacer(c, vers) {
    var UIk = UI()
    if (vers === 'perdu') return demanderRaison().then(function (r) { return r === null ? null : changerEtape(c, 'perdu', r) })
    if (vers === 'gagne') return UIk.confirmer({ titre: 'Affaire gagnée', texte: nomC(c) + ' devient un client actif. Vous pourrez ensuite créer son projet et son devis.', bouton: 'Confirmer' }).then(function (ok) { return ok ? changerEtape(c, 'gagne') : null })
    return changerEtape(c, vers)
  }

  /* ---------- indicateurs commerciaux ---------- */
  function stats(cl, debut, fin) {
    var dansP = function (d) { return d && d.slice(0, 10) >= debut && d.slice(0, 10) <= fin }
    var ouvertes = cl.filter(ouverte)
    var g = cl.filter(function (c) { return etape(c) === 'gagne' && dansP(c.gagneLe) }).length
    var p = cl.filter(function (c) { return etape(c) === 'perdu' && dansP(c.perduLe) }).length
    return {
      ouvertes: ouvertes.length,
      valeur: ouvertes.reduce(function (a, c) { return a + budget(c) }, 0),
      ponderee: ouvertes.reduce(function (a, c) { return a + budget(c) * proba(c) / 100 }, 0),
      gagnes: g, perdus: p, conversion: g + p ? 100 * g / (g + p) : null,
      nouveaux: cl.filter(function (c) { return dansP(c.creeLe) && (c.etape || c.statut === 'prospect') }).length,
      relances: cl.filter(relanceDue).length,
      inactifs: cl.filter(sansActivite).length,
    }
  }

  /* =====================================================================================
     PIPELINE (vue « pipeline ») : colonnes par étape, glisser-déposer + menu pour clavier et mobile
     ===================================================================================== */
  function pipeline() {
    var S = K().S, main = K().main, U = UI(), h = U.h, fmt = U.fmt
    main.appendChild(U.entete('Pipeline commercial', 'Vos prospects de la prise de contact à la signature. Glissez une carte pour changer d’étape.', null,
      h('button', { class: 'btn principal', type: 'button', onclick: nouveau }, U.icone('user-plus', 16), 'Nouveau prospect')))
    var kpi = h('div', { class: 'grille kpi' }), barre = h('div', { class: 'crm-filtres' }), board = h('div', { class: 'crm-board', role: 'list', 'aria-label': 'Étapes du pipeline' })
    main.append(kpi, barre, board)
    var q = h('input', { type: 'search', placeholder: 'Nom, société, e-mail…', 'aria-label': 'Rechercher un prospect' })
    var fp = h('select', { 'aria-label': 'Priorité' }, h('option', { value: '' }, 'Toutes priorités'), PRIORITES.map(function (p) { return h('option', { value: p[0] }, p[1]) }))
    var fo = h('select', { 'aria-label': 'Origine' }, h('option', { value: '' }, 'Toutes origines'), ORIGINES.map(function (o) { return h('option', { value: o }, o) }))
    var fa = h('label', { class: 'crm-chk' }, h('input', { type: 'checkbox' }), 'À relancer ou sans activité')
    var vueFermees = h('label', { class: 'crm-chk' }, h('input', { type: 'checkbox' }), 'Afficher gagnés et perdus')
    barre.append(q, fp, fo, fa, vueFermees)

    function nouveau() {
      S.put('clients', { nom: '', societe: '', email: '', tel: '', adresse: '', notes: '', statut: 'prospect', etape: 'nouveau', priorite: 'normale', origine: '', interactions: [] })
        .then(function (c) { K().go('clients/' + c.id) })
    }

    var cl = []
    function charger() { return S.list('clients').then(function (l) { cl = l; dessiner() }) }
    function dessiner() {
      var t = today(), y = new Date(); y.setFullYear(y.getFullYear() - 1)
      var st = stats(cl, y.toISOString().slice(0, 10), t)
      kpi.textContent = ''
      kpi.append(
        U.tuile('Affaires en cours', fmt.nombre(st.ouvertes), st.valeur ? fmt.euros(st.valeur) + ' HT estimés' : 'aucun budget renseigné', false, { icone: 'briefcase' }),
        U.tuile('Valeur pondérée', fmt.euros(st.ponderee), 'budget × probabilité de signature', false, { icone: 'gauge' }),
        U.tuile('Taux de conversion', st.conversion == null ? '–' : fmt.pct(st.conversion), st.gagnes + st.perdus ? st.gagnes + ' gagnée(s), ' + st.perdus + ' perdue(s) sur 12 mois' : 'aucune affaire conclue sur 12 mois', false, { icone: 'percent', ton: st.conversion == null ? '' : st.conversion >= 30 ? 'bon' : 'attention' }),
        U.tuile('À relancer', fmt.nombre(st.relances + st.inactifs), st.relances + ' relance(s) due(s) · ' + st.inactifs + ' sans activité depuis ' + JOURS_INACTIF + ' j', st.relances + st.inactifs > 0, { icone: 'bell' }))
      var s = q.value.trim().toLowerCase(), avecFermees = vueFermees.querySelector('input').checked, urgent = fa.querySelector('input').checked
      var vis = cl.filter(function (c) {
        if (!avecFermees && !ouverte(c)) return false
        if (fp.value && (c.priorite || 'normale') !== fp.value) return false
        if (fo.value && c.origine !== fo.value) return false
        if (urgent && !(relanceDue(c) || sansActivite(c))) return false
        return !s || [c.nom, c.societe, c.email].join(' ').toLowerCase().indexOf(s) >= 0
      })
      board.textContent = ''
      ETAPES.filter(function (e) { return avecFermees || OUVERTES.indexOf(e.id) >= 0 }).forEach(function (e) {
        var items = vis.filter(function (c) { return etape(c) === e.id }).sort(function (a, b) { return (b.priorite === 'haute') - (a.priorite === 'haute') || budget(b) - budget(a) })
        var somme = items.reduce(function (a, c) { return a + budget(c) }, 0)
        var col = h('section', { class: 'crm-col crm-' + e.id, role: 'listitem', 'aria-label': e.l + ' : ' + items.length + ' prospect(s)', 'data-etape': e.id },
          h('header', {}, h('span', { class: 'crm-col-t' }, U.icone(e.ic, 15), e.l), h('b', {}, String(items.length))),
          h('div', { class: 'crm-col-s discret' }, somme ? fmt.euros(somme) + ' HT' : '—'))
        var zone = h('div', { class: 'crm-cartes' })
        col.append(zone)
        // dépôt d'une carte
        col.addEventListener('dragover', function (ev) { ev.preventDefault(); col.classList.add('survol') })
        col.addEventListener('dragleave', function () { col.classList.remove('survol') })
        col.addEventListener('drop', function (ev) {
          ev.preventDefault(); col.classList.remove('survol')
          var c = cl.filter(function (x) { return x.id === ev.dataTransfer.getData('text/plain') })[0]
          if (c) Promise.resolve(deplacer(c, e.id)).then(function (r) { if (r) U.toast(nomC(c) + ' : ' + e.l, 'bon'); charger() }).catch(function (er) { U.toast('Impossible : ' + er.message, 'erreur') })
        })
        if (!items.length) zone.append(h('p', { class: 'crm-vide' }, 'Déposez une carte ici'))
        items.forEach(function (c) { zone.append(carte(c)) })
        board.append(col)
      })
      if (!cl.length) board.append(U.etatVide('Aucun prospect pour l’instant. Créez le premier avec « Nouveau prospect ».', 'user-plus'))
    }
    function carte(c) {
      var e = etape(c), b = budget(c), da = derniereActivite(c), inact = sansActivite(c), rel = relanceDue(c)
      var pr = PRIORITES.filter(function (p) { return p[0] === (c.priorite || 'normale') })[0]
      var sel = h('select', { class: 'crm-sel', 'aria-label': 'Déplacer ' + nomC(c) + ' vers une autre étape' }, ETAPES.map(function (x) { return h('option', { value: x.id, selected: x.id === e }, x.l) }))
      sel.addEventListener('change', function () {
        Promise.resolve(deplacer(c, sel.value)).then(function (r) { if (r) U.toast(nomC(c) + ' : ' + etapeInfo(sel.value).l, 'bon'); charger() }).catch(function (er) { UI().toast('Impossible : ' + er.message, 'erreur') })
      })
      var U2 = U
      var art = h('article', { class: 'crm-carte' + (inact || rel ? ' alerte' : ''), draggable: 'true' },
        h('div', { class: 'crm-carte-t' }, h('a', { href: '#clients/' + c.id }, nomC(c)), pr && pr[0] !== 'normale' ? U2.badge(pr[1], pr[2]) : null),
        h('div', { class: 'crm-carte-m' }, h('span', {}, b ? U2.fmt.euros(b) + ' HT' : 'Budget ?'), h('span', { title: 'Probabilité de signature' }, proba(c) + ' %')),
        c.origine ? h('small', { class: 'discret' }, c.origine) : null,
        rel ? h('small', { class: 'crm-alerte' }, U2.icone('bell', 12), 'Relance prévue le ' + U2.fmt.date(c.rappel)) : c.rappel && ouverte(c) ? h('small', { class: 'discret' }, 'Relance le ' + U2.fmt.date(c.rappel)) : null,
        inact ? h('small', { class: 'crm-alerte' }, U2.icone('clock', 12), 'Sans activité depuis ' + jours(da, today()) + ' j') : h('small', { class: 'discret' }, 'Dernière activité ' + U2.fmt.date(da)),
        e === 'perdu' && c.raisonPerte ? h('small', { class: 'discret' }, 'Perdu : ' + c.raisonPerte) : null,
        sel)
      art.addEventListener('dragstart', function (ev) { ev.dataTransfer.setData('text/plain', c.id); ev.dataTransfer.effectAllowed = 'move'; art.classList.add('glisse') })
      art.addEventListener('dragend', function () { art.classList.remove('glisse') })
      return art
    }
    ;[q, fp, fo, fa.querySelector('input'), vueFermees.querySelector('input')].forEach(function (x) { x.addEventListener('input', dessiner); x.addEventListener('change', dessiner) })
    charger()
  }

  /* =====================================================================================
     FICHE CLIENT / PROSPECT : bloc « Suivi commercial » + historique des échanges
     ===================================================================================== */
  function crmBloc(c, box) {
    var S = K().S, U = UI(), h = U.h, fmt = U.fmt
    var e = etape(c)
    var fe = h('select', {}, ETAPES.map(function (x) { return h('option', { value: x.id, selected: x.id === e }, x.l) }))
    var fpb = h('input', { type: 'number', min: '0', max: '100', step: '5', value: c.probaPerso ? String(proba(c)) : '', placeholder: proba(c) + ' (selon l’étape)' })
    var fb = h('input', { type: 'number', min: '0', step: '100', value: c.budget ? String(c.budget) : '', placeholder: 'ex. 3 500' })
    var fo = h('select', {}, h('option', { value: '' }, '— Non renseignée —'), ORIGINES.map(function (o) { return h('option', { value: o, selected: o === c.origine }, o) }))
    var fpr = h('select', {}, PRIORITES.map(function (p) { return h('option', { value: p[0], selected: p[0] === (c.priorite || 'normale') }, p[1]) }))
    var services = h('div', { class: 'crm-services' })
    var msg = h('p', { class: 'msg', role: 'status' })
    S.catalogue().then(function (cat) {
      var deja = Array.isArray(c.services) ? c.services : []
      cat.forEach(function (g) {
        var nom = g.nom.replace(/\s*\(.*\)$/, '')
        services.append(h('label', { class: 'crm-chk' }, h('input', { type: 'checkbox', value: nom, checked: deja.indexOf(nom) >= 0 }), nom))
      })
    })
    var champ = function (l, i) { return h('label', {}, l, i) }
    var pan = h('section', { class: 'carte crm-fiche' },
      h('header', {}, h('h2', {}, 'Suivi commercial'), h('span', { class: 'discret' }, etapeInfo(e).l + ' · ' + proba(c) + ' % · dernière activité ' + fmt.date(derniereActivite(c)))),
      h('div', { class: 'grid2' }, champ('Étape du pipeline', fe), champ('Priorité', fpr), champ('Budget estimé (€ HT)', fb), champ('Probabilité de signature (%)', fpb), champ('Origine du contact', fo),
        h('div', { class: 'discret crm-note' }, 'La prochaine relance se règle avec le champ « Rappel » de la fiche ; les notes privées avec « Notes ».')),
      h('fieldset', { class: 'crm-fs' }, h('legend', {}, 'Services recherchés'), services),
      h('div', { class: 'cta' },
        h('button', { class: 'btn principal', type: 'button', onclick: function () {
          var choix = [].slice.call(services.querySelectorAll('input:checked')).map(function (i) { return i.value })
          c.budget = fb.value === '' ? '' : Math.max(0, +fb.value); c.origine = fo.value; c.priorite = fpr.value; c.services = choix
          if (fpb.value === '') { delete c.proba; delete c.probaPerso } else { c.proba = Math.max(0, Math.min(100, +fpb.value)); c.probaPerso = true }
          var suite = fe.value !== etape(c) ? deplacer(c, fe.value) : S.put('clients', c)
          Promise.resolve(suite).then(function (r) { if (r === null) { fe.value = etape(c); return } msg.textContent = 'Suivi commercial enregistré.'; U.toast('Suivi commercial enregistré.', 'bon') }).catch(function (er) { msg.textContent = 'Impossible : ' + er.message })
        } }, 'Enregistrer le suivi'),
        ouverte(c) ? h('button', { class: 'btn', type: 'button', onclick: function () { deplacer(c, 'gagne').then(function (r) { if (r) K().route() }) } }, U.icone('circle-check', 15), 'Affaire gagnée') : null,
        ouverte(c) ? h('button', { class: 'btn', type: 'button', onclick: function () { deplacer(c, 'perdu').then(function (r) { if (r) K().route() }) } }, U.icone('circle-x', 15), 'Affaire perdue') : null),
      msg)

    // historique des échanges
    var liste = h('ol', { class: 'crm-histo' }), compte = h('span', { class: 'discret' })
    function dessinerHisto() {
      liste.textContent = ''
      compte.textContent = interactions(c).length + ' échange(s)'
      var l = interactions(c).slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || '') })
      if (!l.length) { liste.append(h('li', { class: 'discret' }, 'Aucun échange enregistré. Notez chaque appel, e-mail ou rendez-vous : la relance et la détection des prospects inactifs s’appuient dessus.')); return }
      l.forEach(function (i) {
        var t = TYPES.filter(function (x) { return x[0] === i.type })[0] || TYPES[4]
        liste.append(h('li', { class: 'crm-histo-' + t[0] }, h('span', { class: 'crm-histo-ic', 'aria-hidden': 'true' }, U.icone(t[2], 14)),
          h('div', {}, h('b', {}, t[1]), h('span', { class: 'discret' }, ' · ' + fmt.date(i.date) + (i.auteur ? ' · ' + i.auteur.split('@')[0] : '')), i.texte ? h('p', {}, i.texte) : null)))
      })
    }
    var ty = h('select', { 'aria-label': 'Type d’échange' }, TYPES.filter(function (x) { return x[0] !== 'etape' }).map(function (x) { return h('option', { value: x[0] }, x[1]) }))
    var dt = h('input', { type: 'date', value: today(), max: today(), 'aria-label': 'Date' })
    var tx = h('textarea', { rows: '2', maxlength: '2000', placeholder: 'Ce qui s’est dit, ce qui a été promis…', 'aria-label': 'Résumé de l’échange' })
    var rel = h('input', { type: 'date', 'aria-label': 'Prochaine relance' })
    var histo = h('section', { class: 'carte crm-fiche' }, h('header', {}, h('h2', {}, 'Historique des échanges'), compte),
      h('div', { class: 'crm-ajout' }, h('label', {}, 'Type', ty), h('label', {}, 'Date', dt), h('label', { class: 'crm-ajout-tx' }, 'Résumé', tx), h('label', {}, 'Programmer une relance', rel),
        h('button', { class: 'btn principal', type: 'button', onclick: function () {
          if (!tx.value.trim()) { U.toast('Écrivez un résumé de l’échange.', 'erreur'); tx.focus(); return }
          c.interactions = interactions(c).concat([{ id: 'i' + Date.now().toString(36), date: dt.value || today(), type: ty.value, texte: tx.value.trim(), auteur: S.auth && S.auth.email ? S.auth.email() : '' }])
          if (rel.value) c.rappel = rel.value
          if (etape(c) === 'nouveau' && ty.value !== 'note') { c.etape = 'contact'; if (!c.probaPerso) delete c.proba }   // premier échange réel : premier contact
          S.put('clients', c).then(function () { tx.value = ''; rel.value = ''; U.toast('Échange ajouté.', 'bon'); dessinerHisto() }).catch(function (er) { U.toast('Impossible : ' + er.message, 'erreur') })
        } }, U.icone('plus', 15), 'Ajouter')),
      liste)
    dessinerHisto()
    box.append(pan, histo)
  }

  /* =====================================================================================
     COCKPIT (vue « cockpit ») : période, comparaison, indicateurs, graphiques, flux d'activité, exports
     ===================================================================================== */
  function bornes(code, de, a) {
    var d = new Date(), y = d.getFullYear(), m = d.getMonth(), iso = function (x) { return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2) }
    if (code === 'mois') return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))]
    if (code === 'mois-1') return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))]
    if (code === 'trimestre') { var q = Math.floor(m / 3) * 3; return [iso(new Date(y, q, 1)), iso(new Date(y, q + 3, 0))] }
    if (code === 'annee') return [y + '-01-01', y + '-12-31']
    if (code === '12m') return [iso(new Date(y, m - 11, 1)), iso(new Date(y, m + 1, 0))]
    return [de || iso(new Date(y, m, 1)), a || iso(d)]
  }
  function comparaison(p, mode) {
    var d0 = new Date(p[0] + 'T12:00:00'), d1 = new Date(p[1] + 'T12:00:00'), iso = function (x) { return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2) }   // date locale (toISOString décalerait d'un jour)
    if (mode === 'n-1') { d0.setFullYear(d0.getFullYear() - 1); d1.setFullYear(d1.getFullYear() - 1); return [iso(d0), iso(d1)] }
    var n = Math.round((d1 - d0) / 864e5) + 1
    var f = new Date(d0); f.setDate(f.getDate() - 1); var s = new Date(f); s.setDate(s.getDate() - n + 1)
    // période précédente d'un mois entier = le mois d'avant, entier
    if (d0.getDate() === 1 && new Date(d1.getFullYear(), d1.getMonth() + 1, 0).getDate() === d1.getDate()) {
      var mois = (d1.getFullYear() - d0.getFullYear()) * 12 + d1.getMonth() - d0.getMonth() + 1
      s = new Date(d0.getFullYear(), d0.getMonth() - mois, 1); f = new Date(d0.getFullYear(), d0.getMonth(), 0)
    }
    return [iso(s), iso(f)]
  }
  function plusJours(iso, n) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) }
  // dépenses d'une période : chaque occurrence des dépenses récurrentes compte
  function depensesPeriode(dep, p) {
    var total = 0
    ;(dep || []).forEach(function (e) {
      var pas = { mensuelle: 1, trimestrielle: 3, annuelle: 12 }[e.recurrence], d = new Date(e.date_depense + 'T12:00:00'), fin = e.fin && e.fin < p[1] ? e.fin : p[1], n = 0
      if (!pas) { if (e.date_depense >= p[0] && e.date_depense <= p[1]) total += +e.montant_ht || 0; return }
      while (n < 400) { var iso = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); if (iso > fin) break; if (iso >= p[0]) total += +e.montant_ht || 0; d.setMonth(d.getMonth() + pas); n++ }
    })
    return total
  }
  function moisEntre(p) {
    var out = [], d = new Date(p[0].slice(0, 7) + '-01T12:00:00'), fin = p[1].slice(0, 7)
    while (d.toISOString().slice(0, 7) <= fin && out.length < 36) { out.push(d.toISOString().slice(0, 7)); d.setMonth(d.getMonth() + 1) }
    return out
  }

  function cockpit() {
    var S = K().S, main = K().main, U = UI(), h = U.h, fmt = U.fmt, G = U.G
    var etat = { periode: '12m', comp: 'prec', de: '', a: '' }
    try { var sv = JSON.parse(sessionStorage.getItem('creatigo.cockpit') || 'null'); if (sv) etat = sv } catch (x) {}
    var selP = h('select', { 'aria-label': 'Période' }, [['mois', 'Ce mois-ci'], ['mois-1', 'Le mois dernier'], ['trimestre', 'Ce trimestre'], ['annee', 'Cette année'], ['12m', '12 derniers mois'], ['perso', 'Personnalisée']].map(function (x) { return h('option', { value: x[0], selected: x[0] === etat.periode }, x[1]) }))
    var selC = h('select', { 'aria-label': 'Comparer avec' }, [['prec', 'la période précédente'], ['n-1', 'la même période l’an dernier']].map(function (x) { return h('option', { value: x[0], selected: x[0] === etat.comp }, x[1]) }))
    var de = h('input', { type: 'date', value: etat.de, 'aria-label': 'Du' }), a = h('input', { type: 'date', value: etat.a, 'aria-label': 'Au' })
    var perso = h('span', { class: 'ck-perso' }, 'du', de, 'au', a)
    var zone = h('div', { class: 'ck-zone' })
    var data = null, role = null, minuterie = null
    main.appendChild(U.entete('Cockpit de l’agence', 'Le pilotage sur la période choisie, comparé à une autre période. Chiffres tirés de vos données réelles.', null,
      h('button', { class: 'btn', type: 'button', onclick: exportCsv }, U.icone('download', 15), 'Exporter (CSV)'),
      h('button', { class: 'btn', type: 'button', onclick: function () { journaliser(); window.print() } }, U.icone('file-down', 15), 'PDF / Imprimer')))
    main.appendChild(h('div', { class: 'ck-barre noprint' }, h('label', {}, 'Période', selP), perso, h('label', {}, 'Comparer avec', selC)))
    main.appendChild(zone)
    function majPerso() { perso.hidden = selP.value !== 'perso' }
    majPerso()
    ;[selP, selC, de, a].forEach(function (x) { x.addEventListener('change', function () { etat = { periode: selP.value, comp: selC.value, de: de.value, a: a.value }; try { sessionStorage.setItem('creatigo.cockpit', JSON.stringify(etat)) } catch (z) {} majPerso(); dessiner() }) })
    function journaliser() { if (S.rpc && S.sb && S.sb.on()) S.rpc('log_event', { kind: 'export', detail: { vue: 'cockpit' } }).catch(function () {}) }

    var enLigne = S.sb && S.sb.on()
    Promise.all([S.list('clients'), S.devisList(), S.list('factures'), S.list('projets'), S.catalogue(), S.auth && S.auth.role ? S.auth.role() : Promise.resolve('super_admin'),
      enLigne ? S.sb.get('expenses?deleted_at=is.null&select=date_depense,montant_ht,recurrence,fin').catch(function () { return null }) : Promise.resolve(null),
      enLigne ? S.sb.get('contracts?deleted_at=is.null&statut=eq.signe&select=id,ref,date_fin').catch(function () { return null }) : Promise.resolve(null)]).then(function (r) {
      data = { cl: r[0], dv: r[1], fa: r[2].filter(function (f) { return f.statut !== 'brouillon' }), pr: r[3], cat: r[4], dep: r[6], ctr: r[7] }; role = r[5]
      dessiner(); flux()
      minuterie = setInterval(function () { if (!document.body.contains(zone)) { clearInterval(minuterie); return } flux() }, 60000)
    })

    function ht(f) { var t = S.calc(f); return t.uniqueHT + t.mensuelHT }
    function calc(p) {
      var dans = function (d) { return d && d.slice(0, 10) >= p[0] && d.slice(0, 10) <= p[1] }
      var fa = data.fa.filter(function (f) { return dans(f.date) })
      var st = stats(data.cl, p[0], p[1])
      return {
        ca: fa.reduce(function (s, f) { return s + ht(f) }, 0),
        encaisse: fa.filter(function (f) { return f.statut === 'payee' }).reduce(function (s, f) { return s + ht(f) }, 0),
        nbFactures: fa.length,
        devisEnvoyes: data.dv.filter(function (d) { return dans(d.creeLe) && d.statut !== 'nouveau' }).length,
        devisAcceptes: data.dv.filter(function (d) { return dans(d.creeLe) && d.statut === 'accepte' }).length,
        nouveaux: st.nouveaux, gagnes: st.gagnes, perdus: st.perdus, conversion: st.conversion,
        parMois: moisEntre(p).map(function (m) { return { m: m, v: fa.filter(function (f) { return (f.date || '').slice(0, 7) === m }).reduce(function (s, f) { return s + ht(f) }, 0) } }),
        factures: fa,
      }
    }
    function variation(x, y) {
      if (y == null || x == null) return null
      if (!y) return x ? U.delta('nouveau', 'haut') : null
      var v = 100 * (x - y) / Math.abs(y)
      return U.delta(fmt.pctSigne(v), v > 0.5 ? 'haut' : v < -0.5 ? 'bas' : 'neutre')
    }

    function dessiner() {
      if (!data) return
      var P = bornes(selP.value, de.value, a.value), C = comparaison(P, selC.value), t = today()
      var cur = calc(P), prv = calc(C), direction = role === 'super_admin' || role === 'admin'
      var cl = data.cl, pr = data.pr
      zone.textContent = ''
      zone.append(h('p', { class: 'discret ck-libelle' }, 'Du ' + fmt.date(P[0]) + ' au ' + fmt.date(P[1]) + ', comparé au ' + fmt.date(C[0]) + ' – ' + fmt.date(C[1]) + '.'))

      // ---- indicateurs
      var impayees = data.fa.filter(function (f) { return f.statut === 'envoyee' || f.statut === 'retard' })
      var duTTC = impayees.reduce(function (s, f) { return s + ht(f) * (1 + S.TVA) }, 0)
      var retard = impayees.filter(function (f) { return f.statut === 'retard' || (f.echeance && f.echeance < t) })
      var dEnAttente = data.dv.filter(function (d) { return d.statut === 'nouveau' || d.statut === 'envoye' })
      var crm = stats(cl, P[0], P[1])
      var prev = crm.ponderee + dEnAttente.reduce(function (s, d) { return s + S.calc(d).uniqueHT }, 0) * 0.5
      var enCours = pr.filter(function (p) { return p.statut !== 'livre' }), livres = pr.filter(function (p) { return p.statut === 'livre' })
      var enRetard = enCours.filter(function (p) { return p.echeance && p.echeance < t })
      var finance = direction ? [
        U.tuile('Chiffre d’affaires facturé', fmt.euros(cur.ca), 'HT · ' + fmt.pluriel(cur.nbFactures, 'facture'), false, { icone: 'euro', delta: variation(cur.ca, prv.ca) }),
        U.tuile('Encaissé', fmt.euros(cur.encaisse), 'HT, factures payées de la période', false, { icone: 'wallet', delta: variation(cur.encaisse, prv.encaisse) }),
        U.tuile('À encaisser', fmt.euros(duTTC), retard.length ? fmt.pluriel(retard.length, 'facture') + ' en retard' : 'TTC · aucune en retard', retard.length > 0, { icone: 'receipt-text' }),
        U.tuile('Prévisionnel', fmt.euros(prev), 'estimation : pipeline pondéré + moitié des devis en attente', false, { icone: 'trending-up' }),
      ] : [U.tuile('Finances', 'Direction', 'chiffre d’affaires et encaissements réservés à la direction', false, { icone: 'lock' })]
      zone.append(h('div', { class: 'grille kpi' }, finance.concat([
        U.tuile('Clients actifs', fmt.nombre(cl.filter(function (c) { return c.statut === 'actif' }).length), fmt.pluriel(cl.filter(ouverte).length, 'prospect') + ' en cours', false, { icone: 'users' }),
        U.tuile('Nouveaux prospects', fmt.nombre(cur.nouveaux), 'créés sur la période', false, { icone: 'user-plus', delta: variation(cur.nouveaux, prv.nouveaux) }),
        U.tuile('Conversion', cur.conversion == null ? '–' : fmt.pct(cur.conversion), cur.gagnes + cur.perdus ? cur.gagnes + ' gagnée(s) · ' + cur.perdus + ' perdue(s)' : 'aucune affaire conclue', false, { icone: 'percent', delta: cur.conversion != null && prv.conversion != null ? variation(cur.conversion, prv.conversion) : null }),
        U.tuile('Projets', fmt.nombre(enCours.length) + ' en cours', livres.length + ' livré(s) · ' + enRetard.length + ' en retard', enRetard.length > 0, { icone: 'rocket' }),
        U.tuile('Devis en attente', fmt.nombre(dEnAttente.length), dEnAttente.length ? fmt.euros(dEnAttente.reduce(function (s, d) { return s + S.calc(d).uniqueHT }, 0)) + ' HT en jeu' : 'aucun', false, { icone: 'file-signature' }),
        U.tuile('Factures impayées', fmt.nombre(impayees.length), direction ? fmt.euros(duTTC) + ' TTC' : '', impayees.length > 0 && retard.length > 0, { icone: 'circle-alert' }),
        direction && data.dep ? (function () {
          var dP = depensesPeriode(data.dep, P), dC = depensesPeriode(data.dep, C), m = cur.ca - dP
          return U.tuile('Marge estimée', fmt.euros(m), 'CA HT − dépenses HT (' + fmt.euros(dP) + ') · estimation', m < 0, { icone: 'calculator', ton: m >= 0 ? 'bon' : 'attention', delta: variation(m, prv.ca - dC) })
        })() : U.tuile('Dépenses et marge', direction ? 'Non disponibles' : 'Direction', direction ? 'connectez l’administration à la base' : 'réservées à la direction', false, { icone: 'calculator' }),
        direction && data.ctr ? (function () {
          var bientot = data.ctr.filter(function (k) { return k.date_fin && k.date_fin >= t && k.date_fin <= plusJours(t, 30) })
          return U.tuile('Contrats à échéance', fmt.nombre(bientot.length), bientot.length ? 'dans les 30 jours' : fmt.pluriel(data.ctr.length, 'contrat signé') + ', aucun à échéance', bientot.length > 0, { icone: 'file-signature' })
        })() : U.tuile('Contrats à échéance', direction ? 'Non disponibles' : 'Direction', direction ? 'connectez l’administration à la base' : 'réservés à la direction', false, { icone: 'file-signature' }),
      ])))

      // ---- graphiques
      var ligneG = []
      if (direction) {
        var mC = cur.parMois, mP = prv.parMois
        var serie = mC.map(function (m, i) { return { libelle: new Date(m.m + '-15').toLocaleDateString('fr-FR', { month: 'short', year: mC.length > 12 ? '2-digit' : undefined }).replace('.', ''), cur: m.v, prv: mP[i] ? mP[i].v : 0 } })
        ligneG.push(U.carte('Chiffre d’affaires facturé', 'HT, par mois, comparé à l’autre période',
          G.colonnesGroupees(serie, [{ cle: 'cur', libelle: 'Période choisie', couleur: 'var(--serie-1)' }, { cle: 'prv', libelle: 'Comparaison', couleur: 'var(--serie-neutre)' }], { format: function (v) { return Math.round(v / 1000) + ' k€' }, description: 'Chiffre d’affaires facturé par mois, période choisie et période de comparaison' })))
        // revenus par prestation (familles du catalogue)
        var fam = {}; data.cat.forEach(function (g) { g.items.forEach(function (it) { fam[it.id] = g.nom.replace(/\s*\(.*\)$/, '') }) })
        var parF = {}
        cur.factures.forEach(function (f) { var r = Math.min(Math.max(+f.remise || 0, 0), 100) / 100; (f.lignes || []).forEach(function (l) { var k = fam[l.itemId] || 'Autres prestations'; parF[k] = (parF[k] || 0) + (+l.prix || 0) * (+l.qty || 0) * (1 - r) }) })
        var lf = Object.keys(parF).map(function (k) { return { libelle: k, valeur: parF[k] } }).sort(function (x, y) { return y.valeur - x.valeur })
        ligneG.push(U.carte('Revenus par prestation', 'factures de la période, HT', lf.length ? G.barres(lf, { format: fmt.euros, description: 'Revenus par prestation' }) : U.etatVide('Aucune facture sur la période.', 'chart-column')))
      }
      if (ligneG.length) zone.append(h('div', { class: 'rangee r21' }, ligneG))

      // pipeline (entonnoir) + clients par statut + nouveaux prospects par mois
      var ent = OUVERTES.map(function (id) { var e = etapeInfo(id); var n = cl.filter(function (c) { return OUVERTES.indexOf(etape(c)) >= OUVERTES.indexOf(id) || etape(c) === 'gagne' }).length; return { libelle: e.l, valeur: n, ic: e.ic } })
      ent.push({ libelle: 'Gagné', valeur: cl.filter(function (c) { return etape(c) === 'gagne' }).length, ic: 'circle-check' })
      var parts = [['prospect', 'Prospects'], ['actif', 'Clients actifs'], ['inactif', 'Inactifs']].map(function (s) { return { libelle: s[1], nombre: cl.filter(function (c) { return (c.statut || 'prospect') === s[0] }).length } })
      var coul = { Prospects: 'var(--serie-2)', 'Clients actifs': 'var(--serie-1)', Inactifs: 'var(--serie-neutre)' }
      var mois12 = moisEntre(bornes('12m')).map(function (m) { return { libelle: new Date(m + '-15').toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''), valeur: cl.filter(function (c) { return (c.creeLe || '').slice(0, 7) === m && (c.etape || c.statut === 'prospect') }).length } })
      zone.append(h('div', { class: 'rangee r11' },
        U.carte('Pipeline commercial', 'chaque étape compte les affaires qui l’ont atteinte', cl.length ? U.entonnoir(ent, { description: 'Pipeline commercial par étape' }) : U.etatVide('Aucun prospect.', 'users')),
        U.carte('Clients par statut', fmt.pluriel(cl.length, 'fiche'), cl.length ? G.anneau(parts, coul, { total: cl.length, libelleTotal: 'fiches', description: 'Clients par statut' }) : U.etatVide('Aucune fiche.', 'users'))))
      zone.append(h('div', { class: 'rangee r21' },
        U.carte('Nouveaux prospects', '12 derniers mois', G.barresFines(mois12, { format: fmt.nombre, description: 'Nouveaux prospects par mois' })),
        fluxCarte))
      if (direction) {
        var top = {}; cur.factures.forEach(function (f) { var k = f.clientId || ((f.client || {}).societe || (f.client || {}).nom || 'Sans client'); top[k] = (top[k] || 0) + ht(f) })
        var nomDe = function (k) { var c = cl.filter(function (x) { return x.id === k })[0]; return c ? nomC(c) : k }
        var lignes = Object.keys(top).sort(function (x, y) { return top[y] - top[x] }).slice(0, 8).map(function (k) { return [nomDe(k), fmt.euros(top[k])] })
        zone.append(U.carte('Meilleurs clients de la période', 'chiffre d’affaires facturé HT', U.tableau([{ titre: 'Client' }, { titre: 'CA HT', num: true }], lignes, { vide: 'Aucune facture sur la période.', legende: 'Meilleurs clients' })))
      }
      zone.append(h('p', { class: 'discret ck-note' }, 'Les montants sont calculés à partir des factures et des devis enregistrés : ce ne sont pas des comptes officiels. Le prévisionnel est une estimation.'))
      flux()
    }

    // ---- flux d'activité (journal de la base pour la direction, notifications pour l'équipe), actualisé chaque minute
    var fluxListe = h('ol', { class: 'ck-flux' })
    var fluxCarte = U.carte('Activité récente', 'mise à jour chaque minute', fluxListe)
    var NOMS = { clients: 'Fiche', quotes: 'Devis', invoices: 'Facture', projects: 'Projet', appointments: 'Rendez-vous', portal_requests: 'Demande client', portal_updates: 'Point de projet', portal_accounts: 'Accès espace client', staff_members: 'Équipe', settings: 'Réglages', documents: 'Document', session: 'Session' }
    function phrase(x) {
      var a = x.after || {}, b = x.before || {}, d = a.data || {}, db = b.data || {}
      var nom = d.ref || d.titre || (d.societe || d.nom) || (d.client && (d.client.societe || d.client.nom)) || a.sujet || a.titre || ''
      if (x.table_name === 'clients' && x.action === 'insert') return [d.statut === 'actif' ? 'Nouveau client' : 'Nouveau prospect', nom, 'user-plus']
      if (x.table_name === 'clients' && d.etape !== db.etape && d.etape === 'gagne') return ['Affaire gagnée', nom, 'circle-check']
      if (x.table_name === 'clients' && d.etape !== db.etape && d.etape === 'perdu') return ['Affaire perdue', nom, 'circle-x']
      if (x.table_name === 'quotes' && x.action === 'insert') return [d.source === 'site' ? 'Demande de devis du site' : 'Nouveau devis', nom, 'file-text']
      if (x.table_name === 'quotes' && d.statut !== db.statut && d.statut === 'accepte') return ['Devis accepté', nom, 'file-signature']
      if (x.table_name === 'invoices' && d.statut !== db.statut && d.statut === 'payee') return ['Paiement reçu', nom, 'euro']
      if (x.table_name === 'invoices' && x.action === 'insert') return ['Facture créée', nom, 'receipt-text']
      if (x.table_name === 'projects' && d.statut !== db.statut && d.statut === 'livre') return ['Projet terminé', nom, 'rocket']
      if (x.table_name === 'projects' && x.action === 'insert') return ['Nouveau projet', nom, 'rocket']
      if (x.table_name === 'portal_requests' && x.action === 'insert') return ['Nouvelle demande client', a.sujet || '', 'mail']
      if (x.table_name === 'portal_updates' && x.action === 'insert') return [a.kind === 'livre' ? 'Livrable partagé' : 'Point de projet', a.titre || '', 'send']
      if (x.action === 'corbeille') return ['Mis à la corbeille', (NOMS[x.table_name] || '') + (nom ? ' · ' + nom : ''), 'trash-2']
      if (x.action === 'export') return ['Export des données', '', 'download']
      return null
    }
    function flux() {
      if (!(S.sb && S.sb.on())) { fluxListe.textContent = ''; fluxListe.append(h('li', { class: 'discret' }, 'Disponible quand l’administration est connectée à la base.')); return }
      var direction = role === 'super_admin' || role === 'admin'
      var req = direction ? S.sb.get('audit_log?select=at,actor_email,action,table_name,row_id,before,after&order=at.desc&limit=120') : Promise.resolve([])
      Promise.all([req, S.sb.get('notifications?audience=eq.staff&select=titre,lien,kind,created_at&order=created_at.desc&limit=20').catch(function () { return [] })]).then(function (r) {
        var ev = []
        r[0].forEach(function (x) { var p = phrase(x); if (p) ev.push({ quand: x.at, titre: p[0], detail: p[1], ic: p[2], qui: x.actor_email || 'Site public' }) })
        r[1].forEach(function (n) { if (/message/.test(n.kind) || n.kind === 'demande' || n.kind === 'contact' || n.kind === 'rdv') ev.push({ quand: n.created_at, titre: n.titre, detail: '', ic: 'message-circle', lien: n.lien }) })
        ev.sort(function (x, y) { return (y.quand || '').localeCompare(x.quand || '') })
        var vus = {}; ev = ev.filter(function (e) { var k = e.titre + e.detail + (e.quand || '').slice(0, 16); if (vus[k]) return false; vus[k] = 1; return true }).slice(0, 15)
        fluxListe.textContent = ''
        if (!ev.length) { fluxListe.append(h('li', { class: 'discret' }, 'Rien de nouveau pour le moment.')); return }
        ev.forEach(function (e) {
          fluxListe.append(h('li', {}, h('span', { class: 'ck-flux-ic', 'aria-hidden': 'true' }, U.icone(e.ic, 14)),
            h('div', {}, e.lien ? h('a', { href: e.lien }, e.titre) : h('b', {}, e.titre), e.detail ? h('span', {}, ' · ' + e.detail) : null,
              h('small', { class: 'discret' }, fmt.dateHeure(e.quand) + (e.qui ? ' · ' + e.qui.split('@')[0] : '')))))
        })
      }).catch(function () { fluxListe.textContent = ''; fluxListe.append(h('li', { class: 'discret' }, 'Activité indisponible pour le moment.')) })
    }

    // ---- export CSV (séparateur « ; », lisible par Excel en français)
    function exportCsv() {
      if (!data) return
      var P = bornes(selP.value, de.value, a.value), C = comparaison(P, selC.value), cur = calc(P), prv = calc(C), direction = role === 'super_admin' || role === 'admin'
      var q = function (v) { v = v == null ? '' : String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v }
      var n = function (v) { return v == null ? '' : String(Math.round(v * 100) / 100).replace('.', ',') }
      var L = [['Cockpit Creatigo'], ['Période', P[0] + ' au ' + P[1]], ['Comparaison', C[0] + ' au ' + C[1]], [], ['Indicateur', 'Période', 'Comparaison']]
      if (direction) L.push(['Chiffre d’affaires facturé HT', n(cur.ca), n(prv.ca)], ['Encaissé HT', n(cur.encaisse), n(prv.encaisse)])
      L.push(['Nouveaux prospects', cur.nouveaux, prv.nouveaux], ['Affaires gagnées', cur.gagnes, prv.gagnes], ['Affaires perdues', cur.perdus, prv.perdus], ['Taux de conversion %', n(cur.conversion), n(prv.conversion)], ['Devis envoyés', cur.devisEnvoyes, prv.devisEnvoyes], ['Devis acceptés', cur.devisAcceptes, prv.devisAcceptes])
      if (direction) { L.push([], ['Mois', 'CA HT période', 'CA HT comparaison']); cur.parMois.forEach(function (m, i) { L.push([m.m, n(m.v), n(prv.parMois[i] ? prv.parMois[i].v : 0)]) }) }
      L.push([], ['Pipeline', 'Fiche', 'Étape', 'Budget HT', 'Probabilité %', 'Origine', 'Priorité', 'Dernière activité', 'Prochaine relance'])
      data.cl.filter(function (c) { return c.etape || c.statut === 'prospect' }).forEach(function (c) { L.push(['', nomC(c), etapeInfo(etape(c)).l, n(budget(c)), proba(c), c.origine || '', lab(PRIORITES, c.priorite || 'normale'), derniereActivite(c), c.rappel || '']) })
      var csv = '﻿' + L.map(function (l) { return l.map(q).join(';') }).join('\r\n')
      var lien = document.createElement('a'); lien.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); lien.download = 'cockpit-creatigo-' + P[0] + '-' + P[1] + '.csv'
      document.body.append(lien); lien.click(); lien.remove(); setTimeout(function () { URL.revokeObjectURL(lien.href) }, 2000)
      journaliser(); U.toast('Export CSV téléchargé.', 'bon')
    }
  }

  /* ---------- « À traiter » : relances dues et prospects sans activité (cloche) ---------- */
  function alertesCrm(cl) {
    var out = []
    cl.forEach(function (c) {
      if (relanceDue(c)) out.push({ t: 'Relancer ' + nomC(c) + ' (prévu le ' + c.rappel.split('-').reverse().join('/') + ')', h: '#clients/' + c.id, warn: c.rappel < today() })
      else if (sansActivite(c)) out.push({ t: nomC(c) + ' : aucun échange depuis ' + jours(derniereActivite(c), today()) + ' jours', h: '#clients/' + c.id })
    })
    return out
  }

  window.AdminModules = window.AdminModules || {}
  window.AdminModules.pipeline = pipeline
  window.AdminModules.cockpit = cockpit
  window.AdminModules.crmBloc = crmBloc
  window.AdminModules.alertesCrm = alertesCrm
  window.AdminModules.CRM = { ETAPES: ETAPES, etape: etape, proba: proba, stats: stats, changerEtape: changerEtape, sansActivite: sansActivite, relanceDue: relanceDue, derniereActivite: derniereActivite, bornes: bornes, comparaison: comparaison }
})()
