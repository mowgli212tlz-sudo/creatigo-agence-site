/* Studio de validation : composants communs à l'espace agence (admin/studio.js) et à l'espace client (assets/portal-studio.js).
   - visionneuse : affiche un livrable (image, vidéo, PDF) ; sur une image, chaque commentaire est un point numéroté posé à
     l'endroit cliqué (coordonnées en % de l'image, donc justes quelle que soit la taille d'écran)
   - comparaison : deux versions côte à côte, ou superposées avec un curseur
   Aucun texte de commentaire n'est injecté en HTML : tout passe par h() (textContent). */
(function () {
  function estImage(mime, nom) { return /^image\//.test(mime || '') || /\.(png|jpe?g|webp|gif|svg)$/i.test(nom || '') }
  function estVideo(mime, nom) { return /^video\//.test(mime || '') || /\.(mp4|webm|mov)$/i.test(nom || '') }

  // opts : { h, ic, url, mime, nom, points: [{ n, x, y, texte, resolu, auteur }], placer(x, y) | null, actif: n }
  function visionneuse(opts) {
    var h = opts.h, ic = opts.ic
    if (!opts.url) return h('div', { class: 'st-vide' }, ic('image-plus', 28), h('span', {}, 'Fichier indisponible.'))
    if (estVideo(opts.mime, opts.nom)) return h('div', { class: 'st-media' }, h('video', { src: opts.url, controls: true, preload: 'metadata' }))
    if (!estImage(opts.mime, opts.nom)) return h('div', { class: 'st-vide' }, ic('file-text', 28), h('span', {}, opts.nom || 'Document'), h('a', { class: 'btn', href: opts.url, target: '_blank', rel: 'noopener' }, ic('external-link', 15), 'Ouvrir le document'))
    var cadre = h('div', { class: 'st-cadre' + (opts.placer ? ' annotable' : ''), tabindex: opts.placer ? '0' : null, 'aria-label': opts.placer ? 'Image du livrable : cliquez sur un endroit pour y laisser un commentaire' : 'Image du livrable' })
    var img = h('img', { src: opts.url, alt: opts.nom || 'Livrable', draggable: 'false' })
    cadre.append(img)
    ;(opts.points || []).forEach(function (p) {
      if (p.x == null || p.y == null) return
      cadre.append(h('button', { type: 'button', class: 'st-point' + (p.resolu ? ' resolu' : '') + (p.auteur === 'agence' ? ' agence' : '') + (opts.actif === p.n ? ' actif' : ''), style: 'left:' + p.x + '%;top:' + p.y + '%',
        'aria-label': 'Commentaire ' + p.n + ' : ' + p.texte, 'data-bulle': p.n + '. ' + p.texte, onclick: function (e) { e.stopPropagation(); if (opts.choisir) opts.choisir(p.n) } }, String(p.n)))
    })
    if (opts.placer) {
      cadre.addEventListener('click', function (e) {
        var r = img.getBoundingClientRect()
        var x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)), y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100))
        cadre.querySelectorAll('.st-point.nouveau').forEach(function (n) { n.remove() })
        cadre.append(h('span', { class: 'st-point nouveau', style: 'left:' + x + '%;top:' + y + '%', 'aria-hidden': 'true' }, '+'))
        opts.placer(Math.round(x * 100) / 100, Math.round(y * 100) / 100)
      })
      // au clavier : Entrée place un commentaire au centre de l'image
      cadre.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); opts.placer(50, 50) } })
    }
    return cadre
  }

  // opts : { h, a: { url, titre }, b: { url, titre } } : côte à côte ou superposées (curseur)
  function comparaison(opts) {
    var h = opts.h, mode = 'cote'
    var zone = h('div', { class: 'st-comp' })
    var curseur = h('input', { type: 'range', min: '0', max: '100', value: '50', 'aria-label': 'Glisser pour comparer les deux versions' })
    var boutons = h('div', { class: 'st-comp-modes', role: 'group', 'aria-label': 'Mode de comparaison' },
      [['cote', 'Côte à côte'], ['superpose', 'Superposées']].map(function (m, i) {
        return h('button', { type: 'button', 'aria-pressed': String(!i), onclick: function (e) { boutons.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', 'false') }); e.currentTarget.setAttribute('aria-pressed', 'true'); mode = m[0]; dessiner() } }, m[1])
      }))
    function dessiner() {
      zone.textContent = ''
      if (mode === 'cote') {
        zone.className = 'st-comp cote'
        zone.append(h('figure', {}, h('img', { src: opts.a.url, alt: opts.a.titre }), h('figcaption', {}, opts.a.titre)), h('figure', {}, h('img', { src: opts.b.url, alt: opts.b.titre }), h('figcaption', {}, opts.b.titre)))
      } else {
        zone.className = 'st-comp superpose'
        var dessus = h('div', { class: 'st-comp-dessus', style: 'width:' + curseur.value + '%' }, h('img', { src: opts.b.url, alt: opts.b.titre }))
        var cadre = h('div', { class: 'st-comp-cadre' }, h('img', { src: opts.a.url, alt: opts.a.titre }), dessus, h('span', { class: 'st-comp-ligne', style: 'left:' + curseur.value + '%' }))
        curseur.oninput = function () { dessus.style.width = curseur.value + '%'; cadre.querySelector('.st-comp-ligne').style.left = curseur.value + '%' }
        zone.append(cadre, h('div', { class: 'st-comp-leg' }, h('span', {}, '← ' + opts.b.titre), curseur, h('span', {}, opts.a.titre + ' →')))
      }
    }
    dessiner()
    return h('div', { class: 'st-comp-boite' }, boutons, zone)
  }

  var STATUTS = { brouillon: ['Brouillon', 'neutre'], a_valider: ['À valider', 'attention'], modifications: ['Modifications demandées', 'critique'], valide: ['Validé', 'bon'], refuse: ['Refusé', 'critique'] }
  var TYPES = { maquette: 'Maquette', logo: 'Logo', visuel: 'Visuel', video: 'Vidéo', support: 'Support marketing', autre: 'Autre' }
  window.CreatigoStudio = { visionneuse: visionneuse, comparaison: comparaison, estImage: estImage, STATUTS: STATUTS, TYPES: TYPES }
})()
