/* Formulaire de contact : validation dans le navigateur, messages d'erreur, envoi au serveur (Netlify Forms), confirmation.
   Sans JavaScript, le formulaire s'envoie quand même (POST classique) et revient sur la page avec ?envoye=1.
   shortcut: l'anti-spam est un champ piège (honeypot) ; ajouter reCAPTCHA / Turnstile si le spam devient un problème. */
(function () {
  var f = document.getElementById('f'), msg = document.getElementById('fmsg')
  if (!f) return
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  var OK = 'Merci ! Votre message est bien parti. Nous revenons vers vous rapidement.'
  var RULES = {
    nom: function (v) { return v.trim() ? '' : 'Indiquez votre nom.' },
    email: function (v) { return !v.trim() ? 'Indiquez votre e-mail.' : EMAIL.test(v.trim()) ? '' : 'Cette adresse e-mail semble incorrecte.' },
    msg: function (v) { return v.trim().length >= 10 ? '' : 'Décrivez votre projet en quelques mots (10 caractères minimum).' },
    consent: function (_, el) { return el.checked ? '' : 'Votre accord est nécessaire pour traiter la demande.' },
  }
  function check(name) {
    var el = f.elements[name], err = f.querySelector('.err[data-for="' + name + '"]'), m = RULES[name](el.value, el)
    err.textContent = m; err.id = 'e-' + name
    el.setAttribute('aria-invalid', m ? 'true' : 'false')
    if (m) el.setAttribute('aria-describedby', 'e-' + name); else el.removeAttribute('aria-describedby')
    return !m
  }
  Object.keys(RULES).forEach(function (n) {
    f.elements[n].addEventListener('blur', function () { check(n) })
    f.elements[n].addEventListener('input', function () { if (f.elements[n].getAttribute('aria-invalid') === 'true') check(n) })
  })
  function say(text, ok) { msg.textContent = text; msg.className = ok ? 'ok' : 'ko' }
  if (/[?&]envoye=1/.test(location.search)) say(OK, true)

  f.addEventListener('submit', function (e) {
    e.preventDefault()
    var bad = Object.keys(RULES).filter(function (n) { return !check(n) })
    if (bad.length) { f.elements[bad[0]].focus(); say('Merci de corriger les champs signalés.', false); return }
    var btn = f.querySelector('button[type=submit]')
    btn.disabled = true; say('Envoi en cours…', true)
    // base de l'agence (visible dans l'admin) + e-mail Netlify : réussi si l'un des deux passe
    var S = window.CreatigoStore
    var envoi = S && S.sendForm ? S.sendForm('contact', f).then(function (r) { if (!r.ok) throw new Error('envoi') })
      : fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(f)).toString() }).then(function (r) { if (!r.ok) throw new Error(r.status) })
    envoi
      .then(function () { f.reset(); say(OK, true) })
      .catch(function () { say('L’envoi n’a pas abouti. Réessayez, ou écrivez-nous directement par e-mail.', false) })
      .then(function () { btn.disabled = false })
  })
})()
