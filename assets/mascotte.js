/* Mascotte de l'accueil : les pupilles (dessinées en CSS) suivent la souris, bornées au blanc des yeux par un masque. */
(function () {
  var m = document.querySelector('.mascot'); if (!m) return
  var eyes = m.querySelector('.m-eyes'), ps = [].slice.call(m.querySelectorAll('.m-p'))
  var C0 = [[47.62, 24.7], [79.58, 39.01]], R = (+m.dataset.r || 38) / 900 // portée max en fraction de la largeur de la mascotte
  var C = ps.map(function (p, i) { return p.style.left ? [parseFloat(p.style.left), parseFloat(p.style.top)] : C0[i] }) // mascottes illustrées : position des pupilles dans le balisage
  var FL = m.closest('[data-flip]') ? -1 : 1 // mascotte en miroir (bord droit de l'écran)
  var tx = [0, 0], ty = [0, 0], cx = [0, 0], cy = [0, 0], tgt = null, run = false
  function aim(x, y) { tgt = [x, y]; if (!run) { run = true; requestAnimationFrame(tick) } }
  function tick() {
    var r = eyes.getBoundingClientRect(), w = r.width, done = true
    ps.forEach(function (p, i) {
      var ex = FL > 0 ? r.left + C[i][0] / 100 * w : r.right - C[i][0] / 100 * w, ey = r.top + C[i][1] / 100 * r.height
      var dx = (tgt ? tgt[0] : innerWidth / 2) - ex, dy = (tgt ? tgt[1] : innerHeight) - ey
      var d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / (w * 0.45)) * R * w
      tx[i] = FL * dx / d * k; ty[i] = dy / d * k * 0.9
      cx[i] += (tx[i] - cx[i]) * 0.3; cy[i] += (ty[i] - cy[i]) * 0.3
      if (Math.abs(tx[i] - cx[i]) > 0.15 || Math.abs(ty[i] - cy[i]) > 0.15) done = false
      p.style.transform = 'translate(' + cx[i].toFixed(2) + 'px,' + cy[i].toFixed(2) + 'px)'
    })
    if (done) run = false; else requestAnimationFrame(tick)
  }
  addEventListener('pointermove', function (e) { aim(e.clientX, e.clientY) }, { passive: true })
  addEventListener('resize', function () { aim(tgt ? tgt[0] : innerWidth / 2, tgt ? tgt[1] : innerHeight) })
  addEventListener('scroll', function () { if (tgt) aim(tgt[0], tgt[1]) }, { passive: true }) // la page défile : la mascotte bouge sous le pointeur, les yeux se réajustent
  document.addEventListener('pointerleave', function () {}, { passive: true })
  aim(innerWidth * 0.5, innerHeight * 0.55) // regard de départ : vers le visiteur, légèrement vers le bas
})()

/* La mascotte parle : bienvenue, conseils après un temps d'inactivité, réactions au survol de la barre de navigation,
   des boutons du hero, du bandeau « Ils nous font confiance » ; un clic = message suivant. Survol uniquement (pas de tactile). */
;(function () {
  var m = document.querySelector('.mascot'), bub = document.querySelector('.mbub'); if (!m || !bub) return
  var FL = m.closest('[data-flip]') ? -1 : 1 // mascotte en miroir (bord droit de l'écran)
  var txt = bub.querySelector('.mbt'), timers = [], k = 0, scrolled = false, last = 0, lastKey = ''
  var CFG = window.MASCOT_TXT || {} // textes propres à une page (l'accueil n'en définit pas)
  var LINES = CFG.lines || ['Bienvenue chez Creatigo !', 'Faites défiler pour nous découvrir.', 'Un projet en tête ? Parlons-en.', 'Encore un clic ? J’adore ça.', 'Je suis la mascotte de la maison.']
  var IDLE = CFG.idle || ['Un site, du référencement, de la pub : on s’occupe de tout.', 'Un devis se compose en quelques clics.', 'Une question ? L’équipe vous répond.']
  // survol : [sélecteur ou test d'URL, message]
  var NAV = [
    ['nos-realisations', 'Nos réalisations : des projets bien réels.'],
    ['nos-services', 'Sites, SEO, publicité, applications : tout est là.'],
    ['lagence', 'Une équipe, un seul interlocuteur.'],
    ['blog', 'Nos conseils pour mieux vous voir en ligne.'],
    ['devis', 'Composez votre devis en direct.'],
    ['contactez-nous', 'On vous répond vite : parlons de votre projet !']
  ]
  if (CFG.nav) NAV = CFG.nav.concat(NAV)
  function clear() { timers.forEach(clearTimeout); timers = [] }
  function at(ms, f) { timers.push(setTimeout(f, ms)) }
  function visible() { var r = m.getBoundingClientRect(); return r.bottom > 40 && r.top < innerHeight - 40 }
  function say(text, hold, key, instant) {
    var now = Date.now()
    if (key && key === lastKey && now - last < 4000) return
    clear(); last = now; lastKey = key || ''
    if (instant) { txt.textContent = text; bub.classList.remove('typing'); bub.classList.add('on'); at(hold || 1800, function () { bub.classList.remove('on') }); return }
    bub.classList.add('on', 'typing'); txt.textContent = ''
    at(key ? 380 : 650, function () { txt.textContent = text; bub.classList.remove('typing'); m.classList.add('talk'); at(600, function () { m.classList.remove('talk') }) })
    at((key ? 380 : 650) + (hold || 4200), function () { bub.classList.remove('on') })
  }
  function next() { say(LINES[k % LINES.length]); k++ }
  window.mascotteSay = say // permet à une page d'envoyer ses propres phrases (mascotte du bord de l'écran)
  // départ : bienvenue, puis conseil de défilement, puis un conseil toutes les ~14 s tant que le visiteur ne défile pas
  if (!CFG.quiet) at(900, function () { say(LINES[0], 3600); k = 1 })
  if (!CFG.quiet) at(900 + 650 + 3600 + 3200, function () { if (!scrolled) { say(LINES[1], 5000); k = 2 } })
  var n = 0
  var idle = setInterval(function () { if (!CFG.quiet && !scrolled && visible() && Date.now() - last > 12000) { say(IDLE[n % IDLE.length], 4600); n++ } }, 4000)
  addEventListener('scroll', function () { if (!scrolled && scrollY > 40) { scrolled = true; clear(); bub.classList.remove('on', 'typing') } else if (scrolled && scrollY < 20) scrolled = false }, { passive: true })
  // un clic fait mal : la zone touchée rougit, la mascotte tressaille et lâche un « Aïe ! »
  var OUCH = ['Aïe !', 'Aïe, ça fait mal !', 'Ouille !', 'Hé, doucement !'], hits = [], oi = 0, hurtT = 0
  m.addEventListener('click', function (e) {
    if (window.mascotteZone && window.mascotteZone(m, e)) return // yeux et bouche : un clic n'y compte pas
    var r = m.getBoundingClientRect(), now = Date.now()
    m.style.setProperty('--hx', ((FL > 0 ? e.clientX - r.left : r.right - e.clientX) / r.width * 100).toFixed(1) + '%')
    m.style.setProperty('--hy', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%')
    // une marque différente à chaque coup : tache irrégulière (taille, étalement, éclaboussures au hasard)
    function rd(a, b) { return a + Math.random() * (b - a) }
    var P = function (v) { return v.toFixed(1) + '%' }
    var w1 = rd(7.5, 11)
    m.style.setProperty('--w1', P(w1)); m.style.setProperty('--h1', P(w1 * rd(.55, .9)))
    m.style.setProperty('--w2', P(rd(5, 8))); m.style.setProperty('--h2', P(rd(3.6, 6)))
    m.style.setProperty('--x2', P(rd(-6, 6))); m.style.setProperty('--y2', P(rd(-6, 6)))
    m.style.setProperty('--w3', P(rd(4, 6.5))); m.style.setProperty('--h3', P(rd(3, 5)))
    m.style.setProperty('--x3', P(rd(-7, 7))); m.style.setProperty('--y3', P(rd(-6, 7)))
    m.classList.remove('hurt'); void m.offsetWidth; m.classList.add('hurt')
    clearTimeout(hurtT); hurtT = setTimeout(function () { m.classList.remove('hurt') }, 950)
    hits = hits.filter(function (t) { return now - t < 2500 }); hits.push(now)
    say(hits.length >= 3 ? 'Aïe aïe aïe ! Arrêtez !' : OUCH[oi++ % OUCH.length], 1800, 'h' + now, true)
  })
  if (CFG.quiet || !matchMedia('(hover: hover)').matches) return
  function hov(el, text, key) { el.addEventListener('pointerenter', function () { if (visible()) say(text, 2800, key) }) }
  // barre de navigation
  document.querySelectorAll('header a, nav a').forEach(function (a) {
    var h = a.getAttribute('href') || ''
    for (var i = 0; i < NAV.length; i++) if (h.indexOf(NAV[i][0]) !== -1) { hov(a, NAV[i][1], 'nav' + i); break }
  })
  // boutons du hero
  var btns = document.querySelectorAll('.hero.home .cta .btn')
  var R = ['Sites, SEO, publicité, applications…', 'Le devis se compose en direct.']
  btns.forEach(function (bt, i) { if (R[i]) hov(bt, R[i], 'cta' + i) })
  // bandeau de confiance
  var cl = document.querySelector('.clients')
  if (cl) hov(cl, 'Ils nous font confiance. Et si vous étiez le prochain ?', 'clients')
  // pied de page / bouton contact : la mascotte est hors écran, on ne dit rien
})()
