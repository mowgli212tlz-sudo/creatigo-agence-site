/* Actions de Jarvis qui modifient des données : le modèle PROPOSE, une carte s'affiche dans la discussion (ce qui va changer, texte modifiable),
   et seulement après « Confirmer » l'action est exécutée avec les services habituels de l'admin (CreatigoStore : session de la personne, règles de la
   base, journal d'audit). La donnée est ensuite RELUE pour vérifier : Jarvis ne dit « c'est fait » que si « verifie » est vrai.
   Rien ici n'est exécuté sans clic de la personne ; tout texte affiché passe par textContent. */
(function () {
  var UI = window.UI, S = window.CreatigoStore
  if (!UI || !S) return
  var h = UI.h, ic = UI.icone
  var TYPES = { appel: 'Appel', email: 'E-mail', rdv: 'Rendez-vous', message: 'Message', note: 'Note' }
  var STATUTS = { afaire: 'À faire', encours: 'En cours', relecture: 'En relecture', livre: 'Livré' }
  var propre = function (t) { return String(t || '').replace(/\s+/g, ' ').trim() }
  var norm = function (t) { return propre(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() }
  var nomC = function (c) { return [c.societe, c.nom].filter(Boolean).join(' · ') || 'Sans nom' }
  var aujourdhui = function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) }
  var fr = function (iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—' }
  var email = function () { return S.auth && S.auth.email ? S.auth.email() : '' }
  var Erreur = function (m) { var e = new Error(m); e.attendue = true; return e }
  function trouver(liste, id, quoi) { var x = liste.filter(function (o) { return o.id === id })[0]; if (!x) throw Erreur(quoi + ' introuvable (identifiant « ' + id + ' »). Lis d’abord la fiche pour obtenir le bon identifiant.'); return x }

  /* ---------- préparation : ce que la carte affichera + comment exécuter et vérifier ---------- */
  var PREPARER = {
    noter_echange_client: async function (e) {
      var c = trouver(await S.list('clients'), e.clientId, 'Client'), date = e.date || aujourdhui()
      return { titre: 'Ajouter ' + (e.type === 'note' ? 'une note' : 'un échange') + ' à « ' + nomC(c) + ' »', icone: 'square-pen',
        lignes: [['Type', TYPES[e.type]], ['Date', fr(date)]].concat(e.rappel ? [['Prochaine relance', fr(e.rappel)]] : []),
        texte: { etiquette: 'Texte de l’historique', valeur: e.texte, max: 2000 },
        executer: async function (texte) {
          var cl = trouver(await S.list('clients'), e.clientId, 'Client'), id = 'i' + Date.now().toString(36)
          cl.interactions = (Array.isArray(cl.interactions) ? cl.interactions : []).concat([{ id: id, date: date, type: e.type, texte: texte, auteur: email() }])
          if (e.rappel) cl.rappel = e.rappel
          await S.put('clients', cl)
          var relu = trouver(await S.list('clients'), e.clientId, 'Client')
          return { verifie: (relu.interactions || []).some(function (i) { return i.id === id && i.texte === texte }) && (!e.rappel || relu.rappel === e.rappel), client: nomC(c) }
        } }
    },
    fixer_rappel_client: async function (e) {
      var c = trouver(await S.list('clients'), e.clientId, 'Client')
      return { titre: 'Fixer la relance de « ' + nomC(c) + ' »', icone: 'bell',
        lignes: [['Relance actuelle', fr(c.rappel)], ['Nouvelle relance', fr(e.date)]].concat(e.date < aujourdhui() ? [['Attention', 'Cette date est déjà passée']] : []),
        executer: async function () {
          var cl = trouver(await S.list('clients'), e.clientId, 'Client'); cl.rappel = e.date; await S.put('clients', cl)
          return { verifie: trouver(await S.list('clients'), e.clientId, 'Client').rappel === e.date, client: nomC(c), relance: e.date }
        } }
    },
    changer_statut_projet: async function (e) {
      var p = trouver(await S.list('projets'), e.projetId, 'Projet')
      return { titre: 'Changer le statut de « ' + (p.titre || 'Sans titre') + ' »', icone: 'rocket',
        lignes: [['Statut actuel', STATUTS[p.statut || 'afaire'] || p.statut], ['Nouveau statut', STATUTS[e.statut]]].concat(p.clientId && p.visibleClient !== 'non' ? [['Visible par le client', 'Oui : il verra l’étape correspondante']] : []),
        executer: async function () {
          var pr = trouver(await S.list('projets'), e.projetId, 'Projet'); pr.statut = e.statut; await S.put('projets', pr)
          return { verifie: trouver(await S.list('projets'), e.projetId, 'Projet').statut === e.statut, projet: p.titre, statut: e.statut }
        } }
    },
    cocher_tache: async function (e) {
      var p = trouver(await S.list('projets'), e.projetId, 'Projet'), fait = e.fait !== false
      var cand = (p.taches || []).filter(function (t) { return norm(t.t) === norm(e.tache) })
      if (cand.length !== 1) throw Erreur(cand.length ? 'Plusieurs tâches portent ce titre : précise-la dans l’admin.' : 'Tâche introuvable : utilise le titre exact renvoyé par fiche_projet.')
      var t = cand[0]
      if ((t.sous || []).length) throw Erreur('Cette tâche a des sous-tâches : elle se coche en terminant ses sous-tâches, dans l’admin.')
      var bloc = fait ? (t.dependances || []).map(function (id) { return (p.taches || []).filter(function (x) { return x.id === id })[0] }).filter(function (x) { return x && !x.ok }) : []
      if (bloc.length) throw Erreur('Tâche bloquée : elle attend « ' + bloc.map(function (x) { return x.t }).join(' », « ') + ' ».')
      return { titre: (fait ? 'Terminer' : 'Rouvrir') + ' la tâche « ' + t.t + ' »', icone: 'circle-check',
        lignes: [['Projet', p.titre || 'Sans titre'], ['Avant', t.ok ? 'Terminée' : 'À faire'], ['Après', fait ? 'Terminée' : 'À faire']],
        executer: async function () {
          var pr = trouver(await S.list('projets'), e.projetId, 'Projet'), x = (pr.taches || []).filter(function (y) { return y.id === t.id })[0]
          if (!x) throw Erreur('La tâche a changé entre-temps.')
          x.ok = fait; if (fait) x.faiteLe = aujourdhui(); else delete x.faiteLe
          await S.put('projets', pr)
          var rx = (trouver(await S.list('projets'), e.projetId, 'Projet').taches || []).filter(function (y) { return y.id === t.id })[0]
          return { verifie: !!rx && !!rx.ok === fait, tache: t.t, terminee: fait }
        } }
    },
    repondre_message_projet: async function (e) {
      if (!(S.sb && S.sb.on())) throw Erreur('La messagerie nécessite la connexion à la base.')
      var c = trouver(await S.list('clients'), e.clientId, 'Client'), p = null
      if (e.projetId) { p = trouver(await S.list('projets'), e.projetId, 'Projet'); if (p.clientId !== c.id) throw Erreur('Ce projet n’appartient pas à ce client.') }
      return { titre: 'Envoyer un message à « ' + nomC(c) + ' »', icone: 'send', sensible: true,
        lignes: [['Destinataire', nomC(c)], ['Conversation', p ? (p.titre || 'Projet') : 'Messages généraux']].concat([['Attention', 'Le client verra ce message dans son espace']]),
        texte: { etiquette: 'Message (modifiable avant l’envoi)', valeur: e.texte, max: 2000 },
        executer: async function (texte) {
          var posted = await S.sb.post('project_messages', { client_id: c.id, project_id: p ? p.id : null, author: 'agence', body: texte })
          var l = await S.sb.get('project_messages?client_id=eq.' + encodeURIComponent(c.id) + '&author=eq.agence&select=id,body&order=created_at.desc&limit=5')
          return { verifie: (l || []).some(function (m) { return m.body === texte }) || !!(posted && posted[0]), envoye_a: nomC(c) }
        } }
    },
  }

  var ESPACE = document.body && document.body.classList.contains('espcl') ? 'client' : 'admin'
  // mémoire : une préférence que la personne a demandé de retenir (privée : même l'équipe ne la lit pas)
  PREPARER.retenir = async function (e) {
    if (!(S.sb && S.sb.on())) throw Erreur('La mémoire nécessite la connexion à la base.')
    var cat = e.categorie === 'contexte' ? 'contexte' : 'preference'
    return { titre: 'Retenir cette information', icone: 'bookmark',
      lignes: [['Catégorie', cat === 'contexte' ? 'Contexte' : 'Préférence'], ['Visible par', 'vous seul(e)']],
      texte: { etiquette: 'Ce que Jarvis retiendra (modifiable)', valeur: e.contenu, max: 300 },
      executer: async function (texte) {
        await S.sb.post('jarvis_memoire', { espace: ESPACE, contenu: texte, categorie: cat })
        var l = await S.sb.get('jarvis_memoire?select=id,contenu&order=created_at.desc&limit=5')
        return { verifie: (l || []).some(function (m) { return m.contenu === texte }) }
      } }
  }
  // espace client : deux actions seulement, avec les mêmes appels que les formulaires de l'espace (assets/portal*.js)
  async function compteClient() {
    if (!(S.sb && S.sb.on())) throw Erreur('L’envoi nécessite la connexion à votre espace.')
    var a = (await S.sb.get('portal_accounts?select=client_id,nom'))[0]
    if (!a) throw Erreur('Compte client introuvable.')
    return a
  }
  async function projetClient(id) {
    if (!id) return null
    var p = (await S.sb.get('client_projects?select=id,titre')).filter(function (x) { return x.id === id })[0]
    if (!p) throw Erreur('Projet introuvable dans votre espace.')
    return p
  }
  PREPARER.creer_demande = async function (e) {
    var a = await compteClient(), p = await projetClient(e.projetId)
    return { titre: 'Envoyer une demande à l’équipe', icone: 'send',
      lignes: [['Sujet', e.sujet], ['Projet', p ? p.titre : 'Autre sujet (pas lié à un projet)']],
      texte: { etiquette: 'Votre message (modifiable avant l’envoi)', valeur: e.texte, max: 2000 },
      executer: async function (texte) {
        var row = { client_id: a.client_id, sujet: String(e.sujet).slice(0, 200) }; if (p) row.project_id = p.id
        var r = await S.sb.post('portal_requests', row)
        await S.sb.post('portal_messages', { request_id: r[0].id, author: 'client', body: texte })
        var relu = await S.sb.get('portal_requests?id=eq.' + encodeURIComponent(r[0].id) + '&select=id,sujet')
        return { verifie: relu.length === 1, demande: row.sujet }
      } }
  }
  PREPARER.ecrire_equipe = async function (e) {
    var a = await compteClient(), p = await projetClient(e.projetId)
    return { titre: 'Écrire à l’équipe Creatigo', icone: 'send',
      lignes: [['Conversation', p ? p.titre : 'Messages généraux']],
      texte: { etiquette: 'Votre message (modifiable avant l’envoi)', valeur: e.texte, max: 2000 },
      executer: async function (texte) {
        await S.sb.post('project_messages', { client_id: a.client_id, project_id: p ? p.id : null, author: 'client', body: texte })
        var l = await S.sb.get('project_messages?author=eq.client&select=id,body&order=created_at.desc&limit=5')
        return { verifie: (l || []).some(function (m) { return m.body === texte }) }
      } }
  }

  /* ---------- cartes ---------- */
  function carte(zone, prep) {
    var zoneTexte = prep.texte ? h('textarea', { class: 'jv-carte-texte', rows: '5', maxlength: String(prep.texte.max), 'aria-label': prep.texte.etiquette }) : null
    if (zoneTexte) zoneTexte.value = prep.texte.valeur
    var etat = h('p', { class: 'jv-carte-etat', role: 'status', hidden: true })
    var refuser = h('button', { type: 'button', class: 'jv-carte-refuser' }, 'Refuser')
    var confirmer = h('button', { type: 'button', class: 'jv-carte-ok' }, prep.sensible ? 'Envoyer' : 'Confirmer')
    var el = h('section', { class: 'jv-carte' + (prep.sensible ? ' sensible' : ''), 'aria-label': 'Jarvis propose : ' + prep.titre, tabindex: '-1' },
      h('header', {}, h('span', { 'aria-hidden': 'true' }, ic(prep.icone || 'sparkles', 16)), h('div', {}, h('small', {}, 'Jarvis propose'), h('b', {}, prep.titre))),
      h('dl', {}, prep.lignes.map(function (l) { return h('div', { class: l[0] === 'Attention' ? 'attention' : '' }, h('dt', {}, l[0]), h('dd', {}, l[1])) })),
      zoneTexte ? h('label', { class: 'jv-carte-label' }, prep.texte.etiquette, zoneTexte) : null,
      etat, h('footer', {}, refuser, confirmer))
    zone.append(el); zone.scrollTop = zone.scrollHeight; el.focus({ preventScroll: false })
    return { el: el, zoneTexte: zoneTexte, etat: etat, refuser: refuser, confirmer: confirmer }
  }
  function clore(c, ton, texte) {
    c.el.classList.add('close', ton); c.refuser.hidden = true; c.confirmer.hidden = true
    if (c.zoneTexte) c.zoneTexte.disabled = true
    c.etat.hidden = false; c.etat.textContent = texte
  }

  // -> { id, statut, contenu (texte JSON), resume }
  async function traiter(appel, zone) {
    var e = appel.entree || {}
    try {
      if (appel.outil === 'ouvrir_rapport') {
        if (!window.RapportJarvis) throw Erreur('Le rapport n’est pas disponible sur cette page.')
        var rr = await window.RapportJarvis.ouvrir(e.periode)
        return { id: appel.id, statut: rr.ok ? 'ok' : 'erreur', contenu: JSON.stringify(rr.ok ? { affiche: true, periode: e.periode, note: 'Rapport ouvert à l’écran ; la personne peut l’imprimer ou l’enregistrer en PDF.' } : { erreur: rr.erreur }), resume: 'rapport ' + e.periode }
      }
      if (appel.outil === 'proposer_brouillon') {
        var area = h('textarea', { class: 'jv-carte-texte', rows: '7', readonly: '', 'aria-label': 'Brouillon' }); area.value = e.texte
        var copier = h('button', { type: 'button', class: 'jv-carte-ok' }, ic('copy', 14), 'Copier'), info = h('p', { class: 'jv-carte-etat', role: 'status', hidden: true })
        copier.addEventListener('click', function () { var ok = function () { info.hidden = false; info.textContent = 'Copié. Collez-le dans votre messagerie : Jarvis ne l’envoie pas.' }; (navigator.clipboard ? navigator.clipboard.writeText(e.texte).then(ok) : (area.select(), document.execCommand('copy'), ok())) })
        zone.append(h('section', { class: 'jv-carte brouillon', 'aria-label': 'Brouillon proposé par Jarvis' }, h('header', {}, h('span', { 'aria-hidden': 'true' }, ic('mail', 16)), h('div', {}, h('small', {}, 'Brouillon' + (e.destinataire ? ' pour ' + e.destinataire : '') + ' · rien n’est envoyé'), h('b', {}, e.titre))), area, info, h('footer', {}, copier)))
        zone.scrollTop = zone.scrollHeight
        return { id: appel.id, statut: 'ok', contenu: JSON.stringify({ affiche: true, note: 'Brouillon montré à la personne ; il n’est pas envoyé.' }), resume: 'brouillon : ' + e.titre }
      }
      var prep = await PREPARER[appel.outil](e)
      var c = carte(zone, prep)
      var decision = await new Promise(function (ok) {
        c.refuser.addEventListener('click', function () { ok({ oui: false }) })
        c.confirmer.addEventListener('click', function () {
          var t = c.zoneTexte ? c.zoneTexte.value.trim() : ''
          if (prep.texte && !t) { c.etat.hidden = false; c.etat.textContent = 'Le texte est vide : écrivez-le ou refusez.'; return }
          ok({ oui: true, texte: t })
        })
      })
      if (!decision.oui) { clore(c, 'refuse', 'Refusé : rien n’a été modifié.'); return { id: appel.id, statut: 'refuse', contenu: JSON.stringify({ erreur: 'La personne a refusé cette action. Ne la repropose pas telle quelle.' }), resume: 'refusé : ' + prep.titre } }
      var texte = decision.texte
      return await executer(appel, prep, c, texte)
    } catch (err) {
      return { id: appel.id, statut: 'erreur', contenu: JSON.stringify({ erreur: err && err.attendue ? err.message : 'Action impossible : ' + String(err && err.message || err).slice(0, 160) }), resume: String(err && err.message || err).slice(0, 120) }
    }
  }
  async function executer(appel, prep, c, texte) {
    c.confirmer.disabled = c.refuser.disabled = true; c.etat.hidden = false; c.etat.textContent = 'Enregistrement…'
    try {
      var r = await prep.executer(texte)
      var modifie = prep.texte ? texte !== prep.texte.valeur : false
      if (r.verifie) clore(c, 'ok', 'Fait et vérifié.')
      else clore(c, 'attention', 'Enregistré, mais je n’ai pas pu le revérifier : contrôlez dans l’admin.')
      return { id: appel.id, statut: 'ok', contenu: JSON.stringify(Object.assign({ confirme_par_utilisateur: true, texte_modifie_par_utilisateur: modifie }, r)), resume: prep.titre + (r.verifie ? ' (vérifié)' : ' (non vérifié)') }
    } catch (err) {
      clore(c, 'erreur', 'Échec : ' + (err && err.attendue ? err.message : 'la base a refusé ou ne répond pas.'))
      return { id: appel.id, statut: 'erreur', contenu: JSON.stringify({ erreur: err && err.attendue ? err.message : 'La modification a échoué (droits ou connexion). Rien n’a été confirmé comme fait.' }), resume: 'échec : ' + prep.titre }
    }
  }

  window.ActionsJarvis = { traiter: traiter, outils: Object.keys(PREPARER).concat(['proposer_brouillon', 'ouvrir_rapport']) }
})()
