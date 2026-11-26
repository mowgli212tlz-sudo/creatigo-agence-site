/* Espace client : connexion, tableau de bord, projets, demandes. Page /espace-client/.
   Même coquille et mêmes composants que l'espace agence et l'appli RH Creatigo (assets/app/) : menu latéral, barre du haut
   avec recherche, bandeaux de page, rangées d'indicateurs illustrés, jauges et graphiques.
   Tout texte affiché passe par textContent (UI.h ne fait jamais d'innerHTML) : les messages viennent d'utilisateurs.
   La sécurité est dans la base (règles par ligne, supabase/portal.sql) : un client ne reçoit que ses propres lignes, quoi que fasse ce fichier. */
(function () {
  var root = document.getElementById('pt'); if (!root) return
  var S = window.CreatigoStore, UI = window.UI
  if (!UI) { root.textContent = 'L’espace client n’a pas pu se charger. Rechargez la page.'; return }
  var h = UI.h, ic = UI.icone, G = UI.G
  var ETAPES = UI.PHASES.map(function (x) { return x.nom })
  var STATUTS = { ouverte: ['Ouverte', 'info'], en_cours: ['En cours', 'attention'], terminee: ['Terminée', 'bon'] }
  var enc = encodeURIComponent
  var acc = null   // { client_id, nom }

  function day(iso) { return iso ? new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('fr-FR') : '' }
  function when(iso) { var d = new Date(iso); return d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  function n0(n) { return Math.round(n).toLocaleString('fr-FR') }
  function pl(n, a, b) { return n0(n) + ' ' + (Math.abs(n) >= 2 ? (b || a + 's') : a) }
  function pct(n) { return Math.round(n).toLocaleString('fr-FR') + ' %' }
  function initiales(n) { var p = String(n || 'C').trim().split(/\s+/); return ((p[0] || 'C')[0] + (p[1] ? p[1][0] : '')).toUpperCase() }
  function statut(s) { var x = STATUTS[s] || [s, '']; return UI.badge(x[0], x[1]) }
  function erreur(box) { return function (er) {
    var m = String((er && er.message) || er)
    if (/non connecté|session expirée/.test(m)) { S.auth.signOut().then(login); return }
    box.replaceChildren(h('div', { class: 'erreur', role: 'alert' }, 'Une erreur est survenue. Vérifiez votre connexion puis réessayez.'))
  } }
  function themeBtn(cls) { return h('button', { class: 'btn-icone theme-btn ' + (cls || ''), type: 'button', 'data-theme-toggle': '', 'aria-label': 'Changer de thème (clair / sombre)' }, ic('moon', 18, 'ic-moon'), ic('sun', 18, 'ic-sun')) }
  function marque(cls) { return h('a', { class: 'marque ' + (cls || ''), href: '../', title: 'Retour au site' }, h('span', { class: 'logo' }, h('img', { src: '../assets/logo.svg', alt: '', width: '24', height: '24' })), h('div', {}, 'Creatigo', h('small', {}, 'Espace client'))) }

  /* ---------- écrans sans connexion : volet de présentation + carte, comme l'appli RH ---------- */
  function ecranConnexion(carte) {
    root.replaceChildren(h('main', { class: 'connexion', id: 'contenu' },
      h('section', { class: 'connexion-visuel' },
        marque(''),
        h('div', {},
          h('span', { class: 'connexion-pastille' }, ic('sparkles', 14), 'Espace client'),
          h('h2', {}, 'Suivez votre projet, ', h('em', {}, 'en toute clarté'), '.'),
          h('p', {}, 'L’avancement de chaque projet, ce qui est livré, ce que nous attendons de vous, et un échange direct avec l’équipe.'),
          h('ul', {}, [
            ['Avancement en temps réel', 'Étapes, pourcentage et échéance de chaque projet.'],
            ['Ce qui est livré, ce qui est attendu', 'Les livrables d’un côté, vos actions de l’autre.'],
            ['Un échange direct', 'Vos demandes arrivent chez l’équipe, les réponses ici.'],
          ].map(function (x) { return h('li', {}, h('div', {}, h('b', {}, x[0]), h('span', {}, x[1]))) }))),
        UI.mascotte('mascotte', 'connexion-masc'),
        h('footer', {}, 'Creatigo Agence · espace client')),
      h('section', { class: 'connexion-formulaire' },
        h('div', { class: 'connexion-outils' }, themeBtn('connexion-theme')),
        marque('connexion-marque-mobile'),
        carte,
        h('a', { class: 'connexion-decouvrir', href: '../' }, 'Retour au site', ic('arrow-right', 15)))))
    if (window.CreatigoTheme) window.CreatigoTheme.apply()
  }
  function champ(libelle, icone, input) { return h('label', { class: 'champ' }, h('span', {}, libelle), h('div', { class: 'champ-icone' }, ic(icone, 17), input)) }

  function login(note) {
    var msg = h('div', { class: 'erreur', role: 'alert', hidden: !(typeof note === 'string' && note) }, typeof note === 'string' ? note : '')
    var info = h('div', { class: 'ok', role: 'status', hidden: true })
    var mail = h('input', { type: 'email', autocomplete: 'username', required: true, placeholder: 'vous@entreprise.fr' })
    var pw = h('input', { type: 'password', autocomplete: 'current-password', required: true, placeholder: '••••••••' })
    var dire = function (t) { msg.textContent = t; msg.hidden = !t; info.hidden = true }
    var form = h('form', { class: 'connexion-carte', novalidate: true },
      h('div', { class: 'connexion-tete' }, h('h1', {}, 'Connexion'), h('p', { class: 'discret' }, 'Espace réservé aux clients de l’agence.')),
      msg, info,
      champ('Adresse e-mail', 'mail', mail), champ('Mot de passe', 'lock-keyhole', pw),
      h('button', { class: 'btn principal connexion-bouton', type: 'submit' }, ic('log-in', 17), 'Se connecter'),
      separateur(), comptes(),
      h('div', { class: 'connexion-liens' }, h('button', { class: 'lien-discret', type: 'button', onclick: function () {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail.value.trim())) { dire('Saisissez d’abord votre adresse e-mail ci-dessus.'); mail.focus(); return }
        S.auth.recover(mail.value.trim(), location.origin + location.pathname).then(function () { dire(''); info.textContent = 'Si cette adresse est autorisée, un e-mail vient de vous être envoyé avec un lien pour choisir un nouveau mot de passe.'; info.hidden = false }, function () { dire('Envoi impossible pour le moment. Réessayez plus tard.') })
      } }, 'Mot de passe oublié ?'),
      h('button', { class: 'lien-discret', type: 'button', onclick: function () {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail.value.trim())) { dire('Saisissez d’abord votre adresse e-mail ci-dessus.'); mail.focus(); return }
        S.auth.lienMagique(mail.value.trim().toLowerCase(), location.origin + location.pathname).then(function () { dire(''); info.textContent = 'Un lien de connexion vient de vous être envoyé par e-mail. Ouvrez-le sur cet appareil.'; info.hidden = false }, function (err) { dire('Envoi impossible : ' + err.message) })
      } }, 'Recevoir un lien par e-mail')),
      h('p', { class: 'connexion-note' }, ic('info', 14), 'Pas encore de compte ? ', h('button', { class: 'lien-discret', type: 'button', onclick: inscription }, 'Créer un compte')))
    form.addEventListener('submit', function (e) {
      e.preventDefault(); dire('')
      if (!mail.value.trim() || !pw.value) { dire('Renseignez votre adresse e-mail et votre mot de passe.'); return }
      S.auth.signIn(mail.value.trim(), pw.value).then(function () { boot() }, function () { dire('Connexion refusée : e-mail ou mot de passe incorrect.') })
    })
    ecranConnexion(form); mail.focus()
  }

  // bouton « Continuer avec Google » (logo officiel en couleurs)
  var G_SVG = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>'
  var COMPTES = [
    ['google', 'Google', G_SVG],
    ['azure', 'Microsoft', '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#F25022" d="M1 1h10.5v10.5H1z"/><path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z"/><path fill="#00A4EF" d="M1 12.5h10.5V23H1z"/><path fill="#FFB900" d="M12.5 12.5H23V23H12.5z"/></svg>'],
    ['linkedin_oidc', 'LinkedIn', '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>'],
    ['facebook', 'Facebook', '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#0866FF" d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg>'],
  ]
  // connexion par un compte : grille de boutons identiques (logo + nom), avant le formulaire e-mail
  function comptes() {
    return h('div', { class: 'connexion-comptes' }, COMPTES.map(function (a) {
      var b = h('button', { class: 'btn-compte', type: 'button', 'aria-label': 'Continuer avec ' + a[1], onclick: function () { S.auth.oauth(a[0], location.origin + location.pathname) } })
      b.innerHTML = a[2]; b.append(h('span', {}, a[1])); return b
    }))
  }
  function separateur() { return h('div', { class: 'connexion-ou' }, h('span', {}, 'ou continuer avec')) }

  /* ---------- création de compte : le compte reste vide tant que l'agence ne l'a pas relié à une fiche client ---------- */
  function inscription() {
    var msg = h('div', { class: 'erreur', role: 'alert', hidden: true }), info = h('div', { class: 'ok', role: 'status', hidden: true })
    var nom = h('input', { type: 'text', autocomplete: 'name', required: true, placeholder: 'Prénom Nom ou entreprise' })
    var mail = h('input', { type: 'email', autocomplete: 'email', required: true, placeholder: 'vous@entreprise.fr' })
    var a = h('input', { type: 'password', autocomplete: 'new-password', minlength: '10', required: true }), b = h('input', { type: 'password', autocomplete: 'new-password', required: true })
    var dire = function (t) { msg.textContent = t; msg.hidden = !t; info.hidden = true }
    var envoi = h('button', { class: 'btn principal connexion-bouton', type: 'submit' }, ic('user-plus', 17), 'Créer mon compte')
    var form = h('form', { class: 'connexion-carte', novalidate: true },
      h('div', { class: 'connexion-tete' }, h('h1', {}, 'Créer un compte'), h('p', { class: 'discret' }, 'Votre compte est relié à votre projet par l’agence, en général sous 24 h.')),
      msg, info, champ('Nom', 'user', nom), champ('Adresse e-mail', 'mail', mail), champ('Mot de passe (10 caractères minimum)', 'lock-keyhole', a), champ('Confirmer le mot de passe', 'lock-keyhole', b),
      envoi, separateur(), comptes(), h('button', { class: 'lien-discret', type: 'button', onclick: function () { login() } }, 'J’ai déjà un compte'))
    form.addEventListener('submit', function (e) {
      e.preventDefault(); dire('')
      if (!nom.value.trim()) { dire('Indiquez votre nom.'); nom.focus(); return }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail.value.trim())) { dire('Adresse e-mail invalide.'); mail.focus(); return }
      if (a.value.length < 10) { dire('Le mot de passe doit faire au moins 10 caractères.'); a.focus(); return }
      if (a.value !== b.value) { dire('Les deux mots de passe ne sont pas identiques.'); b.focus(); return }
      envoi.disabled = true
      S.auth.signUp(mail.value.trim().toLowerCase(), a.value, nom.value.trim(), location.origin + location.pathname).then(function (s) {
        if (s) return boot()
        info.textContent = 'Compte créé. Ouvrez l’e-mail de confirmation que nous venons de vous envoyer, puis connectez-vous.'; info.hidden = false
      }, function (err) {
        envoi.disabled = false
        dire(/already|registered|exists/i.test(err.message) ? 'Un compte existe déjà avec cette adresse : connectez-vous.' : /disabled|not allowed/i.test(err.message) ? 'La création de compte n’est pas encore ouverte : contactez l’agence.' : 'Création impossible : ' + err.message)
      })
    })
    ecranConnexion(form); nom.focus()
  }

  /* ---------- choix du mot de passe (lien d'invitation ou de réinitialisation) ---------- */
  function newPassword(type) {
    var msg = h('div', { class: 'erreur', role: 'alert', hidden: true })
    var a = h('input', { type: 'password', autocomplete: 'new-password', minlength: '10', required: true }), b = h('input', { type: 'password', autocomplete: 'new-password', required: true })
    var dire = function (t) { msg.textContent = t; msg.hidden = !t }
    var form = h('form', { class: 'connexion-carte', novalidate: true },
      h('div', { class: 'connexion-tete' }, h('h1', {}, type === 'invite' ? 'Bienvenue' : 'Nouveau mot de passe'), h('p', { class: 'discret' }, 'Choisissez un mot de passe d’au moins 10 caractères.')),
      msg, champ('Mot de passe', 'lock-keyhole', a), champ('Confirmer le mot de passe', 'lock-keyhole', b),
      h('button', { class: 'btn principal connexion-bouton', type: 'submit' }, ic('check', 17), 'Enregistrer et continuer'))
    form.addEventListener('submit', function (e) {
      e.preventDefault(); dire('')
      if (a.value.length < 10) { dire('Le mot de passe doit faire au moins 10 caractères.'); return }
      if (a.value !== b.value) { dire('Les deux mots de passe ne sont pas identiques.'); return }
      S.auth.setPassword(a.value).then(boot, function (er) { dire('Impossible : ' + er.message) })
    })
    ecranConnexion(form); a.focus()
  }

  /* ---------- démarrage ---------- */
  function boot() {
    if (!S.auth.session()) return login()
    S.sb.get('portal_accounts?select=client_id,nom').then(function (r) {
      if (!r.length) return noAccount()
      acc = r[0]; coquille(); route()
    }).catch(erreur(root))
  }
  function noAccount() {
    ecranConnexion(h('div', { class: 'connexion-carte' },
      h('div', { class: 'connexion-tete' }, h('h1', {}, 'Compte en attente'), h('p', { class: 'discret' }, 'Votre compte est bien créé. L’agence doit encore le relier à votre projet : vous serez prévenu par e-mail. En attendant, vous pouvez nous écrire ou demander un devis.')),
      h('a', { class: 'btn principal connexion-bouton', href: '../devis/' }, ic('file-text', 17), 'Demander un devis'),
      h('button', { class: 'btn connexion-bouton', type: 'button', onclick: function () { S.auth.signOut().then(login) } }, ic('log-out', 17), 'Se déconnecter')))
  }

  /* ---------- coquille : menu latéral + barre du haut, dessinée une fois ---------- */
  // navigation de l'espace client : une seule liste, sans titres de section
  var PAGES = [
    { r: 'projet', l: 'Mon projet', ic: 'layout-dashboard' },
    { r: 'documents', l: 'Mes documents', ic: 'folder' },
    { r: 'echanges', l: 'Mes échanges', ic: 'message-square', pastille: true },
    { r: 'facturation', l: 'Facturation', ic: 'receipt-text' },
    { r: 'parametres', l: 'Paramètres', ic: 'settings' },
  ]
  // anciennes adresses (liens déjà envoyés, favoris) -> page de la nouvelle navigation
  var ALIAS = { accueil: 'projet', projets: 'projet', demandes: 'echanges', demande: 'echanges', nouvelle: 'echanges' }
  var cache = null   // données lues une fois par affichage (projets, demandes, nouvelles)
  function lire(force) {
    if (cache && !force) return cache
    cache = Promise.all([
      S.sb.get('client_projects?select=*&order=created_at.desc'),
      S.sb.get('portal_requests?select=id,project_id,sujet,statut,created_at,updated_at&order=updated_at.desc&limit=200'),
      S.sb.get('portal_updates?select=*&order=created_at.desc&limit=200'),
      S.sb.get('client_documents?select=*&order=created_at.desc&limit=300').catch(function () { return [] }),
    ]).then(function (r) { return { projets: r[0], demandes: r[1], nouvelles: r[2], documents: r[3] || [] } })
    cache.catch(function () { cache = null })
    return cache
  }
  function coquille() {
    root.replaceChildren(h('div', { class: 'cadre' },
      h('div', { class: 'voile', id: 'voile' }),
      h('aside', { class: 'barre', id: 'barre', 'aria-label': 'Menu' },
        h('div', { class: 'marque' }, h('a', { class: 'logo', href: '../', title: 'Retour au site', 'aria-label': 'Retour au site' }, h('img', { src: '../assets/logo.svg', alt: '', width: '24', height: '24' })), h('div', {}, 'Creatigo', h('small', {}, 'Espace client')),
          h('button', { class: 'barre-epingle', id: 'epingle', type: 'button' }, ic('panel-left', 16))),
        h('nav', { class: 'nav', id: 'menu', 'aria-label': 'Espace client' }, PAGES.map(function (p) {
          return h('a', { href: '#' + p.r, 'data-route': p.r, 'data-icone': p.ic, title: p.l }, ic(p.ic, 18), h('span', { class: 'nav-texte' }, p.l), p.pastille ? h('span', { class: 'pastille pastille-alertes', hidden: true }) : null)
        })),
        h('div', { class: 'barre-contact' },
          h('span', { class: 'barre-contact-ico', 'aria-hidden': 'true' }, ic('headset', 17)),
          h('b', {}, 'Une question ?'),
          h('p', {}, 'Votre chef de projet vous répond sous 24 h ouvrées.'),
          h('a', { class: 'btn petit', href: '#nouvelle' }, 'Écrire à l’équipe', ic('arrow-right', 14))),
        h('div', { class: 'barre-pied' },
          h('a', { class: 'profil', href: '../', title: 'Retour au site' }, h('span', { class: 'avatar nuit', 'aria-hidden': 'true' }, initiales(acc.nom)), h('div', {}, h('div', { class: 'nom' }, acc.nom || 'Mon espace'), h('div', { class: 'role' }, 'Client'))),
          h('button', { class: 'btn-nuit', type: 'button', onclick: function () { cache = null; S.auth.signOut().then(login) } }, ic('log-out', 16), h('span', { class: 'nav-texte' }, 'Se déconnecter')))),
      h('div', { class: 'colonne' },
        h('header', { class: 'haut-barre' },
          h('div', { class: 'haut-gauche' },
            h('button', { class: 'btn-icone burger', id: 'burger', type: 'button', 'aria-label': 'Ouvrir le menu', 'aria-controls': 'barre' }, ic('menu', 20)),
            h('div', { class: 'fil-ariane' }, 'Creatigo', ic('chevron-right', 14), h('b', { id: 'titre-page' }, ''))),
          h('div', { class: 'recherche-globale', role: 'search' }, ic('search', 16),
            h('input', { type: 'search', id: 'rg', placeholder: 'Rechercher un projet, une demande…', 'aria-label': 'Recherche dans l’espace client', autocomplete: 'off', spellcheck: 'false', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': 'rg-liste' }),
            h('kbd', { class: 'rg-raccourci', 'aria-hidden': 'true' }, '/'),
            h('div', { class: 'rg-panneau', id: 'rg-p', hidden: true }, h('ul', { class: 'rg-liste', id: 'rg-liste', role: 'listbox', 'aria-label': 'Résultats' }),
              h('div', { class: 'rg-pied', 'aria-hidden': 'true' }, h('span', {}, h('kbd', {}, '↑'), h('kbd', {}, '↓'), ' naviguer'), h('span', {}, h('kbd', {}, '↵'), ' ouvrir'), h('span', {}, h('kbd', {}, 'Échap'), ' fermer')))),
          h('div', { class: 'haut-droite' },
            themeBtn(),
            cloche())),
        h('main', { class: 'principal-zone', id: 'main', tabindex: '-1' }))))
    if (window.CreatigoTheme) window.CreatigoTheme.apply()
    window.CoqueRecherche = function () {
      return lire().then(function (d) {
        return d.projets.map(function (p) { return { t: p.titre, s: ETAPES[p.etape - 1] + ' · ' + p.avancement + ' %', h: '#projet/' + p.id, ic: 'folder', g: 'Projets' } })
          .concat(d.demandes.map(function (q) { return { t: q.sujet, s: (STATUTS[q.statut] || [q.statut])[0], h: '#demande/' + q.id, ic: 'message-square', g: 'Demandes' } }))
      })
    }
    if (window.Coque) window.Coque.monter()
  }
  // cloche : ce que l'agence attend du client
  function cloche() {
    var panneau = h('div', { class: 'cloche-panneau', role: 'dialog', 'aria-label': 'Attendu de votre part', hidden: true })
    var point = h('span', { class: 'point', hidden: true })
    var bouton = h('button', { class: 'btn-icone cloche', type: 'button', 'aria-label': 'Attendu de votre part', 'aria-expanded': 'false', onclick: function () { if (panneau.hidden) ouvrir(); else fermer() } }, ic('bell', 18), point)
    var zone = h('div', { class: 'cloche-zone' }, bouton, panneau)
    function fermer() { panneau.hidden = true; bouton.setAttribute('aria-expanded', 'false') }
    document.addEventListener('pointerdown', function (e) { if (!panneau.hidden && !zone.contains(e.target)) fermer() }, true)
    function ouvrir() {
      panneau.hidden = false; bouton.setAttribute('aria-expanded', 'true')
      lire().then(function (d) {
        var att = d.nouvelles.filter(function (u) { return u.kind === 'attendu' && !u.fait }), titre = {}
        d.projets.forEach(function (p) { titre[p.id] = p.titre })
        panneau.replaceChildren(
          h('div', { class: 'cloche-tete' }, h('b', {}, 'Attendu de votre part'), h('span', { class: 'discret petit' }, att.length ? att.length + ' à faire' : 'rien en attente')),
          att.length ? h('div', { class: 'cloche-liste' }, att.slice(0, 7).map(function (u) {
            return h('a', { class: 'cloche-ligne', href: '#projet/' + u.project_id, onclick: fermer }, h('span', { class: 'cloche-gravite importante' }),
              h('span', { class: 'cloche-texte' }, h('span', { class: 'cloche-titre' }, u.titre), h('span', { class: 'cloche-meta' }, (titre[u.project_id] || 'Projet') + ' · ' + day(u.created_at))))
          })) : h('div', { class: 'cloche-vide' }, ic('circle-check', 22), 'Rien à faire de votre côté pour le moment.'),
          h('a', { class: 'cloche-pied', href: '#projet', onclick: fermer }, 'Voir mon projet', ic('chevron-right', 15)))
      })
    }
    lire().then(function (d) {
      var n = d.nouvelles.filter(function (u) { return u.kind === 'attendu' && !u.fait }).length
      point.hidden = !n; point.textContent = String(n); bouton.classList.toggle('a-traiter', n > 0)
      var ouvertes = d.demandes.filter(function (q) { return q.statut !== 'terminee' }).length
      document.querySelectorAll('.pastille-alertes').forEach(function (p) { p.textContent = String(ouvertes); p.hidden = !ouvertes })
    }).catch(function () {})
    return zone
  }

  /* ---------- routeur ---------- */
  function route() {
    var parts = (location.hash || '#projet').replace(/^#/, '').split('/'), v = parts[0] || 'projet'
    var actif = ALIAS[v] || v
    if (!PAGES.some(function (p) { return p.r === actif })) { v = actif = 'projet' }
    if (v === 'accueil' || v === 'projets') v = 'projet'
    if (v === 'demandes') v = 'echanges'
    document.querySelectorAll('#menu a').forEach(function (a) { if (a.dataset.route === actif) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current') })
    var lib = (PAGES.filter(function (p) { return p.r === actif })[0] || {}).l
    document.getElementById('titre-page').textContent = lib
    document.title = lib + ' | Espace client Creatigo'
    document.documentElement.dataset.route = v
    document.querySelector('.cadre').classList.remove('menu-ouvert')
    var main = document.getElementById('main'); main.setAttribute('data-vue', v)
    main.replaceChildren(h('p', { class: 'discret' }, 'Chargement…'))
    var f = { projet: function () { return monProjet(parts[1], parts[2]) }, documents: documents, echanges: demandes, demande: function () { return fil(parts[1]) }, nouvelle: function () { return nouvelle(parts[1]) }, facturation: facturation, parametres: parametres }[v]
    Promise.resolve(f()).then(function (contenu) {
      if (!contenu) return
      main.replaceChildren.apply(main, [].concat(contenu).filter(Boolean))
      window.scrollTo(0, 0)
    }).catch(erreur(main))
  }
  addEventListener('hashchange', function () { if (acc && S.auth.session() && document.getElementById('main')) route() })

  /* ---------- en-tête des pages : titre éditorial, phrase, éléments à droite ---------- */
  function enTetePage(titre, mot, sous, droite) {
    return h('header', { class: 'pc-tete' },
      h('div', { class: 'pc-tete-texte' },
        h('h1', {}, titre, mot ? ' ' : '', mot ? h('em', {}, mot) : null),
        sous ? h('p', {}, sous) : null),
      droite ? h('div', { class: 'pc-tete-droite' }, droite) : null)
  }
  function telecharger(doc, libelle) {
    return h('button', { class: 'btn petit pc-dl', type: 'button', 'aria-label': (libelle || 'Télécharger') + ' : ' + doc.nom, onclick: function (e) {
      var b = e.currentTarget; b.disabled = true
      S.sb.fichier(doc.path).then(function (u) { window.open(u, '_blank', 'noopener') }, function () { UI.toast('Ce fichier n’est pas disponible pour le moment.', 'critique') }).then(function () { b.disabled = false })
    } }, ic('download', 14), libelle || 'Télécharger')
  }
  var CATEGORIES = { devis: 'Devis', contrat: 'Contrat', facture: 'Facture', maquette: 'Maquette', logo: 'Logo', image: 'Image', video: 'Vidéo', livrable: 'Livrable', technique: 'Technique', guide: 'Guide', contenu: 'Contenu', reference: 'Référence', autre: 'Autre' }
  function taille(o) { if (!o) return ''; return o > 1e6 ? (o / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' Mo' : Math.max(1, Math.round(o / 1e3)) + ' ko' }

  /* ---------- Mon projet : le parcours du projet ----------
     Tout vient de la base : étape et avancement du projet (client_projects), actions attendues et livraisons
     (portal_updates), documents (client_documents), demandes (portal_requests). Les tâches de l'agence sont celles de
     l'étape ; la base n'enregistre pas leur état une à une : elles prennent l'état de leur étape. */
  function monProjet(id, vueDemandee) {
    return lire(true).then(function (d) {
      if (!d.projets.length) {
        return [enTetePage('Le parcours de', 'votre projet', 'Suivez chaque étape de votre projet, simplement.'),
          h('section', { class: 'carte pc-vide' }, UI.illustrationEtape(1), h('div', {}, h('h2', {}, 'Votre projet arrive bientôt ici'), h('p', { class: 'discret' }, 'Dès le lancement, l’agence ajoute votre projet : vous suivrez ici chaque étape, ce que nous faisons et ce dont nous avons besoin de vous.'), h('a', { class: 'btn principal', href: '#nouvelle' }, ic('message-square', 15), 'Écrire à l’équipe')))]
      }
      var p = d.projets.filter(function (x) { return x.id === id })[0] || d.projets.filter(function (x) { return (+x.avancement || 0) < 100 })[0] || d.projets[0]
      var e = Math.max(1, Math.min(4, +p.etape || 1)), av = Math.max(0, Math.min(100, +p.avancement || 0))
      var maj = d.nouvelles.filter(function (u) { return u.project_id === p.id })
      var attendus = maj.filter(function (u) { return u.kind === 'attendu' }), restants = attendus.filter(function (u) { return !u.fait })
      var livres = maj.filter(function (u) { return u.kind === 'livre' })
      var docs = d.documents.filter(function (x) { return x.project_id === p.id })
      var demandesProjet = d.demandes.filter(function (q) { return q.project_id === p.id })
      var vue = Math.max(1, Math.min(4, +vueDemandee || e))

      // ---- en-tête : titre, progression globale réelle, état du projet en une phrase
      var R = 34, C = 2 * Math.PI * R
      var anneau = h('div', { class: 'pc-global', role: 'img', 'aria-label': 'Projet réalisé à ' + Math.round(av) + ' %' },
        (function () {
          var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 80 80'); svg.setAttribute('aria-hidden', 'true')
          svg.innerHTML = '<circle cx="40" cy="40" r="' + R + '" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="7"/><circle class="pc-global-arc" cx="40" cy="40" r="' + R + '" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + (C * (1 - av / 100)).toFixed(2) + '" transform="rotate(-90 40 40)" style="--c:' + C.toFixed(2) + '"/>'
          return svg
        })(),
        h('div', { class: 'pc-global-txt' }, h('b', {}, Math.round(av) + ' %'), h('small', {}, 'réalisé')))
      var etat = restants.length
        ? h('a', { class: 'pc-notif attente', href: '#projet/' + p.id + '/' + e, onclick: function (ev) { ev.preventDefault(); choisir(e); document.querySelector('.pc-client') && document.querySelector('.pc-client').scrollIntoView({ behavior: 'smooth', block: 'center' }) } },
          h('span', { class: 'pc-notif-ico' }, ic('clipboard-check', 16)),
          h('span', {}, h('b', {}, pl(restants.length, 'action attendue', 'actions attendues') + ' de votre part'), h('small', {}, 'Le projet avance plus vite quand elles sont faites')))
        : h('div', { class: 'pc-notif ok' },
          h('span', { class: 'pc-notif-ico' }, ic('circle-check', 16)),
          h('span', {}, h('b', {}, av >= 100 ? 'Projet terminé' : 'Tout est clair de votre côté'), h('small', {}, av >= 100 ? 'Merci pour votre confiance' : 'Aucune action attendue de vous pour l’instant')))
      var choixProjet = d.projets.length > 1 ? h('nav', { class: 'pc-projets', 'aria-label': 'Choisir un projet' }, d.projets.map(function (x) {
        return h('a', { href: '#projet/' + x.id, 'aria-current': x.id === p.id ? 'page' : null }, x.titre, h('small', {}, Math.round(+x.avancement || 0) + ' %'))
      })) : null
      var tete = enTetePage('Le parcours de', 'votre projet', 'Suivez chaque étape de votre projet, simplement.',
        [h('div', { class: 'pc-global-bloc' }, anneau, h('div', {}, h('small', { class: 'pc-sur' }, 'Étape ' + e + ' sur 4'), h('b', { class: 'pc-global-etape' }, UI.PHASES[e - 1].nom), h('small', { class: 'discret' }, p.titre))), etat])

      // ---- timeline horizontale : 4 étapes cliquables, ligne de progression réelle
      var boutons = []
      var remplissage = ((e - 1) + UI.partEtape(e, e, av) / 100) / 3
      var timeline = h('div', { class: 'pc-tl' },
        h('div', { class: 'pc-tl-ligne', 'aria-hidden': 'true' }, h('i', { style: 'width:' + Math.min(100, remplissage * 100) + '%' })),
        h('div', { class: 'pc-tl-etapes', role: 'tablist', 'aria-label': 'Étapes du projet' }, UI.PHASES.map(function (ph) {
          var st = ph.n < e ? 'fait' : ph.n === e ? 'cours' : 'avenir'
          var b = h('button', { class: 'pc-tl-etape ' + st, type: 'button', role: 'tab', id: 'pc-tab-' + ph.n, 'aria-controls': 'pc-panneau', 'aria-selected': String(ph.n === vue), tabindex: ph.n === vue ? '0' : '-1', onclick: function () { choisir(ph.n) },
            onkeydown: function (ev) { var k = { ArrowRight: 1, ArrowLeft: -1 }[ev.key]; if (!k) return; ev.preventDefault(); var n = ((ph.n - 1 + k + 4) % 4) + 1; choisir(n); boutons[n - 1].focus() } },
            h('span', { class: 'pc-tl-point', 'aria-hidden': 'true' }, st === 'fait' ? ic('check', 15) : String(ph.n)),
            h('span', { class: 'pc-tl-txt' }, h('b', {}, ph.nom), h('small', {}, ph.titre)),
            h('span', { class: 'pc-tl-etat' }, st === 'fait' ? 'Terminée' : st === 'cours' ? Math.round(UI.partEtape(ph.n, e, av)) + ' %' : 'À venir'))
          boutons.push(b); return b
        })))

      // ---- panneau principal : le contenu de l'étape choisie
      var zone = h('section', { class: 'pc-panneau', id: 'pc-panneau', role: 'tabpanel', 'aria-labelledby': 'pc-tab-' + vue, tabindex: '0' })
      function panneau(n) {
        var ph = UI.PHASES[n - 1], st = n < e ? 'fait' : n === e ? 'cours' : 'avenir', part = UI.partEtape(n, e, av)
        var etiquette = { fait: ['Terminée', 'bon'], cours: ['En cours', 'cours'], avenir: ['À venir', 'avenir'] }[st]
        // ce que fait l'agence : les tâches de l'étape, dans l'état de l'étape
        var taches = h('ol', { class: 'pc-taches' }, ph.agence.map(function (t, i) {
          return h('li', { class: st, style: '--i:' + i },
            h('span', { class: 'pc-tache-pt', 'aria-hidden': 'true' }, st === 'fait' ? ic('check', 13) : null),
            h('span', { class: 'pc-tache-txt' }, t),
            h('span', { class: 'pc-tache-etat' }, st === 'fait' ? 'Fait' : st === 'cours' ? 'En cours' : 'À venir'))
        }))
        // ce dont nous avons besoin de vous : les vraies actions de l'étape en cours, sinon ce qui est demandé à cette étape
        var besoin
        if (st === 'cours') {
          var faites = attendus.length - restants.length
          besoin = h('div', { class: 'pc-client' },
            h('div', { class: 'pc-bloc-tete' }, h('h3', {}, ic('user', 15), 'Ce dont nous avons besoin de vous'),
              attendus.length ? h('span', { class: 'pc-compteur' + (restants.length ? '' : ' ok') }, faites + ' / ' + attendus.length + ' validée' + (faites > 1 ? 's' : '')) : null),
            attendus.length ? h('div', { class: 'pc-valid', 'aria-hidden': 'true' }, h('i', { style: 'width:' + (100 * faites / attendus.length) + '%' })) : null,
            attendus.length ? h('ul', { class: 'pc-actions' }, attendus.slice().sort(function (a, b) { return a.fait - b.fait }).map(function (u, i) {
              return h('li', { class: u.fait ? 'fait' : '', style: '--i:' + i },
                h('span', { class: 'pc-action-pt', 'aria-hidden': 'true' }, u.fait ? ic('check', 12) : null),
                h('div', {}, h('b', {}, u.titre), u.detail ? h('small', {}, u.detail) : null, h('small', { class: 'pc-action-date' }, u.fait ? 'Validée' : 'Demandée le ' + day(u.created_at))))
            })) : h('p', { class: 'pc-rien' }, ic('circle-check', 15), 'Rien n’est attendu de vous pour le moment.'),
            h('details', { class: 'pc-habituel' }, h('summary', {}, 'Ce que nous demandons habituellement à cette étape'), h('ul', {}, ph.client.map(function (x) { return h('li', {}, x) }))))
        } else {
          besoin = h('div', { class: 'pc-client' },
            h('div', { class: 'pc-bloc-tete' }, h('h3', {}, ic('user', 15), st === 'fait' ? 'Ce qui vous a été demandé' : 'Ce que nous vous demanderons')),
            h('ul', { class: 'pc-habituel-liste' }, ph.client.map(function (x) { return h('li', {}, x) })))
        }
        // pied : résultat, date, action
        var date = st === 'fait' ? ['Étape', 'Terminée'] : st === 'cours' ? (p.echeance ? ['Échéance du projet', day(p.echeance)] : ['Durée habituelle', ph.duree.replace('≈ ', '')]) : ['Durée habituelle', ph.duree.replace('≈ ', '')]
        var action
        if (st === 'cours' && e < 4) {
          var sujet = 'Étape ' + e + ' (' + ph.nom + ') : tout est prêt de mon côté'
          var dejaEnvoye = demandesProjet.filter(function (q) { return q.sujet === sujet && q.statut !== 'terminee' })[0]
          if (dejaEnvoye) action = h('a', { class: 'btn', href: '#demande/' + dejaEnvoye.id }, ic('circle-check', 15), 'Agence prévenue · voir l’échange')
          else if (restants.length) action = h('button', { class: 'btn', type: 'button', disabled: true, title: 'Validez d’abord les actions attendues de vous' }, ic('lock', 15), 'Encore ' + pl(restants.length, 'action') + ' de votre part')
          else action = h('button', { class: 'btn principal', type: 'button', onclick: function (ev) {
            var b = ev.currentTarget; b.disabled = true
            S.sb.post('portal_requests', { client_id: acc.client_id, project_id: p.id, sujet: sujet }).then(function (r) {
              return S.sb.post('portal_messages', { request_id: r[0].id, author: 'client', body: 'Tout ce que vous attendiez de moi pour l’étape « ' + ph.nom + ' » est fait. Nous pouvons passer à l’étape « ' + UI.PHASES[e].nom + ' ».' }).then(function () {
                cache = null; UI.toast('L’agence est prévenue : elle valide l’étape et lance la suivante.', 'bon'); route()
              })
            }).catch(function () { b.disabled = false; UI.toast('Envoi impossible pour le moment. Réessayez.', 'critique') })
          } }, 'Tout est prêt : passer à « ' + UI.PHASES[e].nom + ' »', ic('arrow-right', 15))
        } else if (st === 'cours') action = h('a', { class: 'btn principal', href: '#nouvelle/' + p.id }, ic('message-square', 15), 'Demander une évolution')
        else action = h('button', { class: 'btn', type: 'button', onclick: function () { choisir(e) } }, 'Voir l’étape en cours', ic('arrow-right', 15))

        return h('div', { class: 'pc-contenu ' + st },
          h('div', { class: 'pc-gauche' },
            h('div', { class: 'pc-badges' }, h('span', { class: 'pc-num' }, 'Étape ' + n + ' sur 4'), h('span', { class: 'pc-etat ' + etiquette[1] }, etiquette[0])),
            h('h2', {}, ph.nom),
            h('p', { class: 'pc-accroche' }, ph.titre),
            h('p', { class: 'pc-desc' }, ph.desc),
            h('div', { class: 'pc-illu' }, UI.illustrationEtape(n)),
            h('dl', { class: 'pc-delais' },
              h('div', {}, h('dt', {}, ic('clock', 14), 'Durée habituelle'), h('dd', {}, ph.duree.replace('≈ ', ''))),
              st === 'cours' ? h('div', {}, h('dt', {}, ic('chart-column', 14), 'Avancement de l’étape'), h('dd', {}, Math.round(part) + ' %', h('span', { class: 'pc-mini', 'aria-hidden': 'true' }, h('i', { style: 'width:' + part + '%' })))) : null)),
          h('div', { class: 'pc-droite' },
            h('div', { class: 'pc-agence' },
              h('div', { class: 'pc-bloc-tete' }, h('h3', {}, ic('users-round', 15), 'Ce que fait l’agence'),
                st === 'cours' ? h('span', { class: 'pc-compteur cours' }, 'Projet réalisé à ' + Math.round(av) + ' %') : null),
              taches),
            besoin),
          h('footer', { class: 'pc-pied' },
            h('div', { class: 'pc-resultat' }, h('span', { class: 'pc-pied-ico' }, ic('badge-check', 17)), h('div', {}, h('small', {}, 'À la fin de cette étape'), h('b', {}, ph.livrable))),
            h('div', { class: 'pc-date' }, h('span', { class: 'pc-pied-ico' }, ic('calendar-days', 17)), h('div', {}, h('small', {}, date[0]), h('b', {}, date[1]))),
            h('div', { class: 'pc-action' }, action)))
      }
      function choisir(n) {
        vue = n
        boutons.forEach(function (b, i) { var oui = i + 1 === n; b.setAttribute('aria-selected', String(oui)); b.tabIndex = oui ? 0 : -1 })
        zone.setAttribute('aria-labelledby', 'pc-tab-' + n)
        var nouveau = panneau(n)
        zone.classList.remove('pc-entre'); void zone.offsetWidth; zone.classList.add('pc-entre')
        zone.replaceChildren(nouveau)
        history.replaceState(null, '', '#projet/' + p.id + (n === e ? '' : '/' + n))
      }
      zone.append(panneau(vue)); zone.classList.add('pc-entre')

      // ---- panneau latéral : le contexte du projet
      var apercu = h('div', { class: 'pc-apercu' }, h('div', { class: 'pc-apercu-faux', 'aria-hidden': 'true' }, h('span', {}), h('span', {}), h('span', {}), h('b', {}, p.titre)), h('small', {}, 'L’aperçu apparaîtra ici dès que les maquettes seront partagées.'))
      var image = docs.filter(function (x) { return /^image\//.test(x.mime || '') && ['maquette', 'image', 'livrable'].indexOf(x.categorie) >= 0 })[0]
      if (image) S.sb.fichier(image.path).then(function (u) { apercu.replaceChildren(h('img', { src: u, alt: 'Aperçu : ' + image.nom, loading: 'lazy' }), h('small', {}, image.nom)) }).catch(function () {})
      var suivante = e < 4 ? UI.PHASES[e] : null
      var cote = h('aside', { class: 'pc-cote', 'aria-label': 'Résumé du projet' },
        h('h2', {}, ic('folder', 16), 'Résumé de votre projet'),
        apercu,
        h('div', { class: 'pc-cote-titre' }, h('b', {}, p.titre), p.resume ? h('p', {}, p.resume) : null),
        h('dl', { class: 'pc-cles' },
          h('div', {}, h('dt', {}, 'Étape actuelle'), h('dd', {}, e + '. ' + UI.PHASES[e - 1].nom)),
          h('div', {}, h('dt', {}, 'Prochaine étape'), h('dd', {}, suivante ? suivante.nom : 'Aucune : suivi en continu')),
          suivante ? h('div', {}, h('dt', {}, 'Durée de la prochaine étape'), h('dd', {}, suivante.duree.replace('≈ ', ''))) : null,
          h('div', {}, h('dt', {}, 'Échéance'), h('dd', {}, p.echeance ? day(p.echeance) : 'à définir avec l’agence')),
          h('div', {}, h('dt', {}, 'Projet démarré le'), h('dd', {}, day(p.created_at)))),
        suivante ? h('button', { class: 'pc-suivante', type: 'button', onclick: function () { choisir(e + 1) } }, h('span', {}, h('small', {}, 'Prochaine étape'), h('b', {}, suivante.nom)), h('span', { class: 'pc-suivante-ico' }, ic('arrow-right', 16))) : null,
        h('div', { class: 'pc-cote-bloc' },
          h('h3', {}, 'Documents du projet', h('a', { href: '#documents' }, 'Tout voir')),
          docs.length ? h('ul', { class: 'pc-docs' }, docs.slice(0, 4).map(function (x) {
            return h('li', {}, h('span', { class: 'pc-doc-ico', 'aria-hidden': 'true' }, ic('file-text', 15)), h('div', {}, h('b', {}, x.nom), h('small', {}, (CATEGORIES[x.categorie] || 'Document') + ' · ' + day(x.created_at))), telecharger(x, 'Ouvrir'))
          })) : h('p', { class: 'discret petit' }, 'Aucun document partagé pour l’instant.')),
        livres.length ? h('div', { class: 'pc-cote-bloc' },
          h('h3', {}, 'Déjà livré'),
          h('ul', { class: 'pc-livres' }, livres.slice(0, 4).map(function (u) { return h('li', {}, ic('check', 13), h('span', {}, u.titre), h('small', {}, day(u.created_at))) }))) : null)

      // ---- barre d'informations
      var infos = h('div', { class: 'pc-infos' },
        h('a', { class: 'pc-info', href: '#nouvelle/' + p.id }, h('span', { class: 'pc-info-ico' }, ic('headset', 17)), h('span', {}, h('b', {}, 'Une question ?'), h('small', {}, 'Notre équipe vous répond sous 24 h ouvrées')), ic('arrow-right', 15)),
        h('div', { class: 'pc-info' }, h('span', { class: 'pc-info-ico' }, ic('lock-keyhole', 17)), h('span', {}, h('b', {}, 'Votre espace sécurisé'), h('small', {}, 'Vous seul voyez vos projets, documents et échanges'))),
        h('div', { class: 'pc-info' }, h('span', { class: 'pc-info-ico' }, ic('activity', 17)), h('span', {}, h('b', {}, 'Suivi en temps réel'), h('small', {}, 'Mis à jour par l’agence à chaque avancée' + (p.updated_at ? ' · dernière le ' + day(p.updated_at) : '')))))

      // petits écrans : la timeline défile ; on l'ouvre sur l'étape en cours
      setTimeout(function () { var c = timeline.querySelector('.pc-tl-etape.cours'); if (c && timeline.scrollWidth > timeline.clientWidth) timeline.scrollLeft = c.offsetLeft - 8 }, 0)
      return [tete, choixProjet, timeline, h('div', { class: 'pc-grille' }, zone, cote), infos]
    })
  }

  function carteDemandes(d, titre, max) {
    var noms = {}; d.projets.forEach(function (p) { noms[p.id] = p.titre })
    var l = max ? d.demandes.slice(0, max) : d.demandes
    return h('section', { class: 'carte sans-marge' },
      h('header', { class: 'tete-tableau' }, h('div', {}, h('h2', {}, titre), h('span', { class: 'discret petit' }, pl(d.demandes.length, 'demande') + ' · ' + pl(d.demandes.filter(function (q) { return q.statut !== 'terminee' }).length, 'ouverte'))),
        h('a', { class: 'btn petit', href: '#nouvelle' }, ic('plus', 14), 'Nouvelle demande')),
      l.length ? h('div', { class: 'table-zone', tabindex: '0', role: 'region', 'aria-label': titre },
        h('table', { class: 'table-services' },
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Sujet'), h('th', { scope: 'col' }, 'Projet'), h('th', { scope: 'col' }, 'Statut'), h('th', { scope: 'col', class: 'num' }, 'Dernière activité'))),
          h('tbody', {}, l.map(function (q) {
            return h('tr', {},
              h('td', {}, h('a', { class: 'service-nom lien-ligne', href: '#demande/' + q.id }, h('span', { class: 'service-ini', 'aria-hidden': 'true' }, ic('message-square', 15)), q.sujet)),
              h('td', {}, noms[q.project_id] || h('span', { class: 'discret' }, 'Autre sujet')),
              h('td', {}, statut(q.statut)),
              h('td', { class: 'num' }, day(q.updated_at)))
          })))) : UI.etatVide('Vous n’avez fait aucune demande pour l’instant.', 'message-square'))
  }

  /* ---------- documents partagés par l'agence (et ceux que vous avez déposés) ---------- */
  function listeDocuments(liste, vide, d) {
    var noms = {}; d.projets.forEach(function (p) { noms[p.id] = p.titre })
    return h('section', { class: 'carte sans-marge' },
      liste.length ? h('div', { class: 'table-zone', tabindex: '0', role: 'region', 'aria-label': 'Documents' },
        h('table', { class: 'table-services pc-table-docs' },
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Document'), h('th', { scope: 'col' }, 'Type'), h('th', { scope: 'col' }, 'Projet'), h('th', { scope: 'col' }, 'Ajouté le'), h('th', { scope: 'col', class: 'num' }, ''))),
          h('tbody', {}, liste.map(function (x) {
            return h('tr', {},
              h('td', {}, h('span', { class: 'service-nom' }, h('span', { class: 'service-ini', 'aria-hidden': 'true' }, ic('file-text', 15)), h('span', {}, x.nom, h('small', { class: 'discret', style: 'display:block;font-weight:400' }, (x.version > 1 ? 'version ' + x.version + ' · ' : '') + taille(x.taille) + (x.uploaded_role === 'client' ? ' · déposé par vous' : ''))))),
              h('td', {}, UI.badge(CATEGORIES[x.categorie] || 'Document', x.categorie === 'facture' ? 'attention' : '')),
              h('td', {}, noms[x.project_id] || h('span', { class: 'discret' }, '—')),
              h('td', {}, day(x.created_at)),
              h('td', { class: 'num' }, telecharger(x)))
          })))) : UI.etatVide(vide, 'folder'))
  }
  function documents() {
    return lire(true).then(function (d) {
      var docs = d.documents.filter(function (x) { return ['devis', 'facture', 'contrat'].indexOf(x.categorie) < 0 })
      var cats = []; docs.forEach(function (x) { if (cats.indexOf(x.categorie) < 0) cats.push(x.categorie) })
      var zone = h('div')
      function dessiner(c) { zone.replaceChildren(listeDocuments(c ? docs.filter(function (x) { return x.categorie === c }) : docs, 'Les maquettes, livrables et guides de votre projet apparaîtront ici dès que l’agence les partage.', d)) }
      var filtres = cats.length > 1 ? h('div', { class: 'pc-filtres', role: 'group', 'aria-label': 'Filtrer par type' }, [''].concat(cats).map(function (c, i) {
        return h('button', { type: 'button', 'aria-pressed': String(!i), onclick: function (ev) { ev.currentTarget.parentNode.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', 'false') }); ev.currentTarget.setAttribute('aria-pressed', 'true'); dessiner(c) } }, c ? CATEGORIES[c] || c : 'Tous')
      })) : null
      dessiner('')
      return [enTetePage('Mes', 'documents', 'Maquettes, livrables, guides et fichiers de votre projet, au même endroit.'), filtres, zone,
        livres(d)]
    })
  }
  function livres(d) {
    var l = d.nouvelles.filter(function (u) { return u.kind === 'livre' })
    if (!l.length) return null
    var noms = {}; d.projets.forEach(function (p) { noms[p.id] = p.titre })
    return UI.carte('Livraisons annoncées par l’agence', pl(l.length, 'élément'), h('ul', { class: 'pc-livres grand' }, l.map(function (u) { return h('li', {}, ic('check', 13), h('span', {}, h('b', {}, u.titre), u.detail ? h('small', {}, u.detail) : null), h('small', {}, (noms[u.project_id] || '') + ' · ' + day(u.created_at))) })))
  }
  /* ---------- facturation : devis, contrats et factures partagés ---------- */
  function facturation() {
    return lire(true).then(function (d) {
      var l = d.documents.filter(function (x) { return ['devis', 'facture', 'contrat'].indexOf(x.categorie) >= 0 })
      var n = function (c) { return l.filter(function (x) { return x.categorie === c }).length }
      return [enTetePage('Votre', 'facturation', 'Les devis, contrats et factures que l’agence a partagés avec vous.'),
        h('div', { class: 'grille kpi' },
          UI.tuile('Devis', String(n('devis')), 'documents partagés', false, { icone: 'file-text' }),
          UI.tuile('Contrats', String(n('contrat')), 'documents partagés', false, { icone: 'file-signature' }),
          UI.tuile('Factures', String(n('facture')), 'documents partagés', false, { icone: 'receipt-text' })),
        listeDocuments(l, 'Vos devis, contrats et factures apparaîtront ici dès que l’agence les partage.', d),
        h('p', { class: 'discret petit', style: 'display:flex;gap:8px;align-items:center' }, ic('info', 14), 'Une question sur une facture ? ', h('a', { href: '#nouvelle' }, 'Écrivez-nous'), '.')]
    })
  }
  /* ---------- paramètres du compte ---------- */
  function parametres() {
    var msg = h('div', { class: 'erreur', role: 'alert', hidden: true }), ok = h('div', { class: 'ok', role: 'status', hidden: true })
    var a = h('input', { type: 'password', autocomplete: 'new-password', minlength: '10', required: true }), b = h('input', { type: 'password', autocomplete: 'new-password', required: true })
    var form = h('form', { class: 'formulaire', novalidate: true },
      h('label', { class: 'champ' }, h('span', {}, 'Nouveau mot de passe'), a), h('label', { class: 'champ' }, h('span', {}, 'Confirmer'), b), msg, ok,
      h('div', {}, h('button', { class: 'btn principal', type: 'submit' }, ic('save', 15), 'Changer le mot de passe')))
    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); msg.hidden = true; ok.hidden = true
      if (a.value.length < 10) { msg.textContent = 'Le mot de passe doit faire au moins 10 caractères.'; msg.hidden = false; return }
      if (a.value !== b.value) { msg.textContent = 'Les deux mots de passe ne sont pas identiques.'; msg.hidden = false; return }
      S.auth.setPassword(a.value).then(function () { a.value = b.value = ''; ok.textContent = 'Mot de passe changé.'; ok.hidden = false }, function (er) { msg.textContent = 'Impossible : ' + er.message; msg.hidden = false })
    })
    var theme = function (t, lib, icone) { return h('button', { type: 'button', 'aria-pressed': String((window.CreatigoTheme ? window.CreatigoTheme.current() : 'light') === t), onclick: function (ev) { try { localStorage.setItem('creatigo.theme', t) } catch (x) {} if (window.CreatigoTheme) window.CreatigoTheme.apply(); ev.currentTarget.parentNode.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', 'false') }); ev.currentTarget.setAttribute('aria-pressed', 'true') } }, ic(icone, 15), lib) }
    return [enTetePage('Vos', 'paramètres', 'Votre compte, votre mot de passe et l’affichage de votre espace.'),
      h('div', { class: 'rangee r11' },
        UI.carte('Votre compte', h('div', { class: 'cles' },
          h('div', {}, h('span', {}, 'Nom'), h('b', {}, acc.nom || '—')),
          h('div', {}, h('span', {}, 'Adresse e-mail'), h('b', {}, S.auth.email() || '—')),
          h('div', {}, h('span', {}, 'Accès'), h('b', {}, 'Client'))),
          h('p', { class: 'discret petit' }, 'Pour changer de nom ou d’adresse e-mail, écrivez à l’équipe.')),
        UI.carte('Mot de passe', 'au moins 10 caractères', form)),
      UI.carte('Affichage', 'clair ou sombre', h('div', { class: 'pc-filtres' }, theme('light', 'Clair', 'sun'), theme('dark', 'Sombre', 'moon'))),
      h('div', {}, h('button', { class: 'btn', type: 'button', onclick: function () { cache = null; S.auth.signOut().then(login) } }, ic('log-out', 15), 'Se déconnecter'))]
  }

  /* ---------- demandes ---------- */
  function demandes() {
    return lire(true).then(function (d) {
      return [enTetePage('Mes', 'échanges', 'Vos questions et demandes à l’équipe, sujet par sujet.', h('a', { class: 'btn principal', href: '#nouvelle' }, ic('plus', 15), 'Nouvelle demande')), carteDemandes(d, 'Toutes mes demandes')]
    })
  }

  function fil(id) {
    return Promise.all([S.sb.get('portal_requests?id=eq.' + enc(id) + '&select=*'), S.sb.get('portal_messages?request_id=eq.' + enc(id) + '&select=*&order=created_at.asc'), S.sb.get('client_projects?select=id,titre')]).then(function (r) {
      var q = r[0][0]
      var retour = h('p', {}, h('a', { class: 'btn lien', href: '#echanges' }, ic('chevron-left', 15), 'Mes échanges'))
      if (!q) return [retour, h('section', { class: 'carte' }, UI.etatVide('Demande introuvable.', 'message-square'))]
      var pj = r[2].filter(function (p) { return p.id === q.project_id })[0]
      var echanges = UI.carte('Échanges', pl(r[1].length, 'message'), h('div', { class: 'fil-msg' }, r[1].map(function (m) {
        var agence = m.author === 'agence'
        return h('div', { class: 'bulle-msg' + (agence ? '' : ' moi') }, h('div', { class: 'qui' }, h('b', {}, agence ? 'Creatigo' : 'Vous'), when(m.created_at)), h('p', {}, m.body))
      })))
      if (q.statut === 'terminee') echanges.append(h('p', { class: 'discret' }, 'Cette demande est terminée. Pour un nouveau sujet, ouvrez une nouvelle demande.'))
      else {
        var t = h('textarea', { rows: '4', maxlength: '5000', required: true, placeholder: 'Votre message…' }), em = h('div', { class: 'erreur', role: 'alert', hidden: true })
        var f = h('form', { class: 'formulaire', novalidate: true }, h('label', { class: 'champ' }, h('span', {}, 'Répondre'), t), em, h('div', {}, h('button', { class: 'btn principal', type: 'submit' }, ic('send', 15), 'Envoyer')))
        f.addEventListener('submit', function (e) {
          e.preventDefault(); em.hidden = true
          if (!t.value.trim()) { em.textContent = 'Écrivez un message.'; em.hidden = false; return }
          S.sb.post('portal_messages', { request_id: id, author: 'client', body: t.value.trim() }).then(route, function () { em.textContent = 'Envoi impossible pour le moment. Réessayez.'; em.hidden = false })
        })
        echanges.append(f)
      }
      var cote = UI.carte('Détails', h('div', { class: 'cles' },
        h('div', {}, h('span', {}, 'Statut'), statut(q.statut)),
        h('div', {}, h('span', {}, 'Ouverte le'), h('b', {}, day(q.created_at))),
        h('div', {}, h('span', {}, 'Messages'), h('b', {}, String(r[1].length))),
        pj ? h('div', {}, h('span', {}, 'Projet'), h('a', { href: '#projet/' + pj.id }, pj.titre)) : null))
      return [retour, enTetePage(q.sujet, '', (pj ? pj.titre + ' · ' : '') + 'ouverte le ' + day(q.created_at), statut(q.statut)), h('div', { class: 'rangee r21' }, echanges, h('div', { style: 'display:grid;gap:20px;align-content:start' }, cote))]
    })
  }

  function nouvelle(pid) {
    return S.sb.get('client_projects?select=id,titre&order=created_at.desc').then(function (projects) {
      var msg = h('div', { class: 'erreur', role: 'alert', hidden: true })
      var sel = h('select', {}, h('option', { value: '' }, 'Autre sujet (pas lié à un projet)'), projects.map(function (p) { return h('option', { value: p.id, selected: p.id === pid }, p.titre) }))
      var sujet = h('input', { type: 'text', maxlength: '200', required: true, placeholder: 'En une phrase' }), texte = h('textarea', { rows: '7', maxlength: '5000', required: true, placeholder: 'Décrivez votre demande…' })
      var form = h('form', { class: 'formulaire', novalidate: true },
        h('label', { class: 'champ' }, h('span', {}, 'Projet concerné'), sel),
        h('label', { class: 'champ' }, h('span', {}, 'Sujet'), sujet),
        h('label', { class: 'champ' }, h('span', {}, 'Votre demande'), texte), msg,
        h('div', {}, h('button', { class: 'btn principal', type: 'submit' }, ic('send', 15), 'Envoyer la demande')))
      form.addEventListener('submit', function (e) {
        e.preventDefault(); msg.hidden = true
        if (!sujet.value.trim() || !texte.value.trim()) { msg.textContent = 'Renseignez le sujet et votre demande.'; msg.hidden = false; return }
        var row = { client_id: acc.client_id, sujet: sujet.value.trim() }; if (sel.value) row.project_id = sel.value
        S.sb.post('portal_requests', row).then(function (r) {
          return S.sb.post('portal_messages', { request_id: r[0].id, author: 'client', body: texte.value.trim() }).then(function () { cache = null; location.hash = '#demande/' + r[0].id })
        }).catch(function () { msg.textContent = 'Envoi impossible pour le moment. Réessayez.'; msg.hidden = false })
      })
      var conseils = UI.carte('Pour une réponse rapide', h('ul', { class: 'coches' }, ['Un sujet court et précis.', 'Le projet concerné, si possible.', 'Les liens ou détails utiles.'].map(function (t) {
        return h('li', {}, h('span', { class: 'coche', 'aria-hidden': 'true', style: 'border-color:var(--accent);color:var(--accent)' }, ic('check', 14)), h('div', {}, h('span', {}, t)))
      })))
      return [enTetePage('Nouvelle', 'demande', 'Une question, une modification, un document à transmettre : l’équipe vous répond ici.'), h('div', { class: 'rangee r21' }, UI.carte('Votre demande', 'réponse sous un jour ouvré', form), conseils)]
    })
  }

  /* ---------- go ---------- */
  if (!S || !S.sb || !S.sb.enabled) { root.replaceChildren(h('main', { class: 'connexion', style: 'display:grid;place-items:center' }, h('div', { class: 'erreur', role: 'alert' }, 'L’espace client est momentanément indisponible.'))); return }
  S.auth.fromHash().then(function (type) { if (type === 'invite' || type === 'recovery') newPassword(type); else boot() }, function () { boot() })
})()
