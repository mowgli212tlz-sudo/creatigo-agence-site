/* Zones sensibles des mascottes : un clic sur les yeux ou sur la bouche ne compte pas (pas de « Aïe », pas de tache).
   On lit les mêmes masques PNG que ceux qui dessinent les pupilles et les dents (assets/mascotte/yeux-masque*.png, dents-masque*.png),
   légèrement élargis ; le point cliqué est ramené dans le repère de l'image même quand la mascotte est inclinée (rotate).
   Utilisé par mascotte.js (accueil, page agence) et mascotte2.js (mascotte de « Nos services »). */
(function () {
  var script = document.currentScript, BASE = script && script.src ? script.src.replace(/assets\/mascotte-zones\.js.*$/, '') : ''
  var cache = {}
  function mask(name) {
    if (cache[name]) return cache[name]
    var o = cache[name] = { ready: false }, im = new Image()
    im.onload = function () {
      try {
        var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight
        var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0)
        o.ctx = x; o.w = c.width; o.h = c.height; o.ready = true
      } catch (e) { /* canvas illisible : on ne bloque aucun clic */ }
    }
    im.src = BASE + 'assets/mascotte/' + name + '.png'
    return o
  }
  // alpha du masque autour du point (u, v) en fractions [0..1] ; rad = élargissement en fraction de la largeur
  function touche(o, u, v, rad) {
    if (!o.ready) return false
    for (var dy = -rad; dy <= rad + 1e-9; dy += rad / 2) {
      for (var dx = -rad; dx <= rad + 1e-9; dx += rad / 2) {
        var x = Math.round((u + dx) * o.w), y = Math.round((v + dy * o.w / o.h) * o.h)
        if (x < 0 || y < 0 || x >= o.w || y >= o.h) continue
        if (o.ctx.getImageData(x, y, 1, 1).data[3] > 40) return true
      }
    }
    return false
  }
  // un seul pixel du masque (sans élargissement)
  function sur(o, u, v) {
    var x = Math.round(u * o.w), y = Math.round(v * o.h)
    if (x < 0 || y < 0 || x >= o.w || y >= o.h) return false
    return o.ctx.getImageData(x, y, 1, 1).data[3] > 40
  }
  // point du clic dans le repère (non incliné) de la mascotte, en fractions de sa largeur / hauteur
  function local(m, e) {
    var r = m.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2
    var rot = parseFloat(getComputedStyle(m).rotate) || 0
    var cote = m.closest('.mside') // mascotte du bord de l'écran : le conteneur est légèrement incliné par le défilement
    if (cote) { var mt = new DOMMatrix(getComputedStyle(cote).transform); rot += Math.atan2(mt.b, mt.a) * 180 / Math.PI }
    var a = -rot * Math.PI / 180
    var dx = e.clientX - cx, dy = e.clientY - cy
    var x = dx * Math.cos(a) - dy * Math.sin(a), y = dx * Math.sin(a) + dy * Math.cos(a)
    if (m.closest('[data-flip]')) x = -x // mascotte en miroir
    return [x / m.offsetWidth + 0.5, y / m.offsetHeight + 0.5]
  }
  // noms des masques d'une mascotte : accueil (''), services ('2') ou mascotte illustrée (data-mk)
  function noms(m) {
    var k = m.getAttribute('data-mk'), n = m.classList.contains('m2') ? '2' : ''
    if (m.classList.contains('m3')) return { y: 'yeux-masque3', d: 'dents-masque3', c: 'peau-masque3', k: 0.2 } // seule la peau bleue réagit (pas le sweat, le pc, les baskets)
    if (!k) return { y: 'yeux-masque' + n, d: 'dents-masque' + n }
    // masque « clic » : seul le corps de la mascotte réagit (objets et décor exclus) ; sinon masque « bloc » : zone exclue (ex. tablette)
    return m.getAttribute('data-clic') ? { y: 'yeux-masque-' + k, d: 'dents-masque-' + k, m: 'bouche-masque-' + k, c: 'clic-masque-' + k } : { y: 'yeux-masque-' + k, d: 'dents-masque-' + k, b: 'bloc-masque-' + k }
  }
  window.mascotteZone = function (m, e) {
    var nm = noms(m), p = local(m, e)
    if (nm.c) { var cm = mask(nm.c); if (cm.ready && !sur(cm, p[0], p[1])) return true } // hors du corps : décor, objets
    if (nm.m) { var bm = mask(nm.m); if (bm.ready && sur(bm, p[0], p[1])) return true } // bouche entière (dents, langue, intérieur)
    var k = nm.k || 1 // mascotte 3 : visage presque entièrement yeux + bouche, marges réduites sinon rien n'est cliquable
    return touche(mask(nm.y), p[0], p[1], 0.012 * k) || touche(mask(nm.d), p[0], p[1], 0.035 * k) || (nm.b ? touche(mask(nm.b), p[0], p[1], 0.008) : false)
  }
  // le curseur n'invite pas à cliquer sur les zones protégées
  function curseur(m) {
    m.addEventListener('pointermove', function (e) { m.style.cursor = window.mascotteZone(m, e) ? 'default' : 'pointer' }, { passive: true })
  }
  function init() { [].forEach.call(document.querySelectorAll('.mascot'), function (m) { var nm = noms(m); mask(nm.y); mask(nm.d); if (nm.b) mask(nm.b); if (nm.c) mask(nm.c); if (nm.m) mask(nm.m); curseur(m) }) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init()
})()
