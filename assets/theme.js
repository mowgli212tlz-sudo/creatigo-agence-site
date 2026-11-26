/* Thème clair / sombre (admin et espace client). Suit le réglage de l'appareil (ou data-theme-defaut sur <html>, sombre pour l'admin comme l'appli RH) tant que l'utilisateur n'a pas choisi, puis garde son choix.
   Les boutons portent l'attribut data-theme-toggle. */
(function () {
  var K = 'creatigo.theme', d = document.documentElement, mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null
  function saved() { try { var v = localStorage.getItem(K); return v === 'dark' || v === 'light' ? v : null } catch (e) { return null } }
  function cur() { return saved() || d.getAttribute('data-theme-defaut') || (mq && mq.matches ? 'dark' : 'light') }
  function apply() { d.setAttribute('data-theme', cur()); var b = document.querySelectorAll('[data-theme-toggle]'); for (var i = 0; i < b.length; i++) b[i].setAttribute('aria-pressed', cur() === 'dark' ? 'true' : 'false') }
  apply()
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (!saved()) apply() })
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-theme-toggle]'); if (!t) return
    try { localStorage.setItem(K, cur() === 'dark' ? 'light' : 'dark') } catch (x) { d.setAttribute('data-theme', cur() === 'dark' ? 'light' : 'dark') }
    apply()
  })
  document.addEventListener('DOMContentLoaded', apply)
  window.CreatigoTheme = { current: cur, apply: apply }
})()
