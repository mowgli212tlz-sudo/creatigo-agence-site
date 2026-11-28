/* Accueil : services (onglets qui défilent seuls), méthode (pipeline qui avance), pourquoi (sans / avec Creatigo).
   Les défilements automatiques s'arrêtent dès que le visiteur clique, se mettent en pause au survol et hors écran,
   et ne démarrent pas si le visiteur a réduit les animations. */
// barre de navigation : passe en verre sombre tant qu'elle survole la section « Nos services » (bleu nuit)
;(function () {
  // aussi sur « Ce que vous gagnez » (#pourquoi), sombre elle aussi
  var h = document.querySelector('header'), ss = [].slice.call(document.querySelectorAll('#services, #pourquoi'))
  if (!h || !ss.length || !('IntersectionObserver' in window)) return
  var vu = new Set()
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? vu.add(e.target) : vu.delete(e.target) }); h.classList.toggle('nuit', vu.size > 0) }, { rootMargin: '0px 0px -92% 0px' })
  ss.forEach(function (x) { io.observe(x) })
})()
;(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  var $ = function (s, r) { return (r || document).querySelector(s) }
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)) }

  // minuteur : appelle next() toutes les `dur` ms, en pause si on survole ou si le bloc est hors écran
  function loop(root, dur, onTick, next) {
    var el = 0, held = false, vis = true, auto = !reduce, id = 0
    root.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') held = true })
    root.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') held = false })
    root.addEventListener('focusin', function () { held = true })
    root.addEventListener('focusout', function () { held = false })
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { vis = e[0].isIntersecting }, { threshold: 0.25 }).observe(root)
    if (auto) id = setInterval(function () {
      if (!auto || held || !vis || document.hidden) return
      el += 80; onTick(Math.min(el / dur, 1))
      if (el >= dur) { el = 0; next() }
    }, 80)
    return { reset: function () { el = 0; onTick(0) }, stop: function () { auto = false; clearInterval(id); onTick(0) } }
  }

  // ---- services ----
  var sv = $('[data-sv]')
  if (sv) {
    var tabs = $$('.sx-nav button', sv), svPanes = $$('.sx-p', sv), cur = 0
    var show = function (i) {
      cur = i
      tabs.forEach(function (t, k) { t.classList.toggle('on', k === i); t.setAttribute('aria-selected', k === i); $('.bar i', t).style.transform = 'scaleX(0)' })
      svPanes.forEach(function (p, k) { p.classList.toggle('on', k === i) })
    }
    var lp = loop(sv, 7000, function (f) { $('.bar i', tabs[cur]).style.transform = 'scaleX(' + f + ')' }, function () { show((cur + 1) % tabs.length) })
    tabs.forEach(function (t, i) { t.addEventListener('click', function () { lp.stop(); show(i) }) })
  }

  // ---- méthode : trajectoire liée au scroll ----
  var mp = $('[data-mp]')
  if (mp) {
    var stage = $('.mp-stage', mp), svg = $('.mp-path', mp), base = $('.base', svg), fill = $('.fill', svg), pilot = $('.pilot', svg)
    var nodes = $$('.mp-n', mp), panes = $$('.mp-s', mp), N = nodes.length, W = 0, H = 150, len = 1, pts = [], idx = -1, TOP = 84
    var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)) }
    // téléphone et tablette : les 4 étapes s'empilent (pas de scène épinglée ni de frise qui recouvre le texte)
    if (reduce || matchMedia('(max-width: 980px)').matches) { mp.classList.add('static'); panes.forEach(function (p) { p.classList.add('on') }) }
    else {
      var build = function () {
        W = svg.clientWidth || 600
        // la hauteur du tracé suit celle de la bande (elle change selon l'écran) : sinon le SVG est réduit et décalé et la ligne ne rejoint plus les pastilles
        H = svg.clientHeight || 150
        var k = W / 1200, X = function (v) { return (v * k).toFixed(1) }, Y = function (v) { return (v * H / 150).toFixed(1) }
        var d = 'M ' + X(20) + ' ' + Y(85) + ' C ' + X(140) + ' ' + Y(5) + ' ' + X(250) + ' ' + Y(5) + ' ' + X(340) + ' ' + Y(70) + ' S ' + X(520) + ' ' + Y(140) + ' ' + X(640) + ' ' + Y(78) + ' S ' + X(860) + ' ' + Y(8) + ' ' + X(960) + ' ' + Y(62) + ' S ' + X(1130) + ' ' + Y(116) + ' ' + X(1180) + ' ' + Y(66)
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); base.setAttribute('d', d); fill.setAttribute('d', d)
        len = fill.getTotalLength(); fill.style.strokeDasharray = len
        pts = nodes.map(function (n, i) { return fill.getPointAtLength(len * i / (N - 1)) })
        nodes.forEach(function (n, i) { n.style.left = (pts[i].x / W * 100) + '%'; n.style.top = (pts[i].y / H * 100) + '%' })
        mp.style.height = (stage.offsetHeight + (N - 1) * Math.max(innerHeight * 0.5, 320) + TOP) + 'px'
        update()
      }
      var update = function () {
        var r = mp.getBoundingClientRect(), total = Math.max(1, r.height - stage.offsetHeight - TOP)
        var p = clamp(-r.top / total / 0.9, 0, 1) // le pilote arrive au bout à 90 % du défilement : la dernière étape reste affichée un moment
        fill.style.strokeDashoffset = len * (1 - p)
        var pt = fill.getPointAtLength(len * p); pilot.setAttribute('cx', pt.x); pilot.setAttribute('cy', pt.y)
        var i = clamp(Math.floor(p * (N - 1) + 0.001), 0, N - 1) // une étape s'ouvre quand le pilote atteint sa station
        nodes.forEach(function (n, k) { n.classList.toggle('done', p >= k / (N - 1) - 0.001); n.classList.toggle('on', k === i) })
        if (i !== idx) { idx = i; panes.forEach(function (s, k) { s.classList.toggle('on', k === i) }) }
      }
      nodes.forEach(function (n, i) {
        n.addEventListener('click', function () {
          var r = mp.getBoundingClientRect(), total = Math.max(1, r.height - stage.offsetHeight - TOP)
          var cible = r.top + scrollY + total * 0.9 * (i / (N - 1)) + 3
          // sur grand écran la pagination de scenes.js gère le défilement (verrou commun, aucun conflit avec la molette)
          if (window.creatigoScrollTo && matchMedia('(min-width: 900px)').matches) { window.creatigoScrollTo(cible); return }
          scrollTo({ top: cible, behavior: 'smooth' })
        })
      })
      var tick = 0
      addEventListener('scroll', function () { if (!tick) tick = requestAnimationFrame(function () { tick = 0; update() }) }, { passive: true })
      addEventListener('resize', build)
      if (matchMedia('(hover: hover) and (pointer: fine)').matches) stage.addEventListener('pointermove', function (e) {
        var r = stage.getBoundingClientRect()
        stage.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3)); stage.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3))
      }, { passive: true })
      build()
    }
  }

  // ---- pourquoi : sans / avec ----
  var pw = $('[data-pw]')
  if (pw) {
    var sw = $('.pw-sw'), bs = $$('button', sw), cards = $$('.pw-c', pw), mode = 'avec', touched = false, root = pw.closest('.pw') || pw
    var paint = function (m) {
      cards.forEach(function (c) { $('h3', c).textContent = c.dataset[m + 'T']; $('p', c).textContent = c.dataset[m + 'D'] })
      root.classList.toggle('sans', m === 'sans')
    }
    var apply = function (m, animate) {
      if (animate && m === mode) return
      mode = m; sw.dataset.m = m
      bs.forEach(function (b) { var on = b.dataset.m === m; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1 })
      pw.setAttribute('aria-labelledby', 'pwt-' + m)
      if (!animate || reduce) { paint(m); return }
      cards.forEach(function (c, i) {
        setTimeout(function () { c.classList.remove('flip'); void c.offsetWidth; c.classList.add('flip') }, i * 60)
        setTimeout(function () { $('h3', c).textContent = c.dataset[m + 'T']; $('p', c).textContent = c.dataset[m + 'D']; root.classList.toggle('sans', m === 'sans') }, i * 60 + 230)
        setTimeout(function () { c.classList.remove('flip') }, i * 60 + 560)
      })
    }
    bs.forEach(function (b) { b.addEventListener('click', function () { touched = true; apply(b.dataset.m, true) }) })
    sw.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault(); touched = true
      var m = e.key === 'ArrowLeft' ? 'sans' : 'avec'; apply(m, true); $('.pw-sw button[data-m="' + m + '"]').focus()
    })
    // apparition en cascade ; à l'arrivée à l'écran on montre d'abord « sans », puis le passage à « avec »
    if ('IntersectionObserver' in window && !reduce) {
      apply('sans', false)
      cards.forEach(function (c) { c.classList.add('hid') })
      new IntersectionObserver(function (e, o) {
        if (!e[0].isIntersecting) return
        o.disconnect()
        cards.forEach(function (c, i) { setTimeout(function () { c.classList.remove('hid') }, i * 80) })
        setTimeout(function () { if (!touched) apply('avec', true) }, 1900)
      }, { threshold: 0.3 }).observe(pw)
    }
  }
})()

// ---- services : projecteur qui suit la souris sur l'aperçu, navigation au clavier entre les onglets ----
// (s'ajoute au code ci-dessus sans le modifier : les touches déclenchent un clic, donc l'ancien comportement s'applique)
;(function () {
  var sv = document.querySelector('[data-sv]')
  if (!sv) return
  var view = sv.querySelector('.sx-view'), tabs = [].slice.call(sv.querySelectorAll('.sx-nav button'))
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) view.addEventListener('pointermove', function (e) {
    var r = view.getBoundingClientRect()
    view.style.setProperty('--mx', (e.clientX - r.left) + 'px'); view.style.setProperty('--my', (e.clientY - r.top) + 'px')
  }, { passive: true })
  // chorégraphie : les onglets entrent en cascade et l'illustration active glisse vers sa place quand la section arrive à l'écran
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches
  tabs.forEach(function (t, i) { t.style.setProperty('--i', i) })
  if ('IntersectionObserver' in window && !still) {
    new IntersectionObserver(function (e, o) {
      if (!e[0].isIntersecting) return
      o.disconnect(); sv.classList.add('sv-in', 'sx-in')
      setTimeout(function () { sv.classList.add('sv-done') }, 1600)
    }, { threshold: 0.25 }).observe(sv)
  } else sv.classList.add('sv-in', 'sx-in', 'sv-done')
  // parallaxe légère : l'illustration suit un peu la souris (transform seulement), retour en douceur à la sortie
  if (!still && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    view.addEventListener('pointermove', function (e) {
      var r = view.getBoundingClientRect()
      view.style.setProperty('--rx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3)); view.style.setProperty('--ry', ((e.clientY - r.top) / r.height - 0.5).toFixed(3))
    }, { passive: true })
    view.addEventListener('pointerleave', function () { view.style.setProperty('--rx', 0); view.style.setProperty('--ry', 0) })
  }
  // mobile : la liste d'onglets défile sur le côté, l'onglet actif doit toujours rester visible
  var list = sv.querySelector('.sx-nav'), calm = matchMedia('(prefers-reduced-motion: reduce)').matches
  tabs.forEach(function (t) {
    new MutationObserver(function () {
      if (!t.classList.contains('on') || list.scrollWidth <= list.clientWidth + 2 || list.scrollHeight > list.clientHeight + 40) return
      var x = t.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft
      list.scrollTo({ left: x - (list.clientWidth - t.offsetWidth) / 2, behavior: calm ? 'auto' : 'smooth' })
    }).observe(t, { attributes: true, attributeFilter: ['class'] })
  })
  sv.querySelector('.sx-nav').addEventListener('keydown', function (e) {
    var i = tabs.indexOf(document.activeElement), k = e.key
    if (i < 0) return
    var n = k === 'ArrowDown' || k === 'ArrowRight' ? (i + 1) % tabs.length : k === 'ArrowUp' || k === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : k === 'Home' ? 0 : k === 'End' ? tabs.length - 1 : -1
    if (n < 0) return
    e.preventDefault(); tabs[n].focus(); tabs[n].click()
  })
})()

// pourquoi : inclinaison 3D des cartes à la souris (souris uniquement, pas en mouvement réduit)
;(function () {
  var g = document.querySelector('[data-pw]')
  if (!g || matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover: hover) and (pointer: fine)').matches) return
  g.querySelectorAll('.pw-c').forEach(function (c) {
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
      c.style.transition = 'transform .09s linear, box-shadow .5s'
      c.style.transform = 'perspective(900px) rotateX(' + (-y * 14).toFixed(2) + 'deg) rotateY(' + (x * 14).toFixed(2) + 'deg) scale(1.04)'
    })
    c.addEventListener('pointerleave', function () { c.style.transition = ''; c.style.transform = '' })
  })
})()


// services : chaque plateau (640 × 460 px) est mis à l'échelle d'un bloc selon la largeur disponible ; la souris le décale très légèrement
;(function () {
  var sv = document.querySelector('[data-sv]'); if (!sv) return
  var stages = [].slice.call(sv.querySelectorAll('.sx-stage'))
  // même échelle pour tous les panneaux, y compris ceux encore masqués : sinon elle change en plein milieu de leur entrée.
  // Deux garde-fous pour que l'image ne soit jamais coupée par le bord de l'écran : sur grand écran peu haut elle ne descend pas sous le bas de l'écran,
  // et le plateau « Marketing » (cartes qui débordent de 30 px de chaque côté de sa zone de 640 px) est légèrement réduit.
  var sec = sv.closest('#services') || sv
  function pos(el) { var x = 0, y = 0, e = el; while (e && e !== sec) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent } return e ? { x: x, y: y } : null }
  function fit() {
    var ref = null; stages.forEach(function (s) { if (!ref && s.clientWidth) ref = s }); if (!ref) return
    var w = ref.clientWidth, wide = innerWidth > 980, k0 = w / 640 * (wide ? 1.1 : 1), kv = 9, p = pos(ref)
    if (wide && p) kv = (innerHeight - 14 - (p.y + ref.offsetHeight / 2)) / (236 * 1.14 * 1.05)   // plateau incliné et agrandi (×1.14) : demi-hauteur utile 236 px
    stages.forEach(function (st) {
      var art = st.firstElementChild, mk = art.classList.contains('k-marketing'), k = Math.min(k0, Math.max(kv, 0.55))
      if (mk) k *= 0.9
      if (wide && p) { var half = (mk ? 350 : 330) * 1.14, room = Math.min(p.x + ref.offsetWidth / 2, innerWidth - (p.x + ref.offsetWidth / 2)) - 6; if (room > 0) k = Math.min(k, Math.max(room / half, 0.55)) }
      art.style.setProperty('--s', k.toFixed(4))
    })
  }
  fit(); addEventListener('resize', fit)
  if ('ResizeObserver' in window) stages.forEach(function (s) { new ResizeObserver(fit).observe(s) })
  var view = sv.querySelector('.sx-view')
  if (view && matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    view.addEventListener('pointermove', function (e) { var r = view.getBoundingClientRect(); view.style.setProperty('--rx', ((e.clientX - r.left) / r.width - .5).toFixed(3)); view.style.setProperty('--ry', ((e.clientY - r.top) / r.height - .5).toFixed(3)) }, { passive: true })
    view.addEventListener('pointerleave', function () { view.style.setProperty('--rx', 0); view.style.setProperty('--ry', 0) })
  }
})()

// services : l'exemple (plateau 3D) est centré en hauteur sur la liste de gauche
;(function () {
  var sv = document.querySelector('[data-sv]'); if (!sv) return
  var nav = sv.querySelector('.sx-nav'), view = sv.querySelector('.sx-view')
  function align() {
    if (innerWidth <= 980) { view.style.removeProperty('--dy'); return }
    var art = sv.querySelector('.sx-p.on .y-art'); if (!art) return
    view.style.setProperty('--dy', '0px')
    var a = art.getBoundingClientRect(), n = nav.getBoundingClientRect()
    if (a.height) view.style.setProperty('--dy', Math.round((n.top + n.height / 2) - (a.top + a.height / 2)) + 'px')
  }
  setTimeout(align, 400); addEventListener('resize', function () { setTimeout(align, 120) })
})()

// services : la liste garde la même hauteur quel que soit le service ouvert (sinon le bas du bloc monte et descend d'un onglet à l'autre)
;(function () {
  var sv = document.querySelector('[data-sv]'); if (!sv) return
  var nav = sv.querySelector('.sx-nav'), bodies = [].slice.call(sv.querySelectorAll('.sx-acc > div'))
  if (!nav || !bodies.length) return
  function lock() { var h = 0; nav.style.removeProperty('--acc-h'); bodies.forEach(function (b) { h = Math.max(h, b.scrollHeight) }); if (h) nav.style.setProperty('--acc-h', h + 'px') }   // mesure sans l'ancienne valeur : la hauteur peut aussi diminuer
  lock(); addEventListener('resize', lock); addEventListener('load', lock)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(lock)
})()

// méthode : le plateau dessiné (560 × 400) est mis à l'échelle pour remplir le cadre
;(function () {
  var arts = [].slice.call(document.querySelectorAll('.mp-art')); if (!arts.length) return
  function fit() { arts.forEach(function (a) { var w = a.clientWidth, h = a.clientHeight; if (w && h) a.style.setProperty('--k', Math.min(w / 560, h / 400).toFixed(4)) }) }
  fit(); addEventListener('resize', fit)
  if ('ResizeObserver' in window) arts.forEach(function (a) { new ResizeObserver(fit).observe(a) })
})()

// méthode : tracé en dégradé avec halo, comète à traînée et onde d'arrivée aux stations (n'ajoute aucun élément à la mise en page)
;(function () {
  var mp = document.querySelector('[data-mp]'); if (!mp || mp.classList.contains('static')) return
  var svg = mp.querySelector('.mp-path'), band = mp.querySelector('.mp-band'), fill = svg && svg.querySelector('.fill'), pilot = svg && svg.querySelector('.pilot')
  var nodes = [].slice.call(mp.querySelectorAll('.mp-n')); if (!fill || !pilot) return
  var NS = 'http://www.w3.org/2000/svg'
  function el(n, c, p) { var e = document.createElementNS(NS, n); if (c) e.setAttribute('class', c); for (var k in (p || {})) e.setAttribute(k, p[k]); return e }
  var defs = el('defs'), g = el('linearGradient', '', { id: 'mpg', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 1000, y2: 0 })
  ;[[0, '#6fb0ff'], [.5, '#0a5cff'], [1, '#2a3ff0']].forEach(function (s) { g.appendChild(el('stop', '', { offset: s[0], 'stop-color': s[1] })) })
  defs.appendChild(g); svg.insertBefore(defs, svg.firstChild)
  var glow = el('path', 'glow'), halo = el('circle', 'halo', { r: 17 })
  svg.insertBefore(glow, fill)
  var trail = [0, 1, 2, 3].map(function (i) { var c = el('circle', 'trail', { r: 6.5 - i * 1.2 }); c.style.opacity = (.32 - i * .07).toFixed(2); svg.insertBefore(c, pilot); return c })
  svg.insertBefore(halo, pilot)
  nodes.forEach(function (n) { var was = n.classList.contains('on'); new MutationObserver(function () { var now = n.classList.contains('on'); if (now && !was) { n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop') } was = now }).observe(n, { attributes: true, attributeFilter: ['class'] }) })
  var d0 = '', live = false, raf = 0
  function frame() {
    var len = fill.getTotalLength(), off = parseFloat(fill.style.strokeDashoffset) || 0, p = Math.max(0, Math.min(1, 1 - off / len)), d = fill.getAttribute('d')
    if (d && d !== d0) { d0 = d; glow.setAttribute('d', d); g.setAttribute('x2', svg.clientWidth || 1000); glow.style.strokeDasharray = len }
    glow.style.strokeDashoffset = off
    halo.setAttribute('cx', pilot.getAttribute('cx')); halo.setAttribute('cy', pilot.getAttribute('cy'))
    trail.forEach(function (c, i) { var q = fill.getPointAtLength(Math.max(0, len * p - (i + 1) * 12)); c.setAttribute('cx', q.x); c.setAttribute('cy', q.y) })
    if (live) raf = requestAnimationFrame(frame)
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { es.forEach(function (e) { live = e.isIntersecting; if (live && !raf) raf = requestAnimationFrame(frame); if (!live) { cancelAnimationFrame(raf); raf = 0 } }) }, { threshold: 0.01 }).observe(band)
  else { live = true; raf = requestAnimationFrame(frame) }
})()

// vidéo de l'accueil : l'écran se redresse en approchant du centre (--vp 0→1), le gros bouton lance la lecture avec les contrôles
;(function () {
  var sec = document.getElementById('video'); if (!sec) return
  var v = sec.querySelector('video'), b = sec.querySelector('.vsl-play')
  b.addEventListener('click', function () { sec.classList.add('joue'); v.controls = true; v.play() })
})()


// vidéo : pause dès qu'on quitte la section
;(function () {
  var s = document.getElementById('video'), v = s && s.querySelector('video')
  if (!v || !('IntersectionObserver' in window)) return
  new IntersectionObserver(function (es) { if (!es[0].isIntersecting && !v.paused) v.pause() }, { threshold: 0.6 }).observe(s)
})()

// « Nos services » v3 : accordéon + scène 3D, défilement automatique (7 s) arrêté au premier clic, entrée et parallaxe
;(function () {
  var s = document.querySelector('.sv3'); if (!s) return
  var its = [].slice.call(s.querySelectorAll('.sv3-it')), imgs = [].slice.call(s.querySelectorAll('.sv3-stage img'))
  var stage = s.querySelector('.sv3-stage'), cur = 0, auto = false, t0 = 0, vis = false
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches
  function show(i) {
    cur = i
    its.forEach(function (it, k) { var on = k === i, b = it.querySelector('button'); it.classList.toggle('on', on); b.classList.toggle('on', on); b.setAttribute('aria-expanded', on); it.querySelector('.bar i').style.transform = 'scaleX(0)' })
    imgs.forEach(function (im, k) { im.classList.toggle('on', k === i) })
    t0 = performance.now()
  }
  its.forEach(function (it, i) { it.querySelector('button').addEventListener('click', function () { auto = false; show(i) }) })
  s.querySelector('.sv3-nav').addEventListener('keydown', function (e) {
    var b = its.map(function (it) { return it.querySelector('button') }), i = b.indexOf(document.activeElement); if (i < 0) return
    var n = e.key === 'ArrowDown' ? (i + 1) % b.length : e.key === 'ArrowUp' ? (i - 1 + b.length) % b.length : -1
    if (n < 0) return
    e.preventDefault(); b[n].focus(); b[n].click()
  })
  function tick(now) {
    requestAnimationFrame(tick)
    if (!auto || !vis || still) return
    var f = (now - t0) / 7000
    if (f >= 1) show((cur + 1) % its.length); else its[cur].querySelector('.bar i').style.transform = 'scaleX(' + f.toFixed(3) + ')'
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { vis = e[0].isIntersecting; if (vis) { s.classList.add('in'); t0 = performance.now() } }, { threshold: 0.35 }).observe(s)
  else s.classList.add('in')
  requestAnimationFrame(tick)
  if (!still && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var r = stage.parentNode
    r.addEventListener('pointermove', function (e) { var b = stage.getBoundingClientRect(); stage.style.setProperty('--rx', ((e.clientX - b.left) / b.width - .5).toFixed(3)); stage.style.setProperty('--ry', ((e.clientY - b.top) / b.height - .5).toFixed(3)) }, { passive: true })
    r.addEventListener('pointerleave', function () { stage.style.setProperty('--rx', 0); stage.style.setProperty('--ry', 0) })
  }
})()

// « Nos services » : ciel étoilé animé (scintillement, légère dérive, étoiles filantes), seulement quand la section est à l'écran
;(function () {
  var c = document.querySelector('.sv3-sky'); if (!c || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  var spr = new Image(); spr.src = 'assets/etoile.png'
  var x = c.getContext('2d'), W = 0, H = 0, st = [], sh = [], on = false, dpr = Math.min(devicePixelRatio || 1, 2)
  function size() {
    W = c.clientWidth; H = c.clientHeight; c.width = W * dpr; c.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0)
    st = []; var n = Math.round(W * H / 5200)
    for (var i = 0; i < n; i++) { var y = Math.pow(Math.random(), 1.8) * H * .62; st.push({ x: Math.random() * W, y: y, r: Math.random() * 1.3 + .3, p: Math.random() * 6.28, s: .6 + Math.random() * 1.8, v: .02 + Math.random() * .06 }) }
  }
  function frame(t) {
    if (!on) return
    requestAnimationFrame(frame)
    x.clearRect(0, 0, W, H)
    for (var i = 0; i < st.length; i++) {
      var s = st[i]; s.x -= s.v; if (s.x < -2) s.x = W + 2
      var a = (.35 + .65 * (.5 + .5 * Math.sin(t / 1000 * s.s + s.p))) * (1 - s.y / (H * .7))
      x.globalAlpha = Math.max(0, a)
      if (spr.complete && spr.naturalWidth) { var d = s.r * (s.r > 1.35 ? 26 : 12) * (.75 + .25 * a); x.drawImage(spr, s.x - d / 2, s.y - d / 2, d, d) }  // étoile scintillante (image générée dans Figma, alpha tirée de la luminosité)
    }
    if (Math.random() < .006 && sh.length < 2) sh.push({ x: Math.random() * W * .8 + W * .2, y: Math.random() * H * .3, l: 0 })
    for (var j = sh.length - 1; j >= 0; j--) {
      var m = sh[j]; m.l += 1; var k = m.l / 55, px = m.x - m.l * 9, py = m.y + m.l * 4
      var g = x.createLinearGradient(px, py, px + 120, py - 53); g.addColorStop(0, 'rgba(255,255,255,' + (1 - k) + ')'); g.addColorStop(1, 'rgba(160,190,255,0)')
      x.globalAlpha = 1; x.strokeStyle = g; x.lineWidth = 1.6; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 120, py - 53); x.stroke()
      if (m.l > 55) sh.splice(j, 1)
    }
    x.globalAlpha = 1
  }
  size(); addEventListener('resize', size)
  new IntersectionObserver(function (e) { var v = e[0].isIntersecting; if (v && !on) { on = true; requestAnimationFrame(frame) } else if (!v) on = false }).observe(c)
})()
