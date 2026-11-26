/* FAQ en conversation. Le menu de droite range les questions par thème ; un clic envoie la question dans le chat,
   Creatigo « écrit » (points), puis la bulle s'agrandit en douceur jusqu'à la taille de la réponse.
   Toutes les animations passent par transform / opacity (fluides) et sont coupées si le visiteur réduit les animations. */
(function () {
  var root = document.querySelector('[data-cq]')
  if (!root) return
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  var EASE = 'cubic-bezier(.16,1,.3,1)', SPRING = 'cubic-bezier(.34,1.45,.64,1)'
  var log = root.querySelector('.cq-log'), box = root.querySelector('.cq-c')
  var data = [].slice.call(root.querySelectorAll('.cq-data li')).map(function (li) {
    return { q: li.querySelector('b').textContent, a: li.querySelector('span').textContent, cat: li.dataset.cat, href: li.dataset.href, label: li.dataset.label }
  })
  var cats = data.map(function (d) { return d.cat }).filter(function (c, i, a) { return a.indexOf(c) === i })
  var asked = {}, cat = cats[0], busy = false, started = false, tabsEl, grid, endEl
  var USER = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.5-6 8-6s7 1.5 8 6"/></svg>'

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e }
  function anim(e, kf, opt) { if (reduce || !e.animate) return null; return e.animate(kf, opt) }
  function left(c) { return data.filter(function (d) { return !asked[data.indexOf(d)] && (c == null || d.cat === c) }) }

  // défilement doux : le chat suit la nouvelle bulle sans à-coup
  var gliding = 0
  function glide(ms) {
    var end = performance.now() + (ms || 800)
    if (reduce) { log.scrollTop = log.scrollHeight; return }
    if (gliding) { gliding = end; return }
    gliding = end
    ;(function step() {
      var target = log.scrollHeight - log.clientHeight, d = target - log.scrollTop
      log.scrollTop += Math.abs(d) < 0.5 ? d : d * 0.16
      if (performance.now() < gliding || Math.abs(d) > 1) requestAnimationFrame(step); else gliding = 0
    })()
  }

  function row(kind, content) {
    var r = el('div', 'row ' + kind), av = el('span', 'av'), m = el('div', 'm ' + kind)
    if (kind === 'q') av.innerHTML = USER
    m.appendChild(content); if (kind === 'q') r.appendChild(av); r.appendChild(m); log.appendChild(r)
    anim(r, [{ opacity: 0, transform: 'translateY(18px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 560, easing: SPRING })
    if (kind === 'q') anim(av, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 90, easing: SPRING, fill: 'backwards' })
    glide(700); return m
  }

  // réponse : points de frappe, puis la bulle épouse en douceur la taille du texte
  function bot(text, href, label, done) {
    var dots = el('span', 'typing'); dots.innerHTML = '<i></i><i></i><i></i>'
    var m = row('a', dots)
    setTimeout(function () {
      var from = m.getBoundingClientRect()
      var body = el('span', 'txt', text)
      if (href) { body.appendChild(document.createElement('br')); var a = el('a', '', label + ' →'); a.href = href; body.appendChild(a) }
      m.textContent = ''; m.appendChild(body)
      var to = m.getBoundingClientRect()
      m.style.overflow = 'hidden'
      var g = anim(m, [{ width: from.width + 'px', height: from.height + 'px' }, { width: to.width + 'px', height: to.height + 'px' }], { duration: 520, easing: EASE })
      anim(body, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 160, easing: EASE, fill: 'backwards' })
      glide(900)
      var fin = function () { m.style.overflow = ''; if (done) done() }
      setTimeout(fin, g ? 540 : 0)
    }, reduce ? 0 : 900)
  }

  // ---- menu de droite : thèmes en bandeau qui défile tout seul (pause au survol), liste de questions ----
  function buildTabs() {
    var view = el('div', 'cq-tabs'), track = el('div', 'cq-track'); view.setAttribute('role', 'tablist')
    ;[0, 1].forEach(function (k) {
      var set = el('div', 'cq-set'); if (k) set.setAttribute('aria-hidden', 'true')
      cats.forEach(function (c) {
        var b = el('button', '', c), n = el('i'); b.type = 'button'; b.dataset.cat = c; b.appendChild(n)
        if (k) b.tabIndex = -1; else b.setAttribute('role', 'tab')
        b.onclick = function () { if (cat !== c && !busy) { cat = c; sync(); fill() } }
        set.appendChild(b)
      })
      track.appendChild(set)
    })
    view.appendChild(track); tabsEl = view
    grid = el('div', 'cq-q'); endEl = el('div', 'cq-end')
    var go = el('a', 'cq-go', 'Réserver un appel →'), again = el('button', '', '↻ Recommencer'); go.href = root.dataset.contact; again.type = 'button'
    again.onclick = function () { asked = {}; cat = cats[0]; counts = {}; log.textContent = ''; box.classList.remove('done'); sync(); fill(); setTimeout(hello, 200) }
    endEl.appendChild(go); endEl.appendChild(again)
    box.appendChild(tabsEl); box.appendChild(grid); box.appendChild(endEl)
  }
  function sync() {
    if (!left(cat).length) { var nx = cats.filter(function (c) { return left(c).length })[0]; if (nx) cat = nx }
    ;[].slice.call(tabsEl.querySelectorAll('button')).forEach(function (b) {
      var c = b.dataset.cat, n = left(c).length, i = b.querySelector('i')
      b.classList.toggle('on', c === cat); b.disabled = !n; b.setAttribute('aria-selected', c === cat)
      if (i.textContent !== String(n)) { var had = i.textContent !== ''; i.textContent = n; if (had) anim(i, [{ transform: 'scale(1.5)' }, { transform: 'none' }], { duration: 420, easing: SPRING }) }
    })
    box.classList.toggle('done', !left().length)
  }
  function fill() {
    var old = grid.firstChild, build = function () {
      grid.textContent = ''
      left(cat).forEach(function (d, i) {
        var b = el('button', '', d.q); b.type = 'button'; b.style.setProperty('--i', i)
        b.onclick = function () { ask(data.indexOf(d), b) }
        grid.appendChild(b)
      })
    }
    if (old && anim(grid, [{ opacity: 1 }, { opacity: 0 }], { duration: 130, easing: 'ease-out' })) setTimeout(build, 130); else build()
  }

  function ask(i, btn) {
    if (busy) return
    busy = true; asked[i] = true
    var d = data[i]
    var gone = anim(btn, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-14px) scale(.96)' }], { duration: 260, easing: EASE, fill: 'forwards' })
    box.classList.add('wait')
    row('q', document.createTextNode(d.q))
    setTimeout(function () {
      bot(d.a, d.href, d.label, function () {
        box.classList.remove('wait'); sync(); fill(); busy = false
      })
    }, reduce ? 0 : 420)
  }
  function hello() { bot('Choisissez une question, la réponse arrive tout de suite.') }

  buildTabs(); sync(); fill()
  // bandeau des thèmes : défilement lent et continu, qui ralentit en douceur au survol (pas d'arrêt sec)
  if (!reduce) {
    var track = tabsEl.querySelector('.cq-track'), SPEED = 18, setW = 0, x = 0, v = SPEED, target = SPEED, last = 0, raf = 0, vis = true
    var measure = function () { setW = track.firstChild.getBoundingClientRect().width }
    var fineMouse = matchMedia('(hover: hover) and (pointer: fine)').matches, nFrame = 0
    var tick = function (t) {
      var dt = Math.min((t - last) / 1000, 0.05); last = t
      if (++nFrame % 6 === 0) target = (fineMouse && tabsEl.matches(':hover')) || tabsEl.querySelector(':focus-visible') ? 0 : SPEED
      v += (target - v) * Math.min(1, dt * 4)
      x -= v * dt; if (setW && -x >= setW) x += setW
      track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)'
      raf = vis && !document.hidden ? requestAnimationFrame(tick) : 0
    }
    var run = function () { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick) } }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { vis = en[0].isIntersecting; if (vis) run() }, { threshold: 0 }).observe(tabsEl)
    document.addEventListener('visibilitychange', run)
    addEventListener('resize', measure)
    measure(); run()
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure)
  }
  function start() { if (started) return; started = true; hello() }
  if ('IntersectionObserver' in window && !reduce) new IntersectionObserver(function (en, o) { if (en[0].isIntersecting) { start(); o.disconnect() } }, { threshold: 0.35 }).observe(root)
  else start()
})()
