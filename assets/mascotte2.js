/* Mascotte de « Nos services » : pupilles qui suivent la souris, clic = elle a mal (tache rouge), bulle qui commente le service affiché. */
;(function () {
  var wrap = document.querySelector('.sv-m'); if (!wrap) return
  var m = wrap.querySelector('.mascot'), eyes = m.querySelector('.m-eyes'), ps = [].slice.call(m.querySelectorAll('.m-p'))
  var bub = wrap.querySelector('.mbub'), txt = bub.querySelector('.mbt'), timers = [], last = 0
  var R = 0.03, tgt = null, run = false, cx = [0, 0], cy = [0, 0]
  function aim(x, y) { tgt = [x, y]; if (!run) { run = true; requestAnimationFrame(tick) } }
  function tick() {
    var r = eyes.getBoundingClientRect(), w = r.width, done = true
    ps.forEach(function (p, i) {
      var ex = r.left + parseFloat(p.style.left) / 100 * w, ey = r.top + parseFloat(p.style.top) / 100 * r.height
      var dx = (tgt ? tgt[0] : innerWidth / 2) - ex, dy = (tgt ? tgt[1] : innerHeight / 2) - ey
      var d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / (w * 0.9)) * R * w
      var tx = dx / d * k, ty = dy / d * k * 0.9
      cx[i] += (tx - cx[i]) * 0.3; cy[i] += (ty - cy[i]) * 0.3
      if (Math.abs(tx - cx[i]) > 0.15 || Math.abs(ty - cy[i]) > 0.15) done = false
      p.style.transform = 'translate(' + cx[i].toFixed(2) + 'px,' + cy[i].toFixed(2) + 'px)'
    })
    if (done) run = false; else requestAnimationFrame(tick)
  }
  addEventListener('pointermove', function (e) { aim(e.clientX, e.clientY) }, { passive: true })
  addEventListener('scroll', function () { if (tgt) aim(tgt[0], tgt[1]) }, { passive: true })
  addEventListener('resize', function () { aim(tgt ? tgt[0] : innerWidth / 2, tgt ? tgt[1] : innerHeight / 2) })
  aim(innerWidth * 0.5, innerHeight * 0.5)

  function clear() { timers.forEach(clearTimeout); timers = [] }
  function at(ms, f) { timers.push(setTimeout(f, ms)) }
  function visible() { var r = m.getBoundingClientRect(); return r.bottom > 60 && r.top < innerHeight - 60 && getComputedStyle(wrap).display !== 'none' }
  function say(text, hold, instant) {
    clear(); last = Date.now()
    if (instant) { txt.textContent = text; bub.classList.remove('typing'); bub.classList.add('on'); at(hold || 1800, function () { bub.classList.remove('on') }); return }
    bub.classList.add('on', 'typing'); txt.textContent = ''
    at(450, function () { txt.textContent = text; bub.classList.remove('typing'); m.classList.add('talk'); at(600, function () { m.classList.remove('talk') }) })
    at(450 + (hold || 3600), function () { bub.classList.remove('on') })
  }
  var L = ['Un site qui vous amène des clients.', 'On anime votre communauté sur les réseaux.', 'Premier sur Google, sans payer à chaque clic.', 'Des annonces payées au résultat.', 'Cité par ChatGPT, Gemini et Perplexity.', 'Vidéos, e-mails, flyers : votre marque en images.', 'Web et mobile, sur mesure.']
  var btns = [].slice.call(document.querySelectorAll('#services .sx-nav button, #services .sv3-nav button'))
  btns.forEach(function (b, i) {
    new MutationObserver(function () { if (b.classList.contains('on') && visible() && Date.now() - last > 1500) say(L[i], 3200) }).observe(b, { attributes: true, attributeFilter: ['class'] })
  })
  var OUCH = ['Aïe !', 'Aïe, ça fait mal !', 'Ouille !', 'Hé, doucement !'], hits = [], oi = 0, hurtT = 0
  m.addEventListener('click', function (e) {
    if (window.mascotteZone && window.mascotteZone(m, e)) return // yeux et bouche : un clic n'y compte pas
    var r = m.getBoundingClientRect(), now = Date.now()
    m.style.setProperty('--hx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%')
    m.style.setProperty('--hy', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%')
    function rd(a, b) { return a + Math.random() * (b - a) }
    var P = function (v) { return v.toFixed(1) + '%' }, w1 = rd(7.5, 11)
    m.style.setProperty('--w1', P(w1)); m.style.setProperty('--h1', P(w1 * rd(.55, .9)))
    m.style.setProperty('--w2', P(rd(5, 8))); m.style.setProperty('--h2', P(rd(3.6, 6)))
    m.style.setProperty('--x2', P(rd(-6, 6))); m.style.setProperty('--y2', P(rd(-6, 6)))
    m.style.setProperty('--w3', P(rd(4, 6.5))); m.style.setProperty('--h3', P(rd(3, 5)))
    m.style.setProperty('--x3', P(rd(-7, 7))); m.style.setProperty('--y3', P(rd(-6, 7)))
    m.classList.remove('hurt'); void m.offsetWidth; m.classList.add('hurt')
    clearTimeout(hurtT); hurtT = setTimeout(function () { m.classList.remove('hurt') }, 950)
    hits = hits.filter(function (t) { return now - t < 2500 }); hits.push(now)
    say(hits.length >= 3 ? 'Aïe aïe aïe ! Arrêtez !' : OUCH[oi++ % OUCH.length], 1800, true)
  })
  // à l'arrivée sur la section : un petit bonjour
  if ('IntersectionObserver' in window) {
    var once = false
    new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !once) { once = true; setTimeout(function () { if (visible()) say('Tout pour être visible : je vous guide !', 3600) }, 900) } }) }, { threshold: 0.4 }).observe(document.querySelector('#services'))
  }
})()
