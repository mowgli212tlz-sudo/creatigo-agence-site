/* Coquille commune de l'espace agence et de l'espace client : la même que l'appli RH Creatigo.
   - icônes [data-ic] du HTML dessinées avec le jeu d'icônes de l'appli
   - menu épinglé / replié au survol (data-barre sur <html>, gardé dans ce navigateur)
   - infobulles des graphiques
   - chaque page reçoit un en-tête en bandeau (titre, phrase, illustration) à partir de son <h1> et de son <p class="lead">
   window.UI vient de assets/app/kit.js (module chargé avant ce script). */
(function () {
  var UI = window.UI
  if (!UI) return

  // les anciens appels window.icone(nom, taille) gardent leur forme (du HTML), avec les icônes de l'appli
  var ancienne = window.icone
  window.icone = function (n, t) {
    var svg = UI.icone(n, t || 18)
    return svg.innerHTML ? svg.outerHTML : (ancienne ? ancienne(n, t) : '')
  }
  function dessinerIcones(racine) {
    var l = (racine || document).querySelectorAll('[data-ic]')
    for (var i = 0; i < l.length; i++) {
      var s = l[i]; if (s.firstChild) continue
      s.replaceWith(UI.icone(s.getAttribute('data-ic'), +(s.getAttribute('data-taille') || 18), s.className))
    }
  }

  // menu : épinglé (normal) ou replié en rail d'icônes qui s'ouvre au survol
  var K_BARRE = 'creatigo.barre'
  function lireBarre() { try { return localStorage.getItem(K_BARRE) || 'normale' } catch (e) { return 'normale' } }
  function appliquerBarre() {
    var v = lireBarre(); document.documentElement.setAttribute('data-barre', v)
    var b = document.getElementById('epingle'); if (!b) return
    var fixe = v === 'normale'
    b.setAttribute('aria-pressed', String(fixe))
    b.setAttribute('aria-label', fixe ? 'Replier le menu (il s’ouvrira au survol)' : 'Garder le menu ouvert')
    b.title = fixe ? 'Replier le menu' : 'Garder le menu ouvert'
  }
  appliquerBarre()

  // en-têtes de page : <h1> + <p class="lead"> deviennent le bandeau de l'appli RH
  // une mascotte du site par page (assets/mascotte/)
  var ILLU = { dashboard: 'm:mascotte3', clients: 'm:mk-agence', demandes: 'm:mascotte', rdv: 'm:mk-rdv', devis: 'm:mk-blog', factures: 'm:mk-tablette', catalogue: 'm:mk-services', projets: 'm:mk-services', site: 'm:mk-realisations', donnees: 'm:mk-loupe', equipe: 'm:mk-agence', journal: 'm:mk-loupe', refuse: 'm:mascotte2' }
  function habiller(main) {
    // le bandeau et ses indicateurs restent en pleine largeur, au-dessus des colonnes
    var ent = main.querySelector('.entete')
    if (ent && ent.parentNode !== main) { main.insertBefore(ent, main.firstChild); var kp = main.querySelector('.grille.kpi.coque-kpi'); if (kp) ent.after(kp) }
    var h1 = main.querySelector(':scope > h1, :scope > .pt-main > h1')
    if (!h1 || h1.closest('.entete')) return
    var lead = h1.nextElementSibling && h1.nextElementSibling.matches('p.lead') ? h1.nextElementSibling : main.querySelector(':scope > .page > .page-main > p.lead:first-child')
    var route = main.getAttribute('data-vue') || ''
    var bandeau = UI.entete('', lead ? lead.textContent : '', ILLU[route] || '')
    var nouveau = bandeau.querySelector('h1'); nouveau.replaceWith(h1)
    h1.parentNode.insertBefore(h1, h1.parentNode.firstChild)
    if (lead) lead.remove()
    // la phrase vide (aucune) ne laisse pas de <p> vide
    var p = bandeau.querySelector('p'); if (p && !p.textContent) p.remove()
    main.insertBefore(bandeau, main.firstChild)
    // rangée d'indicateurs de la page (fournie par la page : window.CoqueKpi[route]())
    var f = window.CoqueKpi && window.CoqueKpi[route + (location.hash.split('/')[1] ? '/' : '')]
    if (f) Promise.resolve(f()).then(function (tuiles) {
      if (!tuiles || !tuiles.length || !bandeau.isConnected) return
      var g = UI.h('div', { class: 'grille kpi coque-kpi' }, tuiles); bandeau.after(g)
    })
  }
  function surveiller(main) {
    if (!main) return
    new MutationObserver(function () { habiller(main); dessinerIcones(main) }).observe(main, { childList: true, subtree: true })
  }

  // recherche de la barre du haut : pages du menu + données fournies par la page (window.CoqueRecherche)
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() }
  function installerRecherche() {
    var champ = document.getElementById('rg'), panneau = document.getElementById('rg-p'), liste = document.getElementById('rg-liste')
    if (!champ) return
    var options = [], actif = -1, tour = 0
    function fermer() { panneau.hidden = true; champ.setAttribute('aria-expanded', 'false'); actif = -1 }
    function marquer(i) { actif = i; options.forEach(function (o, k) { o.el.classList.toggle('actif', k === i); o.el.setAttribute('aria-selected', String(k === i)) }); if (options[i]) options[i].el.scrollIntoView({ block: 'nearest' }) }
    function choisir(i) { var o = options[i]; if (!o) return; fermer(); champ.value = ''; champ.blur(); location.hash = o.h }
    function dessiner() {
      var q = norm(champ.value.trim()), mon = ++tour
      if (!q) { fermer(); return }
      var pages = [].slice.call(document.querySelectorAll('#menu a')).map(function (a) { return { t: a.textContent.trim(), s: 'Page', h: a.getAttribute('href'), ic: a.getAttribute('data-icone') || 'layout-dashboard' } })
      Promise.resolve(window.CoqueRecherche ? window.CoqueRecherche() : []).then(function (autres) {
        if (mon !== tour) return
        var tout = pages.concat(autres || []).filter(function (x) { return norm(x.t + ' ' + (x.s || '')).indexOf(q) > -1 }).slice(0, 9)
        liste.textContent = ''; options = []
        if (!tout.length) liste.appendChild(UI.h('li', { class: 'rg-vide' }, 'Aucun résultat pour « ' + champ.value.trim() + ' ».'))
        var groupe = ''
        tout.forEach(function (x) {
          var g = x.s === 'Page' ? 'Pages' : (x.g || 'Résultats')
          if (g !== groupe) { groupe = g; liste.appendChild(UI.h('li', { class: 'rg-groupe', role: 'presentation' }, g)) }
          var i = options.length
          var li = UI.h('li', { class: 'rg-option', role: 'option', id: 'rg-o-' + i, 'aria-selected': 'false', onmousedown: function (e) { e.preventDefault() }, onclick: function () { choisir(i) }, onmousemove: function () { if (actif !== i) marquer(i) } },
            UI.h('span', { class: 'rg-puce', 'aria-hidden': 'true' }, UI.icone(x.ic || 'search', 15)),
            UI.h('span', { class: 'rg-texte' }, UI.h('b', {}, x.t), x.s ? UI.h('small', {}, x.s) : null))
          options.push({ el: li, h: x.h }); liste.appendChild(li)
        })
        panneau.hidden = false; champ.setAttribute('aria-expanded', 'true'); marquer(options.length ? 0 : -1)
      })
    }
    champ.addEventListener('input', dessiner)
    champ.addEventListener('focus', function () { if (champ.value.trim()) dessiner() })
    champ.addEventListener('blur', function () { setTimeout(fermer, 120) })
    champ.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); marquer(Math.min(options.length - 1, actif + 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); marquer(Math.max(0, actif - 1)) }
      else if (e.key === 'Enter') { e.preventDefault(); choisir(actif < 0 ? 0 : actif) }
      else if (e.key === 'Escape') { fermer(); champ.blur() }
    })
    // « / » place le curseur dans la recherche, comme dans l'appli RH
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      var t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return
      if (champ.offsetParent === null) return
      e.preventDefault(); champ.focus()
    })
  }

  // monte la coquille présente dans la page (appelé au chargement, et par l'espace client après chaque dessin)
  function monter() {
    dessinerIcones(document)
    appliquerBarre()
    var ep = document.getElementById('epingle')
    if (ep && !ep.dataset.pret) { ep.dataset.pret = '1'; ep.addEventListener('click', function () { try { localStorage.setItem(K_BARRE, lireBarre() === 'normale' ? 'auto' : 'normale') } catch (e) {} appliquerBarre() }) }
    var main = document.getElementById('main')
    if (main && !main.dataset.pret) { main.dataset.pret = '1'; surveiller(main) }
    var rg = document.getElementById('rg')
    if (rg && !rg.dataset.pret) { rg.dataset.pret = '1'; installerRecherche() }
    var cadre = document.querySelector('.cadre'), burger = document.getElementById('burger'), voile = document.getElementById('voile')
    if (burger && !burger.dataset.pret) { burger.dataset.pret = '1'; burger.addEventListener('click', function () { cadre.classList.toggle('menu-ouvert') }) }
    if (voile && !voile.dataset.pret) { voile.dataset.pret = '1'; voile.addEventListener('click', function () { cadre.classList.remove('menu-ouvert') }) }
  }
  var bulles = false
  function demarrer() {
    if (!bulles) { bulles = true; UI.G.installerBulles() }
    monter()
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer()
  window.Coque = { dessinerIcones: dessinerIcones, habiller: habiller, monter: monter }
})()
