/* Animations du site : apparition en cascade, manifeste mot à mot, parallaxe des cartes d'accueil, boutons magnétiques, carrousels.
   Mouvement coupé si le visiteur le demande ; magnétisme et parallaxe seulement à la souris. */
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches

  // apparition en cascade : le retard dépend du rang parmi les frères
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (a) {
      a.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target) } })
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
    document.querySelectorAll('.card,.sv,.proj,.steps li,.ticks li,details,.recap,.head,.band,.info a,.ditem,.dcat h2,.cm a,.st4 li,.why li').forEach(function (n) {
      var sib = n.parentElement ? Array.prototype.indexOf.call(n.parentElement.children, n) : 0
      n.style.setProperty('--dl', Math.min(sib, 6) * 70 + 'ms')
      n.classList.add('rv'); io.observe(n)
    })
  }

  // manifeste : chaque mot s'allume au défilement
  var m = document.querySelector('.manif')
  if (m && !reduce) {
    m.innerHTML = m.textContent.trim().split(/\s+/).map(function (w) { return '<span>' + w + '</span>' }).join(' ')
    var words = m.querySelectorAll('span')
    var lit = function () {
      var r = m.getBoundingClientRect(), p = (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)
      var n = Math.max(0, Math.min(1, p)) * words.length
      for (var i = 0; i < words.length; i++) words[i].classList.toggle('on', i < n)
    }
    addEventListener('scroll', lit, { passive: true }); lit()
  }

  if (!reduce && fine) {
    // les cartes de l'accueil suivent doucement la souris
    var st = document.querySelector('.hero.home')
    if (st) addEventListener('pointermove', function (e) { st.style.setProperty('--px', (e.clientX / innerWidth - 0.5).toFixed(3)); st.style.setProperty('--py', (e.clientY / innerHeight - 0.5).toFixed(3)) }, { passive: true })
  }

  // carrousels : flèches, glisser à la souris, barre de progression
  document.querySelectorAll('[data-car]').forEach(function (car) {
    var tr = car.querySelector('.car-track'), bar = car.querySelector('.car-bar i')
    var prev = car.querySelector('[data-dir="-1"]'), next = car.querySelector('[data-dir="1"]')
    function upd() {
      var max = tr.scrollWidth - tr.clientWidth, f = tr.clientWidth / tr.scrollWidth
      bar.style.width = Math.max(f * 100, 12) + '%'
      bar.style.transform = 'translateX(' + (max > 0 ? (tr.scrollLeft / max) * ((1 - Math.max(f, 0.12)) / Math.max(f, 0.12)) * 100 : 0) + '%)'
      prev.disabled = tr.scrollLeft < 4; next.disabled = tr.scrollLeft > max - 4
    }
    tr.addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd()
    car.querySelectorAll('.cb').forEach(function (b) {
      b.addEventListener('click', function () { tr.scrollBy({ left: +b.dataset.dir * Math.min(tr.clientWidth * 0.8, 420), behavior: reduce ? 'auto' : 'smooth' }) })
    })
    var down = false, x0 = 0, s0 = 0, moved = false
    tr.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; moved = false; x0 = e.clientX; s0 = tr.scrollLeft })
    addEventListener('pointermove', function (e) {
      if (!down) return
      var dx = e.clientX - x0
      if (!moved && Math.abs(dx) > 5) { moved = true; tr.classList.add('drag') }
      if (moved) tr.scrollLeft = s0 - dx
    })
    addEventListener('pointerup', function () { if (!down) return; down = false; if (moved) setTimeout(function () { tr.classList.remove('drag') }, 0) })
  })

})()

// ---- pages « Nos services » et « Nos réalisations » : les cartes entrent en cascade, leur forme glisse vers son ancrage ; parallaxe douce au survol ----
;(function () {
  var cards = [].slice.call(document.querySelectorAll('.ns-c, .nr-c')) // cartes des pages « Nos services » et « Nos réalisations »
  if (!cards.length) return
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (calm || !('IntersectionObserver' in window)) { cards.forEach(function (c) { c.classList.add('ns-in', 'ns-done') }); return }
  var io = new IntersectionObserver(function (es) {
    es.filter(function (e) { return e.isIntersecting }).forEach(function (e, k) {
      var c = e.target
      c.style.setProperty('--dl', k * 90 + 'ms'); c.classList.add('ns-in'); io.unobserve(c)
      setTimeout(function () { c.classList.add('ns-done') }, k * 90 + 1600)
    })
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' })
  cards.forEach(function (c) { io.observe(c) })
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) cards.forEach(function (c) {
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect()
      c.style.setProperty('--rx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3)); c.style.setProperty('--ry', ((e.clientY - r.top) / r.height - 0.5).toFixed(3))
    }, { passive: true })
    c.addEventListener('pointerleave', function () { c.style.setProperty('--rx', 0); c.style.setProperty('--ry', 0) })
  })
})()

// ---- page « Nos services » : chaque planche (640 × 460 px) est mise à l'échelle d'un bloc selon la largeur de sa carte ----
;(function () {
  var stages = [].slice.call(document.querySelectorAll('.ns-stage'))
  if (!stages.length) return
  function fit(s) { var w = s.clientWidth; if (w) s.firstElementChild.style.setProperty('--s', (w / 640).toFixed(4)) }
  function all() { stages.forEach(fit) }
  if ('ResizeObserver' in window) { var ro = new ResizeObserver(function (es) { es.forEach(function (e) { fit(e.target) }) }); stages.forEach(function (s) { ro.observe(s) }) }
  else addEventListener('resize', all)
  all()
})()

// ---- pages de sous-services : les illustrations (plaques) et les cartes entrent en cascade ; parallaxe douce au mouvement de la souris ----
;(function () {
  var plates = [].slice.call(document.querySelectorAll('.ss-plate, .sp-st')), cards = [].slice.call(document.querySelectorAll('.ss-card'))
  if (!plates.length) return
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches
  var items = plates.concat(cards)
  if (calm || !('IntersectionObserver' in window)) { items.forEach(function (e) { e.classList.add('ss-in', 'ss-done') }); return }
  var io = new IntersectionObserver(function (es) {
    es.filter(function (e) { return e.isIntersecting }).forEach(function (e, k) {
      var el = e.target
      el.style.setProperty('--dl', k * 110 + 'ms'); el.classList.add('ss-in'); io.unobserve(el)
      setTimeout(function () { el.classList.add('ss-done') }, k * 110 + 1700)
    })
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' })
  items.forEach(function (e) { io.observe(e) })
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var zones = [].slice.call(document.querySelectorAll('.ss-hg, .ss-ig, .ss-bento')).concat(cards)
    zones.forEach(function (z) {
      z.addEventListener('pointermove', function (e) {
        var r = z.getBoundingClientRect()
        z.style.setProperty('--rx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3)); z.style.setProperty('--ry', ((e.clientY - r.top) / r.height - 0.5).toFixed(3))
      }, { passive: true })
      z.addEventListener('pointerleave', function () { z.style.setProperty('--rx', 0); z.style.setProperty('--ry', 0) })
    })
  }
})()

// pages de services : chaque planche (640 × 460) est mise à l'échelle de son cadre
;(function () {
  var st = [].slice.call(document.querySelectorAll('.sp-st')); if (!st.length) return
  function fit() { st.forEach(function (s) { var w = s.clientWidth, h = s.clientHeight; if (w && h) s.style.setProperty('--s', Math.min(w / 640, h / 460).toFixed(4)) }) }
  fit(); addEventListener('resize', fit); addEventListener('load', fit)
  if ('ResizeObserver' in window) st.forEach(function (s) { new ResizeObserver(fit).observe(s) })
})()
