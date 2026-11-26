/* Prise de rendez-vous : calendrier, créneaux, formulaire (Netlify Forms), confirmation et fichier agenda (.ics).
   Les créneaux sont des propositions : chaque rendez-vous est confirmé par e-mail (il n'y a pas encore d'agenda relié).
   Texte saisi par le visiteur : toujours textContent, jamais innerHTML.
   shortcut: pas de contrôle de disponibilité réelle ; relier un agenda (Google Calendar, Cal.com) quand l'équipe est prête. */
(function () {
  var root = document.getElementById('rv'); if (!root) return
  var DEBUT = +root.dataset.debut, FIN = +root.dataset.fin, PAS = +root.dataset.pas, JOURS = +root.dataset.jours
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
  var JOUR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  var $ = function (id) { return document.getElementById(id) }
  var days = $('rv-days'), slots = $('rv-slots'), title = $('rv-title'), f = $('rvf'), msg = $('rvmsg')
  var now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  var last = new Date(today.getTime() + JOURS * 864e5)
  var view = new Date(today.getFullYear(), today.getMonth(), 1), pickD = null, pickH = null
  var p2 = function (n) { return (n < 10 ? '0' : '') + n }
  var ymd = function (d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) }
  var libre = function (d) { return d >= today && d <= last && d.getDay() % 6 !== 0 }
  var long = function (d) { return JOUR[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] }

  function draw() {
    title.textContent = MOIS[view.getMonth()] + ' ' + view.getFullYear()
    days.textContent = ''
    var first = (view.getDay() + 6) % 7, n = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
    for (var i = 0; i < first; i++) days.appendChild(document.createElement('span'))
    for (var k = 1; k <= n; k++) {
      var d = new Date(view.getFullYear(), view.getMonth(), k), b = document.createElement('button')
      b.type = 'button'; b.textContent = k; b.disabled = !libre(d)
      if (+d === +today) b.className = 'today'
      if (pickD && +d === +pickD) { b.className += ' sel'; b.setAttribute('aria-pressed', 'true') }
      b.setAttribute('aria-label', long(d)); (function (dd) { b.addEventListener('click', function () { pick(dd) }) })(d)
      days.appendChild(b)
    }
    $('rv-prev').disabled = view <= new Date(today.getFullYear(), today.getMonth(), 1)
    $('rv-next').disabled = new Date(view.getFullYear(), view.getMonth() + 1, 1) > last
  }
  function pick(d) { pickD = d; pickH = null; $('rv-date').value = ymd(d); $('rv-heure').value = ''; $('rv-dayl').textContent = '· ' + long(d); draw(); drawSlots(); sum() }
  function drawSlots() {
    slots.textContent = ''
    var min = new Date(now.getTime() + 2 * 36e5), ok = 0
    for (var m = DEBUT * 60; m + PAS <= FIN * 60; m += PAS) {
      var h = p2(Math.floor(m / 60)) + ':' + p2(m % 60), at = new Date(pickD.getFullYear(), pickD.getMonth(), pickD.getDate(), Math.floor(m / 60), m % 60)
      var b = document.createElement('button'); b.type = 'button'; b.textContent = h.replace(':', ' h ').replace(' h 00', ' h'); b.disabled = at < min
      if (!b.disabled) ok++
      b.setAttribute('aria-pressed', pickH === h ? 'true' : 'false'); if (pickH === h) b.className = 'sel'
      ;(function (hh) { b.addEventListener('click', function () { pickH = hh; $('rv-heure').value = hh; drawSlots(); sum() }) })(h)
      slots.appendChild(b)
    }
    if (!ok) { var p = document.createElement('p'); p.className = 'rv-hint'; p.textContent = 'Plus de créneau ce jour-là : choisissez un autre jour.'; slots.appendChild(p) }
  }
  function sum() {
    $('rv-sumt').textContent = pickD ? long(pickD) + (pickH ? ' à ' + pickH.replace(':', ' h ').replace(' h 00', ' h') : '') : 'Aucun créneau choisi'
  }
  $('rv-prev').addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); draw() })
  $('rv-next').addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); draw() })

  var RULES = {
    nom: function (v) { return v.trim() ? '' : 'Indiquez votre nom.' },
    email: function (v) { return !v.trim() ? 'Indiquez votre e-mail.' : EMAIL.test(v.trim()) ? '' : 'Cette adresse e-mail semble incorrecte.' },
    consent: function (_, el) { return el.checked ? '' : 'Votre accord est nécessaire pour organiser le rendez-vous.' },
  }
  function check(name) {
    var el = f.elements[name], err = f.querySelector('.err[data-for="' + name + '"]'), m = RULES[name](el.value, el)
    err.textContent = m; el.setAttribute('aria-invalid', m ? 'true' : 'false'); return !m
  }
  Object.keys(RULES).forEach(function (n) { f.elements[n].addEventListener('blur', function () { check(n) }) })
  function say(t, ok) { msg.textContent = t; msg.className = ok ? 'ok' : 'ko' }

  function ics() {
    var d = pickD, h = pickH.split(':'), s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), +h[0], +h[1]), e = new Date(s.getTime() + 30 * 6e4)
    var t = function (x) { return x.getFullYear() + p2(x.getMonth() + 1) + p2(x.getDate()) + 'T' + p2(x.getHours()) + p2(x.getMinutes()) + '00' }
    var txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Creatigo//Rendez-vous//FR', 'BEGIN:VEVENT', 'UID:' + t(s) + '@creatigo', 'DTSTAMP:' + t(now), 'DTSTART;TZID=Europe/Paris:' + t(s), 'DTEND;TZID=Europe/Paris:' + t(e), 'SUMMARY:Rendez-vous Creatigo (à confirmer)', 'DESCRIPTION:Demande de rendez-vous envoyée à Creatigo. Un e-mail de confirmation suivra.', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(txt)
  }
  if (/[?&]envoye=rdv/.test(location.search)) say('Merci ! Votre demande est bien partie.', true)
  f.addEventListener('submit', function (e) {
    e.preventDefault()
    if (!pickD || !pickH) { say('Choisissez un jour et un créneau dans le calendrier.', false); return }
    var bad = Object.keys(RULES).filter(function (n) { return !check(n) })
    if (bad.length) { f.elements[bad[0]].focus(); say('Merci de corriger les champs signalés.', false); return }
    var btn = $('rv-go'); btn.disabled = true; say('Envoi en cours…', true)
    var S = window.CreatigoStore
    var envoi = S && S.sendForm ? S.sendForm('rdv', f).then(function (r) { if (!r.ok) throw new Error('envoi') })
      : fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(f)).toString() }).then(function (r) { if (!r.ok) throw new Error(r.status) })
    envoi
      .then(function () {
        $('rv-okt').textContent = 'Nous avons bien reçu votre demande pour le ' + long(pickD) + ' à ' + pickH.replace(':', ' h ').replace(' h 00', ' h') + '. Nous la confirmons par e-mail.'
        $('rv-ics').href = ics(); say('', true); f.hidden = true; $('rv-ok').hidden = false; $('rv-ok').scrollIntoView({ block: 'center' })
      })
      .catch(function () { say('L’envoi n’a pas abouti. Réessayez, ou écrivez-nous directement par e-mail.', false); btn.disabled = false })
  })
  draw()
})()
