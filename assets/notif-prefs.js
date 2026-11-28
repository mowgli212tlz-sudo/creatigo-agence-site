/* Préférences de notification par e-mail (phase 9), commun à l'admin et à l'espace client.
   Chacun ne règle que sa propre ligne (règle de la base : supabase/integrations.sql). Sans réglage : clients oui, équipe non. */
(function () {
  var TYPES_CLIENT = [['message', 'Nouveaux messages'], ['devis', 'Devis'], ['facture', 'Factures'], ['paiement', 'Paiements'], ['livrable', 'Maquettes et livrables à valider'],
    ['document', 'Nouveaux documents'], ['demande', 'Suivi de vos demandes'], ['contrat', 'Contrats'], ['projet', 'Avancement du projet'], ['maintenance', 'Interventions sur votre site'],
    ['incident', 'Incidents sur votre site'], ['automatisation', 'Autres informations de l’agence']]
  var TYPES_EQUIPE = [['message', 'Messages des clients'], ['demande', 'Demandes de support'], ['devis', 'Devis (acceptés, refusés)'], ['facture', 'Factures'], ['paiement', 'Paiements reçus'],
    ['livrable', 'Décisions sur les livrables'], ['contrat', 'Contrats signés'], ['contact', 'Messages du site'], ['rdv', 'Rendez-vous'], ['crm', 'Commercial'],
    ['site', 'Sites en erreur'], ['automatisation', 'Automatisations']]

  function carte(ctx) {
    var h = ctx.h, UI = ctx.UI, S = ctx.S, email = (S.auth.email() || '').toLowerCase()
    var types = ctx.client ? TYPES_CLIENT : TYPES_EQUIPE
    var zone = h('div', { class: 'np-zone' }, h('p', { class: 'discret' }, 'Chargement…'))
    if (!email || !(S.sb && S.sb.on && S.sb.on())) { zone.replaceChildren(h('p', { class: 'discret' }, 'Disponible une fois connecté.')); return UI.carte('Notifications par e-mail', zone) }
    S.sb.get('notification_prefs?email=eq.' + encodeURIComponent(email) + '&select=emails,exclus').then(function (r) {
      var p = r[0] || { emails: !!ctx.client, exclus: [] }
      var principal = h('input', { type: 'checkbox', checked: p.emails })
      var cases = types.map(function (t) { return h('label', { class: 'np-case' }, h('input', { type: 'checkbox', value: t[0], checked: (p.exclus || []).indexOf(t[0]) < 0 }), t[1]) })
      var liste = h('div', { class: 'np-liste', hidden: !p.emails }, cases)
      principal.addEventListener('change', function () { liste.hidden = !principal.checked })
      var etat = h('span', { class: 'discret', role: 'status' })
      var b = h('button', { class: 'btn principal', type: 'button', onclick: function () {
        var exclus = cases.map(function (c) { return c.querySelector('input') }).filter(function (i) { return !i.checked }).map(function (i) { return i.value })
        b.disabled = true
        S.sb.upsert('notification_prefs?on_conflict=email', [{ email: email, emails: principal.checked, exclus: exclus, updated_at: new Date().toISOString() }])
          .then(function () { etat.textContent = 'Préférences enregistrées.' }, function (er) { etat.textContent = 'Impossible : ' + (er.message || er) }).then(function () { b.disabled = false })
      } }, 'Enregistrer')
      zone.replaceChildren(h('label', { class: 'np-case np-principal' }, principal, ctx.client ? 'Recevoir aussi mes notifications par e-mail' : 'Recevoir les notifications de l’équipe par e-mail'),
        liste, h('div', { class: 'np-actions' }, b, etat),
        h('p', { class: 'discret petit' }, 'Envoyées à ' + email + '. Toujours visibles dans la cloche, même sans e-mail.'))
    }).catch(function () { zone.replaceChildren(h('p', { class: 'discret' }, 'Préférences indisponibles pour le moment (script supabase/integrations.sql à lancer).')) })
    return UI.carte('Notifications par e-mail', zone)
  }
  window.CreatigoNotifPrefs = { carte: carte }
})()
