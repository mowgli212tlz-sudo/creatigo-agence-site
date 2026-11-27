/* Administration : clés d'API de l'assistant Jarvis (Équipe & accès, super administrateur).
   Comme dans Creatigo SIRH : la clé s'écrit, se teste, se désactive, se supprime, mais ne se relit jamais. Elle est envoyée à la fonction
   /api/jarvis-cles qui la vérifie auprès d'Anthropic puis la chiffre avant de la ranger en base. Tout texte passe par textContent. */
(function () {
  function apiJarvis(n) { var b = window.CREATIGO_SB && window.CREATIGO_SB.api; return (b ? String(b).replace(/\/$/, '') : '/api') + '/' + n }
  var K = function () { return window.AdminKit }
  function dt(iso) { if (!iso) return ''; var d = new Date(iso); return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  function appel(corps) {
    return K().S.auth.token().then(function (jeton) {
      return fetch(apiJarvis('jarvis-cles'), { method: corps ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' }, body: corps ? JSON.stringify(corps) : undefined })
    }).then(function (r) { return r.json().catch(function () { return {} }).then(function (j) { if (!r.ok) throw new Error(j.erreur || 'Erreur ' + r.status); return j }) })
  }
  function iaCles(parent) {
    var e = K().el
    var zone = e('div', { class: 'panel', style: 'margin-top:24px', 'data-jv-interdit': '' }), msg = e('p', { class: 'msg', role: 'status' })
    parent.appendChild(zone)
    function etat(c) { return !c.actif ? ['Désactivée', 'b-r-collaborateur'] : (c.repos_jusqu && new Date(c.repos_jusqu) > new Date()) ? ['Au repos jusqu’à ' + dt(c.repos_jusqu), 'b-r-chef_projet'] : ['Active', 'b-r-super_admin'] }
    function dessiner(d) {
      zone.textContent = ''
      zone.appendChild(e('h2', { text: 'Assistant IA (Jarvis) : clés d’API', style: 'margin-top:0' }))
      zone.appendChild(e('p', { class: 'mut', text: 'Ajoutez ici la clé Claude qui fait fonctionner Jarvis. Elle est testée, puis chiffrée : une fois enregistrée, elle ne s’affiche plus jamais. Avec plusieurs clés, la suivante prend le relais si une est refusée ou saturée.' }))
      if (!d.chiffrement) {
        zone.appendChild(e('div', { class: 'msg msg-maj', role: 'alert' }, [e('b', { text: 'Une étape manque pour protéger les clés. ' }), document.createTextNode('Dans Netlify > Site configuration > Environment variables, ajoutez JARVIS_CLE_SECRETE avec une valeur générée par la commande ci-dessous, puis redéployez le site.'),
          e('pre', { text: 'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"', style: 'user-select:all;margin:8px 0 0;overflow:auto' })]))
      }
      if (d.cle_netlify) zone.appendChild(e('p', { class: 'mut petit', text: 'Une clé ANTHROPIC_API_KEY est aussi définie dans Netlify : elle sert en dernier recours.' }))
      if (d.cles.length) {
        zone.appendChild(e('div', { class: 'tw' }, [e('table', {}, [
          e('thead', {}, [e('tr', {}, ['Clé', 'Fin', 'État', 'Utilisée', 'Échecs', ''].map(function (h) { return e('th', { text: h }) }))]),
          e('tbody', {}, d.cles.map(function (c) {
            var s = etat(c)
            return e('tr', {}, [e('td', { text: c.libelle }), e('td', { text: '••••' + c.fin }), e('td', {}, [e('span', { class: 'badge ' + s[1], text: s[0] }), c.derniere_erreur ? e('div', { class: 'mut petit', text: c.derniere_erreur }) : null]),
              e('td', { text: String(c.utilisations) }), e('td', { text: String(c.echecs) }),
              e('td', {}, [
                e('button', { class: 'lnk', type: 'button', text: 'Tester', onclick: function () { agir({ action: 'tester', id: c.id }, 'Test en cours…') } }), document.createTextNode(' '),
                e('button', { class: 'lnk', type: 'button', text: c.actif ? 'Désactiver' : 'Activer', onclick: function () { agir({ action: 'activer', id: c.id, actif: !c.actif }) } }), document.createTextNode(' '),
                e('button', { class: 'lnk danger', type: 'button', text: 'Supprimer', onclick: function () { if (confirm('Supprimer la clé « ' + c.libelle + ' » ? Jarvis ne pourra plus l’utiliser.')) agir({ action: 'supprimer', id: c.id }) } })])])
          }))])]))
      } else zone.appendChild(e('p', { class: 'mut', text: 'Aucune clé enregistrée pour le moment.' }))
      var nom = e('input', { placeholder: 'Principale', maxlength: 40, 'aria-label': 'Nom de la clé' })
      var cle = e('input', { type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Clé d’API Claude' })
      zone.appendChild(e('div', { class: 'bar', style: 'margin-top:14px' }, [K().field('Nom (facultatif)', nom), K().field('Clé Claude (console.anthropic.com)', cle),
        e('button', { class: 'btn', type: 'button', text: 'Ajouter la clé', disabled: !d.chiffrement, onclick: function () {
          var v = cle.value.trim(); if (!v) { msg.textContent = 'Collez d’abord la clé.'; return }
          agir({ action: 'ajouter', cle: v, libelle: nom.value, par: K().S.auth.email() }, 'Vérification auprès d’Anthropic…', function () { cle.value = '' })
        } })]))
      zone.appendChild(msg)
    }
    function agir(corps, attente, apres) {
      msg.textContent = attente || ''
      appel(corps).then(function (d) {
        dessiner(d); if (apres) apres()
        msg.textContent = corps.action === 'tester' ? (d.ok ? 'Cette clé fonctionne.' : (d.erreur || 'Échec du test.')) : corps.action === 'ajouter' ? 'Clé ajoutée et chiffrée. Jarvis peut l’utiliser.' : 'Fait.'
      }).catch(function (er) { msg.textContent = er.message })
    }
    appel().then(dessiner).catch(function (er) { zone.appendChild(e('p', { class: 'mut', text: 'Clés de Jarvis indisponibles : ' + er.message })) })
  }
  /* ---------- réponse automatique différée aux messages des clients ---------- */
  function iaAuto(parent) {
    var e = K().el, S = K().S
    var zone = e('div', { class: 'panel', style: 'margin-top:24px', 'data-jv-interdit': '' }), msg = e('p', { class: 'msg', role: 'status' })
    parent.appendChild(zone)
    Promise.all([S.sb.get('jarvis_reglages?cle=eq.reponse_auto&select=valeur'), S.sb.post('rpc/jarvis_auto_etat', {}).catch(function () { return {} })]).then(function (r) {
      var v = (r[0][0] && r[0][0].valeur) || { actif: false, delai_heures: 4, message: '' }, etat = r[1] || {}
      var actif = e('input', { type: 'checkbox', 'aria-label': 'Activer la réponse automatique' }); actif.checked = !!v.actif
      var delai = e('select', { 'aria-label': 'Délai avant la réponse automatique' }, [1, 2, 4, 8, 24, 48].map(function (h) { return e('option', { value: String(h), text: h + (h > 1 ? ' heures' : ' heure'), selected: +v.delai_heures === h }) }))
      var texte = e('textarea', { rows: 3, maxlength: 600, placeholder: 'Bonjour, merci pour votre message : nous l’avons bien reçu. Un membre de l’équipe vous répond dès que possible, au plus tard sous un jour ouvré.', 'aria-label': 'Texte du message automatique' }); texte.value = v.message || ''
      zone.appendChild(e('h2', { text: 'Réponse automatique aux messages', style: 'margin-top:0' }))
      zone.appendChild(e('p', { class: 'mut', text: 'Quand un client écrit (messagerie du projet ou demande) et que personne de l’équipe n’a lu ni répondu après le délai choisi, Jarvis lui envoie un accusé de réception court, signé « Réponse automatique de Jarvis ». Jamais de réponse sur le fond : aucun prix, délai ni engagement. Seulement du lundi au vendredi, de 8 h à 19 h (heure de Paris), au plus une fois par conversation et par 24 h ; rien si l’équipe a déjà lu ou répondu. Le message du client reste « non lu » pour l’équipe.' }))
      zone.appendChild(e('p', {}, [e('span', { class: 'badge ' + (etat.programmee ? 'b-r-super_admin' : 'b-r-chef_projet'), text: etat.programmee ? 'Tâche planifiée : active' : 'Tâche planifiée : non programmée' })]))
      if (!etat.programmee) zone.appendChild(e('p', { class: 'mut petit', text: 'Pour que les messages partent, activez l’extension pg_cron dans Supabase (Database > Extensions), puis ré-exécutez supabase/jarvis_plus.sql.' }))
      var ligne = e('label', { style: 'display:flex!important;flex-direction:row!important;gap:10px;align-items:center;justify-content:flex-start;margin:10px 0;text-align:left' }); ligne.appendChild(actif); ligne.appendChild(document.createTextNode('Activer la réponse automatique'))
      zone.appendChild(ligne)
      zone.appendChild(e('div', { class: 'bar' }, [K().field('Délai avant l’accusé', delai), K().field('Message (facultatif)', texte),
        e('button', { class: 'btn', type: 'button', text: 'Enregistrer', onclick: function () {
          S.sb.upsert('jarvis_reglages?on_conflict=cle', [{ cle: 'reponse_auto', valeur: { actif: actif.checked, delai_heures: +delai.value, message: texte.value.trim().slice(0, 600) } }])
            .then(function () { msg.textContent = actif.checked ? 'Enregistré : la réponse automatique est activée.' : 'Enregistré : la réponse automatique est désactivée.' }).catch(function () { msg.textContent = 'Enregistrement impossible : le script supabase/jarvis_plus.sql est-il exécuté ?' })
        } })]))
      zone.appendChild(msg)
    }).catch(function () { zone.appendChild(e('p', { class: 'mut', text: 'Réponse automatique indisponible : exécutez supabase/jarvis_plus.sql dans Supabase.' })) })
  }
  window.AdminModules = window.AdminModules || {}
  window.AdminModules.iaAuto = iaAuto
  window.AdminModules.iaCles = iaCles
})()
