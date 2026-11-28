/* Administration : intégrations (phase 9). #integrations
   État RÉEL de chaque service (lu côté serveur, jamais de clé affichée), jeton robot, e-mails (file d'envoi, envoi immédiat, réglages),
   paiement en ligne Stripe, préférences de notification de la personne connectée, services pas encore raccordés.
   Les clés se saisissent dans Netlify (variables d'environnement), jamais ici ni dans le dépôt. */
(function () {
  var K = function () { return window.AdminKit }
  var UI = function () { return window.UI }
  var M = window.AdminModules = window.AdminModules || {}
  function S() { return K().S }
  function enLigne() { return S().sb && S().sb.on() }
  function direction() { var r = K().role(); return r === 'super_admin' || r === 'admin' }
  function erreur(er) { var m = String((er && er.message) || er); var x = /"message":"([^"]+)"/.exec(m); return x ? x[1] : m }
  function quand(iso) { if (!iso) return 'jamais'; var d = new Date(iso); return d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  function api(chemin, opt) {
    return S().auth.token().then(function (j) { return fetch(chemin, Object.assign({}, opt, { headers: Object.assign({ Authorization: 'Bearer ' + j, 'Content-Type': 'application/json' }, (opt || {}).headers) })) })
      .then(function (r) { return r.json().catch(function () { return {} }).then(function (b) { if (r.status === 404 && !b.erreur) throw new Error('fonctions serveur non déployées ici'); if (!r.ok) throw new Error(b.erreur || 'erreur ' + r.status); return b }) })
  }
  function pastille(ok, oui, non) { return UI().badge(ok ? oui : non, ok ? 'bon' : '') }
  function variable(nom) { return UI().h('code', { class: 'ig-var' }, nom) }

  function integrations() {
    var U = UI(), h = U.h, main = K().main
    main.append(U.entete('Intégrations', 'Services externes : état réel, réglages et sécurité. Les clés se saisissent dans Netlify, jamais dans l’outil.', null))
    if (!enLigne()) { main.append(U.etatVide('Disponible quand l’administration est connectée à la base.', 'database')); return }
    var origine = location.origin
    var zone = h('div', { class: 'ig-grille' }); main.append(zone)
    Promise.all([api('/api/integrations-etat').catch(function (e) { return { horsLigne: erreur(e) } }), S().rpc('courriels_etat', {}).catch(function () { return null }),
      S().sb.get('settings?key=eq.integrations&select=value').then(function (x) { return (x[0] || {}).value || {} }).catch(function () { return {} }), direction() ? S().rpc('robot_jetons_liste', {}).catch(function () { return null }) : Promise.resolve(null)]).then(function (r) {
      var e = r[0], file = r[1], reg = r[2] || {}, jetons = r[3]
      var hors = e.horsLigne
      var noteHors = hors ? h('p', { class: 'ig-alerte' }, U.icone('triangle-alert', 15), 'État des services indisponible : ' + hors + '. Il s’affichera sur le site déployé (Netlify).') : null
      if (file === null) zone.append(h('p', { class: 'ig-alerte' }, U.icone('triangle-alert', 15), 'Le script supabase/integrations.sql n’a pas encore été lancé dans Supabase.'))

      // ---- jeton robot ----
      var jetonZone = h('div', { class: 'ig-corps' })
      function dessinerJetons(l) {
        jetonZone.replaceChildren.apply(jetonZone, [
          h('p', {}, 'Permet au serveur d’envoyer les e-mails et d’enregistrer les paiements Stripe sans clé « super-utilisateur ». Il ne peut rien faire d’autre.'),
          hors ? null : h('p', {}, 'Sur le serveur : ', pastille(e.robot, 'Jeton installé', 'Jeton absent')),
          l && l.length ? h('ul', { class: 'ig-liste' }, l.map(function (j) {
            return h('li', {}, h('span', {}, h('b', {}, j.nom), h('small', { class: 'discret' }, ' créé le ' + quand(j.created_at) + ' · dernier usage : ' + quand(j.dernier_usage))),
              j.revoque_at ? U.badge('Révoqué', '') : h('button', { class: 'btn lien petit', type: 'button', onclick: function () {
                U.confirmer({ titre: 'Révoquer ce jeton ?', texte: 'Le serveur ne pourra plus envoyer d’e-mails ni enregistrer de paiements tant qu’un nouveau jeton n’est pas installé.', bouton: 'Révoquer', danger: true })
                  .then(function (ok) { if (ok) S().rpc('robot_jeton_revoquer', { rid: j.id }).then(function () { return S().rpc('robot_jetons_liste', {}) }).then(dessinerJetons) })
              } }, 'Révoquer'))
          })) : null,
          direction() ? h('button', { class: 'btn', type: 'button', onclick: function () {
            S().rpc('robot_jeton_creer', { p_nom: 'Serveur Netlify' }).then(function (j) {
              var champ = h('input', { readonly: true, value: j, class: 'ig-jeton', onfocus: function (ev) { ev.target.select() } })
              jetonZone.prepend(h('div', { class: 'ig-nouveau' }, h('b', {}, 'Copiez ce jeton maintenant : il ne sera plus jamais affiché.'), champ,
                h('button', { class: 'btn petit', type: 'button', onclick: function () { navigator.clipboard && navigator.clipboard.writeText(j).then(function () { U.toast('Jeton copié.', 'bon') }) } }, U.icone('copy', 14), 'Copier'),
                h('p', { class: 'discret' }, 'Dans Netlify : Site configuration → Environment variables → ', variable('ROBOT_JETON'), ' = ce jeton, puis redéployez.')))
              return S().rpc('robot_jetons_liste', {}).then(dessinerJetons)
            }, function (er) { U.toast(erreur(er), 'erreur') })
          } }, U.icone('key-round', 15), 'Créer un jeton robot') : h('p', { class: 'discret' }, 'Seule la direction gère les jetons.')].filter(Boolean))
      }
      dessinerJetons(jetons)
      zone.append(U.carte('Jeton robot du serveur', 'sécurité', jetonZone))

      // ---- e-mails ----
      var fo = e.email && e.email.fournisseur
      var champsReg = { notif: h('input', { type: 'checkbox', checked: reg.emails_notifications !== false, disabled: !direction() }), url: h('input', { type: 'url', value: reg.site_url || '', placeholder: origine, disabled: !direction() }) }
      var bEnvoi = h('button', { class: 'btn', type: 'button', disabled: !!hors, onclick: function () {
        bEnvoi.disabled = true
        api('/api/courriels', { method: 'POST', body: '{}' }).then(function (x) {
          U.toast(x.statut === 'ok' ? x.envoyes + ' envoyé(s), ' + x.echecs + ' échec(s).' : x.statut === 'non_configure' ? 'Service d’envoi non configuré.' : 'Jeton robot absent sur le serveur.', x.statut === 'ok' && !x.echecs ? 'bon' : 'erreur'); K().route()
        }, function (er) { bEnvoi.disabled = false; U.toast(erreur(er), 'erreur') })
      } }, U.icone('send', 15), 'Envoyer maintenant')
      zone.append(U.carte('E-mails', 'Resend ou Brevo',
        h('div', { class: 'ig-corps' },
          hors ? null : h('p', {}, 'Service : ', pastille(!!fo, fo === 'resend' ? 'Resend connecté' : 'Brevo connecté', 'Non connecté'), e.email && e.email.expediteur ? h('small', { class: 'discret' }, ' · expéditeur ' + e.email.expediteur) : null),
          file ? h('p', { class: 'discret' }, file.en_attente + ' en attente · ' + file.envoyes + ' envoyé(s) · ' + file.echecs + ' échec(s) · dernier envoi : ' + quand(file.dernier_envoi)) : null,
          h('div', { class: 'cta' }, bEnvoi, h('a', { class: 'btn lien', href: '#automatisations/courriels' }, 'Voir la file d’envoi')),
          h('details', { class: 'ig-aide' }, h('summary', {}, 'Comment le connecter'), h('ol', {},
            h('li', {}, 'Créez un compte Resend (resend.com) ou Brevo (brevo.com) et validez votre nom de domaine d’envoi.'),
            h('li', {}, 'Dans Netlify, ajoutez ', variable('RESEND_API_KEY'), ' (ou ', variable('BREVO_API_KEY'), ') et ', variable('EMAIL_EXPEDITEUR'), ' (ex. Creatigo <contact@votre-domaine.fr>).'),
            h('li', {}, 'Installez le jeton robot (carte ci-contre), puis redéployez. Les e-mails partent ensuite toutes les 5 minutes.'))),
          h('h3', { class: 'ig-sous' }, 'Réglages'),
          h('label', { class: 'sm-chk' }, champsReg.notif, 'Envoyer aussi les notifications par e-mail (selon les préférences de chacun)'),
          h('label', {}, 'Adresse du site (liens dans les e-mails)', champsReg.url),
          direction() ? h('div', { class: 'cta' }, h('button', { class: 'btn principal', type: 'button', onclick: function () {
            var url = champsReg.url.value.trim().replace(/\/$/, '')
            if (url && !/^https:\/\/[^\s/]+/.test(url)) { U.toast('L’adresse doit commencer par https://', 'erreur'); return }
            S().sb.upsert('settings?on_conflict=key', [{ key: 'integrations', value: Object.assign({}, reg, { emails_notifications: champsReg.notif.checked, site_url: url }) }]).then(function () { U.toast('Réglages enregistrés.', 'bon') }, function (er) { U.toast(erreur(er), 'erreur') })
          } }, 'Enregistrer les réglages')) : null)))

      // ---- Stripe ----
      var s = e.stripe || {}
      zone.append(U.carte('Paiement en ligne', 'Stripe',
        h('div', { class: 'ig-corps' },
          hors ? null : h('p', {}, 'Clé : ', pastille(s.cle, s.mode === 'live' ? 'Connecté (réel)' : 'Connecté (mode test)', 'Non connecté'), ' · Webhook : ', pastille(s.webhook, 'Configuré', 'Non configuré'), ' · Jeton robot : ', pastille(e.robot, 'Installé', 'Absent')),
          h('p', { class: 'discret' }, s.cle && s.webhook && e.robot ? 'Vos clients voient un bouton « Payer en ligne » sur leurs factures à régler. Chaque paiement confirmé par Stripe est enregistré automatiquement sur la facture.' : 'Tant que les trois éléments ne sont pas en place, le bouton de paiement n’apparaît pas chez les clients.'),
          h('details', { class: 'ig-aide' }, h('summary', {}, 'Comment le connecter'), h('ol', {},
            h('li', {}, 'Dans Stripe (Développeurs → Clés API), copiez la clé secrète dans Netlify : ', variable('STRIPE_SECRET_KEY'), '. Commencez par la clé de test (sk_test_…).'),
            h('li', {}, 'Dans Stripe (Développeurs → Webhooks), ajoutez l’adresse ', h('code', {}, origine + '/api/stripe-webhook'), ' avec les événements checkout.session.completed et checkout.session.async_payment_succeeded.'),
            h('li', {}, 'Copiez le « secret de signature » du webhook (whsec_…) dans Netlify : ', variable('STRIPE_WEBHOOK_SECRET'), ', installez le jeton robot, puis redéployez.'))))))

      // ---- préférences de la personne connectée ----
      if (window.CreatigoNotifPrefs) zone.append(window.CreatigoNotifPrefs.carte({ h: h, UI: U, S: S(), client: false }))

      // ---- autres services ----
      var autres = [
        ['Assistant IA (Jarvis)', hors ? null : e.ia, 'Clé Anthropic dans Netlify (ANTHROPIC_API_KEY) ou ajoutée depuis la page Assistant IA.', '#ia'],
        ['Google Analytics, Search Console, Google Ads', false, 'Raccordement automatique non disponible : importez les exports CSV dans Performances clients.', '#performances'],
        ['Google Calendar', false, 'Non connecté : les rendez-vous restent gérés dans l’outil.', '#rdv'],
        ['Signature électronique (prestataire externe)', false, 'Non connecté : les contrats se signent en ligne dans l’espace client (nom, date, empreinte du document conservés).', '#finances/contrats'],
        ['Stockage des documents', true, 'Stockage privé Supabase actif (accès vérifié fichier par fichier).', null],
      ]
      zone.append(U.carte('Autres services', '', h('ul', { class: 'ig-liste' }, autres.map(function (a) {
        return h('li', {}, h('span', {}, h('b', {}, a[0]), h('br'), h('small', { class: 'discret' }, a[2])), a[1] === null ? U.badge('État inconnu ici', '') : pastille(a[1], 'Connecté', 'Non connecté'), a[3] ? h('a', { class: 'btn lien petit', href: a[3] }, 'Ouvrir') : null)
      }))))
      if (noteHors) zone.prepend(noteHors)
    })
  }
  M.integrations = integrations
})()
