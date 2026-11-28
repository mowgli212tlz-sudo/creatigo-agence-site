/* Espace client : page « Facturation » (phase 4).
   Devis partagés par l'agence (lecture, choix des options, acceptation signée ou refus), contrats à signer, factures et reste à payer.
   La sécurité est dans la base : le client ne lit que ses vues (client_quotes, client_invoices, client_contracts) et ne répond que
   par les fonctions client_repondre_devis / client_signer_contrat, qui vérifient tout. Textes affichés via textContent uniquement. */
(function () {
  var TVA = 0.2
  function eur(n) { return (+n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) }
  function date(iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—' }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) }
  // même calcul que la base : option comptée seulement si choisie, remise, TVA non applicable
  function totaux(x, choix) {
    var u = 0, m = 0
    ;(x.lignes || []).forEach(function (l, i) {
      var prise = !l.option || (choix ? choix.indexOf(i) >= 0 : l.choisie)
      if (!prise) return
      var t = (+l.prix || 0) * (+l.qty || 0); if (l.rec) m += t; else u += t
    })
    var r = Math.min(Math.max(+x.remise || 0, 0), 100) / 100, taux = x.tva_applicable === false ? 0 : TVA
    return { ht: u * (1 - r), mensuel: m * (1 - r), ttc: u * (1 - r) * (1 + taux), mensuelTtc: m * (1 - r) * (1 + taux), taux: taux }
  }
  var ST_DEVIS = { envoye: ['À valider', 'attention'], accepte: ['Accepté', 'bon'], refuse: ['Refusé', 'critique'], nouveau: ['En préparation', ''] }
  var ST_FACT = { envoyee: ['À régler', 'attention'], retard: ['En retard', 'critique'], payee: ['Réglée', 'bon'] }
  var TYPE_F = { facture: 'Facture', acompte: 'Acompte', avoir: 'Avoir' }
  // paiement en ligne (Stripe) : bouton affiché seulement si le serveur confirme que tout est configuré
  var enLigne = false, enLigneLu = null
  function lireEnLigne() { return enLigneLu || (enLigneLu = fetch('/api/paiement-session').then(function (r) { return r.ok ? r.json() : { actif: false } }).then(function (j) { enLigne = !!j.actif }, function () { enLigne = false })) }
  function payer(f) {
    var h = window.UI.h
    if (!enLigne || f.type === 'avoir' || f.statut === 'payee' || !(+f.reste > 0.5)) return null
    var b = h('button', { class: 'btn petit principal', type: 'button', onclick: function () {
      b.disabled = true; b.textContent = 'Ouverture…'
      window.CreatigoStore.auth.token().then(function (j) { return fetch('/api/paiement-session', { method: 'POST', headers: { Authorization: 'Bearer ' + j, 'Content-Type': 'application/json' }, body: JSON.stringify({ facture: f.id }) }) })
        .then(function (r) { return r.json().then(function (x) { if (!r.ok || !x.url) throw new Error(x.erreur || 'Paiement indisponible.'); location.href = x.url }) })
        .catch(function (er) { b.disabled = false; b.textContent = 'Payer en ligne'; window.UI.toast(er.message, 'erreur') })
    } }, 'Payer en ligne')
    return b
  }

  window.PortailFinances = function (ctx) {
    var h = ctx.h, UI = ctx.UI, S = ctx.S, ic = ctx.ic
    var sur = function (p) { return p.catch(function () { return [] }) }
    return Promise.all([sur(S.sb.get('client_quotes?select=*&order=created_at.desc')), sur(S.sb.get('client_invoices?select=*&order=date_emission.desc')), sur(S.sb.get('client_contracts?select=*&order=created_at.desc')), ctx.lire(true), lireEnLigne()]).then(function (r) {
      var devis = r[0], factures = r[1], contrats = r[2], d = r[3]
      var aValider = devis.filter(function (q) { return q.statut === 'envoye' && !(q.valable_jusqu && q.valable_jusqu < today()) })
      var aSigner = contrats.filter(function (k) { return k.statut === 'envoye' })
      var ouvertes = factures.filter(function (f) { return f.statut !== 'payee' && f.type !== 'avoir' })
      var reste = ouvertes.reduce(function (s, f) { return s + (+f.reste || 0) }, 0)
      var docs = d.documents.filter(function (x) { return ['devis', 'facture', 'contrat'].indexOf(x.categorie) >= 0 })

      var out = [ctx.enTetePage('Votre', 'facturation', 'Vos devis à valider, vos contrats à signer et vos factures, au même endroit.'),
        /paiement-ok/.test(location.hash) ? h('div', { class: 'ok', role: 'status' }, 'Merci ! Votre paiement est en cours de confirmation par Stripe : la facture sera marquée réglée dans quelques instants.') : null,
        h('div', { class: 'grille kpi' },
          UI.tuile('Devis à valider', String(aValider.length), aValider.length ? 'votre réponse est attendue' : 'rien en attente', aValider.length > 0, { icone: 'file-text' }),
          UI.tuile('Contrats à signer', String(aSigner.length), aSigner.length ? 'à lire et signer en ligne' : 'rien en attente', aSigner.length > 0, { icone: 'file-signature' }),
          UI.tuile('Reste à payer', eur(reste), ouvertes.length ? ouvertes.length + ' facture(s) à régler' : 'tout est réglé', ouvertes.some(function (f) { return f.statut === 'retard' }), { icone: 'receipt-text' }))]

      // ---------- devis ----------
      if (devis.length) out.push(UI.carte('Vos devis', devis.length + ' devis', h('div', { class: 'pf-liste' }, devis.map(function (q) { return carteDevis(q) }))))
      // ---------- contrats ----------
      if (contrats.length) out.push(UI.carte('Vos contrats', contrats.length + ' contrat(s)', h('div', { class: 'pf-liste' }, contrats.map(function (k) { return carteContrat(k) }))))
      // ---------- factures ----------
      if (factures.length) out.push(UI.carte('Vos factures', factures.length + ' document(s)', h('div', { class: 'table-zone', tabindex: '0', role: 'region', 'aria-label': 'Vos factures' }, h('table', {},
        h('thead', {}, h('tr', {}, ['N°', 'Type', 'Émise le', 'À régler avant', 'Total', 'Réglé', 'Reste', 'Statut', ''].map(function (x, i) { return h('th', { class: i >= 4 && i <= 6 ? 'num' : null, scope: 'col' }, x) }))),
        h('tbody', {}, factures.map(function (f) {
          var st = ST_FACT[f.statut] || [f.statut, '']
          return h('tr', {}, h('td', {}, h('b', {}, f.ref)), h('td', {}, TYPE_F[f.type] || 'Facture'), h('td', {}, date(f.date_emission)), h('td', {}, f.type === 'avoir' ? '—' : date(f.echeance)),
            h('td', { class: 'num' }, eur(f.total_ttc)), h('td', { class: 'num' }, eur(f.paye)), h('td', { class: 'num' }, f.type === 'avoir' ? '—' : eur(f.reste)), h('td', {}, UI.badge(st[0], st[1])), h('td', {}, payer(f)))
        })))),
        factures.some(function (f) { return (f.echeancier || []).length && f.statut !== 'payee' }) ? h('div', { class: 'pf-ech' }, h('h3', {}, 'Vos prochaines échéances'), h('ul', {}, [].concat.apply([], factures.filter(function (f) { return f.statut !== 'payee' }).map(function (f) { return (f.echeancier || []).map(function (e) { return h('li', { class: e.date < today() ? 'retard' : '' }, h('span', {}, date(e.date)), h('b', {}, eur(e.montant)), h('small', {}, f.ref)) }) })))) : null,
        h('p', { class: 'discret petit pf-note' }, ic('info', 14), enLigne ? 'Payez par carte avec « Payer en ligne » (paiement sécurisé par Stripe), ou par virement (coordonnées sur la facture).' : 'Règlement par virement (coordonnées sur la facture).')))
      if (!devis.length && !contrats.length && !factures.length) out.push(UI.etatVide('Vos devis, contrats et factures apparaîtront ici dès que l’agence les partage.', 'receipt-text'))
      if (docs.length) out.push(ctx.listeDocuments(docs, '', d))
      out.push(h('p', { class: 'discret petit', style: 'display:flex;gap:8px;align-items:center' }, ic('info', 14), 'Une question sur un devis ou une facture ? ', h('a', { href: '#nouvelle' }, 'Écrivez-nous'), '.'))
      return out

      function carteDevis(q) {
        var st = ST_DEVIS[q.statut] || [q.statut, ''], expire = q.statut === 'envoye' && q.valable_jusqu && q.valable_jusqu < today()
        var enAttente = q.statut === 'envoye' && !expire
        var choix = (q.lignes || []).map(function (l, i) { return l.option && l.choisie ? i : -1 }).filter(function (i) { return i >= 0 })
        var totBox = h('div', { class: 'pf-tot' })
        function majTot() {
          var t = totaux(q, enAttente ? choix : null)
          totBox.replaceChildren(
            h('div', {}, h('span', {}, 'Total HT'), h('b', {}, eur(t.ht))),
            t.taux ? h('div', {}, h('span', {}, 'TVA 20 %'), h('b', {}, eur(t.ht * t.taux))) : h('div', { class: 'discret' }, h('span', {}, 'TVA non applicable, art. 293 B du CGI')),
            h('div', { class: 'pf-gros' }, h('span', {}, 'Total' + (t.taux ? ' TTC' : '')), h('b', {}, eur(t.ttc))),
            t.mensuel ? h('div', {}, h('span', {}, 'Puis chaque mois'), h('b', {}, eur(t.mensuelTtc))) : null,
            +q.acompte ? h('div', { class: 'discret' }, h('span', {}, 'Acompte à la commande (' + q.acompte + ' %)'), h('b', {}, eur(t.ttc * q.acompte / 100))) : null)
        }
        var lignes = h('table', { class: 'pf-lignes' }, h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Prestation'), h('th', { class: 'num', scope: 'col' }, 'Qté'), h('th', { class: 'num', scope: 'col' }, 'Total HT'))),
          h('tbody', {}, (q.lignes || []).map(function (l, i) {
            var cellule = [h('b', {}, l.nom), l.desc ? h('div', { class: 'discret petit' }, l.desc) : null, l.rec ? h('div', { class: 'discret petit' }, 'chaque mois') : null]
            if (l.option) {
              if (enAttente) {
                var cb = h('input', { type: 'checkbox', checked: choix.indexOf(i) >= 0, 'aria-label': 'Ajouter l’option ' + l.nom })
                cb.addEventListener('change', function () { if (cb.checked) choix.push(i); else choix = choix.filter(function (x) { return x !== i }); majTot() })
                cellule.unshift(h('label', { class: 'pf-opt' }, cb, h('span', {}, 'Option')))
              } else cellule.push(h('span', { class: 'pf-badge-opt' }, l.choisie ? 'Option retenue' : 'Option non retenue'))
            }
            return h('tr', { class: l.option && !enAttente && !l.choisie ? 'pf-exclue' : null }, h('td', {}, cellule), h('td', { class: 'num' }, String(l.qty)), h('td', { class: 'num' }, eur((+l.prix || 0) * (+l.qty || 0))))
          })))
        majTot()
        var corps = h('div', { class: 'pf-corps', hidden: !enAttente },
          lignes, totBox,
          +q.remise ? h('p', { class: 'discret petit' }, 'Remise de ' + q.remise + ' % appliquée.') : null,
          q.conditions_paiement ? h('p', {}, h('b', {}, 'Conditions de paiement : '), q.conditions_paiement) : null,
          q.conditions_particulieres ? h('p', { class: 'pf-pre' }, h('b', {}, 'Conditions particulières : '), q.conditions_particulieres) : null)
        if (enAttente) corps.append(formReponse(q, function () { return choix }))
        if (q.acceptation) corps.append(h('div', { class: 'pf-ok' }, ic('circle-check', 16), h('span', {}, 'Accepté le ' + date(q.acceptation.le) + ' par ' + (q.acceptation.signataire || '') + '. Version conservée (empreinte ' + String(q.acceptation.version || '').slice(0, 12) + '…).')))
        if (q.refus) corps.append(h('div', { class: 'pf-ko' }, ic('circle-x', 16), h('span', {}, 'Refusé le ' + date(q.refus.le) + (q.refus.motif ? ' : ' + q.refus.motif : '') + '.')))
        if (expire) corps.append(h('p', { class: 'pf-ko' }, 'Ce devis a expiré le ' + date(q.valable_jusqu) + '. Demandez-nous une nouvelle version.'))
        var tete = h('button', { class: 'pf-tete', type: 'button', 'aria-expanded': String(enAttente), onclick: function () { corps.hidden = !corps.hidden; tete.setAttribute('aria-expanded', String(!corps.hidden)) } },
          h('span', { class: 'pf-tete-t' }, h('b', {}, q.ref + (q.titre ? ' · ' + q.titre : '')), h('small', { class: 'discret' }, 'Reçu le ' + date(q.created_at) + (q.valable_jusqu ? ' · valable jusqu’au ' + date(q.valable_jusqu) : ''))),
          h('span', { class: 'pf-tete-d' }, h('b', {}, eur(totaux(q, q.statut === 'envoye' ? choix : null).ttc)), UI.badge(expire ? 'Expiré' : st[0], expire ? 'critique' : st[1]), ic('chevron-down', 16)))
        return h('article', { class: 'pf-doc' + (enAttente ? ' attente' : '') }, tete, corps)
      }

      function formReponse(q, choixActuels) {
        var nom = h('input', { maxlength: '120', autocomplete: 'name', placeholder: 'Prénom et nom' })
        var accord = h('input', { type: 'checkbox' })
        var motif = h('textarea', { rows: '2', maxlength: '1000', placeholder: 'Facultatif : ce qui ne vous convient pas' })
        var msg = h('p', { class: 'erreur', role: 'alert', hidden: true })
        var dire = function (t) { msg.textContent = t; msg.hidden = !t }
        var refusZone = h('div', { class: 'pf-refus', hidden: true }, h('label', { class: 'champ' }, h('span', {}, 'Pourquoi ?'), motif),
          h('button', { class: 'btn', type: 'button', onclick: function (ev) {
            var b = ev.currentTarget; b.disabled = true
            S.rpc('client_repondre_devis', { qid: q.id, decision: 'refuse', signataire: '', motif: motif.value.trim(), options: [] })
              .then(function () { UI.toast('Votre réponse a été transmise à l’agence.', 'bon'); ctx.route() }, function (er) { dire(er.message.replace(/^Base : erreur \d+ /, '').replace(/^.*"message":"([^"]+)".*$/, '$1')); b.disabled = false })
          } }, 'Confirmer le refus'))
        return h('div', { class: 'pf-reponse' },
          h('h3', {}, 'Votre réponse'),
          h('label', { class: 'champ' }, h('span', {}, 'Vos nom et prénom (signature)'), nom),
          h('label', { class: 'pf-accord' }, accord, h('span', {}, 'J’ai lu ce devis et ses conditions, et je l’accepte avec les options cochées. Cette acceptation vaut bon pour accord.')),
          msg,
          h('div', { class: 'pf-actions' },
            h('button', { class: 'btn principal', type: 'button', onclick: function (ev) {
              dire('')
              if (nom.value.trim().length < 3) { dire('Indiquez vos nom et prénom.'); nom.focus(); return }
              if (!accord.checked) { dire('Cochez la case pour confirmer votre accord.'); return }
              var b = ev.currentTarget; b.disabled = true
              S.rpc('client_repondre_devis', { qid: q.id, decision: 'accepte', signataire: nom.value.trim(), motif: '', options: choixActuels() })
                .then(function () { UI.toast('Merci ! Devis accepté : votre projet est créé et l’agence est prévenue.', 'bon'); ctx.route() }, function (er) { dire(er.message.replace(/^Base : erreur \d+ /, '').replace(/^.*"message":"([^"]+)".*$/, '$1')); b.disabled = false })
            } }, ic('circle-check', 16), 'Accepter le devis'),
            h('button', { class: 'btn', type: 'button', onclick: function () { refusZone.hidden = !refusZone.hidden } }, 'Refuser')),
          refusZone)
      }

      function carteContrat(k) {
        var signe = k.statut === 'signe'
        var corps = h('div', { class: 'pf-corps', hidden: signe }, h('div', { class: 'pf-contrat', tabindex: '0', role: 'region', 'aria-label': 'Texte du contrat' }, k.contenu))
        if (signe && k.signature) corps.append(h('div', { class: 'pf-ok' }, ic('circle-check', 16), h('span', {}, 'Signé le ' + date(k.signature.le) + ' par ' + (k.signature.signataire || '') + '. ' + (k.signature.methode || ''))))
        if (!signe) {
          var nom = h('input', { maxlength: '120', autocomplete: 'name', placeholder: 'Prénom et nom' }), accord = h('input', { type: 'checkbox' })
          var msg = h('p', { class: 'erreur', role: 'alert', hidden: true })
          corps.append(h('div', { class: 'pf-reponse' }, h('h3', {}, 'Signer le contrat'),
            h('label', { class: 'champ' }, h('span', {}, 'Vos nom et prénom (signature)'), nom),
            h('label', { class: 'pf-accord' }, accord, h('span', {}, 'J’ai lu l’intégralité du contrat ci-dessus et je l’accepte. Je signe électroniquement.')),
            msg,
            h('div', { class: 'pf-actions' }, h('button', { class: 'btn principal', type: 'button', onclick: function (ev) {
              msg.hidden = true
              if (nom.value.trim().length < 3) { msg.textContent = 'Indiquez vos nom et prénom.'; msg.hidden = false; return }
              if (!accord.checked) { msg.textContent = 'Cochez la case pour confirmer.'; msg.hidden = false; return }
              var b = ev.currentTarget; b.disabled = true
              S.rpc('client_signer_contrat', { kid: k.id, signataire: nom.value.trim(), accord: true }).then(function () { UI.toast('Contrat signé. Merci !', 'bon'); ctx.route() }, function (er) { msg.textContent = er.message.replace(/^.*"message":"([^"]+)".*$/, '$1'); msg.hidden = false; b.disabled = false })
            } }, ic('file-signature', 16), 'Signer'))))
        }
        var tete = h('button', { class: 'pf-tete', type: 'button', 'aria-expanded': String(!signe), onclick: function () { corps.hidden = !corps.hidden; tete.setAttribute('aria-expanded', String(!corps.hidden)) } },
          h('span', { class: 'pf-tete-t' }, h('b', {}, (k.ref || '') + ' · ' + k.titre), h('small', { class: 'discret' }, (k.date_debut ? 'À partir du ' + date(k.date_debut) : '') + (k.date_fin ? ' · jusqu’au ' + date(k.date_fin) : ''))),
          h('span', { class: 'pf-tete-d' }, UI.badge(signe ? 'Signé' : 'À signer', signe ? 'bon' : 'attention'), ic('chevron-down', 16)))
        return h('article', { class: 'pf-doc' + (signe ? '' : ' attente') }, tete, corps)
      }
    })
  }
})()
