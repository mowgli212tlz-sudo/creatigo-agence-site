/* Espace client (phase 5) : tableau de bord personnel, détail réel des étapes du projet, centre de support (tickets).
   Branché sur assets/portal.js (qui lui passe ses outils : h, UI, S, lire, route…). La sécurité est dans la base :
   le client ne lit que ses vues et ne change le statut d'une demande que par client_statut_demande.
   Tout texte affiché passe par textContent (UI.h). */
(function () {
  var CATS = [['technique', 'Problème technique', 'circle-alert'], ['modification', 'Modification du site', 'square-pen'], ['maintenance', 'Maintenance', 'settings'], ['facturation', 'Facturation', 'receipt-text'], ['seo', 'Référencement (SEO)', 'trending-up'], ['autre', 'Autre demande', 'message-circle']]
  var PRIOS = [['basse', 'Basse', 'neutre'], ['normale', 'Normale', ''], ['haute', 'Haute', 'attention'], ['urgente', 'Urgente', 'critique']]
  var STATUTS = { ouverte: ['Ouverte', 'info'], en_cours: ['En cours', 'attention'], attente_client: ['En attente de votre réponse', 'critique'], resolue: ['Résolue', 'bon'], terminee: ['Fermée', 'neutre'] }
  function lab(t, v) { var r = t.filter(function (x) { return x[0] === v })[0]; return r ? r[1] : v }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) }
  function date(iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—' }
  function quand(iso) { var d = new Date(iso); return d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  function eur(n) { return (+n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) }
  function sur(p) { return p.catch(function () { return [] }) }
  function msgErreur(er) { var m = String((er && er.message) || er); var x = /"message":"([^"]+)"/.exec(m); return x ? x[1] : 'Action impossible pour le moment. Réessayez.' }
  function badgeStatut(UI, s) { var x = STATUTS[s] || [s, '']; return UI.badge(x[0], x[1]) }

  /* =====================================================================================
     TABLEAU DE BORD PERSONNEL
     ===================================================================================== */
  function accueil(ctx) {
    var h = ctx.h, UI = ctx.UI, S = ctx.S, ic = ctx.ic
    return Promise.all([ctx.lire(true), sur(S.sb.get('notifications?audience=eq.client&select=*&order=created_at.desc&limit=30')), sur(S.sb.get('client_quotes?select=id,ref,statut,valable_jusqu,titre,unique_ht,acompte')),
      sur(S.sb.get('client_invoices?select=id,ref,statut,reste,echeance,type')), sur(S.sb.get('client_contracts?select=id,ref,titre,statut')), sur(S.sb.get('client_project_steps?select=*')),
      sur(S.sb.get('portal_messages?author=eq.agence&select=id,request_id,body,created_at&order=created_at.desc&limit=5'))]).then(function (r) {
      var d = r[0], notifs = r[1], devis = r[2], factures = r[3], contrats = r[4], etapes = r[5], reponses = r[6]
      var t = today(), acc = ctx.acc()
      var projets = d.projets
      var attendus = d.nouvelles.filter(function (u) { return u.kind === 'attendu' && !u.fait })
      var livres = d.nouvelles.filter(function (u) { return u.kind === 'livre' })
      var aValider = devis.filter(function (q) { return q.statut === 'envoye' && !(q.valable_jusqu && q.valable_jusqu < t) })
      var aRegler = factures.filter(function (f) { return f.statut !== 'payee' && f.type !== 'avoir' })
      var aSigner = contrats.filter(function (k) { return k.statut === 'envoye' })
      var attenteMoi = d.demandes.filter(function (q) { return q.statut === 'attente_client' })
      var echeances = projets.filter(function (p) { return p.echeance && p.echeance >= t }).map(function (p) { return p.echeance }).sort()
      var nonLues = notifs.filter(function (n) { return !n.lu_at })
      var noms = {}; projets.forEach(function (p) { noms[p.id] = p.titre })
      var heure = new Date().getHours(), salut = heure < 5 || heure >= 18 ? 'Bonsoir' : 'Bonjour'

      // ---- la prochaine action : ce que le client doit faire maintenant, par ordre d'importance
      var actions = []
      attenteMoi.forEach(function (q) { actions.push({ ic: 'message-square', t: 'Répondre à l’équipe : ' + q.sujet, h: '#demande/' + q.id, ton: 'critique' }) })
      aSigner.forEach(function (k) { actions.push({ ic: 'file-signature', t: 'Signer le contrat ' + (k.ref || '') + ' · ' + k.titre, h: '#facturation', ton: 'attention' }) })
      aValider.forEach(function (q) { actions.push({ ic: 'file-text', t: 'Valider le devis ' + q.ref + (q.titre ? ' · ' + q.titre : ''), h: '#facturation', ton: 'attention' }) })
      attendus.forEach(function (u) { actions.push({ ic: 'upload', t: u.titre + (noms[u.project_id] ? ' (' + noms[u.project_id] + ')' : ''), h: '#projet/' + u.project_id, ton: 'attention' }) })
      aRegler.forEach(function (f) { actions.push({ ic: 'receipt-text', t: 'Régler la facture ' + f.ref + ' · ' + eur(f.reste) + (f.echeance ? ' avant le ' + date(f.echeance) : ''), h: '#facturation', ton: f.statut === 'retard' ? 'critique' : '' }) })

      var tete = h('header', { class: 'pc-tete pa-tete' },
        h('div', { class: 'pc-tete-texte' }, h('h1', {}, salut + ', ', h('em', {}, (acc && acc.nom) || 'bienvenue')), h('p', {}, actions.length ? 'Voici où en sont vos projets, et ce qui attend votre réponse.' : 'Voici où en sont vos projets. Rien n’attend votre réponse pour le moment.')),
        h('div', { class: 'pc-tete-droite' }, h('a', { class: 'btn principal', href: '#nouvelle' }, ic('plus', 15), 'Nouvelle demande')))

      var kpi = h('div', { class: 'grille kpi' },
        UI.tuile('Projets en cours', String(projets.filter(function (p) { return p.avancement < 100 }).length), projets.length ? projets.length + ' projet(s) au total' : 'aucun pour le moment', false, { icone: 'rocket' }),
        UI.tuile('À faire de votre part', String(actions.length), actions.length ? 'voir la liste ci-dessous' : 'tout est à jour', actions.length > 0, { icone: 'list-checks' }),
        UI.tuile('Prochaine échéance', echeances[0] ? date(echeances[0]) : '—', echeances[0] ? 'livraison prévue' : 'à définir avec l’équipe', false, { icone: 'calendar-clock' }),
        UI.tuile('Reste à payer', eur(aRegler.reduce(function (s, f) { return s + (+f.reste || 0) }, 0)), aRegler.length ? aRegler.length + ' facture(s)' : 'tout est réglé', aRegler.some(function (f) { return f.statut === 'retard' }), { icone: 'wallet' }))

      // ---- projets avec progression et étape réelle
      var cartesProjets = projets.length ? h('div', { class: 'pa-projets' }, projets.map(function (p) {
        var siennes = etapes.filter(function (e) { return e.project_id === p.id }).sort(function (a, b) { return a.ordre - b.ordre })
        var cours = siennes.filter(function (e) { return e.statut === 'cours' })[0]
        return h('a', { class: 'pa-projet', href: '#projet/' + p.id },
          h('div', { class: 'pa-projet-t' }, h('b', {}, p.titre), h('span', { class: 'discret petit' }, cours ? 'Étape en cours : ' + cours.nom : (UI.PHASES[(p.etape || 1) - 1] || {}).nom || '')),
          h('div', { class: 'pa-barre', role: 'img', 'aria-label': 'Avancement ' + p.avancement + ' %' }, h('i', { style: 'width:' + Math.max(0, Math.min(100, p.avancement)) + '%' })),
          h('div', { class: 'pa-projet-b' }, h('span', {}, p.avancement + ' % réalisé'), siennes.length ? h('span', {}, siennes.filter(function (e) { return e.statut === 'fait' }).length + '/' + siennes.length + ' étapes') : null, p.echeance ? h('span', {}, 'Livraison ' + date(p.echeance)) : null))
      })) : UI.etatVide('Votre projet apparaîtra ici dès que l’agence l’aura créé.', 'rocket')

      var listeActions = actions.length ? h('ul', { class: 'pa-actions' }, actions.slice(0, 8).map(function (a) { return h('li', { class: a.ton }, h('a', { href: a.h }, h('span', { class: 'pa-ico', 'aria-hidden': 'true' }, ic(a.ic, 15)), h('span', {}, a.t), ic('chevron-right', 14))) })) : UI.etatVide('Rien à faire de votre côté pour le moment.', 'circle-check')

      // ---- nouveautés (notifications), derniers messages, derniers documents, livrables
      var nouveautes = notifs.length ? h('ul', { class: 'pa-flux' }, notifs.slice(0, 6).map(function (n) {
        return h('li', { class: n.lu_at ? '' : 'non-lu' }, h('a', { href: n.lien || '#accueil', onclick: function () { if (!n.lu_at) S.sb.patch('notifications?id=eq.' + n.id, { lu_at: new Date().toISOString() }).catch(function () {}) } }, n.titre), h('small', { class: 'discret' }, quand(n.created_at)))
      })) : UI.etatVide('Aucune nouveauté.', 'bell')
      var toutLu = nonLues.length ? h('button', { class: 'btn lien petit', type: 'button', onclick: function () { S.sb.patch('notifications?audience=eq.client&lu_at=is.null', { lu_at: new Date().toISOString() }).then(ctx.route, ctx.route) } }, 'Tout marquer comme lu') : null
      var sujets = {}; d.demandes.forEach(function (q) { sujets[q.id] = q.sujet })
      var messages = reponses.length ? h('ul', { class: 'pa-flux' }, reponses.map(function (m) { return h('li', {}, h('a', { href: '#demande/' + m.request_id }, sujets[m.request_id] || 'Votre demande'), h('p', { class: 'pa-extrait' }, m.body.length > 140 ? m.body.slice(0, 140) + '…' : m.body), h('small', { class: 'discret' }, 'Creatigo · ' + quand(m.created_at))) })) : UI.etatVide('Pas encore de réponse de l’équipe.', 'message-square')
      var docs = d.documents.filter(function (x) { return x.uploaded_role !== 'client' }).slice(0, 5)
      var documents = docs.length ? h('ul', { class: 'pa-flux' }, docs.map(function (x) { return h('li', {}, h('b', {}, x.nom), h('small', { class: 'discret' }, (noms[x.project_id] ? noms[x.project_id] + ' · ' : '') + date(x.created_at)), ctx.telecharger(x, 'Ouvrir')) })) : UI.etatVide('Aucun document partagé pour l’instant.', 'folder')
      var livrables = livres.length ? h('ul', { class: 'pa-flux' }, livres.slice(0, 5).map(function (u) { return h('li', {}, h('b', {}, u.titre), h('small', { class: 'discret' }, (noms[u.project_id] || '') + ' · ' + date(u.created_at))) })) : UI.etatVide('Rien de livré pour l’instant.', 'send')

      return [tete, kpi,
        h('div', { class: 'rangee r21' }, UI.carte('Vos projets', projets.length + ' projet(s)', cartesProjets), UI.carte('À faire de votre part', actions.length ? actions.length + ' action(s)' : 'à jour', listeActions)),
        h('div', { class: 'rangee r11' }, UI.carte('Nouveautés', nonLues.length ? nonLues.length + ' non lue(s)' : 'tout est lu', nouveautes, toutLu), UI.carte('Dernières réponses de l’équipe', '', messages)),
        h('div', { class: 'rangee r11' }, UI.carte('Derniers documents', '', documents, h('a', { class: 'btn lien petit', href: '#documents' }, 'Tous les documents')), UI.carte('Livrables disponibles', '', livrables))]
    })
  }

  /* =====================================================================================
     CENTRE DE SUIVI : les étapes réelles du projet (ajouté sous le parcours de « Mon projet »)
     ===================================================================================== */
  function etapes(projetId, ctx) {
    var h = ctx.h, UI = ctx.UI, S = ctx.S, ic = ctx.ic
    var carte = UI.carte('Le détail de votre projet', 'les étapes de travail de l’agence, mises à jour en temps réel', h('p', { class: 'discret' }, 'Chargement…'))
    Promise.all([sur(S.sb.get('client_project_steps?project_id=eq.' + encodeURIComponent(projetId) + '&select=*&order=ordre')), ctx.lire(), sur(S.sb.get('portal_requests?project_id=eq.' + encodeURIComponent(projetId) + '&select=id,sujet,statut,updated_at&order=updated_at.desc'))]).then(function (r) {
      var l = r[0], d = r[1], demandes = r[2]
      var attendus = d.nouvelles.filter(function (u) { return u.project_id === projetId && u.kind === 'attendu' })
      var docs = d.documents.filter(function (x) { return x.project_id === projetId })
      var contenu
      if (!l.length) contenu = h('p', { class: 'discret' }, 'L’agence n’a pas encore détaillé les étapes de ce projet : suivez le parcours ci-dessus.')
      else contenu = h('ol', { class: 'pa-etapes' }, l.map(function (e) {
        var lib = { fait: 'Terminée', cours: 'En cours', avenir: 'À venir' }[e.statut]
        var detail = []
        if (e.statut === 'fait' && e.terminee_le) detail.push('terminée le ' + date(e.terminee_le))
        else if (e.debut || e.fin) detail.push((e.debut ? 'du ' + date(e.debut) : '') + (e.fin ? ' au ' + date(e.fin) : ''))
        if (e.total) detail.push(e.faites + '/' + e.total + ' tâche(s)')
        var phase = (UI.PHASES[e.phase - 1] || {}).nom
        return h('li', { class: 'pa-etape ' + e.statut, 'aria-current': e.statut === 'cours' ? 'step' : null },
          h('span', { class: 'pa-etape-pt', 'aria-hidden': 'true' }, e.statut === 'fait' ? ic('check', 13) : String(e.ordre)),
          h('div', { class: 'pa-etape-c' },
            h('div', { class: 'pa-etape-t' }, h('b', {}, e.nom), UI.badge(lib, e.statut === 'fait' ? 'bon' : e.statut === 'cours' ? 'attention' : 'neutre')),
            h('small', { class: 'discret' }, [phase, detail.join(' · ')].filter(Boolean).join(' · ')),
            e.total && e.statut === 'cours' ? h('div', { class: 'pa-barre petite', role: 'img', 'aria-label': e.faites + ' tâche(s) faite(s) sur ' + e.total }, h('i', { style: 'width:' + Math.round(100 * e.faites / e.total) + '%' })) : null))
      }))
      var cote = h('div', { class: 'pa-suivi-cote' },
        h('h3', {}, 'Actions attendues de votre part'),
        attendus.length ? h('ul', { class: 'pa-flux' }, attendus.map(function (u) { return h('li', { class: u.fait ? '' : 'non-lu' }, h('b', {}, u.titre), u.detail ? h('p', { class: 'pa-extrait' }, u.detail) : null, h('small', { class: 'discret' }, u.fait ? 'fait' : 'à faire · demandé le ' + date(u.created_at))) })) : h('p', { class: 'discret petit' }, 'Rien en attente.'),
        h('h3', {}, 'Documents du projet'),
        docs.length ? h('ul', { class: 'pa-flux' }, docs.slice(0, 6).map(function (x) { return h('li', {}, h('b', {}, x.nom), h('small', { class: 'discret' }, date(x.created_at)), ctx.telecharger(x, 'Ouvrir')) })) : h('p', { class: 'discret petit' }, 'Aucun document partagé.'),
        h('h3', {}, 'Vos demandes sur ce projet'),
        demandes.length ? h('ul', { class: 'pa-flux' }, demandes.slice(0, 5).map(function (q) { return h('li', {}, h('a', { href: '#demande/' + q.id }, q.sujet), badgeStatut(UI, q.statut)) })) : h('p', { class: 'discret petit' }, 'Aucune demande.'),
        h('a', { class: 'btn petit', href: '#nouvelle/' + projetId }, ic('plus', 14), 'Une question sur ce projet'))
      carte.lastChild.replaceWith(h('div', { class: 'pa-suivi' }, contenu, cote))
    })
    return carte
  }

  /* =====================================================================================
     CENTRE DE SUPPORT
     ===================================================================================== */
  function support(ctx) {
    var h = ctx.h, UI = ctx.UI, S = ctx.S, ic = ctx.ic
    return Promise.all([ctx.lire(true), S.sb.get('portal_requests?select=id,project_id,sujet,statut,categorie,priorite,created_at,updated_at&order=updated_at.desc&limit=300')]).then(function (r) {
      var d = r[0], l = r[1], noms = {}; d.projets.forEach(function (p) { noms[p.id] = p.titre })
      var ouvertes = l.filter(function (q) { return q.statut !== 'terminee' && q.statut !== 'resolue' })
      var etat = { statut: 'actives', cat: '' }
      var zone = h('div')
      var filtres = h('div', { class: 'pc-filtres', role: 'group', 'aria-label': 'Filtrer les demandes' },
        [['actives', 'En cours'], ['attente_client', 'En attente de vous'], ['resolue', 'Résolues'], ['terminee', 'Fermées'], ['', 'Toutes']].map(function (x, i) {
          return h('button', { type: 'button', 'aria-pressed': String(!i), onclick: function (ev) { filtres.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', 'false') }); ev.currentTarget.setAttribute('aria-pressed', 'true'); etat.statut = x[0]; dessiner() } }, x[1])
        }))
      var cat = h('select', { 'aria-label': 'Catégorie' }, h('option', { value: '' }, 'Toutes les catégories'), CATS.map(function (c) { return h('option', { value: c[0] }, c[1]) }))
      cat.addEventListener('change', function () { etat.cat = cat.value; dessiner() })
      function dessiner() {
        var v = l.filter(function (q) {
          if (etat.cat && q.categorie !== etat.cat) return false
          if (etat.statut === 'actives') return q.statut !== 'terminee' && q.statut !== 'resolue'
          return !etat.statut || q.statut === etat.statut
        })
        zone.replaceChildren(v.length ? h('div', { class: 'table-zone', tabindex: '0', role: 'region', 'aria-label': 'Vos demandes' }, h('table', { class: 'table-services' },
          h('thead', {}, h('tr', {}, ['Demande', 'Catégorie', 'Priorité', 'Projet', 'Statut', 'Dernière activité'].map(function (x, i) { return h('th', { scope: 'col', class: i === 5 ? 'num' : null }, x) }))),
          h('tbody', {}, v.map(function (q) {
            var c = CATS.filter(function (x) { return x[0] === q.categorie })[0] || CATS[5], p = PRIOS.filter(function (x) { return x[0] === q.priorite })[0] || PRIOS[1]
            return h('tr', {}, h('td', {}, h('a', { class: 'service-nom lien-ligne', href: '#demande/' + q.id }, h('span', { class: 'service-ini', 'aria-hidden': 'true' }, ic(c[2], 15)), q.sujet)),
              h('td', {}, c[1]), h('td', {}, UI.badge(p[1], p[2])), h('td', {}, noms[q.project_id] || h('span', { class: 'discret' }, '—')), h('td', {}, badgeStatut(UI, q.statut)), h('td', { class: 'num' }, date(q.updated_at)))
          })))) : UI.etatVide(l.length ? 'Aucune demande dans cette liste.' : 'Vous n’avez fait aucune demande pour l’instant.', 'headset'))
      }
      dessiner()
      return [ctx.enTetePage('Centre de', 'support', 'Un problème, une modification, une question : ouvrez une demande, suivez son traitement et répondez à l’équipe.', h('a', { class: 'btn principal', href: '#nouvelle' }, ic('plus', 15), 'Nouvelle demande')),
        h('div', { class: 'grille kpi' },
          UI.tuile('Demandes en cours', String(ouvertes.length), 'ouvertes ou en traitement', false, { icone: 'headset' }),
          UI.tuile('En attente de vous', String(l.filter(function (q) { return q.statut === 'attente_client' }).length), 'l’équipe attend votre réponse', l.some(function (q) { return q.statut === 'attente_client' }), { icone: 'message-square' }),
          UI.tuile('Résolues', String(l.filter(function (q) { return q.statut === 'resolue' || q.statut === 'terminee' }).length), 'depuis le début', false, { icone: 'circle-check' })),
        h('section', { class: 'carte sans-marge' }, h('header', { class: 'tete-tableau' }, h('div', {}, h('h2', {}, 'Vos demandes'), h('span', { class: 'discret petit' }, l.length + ' au total')), h('div', { class: 'pa-filtres' }, filtres, cat)), zone)]
    })
  }

  // dépôt de pièces jointes du client (dossier clients/<id>/depots/, la base vérifie le dossier et la demande)
  function deposer(ctx, fichiers, rid, pid) {
    var S = ctx.S, acc = ctx.acc()
    var fs = [].slice.call(fichiers || [])
    if (fs.some(function (f) { return f.size > 20 * 1024 * 1024 })) return Promise.reject(new Error('20 Mo maximum par fichier.'))
    return fs.reduce(function (p, f) {
      return p.then(function () {
        var propre = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80)
        var chemin = 'clients/' + acc.client_id + '/depots/' + Date.now().toString(36) + '-' + propre
        return S.sb.deposer(chemin, f).then(function () {
          return S.sb.post('documents', { client_id: acc.client_id, request_id: rid || null, project_id: pid || null, categorie: 'support', nom: f.name.slice(0, 200), path: chemin, taille: f.size, mime: f.type || '', visible_client: true, uploaded_role: 'client' })
        })
      })
    }, Promise.resolve())
  }

  function demande(ctx, id) {
    var h = ctx.h, UI = ctx.UI, S = ctx.S, ic = ctx.ic
    var enc = encodeURIComponent
    return Promise.all([S.sb.get('portal_requests?id=eq.' + enc(id) + '&select=*'), S.sb.get('portal_messages?request_id=eq.' + enc(id) + '&select=*&order=created_at.asc'), S.sb.get('client_projects?select=id,titre'), sur(S.sb.get('client_documents?request_id=eq.' + enc(id) + '&select=*&order=created_at'))]).then(function (r) {
      var q = r[0][0]
      var retour = h('p', {}, h('a', { class: 'btn lien', href: '#echanges' }, ic('chevron-left', 15), 'Centre de support'))
      if (!q) return [retour, h('section', { class: 'carte' }, UI.etatVide('Demande introuvable.', 'headset'))]
      var pj = r[2].filter(function (p) { return p.id === q.project_id })[0], docs = r[3]
      var c = CATS.filter(function (x) { return x[0] === q.categorie })[0] || CATS[5], pr = PRIOS.filter(function (x) { return x[0] === q.priorite })[0] || PRIOS[1]
      var fil = UI.carte('Échanges', r[1].length + ' message(s)', h('div', { class: 'fil-msg' }, r[1].map(function (m) {
        var agence = m.author === 'agence'
        return h('div', { class: 'bulle-msg' + (agence ? '' : ' moi') }, h('div', { class: 'qui' }, h('b', {}, agence ? 'Creatigo' : 'Vous'), quand(m.created_at)), h('p', {}, m.body))
      })))
      if (q.statut === 'attente_client') fil.prepend(h('div', { class: 'pf-ko' }, ic('message-square', 16), h('span', {}, 'L’équipe attend votre réponse pour avancer.')))
      if (q.statut === 'terminee') fil.append(h('p', { class: 'discret' }, 'Cette demande est fermée. Pour un nouveau sujet, ouvrez une nouvelle demande.'))
      else {
        var t = h('textarea', { rows: '4', maxlength: '5000', placeholder: q.statut === 'resolue' ? 'Le problème persiste ? Répondez ici : la demande sera rouverte.' : 'Votre message…' })
        var fic = h('input', { type: 'file', multiple: true, 'aria-label': 'Joindre des fichiers' })
        var em = h('div', { class: 'erreur', role: 'alert', hidden: true })
        var f = h('form', { class: 'formulaire', novalidate: true }, h('label', { class: 'champ' }, h('span', {}, 'Répondre'), t), h('label', { class: 'champ' }, h('span', {}, 'Joindre des fichiers (captures, documents, 20 Mo max.)'), fic), em,
          h('div', {}, h('button', { class: 'btn principal', type: 'submit' }, ic('send', 15), 'Envoyer')))
        f.addEventListener('submit', function (e) {
          e.preventDefault(); em.hidden = true
          if (!t.value.trim() && !(fic.files || []).length) { em.textContent = 'Écrivez un message ou joignez un fichier.'; em.hidden = false; return }
          var b = f.querySelector('button[type=submit]'); b.disabled = true
          deposer(ctx, fic.files, q.id, q.project_id).then(function () {
            var texte = t.value.trim() || 'Fichier(s) joint(s) : ' + [].slice.call(fic.files).map(function (x) { return x.name }).join(', ')
            return S.sb.post('portal_messages', { request_id: id, author: 'client', body: texte })
          }).then(function () { ctx.reinit(); ctx.route() }, function (er) { em.textContent = er.message && /Mo/.test(er.message) ? er.message : 'Envoi impossible pour le moment. Réessayez.'; em.hidden = false; b.disabled = false })
        })
        fil.append(f)
      }
      var actions = h('div', { class: 'pa-actions-demande' },
        q.statut === 'resolue' ? h('button', { class: 'btn', type: 'button', onclick: function () { agir('rouvrir') } }, ic('rotate-ccw', 15), 'Rouvrir') : null,
        q.statut !== 'terminee' ? h('button', { class: 'btn', type: 'button', onclick: function () { UI.confirmer({ titre: 'Fermer cette demande ?', texte: 'Elle sera archivée. Pour un nouveau sujet, vous ouvrirez une nouvelle demande.', bouton: 'Fermer la demande' }).then(function (ok) { if (ok) agir('fermer') }) } }, ic('circle-check', 15), q.statut === 'resolue' ? 'C’est réglé, fermer' : 'Fermer la demande') : null)
      function agir(a) { S.rpc('client_statut_demande', { rid: q.id, action: a }).then(function () { UI.toast(a === 'fermer' ? 'Demande fermée.' : 'Demande rouverte.', 'bon'); ctx.reinit(); ctx.route() }, function (er) { UI.toast(msgErreur(er), 'critique') }) }
      var details = UI.carte('Détails', h('div', { class: 'cles' },
        h('div', {}, h('span', {}, 'Statut'), badgeStatut(UI, q.statut)),
        h('div', {}, h('span', {}, 'Catégorie'), h('b', {}, c[1])),
        h('div', {}, h('span', {}, 'Priorité'), UI.badge(pr[1], pr[2])),
        h('div', {}, h('span', {}, 'Ouverte le'), h('b', {}, date(q.created_at))),
        pj ? h('div', {}, h('span', {}, 'Projet'), h('a', { href: '#projet/' + pj.id }, pj.titre)) : null), actions)
      var pieces = UI.carte('Pièces jointes', docs.length + ' fichier(s)', docs.length ? h('ul', { class: 'pa-flux' }, docs.map(function (x) { return h('li', {}, h('b', {}, x.nom), h('small', { class: 'discret' }, (x.uploaded_role === 'client' ? 'Vous' : 'Creatigo') + ' · ' + date(x.created_at)), ctx.telecharger(x, 'Ouvrir')) })) : h('p', { class: 'discret petit' }, 'Aucun fichier.'))
      return [retour, ctx.enTetePage(q.sujet, '', c[1] + (pj ? ' · ' + pj.titre : '') + ' · ouverte le ' + date(q.created_at), badgeStatut(UI, q.statut)), h('div', { class: 'rangee r21' }, fil, h('div', { style: 'display:grid;gap:20px;align-content:start' }, details, pieces))]
    })
  }

  function nouvelle(ctx, pid) {
    var h = ctx.h, UI = ctx.UI, S = ctx.S, ic = ctx.ic
    return S.sb.get('client_projects?select=id,titre&order=created_at.desc').then(function (projects) {
      var msg = h('div', { class: 'erreur', role: 'alert', hidden: true })
      var sel = h('select', {}, h('option', { value: '' }, 'Autre sujet (pas lié à un projet)'), projects.map(function (p) { return h('option', { value: p.id, selected: p.id === pid }, p.titre) }))
      var cat = h('div', { class: 'pa-cats', role: 'radiogroup', 'aria-label': 'Catégorie' }, CATS.map(function (c, i) {
        return h('label', { class: 'pa-cat' }, h('input', { type: 'radio', name: 'cat', value: c[0], checked: i === 0 }), h('span', {}, ic(c[2], 18), c[1]))
      }))
      var prio = h('select', {}, PRIOS.map(function (p) { return h('option', { value: p[0], selected: p[0] === 'normale' }, p[1] + (p[0] === 'urgente' ? ' (site en panne, blocage)' : '')) }))
      var sujet = h('input', { type: 'text', maxlength: '200', placeholder: 'En une phrase' })
      var texte = h('textarea', { rows: '7', maxlength: '5000', placeholder: 'Décrivez le problème ou la demande : la page concernée, ce que vous voyez, ce que vous attendez…' })
      var fic = h('input', { type: 'file', multiple: true })
      var form = h('form', { class: 'formulaire', novalidate: true },
        h('fieldset', { class: 'pa-fs' }, h('legend', {}, 'De quoi s’agit-il ?'), cat),
        h('div', { class: 'pa-deux' }, h('label', { class: 'champ' }, h('span', {}, 'Projet concerné'), sel), h('label', { class: 'champ' }, h('span', {}, 'Priorité'), prio)),
        h('label', { class: 'champ' }, h('span', {}, 'Sujet'), sujet),
        h('label', { class: 'champ' }, h('span', {}, 'Votre demande'), texte),
        h('label', { class: 'champ' }, h('span', {}, 'Pièces jointes (captures d’écran, documents, 20 Mo max. par fichier)'), fic), msg,
        h('div', {}, h('button', { class: 'btn principal', type: 'submit' }, ic('send', 15), 'Envoyer la demande')))
      form.addEventListener('submit', function (e) {
        e.preventDefault(); msg.hidden = true
        if (!sujet.value.trim() || !texte.value.trim()) { msg.textContent = 'Renseignez le sujet et votre demande.'; msg.hidden = false; return }
        var b = form.querySelector('button[type=submit]'); b.disabled = true
        var row = { client_id: ctx.acc().client_id, sujet: sujet.value.trim(), categorie: (form.querySelector('input[name=cat]:checked') || {}).value || 'autre', priorite: prio.value }
        if (sel.value) row.project_id = sel.value
        S.sb.post('portal_requests', row).then(function (r) {
          var rid = r[0].id
          return S.sb.post('portal_messages', { request_id: rid, author: 'client', body: texte.value.trim() }).then(function () { return deposer(ctx, fic.files, rid, row.project_id) }).then(function () { ctx.reinit(); location.hash = '#demande/' + rid })
        }).catch(function (er) { msg.textContent = er.message && /Mo/.test(er.message) ? er.message : 'Envoi impossible pour le moment. Réessayez.'; msg.hidden = false; b.disabled = false })
      })
      var conseils = UI.carte('Pour une réponse rapide', h('ul', { class: 'coches' }, ['Une demande par sujet.', 'La page ou l’écran concerné, avec une capture si possible.', 'Urgente seulement si le site est en panne ou bloque votre activité.', 'Réponse sous un jour ouvré, plus vite si c’est urgent.'].map(function (t) {
        return h('li', {}, h('span', { class: 'coche', 'aria-hidden': 'true', style: 'border-color:var(--accent);color:var(--accent)' }, ic('check', 14)), h('div', {}, h('span', {}, t)))
      })))
      return [ctx.enTetePage('Nouvelle', 'demande', 'Choisissez la catégorie, décrivez votre besoin, joignez vos fichiers : l’équipe vous répond ici.'), h('div', { class: 'rangee r21' }, UI.carte('Votre demande', 'réponse sous un jour ouvré', form), conseils)]
    })
  }

  window.PortailPlus = { accueil: accueil, etapes: etapes, support: support, demande: demande, nouvelle: nouvelle, STATUTS: STATUTS }
})()
