/* Administration : page « Assistant IA » (Jarvis) : consommation de jetons, plafonds, journal de ce que Jarvis a lu ou fait, clés d'API, réponse automatique,
   mémoire, conversations et rapports. Chacun voit sa propre consommation ; la direction voit celle de toute l'agence, règle les plafonds et lit le journal ;
   le super administrateur gère les clés. Les droits réels sont appliqués par la base ; ici on ne fait qu'afficher. Tout texte passe par textContent. */
(function () {
  var K = function () { return window.AdminKit }
  var n0 = function (n) { return Math.round(+n || 0).toLocaleString('fr-FR') }
  var dt = function (iso) { var d = new Date(iso); return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  var DIRECTION = ['super_admin', 'admin']
  var enc = encodeURIComponent
  var libelleJour = function (iso) { return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }) }

  function ia() {
    var kit = K(), e = kit.el, main = kit.main, S = kit.S, UI = window.UI, role = kit.role ? kit.role() : 'collaborateur'
    var direction = DIRECTION.indexOf(role) >= 0, superAdmin = role === 'super_admin'
    main.appendChild(e('h1', { text: 'Assistant IA' }))
    main.appendChild(e('p', { class: 'lead', text: 'Jarvis, l’assistant de Creatigo : sa consommation de jetons, ses plafonds, ce qu’il a lu ou fait, et ses réglages.' }))
    if (!(S.sb && S.sb.on())) { main.appendChild(e('p', { class: 'mut', text: 'Disponible quand l’administration est connectée à la base de l’agence.' })); return }
    var kpis = e('div', { class: 'grille kpi coque-kpi' }), zone = e('div', { class: 'iap' }), msg = e('p', { class: 'msg', role: 'status' })
    main.appendChild(kpis); main.appendChild(zone)
    var panneau = function (titre, aide) { var p = e('section', { class: 'panel' }, [e('h2', { text: titre, style: 'margin-top:0' })].concat(aide ? [e('p', { class: 'mut', text: aide })] : [])); zone.appendChild(p); return p }
    var sur = function (p, v) { return p.catch(function () { return v }) }

    Promise.all([sur(S.sb.post('rpc/jarvis_usage_etat', {}), null), sur(S.sb.post('rpc/jarvis_requetes_jour', {}), 0), direction ? sur(S.sb.post('rpc/jarvis_usage_equipe', { p_jours: 30 }), []) : Promise.resolve([]),
      direction ? sur(S.sb.get('jarvis_journal?select=created_at,role_utilisateur,espace,outil,risque,statut,resultat&order=created_at.desc&limit=80'), []) : Promise.resolve([]),
      superAdmin ? sur(S.sb.get('jarvis_cles?select=id,actif'), []) : Promise.resolve([]), direction ? sur(S.sb.get('jarvis_reglages?cle=eq.jetons&select=valeur'), []) : Promise.resolve([])
    ]).then(function (r) {
      var etat = r[0], questions = +r[1] || 0, equipe = r[2] || [], journal = r[3] || [], cles = r[4] || [], reglages = r[5] || []
      /* ---- indicateurs ---- */
      if (UI && UI.tuile) {
        var T = UI.tuile, P = UI.G && UI.G.progression
        var tuiles = []
        if (etat && etat.jour) {
          var j = etat.jour, s = etat.semaine
          tuiles.push(T('Jetons aujourd’hui', n0(j.utilises), 'sur ' + n0(j.limite) + ' · ' + (etat.estimation ? 'estimation' : 'comptés par l’API'), etat.epuise, { icone: 'sparkles', visuel: P ? P([{ valeur: Math.min(j.utilises, j.limite), couleur: 'var(--serie-1)', libelle: 'Utilisés' }, { valeur: j.reste, couleur: 'var(--trait)', libelle: 'Restants' }]) : undefined }))
          tuiles.push(T('Jetons sur 7 jours', n0(s.utilises), 'sur ' + n0(s.limite), s.utilises >= s.limite, { icone: 'gauge', visuel: P ? P([{ valeur: Math.min(s.utilises, s.limite), couleur: 'var(--serie-2)', libelle: 'Utilisés' }, { valeur: s.reste, couleur: 'var(--trait)', libelle: 'Restants' }]) : undefined }))
        } else tuiles.push(T('Jetons', '—', 'le suivi demande supabase/jarvis_plus.sql', false, { icone: 'sparkles' }))
        tuiles.push(T('Mes questions aujourd’hui', n0(questions), 'à Jarvis', false, { icone: 'message-circle' }))
        if (direction) {
          var ag = etat && etat.agence
          tuiles.push(T('Toute l’agence aujourd’hui', ag ? n0(ag.utilises) : '—', ag ? 'sur ' + n0(ag.limite) + ' jetons' : '', ag ? ag.utilises >= ag.limite : false, { icone: 'users' }))
        }
        if (superAdmin) tuiles.push(T('Clés actives', n0(cles.filter(function (c) { return c.actif }).length), cles.length ? 'sur ' + n0(cles.length) : 'aucune clé : ajoutez-en une', !cles.length, { icone: 'key-round' }))
        tuiles.forEach(function (t) { kpis.appendChild(t) })
      }
      /* ---- consommation sur 7 jours ---- */
      var pc = panneau('Ma consommation de jetons', 'Les jetons sont les morceaux de texte envoyés à l’IA (entrée) et reçus d’elle (sortie). Le compte vient de l’API, en direct. Les plafonds se renouvellent à minuit (heure de Paris).')
      if (etat && etat.par_jour) {
        var max = Math.max.apply(null, etat.par_jour.map(function (x) { return x.entree + x.sortie }).concat([1]))
        pc.appendChild(e('div', { class: 'iap-barres', role: 'img', 'aria-label': 'Jetons par jour sur 7 jours' }, etat.par_jour.map(function (x) {
          var t = x.entree + x.sortie
          return e('div', { class: 'iap-col', title: libelleJour(x.jour) + ' : ' + n0(t) + ' jetons (' + n0(x.entree) + ' en entrée, ' + n0(x.sortie) + ' en sortie), ' + n0(x.appels) + ' appel(s)' }, [
            e('span', { class: 'iap-val', text: t ? n0(t) : '' }), e('div', { class: 'iap-pile', style: 'height:' + Math.max(t ? 4 : 0, Math.round(100 * t / max)) + 'px' }, [e('i', { class: 'sortie', style: 'flex:' + x.sortie }), e('i', { class: 'entree', style: 'flex:' + x.entree })]), e('span', { class: 'iap-jour', text: libelleJour(x.jour) })])
        })))
        pc.appendChild(e('p', { class: 'mut petit' }, [e('span', { class: 'iap-leg entree' }), document.createTextNode(' Entrée   '), e('span', { class: 'iap-leg sortie' }), document.createTextNode(' Sortie · ' + (etat.epuise ? 'Plafond atteint : Jarvis est en pause ' + (etat.epuise_quoi === 'jour' ? 'jusqu’à demain' : etat.epuise_quoi === 'agence' ? 'jusqu’à demain (budget de l’agence)' : 'jusqu’à libération du budget') + '.' : 'Tout fonctionne normalement.'))]))
      } else pc.appendChild(e('p', { class: 'mut', text: 'Le suivi des jetons n’est pas encore actif : exécutez supabase/jarvis_plus.sql dans Supabase.' }))

      if (direction) {
        /* ---- consommation de l'agence ---- */
        var pe = panneau('Consommation de l’agence (30 jours)', 'Par personne : l’équipe par adresse e-mail, les clients par leur nom. Réservé à la direction.')
        var agr = {}; equipe.forEach(function (x) { var k = x.espace + '|' + x.qui; var a = agr[k] = agr[k] || { qui: x.qui, espace: x.espace, e: 0, s: 0, a: 0 }; a.e += +x.tokens_entree; a.s += +x.tokens_sortie; a.a += +x.appels })
        var lignes = Object.keys(agr).map(function (k) { return agr[k] }).sort(function (a, b) { return (b.e + b.s) - (a.e + a.s) })
        if (!lignes.length) pe.appendChild(e('p', { class: 'mut', text: 'Aucune consommation enregistrée sur la période.' }))
        else pe.appendChild(e('div', { class: 'tw' }, [e('table', {}, [e('thead', {}, [e('tr', {}, ['Personne', 'Espace', 'Appels', 'Entrée', 'Sortie', 'Total'].map(function (h) { return e('th', { text: h }) }))]),
          e('tbody', {}, lignes.slice(0, 30).map(function (l) { return e('tr', {}, [e('td', { text: l.qui || '—' }), e('td', {}, [e('span', { class: 'badge', text: l.espace === 'client' ? 'Client' : 'Équipe' })]), e('td', { text: n0(l.a) }), e('td', { text: n0(l.e) }), e('td', { text: n0(l.s) }), e('td', { text: n0(l.e + l.s), style: 'font-weight:650' })]) }))])]))

        /* ---- plafonds ---- */
        var v = (reglages[0] && reglages[0].valeur) || { jour: 200000, semaine: 800000, client_jour: 60000, client_semaine: 200000, agence_jour: 3000000 }
        var pp = panneau('Plafonds de jetons', 'Quand un plafond est atteint, Jarvis répond par un message clair et reprend après la remise à zéro. Ils protègent votre facture d’IA. Un plafond par jour et sur 7 jours glissants pour chaque personne, et un plafond global par jour pour l’agence.')
        pp.setAttribute('data-jv-interdit', '')
        var champ = function (cle, lab, def) { var i = e('input', { type: 'number', min: 1000, max: 100000000, step: 1000, value: String(v[cle] || def), 'aria-label': lab }); return [cle, K().field(lab, i), i] }
        var cs = [champ('jour', 'Équipe : par jour', 200000), champ('semaine', 'Équipe : sur 7 jours', 800000), champ('client_jour', 'Client : par jour', 60000), champ('client_semaine', 'Client : sur 7 jours', 200000), champ('agence_jour', 'Agence : par jour', 3000000)]
        var msgP = e('p', { class: 'msg', role: 'status' })
        pp.appendChild(e('div', { class: 'bar' }, cs.map(function (c) { return c[1] }).concat([e('button', { class: 'btn', type: 'button', text: 'Enregistrer les plafonds', onclick: function () {
          var val = {}; cs.forEach(function (c) { val[c[0]] = Math.min(Math.max(parseInt(c[2].value, 10) || 0, 1000), 100000000) })
          S.sb.upsert('jarvis_reglages?on_conflict=cle', [{ cle: 'jetons', valeur: val }]).then(function () { msgP.textContent = 'Plafonds enregistrés.' }).catch(function () { msgP.textContent = 'Enregistrement impossible : supabase/jarvis_plus.sql est-il exécuté ?' })
        } })])))
        pp.appendChild(msgP)

        /* ---- rapports ---- */
        var pr = panneau('Rapports d’activité', 'Un rapport imprimable aux couleurs de Creatigo : chiffres de la période, impayés, projets à risque, devis à relancer. Imprimez-le ou enregistrez-le en PDF.')
        pr.appendChild(e('div', { class: 'bar' }, [['semaine', 'Cette semaine'], ['mois', 'Ce mois'], ['trimestre', 'Ce trimestre'], ['annee', 'Cette année']].map(function (p) { return e('button', { class: 'btn', type: 'button', text: p[1], onclick: function () { if (window.RapportJarvis) window.RapportJarvis.ouvrir(p[0]) } }) })))

        /* ---- journal ---- */
        var pj = panneau('Journal de Jarvis', 'Chaque outil utilisé par Jarvis pour l’équipe : lecture, action ou refus. Les actions qui modifient des données ont toujours été confirmées par la personne.')
        var filtre = e('select', { 'aria-label': 'Filtrer le journal' }, [['tous', 'Tout'], ['ecriture', 'Actions qui modifient'], ['sensible', 'Actions sensibles'], ['refuse', 'Refus']].map(function (o) { return e('option', { value: o[0], text: o[1] }) }))
        var corps = e('div')
        var RISQUE = { lecture: 'Lecture', ecriture: 'Modification', sensible: 'Sensible' }, STATUT = { ok: 'Fait', refuse: 'Refusé', erreur: 'Erreur' }
        var dessiner = function () {
          corps.textContent = ''
          var l = journal.filter(function (x) { return filtre.value === 'tous' || (filtre.value === 'refuse' ? x.statut === 'refuse' : x.risque === filtre.value) })
          if (!l.length) { corps.appendChild(e('p', { class: 'mut', text: journal.length ? 'Rien pour ce filtre.' : 'Rien pour l’instant.' })); return }
          corps.appendChild(e('div', { class: 'tw' }, [e('table', {}, [e('thead', {}, [e('tr', {}, ['Quand', 'Rôle', 'Outil', 'Type', 'Résultat', 'Détail'].map(function (h) { return e('th', { text: h }) }))]),
            e('tbody', {}, l.map(function (x) { return e('tr', {}, [e('td', { text: dt(x.created_at) }), e('td', { text: x.role_utilisateur || '' }), e('td', { text: x.outil }), e('td', {}, [e('span', { class: 'badge', text: RISQUE[x.risque] || x.risque })]), e('td', { text: STATUT[x.statut] || x.statut }), e('td', { class: 'mut', text: x.resultat || '' })]) }))])]))
        }
        filtre.addEventListener('change', dessiner); pj.appendChild(e('div', { class: 'bar' }, [K().field('Afficher', filtre)])); pj.appendChild(corps); dessiner()
      }

      /* ---- clés et réponse automatique ---- */
      var M = window.AdminModules || {}
      if (superAdmin && M.iaCles) M.iaCles(zone)
      if (direction && M.iaAuto) M.iaAuto(zone)

      /* ---- ma mémoire ---- */
      var pm = panneau('Ce que Jarvis retient pour moi', 'Seul(e) vous le voyez, même la direction ne le lit pas. Dites « retiens que… » à Jarvis pour en ajouter ; vous confirmez à chaque fois.')
      var liste = e('div'); pm.appendChild(liste)
      var chargerMem = function () {
        S.sb.get('jarvis_memoire?select=id,contenu,categorie&order=created_at.desc&limit=40').then(function (l) {
          liste.textContent = ''
          if (!l.length) { liste.appendChild(e('p', { class: 'mut', text: 'Rien pour le moment.' })); return }
          liste.appendChild(e('ul', { class: 'liste' }, l.map(function (m) { return e('li', {}, [e('span', { class: 'badge', text: m.categorie === 'contexte' ? 'Contexte' : 'Préférence' }), ' ', e('span', { text: m.contenu + ' ' }), e('button', { class: 'lnk danger', type: 'button', text: 'Oublier', onclick: function () { S.sb.del('jarvis_memoire?id=eq.' + enc(m.id)).then(chargerMem) } })]) })))
        }).catch(function () { liste.textContent = ''; liste.appendChild(e('p', { class: 'mut', text: 'La mémoire demande supabase/jarvis_plus.sql.' })) })
      }
      chargerMem()

      /* ---- mes conversations ---- */
      var pv = panneau('Mes conversations avec Jarvis', 'Privées : personne d’autre ne les lit. Ouvrez-en une pour la reprendre.')
      S.sb.get('jarvis_conversations?select=id,titre,updated_at&espace=eq.admin&archivee=eq.false&order=updated_at.desc&limit=10').then(function (l) {
        if (!l.length) { pv.appendChild(e('p', { class: 'mut', text: 'Aucune conversation enregistrée.' })); return }
        pv.appendChild(e('ul', { class: 'liste' }, l.map(function (c) { return e('li', {}, [e('strong', { text: c.titre }), e('span', { class: 'mut', text: ' · ' + dt(c.updated_at) + ' ' }), e('button', { class: 'lnk', type: 'button', text: 'Reprendre', onclick: function () { if (window.Jarvis && window.Jarvis.reprendre) window.Jarvis.reprendre(c) } })]) })))
      }).catch(function () { pv.appendChild(e('p', { class: 'mut', text: 'L’historique demande supabase/jarvis.sql.' })) })
      pv.appendChild(e('div', { class: 'bar' }, [e('button', { class: 'btn', type: 'button', text: 'Ouvrir Jarvis', onclick: function () { if (window.Jarvis) window.Jarvis.ouvrir() } })]))
    })
  }
  window.AdminModules = window.AdminModules || {}
  window.AdminModules.ia = ia
})()
