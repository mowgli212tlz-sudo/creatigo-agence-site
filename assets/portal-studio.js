/* Espace client (phase 6) : validation des livrables, messagerie par projet, centre documentaire.
   Branché sur assets/portal.js (outils : h, UI, S, lire, route, telecharger…). La base décide de ce que le client voit et peut faire
   (supabase/studio.sql) : il ne commente que les livrables de ses projets, ne se prononce que sur la dernière version,
   et ne marque comme lus que ses propres messages. Tout texte passe par textContent (UI.h). */
(function () {
  var enc = encodeURIComponent
  function quand(iso) { var d = new Date(iso); return d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  function date(iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—' }
  function msgErreur(er) { var m = String((er && er.message) || er); var x = /"message":"([^"]+)"/.exec(m); return x ? x[1] : 'Action impossible pour le moment. Réessayez.' }
  function propre(nom) { return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80) }
  function sur(p) { return p.catch(function () { return [] }) }
  var CS = function () { return window.CreatigoStudio }

  // dépôt d'un fichier par le client (son dossier de dépôt ; la base vérifie dossier, catégorie et projet)
  function deposer(ctx, f, categorie, pid) {
    var cid = ctx.acc().client_id
    if (f.size > 20 * 1024 * 1024) return Promise.reject(new Error('20 Mo maximum par fichier.'))
    var chemin = 'clients/' + cid + '/depots/' + Date.now().toString(36) + '-' + propre(f.name)
    return ctx.S.sb.deposer(chemin, f).then(function () {
      return ctx.S.sb.post('documents', { client_id: cid, project_id: pid || null, categorie: categorie, nom: f.name.slice(0, 200), path: chemin, taille: f.size, mime: f.type || '', visible_client: true, uploaded_role: 'client' })
    }).then(function (r) { return r[0] })
  }

  /* =====================================================================================
     VALIDATION : liste des livrables
     ===================================================================================== */
  function livrables(ctx) {
    var h = ctx.h, UI = ctx.UI, S = ctx.S, ic = ctx.ic
    return Promise.all([sur(S.sb.get('deliverables?select=*&order=updated_at.desc')), sur(S.sb.get('deliverable_versions?select=id,deliverable_id,numero,document_id,created_at&order=numero')), ctx.lire()]).then(function (r) {
      var l = r[0], vs = r[1], d = r[2], noms = {}; d.projets.forEach(function (p) { noms[p.id] = p.titre })
      var aValider = l.filter(function (x) { return x.statut === 'a_valider' })
      var cartes = h('div', { class: 'ps-cartes' }, l.map(function (x) {
        var siennes = vs.filter(function (v) { return v.deliverable_id === x.id }), der = siennes[siennes.length - 1]
        var st = CS().STATUTS[x.statut] || [x.statut, '']
        var vignette = h('div', { class: 'ps-vignette' }, ic('palette', 26))
        if (der && der.document_id) {
          var doc = d.documents.filter(function (o) { return o.id === der.document_id })[0]
          if (doc && CS().estImage(doc.mime, doc.nom)) S.sb.fichier(doc.path).then(function (u) { vignette.replaceChildren(h('img', { src: u, alt: '', loading: 'lazy' })) }).catch(function () {})
        }
        return h('a', { class: 'ps-carte' + (x.statut === 'a_valider' ? ' attente' : ''), href: '#livrable/' + x.id }, vignette,
          h('div', { class: 'ps-carte-t' }, h('b', {}, x.titre), h('small', { class: 'discret' }, (CS().TYPES[x.type] || '') + ' · ' + (noms[x.project_id] || '') + (der ? ' · V' + der.numero : '')), UI.badge(st[0], st[1])))
      }))
      return [ctx.enTetePage('Vos', 'validations', 'Maquettes, logos, visuels et livrables à regarder : commentez directement sur l’image, demandez des modifications ou validez.'),
        h('div', { class: 'grille kpi' },
          UI.tuile('À valider', String(aValider.length), aValider.length ? 'votre avis est attendu' : 'rien en attente', aValider.length > 0, { icone: 'palette' }),
          UI.tuile('Validés', String(l.filter(function (x) { return x.statut === 'valide' }).length), 'depuis le début', false, { icone: 'circle-check' }),
          UI.tuile('En cours de modification', String(l.filter(function (x) { return x.statut === 'modifications' }).length), 'l’équipe prépare une nouvelle version', false, { icone: 'square-pen' })),
        l.length ? UI.carte('Livrables', l.length + ' au total', cartes) : UI.etatVide('Les maquettes et livrables à valider apparaîtront ici.', 'palette')]
    })
  }

  /* =====================================================================================
     VALIDATION : un livrable
     ===================================================================================== */
  function livrable(ctx, id, versionVoulue) {
    var h = ctx.h, UI = ctx.UI, S = ctx.S, ic = ctx.ic
    return Promise.all([S.sb.get('deliverables?id=eq.' + enc(id) + '&select=*'), S.sb.get('deliverable_versions?deliverable_id=eq.' + enc(id) + '&select=*&order=numero'),
      S.sb.get('deliverable_comments?deliverable_id=eq.' + enc(id) + '&select=*&order=created_at'), sur(S.sb.get('deliverable_decisions?deliverable_id=eq.' + enc(id) + '&select=*&order=created_at')), ctx.lire(true)]).then(function (r) {
      var d = r[0][0], vs = r[1], coms = r[2], decs = r[3], data = r[4]
      var retour = h('p', {}, h('a', { class: 'btn lien', href: '#studio' }, ic('chevron-left', 15), 'Toutes les validations'))
      if (!d) return [retour, h('section', { class: 'carte' }, UI.etatVide('Livrable introuvable.', 'palette'))]
      var derniere = vs[vs.length - 1], v = vs.filter(function (x) { return x.numero === +versionVoulue })[0] || derniere
      var doc = v && data.documents.filter(function (o) { return o.id === v.document_id })[0]
      var siens = coms.filter(function (c) { return c.version_id === (v && v.id) })
      var points = siens.map(function (c, i) { return { n: i + 1, x: c.x == null ? null : +c.x, y: c.y == null ? null : +c.y, texte: c.body, resolu: c.resolu, auteur: c.author } })
      var peutCommenter = v && v.id === (derniere && derniere.id) && d.statut !== 'valide'
      var position = null
      var vue = h('div', {}, h('p', { class: 'discret' }, 'Chargement…'))
      var saisie = h('textarea', { rows: '3', maxlength: '4000', placeholder: 'Cliquez sur l’image à l’endroit concerné, puis écrivez votre remarque. Sans clic, la remarque est générale.' })
      var lieu = h('small', { class: 'discret' }, 'Remarque générale')
      if (doc) S.sb.fichier(doc.path).then(function (url) {
        vue.replaceChildren(CS().visionneuse({ h: h, ic: ic, url: url, mime: doc.mime, nom: doc.nom, points: points, choisir: function (n) { var li = document.querySelector('[data-n="' + n + '"]'); if (li) li.scrollIntoView({ block: 'nearest' }) },
          placer: peutCommenter ? function (x, y) { position = { x: x, y: y }; lieu.textContent = 'Remarque placée sur l’image (point orange)'; saisie.focus() } : null }))
      }).catch(function () { vue.replaceChildren(UI.etatVide('Fichier indisponible pour le moment.', 'file-text')) })
      else vue.replaceChildren(UI.etatVide('Fichier indisponible.', 'file-text'))

      var liste = h('ol', { class: 'st-coms' }, points.length ? points.map(function (p) {
        var c = siens[p.n - 1]
        return h('li', { 'data-n': String(p.n), class: (c.resolu ? 'resolu ' : '') + (c.author === 'agence' ? 'agence' : '') }, h('span', { class: 'st-num' }, String(p.n)),
          h('div', {}, h('b', {}, c.author === 'agence' ? 'Creatigo' : 'Vous'), h('small', { class: 'discret' }, ' · ' + quand(c.created_at) + (c.resolu ? ' · traité' : '') + (p.x == null ? ' · général' : '')), h('p', {}, c.body)))
      }) : h('li', { class: 'discret' }, 'Aucune remarque sur cette version.'))
      var commentaire = peutCommenter ? h('div', { class: 'st-saisie' }, lieu, saisie, h('button', { class: 'btn', type: 'button', onclick: function (ev) {
        if (!saisie.value.trim()) { UI.toast('Écrivez votre remarque.', 'critique'); saisie.focus(); return }
        var b = ev.currentTarget; b.disabled = true
        S.sb.post('deliverable_comments', { deliverable_id: d.id, version_id: v.id, author: 'client', x: position ? position.x : null, y: position ? position.y : null, body: saisie.value.trim() })
          .then(function () { UI.toast('Remarque envoyée à l’équipe.', 'bon'); ctx.route() }, function (er) { UI.toast(msgErreur(er), 'critique'); b.disabled = false })
      } }, ic('send', 15), 'Ajouter la remarque')) : null

      // décision
      var decision = null
      if (d.statut === 'a_valider' && v && v.id === derniere.id) {
        var motif = h('textarea', { rows: '3', maxlength: '4000', placeholder: 'Ce qu’il faut changer (vos remarques sur l’image sont déjà transmises)' })
        var err = h('p', { class: 'erreur', role: 'alert', hidden: true })
        var decider = function (choix, b) {
          err.hidden = true
          if (choix !== 'valide' && motif.value.trim().length < 3) { err.textContent = 'Expliquez en quelques mots ce qu’il faut changer.'; err.hidden = false; motif.focus(); return }
          b.disabled = true
          S.rpc('client_decider_livrable', { vid: v.id, decision: choix, commentaire: motif.value.trim() }).then(function () {
            UI.toast(choix === 'valide' ? 'Merci ! Version validée.' : 'Votre demande est transmise à l’équipe.', 'bon'); ctx.reinit(); ctx.route()
          }, function (er) { err.textContent = msgErreur(er); err.hidden = false; b.disabled = false })
        }
        decision = UI.carte('Votre décision sur la V' + v.numero, 'datée et conservée',
          h('div', { class: 'ps-decision' },
            h('button', { class: 'btn principal', type: 'button', onclick: function (e) { UI.confirmer({ titre: 'Valider la V' + v.numero + ' ?', texte: 'Votre validation est enregistrée avec la date et votre nom. L’équipe passe à l’étape suivante.', bouton: 'Valider' }).then(function (ok) { if (ok) decider('valide', e.target) }) } }, ic('circle-check', 16), 'Valider cette version'),
            h('label', { class: 'champ' }, h('span', {}, 'Ou bien : ce qu’il faut changer'), motif), err,
            h('div', { class: 'pf-actions' }, h('button', { class: 'btn', type: 'button', onclick: function (e) { decider('modifications', e.currentTarget) } }, ic('square-pen', 15), 'Demander des modifications'),
              h('button', { class: 'btn lien', type: 'button', onclick: function (e) { decider('refuse', e.currentTarget) } }, 'Refuser'))))
      }
      var historique = UI.carte('Historique des décisions', decs.length + ' décision(s)', decs.length ? h('ol', { class: 'st-histo' }, decs.slice().reverse().map(function (x) {
        var lib = { valide: 'Validée', modifications: 'Modifications demandées', refuse: 'Refusée' }[x.decision]
        return h('li', { class: x.decision }, h('b', {}, 'V' + x.numero + ' · ' + lib), h('small', { class: 'discret' }, quand(x.created_at)), x.commentaire ? h('p', {}, x.commentaire) : null)
      })) : h('p', { class: 'discret petit' }, 'Aucune décision pour l’instant.'))

      var versions = vs.length > 1 ? h('nav', { class: 'pc-filtres', 'aria-label': 'Versions' }, vs.map(function (x) { return h('a', { class: 'btn petit' + (x.id === v.id ? ' principal' : ' lien'), href: '#livrable/' + d.id + '/' + x.numero, 'aria-current': x.id === v.id ? 'page' : null }, 'V' + x.numero + (x.id === derniere.id ? ' (dernière)' : '')) })) : null
      var comparer = null
      if (vs.length > 1) {
        var zone = h('div')
        comparer = UI.carte('Comparer avec la version précédente', '', h('button', { class: 'btn', type: 'button', onclick: function () {
          var a = vs[vs.length - 2], b = derniere
          var da = data.documents.filter(function (o) { return o.id === a.document_id })[0], db = data.documents.filter(function (o) { return o.id === b.document_id })[0]
          if (!da || !db || !CS().estImage(da.mime, da.nom) || !CS().estImage(db.mime, db.nom)) { UI.toast('La comparaison est possible entre deux images.', 'critique'); return }
          Promise.all([S.sb.fichier(da.path), S.sb.fichier(db.path)]).then(function (u) { zone.replaceChildren(CS().comparaison({ h: h, a: { url: u[0], titre: 'V' + a.numero }, b: { url: u[1], titre: 'V' + b.numero } })) })
        } }, 'V' + vs[vs.length - 2].numero + ' ↔ V' + derniere.numero), zone)
      }
      var st = CS().STATUTS[d.statut] || [d.statut, '']
      return [retour, ctx.enTetePage(d.titre, '', (CS().TYPES[d.type] || '') + (v ? ' · version ' + v.numero + ' du ' + date(v.created_at) : ''), UI.badge(st[0], st[1])), versions,
        h('div', { class: 'st-grille' }, h('section', { class: 'carte' }, vue, v && v.note ? h('p', { class: 'st-note' }, h('b', {}, 'Le mot de l’équipe : '), v.note) : null),
          h('div', { class: 'st-cote' }, decision, UI.carte('Remarques', points.length + ' remarque(s)', liste, commentaire), historique)), comparer]
    })
  }

  /* =====================================================================================
     MESSAGERIE
     ===================================================================================== */
  var minuterie = null
  var RAPIDES = ['Merci !', 'C’est validé pour moi.', 'Je regarde et je reviens vers vous.', 'Pouvez-vous m’appeler ?']
  function messages(ctx, cle) {
    var h = ctx.h, UI = ctx.UI, S = ctx.S, ic = ctx.ic
    if (minuterie) { clearInterval(minuterie); minuterie = null }
    return Promise.all([ctx.lire(true), sur(S.sb.get('project_messages?select=id,project_id,author,body,lu_client,created_at&order=created_at.desc&limit=1000'))]).then(function (r) {
      var d = r[0], msgs = r[1]
      var convs = [{ cle: 'general', pid: null, titre: 'Conversation générale', sous: 'Une question qui ne concerne pas un projet' }].concat(d.projets.map(function (p) { return { cle: p.id, pid: p.id, titre: p.titre, sous: 'Projet' } }))
      convs.forEach(function (c) { var siens = msgs.filter(function (m) { return (m.project_id || null) === c.pid }); c.dernier = siens[0]; c.nonLus = siens.filter(function (m) { return m.author === 'agence' && !m.lu_client }).length })
      var actuelle = convs.filter(function (c) { return c.cle === (cle || (convs[1] ? convs[1].cle : 'general')) })[0] || convs[0]
      var liste = h('nav', { class: 'ms-items', 'aria-label': 'Conversations' }, convs.map(function (c) {
        return h('a', { href: '#messages/' + c.cle, class: 'ms-item' + (c === actuelle ? ' actif' : '') + (c.nonLus ? ' non-lu' : ''), 'aria-current': c === actuelle ? 'true' : null },
          h('span', { class: 'ms-av', 'aria-hidden': 'true' }, ic(c.pid ? 'rocket' : 'message-circle', 16)),
          h('span', { class: 'ms-txt' }, h('b', {}, c.titre), h('small', { class: 'discret' }, c.dernier ? (c.dernier.author === 'client' ? 'Vous : ' : 'Creatigo : ') + (c.dernier.body || 'Pièce jointe').slice(0, 50) : c.sous)),
          c.nonLus ? h('span', { class: 'ms-pastille' }, String(c.nonLus)) : null)
      }))
      var flux = h('div', { class: 'ms-flux', 'aria-live': 'polite' }), dernier = ''
      function piece(bulle, did) {
        var doc = d.documents.filter(function (o) { return o.id === did })[0]
        var montrer = function (o) { S.sb.fichier(o.path).then(function (u) { bulle.append(CS().estImage(o.mime, o.nom) ? h('a', { class: 'ms-image', href: u, target: '_blank', rel: 'noopener' }, h('img', { src: u, alt: o.nom, loading: 'lazy' })) : h('a', { class: 'ms-fichier', href: u, target: '_blank', rel: 'noopener' }, ic('file-text', 14), o.nom)) }).catch(function () {}) }
        if (doc) montrer(doc); else S.sb.get('client_documents?id=eq.' + enc(did) + '&select=*').then(function (l) { if (l[0]) montrer(l[0]) }).catch(function () {})
      }
      function charger() {
        return S.sb.get('project_messages?project_id=' + (actuelle.pid ? 'eq.' + enc(actuelle.pid) : 'is.null') + '&select=*&order=created_at&limit=500').then(function (l) {
          var sig = l.length + ':' + (l.length ? l[l.length - 1].id : ''); if (sig === dernier) return; dernier = sig
          flux.replaceChildren.apply(flux, l.length ? l.map(function (m) {
            var b = h('div', { class: 'bulle-msg' + (m.author === 'client' ? ' moi' : '') }, h('div', { class: 'qui' }, h('b', {}, m.author === 'client' ? 'Vous' : 'Creatigo'), quand(m.created_at)), m.body ? h('p', {}, m.body) : null)
            if (m.document_id) piece(b, m.document_id)
            return b
          }) : [UI.etatVide('Écrivez votre premier message : l’équipe vous répond ici.', 'message-circle')])
          flux.scrollTop = flux.scrollHeight
          if (l.some(function (m) { return m.author === 'agence' && !m.lu_client })) S.rpc('client_messages_lus', { pid: actuelle.pid }).catch(function () {})
        })
      }
      var texte = h('textarea', { rows: '3', maxlength: '5000', placeholder: 'Votre message…', 'aria-label': 'Message' })
      var fic = h('input', { type: 'file', 'aria-label': 'Joindre un fichier' })
      var rapides = h('div', { class: 'ms-rapides' }, RAPIDES.map(function (t) { return h('button', { type: 'button', onclick: function () { texte.value = t; texte.focus() } }, t) }))
      var envoi = h('button', { class: 'btn principal', type: 'button', onclick: function () {
        var f = (fic.files || [])[0]
        if (!texte.value.trim() && !f) return
        envoi.disabled = true
        ;(f ? deposer(ctx, f, 'contenu', actuelle.pid).then(function (doc) { d.documents.push(doc); return doc.id }) : Promise.resolve(null)).then(function (did) {
          return S.sb.post('project_messages', { client_id: ctx.acc().client_id, project_id: actuelle.pid, author: 'client', body: texte.value.trim(), document_id: did })
        }).then(function () { texte.value = ''; fic.value = ''; envoi.disabled = false; return charger() }, function (er) { UI.toast(/Mo/.test(er.message || '') ? er.message : 'Envoi impossible pour le moment. Réessayez.', 'critique'); envoi.disabled = false })
      } }, ic('send', 15), 'Envoyer')
      texte.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) envoi.click() })
      charger()
      minuterie = setInterval(function () { if (!document.body.contains(flux)) { clearInterval(minuterie); minuterie = null; return } charger() }, 20000)
      return [ctx.enTetePage('Vos', 'messages', 'Une conversation par projet, et une conversation générale. L’équipe répond sous un jour ouvré.'),
        h('div', { class: 'ms-grille' }, h('section', { class: 'carte ms-gauche' }, liste),
          h('section', { class: 'carte ms-fil' }, h('header', { class: 'ms-tete' }, h('div', {}, h('h2', {}, actuelle.titre), h('span', { class: 'discret' }, 'Mise à jour automatique')), actuelle.pid ? h('a', { class: 'btn lien petit', href: '#projet/' + actuelle.pid }, 'Voir le projet') : null),
            flux, h('div', { class: 'ms-saisie' }, rapides, texte, h('div', { class: 'ms-saisie-b' }, fic, h('small', { class: 'discret' }, 'Ctrl + Entrée pour envoyer'), envoi))))]
    })
  }

  /* =====================================================================================
     CENTRE DOCUMENTAIRE
     ===================================================================================== */
  var CATS = { devis: 'Devis', contrat: 'Contrats', facture: 'Factures', maquette: 'Maquettes', logo: 'Logos', image: 'Images', video: 'Vidéos', livrable: 'Livrables', technique: 'Documents techniques', guide: 'Guides d’utilisation', contenu: 'Vos contenus', reference: 'Vos références', support: 'Pièces jointes du support', autre: 'Autres' }
  function documents(ctx) {
    var h = ctx.h, UI = ctx.UI, S = ctx.S, ic = ctx.ic
    return ctx.lire(true).then(function (d) {
      var noms = {}; d.projets.forEach(function (p) { noms[p.id] = p.titre })
      // versions : même nom dans le même projet -> une seule ligne, la plus récente, avec ses versions précédentes
      var groupes = {}
      d.documents.forEach(function (x) { var k = (x.project_id || '') + '|' + x.nom.toLowerCase(); (groupes[k] = groupes[k] || []).push(x) })
      var lignes = Object.keys(groupes).map(function (k) { var g = groupes[k].sort(function (a, b) { return (b.version || 1) - (a.version || 1) || (a.created_at < b.created_at ? 1 : -1) }); return { doc: g[0], anciennes: g.slice(1) } })
        .sort(function (a, b) { return a.doc.created_at < b.doc.created_at ? 1 : -1 })
      var etat = { q: '', cat: '', projet: '' }
      var zone = h('div', { class: 'ps-docs' })
      function apercu(x) {
        var boite = h('span', { class: 'ps-doc-ap', 'aria-hidden': 'true' }, ic(CS() && CS().estImage(x.mime, x.nom) ? 'image-plus' : /pdf/.test(x.mime || '') ? 'file-text' : 'folder', 18))
        if (CS() && CS().estImage(x.mime, x.nom)) S.sb.fichier(x.path).then(function (u) { boite.replaceChildren(h('img', { src: u, alt: '', loading: 'lazy' })) }).catch(function () {})
        return boite
      }
      function dessiner() {
        var l = lignes.filter(function (g) {
          var x = g.doc
          if (etat.cat && x.categorie !== etat.cat) return false
          if (etat.projet && x.project_id !== etat.projet) return false
          return !etat.q || (x.nom + ' ' + (noms[x.project_id] || '') + ' ' + (CATS[x.categorie] || '')).toLowerCase().indexOf(etat.q) >= 0
        })
        zone.replaceChildren(l.length ? h('ul', { class: 'ps-doc-liste' }, l.map(function (g) {
          var x = g.doc
          return h('li', {}, apercu(x),
            h('div', { class: 'ps-doc-t' }, h('b', {}, x.nom, (x.version || 1) > 1 ? h('span', { class: 'ps-v' }, 'v' + x.version) : null),
              h('small', { class: 'discret' }, [CATS[x.categorie] || 'Document', noms[x.project_id], 'déposé le ' + date(x.created_at), x.uploaded_role === 'client' ? 'par vous' : 'par l’équipe', x.taille ? (x.taille > 1e6 ? (x.taille / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' Mo' : Math.max(1, Math.round(x.taille / 1e3)) + ' ko') : null].filter(Boolean).join(' · ')),
              g.anciennes.length ? h('details', { class: 'ps-anciennes' }, h('summary', {}, g.anciennes.length + ' version(s) précédente(s)'), h('ul', {}, g.anciennes.map(function (o) { return h('li', {}, 'v' + (o.version || 1) + ' · ' + date(o.created_at), ctx.telecharger(o, 'Ouvrir')) }))) : null),
            ctx.telecharger(x, 'Ouvrir'))
        })) : UI.etatVide(lignes.length ? 'Aucun document ne correspond.' : 'Vos documents apparaîtront ici dès que l’agence les partage.', 'folder'))
      }
      var q = h('input', { type: 'search', placeholder: 'Rechercher un document…', 'aria-label': 'Rechercher un document' })
      q.addEventListener('input', function () { etat.q = q.value.trim().toLowerCase(); dessiner() })
      var cats = []; d.documents.forEach(function (x) { if (cats.indexOf(x.categorie) < 0) cats.push(x.categorie) })
      var fc = h('select', { 'aria-label': 'Catégorie' }, h('option', { value: '' }, 'Toutes les catégories'), cats.map(function (c) { return h('option', { value: c }, CATS[c] || c) }))
      fc.addEventListener('change', function () { etat.cat = fc.value; dessiner() })
      var fp = d.projets.length > 1 ? h('select', { 'aria-label': 'Projet' }, h('option', { value: '' }, 'Tous les projets'), d.projets.map(function (p) { return h('option', { value: p.id }, p.titre) })) : null
      if (fp) fp.addEventListener('change', function () { etat.projet = fp.value; dessiner() })
      dessiner()
      // dépôt de contenus par le client (textes, photos, logos, références)
      var df = h('input', { type: 'file', multiple: true, 'aria-label': 'Fichiers à déposer' })
      var dc = h('select', { 'aria-label': 'Type de dépôt' }, h('option', { value: 'contenu' }, 'Contenus (textes, photos, logo…)'), h('option', { value: 'reference' }, 'Références visuelles (sites ou visuels que vous aimez)'))
      var dp = h('select', { 'aria-label': 'Projet concerné' }, h('option', { value: '' }, 'Pas de projet précis'), d.projets.map(function (p) { return h('option', { value: p.id }, p.titre) }))
      var depot = UI.carte('Déposer vos contenus', 'l’équipe est prévenue et les retrouve dans votre projet', h('div', { class: 'ps-depot' }, df, dc, dp, h('button', { class: 'btn principal', type: 'button', onclick: function (ev) {
        var fs = [].slice.call(df.files || []); if (!fs.length) { UI.toast('Choisissez au moins un fichier.', 'critique'); return }
        var b = ev.currentTarget; b.disabled = true
        fs.reduce(function (p, f) { return p.then(function () { return deposer(ctx, f, dc.value, dp.value) }) }, Promise.resolve()).then(function () {
          // l'équipe est prévenue par un message dans la conversation concernée
          return S.sb.post('project_messages', { client_id: ctx.acc().client_id, project_id: dp.value || null, author: 'client', body: 'J’ai déposé ' + fs.length + ' fichier(s) dans mes documents : ' + fs.map(function (f) { return f.name }).join(', ') }).catch(function () {})
        }).then(function () { UI.toast('Fichiers déposés. Merci !', 'bon'); ctx.reinit(); ctx.route() }, function (er) { UI.toast(/Mo/.test(er.message || '') ? er.message : 'Dépôt impossible pour le moment. Réessayez.', 'critique'); b.disabled = false })
      } }, ic('upload', 15), 'Déposer')), h('p', { class: 'discret petit' }, '20 Mo maximum par fichier. Les fichiers déposés sont visibles par vous et par l’équipe Creatigo uniquement.'))
      return [ctx.enTetePage('Vos', 'documents', 'Tout ce que l’agence a partagé avec vous, et ce que vous lui avez transmis : recherche, filtres, versions.'),
        depot, h('section', { class: 'carte' }, h('div', { class: 'ps-filtres' }, q, fc, fp), zone)]
    })
  }

  window.PortailStudio = { livrables: livrables, livrable: livrable, messages: messages, documents: documents }
})()
