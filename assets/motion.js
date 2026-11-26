/* Accueil : chorégraphie d'animation (titres mot à mot, entrées en cascade par section qui se rejouent à chaque passage, cartes « Ce que vous gagnez »
   avec inclinaison 3D et projecteur qui suit le curseur). Tout est ajouté après coup : sans JS ou avec « réduire les animations », rien n'est masqué. */
;(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
  var $ = function (s, r) { return (r || document).querySelector(s) }, $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)) }

  // 1. titres : chaque mot monte dans son masque (les <em> restent des <em>)
  function split(h) {
    var k = 0
    function walk(node) {
      ;[].slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment()
          n.textContent.split(/(\s+)/).forEach(function (t) {
            if (!t) return
            if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(' ')); return }
            var w = document.createElement('span'); w.className = 'mv-w'; w.style.setProperty('--k', k++)
            var i = document.createElement('i'); i.textContent = t; w.appendChild(i); frag.appendChild(w)
          })
          n.parentNode.replaceChild(frag, n)
        } else if (n.nodeType === 1 && n.nodeName !== 'BR') walk(n)
      })
    }
    var label = h.textContent; h.setAttribute('aria-label', label); walk(h)
    $$('.mv-w', h).forEach(function (w) { w.setAttribute('aria-hidden', 'true') })
  }
  ;['#services .head h2', '#methode .mp-top h2', '#pourquoi .pw-hd h2'].forEach(function (s) { var h = $(s); if (h) split(h) })

  // 2. « Ce que vous gagnez » : projecteur + inclinaison 3D des cartes
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches
  $$('#pourquoi .pw-c').forEach(function (c) {
    var sp = document.createElement('span'); sp.className = 'mv-spot'; sp.setAttribute('aria-hidden', 'true'); c.insertBefore(sp, c.firstChild)
    if (!fine) return
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
      c.style.setProperty('--px', x.toFixed(3)); c.style.setProperty('--py', y.toFixed(3))
    }, { passive: true })
    c.addEventListener('pointerleave', function () { c.style.removeProperty('--px'); c.style.removeProperty('--py') })
  })

  // 3. sections : « .mv-in » quand la section occupe le centre de l'écran, retiré en sortant (l'entrée se rejoue)
  var secs = ['#services', '#methode', '#pourquoi'].map(function (s) { return $(s) }).filter(Boolean)
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('mv-in', e.isIntersecting) }) }, { rootMargin: '-8% 0px -8% 0px', threshold: 0 })
  secs.forEach(function (s) { io.observe(s) })
  // les puces de la méthode : décalage d'entrée
  $$('#methode .mp-tx').forEach(function (t) { $$('li', t).forEach(function (li, i) { li.style.setProperty('--i', i) }) })
  document.documentElement.classList.add('mv')
})()
