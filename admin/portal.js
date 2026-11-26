/* Administration : espace client (côté agence).
   - bloc « Espace client » dans la fiche d'un client : adresse autorisée, projets et points d'avancement, demandes reçues
   - vue « Demandes clients » : toutes les demandes, fil de discussion et réponse
   Tout texte saisi (par un client aussi) passe par textContent / value, jamais par innerHTML.
   La sécurité est dans la base (règles par ligne, voir supabase/portal.sql et platform.sql) : ce fichier ne fait que parler à l'API.
   Projets : une seule table « projects » pour l'équipe et le client. Un projet est montré au client seulement s'il est marqué « visible ». */
(function () {
  var K = function () { return window.AdminKit }
  var ETAPES = ['Découverte', 'Conception', 'Lancement', 'Suivi']
  var STATUTS = [['ouverte', 'Ouverte'], ['en_cours', 'En cours'], ['terminee', 'Terminée']]
  var KINDS = [['livre', 'Livré'], ['attendu', 'Attendu du client'], ['info', 'Information']]
  var enc = encodeURIComponent
  function sb() { return K().S.sb }
  function lab(t, v) { var r = t.filter(function (x) { return x[0] === v })[0]; return r ? r[1] : v }
  function dt(iso) { if (!iso) return '—'; var d = new Date(iso); return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  function opts(list, sel) { return list.map(function (x) { var o = K().el('option', { value: x[0], text: x[1] }); if (x[0] === sel) o.selected = true; return o }) }
  function err(box) { return function (er) { box.textContent = 'Impossible : ' + (er && er.message ? er.message : er) } }

  /* ---------- fiche client : bloc « Espace client » ---------- */
  function portalBloc(c, box) {
    var e = K().el
    box.appendChild(e('h2', { text: 'Espace client' }))
    var zone = e('div', { class: 'panel' }), msg = e('p', { class: 'msg', role: 'status' })
    box.appendChild(zone); box.appendChild(msg)

    function draw() {
      zone.textContent = ''
      var cid = enc(c.id)
      Promise.all([
        sb().get('portal_accounts?client_id=eq.' + cid + '&select=email,nom&order=created_at'),
        sb().get('projects?client_id=eq.' + cid + '&deleted_at=is.null&select=id,data,titre,statut,etape,avancement,echeance,resume,visible_client&order=created_at.desc'),
        sb().get('portal_requests?client_id=eq.' + cid + '&select=id,sujet,statut,updated_at&order=updated_at.desc'),
      ]).then(function (r) {
        var accounts = r[0], projects = r[1], requests = r[2]
        return (projects.length ? sb().get('portal_updates?project_id=in.(' + projects.map(function (p) { return p.id }).join(',') + ')&select=*&order=created_at.desc') : Promise.resolve([])).then(function (ups) {
          accountsBlock(accounts); projectsBlock(projects, ups); requestsBlock(requests)
        })
      }).catch(err(msg))
    }

    function accountsBlock(accounts) {
      zone.appendChild(e('h3', { text: 'Accès à l’espace client' }))
      zone.appendChild(e('p', { class: 'mut', text: 'Seules les adresses listées ici peuvent voir les projets de ce client. Après avoir autorisé une adresse, invitez la personne dans Supabase (Authentication, Users, « Invite user ») avec la même adresse : elle choisira son mot de passe.' }))
      zone.appendChild(accounts.length ? e('ul', { class: 'liste' }, accounts.map(function (a) {
        return e('li', {}, [a.email, ' ', e('button', { class: 'lnk danger', type: 'button', text: 'Retirer', onclick: function () { if (confirm('Retirer l’accès de ' + a.email + ' ?')) sb().del('portal_accounts?email=eq.' + enc(a.email)).then(draw).catch(err(msg)) } })])
      })) : e('p', { class: 'mut', text: 'Aucune adresse autorisée pour l’instant.' }))
      var mail = e('input', { type: 'email', placeholder: 'adresse@client.fr', value: accounts.length ? '' : (c.email || ''), 'aria-label': 'Adresse e-mail du client' })
      zone.appendChild(e('div', { class: 'bar' }, [K().field('Autoriser une adresse', mail), e('button', { class: 'btn ghost', type: 'button', text: 'Autoriser', onclick: function () {
        var v = mail.value.trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { msg.textContent = 'Adresse e-mail invalide.'; return }
        sb().upsert('portal_accounts?on_conflict=email', [{ email: v, client_id: c.id, nom: c.nom || c.societe || '' }]).then(function () { msg.textContent = 'Adresse autorisée.'; draw() }).catch(err(msg))
      } })]))
    }

    function projectsBlock(projects, ups) {
      zone.appendChild(e('h3', { text: 'Projets et partage avec le client' }))
      zone.appendChild(e('p', { class: 'mut', text: 'Ce sont les mêmes projets que dans « Projets ». Cochez « Visible par le client » pour qu’il le suive dans son espace : il voit le titre, l’étape, l’avancement, l’échéance, le résumé et les points ci-dessous, jamais le budget ni les notes.' }))
      if (!projects.length) zone.appendChild(e('p', { class: 'mut', text: 'Aucun projet pour ce client.' }))
      projects.forEach(function (p) {
        var data = p.data || {}, auto = Array.isArray(data.taches) && data.taches.length > 0
        var f = {
          visible: e('input', { type: 'checkbox' }),
          titre: e('input', { value: p.titre, maxlength: 200 }),
          etape: e('select', {}, opts(ETAPES.map(function (n, i) { return [String(i + 1), (i + 1) + '. ' + n] }), String(p.etape))),
          avancement: e('input', { type: 'number', min: 0, max: 100, value: p.avancement, disabled: auto }),
          echeance: e('input', { type: 'date', value: p.echeance || '' }),
          resume: e('textarea', { rows: 3, maxlength: 2000 }),
        }
        f.visible.checked = !!p.visible_client
        f.resume.value = p.resume || ''
        var card = e('div', { class: 'panel pa-in' }, [
          e('label', { class: 'chk' }, [f.visible, ' Visible par le client']),
          K().field('Titre', f.titre), K().field('Étape', f.etape), K().field(auto ? 'Avancement (%) : calculé à partir des tâches' : 'Avancement (%)', f.avancement), K().field('Prochaine échéance', f.echeance), K().field('Résumé affiché au client', f.resume),
          e('div', { class: 'cta' }, [
            e('button', { class: 'btn', type: 'button', text: 'Enregistrer le projet', onclick: function () {
              var nd = {}; for (var k in data) nd[k] = data[k]
              nd.titre = f.titre.value.trim() || p.titre; nd.echeance = f.echeance.value || ''; nd.clientId = c.id; nd.visibleClient = f.visible.checked ? 'oui' : 'non'
              var row = { data: nd, etape: +f.etape.value, echeance: f.echeance.value || null, resume: f.resume.value, visible_client: f.visible.checked }
              if (!auto) row.avancement = Math.max(0, Math.min(100, +f.avancement.value || 0))
              sb().patch('projects?id=eq.' + enc(p.id), row).then(function () { K().S.flush('projets'); msg.textContent = 'Projet enregistré.'; draw() }).catch(err(msg))
            } }),
            e('a', { class: 'lnk', href: '#projets/' + p.id, text: 'Ouvrir la fiche projet' }),
            e('button', { class: 'lnk danger', type: 'button', text: 'Mettre à la corbeille', onclick: function () { if (confirm('Mettre ce projet à la corbeille ? Le client ne le verra plus. La direction peut le restaurer.')) sb().patch('projects?id=eq.' + enc(p.id), { deleted_at: new Date().toISOString() }).then(function () { K().S.flush('projets'); draw() }).catch(err(msg)) } }),
          ]),
        ])
        // points du projet
        card.appendChild(e('h4', { text: 'Points d’avancement' }))
        var mine = ups.filter(function (u) { return u.project_id === p.id })
        card.appendChild(mine.length ? e('ul', { class: 'liste' }, mine.map(function (u) {
          return e('li', {}, [
            e('span', { class: 'badge b-' + (u.kind === 'livre' ? 'terminee' : u.kind === 'attendu' ? 'en_cours' : 'ouverte'), text: lab(KINDS, u.kind) }), ' ', e('strong', { text: u.titre }), u.detail ? ' · ' + u.detail : '', ' ',
            u.kind === 'attendu' ? e('button', { class: 'lnk', type: 'button', text: u.fait ? 'Marquer non fait' : 'Marquer fait', onclick: function () { sb().patch('portal_updates?id=eq.' + enc(u.id), { fait: !u.fait }).then(draw).catch(err(msg)) } }) : null,
            u.kind === 'attendu' && u.fait ? ' ✓ ' : ' ',
            e('button', { class: 'lnk danger', type: 'button', text: 'Retirer', onclick: function () { sb().del('portal_updates?id=eq.' + enc(u.id)).then(draw).catch(err(msg)) } }),
          ])
        })) : e('p', { class: 'mut', text: 'Aucun point pour l’instant.' }))
        var k = e('select', {}, opts(KINDS, 'livre')), t = e('input', { placeholder: 'Titre (ex. Maquette de la page d’accueil)', maxlength: 200 }), d = e('input', { placeholder: 'Détail (facultatif)', maxlength: 2000 })
        card.appendChild(e('div', { class: 'bar' }, [K().field('Type', k), K().field('Titre', t), K().field('Détail', d), e('button', { class: 'btn ghost', type: 'button', text: 'Ajouter ce point', onclick: function () {
          if (!t.value.trim()) { msg.textContent = 'Indiquez un titre.'; return }
          sb().post('portal_updates', { project_id: p.id, kind: k.value, titre: t.value.trim(), detail: d.value.trim() }).then(draw).catch(err(msg))
        } })]))
        zone.appendChild(card)
      })
      var nt = e('input', { placeholder: 'Titre du nouveau projet', maxlength: 200 })
      zone.appendChild(e('div', { class: 'bar' }, [K().field('Nouveau projet partagé', nt), e('button', { class: 'btn ghost', type: 'button', text: 'Créer le projet', onclick: function () {
        if (!nt.value.trim()) { msg.textContent = 'Indiquez un titre.'; return }
        sb().post('projects', { data: { titre: nt.value.trim(), clientId: c.id, statut: 'encours', taches: [], desc: '' }, visible_client: true }).then(function () { K().S.flush('projets'); draw() }).catch(err(msg))
      } })]))
    }

    function requestsBlock(requests) {
      zone.appendChild(e('h3', { text: 'Demandes reçues' }))
      zone.appendChild(requests.length ? e('ul', { class: 'liste' }, requests.map(function (q) {
        return e('li', {}, [e('a', { href: '#demandes/' + q.id, text: q.sujet }), ' · ', e('span', { class: 'badge b-' + q.statut, text: lab(STATUTS, q.statut) }), ' · ' + dt(q.updated_at)])
      })) : e('p', { class: 'mut', text: 'Aucune demande.' }))
    }
    draw()
  }

  /* ---------- vue « Demandes clients » ---------- */
  function demandes(id) {
    var e = K().el, S = K().S, main = K().main
    if (!(S.sb && S.sb.on())) { main.appendChild(e('h1', { text: 'Demandes clients' })); main.appendChild(e('p', { class: 'lead', text: 'Les demandes des clients arrivent ici quand la base est connectée.' })); return }
    return id ? fil(id) : liste()

    function liste() {
      main.appendChild(e('h1', { text: 'Demandes clients' }))
      var st = e('select', {}, [e('option', { value: '', text: 'Toutes' })].concat(opts(STATUTS, ''))), zone = e('div'), msg = e('p', { class: 'msg', role: 'status' })
      st.value = 'ouverte'
      main.appendChild(e('div', { class: 'bar' }, [K().field('Afficher', st)])); main.appendChild(zone); main.appendChild(msg)
      Promise.all([sb().get('portal_requests?select=id,client_id,project_id,sujet,statut,updated_at&order=updated_at.desc&limit=500'), S.list('clients')]).then(function (r) {
        var names = {}; r[1].forEach(function (c) { names[c.id] = c.societe ? c.societe + (c.nom ? ' · ' + c.nom : '') : c.nom || 'Sans nom' })
        function draw() {
          zone.textContent = ''
          var rows = r[0].filter(function (q) { return !st.value || q.statut === st.value })
          if (!rows.length) { zone.appendChild(e('p', { class: 'lead', text: 'Aucune demande dans cette liste.' })); return }
          zone.appendChild(e('div', { class: 'tw' }, [e('table', {}, [e('thead', {}, [e('tr', {}, ['Client', 'Sujet', 'Statut', 'Dernière activité'].map(function (h) { return e('th', { text: h }) }))]), e('tbody', {}, rows.map(function (q) {
            return e('tr', {}, [e('td', { text: names[q.client_id] || q.client_id }), e('td', {}, [e('a', { href: '#demandes/' + q.id, text: q.sujet })]), e('td', {}, [e('span', { class: 'badge b-' + q.statut, text: lab(STATUTS, q.statut) })]), e('td', { text: dt(q.updated_at) })])
          }))])]))
        }
        st.addEventListener('change', draw); draw()
      }).catch(err(msg))
    }

    function fil(rid) {
      var msg = e('p', { class: 'msg', role: 'status' })
      main.appendChild(e('p', {}, [e('a', { href: '#demandes', text: '← Toutes les demandes' })]))
      var box = e('div'); main.appendChild(box); main.appendChild(msg)
      function draw() {
        box.textContent = ''
        Promise.all([sb().get('portal_requests?id=eq.' + enc(rid) + '&select=*'), sb().get('portal_messages?request_id=eq.' + enc(rid) + '&select=*&order=created_at.asc'), S.list('clients')]).then(function (r) {
          var q = r[0][0]; if (!q) { box.appendChild(e('p', { class: 'lead', text: 'Demande introuvable.' })); return }
          var c = r[2].filter(function (x) { return x.id === q.client_id })[0]
          box.appendChild(e('h1', { text: q.sujet }))
          box.appendChild(e('p', { class: 'mut' }, [c ? e('a', { href: '#clients/' + c.id, text: c.societe || c.nom || 'Client' }) : q.client_id, ' · ouverte le ' + dt(q.created_at) + ' · ', e('span', { class: 'badge b-' + q.statut, text: lab(STATUTS, q.statut) })]))
          var fil = e('div', { class: 'panel' }, r[1].map(function (m) {
            return e('div', { class: 'pa-msg' + (m.author === 'agence' ? ' ag' : '') }, [
              e('strong', { text: m.author === 'agence' ? 'Agence' : (c && (c.nom || c.societe)) || 'Client' }), e('span', { class: 'mut', text: ' · ' + dt(m.created_at) }),
              e('p', { style: 'white-space:pre-wrap;margin:6px 0 0', text: m.body })])
          }))
          box.appendChild(fil)
          var rep = e('textarea', { rows: 4, maxlength: 5000, placeholder: 'Votre réponse au client…', 'aria-label': 'Réponse' })
          var st = e('select', {}, opts(STATUTS, q.statut))
          box.appendChild(e('div', { class: 'panel', style: 'margin-top:16px' }, [K().field('Réponse', rep), K().field('Statut de la demande', st), e('div', { class: 'cta' }, [
            e('button', { class: 'btn', type: 'button', text: 'Envoyer la réponse', onclick: function () {
              var texte = rep.value.trim()
              var suite = function () { return st.value !== q.statut ? sb().patch('portal_requests?id=eq.' + enc(rid), { statut: st.value }) : null }
              var go = texte ? sb().post('portal_messages', { request_id: rid, author: 'agence', body: texte }).then(function () { return q.statut === 'ouverte' && st.value === 'ouverte' ? sb().patch('portal_requests?id=eq.' + enc(rid), { statut: 'en_cours' }) : suite() }) : Promise.resolve(suite())
              Promise.resolve(go).then(draw).catch(err(msg))
            } }),
            e('button', { class: 'lnk danger', type: 'button', text: 'Supprimer la demande', onclick: function () { if (confirm('Supprimer cette demande et ses messages ?')) sb().del('portal_requests?id=eq.' + enc(rid)).then(function () { K().go('demandes') }).catch(err(msg)) } }),
          ])]))
        }).catch(err(msg))
      }
      draw()
    }
  }

  window.AdminModules = window.AdminModules || {}
  window.AdminModules.portalBloc = portalBloc
  window.AdminModules.demandes = demandes
})()
