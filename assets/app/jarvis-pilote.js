/* Jarvis pilote l'écran : quand l'assistant ouvre une page, clique ou saisit, l'utilisateur le voit faire (halo autour de la page, bandeau
   « Jarvis travaille ici », curseur de Jarvis qui se déplace, élément ciblé entouré) et peut l'arrêter à tout moment (bouton ou Échap).
   Tout se passe DANS LE NAVIGATEUR, avec la session et les droits de la personne : la base garde le dernier mot.
   Garde-fous (ici, indépendants de ce que dit le modèle) :
   - jamais : déconnexion, mots de passe, fichiers, page Équipe & accès, clés d'API, panneau de Jarvis lui-même, liens vers un autre site ;
   - tout bouton qui enregistre, envoie, supprime, valide, paie… demande l'accord de la personne, à l'écran, avant le clic ;
   - le texte de l'écran est renvoyé comme donnée (jamais comme consigne). */
(function () {
  var UI = window.UI
  if (!UI) return
  var h = UI.h, ic = UI.icone
  var RACINE = '.jvp-racine, #jv-panneau, .jv-bouton, #login, #out, [data-jv-interdit], main[data-vue="equipe"], main[data-vue="ia"], a[href^="#equipe"], a[href^="#ia"]'
  var SENSIBLE = /supprim|retir|effac|envoy|valid|pay|encaiss|archiv|annul|confirm|publi|enregistr|sauvegard|cr[ée]er|ajouter|accept|refus|restaur|d[ée]connex|sign|export|t[ée]l[ée]charg|import|r[ée]initial|activer|d[ée]sactiver|mettre [àa] jour|appliquer|lancer|g[ée]n[ée]rer|dupliquer|facturer|rembours/i
  var CHAMPS = /^(text|search|email|tel|url|number|date|time|datetime-local|month|week|)$/i
  var calme = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches
  var refs = new Map(), actif = false, arret = false, dom = null, pos = { x: 0, y: 0 }, attenteConfirm = null
  var pause = function (ms) { return new Promise(function (ok) { setTimeout(ok, calme ? Math.min(ms, 60) : ms) }) }

  /* ---------- habillage ---------- */
  function monter() {
    if (dom) return dom
    var etape = h('span', { class: 'jvp-etape' }, 'Prépare le travail…')
    var stop = h('button', { type: 'button', class: 'jvp-stop', onclick: function () { interrompre() } }, 'Arrêter ', h('kbd', {}, 'Échap'))
    var logo = h('img', { src: '../assets/jarvis/jarvis-symbole-blanc.svg', alt: '', width: '22', height: '22' })
    var pastille = h('div', { class: 'jvp-pastille', role: 'status', 'aria-live': 'polite' }, h('span', { class: 'jvp-logo' }, logo), h('b', {}, 'Jarvis travaille ici'), etape, stop)
    var confirm = h('div', { class: 'jvp-confirm', role: 'alertdialog', 'aria-label': 'Confirmation demandée par Jarvis', hidden: true })
    var curseur = h('div', { class: 'jvp-curseur', 'aria-hidden': 'true' })
    curseur.innerHTML = '<svg width="30" height="34" viewBox="0 0 30 34" fill="none"><defs><linearGradient id="jvp-g" x1="0" y1="0" x2="30" y2="34" gradientUnits="userSpaceOnUse"><stop stop-color="#1f5cff"/><stop offset="1" stop-color="#2ee0d1"/></linearGradient></defs><path d="M3 2.5 27 14.2 15.4 17.6 11.2 29.6Z" fill="url(#jvp-g)" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg><span>Jarvis</span>'
    var cible = h('div', { class: 'jvp-cible', hidden: true })
    var racine = h('div', { class: 'jvp-racine' }, h('div', { class: 'jvp-lueur', 'aria-hidden': 'true' }), h('div', { class: 'jvp-cadre', 'aria-hidden': 'true' }), h('div', { class: 'jvp-bouclier', 'aria-hidden': 'true' }), cible, curseur, pastille, confirm)
    document.body.append(racine)
    dom = { racine: racine, etape: etape, confirm: confirm, curseur: curseur, cible: cible }
    return dom
  }
  function etape(texte) { if (dom) dom.etape.textContent = texte }
  function placerCurseur(x, y, duree) {
    var c = dom.curseur
    c.style.transition = calme ? 'none' : 'transform ' + duree + 'ms cubic-bezier(.22,1,.36,1)'
    c.style.transform = 'translate(' + x + 'px,' + y + 'px)'
    pos = { x: x, y: y }
    return pause(duree + 40)
  }
  function entourer(el) {
    var c = dom.cible
    if (!el) { c.hidden = true; return }
    var r = el.getBoundingClientRect()
    c.hidden = false
    c.style.cssText = 'left:' + (r.left - 4) + 'px;top:' + (r.top - 4) + 'px;width:' + (r.width + 8) + 'px;height:' + (r.height + 8) + 'px'
  }
  function onde(x, y) {
    var o = h('span', { class: 'jvp-onde' }); o.style.left = x + 'px'; o.style.top = y + 'px'
    dom.racine.append(o); setTimeout(function () { o.remove() }, 700)
  }
  // le curseur part du bouton Jarvis (ou du coin) et va vers l'élément, qu'il fait d'abord apparaître à l'écran
  async function viser(el, versGauche) {
    if (!dom.curseur.dataset.vu) {
      var b = document.querySelector('.jv-bouton'), r0 = b ? b.getBoundingClientRect() : { left: innerWidth - 80, top: innerHeight - 70, width: 0, height: 0 }
      dom.curseur.style.transition = 'none'; dom.curseur.style.transform = 'translate(' + (r0.left + r0.width / 2) + 'px,' + (r0.top + r0.height / 2) + 'px)'; dom.curseur.dataset.vu = '1'
      void dom.curseur.offsetWidth
    }
    var r = el.getBoundingClientRect()
    if (r.bottom < 70 || r.top > innerHeight - 20 || r.left < 0 || r.right > innerWidth) { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: calme ? 'auto' : 'smooth' }); await pause(450); r = el.getBoundingClientRect() }
    entourer(el)
    var x = versGauche ? r.left + Math.min(26, r.width / 2) : r.left + r.width / 2, y = r.top + r.height / 2
    await placerCurseur(Math.round(x), Math.round(y), Math.max(350, Math.min(900, Math.hypot(x - pos.x, y - pos.y) * 1.1)))
    return { x: x, y: y }
  }

  /* ---------- lecture de l'écran ---------- */
  var visible = function (el) { var r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; var s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && el.getClientRects().length > 0 }
  var interdit = function (el) { return !!(el.closest && el.closest(RACINE)) || (el.tagName === 'INPUT' && /^(password|file|hidden)$/i.test(el.type)) }
  var propre = function (t) { return String(t || '').replace(/\s+/g, ' ').trim() }
  function etiquette(el) {
    var l = el.labels && el.labels[0] ? el.labels[0] : el.closest('label')
    if (l) { var c = l.cloneNode(true); c.querySelectorAll('input,select,textarea,button').forEach(function (x) { x.remove() }); if (propre(c.textContent)) return propre(c.textContent) }
    var p = el.parentElement, t = p && p.querySelector(':scope > .lab, :scope > label, :scope > span')
    return t && t !== el ? propre(t.textContent) : ''
  }
  function libelle(el) {
    var t = el.getAttribute('aria-label') || ''
    if (!t && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) t = etiquette(el) || el.getAttribute('placeholder') || el.name || ''
    if (!t) t = el.textContent
    if (!t || !propre(t)) t = el.getAttribute('title') || el.getAttribute('data-icone') || ''
    return propre(t).slice(0, 70)
  }
  function genre(el) {
    if (el.tagName === 'A') return 'lien'
    if (el.tagName === 'SELECT') return 'liste'
    if (el.tagName === 'TEXTAREA') return 'champ'
    if (el.tagName === 'INPUT') return /^(checkbox|radio)$/i.test(el.type) ? 'case' : /^(button|submit|reset)$/i.test(el.type) ? 'bouton' : 'champ'
    return 'bouton'
  }
  function sensible(el) {
    var t = libelle(el), g = genre(el)
    if (g === 'lien') return el.hasAttribute('download') || (!/^#/.test(el.getAttribute('href') || '') && SENSIBLE.test(t))   // un lien interne (#page) ne fait que naviguer
    if (g === 'champ' || g === 'liste') return false
    return SENSIBLE.test(t) || el.type === 'submit' || (el.tagName === 'BUTTON' && !el.hasAttribute('type') && !!el.closest('form')) || !!(el.classList && el.classList.contains('danger'))
  }
  function voir() {
    refs.clear()
    var main = document.getElementById('main'), titre = document.getElementById('titre-page'), route = (location.hash || '#dashboard').slice(1).split('?')[0]
    var vue = main && main.getAttribute('data-vue')
    var liste = Array.prototype.slice.call(document.querySelectorAll('a[href], button, input, select, textarea, summary, [role="button"], [role="tab"]')).filter(function (el) { return !interdit(el) && visible(el) })
    var vus = new Set(), sortie = []
    liste.sort(function (a, b) { var ia = a.getBoundingClientRect().top < innerHeight && a.getBoundingClientRect().bottom > 0, ib = b.getBoundingClientRect().top < innerHeight && b.getBoundingClientRect().bottom > 0; return ia === ib ? 0 : ia ? -1 : 1 })
    for (var i = 0; i < liste.length && sortie.length < 70; i++) {
      var el = liste[i], t = libelle(el), g = genre(el)
      if (!t && g !== 'champ') continue
      if (el.tagName === 'A' && /^(https?:)?\/\//.test(el.getAttribute('href') || '') && new URL(el.href, location.href).origin !== location.origin) continue
      var cle = g + '|' + t + '|' + Math.round(el.getBoundingClientRect().top / 8)
      if (vus.has(cle)) continue; vus.add(cle)
      var id = 'e' + (refs.size + 1); refs.set(id, el)
      var o = { ref: id, type: g, libelle: t, zone: el.closest('#menu') ? 'menu' : 'page' }
      if (g === 'champ') o.valeur = propre(el.value).slice(0, 80)
      if (g === 'liste') { o.valeur = el.options[el.selectedIndex] ? propre(el.options[el.selectedIndex].text) : ''; o.options = Array.prototype.slice.call(el.options).slice(0, 15).map(function (x) { return propre(x.text).slice(0, 40) }) }
      if (g === 'case') o.coche = !!el.checked
      if (el.disabled) o.desactive = true
      if (sensible(el)) o.sensible = true
      sortie.push(o)
    }
    var reserve = !main || vue === 'equipe' || vue === 'ia' || vue === 'refuse'
    return { page: { titre: titre ? propre(titre.textContent) : '', route: route }, reserve: reserve ? 'Cette page est fermée au pilotage (accès, clés) ou réservée à la direction.' : undefined,
      elements: sortie, texte_ecran: reserve ? '' : propre(main.innerText).slice(0, 1800), defilement: { haut: window.scrollY <= 2, bas: window.scrollY + innerHeight >= document.documentElement.scrollHeight - 4 } }
  }
  var retrouver = function (ref) {
    var el = refs.get(ref)
    if (!el || !el.isConnected) throw new Error('Élément introuvable : l’écran a changé. Appelle voir_ecran puis réessaie.')
    if (interdit(el)) throw new Error('Cet élément est interdit au pilotage (accès, clés, déconnexion ou mot de passe).')
    return el
  }
  var etatPage = function () { var t = document.getElementById('titre-page'); return { page: t ? propre(t.textContent) : '', route: (location.hash || '#dashboard').slice(1).split('?')[0] } }

  /* ---------- confirmation ---------- */
  function confirmer(titre, detail, el) {
    return new Promise(function (ok) {
      var d = dom.confirm
      d.textContent = ''
      d.append(h('p', {}, ic('shield-check', 17), h('span', {}, titre)), detail ? h('small', {}, detail) : null,
        h('div', { class: 'jvp-actions' },
          h('button', { type: 'button', class: 'jvp-refuser', onclick: function () { clore(false) } }, 'Refuser'),
          h('button', { type: 'button', class: 'jvp-autoriser', onclick: function () { clore(true) } }, 'Autoriser')))
      d.hidden = false; dom.racine.classList.add('jvp-attend'); d.querySelector('.jvp-refuser').focus()
      function clore(oui) { attenteConfirm = null; d.hidden = true; dom.racine.classList.remove('jvp-attend'); ok(oui) }
      attenteConfirm = function () { clore(false) }
    })
  }

  /* ---------- actions ---------- */
  async function agirClic(el) {
    var p = await viser(el)
    dom.curseur.classList.add('jvp-appui'); onde(p.x, p.y); await pause(160); dom.curseur.classList.remove('jvp-appui')
    el.click()
    await pause(650)
  }
  async function saisir(el, texte, remplacer) {
    if (!/^(INPUT|TEXTAREA)$/.test(el.tagName) || (el.tagName === 'INPUT' && !CHAMPS.test(el.type)) || el.readOnly || el.disabled) throw new Error('Ce champ n’accepte pas de saisie.')
    await viser(el, true); onde(pos.x, pos.y); el.focus()
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, setter = Object.getOwnPropertyDescriptor(proto, 'value').set
    var cur = remplacer === false ? el.value : ''
    var ecrire = function (v) { setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
    if (remplacer !== false) ecrire('')
    var pas = Math.max(1, Math.ceil(texte.length / 70)), delai = calme ? 0 : Math.min(38, 2200 / Math.max(1, texte.length / pas))
    for (var i = 0; i < texte.length; i += pas) { if (arret) break; cur += texte.slice(i, i + pas); ecrire(cur); if (delai) await new Promise(function (ok) { setTimeout(ok, delai) }) }
    el.dispatchEvent(new Event('change', { bubbles: true })); await pause(250)
  }
  async function choisir(el, valeur) {
    if (el.tagName !== 'SELECT' || el.disabled) throw new Error('Ce n’est pas une liste déroulante utilisable.')
    var n = function (s) { return propre(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() }
    var opt = Array.prototype.slice.call(el.options).filter(function (o) { return o.value === valeur || n(o.text) === n(valeur) })[0] || Array.prototype.slice.call(el.options).filter(function (o) { return n(o.text).indexOf(n(valeur)) >= 0 })[0]
    if (!opt) throw new Error('Option introuvable. Options : ' + Array.prototype.slice.call(el.options).slice(0, 12).map(function (o) { return propre(o.text) }).join(' | '))
    var p = await viser(el); onde(p.x, p.y)
    el.value = opt.value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); await pause(400)
  }

  // « montre-moi comment » : le curseur va vers l'élément, une bulle explique, la personne clique sur Suivant (rien n'est cliqué à sa place)
  function bulle(el, texte, dernier) {
    return new Promise(function (ok) {
      var r = el.getBoundingClientRect(), dessous = r.bottom + 190 < innerHeight
      var b = h('div', { class: 'jvp-bulle', role: 'dialog', 'aria-label': 'Explication de Jarvis' }, h('p', {}, texte), h('button', { type: 'button', class: 'jvp-autoriser', onclick: function () { clore(true) } }, dernier ? 'Terminer' : 'Suivant'))
      b.style.left = Math.max(12, Math.min(innerWidth - 340, r.left + r.width / 2 - 160)) + 'px'
      b.style[dessous ? 'top' : 'bottom'] = (dessous ? r.bottom + 14 : innerHeight - r.top + 14) + 'px'
      dom.racine.append(b); dom.racine.classList.add('jvp-attend'); b.querySelector('button').focus()
      function clore(oui) { attenteConfirm = null; b.remove(); dom.racine.classList.remove('jvp-attend'); ok(oui) }
      attenteConfirm = function () { clore(false) }
    })
  }
  async function une(a) {
    var e = a.entree || {}
    if (a.outil === 'voir_ecran') { etape('Regarde l’écran'); await pause(350); return { statut: 'ok', contenu: voir(), resume: 'écran lu' } }
    if (a.outil === 'defiler') {
      etape(e.direction === 'haut' ? 'Remonte dans la page' : 'Descend dans la page')
      window.scrollBy({ top: (e.direction === 'haut' ? -1 : 1) * Math.round(innerHeight * 0.7), behavior: calme ? 'auto' : 'smooth' }); await pause(600)
      return { statut: 'ok', contenu: { defilement: { haut: window.scrollY <= 2, bas: window.scrollY + innerHeight >= document.documentElement.scrollHeight - 4 } }, resume: 'défilement' }
    }
    if (a.outil === 'aller_a') {
      var lien = document.querySelector('#menu a[href="#' + e.page + '"]')
      etape('Ouvre « ' + (lien ? libelle(lien) : e.page) + ' »')
      if (lien && visible(lien)) await agirClic(lien); else { location.hash = '#' + e.page; await pause(500) }
      if (e.id) { etape('Ouvre la fiche ' + e.id); location.hash = '#' + e.page + '/' + e.id; await pause(700) }
      var vue = (document.getElementById('main') || {}).getAttribute && document.getElementById('main').getAttribute('data-vue')
      if (vue === 'refuse') return { statut: 'refuse', contenu: { erreur: 'Cette page est réservée à la direction.' }, resume: 'page réservée' }
      return { statut: 'ok', contenu: etatPage(), resume: 'page ' + etatPage().page }
    }
    var el = retrouver(e.ref), nom = libelle(el)
    if (a.outil === 'montrer') {
      etape('Vous montre « ' + nom + ' »'); await viser(el)
      var suivi = await bulle(el, e.texte, e.dernier)
      return suivi ? { statut: 'ok', contenu: { montre: nom, la_personne_a_clique_suivant: true }, resume: 'guidage : ' + nom } : { statut: 'refuse', contenu: { erreur: 'La personne a arrêté le guidage.' }, resume: 'guidage arrêté' }
    }
    if (a.outil === 'cliquer') {
      if (el.tagName === 'A' && el.href && new URL(el.href, location.href).origin !== location.origin) throw new Error('Lien vers un autre site : refusé.')
      if (sensible(el)) {
        etape('Demande votre accord pour « ' + nom + ' »'); await viser(el)
        if (!(await confirmer('Jarvis veut cliquer sur « ' + nom + ' »', e.raison || '', el))) { entourer(null); return { statut: 'refuse', contenu: { erreur: 'L’utilisateur a refusé ce clic. Ne le refais pas et ne cherche pas à le contourner.' }, resume: 'clic refusé : ' + nom } }
      }
      if (arret) throw new Error('Pilotage interrompu.')
      etape('Clique sur « ' + nom + ' »'); await agirClic(el)
      return { statut: 'ok', contenu: Object.assign({ clic: nom }, etatPage()), resume: 'clic : ' + nom }
    }
    if (a.outil === 'saisir') { etape('Écrit dans « ' + nom + ' »'); await saisir(el, e.texte, e.remplacer); return { statut: 'ok', contenu: { champ: nom, valeur: propre(el.value).slice(0, 120) }, resume: 'saisie : ' + nom } }
    if (a.outil === 'choisir') { etape('Choisit « ' + e.valeur + ' » dans « ' + nom + ' »'); await choisir(el, e.valeur); return { statut: 'ok', contenu: { liste: nom, choix: propre(el.options[el.selectedIndex].text) }, resume: 'choix : ' + nom } }
    throw new Error('Action inconnue.')
  }

  /* ---------- cycle de vie ---------- */
  function interrompre() { arret = true; if (attenteConfirm) attenteConfirm() }
  function touche(e) { if (actif && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); interrompre() } }
  function demarrer() {
    if (actif) return
    actif = true; arret = false; monter(); dom.racine.classList.add('jvp-on'); document.documentElement.classList.add('jvp-actif')
    document.addEventListener('keydown', touche, true)
  }
  function terminer() {
    if (!actif) return
    actif = false; document.removeEventListener('keydown', touche, true)
    if (dom) { dom.racine.classList.add('jvp-sortie'); var r = dom.racine; dom = null; setTimeout(function () { r.remove() }, 350) }
    document.documentElement.classList.remove('jvp-actif'); refs.clear()
  }
  // exécute les actions demandées par Jarvis, l'une après l'autre ; -> { resultats, interrompu }
  async function executer(appels) {
    demarrer()
    var resultats = [], interrompu = false
    for (var i = 0; i < appels.length; i++) {
      var a = appels[i]
      if (arret) { interrompu = true; resultats.push({ id: a.id, statut: 'refuse', contenu: JSON.stringify({ erreur: 'L’utilisateur a interrompu le pilotage. Arrête-toi et dis-le.' }), resume: 'interrompu' }); continue }
      try { var r = await une(a); resultats.push({ id: a.id, statut: r.statut, contenu: JSON.stringify(r.contenu), resume: r.resume }) }
      catch (err) { resultats.push({ id: a.id, statut: 'erreur', contenu: JSON.stringify({ erreur: String(err && err.message || err) }), resume: String(err && err.message || err).slice(0, 120) }) }
    }
    if (arret) interrompu = true
    if (dom) entourer(null)
    return { resultats: resultats, interrompu: interrompu }
  }
  window.PiloteJarvis = { executer: executer, demarrer: demarrer, terminer: terminer, etape: etape, interrompre: interrompre, actif: function () { return actif }, voir: voir }
})()
