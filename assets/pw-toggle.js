/* Bouton « œil » pour afficher / masquer un mot de passe (connexion admin, espace client, choix du mot de passe).
   S'applique à tous les champs mot de passe de la page, y compris ceux créés après coup (formulaires de l'espace client). */
(function () {
  var EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'
  var EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17.3 17.3 0 0 0 2 12s3.6 7 10 7a10.6 10.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'
  function enhance(input) {
    if (input.dataset.pw) return
    input.dataset.pw = '1'
    var wrap = document.createElement('span'); wrap.className = 'pw-w'
    input.parentNode.insertBefore(wrap, input); wrap.appendChild(input)
    var b = document.createElement('button')
    b.type = 'button'; b.className = 'pw-eye'; b.setAttribute('aria-label', 'Afficher le mot de passe'); b.setAttribute('aria-pressed', 'false'); b.innerHTML = EYE
    function set(show) {
      input.type = show ? 'text' : 'password'
      b.innerHTML = show ? EYE_OFF : EYE
      b.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe')
      b.setAttribute('aria-pressed', show ? 'true' : 'false')
    }
    b.addEventListener('click', function () { set(input.type === 'password'); input.focus() })
    // formulaire envoyé : on remasque
    if (input.form) input.form.addEventListener('submit', function () { set(false) })
    wrap.appendChild(b)
  }
  function scan(root) { (root.querySelectorAll ? root.querySelectorAll('input[type=password]:not([data-pw])') : []).forEach(enhance) }
  function start() {
    scan(document)
    new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.matches && n.matches('input[type=password]')) enhance(n); else scan(n) } }) }) })
      .observe(document.body, { childList: true, subtree: true })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start()
})()
