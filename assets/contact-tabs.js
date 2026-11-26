// Page Contact : deux façons de nous joindre (calendrier ou message), un seul écran. Clavier : flèches gauche/droite.
(function () {
  var tabs = [].slice.call(document.querySelectorAll('.ct-tab')); if (!tabs.length) return
  var panels = { rdv: document.getElementById('ct-p1'), message: document.getElementById('ct-p2') }
  function show(k, focus) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-t') === k
      t.classList.toggle('on', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1
      if (on && focus) t.focus()
    })
    panels.rdv.hidden = k !== 'rdv'; panels.message.hidden = k !== 'message'
    try { history.replaceState(null, '', k === 'message' ? '#message' : location.pathname + location.search) } catch (e) {}
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { show(t.getAttribute('data-t')) })
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show(tabs[(i + 1) % tabs.length].getAttribute('data-t'), true) }
    })
  })
  if (location.hash === '#message' || /[?&]envoye=1/.test(location.search)) show('message')
})()
