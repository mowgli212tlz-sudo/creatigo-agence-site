/* Orbe de Jarvis : un anneau de particules en rubans ondulants, un noyau en points et un halo, dessinés en canvas 2D.
   Il change d'allure selon l'état de l'assistant :
     repos      respiration lente
     ecoute     l'anneau s'ouvre et ondule au rythme de la voix (impulsions à chaque mise à jour de la dictée)
     reflexion  les rubans se tordent vite, l'anneau se resserre, le noyau tourne
     parle      l'anneau pulse à chaque mot (événement « boundary » de la synthèse vocale) et en continu sinon
   Aucune dépendance. Une seule image fixe si l'utilisateur demande moins d'animations. */
(function () {
  'use strict'
  var TAU = Math.PI * 2
  function graine(s) { return function () { s |= 0; s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

  // paramètres visés par état ; l'orbe glisse en douceur de l'un à l'autre
  var ETATS = {
    repos:     { amp: 0.32, vit: 1.0, rayon: 1.0,  lueur: 0.55, spin: 0.45, ouverture: 1.0 },
    ecoute:    { amp: 0.62, vit: 1.4, rayon: 1.035, lueur: 1.0,  spin: 0.9,  ouverture: 1.25 },
    reflexion: { amp: 0.75, vit: 3.6, rayon: 0.93, lueur: 0.85, spin: 3.4,  ouverture: 0.8 },
    parle:     { amp: 0.6,  vit: 1.8, rayon: 1.0,  lueur: 1.1,  spin: 1.2,  ouverture: 1.15 },
  }
  var COULEURS = [   // fond de l'anneau : sombre, moyen, clair (rgb) ; la dernière est la lumière des arêtes
    [10, 120, 118], [30, 178, 170], [112, 226, 214],
  ]

  function creer(canvas) {
    var ctx = canvas.getContext('2d'), rnd = graine(20261127)
    var reduit = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches
    var L = 0, H = 0, dpr = 1, cx = 0, cy = 0, S = 0
    var etat = 'repos', cur = Object.assign({}, ETATS.repos), cible = ETATS.repos
    var energie = 0, t = 0, dernier = 0, raf = 0, simProchain = 0, tourne = false

    // ---- 7 rubans : chacun a ses ondulations, sa torsion et sa largeur ; leurs particules sont tirées une fois
    var CONF = [
      { n: 3, m: 1, W: 0.085, R: 0.985, s: 0.9,  tau: -0.9, rot: 0.05 },
      { n: 4, m: 2, W: 0.06, R: 0.994,  s: -0.7, tau: 0.7,  rot: -0.07 },
      { n: 5, m: 1, W: 0.075, R: 1.0,   s: 0.6,  tau: -1.1, rot: 0.06 },
      { n: 4, m: 3, W: 0.05, R: 1.007, s: -1.0, tau: 0.8,  rot: -0.05 },
      { n: 6, m: 2, W: 0.07, R: 1.013, s: 0.8,  tau: 1.0,  rot: 0.08 },
      { n: 3, m: 1, W: 0.09, R: 1.02, s: -0.6, tau: -0.6, rot: -0.04 },
      { n: 5, m: 2, W: 0.045, R: 1.03,  s: 1.1,  tau: 0.9,  rot: 0.07 },
    ]
    var PAR_RUBAN = 3000, rubans = CONF.map(function (c) {
      var r = Object.assign({ phi: rnd() * TAU, th: new Float32Array(PAR_RUBAN), w: new Float32Array(PAR_RUBAN), ton: new Uint8Array(PAR_RUBAN) }, c)
      // les particules se rangent sur des filaments le long du ruban (largeur -1..1) : c'est ce qui donne l'aspect soyeux et tissé
      var FILS = 9, wFil = new Float32Array(FILS)
      for (var f = 0; f < FILS; f++) wFil[f] = -1 + (2 * f) / (FILS - 1) + (rnd() - 0.5) * 0.12
      for (var j = 0; j < PAR_RUBAN; j++) {
        r.th[j] = ((j + rnd() * 1.6) / PAR_RUBAN) * TAU
        var libre = rnd() < 0.22, w = libre ? rnd() * 2 - 1 : wFil[(rnd() * FILS) | 0] + (rnd() - 0.5) * 0.05
        r.w[j] = Math.max(-1, Math.min(1, w))
        r.ton[j] = Math.abs(r.w[j]) > 0.78 ? (rnd() < 0.3 ? 2 : 1) : (rnd() < 0.16 ? 1 : 0)
      }
      return r
    })
    // poussière autour de l'anneau
    var POUSSIERE = Array.from({ length: 140 }, function () { return { a: rnd() * TAU, r: 1.03 + Math.pow(rnd(), 1.6) * 0.5, p: rnd() * TAU, v: 0.4 + rnd() } })
    // noyau : sphère de points (spirale de Fibonacci)
    var NOYAU = Array.from({ length: 170 }, function (_, i) { var y = 1 - (i / 169) * 2, r = Math.sqrt(1 - y * y), a = i * 2.399963; return [Math.cos(a) * r, y, Math.sin(a) * r] })

    // tampons de points par teinte (évite de changer de couleur à chaque point)
    var TAMPON = [new Float32Array(PAR_RUBAN * CONF.length * 2), new Float32Array(PAR_RUBAN * CONF.length * 2), new Float32Array(PAR_RUBAN * CONF.length * 2)]
    var compte = [0, 0, 0]

    function redimensionner() {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      var w = canvas.clientWidth || 320, h = canvas.clientHeight || 320
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
      L = canvas.width; H = canvas.height; cx = L / 2; cy = H / 2; S = Math.min(L, H) * 0.44
      ctx.fillStyle = '#010708'; ctx.fillRect(0, 0, L, H)
    }

    function glisser(dt) {
      var k = 1 - Math.exp(-dt * 3.2)
      for (var cle in cible) cur[cle] += (cible[cle] - cur[cle]) * k
    }

    function image(dt) {
      // fond : on atténue l'image précédente (traînées lumineuses), puis le halo
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = 'rgba(1, 7, 8, ' + (reduit ? 1 : 0.55) + ')'; ctx.fillRect(0, 0, L, H)
      var halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 1.35)
      halo.addColorStop(0, 'rgba(20,130,124,' + (0.2 * cur.lueur).toFixed(3) + ')'); halo.addColorStop(0.55, 'rgba(10,70,68,' + (0.09 * cur.lueur).toFixed(3) + ')'); halo.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = halo; ctx.fillRect(0, 0, L, H)
      ctx.globalCompositeOperation = 'lighter'

      var A = 0.085 * (cur.amp + energie * 1.2)                     // amplitude des ondulations (fraction du rayon)
      var rayon = S * cur.rayon * (1 + energie * 0.035)
      var rx = 0.34 + 0.1 * Math.sin(t * 0.23), ry = 0.16 * Math.sin(t * 0.17 + 1)
      var cRx = Math.cos(rx), sRx = Math.sin(rx), cRy = Math.cos(ry), sRy = Math.sin(ry)
      var F = 2.7, taille = Math.max(1, dpr * 0.9)
      compte[0] = compte[1] = compte[2] = 0

      for (var i = 0; i < rubans.length; i++) {
        var r = rubans[i], vit = cur.vit
        for (var j = 0; j < PAR_RUBAN; j++) {
          var th = r.th[j] + t * r.rot * cur.spin, w = r.w[j]
          var vague = A * (Math.sin(r.n * th + t * r.s * vit + r.phi) + 0.5 * Math.sin((r.n + 2) * th - t * r.s * 0.7 * vit + r.phi * 1.7))
          var al = r.m * th + t * r.tau * vit
          var rad = (r.R + vague + w * r.W * cur.ouverture * Math.cos(al)) * rayon
          var x = rad * Math.cos(th), y = rad * Math.sin(th), z = w * r.W * cur.ouverture * Math.sin(al) * 2.7 * S + 0.07 * S * Math.sin(2 * th + t * 0.8 + i)
          var y1 = y * cRx - z * sRx, z1 = y * sRx + z * cRx
          var x2 = x * cRy + z1 * sRy, z2 = -x * sRy + z1 * cRy
          var sc = F / (F - z2 / S)
          var ton = r.ton[j] + (z2 > 0.04 * S ? 1 : 0); if (ton > 2) ton = 2
          var q = TAMPON[ton], c = compte[ton]
          q[c] = cx + x2 * sc; q[c + 1] = cy + y1 * sc; compte[ton] = c + 2
        }
      }
      for (var b = 0; b < 3; b++) {
        var col = COULEURS[b], al2 = b === 0 ? 0.36 : b === 1 ? 0.56 : 0.8
        ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + al2 + ')'
        var tb = TAMPON[b], n = compte[b], sz = taille
        for (var k = 0; k < n; k += 2) ctx.fillRect(tb[k], tb[k + 1], sz, sz)
      }

      // poussière lointaine : scintille
      ctx.fillStyle = 'rgb(120,230,220)'
      for (var d = 0; d < POUSSIERE.length; d++) {
        var p = POUSSIERE[d], a = p.a + t * 0.03 * p.v, rr = p.r * S * (1 + energie * 0.05)
        ctx.globalAlpha = Math.max(0, 0.05 + 0.16 * Math.sin(t * p.v * 1.5 + p.p)) * cur.lueur
        ctx.fillRect(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.98, dpr, dpr)
      }
      ctx.globalAlpha = 1

      // cercles fins intérieurs et graduations
      ctx.lineWidth = Math.max(1, dpr * 0.8); ctx.strokeStyle = 'rgba(70,210,196,0.05)'
      ;[0.64].forEach(function (f) { ctx.beginPath(); ctx.arc(cx, cy, S * f * (1 + energie * 0.02), 0, TAU); ctx.stroke() })
      ctx.strokeStyle = 'rgba(100,225,212,' + (0.16 + energie * 0.3).toFixed(3) + ')'
      ctx.beginPath(); ctx.arc(cx, cy, S * 0.215, 0, TAU); ctx.stroke()
      ctx.strokeStyle = 'rgba(80,210,196,0.07)'; ctx.beginPath(); ctx.arc(cx, cy, S * 0.3, 0, TAU); ctx.stroke()
      ctx.fillStyle = 'rgba(110,225,212,0.22)'
      for (var g = 0; g < 60; g++) { var ga = (g / 60) * TAU + t * 0.05 * cur.spin; ctx.fillRect(cx + Math.cos(ga) * S * 0.25, cy + Math.sin(ga) * S * 0.25, dpr, dpr * (g % 5 === 0 ? 3 : 1)) }
      // onde qui part du noyau à chaque impulsion
      if (energie > 0.12) { ctx.strokeStyle = 'rgba(140,245,232,' + (energie * 0.3).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(cx, cy, S * (0.22 + (1 - energie) * 0.42), 0, TAU); ctx.stroke() }

      // noyau : sphère de points qui tourne
      var rs = S * (0.17 + energie * 0.012), ang = t * cur.spin * 0.6, ca = Math.cos(ang), sa = Math.sin(ang), ax = 0.35, cax = Math.cos(ax), sax = Math.sin(ax)
      var noy = ctx.createRadialGradient(cx, cy, 0, cx, cy, rs * 1.5); noy.addColorStop(0, 'rgba(40,170,162,' + (0.14 + energie * 0.18).toFixed(3) + ')'); noy.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = noy; ctx.fillRect(cx - rs * 1.6, cy - rs * 1.6, rs * 3.2, rs * 3.2)
      for (var u = 0; u < NOYAU.length; u++) {
        var pt = NOYAU[u], px = pt[0] * ca + pt[2] * sa, pz = -pt[0] * sa + pt[2] * ca, py = pt[1] * cax - pz * sax, pz2 = pt[1] * sax + pz * cax
        ctx.fillStyle = 'rgba(' + (pz2 > 0 ? '120,225,214,' + (0.3 + 0.35 * pz2).toFixed(2) : '30,140,134,0.22') + ')'
        ctx.fillRect(cx + px * rs, cy + py * rs, dpr, dpr)
      }
      ctx.globalCompositeOperation = 'source-over'
    }

    // impulsions simulées quand le navigateur ne donne pas de rythme précis (voix sans « boundary », écoute)
    function simuler() {
      if (t < simProchain) return
      if (etat === 'parle') { energie = Math.max(energie, 0.35 + Math.random() * 0.5); simProchain = t + 0.11 + Math.random() * 0.12 }
      else if (etat === 'ecoute') { energie = Math.max(energie, 0.08 + 0.08 * Math.sin(t * 2.1)); simProchain = t + 0.2 }
      else if (etat === 'reflexion') { energie = Math.max(energie, 0.25 + 0.2 * Math.sin(t * 4)); simProchain = t + 0.16 }
    }

    function boucle(ms) {
      if (!tourne) return
      var dt = Math.min(0.05, dernier ? (ms - dernier) / 1000 : 0.016); dernier = ms
      t += dt; glisser(dt); simuler()
      energie *= Math.exp(-dt * 4.2)
      image(dt)
      raf = requestAnimationFrame(boucle)
    }

    return {
      definirEtat: function (nom) { if (!ETATS[nom] || nom === etat) return; etat = nom; cible = ETATS[nom]; simProchain = 0; if (reduit && tourne) { cur = Object.assign({}, cible); image(0) } },
      pulse: function (v) { energie = Math.max(energie, Math.min(1, v == null ? 0.7 : v)) },
      redimensionner: redimensionner,
      // image fixe (tests, accessibilité)
      dessiner: function (temps) { t = temps || 0; redimensionner(); cur = Object.assign({}, cible); image(0.016) },
      demarrer: function () {
        if (tourne) return
        tourne = true; redimensionner(); dernier = 0
        if (reduit) { cur = Object.assign({}, cible); t = 1.5; image(0.016); return }
        raf = requestAnimationFrame(boucle)
      },
      arreter: function () { tourne = false; if (raf) cancelAnimationFrame(raf); raf = 0 },
    }
  }
  window.OrbeJarvis = { creer: creer }
})()
