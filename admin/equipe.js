/* Administration : équipe et rôles, journal d'activité, corbeille, notifications de la base.
   Les droits réels sont appliqués par la base (supabase/platform.sql) : ici on ne fait qu'afficher et demander.
   Tout texte venant de la base passe par textContent (jamais innerHTML). */
(function () {
  var K = function () { return window.AdminKit }
  var ROLES = [['super_admin', 'Super administrateur'], ['admin', 'Administrateur'], ['chef_projet', 'Responsable de projet'], ['collaborateur', 'Collaborateur']]
  var ROLE_AIDE = {
    super_admin: 'Tout, y compris l’équipe et les rôles.',
    admin: 'Tout sauf l’équipe : clients, devis, factures, tarifs, journal, corbeille.',
    chef_projet: 'Clients, projets, rendez-vous, espace client ; consulte les devis. Pas de factures.',
    collaborateur: 'Clients, projets, rendez-vous, espace client. Ni devis, ni factures.',
  }
  // vues de l'admin masquées selon le rôle (la base refuse de toute façon les données correspondantes)
  var MASQUE = {
    super_admin: [],
    admin: ['equipe'],
    chef_projet: ['factures', 'catalogue', 'donnees', 'equipe', 'journal'],
    collaborateur: ['devis', 'factures', 'catalogue', 'donnees', 'equipe', 'journal'],
  }
  var TABLES = [['clients', 'Clients', 'clients'], ['quotes', 'Devis', 'devis'], ['invoices', 'Factures', 'factures'], ['projects', 'Projets', 'projets'], ['appointments', 'Rendez-vous', 'rdv'], ['contact_messages', 'Messages du site', 'messages'], ['blog_posts', 'Blog', 'blog']]
  var ACTIONS = { insert: 'Création', update: 'Modification', delete: 'Suppression définitive', corbeille: 'Mise à la corbeille', restauration: 'Restauration', connexion: 'Connexion', deconnexion: 'Déconnexion', export: 'Export des données' }
  var enc = encodeURIComponent
  function lab(t, v) { var r = t.filter(function (x) { return x[0] === v })[0]; return r ? r[1] : v }
  function dt(iso) { if (!iso) return '—'; var d = new Date(iso); return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  function sb() { return K().S.sb }
  function enLigne() { var S = K().S; return S.sb && S.sb.on() }
  function horsLigne(titre) { var e = K().el, main = K().main; main.appendChild(e('h1', { text: titre })); main.appendChild(e('p', { class: 'lead', text: 'Disponible quand l’administration est connectée à la base de l’agence.' })) }
  function err(box) { return function (er) { box.textContent = 'Impossible : ' + (er && er.message ? er.message : er) } }

  /* ---------- Équipe & accès (super administrateur) ---------- */
  function equipe() {
    var e = K().el, main = K().main
    if (!enLigne()) return horsLigne('Équipe & accès')
    main.appendChild(e('h1', { text: 'Équipe & accès' }))
    main.appendChild(e('p', { class: 'lead', text: 'Qui peut entrer dans l’administration, et avec quels droits. Après avoir ajouté une adresse ici, créez le compte dans Supabase (Authentication, Users) avec la même adresse.' }))
    main.appendChild(e('div', { class: 'a-row r4' }, ROLES.map(function (r) { return e('div', { class: 'carte' }, [e('div', { class: 'carte-h' }, [e('span', { class: 'badge b-r-' + r[0], text: r[1] })]), e('p', { class: 'mut', text: ROLE_AIDE[r[0]] })]) })))
    var zone = e('div'), msg = e('p', { class: 'msg', role: 'status' })
    main.appendChild(zone); main.appendChild(msg)
    function draw() {
      zone.textContent = ''
      sb().get('staff_members?select=*&order=created_at').then(function (l) {
        var moi = K().S.auth.email().toLowerCase()
        zone.appendChild(e('div', { class: 'tw' }, [e('table', {}, [
          e('thead', {}, [e('tr', {}, ['Adresse', 'Nom', 'Rôle', 'Actif', ''].map(function (h) { return e('th', { text: h }) }))]),
          e('tbody', {}, l.map(function (m) {
            var role = e('select', { 'aria-label': 'Rôle de ' + m.email }, ROLES.map(function (r) { return e('option', { value: r[0], text: r[1], selected: r[0] === m.role }) }))
            var actif = e('input', { type: 'checkbox', 'aria-label': 'Compte actif' }); actif.checked = m.actif
            var nom = e('input', { value: m.nom || '', maxlength: 120, 'aria-label': 'Nom' })
            function save() { sb().patch('staff_members?email=eq.' + enc(m.email), { role: role.value, actif: actif.checked, nom: nom.value.trim() }).then(function () { msg.textContent = 'Enregistré.'; draw() }).catch(function (er) { msg.textContent = /super administrateur/.test(er.message) ? 'Refusé : il doit rester au moins un super administrateur actif.' : 'Impossible : ' + er.message; draw() }) }
            role.addEventListener('change', save); actif.addEventListener('change', save); nom.addEventListener('change', save)
            return e('tr', {}, [e('td', { text: m.email + (m.email === moi ? ' (vous)' : '') }), e('td', {}, [nom]), e('td', {}, [role]), e('td', {}, [actif]),
              e('td', {}, [e('button', { class: 'lnk danger', type: 'button', text: 'Retirer', onclick: function () { if (confirm('Retirer l’accès de ' + m.email + ' à l’administration ?')) sb().del('staff_members?email=eq.' + enc(m.email)).then(draw).catch(function (er) { msg.textContent = /super administrateur/.test(er.message) ? 'Refusé : il doit rester au moins un super administrateur actif.' : 'Impossible : ' + er.message }) } })])])
          }))])]))
        var mail = e('input', { type: 'email', placeholder: 'prenom@creatigo.fr', 'aria-label': 'Adresse e-mail' })
        var role = e('select', { 'aria-label': 'Rôle' }, ROLES.map(function (r) { return e('option', { value: r[0], text: r[1], selected: r[0] === 'collaborateur' }) }))
        zone.appendChild(e('div', { class: 'panel', style: 'margin-top:16px' }, [e('h2', { text: 'Ajouter une personne', style: 'margin-top:0' }), e('div', { class: 'bar' }, [K().field('Adresse e-mail', mail), K().field('Rôle', role),
          e('button', { class: 'btn', type: 'button', text: 'Ajouter', onclick: function () {
            var v = mail.value.trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { msg.textContent = 'Adresse e-mail invalide.'; return }
            sb().post('staff_members', { email: v, role: role.value }).then(function () { msg.textContent = v + ' ajouté(e). Créez maintenant son compte dans Supabase avec la même adresse.'; draw() }).catch(err(msg))
          } })])]))
      }).catch(err(msg))
    }
    draw()
  }

  /* ---------- Journal & corbeille (direction) ---------- */
  function journal() {
    var e = K().el, main = K().main, S = K().S
    if (!enLigne()) return horsLigne('Journal & corbeille')
    main.appendChild(e('h1', { text: 'Journal & corbeille' }))
    var msg = e('p', { class: 'msg', role: 'status' })
    // corbeille : éléments supprimés depuis l'interface, restaurables
    var corb = e('div', { class: 'panel' }, [e('h2', { text: 'Corbeille', style: 'margin-top:0' }), e('p', { class: 'mut', text: 'Ce qui est supprimé dans l’administration arrive ici. Restaurez-le en un clic.' })])
    main.appendChild(corb); main.appendChild(msg)
    function nomDe(t, d) { d = d || {}; return d.ref || d.titre || (d.societe ? d.societe + (d.nom ? ' · ' + d.nom : '') : d.nom) || d.sujet || d.objet || (d.client && (d.client.societe || d.client.nom)) || 'Sans titre' }
    function drawCorb() {
      while (corb.childNodes.length > 2) corb.removeChild(corb.lastChild)
      Promise.all(TABLES.map(function (t) { return sb().get(t[0] + '?deleted_at=not.is.null&select=id,data,deleted_at&order=deleted_at.desc&limit=50').then(function (l) { return l.map(function (x) { x.t = t; return x }) }, function () { return [] }) })).then(function (r) {
        var l = [].concat.apply([], r).sort(function (a, b) { return a.deleted_at < b.deleted_at ? 1 : -1 })
        if (!l.length) { corb.appendChild(e('p', { class: 'mut', text: 'La corbeille est vide.' })); return }
        corb.appendChild(e('ul', { class: 'liste' }, l.slice(0, 100).map(function (x) {
          return e('li', {}, [e('span', { class: 'badge', text: x.t[1] }), ' ', e('strong', { text: nomDe(x.t[0], x.data) }), e('span', { class: 'mut', text: ' · supprimé le ' + dt(x.deleted_at) + ' ' }),
            e('button', { class: 'lnk', type: 'button', text: 'Restaurer', onclick: function () { sb().patch(x.t[0] + '?id=eq.' + enc(x.id), { deleted_at: null }).then(function () { S.flush(x.t[2]); msg.textContent = 'Restauré.'; drawCorb(); drawLog() }).catch(err(msg)) } })])
        })))
      })
    }
    // journal : qui a fait quoi, quand
    var logBox = e('div', { class: 'panel' }, [e('h2', { text: 'Journal d’activité', style: 'margin-top:0' }), e('p', { class: 'mut', text: 'Les 200 dernières actions enregistrées par la base : créations, modifications, suppressions, connexions, exports.' })])
    main.appendChild(logBox)
    function drawLog() {
      while (logBox.childNodes.length > 2) logBox.removeChild(logBox.lastChild)
      sb().get('audit_log?select=at,actor_email,action,table_name,row_id,after,before&order=at.desc&limit=200').then(function (l) {
        if (!l.length) { logBox.appendChild(e('p', { class: 'mut', text: 'Rien pour l’instant.' })); return }
        var noms = {}; TABLES.forEach(function (t) { noms[t[0]] = t[1] }); noms.portal_accounts = 'Accès espace client'; noms.portal_requests = 'Demandes clients'; noms.portal_updates = 'Points de projet'; noms.staff_members = 'Équipe'; noms.settings = 'Réglages'; noms.documents = 'Documents'; noms.session = 'Session'
        logBox.appendChild(e('div', { class: 'tw' }, [e('table', {}, [
          e('thead', {}, [e('tr', {}, ['Quand', 'Qui', 'Action', 'Élément'].map(function (h) { return e('th', { text: h }) }))]),
          e('tbody', {}, l.map(function (x) {
            var d = (x.after && x.after.data) || (x.before && x.before.data) || x.after || x.before || {}
            return e('tr', {}, [e('td', { text: dt(x.at) }), e('td', { text: x.actor_email || 'Site public' }), e('td', { text: ACTIONS[x.action] || x.action }),
              e('td', { text: (noms[x.table_name] || x.table_name) + (x.table_name === 'session' ? '' : ' · ' + nomDe(x.table_name, d)) })])
          }))])]))
      }).catch(err(msg))
    }
    drawCorb(); drawLog()
  }

  /* ---------- notifications de la base (cloche) ---------- */
  function notifications() {
    if (!enLigne()) return Promise.resolve([])
    return sb().get('notifications?audience=eq.staff&lu_at=is.null&select=id,kind,titre,lien,created_at&order=created_at.desc&limit=20').then(function (l) {
      return l.map(function (n) { return { t: n.titre, h: n.lien || '#dashboard', id: n.id, quand: n.created_at } })
    }, function () { return [] })
  }
  function marquerLu(id) { return enLigne() ? sb().patch('notifications?id=eq.' + enc(id), { lu_at: new Date().toISOString() }).catch(function () {}) : Promise.resolve() }
  function toutLu() { return enLigne() ? sb().patch('notifications?audience=eq.staff&lu_at=is.null', { lu_at: new Date().toISOString() }).catch(function () {}) : Promise.resolve() }

  window.AdminModules = window.AdminModules || {}
  window.AdminModules.equipe = equipe
  window.AdminModules.journal = journal
  window.AdminModules.notifications = notifications
  window.AdminModules.marquerLu = marquerLu
  window.AdminModules.toutLu = toutLu
  window.AdminModules.ROLES = ROLES
  window.AdminModules.MASQUE = MASQUE
})()
