/* Accueil : chaque section est une « scène » plein écran. Au défilement la scène sortante recule et s'estompe,
   la suivante monte en place ; une pastille latérale suit la scène. Le défilement reste natif.
   Désactivé : mouvement réduit, écrans étroits. Ne touche ni la méthode (déjà épinglée), ni l'appel, ni le pied de page. */
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  var wide = matchMedia('(min-width: 900px)')
  var defs = [['.hero.home', 'Accueil', 0], ['#video', 'Vidéo', 1], ['#services', 'Services', 1], ['#methode', 'Méthode', 0], ['#pourquoi', 'Pourquoi', 1]]
  var sc = []
  defs.forEach(function (d) {
    var el = document.querySelector(d[0]); if (!el) return
    sc.push({ el: el, w: d[2] && el.querySelector(':scope > .wrap'), label: d[1], enter: d[0] !== '.hero.home' })
  })
  if (!sc.length) return

  document.documentElement.classList.add('sc')
  var clamp = function (v) { return Math.max(0, Math.min(1, v)) }, tick = false
  function frame() {
    tick = false
    var vh = innerHeight, on = wide.matches
    // barre de défilement masquée (rendue transparente : la mise en page ne bouge pas) de l'accueil jusqu'à « Ce que vous gagnez »
    var pwEl = document.querySelector('#pourquoi')
    var svEl = document.querySelector('#services'), mtEl = document.querySelector('#methode')
    document.documentElement.classList.toggle('sb-dark', !!(on && svEl && mtEl && scrollY > svEl.getBoundingClientRect().top + scrollY - vh * 0.5 && scrollY < mtEl.getBoundingClientRect().top + scrollY - vh * 0.5))
    document.documentElement.classList.toggle('no-sb', !!(on && pwEl && scrollY < pwEl.getBoundingClientRect().top + scrollY - 60))
    sc.forEach(function (s) {
      var r = s.el.getBoundingClientRect()
      if (!s.w) return
      if (!on) { s.w.style.transform = s.w.style.opacity = s.w.style.filter = ''; return }
      var q = clamp((vh * 0.6 - r.bottom) / (vh * 0.6)), e = s.enter ? clamp((vh - r.top) / (vh * 0.62)) : 1
      var ee = e * e * (3 - 2 * e), qq = q * q * (3 - 2 * q)   // courbes douces : démarrage et arrivée sans à-coup
      var k = ee * (1 - qq * 0.85)
      s.w.style.transformOrigin = '50% 40%'
      s.w.style.transform = 'perspective(1500px) translate3d(0,' + ((1 - ee) * 110 - qq * 70).toFixed(1) + 'px,' + (-qq * 120).toFixed(1) + 'px) rotateX(' + ((1 - ee) * 7 - qq * 4).toFixed(2) + 'deg) scale(' + (0.94 + 0.06 * ee - qq * 0.05).toFixed(4) + ')'
      s.w.style.opacity = (0.08 + 0.92 * k).toFixed(3)
      var bl = (1 - ee) * 9 + qq * 6; s.w.style.filter = bl > 0.4 ? 'blur(' + bl.toFixed(1) + 'px)' : ''
    })
  }
  // pagination : un geste de molette (ou une touche) = un cran, comme la page SIRH. Crans : accueil, services,
  // 4 étapes de la méthode, pourquoi, puis l'appel (là le défilement redevient normal, jusqu'au pied de page).
  var mp = document.querySelector('#methode'), fin = document.querySelector('.fin'), busy = false, queued = 0, lastT = 0, lastReq = -1e9
  var g = { dir: 0, acc: 0, fired: false, min: 1e9 }   // le geste de molette en cours
  // pagination seulement si la liste des services tient dans l'écran (fenêtre coupée en deux : la mise en page change à 980 px et le bloc devient plus haut que l'écran,
  // son bas serait inaccessible) : sinon défilement normal. Mesure sans transformation (la scène d'entrée déplace et réduit le bloc).
  function paged() {
    if (!wide.matches || !fin) return false
    if (innerWidth <= 980) return false
    var sv = document.querySelector('#services'), nav = sv && sv.querySelector('.sx-nav, .sv3-nav'); if (!nav) return true
    var y = 0, e = nav; while (e && e !== sv) { y += e.offsetTop; e = e.offsetParent }
    if (!e) return true
    // hauteur de la liste calculée à partir de valeurs stables (boutons, écart, hauteur verrouillée du service ouvert) : la hauteur mesurée varie pendant la rotation automatique des onglets
    var its = nav.children, b = its[0] && its[0].querySelector('button'), n = its.length
    var h = n * (b ? b.offsetHeight : 48) + Math.max(0, n - 1) * (parseFloat(getComputedStyle(nav).rowGap) || 0) + (parseFloat(nav.style.getPropertyValue('--acc-h')) || 0)
    return y + h <= innerHeight + 12
  }
  function stops() {
    var y = function (e) { return e.getBoundingClientRect().top + scrollY }, a = [0]
    var vd = document.querySelector('#video'); if (vd) a.push(y(vd))   // la vidéo : un cran, plein écran
    var sv = document.querySelector('#services'); if (sv) a.push(y(sv))
    if (mp) { var st = mp.querySelector('.mp-stage'), n = mp.querySelectorAll('.mp-n').length, t = Math.max(1, mp.offsetHeight - st.offsetHeight - 84)
      for (var i = 0; i < n; i++) a.push(y(mp) + t * 0.9 * (i / (n - 1)) + 3) }
    var pw = document.querySelector('#pourquoi'); if (pw) a.push(y(pw))
    return a
  }
  // section qui occupe l'écran à la hauteur y
  var SECS = ['.hero.home', '#video', '#services', '#methode', '#pourquoi', '.fin']
  function secAt(y) { var r = null; SECS.forEach(function (q) { var e = document.querySelector(q); if (e && e.getBoundingClientRect().top + scrollY <= y + 6) r = e }); return r }
  // changement de section : pas de glissement vers le haut ou le bas, la section suivante apparaît sur place (voile, zoom léger, ouverture en fondu)
  // changement de section : comme l'accueil de Creatigo SIRH Agent, pas de défilement visible. La section qui part
  // s'élève un peu et s'efface, on se place sur la suivante pendant qu'elle est invisible, et elle arrive en montant doucement.
  var SECS = ['.hero.home', '#video', '#services', '#methode', '#pourquoi', '.fin']
  function secAt(y) { var r = null; SECS.forEach(function (q) { var e = document.querySelector(q); if (e && e.getBoundingClientRect().top + scrollY <= y + 6) r = e }); return r }
  function fondu(to) {
    var a = secAt(scrollY + 2), b = secAt(to), sens = to > scrollY ? 1 : -1; busy = true
    var fin = function () { busy = false; if (queued) { var d = queued; queued = 0; lastReq = performance.now(); page(d) } }
    var sortie = a.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(' + (-5 * sens) + 'vh)' }], { duration: 480, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' })
    var fait = false, suite = function () {
      if (fait) return; fait = true
      if (b) b.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: 'forwards' })
      document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, to); document.documentElement.style.scrollBehavior = ''
      sortie.cancel(); frame()
      if (!b) return fin()
      b.getAnimations().forEach(function (x) { x.cancel() })
      var entree = b.animate([{ opacity: 0, transform: 'translateY(' + (6 * sens) + 'vh)' }, { opacity: 1, transform: 'none' }], { duration: 1050, easing: 'cubic-bezier(.22,1,.36,1)' })
      entree.onfinish = function () { setTimeout(fin, 60) }; setTimeout(function () { if (entree.playState !== 'finished') entree.finish() }, 1500)
    }
    sortie.onfinish = suite; setTimeout(suite, 800)
  }
  function go(to) {
    if (secAt(to) !== secAt(scrollY + 2) && secAt(scrollY + 2)) return fondu(to)
    busy = true; var from = scrollY, t0 = performance.now(), D = 1300
    document.documentElement.style.scrollBehavior = 'auto'
    ;(function step(now) {
      var k = Math.min(1, (now - t0) / D), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2   // doux au départ et à l'arrivée
      scrollTo(0, from + (to - from) * e)
      if (k < 1) requestAnimationFrame(step)
      else {
        document.documentElement.style.scrollBehavior = ''
        setTimeout(function () { busy = false; if (queued) { var d = queued; queued = 0; lastReq = performance.now(); page(d) } }, 120)
      }
    })(t0)
  }
  // utilisé aussi par les pastilles de la méthode (home.js) : un seul système de défilement pour toute la pagination
  window.creatigoScrollTo = function (y) { if (busy) return false; lastReq = performance.now(); queued = 0; go(y); return true }
  function page(dir) {
    var s = stops(), j = -1
    if (dir > 0) { for (var k = 0; k < s.length; k++) if (s[k] > scrollY + 4) { j = k; break } }
    else for (var m = s.length - 1; m >= 0; m--) if (s[m] < scrollY - 4) { j = m; break }
    if (j < 0) return false
    go(s[j]); return true
  }
  // un nouveau geste volontaire pendant une transition n'est pas perdu : il est mis en attente (un seul) et part à la fin de la transition,
  // mais pas s'il suit de moins de 350 ms le précédent (c'est la suite du même mouvement)
  function request(dir) {
    var now = performance.now()
    if (busy) { if (now - lastReq > 350) queued = dir; return }
    lastReq = now; page(dir)
  }
  addEventListener('wheel', function (e) {
    if (e.ctrlKey || !paged()) return
    var dl = e.deltaY; if (e.deltaMode === 1) dl *= 33; else if (e.deltaMode === 2) dl *= innerHeight   // Firefox : lignes / pages
    var dir = Math.sign(dl); if (!dir) return
    var t = performance.now(), gap = t - lastT; lastT = t
    var s = stops(), L = s[s.length - 1]
    // sous « Pourquoi » : défilement normal, sauf la remontée qui franchit son cran ou qui part d'à peine plus bas (début de la section : un cran revient dessus)
    if (scrollY > L + 4 && !(dl < 0 && (scrollY + dl <= L + 4 || scrollY - L <= innerHeight * 0.35))) return
    if (scrollY >= L - 4 && scrollY <= L + 4 && dl > 0 && !busy) { if (g.fired && g.dir === dir && gap <= 160) e.preventDefault(); return }   // fin de l'inertie du geste qui vient d'arriver ici : on l'absorbe
    e.preventDefault()
    var a = Math.abs(dl)
    // nouveau geste : pause d'au moins 160 ms, changement de sens, ou reprise d'élan (le pavé tactile qui repart alors que l'inertie du précédent dure encore)
    var fresh = gap > 160 || dir !== g.dir || (g.fired && t - lastReq > 450 && a >= 24 && a > g.min * 1.5 + 6)
    if (fresh) { g.dir = dir; g.acc = 0; g.fired = false; g.min = 1e9 }
    if (g.fired) { g.min = Math.min(g.min, a); return }   // un geste ne déclenche jamais plus d'un cran
    g.acc += dl; if (Math.abs(g.acc) < 24) return
    g.fired = true; g.min = a; request(g.acc > 0 ? 1 : -1)
  }, { passive: false })
  addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || !paged()) return
    if (e.target.closest && e.target.closest('button,a,input,textarea,select,[contenteditable]')) return
    var dn = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey), up = e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)
    if (!dn && !up) return
    var st = stops(), L = st[st.length - 1]
    if (e.repeat) { if (scrollY <= L + 4) e.preventDefault(); return }   // touche maintenue : un appui = un cran
    if (busy) { if (scrollY <= L + 4) { e.preventDefault(); request(dn ? 1 : -1) } return }
    if (page(dn ? 1 : -1)) { lastReq = performance.now(); e.preventDefault() }
  })

  var idle = 0
  function settle() {
    if (busy || !paged() || performance.now() - lastT < 300) return
    var st = stops(), L = st[st.length - 1], y = scrollY
    if (y > L + 4) return
    var best = st.reduce(function (b, v) { return Math.abs(v - y) < Math.abs(b - y) ? v : b }, st[0])
    if (Math.abs(best - y) > 4) go(best)
  }
  addEventListener('scroll', function () { clearTimeout(idle); idle = setTimeout(settle, 220) }, { passive: true })
  var ask = function () { if (!tick) { tick = true; requestAnimationFrame(frame) } }
  addEventListener('scroll', ask, { passive: true }); addEventListener('resize', ask); frame()
  // rafraîchissement : le navigateur rend un défilement à mi-cran (on voit la section d'avant) ; on recale sur le cran le plus proche
  function snap() {
    if (!paged()) return
    var st = stops(), L = st[st.length - 1], y = scrollY
    if (y > L + 4) return
    var best = st.reduce(function (b, v) { return Math.abs(v - y) < Math.abs(b - y) ? v : b }, st[0])
    if (Math.abs(best - y) > 4) { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, best); document.documentElement.style.scrollBehavior = '' }
    frame()
  }
  addEventListener('load', function () { setTimeout(snap, 120); setTimeout(snap, 700); setTimeout(snap, 1600) }); if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(snap, 60) }); addEventListener('pageshow', function (e) { if (e.persisted) snap() })
})()
