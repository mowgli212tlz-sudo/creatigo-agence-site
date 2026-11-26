// Pages de services : projets qui tournent seuls, frise « comment on le construit » (aucune dépendance)
(function () {
  var reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // « Ce qu'on a construit » : un projet à la fois, rotation automatique, pause au survol, clic pour choisir
  document.querySelectorAll('[data-bt]').forEach(function (bt) {
    var tabs = [].slice.call(bt.querySelectorAll('.bt-tab')), slides = [].slice.call(bt.querySelectorAll('.bt-s'))
    var cur = 0, timer = null, vu = false, pause = false
    function go(i) {
      cur = (i + slides.length) % slides.length
      tabs.forEach(function (t, k) { t.classList.toggle('on', k === cur); t.setAttribute('aria-selected', k === cur ? 'true' : 'false') })
      slides.forEach(function (s, k) { s.classList.toggle('on', k === cur) })
      bt.style.setProperty('--cur', cur)
      var imgs = slides[cur].querySelectorAll('.shotwin img')
      if (imgs.length > 1) cycle(imgs)
    }
    function cycle(imgs) { var j = 0; imgs.forEach(function (im, k) { im.classList.toggle('on', k === 0) }); clearInterval(bt._c); bt._c = setInterval(function () { j = (j + 1) % imgs.length; imgs.forEach(function (im, k) { im.classList.toggle('on', k === j) }) }, 2200) }
    function start() { stop(); if (reduit || !vu || pause) return; timer = setInterval(function () { go(cur + 1) }, 6000) }
    function stop() { clearInterval(timer) }
    tabs.forEach(function (t, k) { t.addEventListener('click', function () { go(k); start() }) })
    bt.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { pause = true; stop() } })
    bt.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { pause = false; start() } })
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { vu = e[0].isIntersecting; start() }, { threshold: .25 }).observe(bt); else { vu = true; start() }
    go(0)
  })
  // « Comment on le construit » : l'étape allumée est celle qui se trouve réellement au centre de l'écran (ou sous la souris) ; la liste de gauche suit
  document.querySelectorAll('[data-pr]').forEach(function (pr) {
    var sec = pr.closest('.pr-sec'), lis = [].slice.call(sec.querySelectorAll('.pr-ol li')), sts = [].slice.call(pr.querySelectorAll('.pr-st'))
    var survol = -1, actif = -1, attente = false
    function allume(i) {
      if (i === actif) return
      actif = i
      sts.forEach(function (s, k) { s.classList.toggle('on', k === i); s.classList.toggle('vu', k < i) })
      lis.forEach(function (l, k) { l.classList.toggle('on', k <= i); l.classList.toggle('cur', k === i) })
    }
    function calcule() {
      attente = false
      var rs = sec.getBoundingClientRect()
      if (rs.bottom < 0 || rs.top > innerHeight) return
      if (survol >= 0) { allume(survol); return }
      var mid = innerHeight * 0.46, meilleur = 0, d0 = 1e9
      sts.forEach(function (s, i) {
        var r = s.getBoundingClientRect(), d = mid >= r.top && mid <= r.bottom ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid))
        if (d < d0) { d0 = d; meilleur = i }
      })
      allume(meilleur)
    }
    function planifie() { if (!attente) { attente = true; requestAnimationFrame(calcule) } }
    addEventListener('scroll', planifie, { passive: true }); addEventListener('resize', planifie)
    sts.forEach(function (s, i) {
      s.addEventListener('pointerenter', function () { survol = i; allume(i) })
      s.addEventListener('pointerleave', function () { survol = -1; planifie() })
    })
    lis.forEach(function (l, i) {
      l.setAttribute('tabindex', '0'); l.style.cursor = 'pointer'
      var va = function () { sts[i].scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'center' }) }
      l.addEventListener('click', va); l.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); va() } })
    })
    calcule()
  })
  // « Nos réalisations » : filtres par type de projet
  document.querySelectorAll('[data-rl]').forEach(function (g) {
    var btns = [].slice.call(document.querySelectorAll('[data-rlf]')), cards = [].slice.call(g.querySelectorAll('.rl-c'))
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var c = b.getAttribute('data-rlf')
        btns.forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false') })
        cards.forEach(function (k) { k.hidden = !(c === 'Tous' || k.getAttribute('data-cat') === c) })
      })
    })
  })
  // Blog : filtres par thème
  document.querySelectorAll('[data-bl]').forEach(function (g) {
    var btns = [].slice.call(document.querySelectorAll('[data-blf]')), cards = [].slice.call(g.querySelectorAll('.bg-c'))
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var c = b.getAttribute('data-blf')
        btns.forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false') })
        cards.forEach(function (k) { k.hidden = !(c === 'Tous' || k.getAttribute('data-cat') === c) })
      })
    })
  })
  // Mur de projets : l'animation ne tourne que lorsqu'il est à l'écran (économise le processeur)
  document.querySelectorAll('.wl-rows').forEach(function (w) {
    if (!('IntersectionObserver' in window)) { w.classList.add('run'); return }
    new IntersectionObserver(function (e) { w.classList.toggle('run', e[0].isIntersecting) }, { rootMargin: '120px' }).observe(w)
  })
  // Cartes des services : la maquette (520 x 300) est mise à l'échelle de sa zone ; ses animations ne tournent que si la section est visible
  var cases = document.querySelectorAll('.sg-v')
  function ajuste(v) { var m = v.querySelector('.sg-m'); if (!m) return; var k = Math.min(v.clientWidth * 0.96 / 520, v.clientHeight * 0.94 / 300); v.style.setProperty('--k', k.toFixed(3)) }
  if (cases.length) {
    if ('ResizeObserver' in window) { var ro = new ResizeObserver(function (es) { es.forEach(function (e) { ajuste(e.target) }) }); cases.forEach(function (v) { ro.observe(v) }) } else cases.forEach(ajuste)
    var sg = document.querySelector('.sg-sec')
    if (sg && 'IntersectionObserver' in window) new IntersectionObserver(function (e) { sg.classList.toggle('vis', e[0].isIntersecting) }, { rootMargin: '80px' }).observe(sg); else if (sg) sg.classList.add('vis')
  }
  // Mur de projets : un clic sur une image l'affiche en grand (fenêtre modale : Échap ou clic à côté pour fermer, flèches pour passer à la suivante)
  var mur = document.querySelector('.wl-rows')
  if (mur) {
    var liste = [].slice.call(mur.querySelectorAll('.wl-set:not([aria-hidden]) .wl-c')).filter(function (b, i, a) { return a.findIndex(function (x) { return x.getAttribute('data-n') === b.getAttribute('data-n') }) === i })
    var box = null, cur = 0, retour = null
    var ouvre = function (i) {
      if (!box) {
        box = document.createElement('div'); box.className = 'lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Aperçu en grand'); box.hidden = true
        box.innerHTML = '<div class="lb-in"><button type="button" class="lb-x" aria-label="Fermer">×</button><button type="button" class="lb-n lb-p" aria-label="Image précédente">‹</button><figure><img alt=""><figcaption></figcaption></figure><button type="button" class="lb-n lb-s" aria-label="Image suivante">›</button></div>'
        document.body.appendChild(box)
        box.addEventListener('click', function (e) { if (e.target === box || e.target.classList.contains('lb-in')) ferme() })
        box.querySelector('.lb-x').addEventListener('click', ferme)
        box.querySelector('.lb-p').addEventListener('click', function () { montre(cur - 1) })
        box.querySelector('.lb-s').addEventListener('click', function () { montre(cur + 1) })
      }
      retour = document.activeElement; montre(i); box.hidden = false; document.documentElement.classList.add('lb-ouvert'); box.querySelector('.lb-x').focus()
    }
    var montre = function (i) {
      cur = (i + liste.length) % liste.length
      var b = liste[cur], img = b.querySelector('img'), g = box.querySelector('img')
      g.src = img.currentSrc || img.src; g.alt = b.getAttribute('data-t') || ''; box.querySelector('figcaption').textContent = (b.getAttribute('data-t') || '') + '  ·  ' + (cur + 1) + ' / ' + liste.length
    }
    var ferme = function () { if (!box || box.hidden) return; box.hidden = true; document.documentElement.classList.remove('lb-ouvert'); if (retour && retour.focus) retour.focus() }
    mur.addEventListener('click', function (e) {
      var b = e.target.closest('.wl-c'); if (!b) return
      var i = liste.findIndex(function (x) { return x.getAttribute('data-n') === b.getAttribute('data-n') }); ouvre(Math.max(i, 0))
    })
    document.addEventListener('keydown', function (e) {
      if (!box || box.hidden) return
      if (e.key === 'Escape') ferme(); else if (e.key === 'ArrowRight') montre(cur + 1); else if (e.key === 'ArrowLeft') montre(cur - 1)
    })
  }
})()
