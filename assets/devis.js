/* Page publique /devis/ : choix des services, total en direct, envoi de la demande.
   La demande est enregistrée dans ce navigateur (store.js) ET envoyée au serveur (Netlify Forms) pour que l'agence la reçoive.
   shortcut: l'envoi serveur n'existe qu'une fois le site déployé sur Netlify ; en local il échoue et le message le dit. */
(function () {
  var S = window.CreatigoStore, qty = {}, cat = []
  var $ = function (id) { return document.getElementById(id) }
  function el(t, a, kids) {
    var e = document.createElement(t)
    for (var k in a || {}) { if (k === 'text') e.textContent = a[k]; else e.setAttribute(k, a[k]) }
    ;(kids || []).forEach(function (c) { e.appendChild(c) })
    return e
  }
  function items() { var o = []; cat.forEach(function (c) { c.items.forEach(function (i) { o.push(i) }) }); return o }
  function lignes() { return items().filter(function (i) { return qty[i.id] > 0 }).map(function (i) { return S.ligne(i, qty[i.id]) }) }

  function renderRecap() {
    var d = { lignes: lignes() }, t = S.calc(d), box = $('recap'), bar = $('dv-bar')
    box.textContent = ''
    if (!d.lignes.length) {
      box.appendChild(el('p', { class: 'lead', text: 'Aucun service sélectionné pour le moment.' }))
      if (bar) bar.hidden = true
      return
    }
    var ul = el('ul', { class: 'rl' })
    d.lignes.forEach(function (l) {
      ul.appendChild(el('li', {}, [el('span', { text: l.qty + ' × ' + l.nom }), el('b', { text: S.eur(l.qty * l.prix) + (l.rec ? ' /mois' : '') })]))
    })
    box.appendChild(ul)
    if (t.uniqueHT) box.appendChild(el('p', { class: 'tot', text: 'Prestations ponctuelles : ' + S.eur(t.uniqueHT) + ' HT (' + S.eur(t.uniqueTTC) + ' TTC)' }))
    if (t.mensuelHT) box.appendChild(el('p', { class: 'tot', text: 'Abonnements : ' + S.eur(t.mensuelHT) + ' HT /mois (' + S.eur(t.mensuelTTC) + ' TTC)' }))
    // barre de total toujours visible sur mobile (le récapitulatif est sous la liste)
    if (bar) {
      var parts = []
      if (t.uniqueHT) parts.push(S.eur(t.uniqueHT) + ' HT')
      if (t.mensuelHT) parts.push(S.eur(t.mensuelHT) + ' HT/mois')
      $('dv-bar-t').textContent = d.lignes.length + ' service' + (d.lignes.length > 1 ? 's' : '') + ' · ' + parts.join(' + ')
      bar.hidden = false
    }
  }

  function renderCatalogue() {
    var root = $('catalogue'); root.textContent = ''
    cat.forEach(function (c) {
      if (!c.items.length) return
      var sec = el('section', { class: 'dcat' }, [el('h2', { text: c.nom })])
      c.items.forEach(function (i) {
        var id = 'q-' + i.id
        var inp = el('input', { type: 'number', min: '0', max: '99', value: String(qty[i.id] || 0), id: id, 'aria-label': 'Quantité : ' + i.nom })
        inp.addEventListener('input', function () { qty[i.id] = Math.max(0, Math.min(99, parseInt(inp.value, 10) || 0)); row.classList.toggle('on', qty[i.id] > 0); renderRecap() })
        var row = el('div', { class: 'ditem' + (qty[i.id] > 0 ? ' on' : '') }, [
          el('div', {}, [el('h3', { text: i.nom }), el('p', { text: i.desc })]),
          el('div', { class: 'dprix' }, [el('b', { text: S.eur(i.prix) + ' HT' }), el('small', { text: i.rec ? 'par mois' : 'par ' + i.unite }), inp]),
        ])
        sec.appendChild(row)
      })
      root.appendChild(sec)
    })
  }

  $('df').addEventListener('submit', function (e) {
    e.preventDefault()
    var form = this, l = lignes(), msg = $('dmsg')
    if (!l.length) { msg.className = 'ko'; msg.textContent = 'Choisissez au moins un service dans la liste.'; return }
    var f = new FormData(form), t = S.calc({ lignes: l})
    // résumé lisible pour l'agence, joint à la demande envoyée au serveur
    $('dv-services').value = l.map(function (x) { return x.qty + ' × ' + x.nom + ' (' + S.eur(x.prix) + ' HT' + (x.rec ? '/mois' : '') + ')' }).join(' ; ')
    $('dv-total').value = (t.uniqueHT ? S.eur(t.uniqueHT) + ' HT ponctuel' : '') + (t.uniqueHT && t.mensuelHT ? ' + ' : '') + (t.mensuelHT ? S.eur(t.mensuelHT) + ' HT/mois' : '')
    var btn = form.querySelector('button[type=submit]'); btn.disabled = true
    msg.className = ''; msg.textContent = 'Envoi en cours…'
    // envoi vers la base de l'agence (numéro de devis attribué par la base) + e-mail Netlify ; en dernier recours, gardé sur cet appareil
    S.sendForm('devis', form, { lignes: l.map(function (x) { return { itemId: x.itemId, nom: x.nom, desc: x.desc, prix: x.prix, unite: x.unite, rec: x.rec, qty: x.qty } }) }).then(function (r) {
      if (r.ok) return { sent: true, ref: r.db && r.db.ref }
      return S.saveDevis({ statut: 'nouveau', source: 'site', remise: 0, client: { nom: f.get('nom'), email: f.get('email'), tel: f.get('tel') || '', societe: f.get('soc') || '' }, notes: f.get('msg') || '', lignes: l })
        .then(function (d) { return { sent: false, ref: d.ref } })
    }).then(function (x) {
      msg.className = x.sent ? 'ok' : 'ko'
      msg.textContent = x.sent
        ? 'Merci ! Votre demande' + (x.ref ? ' ' + x.ref : '') + ' est bien envoyée. Nous revenons vers vous avec un devis définitif.'
        : 'Votre demande ' + x.ref + ' est enregistrée sur cet appareil, mais son envoi n’a pas abouti. Écrivez-nous par e-mail pour qu’elle nous parvienne.'
      if (x.sent) { qty = {}; form.reset(); renderCatalogue(); renderRecap() }
      btn.disabled = false
    })
  })

  ;(S.publicCatalogue ? S.publicCatalogue() : S.catalogue()).then(function (c) { cat = c; renderCatalogue(); renderRecap() })
})()
