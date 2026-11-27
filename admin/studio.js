/* Administration : studio de validation et messagerie (phase 6).
   - #studio : livrables de tous les projets (maquettes, logos, visuels, vidéos, supports), filtres, nouveau livrable
   - #studio/<id> : versions, visionneuse avec commentaires placés sur l'image, réponse de l'équipe, comparaison de deux versions,
     historique des décisions du client, nouvelle version
   - #messages(/<client>/<projet|general>) : conversations par projet et générales, non lus, pièces jointes, réponses rapides
   La sécurité est dans la base (supabase/studio.sql). Tout texte passe par UI.h (textContent). */
(function () {
  var K = function () { return window.AdminKit }
  var UI = function () { return window.UI }
  var M = window.AdminModules = window.AdminModules || {}
  var CAT_DOC = { maquette: 'maquette', logo: 'logo', visuel: 'image', video: 'video', support: 'livrable', autre: 'livrable' }
  var enc = encodeURIComponent
  function S() { return K().S }
  function enLigne() { return S().sb && S().sb.on() }
  function nomC(c) { return c ? (c.societe ? c.societe + (c.nom ? ' · ' + c.nom : '') : c.nom) || 'Sans nom' : '—' }
  function quand(iso) { var d = new Date(iso); return d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  function propre(nom) { return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80) }
  function hors() { var U = UI(); K().main.append(U.etatVide('Disponible quand l’administration est connectée à la base.', 'database')) }
  function badge(st) { var U = UI(), x = window.CreatigoStudio.STATUTS[st] || [st, '']; return U.badge(x[0], x[1]) }

  // dépôt d'un fichier visible par le client, rangé dans le dossier du projet
  function deposer(p, f, categorie) {
    var chemin = (p.clientId ? 'clients/' + p.clientId : 'interne') + '/projets/' + p.id + '/livrables/' + Date.now().toString(36) + '-' + propre(f.name)
    return S().sb.deposer(chemin, f).then(function () {
      return S().sb.post('documents', { client_id: p.clientId || null, project_id: p.id, categorie: categorie, nom: f.name.slice(0, 200), path: chemin, taille: f.size, mime: f.type || '', visible_client: !!p.clientId, uploaded_role: 'equipe' })
    }).then(function (r) { return r[0] })
  }

  /* =====================================================================================
     STUDIO : liste
     ===================================================================================== */
  function studio(id) {
    if (!enLigne()) return hors()
    if (id) return fiche(id)
    var U = UI(), h = U.h, fmt = U.fmt, main = K().main
    main.append(U.entete('Studio de validation', 'Maquettes, logos, visuels et livrables soumis aux clients : versions, commentaires sur l’image, validations.', null))
    var zone = h('div'); main.append(zone)
    Promise.all([S().sb.get('deliverables?deleted_at=is.null&select=*&order=updated_at.desc'), S().sb.get('deliverable_versions?select=deliverable_id,numero'), S().list('projets'), S().list('clients')]).then(function (r) {
      var liv = r[0], ver = r[1], pr = r[2], cl = r[3]
      var projet = function (pid) { return pr.filter(function (p) { return p.id === pid })[0] }
      var nbV = function (did) { return ver.filter(function (v) { return v.deliverable_id === did }).length }
      // ---- nouveau livrable
      var fp = h('select', {}, pr.filter(function (p) { return p.statut !== 'livre' }).map(function (p) { return h('option', { value: p.id }, (p.titre || 'Projet') + ' · ' + nomC(cl.filter(function (c) { return c.id === p.clientId })[0])) }))
      var ft = h('input', { maxlength: '200', placeholder: 'ex. Maquette de la page d’accueil' }), fty = h('select', {}, Object.keys(window.CreatigoStudio.TYPES).map(function (k) { return h('option', { value: k }, window.CreatigoStudio.TYPES[k]) }))
      var ff = h('input', { type: 'file', accept: 'image/*,video/*,application/pdf' }), fn = h('textarea', { rows: '2', maxlength: '4000', placeholder: 'Ce que le client doit regarder (facultatif)' })
      var etat = h('p', { class: 'msg', role: 'status' })
      zone.append(U.carte('Soumettre un livrable', 'le client est prévenu et peut commenter, demander des modifications ou valider',
        pr.length ? h('div', {}, h('div', { class: 'pj-grille' }, h('label', {}, 'Projet', fp), h('label', {}, 'Titre', ft), h('label', {}, 'Type', fty), h('label', {}, 'Fichier (image, vidéo ou PDF, 50 Mo max.)', ff), h('label', { class: 'pj-large' }, 'Note pour le client', fn)),
          h('div', { class: 'cta' }, h('button', { class: 'btn principal', type: 'button', onclick: function (ev) {
            var p = projet(fp.value), f = (ff.files || [])[0]
            if (!p) { U.toast('Choisissez un projet.', 'erreur'); return }
            if (!ft.value.trim()) { U.toast('Donnez un titre au livrable.', 'erreur'); ft.focus(); return }
            if (!f) { U.toast('Choisissez le fichier à soumettre.', 'erreur'); return }
            if (f.size > 50 * 1024 * 1024) { U.toast('50 Mo maximum.', 'erreur'); return }
            if (!p.clientId) U.toast('Ce projet n’a pas de client : le livrable restera interne.', '')
            var b = ev.currentTarget; b.disabled = true; etat.textContent = 'Envoi en cours…'
            S().sb.post('deliverables', { project_id: p.id, titre: ft.value.trim(), type: fty.value }).then(function (d) {
              return deposer(p, f, CAT_DOC[fty.value]).then(function (doc) { return S().sb.post('deliverable_versions', { deliverable_id: d[0].id, document_id: doc.id, note: fn.value.trim() }) }).then(function () { return d[0].id })
            }).then(function (did) { U.toast('Livrable soumis au client.', 'bon'); K().go('studio/' + did) }, function (er) { etat.textContent = 'Impossible : ' + er.message; b.disabled = false })
          } }, h('span', {}, 'Soumettre au client')))) : U.etatVide('Créez d’abord un projet.', 'rocket'), etat))
      // ---- liste
      var filtre = h('select', { 'aria-label': 'Statut' }, h('option', { value: '' }, 'Tous les statuts'), Object.keys(window.CreatigoStudio.STATUTS).map(function (k) { return h('option', { value: k }, window.CreatigoStudio.STATUTS[k][0]) }))
      var boite = h('div')
      function dessiner() {
        var l = liv.filter(function (d) { return !filtre.value || d.statut === filtre.value })
        boite.replaceChildren(l.length ? U.tableau([{ titre: 'Livrable' }, { titre: 'Type' }, { titre: 'Projet' }, { titre: 'Client' }, { titre: 'Versions', num: true }, { titre: 'Statut' }, { titre: 'Mis à jour' }],
          l.map(function (d) { var p = projet(d.project_id); return [h('a', { href: '#studio/' + d.id }, d.titre), window.CreatigoStudio.TYPES[d.type] || d.type, p ? h('a', { href: '#projets/' + p.id }, p.titre) : '—', nomC(cl.filter(function (c) { return c.id === d.client_id })[0]), String(nbV(d.id)), badge(d.statut), fmt.date(d.updated_at)] }), { legende: 'Livrables' }) : U.etatVide('Aucun livrable dans cette liste.', 'palette'))
      }
      filtre.addEventListener('change', dessiner)
      zone.append(U.carte('Livrables', liv.length + ' au total · ' + liv.filter(function (d) { return d.statut === 'modifications' }).length + ' avec des modifications demandées', h('div', { class: 'pj-outils' }, filtre), boite))
      dessiner()
    }).catch(function (er) { zone.append(h('p', { class: 'msg' }, 'Studio indisponible : ' + er.message)) })
  }

  /* =====================================================================================
     STUDIO : fiche d'un livrable
     ===================================================================================== */
  function fiche(id) {
    var U = UI(), h = U.h, ic = U.icone, main = K().main, CS = window.CreatigoStudio
    var etat = { version: null, actif: null }
    main.append(h('p', {}, h('a', { href: '#studio' }, '← Tous les livrables')))
    var zone = h('div'); main.append(zone)
    function charger() {
      return Promise.all([S().sb.get('deliverables?id=eq.' + enc(id) + '&select=*'), S().sb.get('deliverable_versions?deliverable_id=eq.' + enc(id) + '&select=*&order=numero'),
        S().sb.get('deliverable_comments?deliverable_id=eq.' + enc(id) + '&select=*&order=created_at'), S().sb.get('deliverable_decisions?deliverable_id=eq.' + enc(id) + '&select=*&order=created_at'), S().list('projets')])
    }
    function dessiner() {
      charger().then(function (r) {
        var d = r[0][0], vs = r[1], coms = r[2], decs = r[3]
        if (!d) { zone.replaceChildren(U.etatVide('Livrable introuvable.', 'palette')); return }
        var p = r[4].filter(function (x) { return x.id === d.project_id })[0] || { id: d.project_id }
        var v = vs.filter(function (x) { return x.id === etat.version })[0] || vs[vs.length - 1]
        etat.version = v && v.id
        var siens = v ? coms.filter(function (c) { return c.version_id === v.id }) : []
        var points = siens.map(function (c, i) { return { n: i + 1, x: c.x == null ? null : +c.x, y: c.y == null ? null : +c.y, texte: c.body, resolu: c.resolu, auteur: c.author, id: c.id } })
        var vue = h('div', { class: 'st-vue' }, h('p', { class: 'discret' }, 'Chargement du fichier…'))
        var position = null, saisie = h('textarea', { rows: '2', maxlength: '4000', placeholder: 'Cliquez sur l’image pour placer une remarque, ou écrivez un commentaire général.' }), lieu = h('small', { class: 'discret' }, 'Commentaire général')
        function rendreVue() {
          if (!v) { vue.replaceChildren(U.etatVide('Aucune version déposée.', 'upload')); return }
          S().sb.get('documents?id=eq.' + enc(v.document_id) + '&select=path,mime,nom').then(function (dd) {
            var doc = dd[0]; if (!doc) { vue.replaceChildren(U.etatVide('Fichier introuvable.', 'file-text')); return null }
            return S().sb.fichier(doc.path).then(function (url) {
              vue.replaceChildren(CS.visionneuse({ h: h, ic: ic, url: url, mime: doc.mime, nom: doc.nom, points: points, actif: etat.actif, choisir: function (n) { etat.actif = n; var li = zone.querySelector('[data-n="' + n + '"]'); if (li) li.scrollIntoView({ block: 'nearest' }) },
                placer: function (x, y) { position = { x: x, y: y }; lieu.textContent = 'Remarque placée sur l’image'; saisie.focus() } }))
            })
          }).catch(function () { vue.replaceChildren(U.etatVide('Fichier indisponible.', 'file-text')) })
        }
        var liste = h('ol', { class: 'st-coms' }, points.length ? points.map(function (pt) {
          var c = siens[pt.n - 1]
          return h('li', { 'data-n': String(pt.n), class: (c.resolu ? 'resolu ' : '') + (c.author === 'agence' ? 'agence' : '') },
            h('span', { class: 'st-num' }, String(pt.n)),
            h('div', {}, h('b', {}, c.author === 'agence' ? 'Creatigo' : 'Client'), h('small', { class: 'discret' }, ' · ' + quand(c.created_at) + (pt.x == null ? ' · général' : '')), h('p', {}, c.body),
              h('button', { class: 'btn lien petit', type: 'button', onclick: function () { S().sb.patch('deliverable_comments?id=eq.' + enc(c.id), { resolu: !c.resolu }).then(dessiner) } }, c.resolu ? 'Rouvrir' : 'Marquer traité')))
        }) : h('li', { class: 'discret' }, 'Aucun commentaire sur cette version.'))
        var envoyer = h('button', { class: 'btn principal', type: 'button', onclick: function () {
          if (!saisie.value.trim()) { U.toast('Écrivez le commentaire.', 'erreur'); return }
          S().sb.post('deliverable_comments', { deliverable_id: d.id, version_id: v.id, author: 'agence', x: position ? position.x : null, y: position ? position.y : null, body: saisie.value.trim() }).then(function () { position = null; dessiner() }, function (er) { U.toast(er.message, 'erreur') })
        } }, 'Publier')
        // ---- nouvelle version
        var nf = h('input', { type: 'file', accept: 'image/*,video/*,application/pdf' }), nn = h('textarea', { rows: '2', maxlength: '4000', placeholder: 'Ce qui a changé (ex. logo agrandi, photo remplacée)' })
        var nouvelle = h('div', { class: 'st-nouvelle' }, h('h3', {}, 'Déposer une nouvelle version'), h('div', { class: 'pj-grille' }, h('label', {}, 'Fichier', nf), h('label', { class: 'pj-large' }, 'Ce qui a changé', nn)),
          h('button', { class: 'btn', type: 'button', onclick: function (ev) {
            var f = (nf.files || [])[0]; if (!f) { U.toast('Choisissez le fichier.', 'erreur'); return }
            var b = ev.currentTarget; b.disabled = true
            deposer(p, f, CAT_DOC[d.type] || 'livrable').then(function (doc) { return S().sb.post('deliverable_versions', { deliverable_id: d.id, document_id: doc.id, note: nn.value.trim() }) })
              .then(function (nv) { etat.version = nv[0].id; U.toast('Nouvelle version soumise : le client est prévenu.', 'bon'); dessiner() }, function (er) { U.toast('Impossible : ' + er.message, 'erreur'); b.disabled = false })
          } }, ic('upload', 15), 'Soumettre la V' + ((vs.length ? vs[vs.length - 1].numero : 0) + 1)))
        // ---- comparaison
        var compZone = h('div')
        var images = vs.filter(function (x) { return x.document_id })
        var selA = h('select', { 'aria-label': 'Version de gauche' }, images.map(function (x, i) { return h('option', { value: x.id, selected: i === images.length - 2 }, 'V' + x.numero) }))
        var selB = h('select', { 'aria-label': 'Version de droite' }, images.map(function (x, i) { return h('option', { value: x.id, selected: i === images.length - 1 }, 'V' + x.numero) }))
        var comparer = images.length > 1 ? h('div', { class: 'st-comparer' }, h('h3', {}, 'Comparer deux versions'), h('div', { class: 'pj-outils' }, selA, selB, h('button', { class: 'btn', type: 'button', onclick: function () {
          var a = images.filter(function (x) { return x.id === selA.value })[0], b = images.filter(function (x) { return x.id === selB.value })[0]
          Promise.all([a, b].map(function (x) { return S().sb.get('documents?id=eq.' + enc(x.document_id) + '&select=path').then(function (dd) { return S().sb.fichier(dd[0].path) }) })).then(function (u) {
            compZone.replaceChildren(CS.comparaison({ h: h, a: { url: u[0], titre: 'V' + a.numero }, b: { url: u[1], titre: 'V' + b.numero } }))
          }, function () { U.toast('Fichiers indisponibles.', 'erreur') })
        } }, 'Comparer')), compZone) : null
        var historique = decs.length ? h('ol', { class: 'st-histo' }, decs.slice().reverse().map(function (x) {
          var lib = { valide: 'Validée', modifications: 'Modifications demandées', refuse: 'Refusée' }[x.decision]
          return h('li', { class: x.decision }, h('b', {}, 'V' + x.numero + ' · ' + lib), h('small', { class: 'discret' }, quand(x.created_at) + ' · ' + x.par), x.commentaire ? h('p', {}, x.commentaire) : null)
        })) : h('p', { class: 'discret' }, 'Le client ne s’est pas encore prononcé.')
        zone.replaceChildren(
          U.entete(d.titre, (window.CreatigoStudio.TYPES[d.type] || '') + ' · ' + (p.titre || 'Projet') + (v ? ' · version ' + v.numero + ' du ' + quand(v.created_at) : ''), null, badge(d.statut)),
          vs.length > 1 ? h('nav', { class: 'pj-onglets', 'aria-label': 'Versions' }, vs.map(function (x) { return h('a', { href: '#studio/' + id, class: x.id === etat.version ? 'actif' : null, onclick: function (e) { e.preventDefault(); etat.version = x.id; etat.actif = null; dessiner() } }, 'V' + x.numero) })) : null,
          h('div', { class: 'st-grille' },
            h('section', { class: 'carte' }, vue, v && v.note ? h('p', { class: 'st-note' }, h('b', {}, 'Note : '), v.note) : null),
            h('div', { class: 'st-cote' },
              U.carte('Commentaires', points.filter(function (x) { return !x.resolu }).length + ' à traiter', liste, h('div', { class: 'st-saisie' }, lieu, saisie, envoyer)),
              U.carte('Décisions du client', '', historique))),
          h('section', { class: 'carte' }, nouvelle, comparer,
            h('div', { class: 'cta' }, h('button', { class: 'btn', type: 'button', onclick: function () { U.confirmer({ titre: 'Retirer ce livrable ?', texte: 'Le client ne le verra plus. Les fichiers restent dans les documents du projet.', bouton: 'Retirer', danger: true }).then(function (ok) { if (ok) S().sb.patch('deliverables?id=eq.' + enc(id), { deleted_at: new Date().toISOString() }).then(function () { K().go('studio') }) }) } }, 'Retirer le livrable'))))
        rendreVue()
      }).catch(function (er) { zone.replaceChildren(h('p', { class: 'msg' }, 'Livrable indisponible : ' + er.message)) })
    }
    dessiner()
  }

  /* =====================================================================================
     MESSAGERIE
     ===================================================================================== */
  var minuterie = null
  function messagerie(clientId, cle) {
    if (!enLigne()) return hors()
    var U = UI(), h = U.h, ic = U.icone, main = K().main
    if (minuterie) { clearInterval(minuterie); minuterie = null }
    main.append(U.entete('Messagerie', 'Les conversations avec vos clients : une par projet, plus une conversation générale.', null))
    var liste = h('nav', { class: 'ms-liste', 'aria-label': 'Conversations' }), fil = h('section', { class: 'carte ms-fil' })
    main.append(h('div', { class: 'ms-grille' }, h('section', { class: 'carte ms-gauche' }, liste), fil))
    Promise.all([S().sb.get('project_messages?select=id,client_id,project_id,author,body,lu_agence,created_at,document_id&order=created_at.desc&limit=2000'), S().list('projets'), S().list('clients'), S().sb.get('portal_accounts?select=client_id'), S().sb.get('settings?key=eq.reponses_rapides&select=value').catch(function () { return [] })]).then(function (r) {
      var msgs = r[0], pr = r[1], cl = r[2], comptes = r[3], rapides = (r[4][0] && Array.isArray(r[4][0].value)) ? r[4][0].value : []
      var avecEspace = {}; comptes.forEach(function (a) { avecEspace[a.client_id] = 1 })
      // conversations : une par projet partagé, une générale par client ayant un espace ; plus celles qui ont déjà des messages
      var convs = {}
      function cleDe(cid, pid) { return cid + '/' + (pid || 'general') }
      cl.filter(function (c) { return avecEspace[c.id] }).forEach(function (c) { convs[cleDe(c.id)] = { cid: c.id, pid: null } })
      pr.filter(function (p) { return p.clientId && avecEspace[p.clientId] && p.visibleClient !== 'non' }).forEach(function (p) { convs[cleDe(p.clientId, p.id)] = { cid: p.clientId, pid: p.id } })
      msgs.forEach(function (m) { var k = cleDe(m.client_id, m.project_id); if (!convs[k]) convs[k] = { cid: m.client_id, pid: m.project_id } })
      Object.keys(convs).forEach(function (k) {
        var c = convs[k], siens = msgs.filter(function (m) { return m.client_id === c.cid && (m.project_id || null) === c.pid })
        c.dernier = siens[0]; c.nonLus = siens.filter(function (m) { return m.author === 'client' && !m.lu_agence }).length
        c.titre = c.pid ? ((pr.filter(function (p) { return p.id === c.pid })[0] || {}).titre || 'Projet') : 'Conversation générale'
        c.client = nomC(cl.filter(function (x) { return x.id === c.cid })[0])
      })
      var ordre = Object.keys(convs).sort(function (a, b) { var x = convs[a], y = convs[b]; return (y.nonLus > 0) - (x.nonLus > 0) || ((y.dernier || {}).created_at || '').localeCompare((x.dernier || {}).created_at || '') })
      var actuelle = clientId ? clientId + '/' + (cle || 'general') : ordre[0]
      if (!ordre.length) { liste.append(U.etatVide('Aucun client n’a encore d’espace.', 'message-circle')); fil.append(U.etatVide('Les conversations apparaîtront ici.', 'message-circle')); return }
      var q = h('input', { type: 'search', placeholder: 'Rechercher un client, un projet…', 'aria-label': 'Rechercher une conversation' })
      var items = h('div', { class: 'ms-items' })
      function dessinerListe() {
        var s = q.value.trim().toLowerCase()
        items.replaceChildren.apply(items, ordre.filter(function (k) { return !s || (convs[k].client + ' ' + convs[k].titre).toLowerCase().indexOf(s) >= 0 }).map(function (k) {
          var c = convs[k]
          return h('a', { href: '#messages/' + k, class: 'ms-item' + (k === actuelle ? ' actif' : '') + (c.nonLus ? ' non-lu' : ''), 'aria-current': k === actuelle ? 'true' : null },
            h('span', { class: 'ms-av', 'aria-hidden': 'true' }, U.initiales(c.client)),
            h('span', { class: 'ms-txt' }, h('b', {}, c.client), h('small', {}, c.titre), c.dernier ? h('small', { class: 'discret' }, (c.dernier.author === 'agence' ? 'Vous : ' : '') + (c.dernier.body || 'Pièce jointe').slice(0, 60)) : h('small', { class: 'discret' }, 'Pas encore de message')),
            c.nonLus ? h('span', { class: 'ms-pastille' }, String(c.nonLus)) : null)
        }))
      }
      q.addEventListener('input', dessinerListe)
      liste.append(q, items); dessinerListe()
      var conv = convs[actuelle]; if (!conv) { fil.append(U.etatVide('Conversation introuvable.', 'message-circle')); return }

      var flux = h('div', { class: 'ms-flux', 'aria-live': 'polite' })
      var dernierAffiche = ''
      function charger() {
        var url = 'project_messages?client_id=eq.' + enc(conv.cid) + '&project_id=' + (conv.pid ? 'eq.' + enc(conv.pid) : 'is.null') + '&select=*&order=created_at&limit=500'
        return S().sb.get(url).then(function (l) {
          var sig = l.length + ':' + (l.length ? l[l.length - 1].id : '')
          if (sig === dernierAffiche) return
          dernierAffiche = sig
          flux.replaceChildren.apply(flux, l.length ? l.map(function (m) {
            var bulle = h('div', { class: 'bulle-msg' + (m.author === 'agence' ? ' moi' : '') }, h('div', { class: 'qui' }, h('b', {}, m.author === 'agence' ? 'Creatigo' : conv.client), quand(m.created_at)), m.body ? h('p', {}, m.body) : null)
            if (m.document_id) piece(bulle, m.document_id)
            return bulle
          }) : [U.etatVide('Pas encore de message. Écrivez le premier !', 'message-circle')])
          flux.scrollTop = flux.scrollHeight
          // lus par l'équipe
          if (l.some(function (m) { return m.author === 'client' && !m.lu_agence })) S().sb.patch('project_messages?client_id=eq.' + enc(conv.cid) + '&project_id=' + (conv.pid ? 'eq.' + enc(conv.pid) : 'is.null') + '&author=eq.client&lu_agence=is.null', { lu_agence: new Date().toISOString() }).then(function () { conv.nonLus = 0; dessinerListe() }).catch(function () {})
        })
      }
      function piece(bulle, did) {
        S().sb.get('documents?id=eq.' + enc(did) + '&select=nom,path,mime').then(function (dd) {
          var d = dd[0]; if (!d) return
          S().sb.fichier(d.path).then(function (u) {
            bulle.append(window.CreatigoStudio.estImage(d.mime, d.nom) ? h('a', { href: u, target: '_blank', rel: 'noopener', class: 'ms-image' }, h('img', { src: u, alt: d.nom, loading: 'lazy' })) : h('a', { class: 'ms-fichier', href: u, target: '_blank', rel: 'noopener' }, ic('file-text', 14), d.nom))
          })
        })
      }
      var texte = h('textarea', { rows: '3', maxlength: '5000', placeholder: 'Votre message…', 'aria-label': 'Message' })
      var fic = h('input', { type: 'file', 'aria-label': 'Joindre un fichier' })
      var rap = h('select', { 'aria-label': 'Réponses rapides' }, h('option', { value: '' }, 'Réponses rapides…'), rapides.map(function (x) { return h('option', { value: x }, x.length > 70 ? x.slice(0, 70) + '…' : x) }))
      rap.addEventListener('change', function () { if (rap.value) { texte.value = (texte.value ? texte.value + '\n' : '') + rap.value; rap.value = ''; texte.focus() } })
      var envoi = h('button', { class: 'btn principal', type: 'button', onclick: function () {
        var f = (fic.files || [])[0]
        if (!texte.value.trim() && !f) return
        envoi.disabled = true
        var p = conv.pid ? (pr.filter(function (x) { return x.id === conv.pid })[0] || { id: conv.pid, clientId: conv.cid }) : null
        var docP = f ? (function () {
          var chemin = 'clients/' + conv.cid + '/messages/' + Date.now().toString(36) + '-' + propre(f.name)
          return S().sb.deposer(chemin, f).then(function () { return S().sb.post('documents', { client_id: conv.cid, project_id: p ? p.id : null, categorie: 'autre', nom: f.name.slice(0, 200), path: chemin, taille: f.size, mime: f.type || '', visible_client: true, uploaded_role: 'equipe' }) }).then(function (r) { return r[0].id })
        })() : Promise.resolve(null)
        docP.then(function (did) { return S().sb.post('project_messages', { client_id: conv.cid, project_id: conv.pid, author: 'agence', body: texte.value.trim(), document_id: did }) })
          .then(function () { texte.value = ''; fic.value = ''; envoi.disabled = false; return charger() }, function (er) { U.toast('Envoi impossible : ' + er.message, 'erreur'); envoi.disabled = false })
      } }, ic('send', 15), 'Envoyer')
      texte.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) envoi.click() })
      fil.append(h('header', { class: 'ms-tete' }, h('div', {}, h('h2', {}, conv.client), h('span', { class: 'discret' }, conv.titre)), conv.pid ? h('a', { class: 'btn lien petit', href: '#projets/' + conv.pid }, 'Voir le projet') : h('a', { class: 'btn lien petit', href: '#clients/' + conv.cid }, 'Voir la fiche')),
        flux, h('div', { class: 'ms-saisie' }, texte, h('div', { class: 'ms-saisie-b' }, rap, fic, h('small', { class: 'discret' }, 'Ctrl + Entrée pour envoyer'), envoi)))
      charger()
      // nouveaux messages : vérification toutes les 20 secondes tant que la conversation est ouverte
      minuterie = setInterval(function () { if (!document.body.contains(flux)) { clearInterval(minuterie); minuterie = null; return } charger() }, 20000)
    }).catch(function (er) { fil.append(h('p', { class: 'msg' }, 'Messagerie indisponible : ' + er.message)) })
  }

  M.studio = studio
  M.messagerie = messagerie
})()
