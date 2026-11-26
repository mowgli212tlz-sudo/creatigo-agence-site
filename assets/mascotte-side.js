// Mascotte collée au bord de l'écran (Nos services, Nos réalisations, pages de services).
// 1) Mouvement : elle reste collée à son bord ; seuls un léger décalage vertical et un léger zoom (ancré sur le bord) suivent le défilement.
// 2) Elle commente la page : survol, sections qui apparaissent, clic sur un bouton, inactivité. Messages courts, commerciaux, tirés des faits du site
//    (services, projets réalisés, appel de 30 minutes sans engagement). mascotte.js expose le moteur de phrases (window.mascotteSay).
window.MASCOT_TXT = { quiet: true } // pas de phrases automatiques de l'accueil : celles de cette page sont écrites ici
;(function () {
  var el = document.querySelector('.mside'); if (!el) return
  var reduit = matchMedia('(prefers-reduced-motion: reduce)').matches

  // ---------- mouvement ----------
  if (!reduit) {
    var attente = false
    var maj = function () {
      attente = false
      var y = window.scrollY || 0
      el.style.setProperty('--ms-y', (Math.sin(y / 260) * 38).toFixed(1) + 'px')
      el.style.setProperty('--ms-s', (1 + Math.sin(y / 340) * 0.035).toFixed(3))
    }
    addEventListener('scroll', function () { if (!attente) { attente = true; requestAnimationFrame(maj) } }, { passive: true })
    maj()
  }

  // ---------- messages ----------
  var chemin = location.pathname.replace(/\/+$/, '').replace(/^\//, '')
  var page = chemin === 'nos-services' ? 'services' : chemin === 'nos-realisations' ? 'realisations' : 'service'
  var slug = chemin.split('/').pop()
  var net = function (t) { return (t || '').replace(/\s+/g, ' ').trim() }
  var min = function (t) { t = net(t); return t.charAt(0).toLowerCase() + t.slice(1) }
  var dernier = Date.now(), dernierEl = null, derniereHeure = 0

  var SVC = { // ce que dit la mascotte de chaque service (survol d'une carte ou arrivée sur la page)
    'site-web': ['Un site sur mesure, rapide, pensé pour Google dès le premier jour.', 'Vitrine, boutique ou plateforme : on conçoit, on met en ligne, on assure le suivi.'],
    'site-vitrine': ['Un site vitrine qui donne envie de vous contacter, pas un gabarit copié-collé.'],
    'site-e-commerce': ['Une boutique en ligne claire, un paiement fluide, un back-office simple.'],
    'site-saas': ['Une plateforme sur mesure, sécurisée et pensée pour grandir avec vous.'],
    'reseaux-sociaux': ['Du contenu régulier et une vraie communauté, sans y passer vos soirées.', 'Stratégie, visuels, animation : on s’occupe de la ligne éditoriale.'],
    'referencement-payant-sea': ['Des annonces Google pilotées au résultat : vous maîtrisez votre budget.', 'Chaque euro est suivi : appels, demandes, ventes, pas seulement des clics.'],
    'referencement-naturel-seo': ['Être trouvé sans payer à chaque clic : un investissement qui dure.', 'Structure, contenus, popularité : on vous fait gagner des places, durablement.'],
    'referencement-ia-geo': ['Quand vos clients demandent conseil à ChatGPT, soyez la réponse.', 'Le GEO prépare votre entreprise à être citée par les assistants IA.'],
    'marketing': ['Vidéos, supports, e-mailing : une image de marque qui se reconnaît.'],
    'application': ['Une application web ou mobile faite pour vos usages, pas un gabarit.', 'iOS, Android ou web : on commence par là où sont vos utilisateurs.']
  }
  var PROJET = { // projets réalisés (page Nos réalisations)
    'le chef du burger': 'Un site de restaurant à Toulouse : carte, galerie, commande et réservation en ligne.',
    'creatigo education': 'Une appli de révision pour étudiants : leçons, exercices corrigés, répétition espacée.',
    'creatigo, le générateur ia': 'Une phrase suffit : l’IA conçoit et code un site complet, avec aperçu en direct.',
    'creatigo sirh agent': 'Effectifs, contrats, alertes… et un agent IA qui répond en citant ses sources.'
  }
  var FILTRE = { 'Tous': 'Les quatre projets, du site vitrine à l’agent IA.', 'Sites': 'Un site qui donne envie de vous contacter : voilà l’idée.', 'Applications': 'Des outils métiers et des applis sur mesure, pensés pour être utilisés.', 'IA': 'L’IA au service des projets : génération de sites et agent RH.' }
  var IDLE = ['Un appel de 30 minutes, sans engagement : on regarde votre projet ensemble.', 'Un interlocuteur dédié, du premier échange à la mise en ligne.', 'Chaque devis est détaillé ligne par ligne : pas de mauvaise surprise.', 'Une question ? Cliquez sur « Contactez-nous » : on vous répond vite.']
  if (page === 'services') IDLE.push('Pas sûr du service qu’il vous faut ? L’aide au choix est un peu plus bas.', 'Les services se combinent : chacun renforce les autres.')
  if (page === 'realisations') IDLE.push('Chaque projet a ses vrais écrans : passez la souris sur un téléphone.', 'Le prochain projet, c’est peut-être le vôtre.')
  if (page === 'service' && SVC[slug]) SVC[slug].forEach(function (t) { IDLE.unshift(t) })

  var ACCUEIL = { services: 'Sept services, une seule équipe. Passez la souris sur celui qui vous intéresse !', realisations: 'Voilà ce qu’on a construit. Passez la souris sur un projet : je vous le raconte.', service: (SVC[slug] || ['Je vous guide : passez la souris sur ce qui vous intéresse !'])[0] }

  // Règles de survol : [sélecteur, fonction(élément) -> phrase | null]
  var SURVOL = [
    ['header .btn', function () { return 'Parlons-en : réservez un appel de 30 minutes, c’est sans engagement.' }],
    ['header nav a[href*="nos-realisations"]', function () { return 'Des projets bien réels, avec leurs vrais écrans.' }],
    ['header nav a[href*="lagence"]', function () { return 'Une équipe complémentaire et un seul interlocuteur.' }],
    ['header nav a[href*="blog"]', function () { return 'Des conseils clairs, sans jargon, pour mieux vous voir en ligne.' }],
    ['.cbk', function () { return 'Dites-nous ce que vous cherchez : on vous répond vite.' }],
    ['.sg-c', function (e) { var s = (e.getAttribute('href') || '').replace(/\/+$/, '').split('/').pop(); return (SVC[s] || [])[0] || null }],
    ['.ns-guide a', function (e) { return 'Vous vous reconnaissez ? « ' + net(e.querySelector('span') && e.querySelector('span').textContent) + ' » : voici par où commencer.' }],
    ['.ns-pc', function (e) { var h = net(e.querySelector('h3') && e.querySelector('h3').textContent); return h ? 'Parcours « ' + h + ' » : ' + min(e.querySelector('p') && e.querySelector('p').textContent) : null }],
    ['.wl-c', function () { return 'De vrais projets, avec de vrais écrans.' }],
    ['.rl-c', function (e) { var h = net(e.querySelector('h3') && e.querySelector('h3').textContent).toLowerCase(); return PROJET[h] || net(e.querySelector('p') && e.querySelector('p').textContent) }],
    ['.rl-ph', function () { return 'Regardez : l’écran mobile défile tout seul. Le site est pensé pour le téléphone.' }],
    ['.rl-f', function (e) { return FILTRE[net(e.getAttribute('data-rlf'))] || null }],
    ['.rl-p', function (e) { var h = net(e.querySelector('h3') && e.querySelector('h3').textContent); return h ? h + ' : ' + min(e.querySelector('p') && e.querySelector('p').textContent) : null }],
    ['.ss-facts dd', function (e) { return /€/.test(e.textContent) ? 'Le tarif est indicatif : le devis définitif arrive après un échange, sans surprise.' : null }],
    ['.dv-stage', function () { return 'Voilà à quoi ça ressemble concrètement : des écrans clairs, pensés pour vos clients.' }],
    ['.inc-b li', function (e) { return 'Inclus : ' + min(e.textContent) }],
    ['.pr-st', function (e) { var h = net(e.querySelector('h3') && e.querySelector('h3').textContent), p = net(e.querySelector('p') && e.querySelector('p').textContent), n = net(e.querySelector('small') && e.querySelector('small').textContent); return n && h ? n + ' : ' + h + '. ' + p : null }],
    ['.tp-c', function (e) { var h = net(e.querySelector('h3') && e.querySelector('h3').textContent); return h ? 'Conseil : ' + min(h) + '. ' + net(e.querySelector('p') && e.querySelector('p').textContent) : null }],
    ['.rel-c', function (e) { var b = net(e.querySelector('b') && e.querySelector('b').textContent); return b ? 'Souvent associé : ' + b + '. Les deux se renforcent.' : null }],
    ['main .hero .cta .btn, .ss-mid .btn', function () { return 'Un appel de 30 minutes, sans engagement : on regarde votre projet ensemble.' }]
  ]
  // Sections : phrase dite la première fois qu'elles arrivent à l'écran
  var SECTIONS = [
    ['.sg-sec', 'Sept expertises, une seule équipe : choisissez, on s’occupe du reste.'],
    ['.ns-guide', 'Pas sûr de ce qu’il vous faut ? Cette liste vous oriente en une phrase.'],
    ['.ns-par', 'Les services se combinent : chacun renforce les autres.'],
    ['.wl-sec', 'Quelques écrans de projets réels. Passez la souris pour mettre le défilement en pause.'],
    ['.rl-sec', 'Quatre projets, chacun avec ses vrais écrans. Un clic ouvre le site.'],
    ['.rl-pr', 'Le même soin sur chaque projet : design sur mesure, mobile, Google, suivi.'],
    ['.ss-facts-sec', 'En clair, pour qui, et à partir de quel prix : tout est dit ici.'],
    ['.dv-sec', 'Concrètement, voici ce que vous obtenez.'],
    ['.inc-sec', 'Tout ce qui est inclus, rangé en deux listes. Rien de caché.'],
    ['.pr-sec', 'Notre manière de faire, étape par étape : vous savez toujours où on en est.'],
    ['.tp-sec', 'Trois réflexes à adopter dès aujourd’hui, avec ou sans nous.'],
    ['.cbk', 'Un projet en tête ? Un appel de 30 minutes suffit pour démarrer.']
  ]

  var parole = function (texte, cle, duree) {
    if (!texte || !window.mascotteSay) return
    if (getComputedStyle(el).display === 'none' || document.hidden) return
    dernier = Date.now(); window.mascotteSay(texte, duree || 4600, cle)
  }
  // survol (souris seulement), avec une pause minimale entre deux phrases
  if (matchMedia('(hover: hover)').matches) {
    document.addEventListener('pointerover', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return
      if (el.contains(e.target)) return
      var now = Date.now(); if (now - derniereHeure < 1400) return
      for (var i = 0; i < SURVOL.length; i++) {
        var c = e.target.closest && e.target.closest(SURVOL[i][0]); if (!c || c === dernierEl) continue
        var t = SURVOL[i][1](c); if (!t) continue
        dernierEl = c; derniereHeure = now; parole(t, 'h' + i + (c.textContent || '').length, 4800); return
      }
    }, { passive: true })
  }
  // clic sur un bouton d'appel à l'action, une carte de service ou un projet
  document.addEventListener('click', function (e) {
    if (el.contains(e.target)) return
    var a = e.target.closest && e.target.closest('a'); if (!a) return
    var h = a.getAttribute('href') || ''
    if (/contactez-nous/.test(h)) parole('Excellent choix ! On vous répond très vite.', 'clic-contact', 2600)
    else if (a.classList.contains('sg-c')) parole('Bon choix : je vous emmène voir ce service en détail.', 'clic-svc', 2600)
    else if (a.classList.contains('rl-c')) parole('Le projet s’ouvre dans un nouvel onglet : bonne visite !', 'clic-projet', 2600)
  })
  // sections qui arrivent à l'écran : une phrase par section, seulement si le visiteur s'y arrête
  if ('IntersectionObserver' in window) {
    var vues = {}
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        var k = en.target.__ms; if (!en.isIntersecting || vues[k]) return
        setTimeout(function () {
          var r = en.target.getBoundingClientRect()
          if (vues[k] || Date.now() - dernier < 5000 || r.bottom < innerHeight * 0.25 || r.top > innerHeight * 0.75) return
          vues[k] = 1; parole(SECTIONS[k][1], 's' + k, 5200)
        }, 900)
      })
    }, { threshold: 0.35 })
    SECTIONS.forEach(function (s, k) { var n = document.querySelector(s[0]); if (!n) return; n = n.closest('section') || n; n.__ms = k; io.observe(n) })
  }
  // accueil, puis conseil après un moment sans activité
  setTimeout(function () { parole(ACCUEIL[page], 'accueil', 5200) }, 2600)
  var rang = 0
  setInterval(function () { if (Date.now() - dernier > 17000) { parole(IDLE[rang % IDLE.length], 'idle' + rang, 5200); rang++ } }, 4000)
})()
