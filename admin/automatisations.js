/* Administration : automatisations (phase 8).
   - #automatisations : liste (activation, dernières exécutions, échecs), modèles prêts à l'emploi, historique, e-mails en attente
   - #automatisations/<id> : constructeur visuel (déclencheur → conditions → actions reliées), test à blanc, exécution sur un élément,
     historique détaillé étape par étape, nouvelle tentative
   L'exécution se fait DANS LA BASE (supabase/automations.sql) : déclencheurs sur les données, rien ne dépend de cette page.
   Modifier : direction (super_admin, admin). Lire et tester : toute l'équipe. */
(function () {
  var K = function () { return window.AdminKit }
  var UI = function () { return window.UI }
  var M = window.AdminModules = window.AdminModules || {}
  var enc = encodeURIComponent
  function S() { return K().S }
  function enLigne() { return S().sb && S().sb.on() }
  function direction() { var r = K().role(); return r === 'super_admin' || r === 'admin' }
  function quand(iso) { var d = new Date(iso); return d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  function erreur(er) { var m = String((er && er.message) || er); var x = /"message":"([^"]+)"/.exec(m); return x ? x[1] : m }
  function nomC(c) { return c ? (c.societe ? c.societe + (c.nom ? ' · ' + c.nom : '') : c.nom) || 'Sans nom' : '—' }

  var DECL = {
    nouveau_prospect: ['Nouveau prospect', 'user-plus', 'client', 'Une fiche est créée avec le statut « prospect ».'],
    nouveau_client: ['Nouveau client', 'user-check', 'client', 'Une fiche passe (ou est créée) au statut « client actif ».'],
    devis_accepte: ['Devis accepté', 'file-signature', 'devis', 'Un devis passe à « accepté » (dans l’espace client ou ici).'],
    paiement_recu: ['Paiement reçu', 'wallet', 'facture', 'Un paiement est enregistré sur une facture.'],
    facture_retard: ['Facture en retard', 'circle-alert', 'facture', 'Une facture envoyée dépasse son échéance (vérifié toutes les 15 min).'],
    nouveau_message: ['Nouveau message', 'message-circle', 'projet', 'Un client écrit dans la messagerie, ou un message arrive par le formulaire du site.'],
    tache_terminee: ['Tâche terminée', 'list-checks', 'projet', 'Une tâche d’un projet est cochée.'],
    projet_livre: ['Projet livré', 'rocket', 'projet', 'Un projet passe au statut « livré ».'],
    contrat_echeance: ['Contrat arrivant à échéance', 'calendar-clock', 'contrat', 'Un contrat signé arrive à sa date de fin (vérifié toutes les 15 min).'],
  }
  var ACT = {
    notification: ['Envoyer une notification', 'bell'], email: ['Envoyer un e-mail', 'mail'], tache: ['Créer des tâches', 'list-checks'],
    statut: ['Changer un statut', 'sliders-horizontal'], relance: ['Programmer une relance', 'calendar-clock'], document: ['Générer un document', 'file-text'],
    responsable: ['Assigner un responsable', 'user-check'], projet: ['Créer le projet (depuis le devis)', 'rocket'],
  }
  var RUN = { reussi: ['Réussie', 'bon'], echec: ['Échec : nouvelle tentative prévue', 'attention'], abandon: ['Échec définitif', 'critique'], en_cours: ['En cours', 'info'], test: ['Test à blanc', ''] }
  var MODELES = [
    { nom: 'Devis accepté : lancement du projet', description: 'Projet, tâches initiales, acompte, contrat et notification au client.', declencheur: 'devis_accepte', conditions: {}, etapes: [
      { type: 'projet', params: {} }, { type: 'tache', params: { titres: 'Réunion de lancement avec {client}\nCollecte des contenus et accès\nPremière maquette', delai: 7 } },
      { type: 'document', params: { modele: 'facture_acompte' } }, { type: 'document', params: { modele: 'contrat' } },
      { type: 'notification', params: { pour: 'client', titre: 'Votre projet {projet} démarre : merci pour votre confiance' } }, { type: 'notification', params: { pour: 'equipe', titre: 'Devis {devis} accepté par {client} ({montant} HT)' } }] },
    { nom: 'Nouveau prospect : premier contact', description: 'Prévenir l’équipe et programmer un appel sous 2 jours.', declencheur: 'nouveau_prospect', conditions: {}, etapes: [
      { type: 'notification', params: { pour: 'equipe', titre: 'Nouveau prospect : {client}' } }, { type: 'relance', params: { delai: 2, note: 'Premier appel à {client}' } },
      { type: 'email', params: { a: 'client', sujet: 'Merci pour votre demande, {client}', corps: 'Bonjour,\n\nMerci pour votre demande. Nous revenons vers vous très vite.\n\nL’équipe Creatigo' } }] },
    { nom: 'Facture en retard : relance', description: 'Relancer le client 7 jours après l’échéance.', declencheur: 'facture_retard', conditions: { jours_retard: 7 }, etapes: [
      { type: 'notification', params: { pour: 'equipe', titre: 'Facture {facture} en retard ({client})' } }, { type: 'relance', params: { delai: 0, note: 'Relancer le paiement de la facture {facture}' } },
      { type: 'email', params: { a: 'client', sujet: 'Rappel : facture {facture}', corps: 'Bonjour,\n\nSauf erreur de notre part, la facture {facture} ({montant} TTC) arrivée à échéance n’a pas encore été réglée.\n\nL’équipe Creatigo' } }] },
    { nom: 'Paiement reçu : remerciement', description: 'Prévenir l’équipe et remercier le client.', declencheur: 'paiement_recu', conditions: {}, etapes: [
      { type: 'notification', params: { pour: 'equipe', titre: 'Paiement reçu : facture {facture} ({client})' } }, { type: 'notification', params: { pour: 'client', titre: 'Nous avons bien reçu votre paiement pour la facture {facture}. Merci !' } }] },
    { nom: 'Projet livré : suivi de satisfaction', description: 'Féliciter le client et prévoir un point dans 30 jours.', declencheur: 'projet_livre', conditions: {}, etapes: [
      { type: 'notification', params: { pour: 'client', titre: 'Votre projet {projet} est livré !' } }, { type: 'relance', params: { delai: 30, note: 'Point de satisfaction après la livraison de {projet}' } }] },
    { nom: 'Contrat bientôt échu : renouvellement', description: 'Préparer le renouvellement 30 jours avant la fin.', declencheur: 'contrat_echeance', conditions: { jours_avant: 30 }, etapes: [
      { type: 'notification', params: { pour: 'equipe', titre: 'Le contrat {contrat} de {client} arrive à échéance' } }, { type: 'relance', params: { delai: 0, note: 'Proposer le renouvellement du contrat {contrat}' } }] },
    { nom: 'Message client : alerte équipe', description: 'Prévenir l’équipe dès qu’un client écrit.', declencheur: 'nouveau_message', conditions: { origine: 'espace_client' }, etapes: [
      { type: 'notification', params: { pour: 'equipe', titre: 'Nouveau message de {client} : {message}' } }] },
  ]

  function hors(main) { main.append(UI().etatVide('Disponible quand l’administration est connectée à la base (script supabase/automations.sql).', 'database')) }
  function onglets(actif) {
    var U = UI(), h = U.h
    return h('nav', { class: 'pj-onglets noprint', 'aria-label': 'Sections' }, [['liste', 'Automatisations', '#automatisations', 'sliders-horizontal'], ['historique', 'Historique', '#automatisations/historique', 'history'], ['courriels', 'E-mails préparés', '#automatisations/courriels', 'mail']].map(function (o) {
      return h('a', { href: o[2], class: o[0] === actif ? 'actif' : null, 'aria-current': o[0] === actif ? 'page' : null }, U.icone(o[3], 15), o[1])
    }))
  }
  // événements datés et nouvelles tentatives, si la planification (pg_cron) n'est pas active
  var tickFait = false
  function tick() { if (tickFait) return Promise.resolve(); tickFait = true; return S().rpc('automation_tick', {}).catch(function () {}) }

  /* ---------- liste ---------- */
  function liste(main) {
    var U = UI(), h = U.h
    tick().then(function () {
      return Promise.all([S().sb.get('automations?deleted_at=is.null&select=*&order=created_at'), S().sb.get('automation_runs?select=automation_id,statut,created_at&order=created_at.desc&limit=2000')])
    }).then(function (r) {
      var au = r[0], runs = r[1], par = {}
      runs.forEach(function (x) { (par[x.automation_id] = par[x.automation_id] || []).push(x) })
      var echecs = runs.filter(function (x) { return x.statut === 'echec' || x.statut === 'abandon' }).length
      main.append(h('div', { class: 'grille kpi' },
        U.tuile('Automatisations actives', String(au.filter(function (a) { return a.actif }).length), 'sur ' + au.length, false, { icone: 'sliders-horizontal' }),
        U.tuile('Exécutions réussies', String(runs.filter(function (x) { return x.statut === 'reussi' }).length), 'historique conservé', false, { icone: 'circle-check' }),
        U.tuile('Échecs', String(echecs), echecs ? 'à regarder dans l’historique' : 'aucun', echecs > 0, { icone: 'circle-alert' })))
      main.append(U.carte('Vos automatisations', direction() ? '' : 'lecture seule : seule la direction modifie', au.length ? h('div', { class: 'au-liste' }, au.map(function (a) {
        var d = DECL[a.declencheur], l = par[a.id] || [], der = l.filter(function (x) { return x.statut !== 'test' })[0]
        var bascule = h('input', { type: 'checkbox', role: 'switch', checked: a.actif, disabled: !direction(), 'aria-label': 'Activer ' + a.nom, onchange: function (e) {
          var v = e.currentTarget.checked
          S().sb.patch('automations?id=eq.' + enc(a.id), { actif: v }).then(function () { U.toast(v ? 'Automatisation activée.' : 'Automatisation désactivée.', 'bon') }, function (er) { e.currentTarget.checked = !v; U.toast(erreur(er), 'erreur') })
        } })
        return h('div', { class: 'au-ligne' + (a.actif ? '' : ' off') },
          h('span', { class: 'au-ico', 'aria-hidden': 'true' }, U.icone(d[1], 18)),
          h('a', { class: 'au-t', href: '#automatisations/' + a.id }, h('b', {}, a.nom), h('small', { class: 'discret' }, 'Quand : ' + d[0] + ' · ' + U.fmt.pluriel(a.etapes.length, 'action'))),
          h('span', { class: 'au-der' }, der ? [U.badge(RUN[der.statut][0], RUN[der.statut][1]), h('small', { class: 'discret' }, ' ' + quand(der.created_at))] : h('small', { class: 'discret' }, 'jamais exécutée')),
          h('label', { class: 'au-switch' }, bascule, h('span', {}, a.actif ? 'Active' : 'Inactive')))
      })) : U.etatVide('Aucune automatisation. Partez d’un modèle ci-dessous ou créez la vôtre.', 'sliders-horizontal'),
        direction() ? h('div', { class: 'cta' }, h('button', { class: 'btn principal', type: 'button', onclick: function () { creer({ nom: 'Nouvelle automatisation', declencheur: 'nouveau_prospect', conditions: {}, etapes: [] }) } }, U.icone('plus', 15), 'Nouvelle automatisation')) : null))
      if (direction()) main.append(U.carte('Modèles prêts à l’emploi', 'créés désactivés : relisez-les, testez-les, puis activez-les', h('div', { class: 'au-modeles' }, MODELES.map(function (m) {
        return h('button', { class: 'au-modele', type: 'button', onclick: function () { creer(m) } }, h('span', { class: 'au-ico' }, U.icone(DECL[m.declencheur][1], 18)), h('b', {}, m.nom), h('small', { class: 'discret' }, m.description),
          h('span', { class: 'au-mini' }, [DECL[m.declencheur][0]].concat(m.etapes.map(function (e) { return ACT[e.type][0] })).join(' → ')))
      }))))
    }).catch(function (er) { main.append(UI().etatVide('Lecture impossible : ' + erreur(er) + '. Le script supabase/automations.sql a-t-il été lancé ?', 'database')) })
  }
  function creer(m) {
    S().sb.post('automations', { nom: m.nom, description: m.description || '', declencheur: m.declencheur, conditions: m.conditions || {}, etapes: m.etapes || [], actif: false })
      .then(function (r) { K().go('automatisations/' + r[0].id) }, function (er) { UI().toast(erreur(er), 'erreur') })
  }

  /* ---------- constructeur ---------- */
  function fiche(main, id) {
    var U = UI(), h = U.h, edit = direction()
    Promise.all([S().sb.get('automations?id=eq.' + enc(id) + '&select=*'), S().sb.get('staff_members?actif=eq.true&select=email,role').catch(function () { return [] }), S().list('clients')]).then(function (r) {
      var a = r[0][0]; if (!a) { main.append(U.etatVide('Automatisation introuvable.', 'sliders-horizontal')); return }
      var equipe = r[1], clients = r[2]
      var etat = { nom: a.nom, description: a.description, declencheur: a.declencheur, conditions: Object.assign({}, a.conditions), etapes: JSON.parse(JSON.stringify(a.etapes)), actif: a.actif }
      var modifie = false
      var titre = h('input', { class: 'au-nom', value: a.nom, maxlength: '120', disabled: !edit, 'aria-label': 'Nom de l’automatisation', oninput: function () { etat.nom = titre.value; marquer() } })
      var desc = h('input', { value: a.description || '', maxlength: '1000', placeholder: 'À quoi sert-elle ? (facultatif)', disabled: !edit, 'aria-label': 'Description', oninput: function () { etat.description = desc.value; marquer() } })
      var bEnr = h('button', { class: 'btn principal', type: 'button', disabled: true, onclick: enregistrer }, 'Enregistrer')
      var actif = h('input', { type: 'checkbox', role: 'switch', checked: a.actif, disabled: !edit, onchange: function () { etat.actif = actif.checked; marquer() } })
      function marquer() { modifie = true; bEnr.disabled = !edit; bEnr.textContent = 'Enregistrer les modifications' }
      function enregistrer() {
        if (!etat.nom.trim()) { U.toast('Donnez un nom.', 'erreur'); return }
        bEnr.disabled = true
        S().sb.patch('automations?id=eq.' + enc(id), { nom: etat.nom.trim(), description: etat.description.trim(), declencheur: etat.declencheur, conditions: etat.conditions, etapes: etat.etapes, actif: etat.actif })
          .then(function () { modifie = false; bEnr.textContent = 'Enregistré'; U.toast('Automatisation enregistrée.', 'bon') }, function (er) { bEnr.disabled = false; U.toast(erreur(er), 'erreur') })
      }
      main.append(h('div', { class: 'au-entete' }, h('a', { class: 'btn petit', href: '#automatisations' }, U.icone('chevron-left', 15), 'Automatisations'),
        h('div', { class: 'au-entete-t' }, titre, desc), h('label', { class: 'au-switch' }, actif, h('span', {}, 'Active')), edit ? bEnr : U.badge('Lecture seule', '')))
      var flux = h('div', { class: 'au-flux', 'aria-label': 'Enchaînement' }), cote = h('div', { class: 'au-cote' })
      main.append(h('div', { class: 'au-grille' }, flux, cote))

      // ---- rendu du flux ----
      function champ(l, i) { return h('label', { class: 'au-champ' }, h('span', {}, l), i) }
      function inp(o, k, attrs) { var x = h('input', Object.assign({ value: o[k] == null ? '' : o[k], disabled: !edit, oninput: function () { o[k] = x.type === 'number' ? (x.value === '' ? '' : +x.value) : x.value; marquer() } }, attrs || {})); return x }
      function sel(o, k, opts) { var x = h('select', { disabled: !edit, onchange: function () { o[k] = x.value; marquer(); dessiner() } }, opts.map(function (v) { return h('option', { value: v[0], selected: String(o[k] == null ? opts[0][0] : o[k]) === String(v[0]) }, v[1]) })); return x }
      function zone(o, k, attrs) { var x = h('textarea', Object.assign({ rows: '3', disabled: !edit, oninput: function () { o[k] = x.value; marquer() } }, attrs || {}), o[k] || ''); return x }
      function params(e) {
        var p = e.params = e.params || {}
        if (e.type === 'notification') return [champ('Pour', sel(p, 'pour', [['equipe', 'L’équipe'], ['client', 'Le client (espace client)']])), champ('Texte', inp(p, 'titre', { maxlength: '300', placeholder: 'ex. Nouveau prospect : {client}' }))]
        if (e.type === 'email') return [champ('Destinataire', sel(p, 'a', [['client', 'Le client (adresse de sa fiche)'], ['adresse', 'Une adresse précise']])), p.a === 'adresse' ? champ('Adresse', inp(p, 'adresse', { type: 'email', maxlength: '320' })) : null,
          champ('Objet', inp(p, 'sujet', { maxlength: '300' })), champ('Message', zone(p, 'corps', { rows: '4', maxlength: '20000' })), h('p', { class: 'au-note' }, U.icone('info', 14), 'Service d’envoi non connecté : l’e-mail est préparé et visible dans « E-mails préparés », il partira quand l’envoi sera branché.')]
        if (e.type === 'tache') return [champ('Tâches (une par ligne)', zone(p, 'titres', { rows: '4', maxlength: '3000', placeholder: 'Réunion de lancement\nCollecte des contenus' })), champ('Échéance (jours après)', inp(p, 'delai', { type: 'number', min: '0', max: '999' })),
          champ('Responsable', sel(p, 'responsable', [['', 'Personne']].concat(equipe.map(function (m) { return [m.email, m.email] }))))]
        if (e.type === 'statut') return [champ('Fiche', sel(p, 'cible', [['projet', 'Le projet'], ['client', 'Le client']])), champ('Nouveau statut', sel(p, 'valeur', (p.cible === 'client' ? [['prospect', 'Prospect'], ['actif', 'Client actif'], ['inactif', 'Inactif']] : [['afaire', 'À faire'], ['encours', 'En cours'], ['relecture', 'En relecture'], ['livre', 'Livré']])))]
        if (e.type === 'relance') return [champ('Dans (jours)', inp(p, 'delai', { type: 'number', min: '0', max: '999', placeholder: '7' })), champ('Note', inp(p, 'note', { maxlength: '300', placeholder: 'ex. Rappeler {client}' }))]
        if (e.type === 'document') return [champ('Document', sel(p, 'modele', [['facture_acompte', 'Facture d’acompte (brouillon)'], ['contrat', 'Contrat (brouillon)']])), p.modele === 'contrat' ? null : champ('Acompte (%)', inp(p, 'pourcentage', { type: 'number', min: '1', max: '100', placeholder: 'celui du devis, sinon 30' })),
          h('p', { class: 'au-note' }, U.icone('info', 14), 'Créé en brouillon, jamais envoyé automatiquement. Rien n’est créé en double.')]
        if (e.type === 'responsable') return [champ('Responsable', sel(p, 'email', [['', 'Choisir…']].concat(equipe.map(function (m) { return [m.email, m.email + ' (' + m.role + ')'] }))))]
        if (e.type === 'projet') return [h('p', { class: 'au-note' }, U.icone('info', 14), 'Crée le projet lié au devis s’il n’existe pas encore (l’acceptation dans l’espace client le crée déjà).')]
        return []
      }
      function bloc(e, i) {
        var a2 = ACT[e.type] || [e.type, 'circle-help']
        return h('div', { class: 'au-bloc action' },
          h('div', { class: 'au-bloc-tete' }, h('span', { class: 'au-ico' }, U.icone(a2[1], 16)), h('b', {}, (i + 1) + '. ' + a2[0]),
            edit ? h('span', { class: 'au-outils' },
              h('button', { class: 'btn-icone', type: 'button', disabled: i === 0, 'aria-label': 'Monter', onclick: function () { var x = etat.etapes.splice(i, 1)[0]; etat.etapes.splice(i - 1, 0, x); marquer(); dessiner() } }, U.icone('arrow-up', 15)),
              h('button', { class: 'btn-icone', type: 'button', disabled: i === etat.etapes.length - 1, 'aria-label': 'Descendre', onclick: function () { var x = etat.etapes.splice(i, 1)[0]; etat.etapes.splice(i + 1, 0, x); marquer(); dessiner() } }, U.icone('arrow-down', 15)),
              h('button', { class: 'btn-icone', type: 'button', 'aria-label': 'Supprimer cette action', onclick: function () { etat.etapes.splice(i, 1); marquer(); dessiner() } }, U.icone('trash-2', 15))) : null),
          h('div', { class: 'au-bloc-corps' }, params(e)))
      }
      function ajouteur(pos) {
        if (!edit) return h('div', { class: 'au-lien', 'aria-hidden': 'true' })
        var menu = h('div', { class: 'au-menu', hidden: true }, Object.keys(ACT).map(function (k) {
          return h('button', { type: 'button', onclick: function () { etat.etapes.splice(pos, 0, { type: k, params: {} }); marquer(); dessiner() } }, U.icone(ACT[k][1], 15), ACT[k][0])
        }))
        return h('div', { class: 'au-lien' }, h('button', { class: 'au-plus', type: 'button', 'aria-label': 'Ajouter une action ici', 'aria-expanded': 'false', onclick: function (ev) { var b = ev.currentTarget; menu.hidden = !menu.hidden; b.setAttribute('aria-expanded', String(!menu.hidden)) } }, U.icone('plus', 14)), menu)
      }
      function conditions() {
        var c = etat.conditions, out = []
        if (['devis_accepte', 'paiement_recu', 'facture_retard'].indexOf(etat.declencheur) >= 0) out.push(champ('Montant minimum (€)', inp(c, 'montant_min', { type: 'number', min: '0', placeholder: 'aucun' })))
        if (etat.declencheur === 'facture_retard') out.push(champ('Retard d’au moins (jours)', inp(c, 'jours_retard', { type: 'number', min: '0', max: '365', placeholder: '1' })))
        if (etat.declencheur === 'contrat_echeance') out.push(champ('Jours avant la fin', inp(c, 'jours_avant', { type: 'number', min: '0', max: '365', placeholder: '30' })))
        if (etat.declencheur === 'nouveau_message') out.push(champ('Origine', sel(c, 'origine', [['', 'Toutes'], ['espace_client', 'Espace client'], ['site', 'Formulaire du site']])))
        if (etat.declencheur !== 'nouveau_message') out.push(champ('Seulement pour le client', sel(c, 'client_id', [['', 'Tous les clients']].concat(clients.map(function (x) { return [x.id, nomC(x)] })))))
        return out
      }
      function dessiner() {
        var d = DECL[etat.declencheur]
        flux.replaceChildren.apply(flux, [
          h('div', { class: 'au-bloc declencheur' }, h('div', { class: 'au-bloc-tete' }, h('span', { class: 'au-ico' }, U.icone(d[1], 16)), h('b', {}, 'Quand')),
            h('div', { class: 'au-bloc-corps' }, champ('Déclencheur', sel(etat, 'declencheur', Object.keys(DECL).map(function (k) { return [k, DECL[k][0]] }))), h('p', { class: 'discret' }, d[3]))),
          h('div', { class: 'au-lien', 'aria-hidden': 'true' }),
          h('div', { class: 'au-bloc condition' }, h('div', { class: 'au-bloc-tete' }, h('span', { class: 'au-ico' }, U.icone('filter', 16)), h('b', {}, 'Si (facultatif)')), h('div', { class: 'au-bloc-corps' }, conditions())),
          ajouteur(0),
          etat.etapes.length ? null : h('div', { class: 'au-bloc vide' }, 'Ajoutez une première action avec le bouton +'),
          etat.etapes.map(function (e, i) { return [bloc(e, i), i < etat.etapes.length - 1 ? ajouteur(i + 1) : null] }),
          etat.etapes.length ? ajouteur(etat.etapes.length) : null,
          h('p', { class: 'au-vars' }, 'Variables utilisables dans les textes : {client} {projet} {devis} {facture} {contrat} {montant} {tache} {message} {date}')].flat(Infinity).filter(Boolean))
        dessinerCote()
      }

      // ---- test, exécution, historique ----
      var choix = h('select', { 'aria-label': 'Élément de test' }), resultat = h('div', { class: 'au-resultat', role: 'status' }), histo = h('div')
      function chargerChoix() {
        var type = DECL[etat.declencheur][2]
        var src = type === 'client' ? S().list('clients').then(function (l) { return l.map(function (x) { return [x.id, nomC(x)] }) })
          : type === 'devis' ? S().list('devis').then(function (l) { return l.map(function (x) { return [x.id, (x.ref || x.id) + ' · ' + ((x.client || {}).societe || (x.client || {}).nom || '') + ' · ' + (x.statut || '')] }) })
          : type === 'facture' ? S().list('factures').then(function (l) { return l.map(function (x) { return [x.id, (x.ref || x.id) + ' · ' + ((x.client || {}).societe || (x.client || {}).nom || '') + ' · ' + (x.statut || '')] }) })
          : type === 'contrat' ? S().sb.get('contracts?deleted_at=is.null&select=id,ref,titre,date_fin').then(function (l) { return l.map(function (x) { return [x.id, (x.ref || x.titre) + (x.date_fin ? ' · fin ' + x.date_fin.split('-').reverse().join('/') : '')] }) })
          : S().list('projets').then(function (l) { return l.map(function (x) { return [x.id, x.titre || x.id] }) })
        return src.then(function (o) { choix.replaceChildren.apply(choix, [h('option', { value: '' }, o.length ? 'Choisir un élément…' : 'Aucun élément disponible')].concat(o.slice(0, 300).map(function (v) { return h('option', { value: v[0] }, v[1]) }))) }).catch(function () {})
      }
      function contexte() {
        var t = DECL[etat.declencheur][2], v = choix.value, c = {}
        c[{ client: 'client_id', devis: 'devis_id', facture: 'facture_id', contrat: 'contrat_id', projet: 'projet_id' }[t]] = v
        if (etat.declencheur === 'tache_terminee') c.tache = 'Tâche de test'
        if (etat.declencheur === 'nouveau_message') { c.message = 'Message de test'; c.origine = etat.conditions.origine || 'espace_client' }
        return c
      }
      function journal(j) { return h('ol', { class: 'au-journal' }, (j || []).map(function (x) { return h('li', { class: x.ok ? 'ok' : 'ko' }, U.icone(x.ok ? 'circle-check' : 'circle-x', 15), h('span', {}, x.msg)) })) }
      function avantAction() {
        if (modifie) { U.toast('Enregistrez d’abord vos modifications : le test utilise la version enregistrée.', 'erreur'); return false }
        if (!choix.value) { U.toast('Choisissez un élément pour le test.', 'erreur'); return false }
        return true
      }
      function dessinerCote() {
        cote.replaceChildren(
          U.carte('Tester', 'à blanc : rien n’est modifié', h('div', { class: 'au-test' }, choix,
            h('button', { class: 'btn', type: 'button', onclick: function () {
              if (!avantAction()) return
              S().rpc('automation_tester', { aid: id, ctx: contexte() }).then(function (x) { resultat.replaceChildren(h('b', {}, x.ok ? 'Toutes les étapes passeraient.' : 'Au moins une étape échouerait.'), journal(x.journal)); historique() }, function (er) { U.toast(erreur(er), 'erreur') })
            } }, 'Tester'),
            edit ? h('button', { class: 'btn lien', type: 'button', onclick: function () {
              if (!avantAction()) return
              U.confirmer({ titre: 'Exécuter pour de vrai ?', texte: 'Les actions seront réellement appliquées à l’élément choisi (tâches, statuts, documents, notifications…).', bouton: 'Exécuter' }).then(function (ok) {
                if (ok) S().rpc('automation_executer_sur', { aid: id, ctx: contexte() }).then(function (x) { resultat.replaceChildren(U.badge(RUN[x.statut][0], RUN[x.statut][1]), journal(x.journal)); historique() }, function (er) { U.toast(erreur(er), 'erreur') })
              })
            } }, 'Exécuter sur cet élément') : null), resultat),
          U.carte('Historique', 'les 30 dernières exécutions', histo))
        chargerChoix(); historique()
      }
      function historique() {
        S().sb.get('automation_runs?automation_id=eq.' + enc(id) + '&select=*&order=created_at.desc&limit=30').then(function (l) {
          histo.replaceChildren(l.length ? h('ul', { class: 'au-runs' }, l.map(function (x) {
            return h('li', {}, h('details', {}, h('summary', {}, U.badge(RUN[x.statut][0], RUN[x.statut][1]), ' ', h('span', { class: 'discret' }, quand(x.created_at) + (x.manuel ? ' · manuel' : '') + (x.essais > 1 ? ' · ' + x.essais + ' essais' : ''))),
              x.contexte && x.contexte.client_nom ? h('p', { class: 'discret' }, [x.contexte.client_nom, x.contexte.projet_titre, x.contexte.devis_ref, x.contexte.facture_ref].filter(Boolean).join(' · ')) : null,
              journal(x.journal), x.erreur ? h('p', { class: 'au-err' }, x.erreur) : null,
              x.statut === 'echec' && x.prochain_essai ? h('p', { class: 'discret' }, 'Nouvelle tentative automatique après le ' + quand(x.prochain_essai)) : null,
              edit && (x.statut === 'echec' || x.statut === 'abandon') ? h('button', { class: 'btn petit', type: 'button', onclick: function () { S().rpc('automation_relancer', { rid: x.id }).then(function (s) { U.toast(s === 'reussi' ? 'Réussie cette fois.' : 'Toujours en échec.', s === 'reussi' ? 'bon' : 'erreur'); historique() }, function (er) { U.toast(erreur(er), 'erreur') }) } }, 'Relancer maintenant') : null))
          })) : U.etatVide('Pas encore d’exécution.', 'history'))
        }).catch(function () {})
      }
      dessiner()
      if (edit) main.append(h('div', { class: 'cta' }, h('button', { class: 'btn', type: 'button', onclick: function () {
        U.confirmer({ titre: 'Supprimer cette automatisation ?', texte: 'Elle part dans la corbeille et ne se déclenche plus.', bouton: 'Supprimer', danger: true }).then(function (ok) { if (ok) S().sb.patch('automations?id=eq.' + enc(id), { deleted_at: new Date().toISOString(), actif: false }).then(function () { K().go('automatisations') }) })
      } }, 'Supprimer l’automatisation')))
      window.addEventListener('beforeunload', function (e) { if (modifie && location.hash.indexOf(id) >= 0) { e.preventDefault(); e.returnValue = '' } })
    }).catch(function (er) { main.append(UI().etatVide('Lecture impossible : ' + erreur(er), 'database')) })
  }

  /* ---------- historique global et e-mails ---------- */
  function historiqueGlobal(main) {
    var U = UI(), h = U.h
    Promise.all([S().sb.get('automation_runs?select=*&order=created_at.desc&limit=200'), S().sb.get('automations?select=id,nom')]).then(function (r) {
      var noms = {}; r[1].forEach(function (a) { noms[a.id] = a.nom })
      main.append(U.carte('Toutes les exécutions', 'les 200 dernières', r[0].length ? h('ul', { class: 'au-runs' }, r[0].map(function (x) {
        return h('li', {}, h('details', {}, h('summary', {}, U.badge(RUN[x.statut][0], RUN[x.statut][1]), ' ', h('a', { href: '#automatisations/' + x.automation_id }, noms[x.automation_id] || 'Automatisation'), h('span', { class: 'discret' }, ' · ' + quand(x.created_at))),
          h('ol', { class: 'au-journal' }, (x.journal || []).map(function (j) { return h('li', { class: j.ok ? 'ok' : 'ko' }, U.icone(j.ok ? 'circle-check' : 'circle-x', 15), h('span', {}, j.msg)) })), x.erreur ? h('p', { class: 'au-err' }, x.erreur) : null))
      })) : U.etatVide('Aucune exécution pour le moment.', 'history')))
    }).catch(function (er) { main.append(UI().etatVide('Lecture impossible : ' + erreur(er), 'database')) })
  }
  function courriels(main) {
    var U = UI(), h = U.h
    S().sb.get('email_outbox?select=*&order=created_at.desc&limit=200').then(function (l) {
      var ST = { en_attente: ['En attente du service d’envoi', 'attention'], envoye: ['Envoyé', 'bon'], echec: ['Échec', 'critique'], annule: ['Annulé', ''] }
      main.append(U.carte('E-mails préparés par les automatisations', 'le service d’envoi n’est pas encore connecté : rien n’est parti', l.length ? h('ul', { class: 'au-runs' }, l.map(function (m) {
        return h('li', {}, h('details', {}, h('summary', {}, U.badge(ST[m.statut][0], ST[m.statut][1]), ' ', h('b', {}, m.sujet), h('span', { class: 'discret' }, ' · ' + m.destinataire + ' · ' + quand(m.created_at))),
          h('pre', { class: 'au-mail' }, m.corps || '(sans texte)'),
          direction() && m.statut === 'en_attente' ? h('button', { class: 'btn petit', type: 'button', onclick: function () { S().sb.patch('email_outbox?id=eq.' + enc(m.id), { statut: 'annule' }).then(function () { K().route() }) } }, 'Annuler cet envoi') : null))
      })) : U.etatVide('Aucun e-mail préparé.', 'mail')))
    }).catch(function (er) { main.append(UI().etatVide('Lecture impossible : ' + erreur(er), 'database')) })
  }

  function automatisations(id) {
    var U = UI(), main = K().main
    main.append(U.entete('Automatisations', 'Quand quelque chose se passe, l’outil enchaîne les actions pour vous. Exécutées par la base, même quand personne n’est connecté.', null))
    var o = id === 'historique' || id === 'courriels' ? id : 'liste'
    if (!id || o !== 'liste') main.append(onglets(o))
    if (!enLigne()) return hors(main)
    if (id === 'historique') return historiqueGlobal(main)
    if (id === 'courriels') return courriels(main)
    return id ? fiche(main, id) : liste(main)
  }
  M.automatisations = automatisations
})()
