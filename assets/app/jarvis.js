/* Jarvis : l'assistant IA de l'espace admin (bouton flottant + panneau de discussion).
   Il appelle la fonction Netlify /api/agent avec le jeton de connexion de la personne ; la fonction vérifie que c'est un
   membre de l'équipe, lit la base selon ses droits (outils en lecture seule) et demande la réponse à Claude, reçue en continu. Aucune clé n'est dans ce fichier.
   Tout texte affiché passe par textContent : la réponse du modèle est rendue sans jamais être injectée comme du HTML. */
(function () {
  // adresse des fonctions de Jarvis : window.CREATIGO_SB.api (ex. fonction Supabase) ou, à défaut, /api (Netlify)
  function apiJarvis(n) { var b = window.CREATIGO_SB && window.CREATIGO_SB.api; return (b ? String(b).replace(/\/$/, '') : '/api') + '/' + n }
  var UI = window.UI, S = window.CreatigoStore
  if (!UI || !S) return
  var h = UI.h, ic = UI.icone
  // logo de Jarvis (assets/jarvis/*.svg) : symbole, symbole-blanc ou icone
  function marque(nom, t) { return h('img', { src: '../assets/jarvis/jarvis-' + nom + '.svg', alt: '', width: String(t), height: String(t), draggable: 'false' }) }
  // la même enveloppe sert l'admin (équipe) et l'espace client ; le serveur, lui, ne croit que le profil lu en base
  var CLIENT = !!(document.body && document.body.classList.contains('espcl')), ESP = CLIENT ? 'client' : 'admin'
  var K = 'creatigo.jarvis' + (CLIENT ? '.client' : ''), KCONV = K + '.conv', ENDPOINT = apiJarvis('agent')
  var SUGGESTIONS = CLIENT ? [
    ['Où en est mon projet ?', 'Où en est mon projet ? Explique-moi l’étape en cours et la suivante.'],
    ['Que dois-je faire ?', 'Qu’est-ce que vous attendez de moi en ce moment pour que le projet avance ?'],
    ['Mes factures', 'Où en sont mes factures et mes devis ? Y a-t-il quelque chose à régler ?'],
    ['Écrire à l’équipe', 'Je voudrais écrire un message à l’équipe : aide-moi à le rédiger.'],
  ] : [
    ['Que dois-je traiter aujourd’hui ?', 'Que dois-je traiter aujourd’hui ? Regarde les relances dues, les factures en retard, les devis à relancer et les rendez-vous du jour.'],
    ['Factures en retard', 'Quelles factures sont en retard et pour quel montant ?'],
    ['Chiffre d’affaires du mois', 'Où en est le chiffre d’affaires facturé ce mois-ci, et ce qui reste à encaisser ?'],
    ['Où en sont les projets ?', 'Fais le point sur les projets : étape, tâches restantes et ceux qui sont en retard.'],
  ]
  // suggestions adaptées à la page ouverte (route = premier segment du hash de l'admin)
  var PAR_PAGE = CLIENT ? {} : {
    projets: [['Ce projet est-il à risque ?', 'Ce projet est-il à risque ? Détaille les retards et les tâches bloquées.'], ['Que reste-t-il à faire ?', 'Que reste-t-il à faire sur ce projet, et dans quel ordre ?']],
    clients: [['Dicter une note', '@dicter'], ['Clients sans nouvelles', 'Quels clients n’ont pas eu de nouvelles depuis plus de 30 jours ?'], ['Fiche de ce client', 'Fais-moi la fiche de ce client : projets, devis, factures, derniers échanges.']],
    devis: [['Devis à relancer', 'Quels devis envoyés sont à relancer, et depuis combien de temps ?'], ['Rédige une relance', 'Rédige une relance courte et cordiale pour le devis le plus ancien sans réponse (sans l’envoyer).']],
    factures: [['Impayés par ancienneté', 'Quelles factures sont impayées, classées par ancienneté du retard ?'], ['Rédige une relance', 'Rédige une relance pour la facture la plus en retard (sans l’envoyer).']],
    finances: [['Bilan du mois', 'Fais le bilan du mois : facturé, encaissé, reste à encaisser, comparé au mois précédent.'], ['Impayés', 'Quels sont les impayés et leur ancienneté ?']],
    cockpit: [['Points d’attention', 'Quels sont les points d’attention de l’agence cette semaine ?']],
    dashboard: [['Bilan de la semaine', 'Fais le bilan de la semaine : activité, chiffres, points d’attention.']],
  }
  function pageCourante() {
    var seg = (location.hash || '#dashboard').slice(1).split('?')[0].split('/')
    var route = /^[a-z0-9_-]{1,30}$/i.test(seg[0] || '') ? seg[0].toLowerCase() : ''
    var id = seg[1] && /^[A-Za-z0-9_.-]{1,64}$/.test(seg[1]) ? seg[1] : ''
    return route ? (id ? { route: route, id: id } : { route: route }) : {}
  }
  // dictée d'une note : on parle, Jarvis retrouve la fiche et propose l'ajout sur une carte (rien n'est enregistré sans confirmation)
  function dicter() { if (panneau.hidden) ouvrir(); if (!SR) return erreur('La dictée vocale n’est pas disponible dans ce navigateur : utilisez Chrome, Edge ou Safari.'); questionVocale = true; silences = 0; ecouter() }
  var PILOTE_SUGG = [['Montre-moi à l’écran', 'Ouvre la page Clients et montre-moi à l’écran les clients à relancer.']]
  function suggestions() { return (PAR_PAGE[pageCourante().route] || []).concat(pilotageDispo() ? PILOTE_SUGG : [], SUGGESTIONS).slice(0, 5) }
  var NOTE_BASE = CLIENT ? 'Jarvis peut se tromper : en cas de doute, écrivez à l’équipe.' : 'Jarvis peut se tromper : vérifiez les chiffres importants dans l’admin.'
  var convId = null, persistance = false, quota = null, brief = null, cmd = null
  /* ---------- briefing du jour : ce qui demande l'attention, calculé par /api/jarvis-briefing (sans IA) ---------- */
  function chargerBriefing() {
    if (CLIENT || !S.auth.session()) return
    S.auth.token().then(function (jeton) { return fetch(apiJarvis('jarvis-briefing'), { headers: { Authorization: 'Bearer ' + jeton } }) })
      .then(function (r) { return r.ok ? r.json() : null }).then(function (j) {
        if (!j) return
        brief = j; majPastille()
        if (!historique.length && !occupe && journal) redessiner()
      }).catch(function () {})
  }
  function majPastille() { if (!pastille) return; var n = brief ? brief.a_traiter : 0; pastille.textContent = n > 9 ? '9+' : String(n); pastille.hidden = !n || (panneau && !panneau.hidden); if (n) bouton.setAttribute('aria-label', 'Ouvrir Jarvis, l’assistant IA (' + n + ' point' + (n > 1 ? 's' : '') + ' à traiter)') }
  function jourLong() { return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) }
  function ecouterBriefing() {
    if (!synth || !brief) return
    var t = brief.elements.length ? 'Bonjour. Voici votre briefing : ' + brief.elements.slice(0, 5).map(function (e) { return e.titre + (e.detail ? ', ' + e.detail : '') }).join('. ') + '.' : 'Bonjour. Rien d’urgent aujourd’hui.'
    parler(t.replace(/€/g, ' euros'))
  }
  function carteBriefing() {
    if (!brief) return null
    var l = brief.elements.slice(0, 6)
    return h('section', { class: 'jv-brief', 'aria-label': 'Briefing du jour' },
      h('header', {}, h('b', {}, 'Briefing · ' + jourLong()), synth ? h('button', { type: 'button', class: 'jv-icone', title: 'Écouter le briefing', 'aria-label': 'Écouter le briefing', onclick: ecouterBriefing }, ic('volume-2', 14)) : null),
      brief.peut_rapport && window.RapportJarvis ? h('p', { class: 'jv-brief-rapport' }, h('button', { type: 'button', onclick: function () { fermer(); window.RapportJarvis.ouvrir('semaine') } }, ic('printer', 13), 'Rapport de la semaine'), h('button', { type: 'button', onclick: function () { fermer(); window.RapportJarvis.ouvrir('mois') } }, ic('printer', 13), 'du mois')) : null,
      l.length ? h('ul', {}, l.map(function (e) {
        return h('li', { class: e.gravite }, h('span', { class: 'jv-brief-ic', 'aria-hidden': 'true' }, ic(e.icone || 'bell', 15)),
          h('div', { class: 'jv-brief-txt' }, h('b', {}, e.titre), e.detail ? h('small', {}, e.detail) : null),
          h('div', { class: 'jv-brief-act' }, h('button', { type: 'button', onclick: function () { demander(e.question) } }, 'Traiter'), h('a', { href: e.lien, onclick: function () { fermer() } }, 'Voir')))
      })) : h('p', { class: 'jv-aide' }, 'Rien d’urgent aujourd’hui : relances, projets, devis et messages sont à jour.'))
  }
  /* ---------- commande Ctrl+K : poser une question ou lancer une suggestion sans ouvrir le panneau ---------- */
  function fermerCommande() { if (cmd) { cmd.remove(); cmd = null } }
  function ouvrirCommande() {
    if (cmd) return fermerCommande()
    if (bouton.hidden || (window.PiloteJarvis && window.PiloteJarvis.actif())) return
    var champC = h('input', { class: 'jv-cmd-champ', type: 'text', placeholder: 'Demandez quelque chose à Jarvis…', 'aria-label': 'Demander à Jarvis', maxlength: '500', autocomplete: 'off', spellcheck: 'false' })
    var liste = h('ul', { class: 'jv-cmd-liste', role: 'listbox', 'aria-label': 'Suggestions' }), choix = [], actif = 0
    function lancer(q) { fermerCommande(); if (q.indexOf('@rapport:') === 0) return window.RapportJarvis.ouvrir(q.slice(9)); if (q === '@dicter') return dicter(); if (panneau.hidden) ouvrir(); demander(q) }
    function dessiner() {
      var t = champC.value.trim(), items = []
      if (t) items.push([t, 'Demander à Jarvis : « ' + t + ' »'])
      if (brief && brief.peut_rapport && window.RapportJarvis) { items.push(['@rapport:semaine', 'Ouvrir le rapport de la semaine (PDF)']); items.push(['@rapport:mois', 'Ouvrir le rapport du mois (PDF)']) }
      suggestions().forEach(function (s) { items.push([s[1], s[0]]) })
      if (brief) brief.elements.filter(function (e) { return e.gravite !== 'info' }).slice(0, 3).forEach(function (e) { items.push([e.question, e.titre]) })
      choix = items.slice(0, 8); actif = Math.min(actif, choix.length - 1)
      liste.replaceChildren.apply(liste, choix.map(function (c, i) { return h('li', { role: 'option', 'aria-selected': String(i === actif), class: i === actif ? 'actif' : '', onclick: function () { lancer(c[0]) } }, ic('sparkles', 14), h('span', {}, c[1])) }))
    }
    champC.addEventListener('input', function () { actif = 0; dessiner() })
    champC.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); fermerCommande() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); actif = (actif + 1) % Math.max(1, choix.length); dessiner() }
      else if (e.key === 'ArrowUp') { e.preventDefault(); actif = (actif + choix.length - 1) % Math.max(1, choix.length); dessiner() }
      else if (e.key === 'Enter' && !e.isComposing && choix[actif]) { e.preventDefault(); lancer(choix[actif][0]) }
    })
    cmd = h('div', { class: 'jv-cmd', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Commande Jarvis', onmousedown: function (e) { if (e.target === cmd) fermerCommande() } },
      h('div', { class: 'jv-cmd-boite' }, h('div', { class: 'jv-cmd-tete' }, marque('icone', 26), champC, h('kbd', {}, 'Échap')), liste))
    document.body.append(cmd); dessiner(); champC.focus()
  }
  document.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && String(e.key).toLowerCase() === 'k') { if (!bouton || bouton.hidden) return; e.preventDefault(); ouvrirCommande() } })
  try { convId = sessionStorage.getItem(KCONV) || null } catch (e) {}
  function retenirConv(id) { convId = id || null; try { if (id) sessionStorage.setItem(KCONV, id); else sessionStorage.removeItem(KCONV) } catch (e) {} }
  var historique = lire(), occupe = false, panneau, bouton, journal, champ, envoyer, pastille, micro, btnLire, btnConv
  var note, btnLarge, btnHisto, btnPilote, sousTitre, sceneOn = false, lireAvant = false, scene, orbe, scStatut, scLegende, scMicro, legende = ''

  /* ---------- voix : reconnaissance et synthèse vocales du navigateur (aucune clé, aucun coût) ----------
     Micro : Chrome, Edge, Safari. La dictée est traitée par le service vocal du navigateur (Google pour Chrome, Apple pour
     Safari) : seul le son de la question y passe, jamais les données de l'agence. Voix : celles installées sur l'appareil. */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, synth = window.speechSynthesis
  var KV = 'creatigo.jarvis.voix', prefs = { lire: false, conv: false, pilote: true }
  try { var pv = JSON.parse(localStorage.getItem(KV)); if (pv) { prefs.lire = !!pv.lire; prefs.conv = !!pv.conv; if (pv.pilote === false) prefs.pilote = false } } catch (e) {}
  function ecrirePrefs() { try { localStorage.setItem(KV, JSON.stringify(prefs)) } catch (e) {} }
  var reco = null, enEcoute = false, parle = false, silences = 0, questionVocale = false, voixFr = null

  function choisirVoix() {
    if (!synth) return
    var l = synth.getVoices().filter(function (v) { return /^fr(-|_|$)/i.test(v.lang) })
    var prefere = /natural|neural|google|siri|amélie|thomas|henri|denise|audrey/i
    voixFr = l.filter(function (v) { return prefere.test(v.name) && /fr[-_]FR/i.test(v.lang) })[0] || l.filter(function (v) { return /fr[-_]FR/i.test(v.lang) })[0] || l[0] || null
  }
  if (synth) { choisirVoix(); if (synth.addEventListener) synth.addEventListener('voiceschanged', choisirVoix) }

  // texte lu à voix haute : sans mise en forme, montants et sigles prononçables
  function pourLaVoix(t) {
    return String(t).replace(/[\u00a0\u202f]/g, ' ').replace(/\*\*/g, '').replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
      .replace(/https?:\/\/\S+/g, 'ce lien').replace(/(\d)\s*€/g, '$1 euros').replace(/\bHT\b/g, 'hors taxes').replace(/\bTTC\b/g, 'toutes taxes comprises')
      .replace(/\b(?:factures?\s+)?FAC-(\d{4})-0*(\d+)/gi, 'facture $2 de $1').replace(/\b(?:devis\s+)?DEV-(\d{4})-0*(\d+)/gi, 'devis $2 de $1')
      .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '').replace(/\s*\n+\s*/g, '. ').replace(/\.\s*\./g, '.').trim()
  }
  function decouper(t) {   // morceaux courts : les voix de Chrome se coupent sur les textes longs
    var phrases = t.match(/[^.!?;:]+[.!?;:]?/g) || [t], morceaux = [], cur = ''
    phrases.forEach(function (x) { if ((cur + x).length > 200 && cur) { morceaux.push(cur); cur = x } else cur += x })
    if (cur.trim()) morceaux.push(cur)
    return morceaux
  }
  function arreterParole() { parle = false; if (synth) synth.cancel(); majVoix() }
  function parler(texte, fin) {
    if (!synth || !texte) { if (fin) fin(); return }
    synth.cancel()
    var morceaux = decouper(pourLaVoix(texte)); if (!morceaux.length) { if (fin) fin(); return }
    parle = true; majVoix()
    morceaux.forEach(function (m, i) {
      var u = new SpeechSynthesisUtterance(m.trim()); u.lang = 'fr-FR'; if (voixFr) u.voice = voixFr; u.rate = 1.03
      u.onboundary = function () { if (orbe) orbe.pulse(0.5 + Math.random() * 0.5) }   // l'orbe bat à chaque mot lu
      if (i === morceaux.length - 1) { u.onend = u.onerror = function () { if (!parle) return; parle = false; majVoix(); if (fin) fin() } }
      synth.speak(u)
    })
  }
  function arreterEcoute() { if (reco) { try { reco.abort() } catch (e) {} } enEcoute = false; majVoix() }
  function arreterTout() { prefs.conv && majConv(false); arreterEcoute(); arreterParole() }
  function ecouter() {
    if (!SR || occupe || enEcoute) return
    arreterParole()
    reco = new SR(); reco.lang = 'fr-FR'; reco.interimResults = true; reco.continuous = false; reco.maxAlternatives = 1
    var final = '', fini = false
    reco.onstart = function () { enEcoute = true; champ.placeholder = 'Je vous écoute…'; majVoix() }
    reco.onresult = function (e) {
      var interim = ''
      for (var i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) final += e.results[i][0].transcript; else interim += e.results[i][0].transcript }
      champ.value = (final + interim).trim(); ajuster()
      legende = champ.value; if (orbe) orbe.pulse(0.45 + Math.random() * 0.45); majScene()   // l'orbe réagit à chaque mise à jour de la dictée
    }
    reco.onerror = function (e) {
      fini = true; enEcoute = false
      if (e.error === 'no-speech') { silences++; if (prefs.conv && silences < 2) setTimeout(ecouter, 300); else { if (prefs.conv) majConv(false); } }
      else if (e.error === 'aborted') { /* arrêt voulu */ }
      else {
        majConv(false)
        erreur(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Le micro est bloqué : autorisez-le pour ce site dans la barre d’adresse du navigateur, puis réessayez.'
          : e.error === 'network' ? 'La dictée vocale du navigateur est injoignable. Vérifiez votre connexion ou écrivez votre question.' : e.error === 'audio-capture' ? 'Aucun micro détecté sur cet appareil.' : 'La dictée vocale a échoué. Réessayez ou écrivez votre question.')
      }
    }
    reco.onend = function () {
      enEcoute = false; champ.placeholder = CLIENT ? 'Posez une question sur votre projet…' : 'Posez une question sur l’agence…'; majVoix()
      var q = final.trim()
      if (q && !fini) { silences = 0; questionVocale = true; demander(q) } else if (!fini && prefs.conv && !q) { silences++; if (silences < 2) setTimeout(ecouter, 300); else majConv(false) }
    }
    try { reco.start() } catch (e) { enEcoute = false; majVoix() }
  }
  function majVoix() {
    if (!micro) return
    var etat = enEcoute ? 'ecoute' : parle ? 'parle' : 'repos'
    micro.className = 'jv-micro ' + etat
    micro.setAttribute('aria-pressed', String(enEcoute))
    micro.setAttribute('aria-label', enEcoute ? 'Arrêter l’écoute' : parle ? 'Faire taire Jarvis' : 'Parler à Jarvis')
    micro.title = micro.getAttribute('aria-label')
    micro.replaceChildren(ic(parle ? 'square' : 'mic', 17))
    if (panneau) panneau.classList.toggle('jv-vocal', enEcoute || parle)
    majScene()
  }
  /* ---------- mode vocal : l'orbe plein écran ---------- */
  var LIBELLES = { ecoute: 'Je vous écoute', reflexion: 'Je réfléchis…', parle: 'Je parle', repos: 'Touchez le micro pour parler' }
  function etatOrbe() { return enEcoute ? 'ecoute' : occupe ? 'reflexion' : parle ? 'parle' : 'repos' }
  function majScene() {
    if (!sceneOn || !scene) return
    var e = etatOrbe()
    orbe.definirEtat(e)
    scene.setAttribute('data-etat', e)
    scStatut.textContent = LIBELLES[e]
    scLegende.textContent = legende || (e === 'repos' ? 'Posez votre question à voix haute : je lis les clients, devis, factures et projets de l’agence.' : '')
    scMicro.replaceChildren(ic(e === 'parle' ? 'square' : 'mic', 24))
    scMicro.setAttribute('aria-label', e === 'ecoute' ? 'Arrêter l’écoute' : e === 'parle' ? 'Faire taire Jarvis' : 'Parler à Jarvis')
    scMicro.classList.toggle('actif', e === 'ecoute')
    if (btnConv) { btnConv.setAttribute('aria-pressed', String(sceneOn)) }
  }
  function entrerVoix() {
    if (!SR || !scene) return
    sceneOn = true; panneau.classList.add('jv-voix-on'); scene.hidden = false
    legende = ''; lireAvant = prefs.lire; majLire(true); prefs.conv = true; ecrirePrefs(); silences = 0
    orbe.demarrer(); majScene(); ecouter()
  }
  function sortirVoix() {
    if (!sceneOn) return
    sceneOn = false; panneau.classList.remove('jv-voix-on'); scene.hidden = true
    prefs.conv = false; ecrirePrefs(); arreterEcoute(); arreterParole(); orbe.arreter(); majLire(lireAvant)   // la lecture des réponses tapées revient à son réglage d'avant
    if (btnConv) btnConv.setAttribute('aria-pressed', 'false'); champ.value = ''; ajuster()
  }
  function construireScene() {
    var canvas = h('canvas', { class: 'jv-orbe', 'aria-hidden': 'true' })
    scStatut = h('div', { class: 'jv-sc-statut', role: 'status', 'aria-live': 'polite' })
    scLegende = h('p', { class: 'jv-sc-legende', 'aria-live': 'polite' })
    scMicro = h('button', { class: 'jv-sc-micro', type: 'button', onclick: function () {
      if (parle) return arreterParole()
      if (enEcoute) return arreterEcoute()
      if (occupe) return
      silences = 0; prefs.conv = true; legende = ''; ecouter()
    } }, ic('mic', 24))
    scene = h('div', { class: 'jv-scene', hidden: true, 'data-etat': 'repos' },
      h('div', { class: 'jv-sc-tete' },
        h('button', { class: 'jv-sc-retour', type: 'button', onclick: sortirVoix }, ic('chevron-left', 16), 'Retour au chat'),
        h('span', { class: 'jv-sc-nom' }, 'Jarvis')),
      h('div', { class: 'jv-sc-orbe' }, canvas),
      h('div', { class: 'jv-sc-texte' }, scStatut, scLegende),
      h('div', { class: 'jv-sc-actions' },
        scMicro,
        h('button', { class: 'jv-sc-fin', type: 'button', 'aria-label': 'Terminer la conversation vocale', title: 'Terminer', onclick: sortirVoix }, ic('x', 20))))
    orbe = window.OrbeJarvis.creer(canvas)
    if (window.ResizeObserver) new ResizeObserver(function () { if (sceneOn) orbe.redimensionner() }).observe(canvas)
    return scene
  }

  function majLire(v) { prefs.lire = v; ecrirePrefs(); if (btnLire) { btnLire.setAttribute('aria-pressed', String(v)); btnLire.title = v ? 'Lecture des réponses : activée' : 'Lecture des réponses : désactivée'; btnLire.setAttribute('aria-label', btnLire.title); btnLire.replaceChildren(ic(v ? 'volume-2' : 'volume-x', 16)) } if (!v) arreterParole() }
  function majConv(v) { prefs.conv = v; ecrirePrefs(); silences = 0; if (!v) arreterEcoute() }


  function lire() { try { var l = JSON.parse(sessionStorage.getItem(K)); return Array.isArray(l) ? l.slice(-24) : [] } catch (e) { return [] } }
  function ecrire() { try { sessionStorage.setItem(K, JSON.stringify(historique.slice(-24))) } catch (e) {} }

  // rendu minimal et sûr : paragraphes, listes à puces, **gras** ; jamais de HTML
  function enLigne(texte) {
    var f = document.createDocumentFragment(), re = /\*\*([^*]+)\*\*/g, i = 0, m
    while ((m = re.exec(texte))) { if (m.index > i) f.append(texte.slice(i, m.index)); f.append(h('strong', {}, m[1])); i = m.index + m[0].length }
    if (i < texte.length) f.append(texte.slice(i))
    return f
  }
  function cellules(l) { return l.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim() }) }
  function rendre(texte) {
    var sortie = [], liste = null, lignes = String(texte).split('\n')
    for (var i = 0; i < lignes.length; i++) {
      var ligne = lignes[i]
      // tableau Markdown : une ligne d'en-tête, une ligne de séparation (---), puis les lignes
      if (/^\s*\|.*\|\s*$/.test(ligne) && i + 1 < lignes.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lignes[i + 1])) {
        var tete = cellules(ligne), corps = []
        i += 2
        while (i < lignes.length && /^\s*\|.*\|\s*$/.test(lignes[i])) { corps.push(cellules(lignes[i])); i++ }
        i--
        liste = null
        sortie.push(h('div', { class: 'jv-table' }, h('table', {}, h('thead', {}, h('tr', {}, tete.map(function (c) { return h('th', {}, enLigne(c)) }))),
          h('tbody', {}, corps.map(function (r) { return h('tr', {}, tete.map(function (_, k) { return h('td', {}, enLigne(r[k] || '')) })) })))))
        continue
      }
      var puce = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(ligne)
      if (puce) { if (!liste) { liste = h('ul', {}); sortie.push(liste) } liste.append(h('li', {}, enLigne(puce[1]))); continue }
      liste = null
      if (ligne.trim()) sortie.push(h('p', {}, enLigne(ligne.trim())))
    }
    return sortie
  }

  function bulle(role, texte, extra) {
    var b = h('div', { class: 'jv-msg ' + role }, role === 'assistant' ? rendre(texte) : h('p', {}, texte), extra || null)
    journal.append(b); journal.scrollTop = journal.scrollHeight
    return b
  }
  function accueil() {
    journal.replaceChildren(h('div', { class: 'jv-accueil' },
      h('span', { class: 'jv-logo', 'aria-hidden': 'true' }, marque('icone', 44)),
      h('b', {}, 'Bonjour, je suis Jarvis.'),
      h('p', {}, CLIENT ? 'Je vous dis où en est votre projet, ce que nous attendons de vous, et je retrouve vos documents, devis et factures. Je peux aussi écrire à l’équipe pour vous : vous relisez avant l’envoi.' : 'J’analyse l’agence selon vos droits, je prépare des actions que vous confirmez sur une carte, et je travaille à l’écran devant vous.'),
      (SR || synth) ? h('p', { class: 'jv-aide' }, ic('mic', 13), SR ? 'Vous pouvez aussi me parler : cliquez sur le micro.' : 'Les réponses peuvent être lues à voix haute (haut-parleur).') : null,
      carteBriefing(),
      h('div', { class: 'jv-sugg' }, suggestions().map(function (s) { return h('button', { type: 'button', onclick: function () { s[1] === '@dicter' ? dicter() : demander(s[1]) } }, s[0]) }))))
  }
  function redessiner() {
    journal.replaceChildren()
    if (!historique.length) return accueil()
    historique.forEach(function (m) { bulle(m.role, m.content) })
  }

  function etat(texte) { var e = h('div', { class: 'jv-etat', role: 'status' }, h('span', { class: 'jv-points', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), texte); journal.append(e); journal.scrollTop = journal.scrollHeight; return e }
  function erreur(texte, rejouer) {
    if (sceneOn) { legende = texte; majScene() }
    var e = h('div', { class: 'jv-erreur', role: 'alert' }, h('span', {}, ic('triangle-alert', 15)), h('span', {}, texte),
      rejouer ? h('button', { type: 'button', class: 'jv-reessayer', onclick: function () { e.remove(); rejouer() } }, 'Réessayer') : null)
    journal.append(e); journal.scrollTop = journal.scrollHeight
  }

  function demander(texte) {
    texte = String(texte || '').trim()
    if (!texte || occupe) { questionVocale = false; return }
    if (!S.auth.session()) { ouvrir(); return erreur('Jarvis lit la base de l’agence : connectez-vous avec votre compte d’équipe pour l’utiliser.') }
    if (!historique.length) journal.replaceChildren()
    arreterParole()
    historique.push({ role: 'user', content: texte }); ecrire(); legende = texte
    bulle('user', texte); champ.value = ''; ajuster()
    envoyerHistorique()
  }
  var LIBELLE_OUTIL = { lister: 'listes', chiffres: 'chiffres', bilan_periode: 'bilan de période', projets_a_risque: 'analyse des projets', clients_sans_nouvelles: 'suivi clients', devis_a_relancer: 'devis à relancer', impayes: 'impayés', fiche_client: 'fiche client', fiche_projet: 'fiche projet', activite_recente: 'journal d’activité' }
  function sourcesDe(outils, pilote) {
    var noms = []; (outils || []).forEach(function (o) { var n = LIBELLE_OUTIL[o.outil || o]; if (n && noms.indexOf(n) < 0) noms.push(n) })
    if (pilote) noms.push('actions à l’écran (voir le journal)')
    return noms.length ? h('small', { class: 'jv-source' }, ic('database', 12), 'Données lues : ' + noms.join(', ')) : null
  }
  // lit le flux NDJSON ligne par ligne ; rappelle surEvenement pour chaque événement
  function lireFlux(reponse, surEvenement) {
    var lecteur = reponse.body.getReader(), dec = new TextDecoder(), reste = ''
    function suite() {
      return lecteur.read().then(function (x) {
        reste += dec.decode(x.value || new Uint8Array(), { stream: !x.done })
        var l = reste.split('\n'); reste = x.done ? '' : l.pop()
        l.forEach(function (t) { if (t.trim()) { try { surEvenement(JSON.parse(t)) } catch (e) { if (e && e.jarvis) throw e } } })
        if (!x.done) return suite()
        if (reste.trim()) { try { surEvenement(JSON.parse(reste)) } catch (e) { if (e && e.jarvis) throw e } }
      })
    }
    return suite()
  }
  function envoyerHistorique() {
    occupe = true; envoyer.disabled = true; panneau.setAttribute('aria-busy', 'true'); majScene()
    var attente = etat('Jarvis réfléchit…'), vivante = null, cumul = '', planifie = false, clos = false, pilotee = false
    var derniere = historique[historique.length - 1], avant = historique.slice(0, -1)
    function afficherVivante() {
      planifie = false
      if (clos) return
      if (!vivante) { attente.remove(); vivante = bulle('assistant', ''); vivante.classList.add('jv-flux') }
      vivante.replaceChildren.apply(vivante, rendre(cumul)); journal.scrollTop = journal.scrollHeight
    }
    // un aller-retour avec le serveur : se termine par la réponse finale ("fin") ou par une pause (actions à faire à l'écran)
    function tour(extra) {
      var fin = null, pause = null
      return S.auth.token().then(function (jeton) {
        return fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jeton },
          body: JSON.stringify(Object.assign({ message: derniere.content, conversationId: convId, page: pageCourante(), pilote: pilotageDispo(), actions: !!window.ActionsJarvis, historique: avant.slice(-12) }, extra || {})) })
      }).then(function (r) {
        if (!r.ok || !r.body) {
          return r.json().catch(function () { return {} }).then(function (j) { var e = new Error(j.erreur || 'Erreur ' + r.status); e.statut = r.status; e.code = j.code; throw e })
        }
        return lireFlux(r, function (ev) {
          if (ev.t === 'conv') { persistance = !!ev.persistance; if (ev.id) retenirConv(ev.id); majPersistance() }
          else if (ev.t === 'etat') { if (!vivante) attente.lastChild.textContent = ev.texte }
          else if (ev.t === 'texte') { cumul += ev.d; if (!planifie) { planifie = true; requestAnimationFrame(afficherVivante) } }
          else if (ev.t === 'pause') pause = ev
          else if (ev.t === 'fin') fin = ev
          else if (ev.t === 'erreur') { var e = new Error(ev.message); e.statut = 0; e.code = ev.code; e.jarvis = true; throw e }
        })
      }).then(function () { return { finale: fin, pause: pause } })
    }
    function boucle(extra) {
      return tour(extra).then(function (r) {
        if (!r.pause) return r.finale
        // Jarvis a décidé d'agir à l'écran : la discussion se range, la page prend le halo et le curseur de Jarvis
        pilotee = true; clos = true; if (vivante) { vivante.remove(); vivante = null } cumul = ''
        attente.remove(); attente = etat('Jarvis travaille sur l’écran…'); clos = false
        return executerAppels(r.pause.appels).then(function (resultats) {
          if (window.PiloteJarvis && window.PiloteJarvis.actif()) window.PiloteJarvis.etape('Jarvis réfléchit…')
          return boucle({ reprise: { messages: r.pause.messages, faits: r.pause.faits, pas: r.pause.pas, resultats: resultats } })
        })
      })
    }
    boucle().then(function (finale) {
      clos = true
      if (!finale) throw Object.assign(new Error('La réponse a été interrompue.'), { statut: 502 })
      attente.remove(); if (vivante) vivante.remove()
      var rep = finale.reponse
      historique.push({ role: 'assistant', content: rep }); ecrire(); legende = String(rep).replace(/\*\*/g, '')
      quota = finale.quota; if (finale.jetons) jetons = { jour: finale.jetons.jour, semaine: finale.jetons.semaine }
      bulle('assistant', rep, sourcesDe(finale.outils, pilotee)); majPersistance(); if (pilotee) setTimeout(chargerBriefing, 800)
      if (synth && (questionVocale || prefs.lire || prefs.conv)) parler(rep, function () { if (prefs.conv && !occupe && !panneau.hidden) setTimeout(ecouter, 250) })
      else if (prefs.conv) ecouter()
      questionVocale = false
    }).catch(function (e) {
      clos = true; attente.remove(); if (vivante) vivante.remove(); questionVocale = false; if (prefs.conv) majConv(false)
      // la question reste dans l'historique : « Réessayer » renvoie la même conversation (sans reprendre les actions à l'écran déjà faites)
      var rejouer = (e.statut === 429 && e.code !== 'quota') || e.statut === 502 || e.statut === 503 || e.statut === 504 || e.code === 'indisponible' || e.code === 'limite' || e.code === 'delai' || !e.statut && !e.jarvis ? envoyerHistorique : null
      erreur(e.message === 'Failed to fetch' || (!e.statut && !e.jarvis && !/connect|session/i.test(e.message)) ? 'Impossible de joindre l’assistant. Vérifiez votre connexion.' : e.message, rejouer)
    }).then(function () { if (window.PiloteJarvis) window.PiloteJarvis.terminer(); occupe = false; envoyer.disabled = false; panneau.removeAttribute('aria-busy'); if (!sceneOn) champ.focus(); majScene() })
  }
  // chaque action demandée par Jarvis : soit une carte de confirmation (modification de données), soit un geste à l'écran (curseur de Jarvis)
  function executerAppels(appels) {
    var resultats = [], suite = Promise.resolve()
    appels.forEach(function (a) {
      suite = suite.then(function () {
        if (window.ActionsJarvis && window.ActionsJarvis.outils.indexOf(a.outil) >= 0) {
          if (window.PiloteJarvis && window.PiloteJarvis.actif()) window.PiloteJarvis.terminer()     // la carte se lit dans la discussion : on rend la main
          return window.ActionsJarvis.traiter(a, journal).then(function (r) { resultats.push(r) })
        }
        if (!window.PiloteJarvis) { resultats.push({ id: a.id, statut: 'erreur', contenu: JSON.stringify({ erreur: 'Le pilotage de l’écran n’est pas disponible.' }), resume: 'indisponible' }); return }
        return window.PiloteJarvis.executer([a]).then(function (x) { resultats.push(x.resultats[0]) })
      })
    })
    return suite.then(function () { return resultats })
  }
  function pilotageDispo() { return !!window.PiloteJarvis && prefs.pilote }
  function majPilote() {
    if (!btnPilote) return
    var t = prefs.pilote ? 'Pilotage de l’écran : activé (Jarvis peut ouvrir des pages et remplir des champs devant vous)' : 'Pilotage de l’écran : désactivé'
    btnPilote.setAttribute('aria-pressed', String(prefs.pilote)); btnPilote.title = t; btnPilote.setAttribute('aria-label', t)
  }

  var jetons = null
  // consommation de jetons du jour (comptés par l'API) : lue à l'ouverture, remise à jour après chaque réponse
  function chargerJetons() {
    if (!(S.sb && S.sb.on())) return
    S.sb.post('rpc/jarvis_usage_etat', {}).then(function (e) { if (e && e.jour) { jetons = { jour: { utilises: e.jour.utilises, limite: e.jour.limite }, semaine: { utilises: e.semaine.utilises, limite: e.semaine.limite } }; majPersistance() } }).catch(function () {})
  }
  function texteJetons() {
    if (!jetons) return ''
    var p = Math.round(100 * jetons.jour.utilises / jetons.jour.limite)
    return ' · Jetons du jour : ' + Math.round(jetons.jour.utilises).toLocaleString('fr-FR') + ' / ' + Math.round(jetons.jour.limite).toLocaleString('fr-FR') + (p >= 80 ? ' (' + p + ' %)' : '')
  }
  function majPersistance() { if (!note) return; note.classList.toggle('jv-note-alerte', !!jetons && jetons.jour.utilises >= 0.8 * jetons.jour.limite); note.textContent = (persistance ? 'Conversation enregistrée dans votre historique. Jarvis peut se tromper : vérifiez les chiffres importants.' + (quota ? ' (' + quota.utilisees + '/' + quota.limite + ' questions aujourd’hui)' : '') : NOTE_BASE) + texteJetons() }
  function nouvelleConversation() { if (occupe) return; arreterTout(); historique = []; retenirConv(null); ecrire(); redessiner(); majPersistance() }
  function etendre(v) { panneau.classList.toggle('jv-large', v); btnLarge.setAttribute('aria-pressed', String(v)); btnLarge.title = v ? 'Réduire' : 'Vue étendue'; btnLarge.setAttribute('aria-label', btnLarge.title); btnLarge.replaceChildren(ic(v ? 'minimize-2' : 'maximize-2', 16)) }
  // liste des conversations enregistrées (propres à la personne : la base ne renvoie que les siennes)
  function api(chemin, options) {
    return S.auth.token().then(function (jeton) {
      var SB = window.CREATIGO_SB
      return fetch(SB.url + '/rest/v1/' + chemin, Object.assign({}, options, { headers: Object.assign({ apikey: SB.key, Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' }, (options || {}).headers) }))
    })
  }
  // « Conversations » et « Mémoire » : deux listes privées de la personne, effaçables à tout moment
  function enteteListe(actif) {
    return h('div', { class: 'jv-histo-tete' }, h('div', { class: 'jv-onglets', role: 'tablist' },
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(actif === 'conv'), onclick: ouvrirHistorique }, 'Conversations'),
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(actif === 'mem'), onclick: ouvrirMemoire }, 'Mémoire')),
      h('button', { type: 'button', class: 'jv-icone', title: 'Retour', 'aria-label': 'Retour à la conversation', onclick: redessiner }, ic('x', 16)))
  }
  function ouvrirMemoire() {
    if (occupe) return
    var zone = h('div', { class: 'jv-histo' }, enteteListe('mem'), h('p', { class: 'jv-aide' }, 'Chargement…'))
    journal.replaceChildren(zone)
    api('jarvis_memoire?select=id,contenu,categorie&order=created_at.desc&limit=40').then(function (r) { return r.ok ? r.json() : Promise.reject() }).then(function (l) {
      zone.lastChild.remove()
      zone.append(h('p', { class: 'jv-aide' }, 'Ce que Jarvis retient pour vous. Seul(e) vous le voyez. Dites « retiens que… » pour en ajouter ; vous confirmez à chaque fois.'))
      if (!l.length) return zone.append(h('p', { class: 'jv-aide' }, 'Rien pour le moment.'))
      l.forEach(function (m) {
        zone.append(h('div', { class: 'jv-histo-ligne' }, h('div', { class: 'jv-histo-ouvrir jv-souvenir' }, h('span', {}, m.contenu), h('small', {}, m.categorie === 'contexte' ? 'Contexte' : 'Préférence')),
          h('button', { type: 'button', class: 'jv-icone', title: 'Oublier', 'aria-label': 'Oublier : ' + m.contenu, onclick: function (e) {
            var ligne = e.currentTarget.closest('.jv-histo-ligne')
            api('jarvis_memoire?id=eq.' + m.id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).then(function () { ligne.remove() })
          } }, ic('trash-2', 15))))
      })
    }).catch(function () { zone.lastChild.textContent = 'La mémoire n’est pas disponible pour le moment (elle demande l’activation de supabase/jarvis_plus.sql).' })
  }
  function ouvrirHistorique() {
    if (occupe) return
    var zone = h('div', { class: 'jv-histo' }, enteteListe('conv'), h('p', { class: 'jv-aide' }, 'Chargement…'))
    journal.replaceChildren(zone)
    api('jarvis_conversations?select=id,titre,updated_at&espace=eq.' + ESP + '&archivee=eq.false&order=updated_at.desc&limit=40').then(function (r) { return r.ok ? r.json() : Promise.reject() }).then(function (l) {
      zone.lastChild.remove()
      if (!l.length) return zone.append(h('p', { class: 'jv-aide' }, 'Aucune conversation enregistrée pour le moment.'))
      l.forEach(function (c) {
        zone.append(h('div', { class: 'jv-histo-ligne' },
          h('button', { type: 'button', class: 'jv-histo-ouvrir', onclick: function () { reprendre(c) } }, h('span', {}, c.titre), h('small', {}, new Date(c.updated_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))),
          h('button', { type: 'button', class: 'jv-icone', title: 'Supprimer', 'aria-label': 'Supprimer la conversation « ' + c.titre + ' »', onclick: function (e) {
            var ligne = e.currentTarget.closest('.jv-histo-ligne')
            api('jarvis_conversations?id=eq.' + c.id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).then(function () { ligne.remove(); if (convId === c.id) nouvelleConversation() })
          } }, ic('trash-2', 15))))
      })
    }).catch(function () { zone.lastChild.textContent = 'L’historique n’est pas disponible pour le moment (il demande l’activation de supabase/jarvis.sql).' })
  }
  function reprendre(c) {
    api('jarvis_messages?conversation_id=eq.' + c.id + '&select=role,content&order=created_at.asc&limit=100').then(function (r) { return r.json() }).then(function (m) {
      historique = m.map(function (x) { return { role: x.role, content: x.content } }); retenirConv(c.id); persistance = true; ecrire(); redessiner(); majPersistance()
    }).catch(function () { erreur('Impossible de rouvrir cette conversation.') })
  }

  function ajuster() { champ.style.height = 'auto'; champ.style.height = Math.min(champ.scrollHeight, 120) + 'px' }
  function ouvrir() {
    panneau.hidden = false; bouton.setAttribute('aria-expanded', 'true'); pastille.hidden = true; chargerJetons()
    requestAnimationFrame(function () { panneau.classList.add('ouvert'); champ.focus() })
  }
  function fermer() {
    sortirVoix(); arreterTout()
    panneau.classList.remove('ouvert'); bouton.setAttribute('aria-expanded', 'false')
    setTimeout(function () { if (!panneau.classList.contains('ouvert')) panneau.hidden = true }, 220); bouton.focus()
  }

  function monter() {
    pastille = h('span', { class: 'jv-pastille', hidden: true, 'aria-hidden': 'true' })
    bouton = h('button', { class: 'jv-bouton', type: 'button', 'aria-label': 'Ouvrir Jarvis, l’assistant IA', title: 'Jarvis (Ctrl+K)', 'aria-expanded': 'false', 'aria-controls': 'jv-panneau', onclick: function () { panneau.hidden ? ouvrir() : fermer() } },
      h('span', { class: 'jv-bouton-logo', 'aria-hidden': 'true' }), h('span', { class: 'jv-bouton-txt' }, 'Jarvis'), pastille)
    journal = h('div', { class: 'jv-journal', role: 'log', 'aria-live': 'polite', 'aria-label': 'Discussion avec Jarvis' })
    champ = h('textarea', { class: 'jv-champ', rows: '1', maxlength: '4000', placeholder: CLIENT ? 'Posez une question sur votre projet…' : 'Posez une question sur l’agence…', 'aria-label': 'Votre question pour Jarvis',
      oninput: ajuster, onkeydown: function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); demander(champ.value) } } })
    envoyer = h('button', { class: 'jv-envoi', type: 'submit', 'aria-label': 'Envoyer' }, ic('send', 17))
    micro = SR || synth ? h('button', { class: 'jv-micro repos', type: 'button', 'aria-pressed': 'false', onclick: function () {
      if (parle) return arreterParole()
      if (enEcoute) return arreterEcoute()
      if (!SR) return erreur('La dictée vocale n’est pas disponible dans ce navigateur : utilisez Chrome, Edge ou Safari.')
      silences = 0; ecouter()
    } }, ic('mic', 17)) : null
    btnLire = synth ? h('button', { class: 'jv-icone', type: 'button', 'aria-pressed': String(prefs.lire), onclick: function () { majLire(!prefs.lire) } }, ic(prefs.lire ? 'volume-2' : 'volume-x', 16)) : null
    btnConv = SR && synth ? h('button', { class: 'jv-icone', type: 'button', 'aria-pressed': String(prefs.conv), onclick: function () { sceneOn ? sortirVoix() : entrerVoix() } }, ic('headset', 16)) : null
    if (btnConv) { btnConv.title = 'Mode vocal : parler à Jarvis en plein écran'; btnConv.setAttribute('aria-label', btnConv.title) }
    note = h('p', { class: 'jv-note' }, NOTE_BASE)
    btnPilote = window.PiloteJarvis ? h('button', { class: 'jv-icone', type: 'button', onclick: function () { prefs.pilote = !prefs.pilote; ecrirePrefs(); majPilote() } }, ic('mouse-pointer-click', 16)) : null
    btnHisto = h('button', { class: 'jv-icone', type: 'button', title: 'Historique des conversations', 'aria-label': 'Historique des conversations', onclick: ouvrirHistorique }, ic('history', 16))
    btnLarge = h('button', { class: 'jv-icone', type: 'button', 'aria-pressed': 'false', onclick: function () { etendre(!panneau.classList.contains('jv-large')) } }, ic('maximize-2', 16))
    panneau = h('section', { class: 'jv-panneau', id: 'jv-panneau', role: 'dialog', 'aria-label': 'Jarvis, assistant IA', hidden: true, onkeydown: function (e) { if (e.key === 'Escape') fermer() } },
      h('header', { class: 'jv-tete' },
        h('span', { class: 'jv-logo', 'aria-hidden': 'true' }, marque('icone', 34)),
        h('div', {}, h('b', {}, 'Jarvis'), (sousTitre = h('small', {}, 'Assistant IA'))),
        btnConv, btnLire,
        btnPilote, btnHisto, btnLarge,
        h('button', { class: 'jv-icone', type: 'button', title: 'Nouvelle conversation', 'aria-label': 'Nouvelle conversation', onclick: nouvelleConversation }, ic('plus', 16)),
        h('button', { class: 'jv-icone', type: 'button', title: 'Fermer', 'aria-label': 'Fermer', onclick: fermer }, ic('x', 17))),
      journal,
      h('form', { class: 'jv-form', onsubmit: function (e) { e.preventDefault(); arreterEcoute(); demander(champ.value) } }, micro, champ, envoyer),
      note,
      window.OrbeJarvis && SR && synth ? construireScene() : null)
    document.body.append(bouton, panneau)
    majLire(prefs.lire); prefs.conv = false; majVoix(); etendre(false); majPilote()
    redessiner()
    // visible seulement une fois dans l'admin (pas sur l'écran de connexion)
    var app = document.getElementById('app')
    var suivre = function () { var visible = CLIENT ? !!S.auth.session() : (!app || !app.hidden); if (CLIENT && !visible && historique.length) { historique = []; ecrire(); retenirConv(null); brief = null; redessiner() }; bouton.hidden = !visible; if (visible && !brief) setTimeout(chargerBriefing, 600); if (!visible && !panneau.hidden) { panneau.hidden = true; panneau.classList.remove('ouvert') } }
    if (app) new MutationObserver(suivre).observe(app, { attributes: true, attributeFilter: ['hidden'] })
    if (CLIENT) { var pt = document.getElementById('pt'); if (pt) new MutationObserver(suivre).observe(pt, { childList: true }); window.addEventListener('hashchange', suivre); window.addEventListener('storage', suivre); setInterval(suivre, 3000) }
    suivre()
    setInterval(function () { if (!bouton.hidden && !occupe) chargerBriefing() }, 600000)
    // déconnexion : on efface la discussion de cet onglet
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#out')) { arreterTout(); try { sessionStorage.removeItem(K); sessionStorage.removeItem(KCONV) } catch (x) {} historique = []; convId = null; brief = null; majPastille(); redessiner() } })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monter); else monter()
  window.Jarvis = { ouvrir: ouvrir, demander: demander, pageCourante: pageCourante, reprendre: function (c) { ouvrir(); reprendre(c) } }
})()
