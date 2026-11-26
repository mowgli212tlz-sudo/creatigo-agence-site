/* Catalogue, devis et stockage Creatigo.
   Stockage = localStorage du navigateur, derrière une API ASYNCHRONE : pour brancher la base de données,
   il suffit de réécrire les méthodes de `Store` (fetch vers ton API) — le site et l’admin n’ont rien à changer.
   shortcut: données locales à CE navigateur seulement, à remplacer par la base avant la mise en production. */
(function () {
  var K_CAT = 'creatigo.catalogue.v1', K_DEV = 'creatigo.devis.v1'
  var TVA = 0.2

  // Prix en € HT. Valeurs de départ À AJUSTER dans l’admin (Catalogue).
  // unite : forfait | mois | page | article | lien | visuel | h | campagne ; rec : facturé chaque mois
  var DEFAULT = [
    { id: 'web', nom: 'Site web', items: [
      { id: 'web-vitrine-ess', nom: 'Site vitrine Essentiel', desc: 'Jusqu’à 5 pages, design sur mesure, responsive, SEO de base.', prix: 1500, unite: 'forfait' },
      { id: 'web-vitrine-pro', nom: 'Site vitrine Premium', desc: 'Jusqu’à 10 pages, design sur mesure, SEO avancé, formulaire et analytics.', prix: 3200, unite: 'forfait' },
      { id: 'web-page', nom: 'Page supplémentaire', desc: 'Page additionnelle intégrée au site.', prix: 150, unite: 'page' },
      { id: 'web-ecommerce', nom: 'Site e-commerce', desc: 'Boutique en ligne : catalogue, panier, paiement, back-office, SEO Google Shopping.', prix: 4500, unite: 'forfait' },
      { id: 'web-saas', nom: 'Plateforme SaaS (cadrage + socle)', desc: 'Conception et développement du socle d’une plateforme sur mesure. Devis détaillé après cadrage.', prix: 9000, unite: 'forfait' },
      { id: 'web-refonte', nom: 'Refonte de site existant', desc: 'Audit de l’existant, nouveau design, migration des contenus et redirections SEO.', prix: 1200, unite: 'forfait' },
      { id: 'web-redaction', nom: 'Rédaction des contenus', desc: 'Textes optimisés SEO pour vos pages.', prix: 60, unite: 'page' },
      { id: 'web-hebergement', nom: 'Hébergement & nom de domaine', desc: 'Hébergement sécurisé, sauvegardes, certificat SSL.', prix: 15, unite: 'mois', rec: true },
      { id: 'web-maintenance', nom: 'Maintenance continue', desc: 'Mises à jour, sécurité, sauvegardes, optimisation de la vitesse, petites évolutions.', prix: 90, unite: 'mois', rec: true },
    ] },
    { id: 'seo', nom: 'Référencement naturel (SEO)', items: [
      { id: 'seo-audit', nom: 'Audit SEO complet', desc: 'Diagnostic technique, éditorial et concurrentiel, plan d’actions priorisé.', prix: 600, unite: 'forfait' },
      { id: 'seo-mots-cles', nom: 'Recherche de mots-clés', desc: 'Étude des requêtes de votre marché et de vos cibles.', prix: 300, unite: 'forfait' },
      { id: 'seo-mensuel', nom: 'Accompagnement SEO mensuel', desc: 'Optimisations techniques, contenus, suivi des positions, rapport mensuel.', prix: 450, unite: 'mois', rec: true },
      { id: 'seo-article', nom: 'Article de blog optimisé', desc: 'Rédaction d’un article de 800 à 1 200 mots.', prix: 120, unite: 'article' },
      { id: 'seo-netlinking', nom: 'Netlinking qualitatif', desc: 'Obtention d’un lien entrant sur un site thématique.', prix: 80, unite: 'lien' },
    ] },
    { id: 'sea', nom: 'Référencement payant (Google Ads)', items: [
      { id: 'sea-setup', nom: 'Création des campagnes Google Ads', desc: 'Stratégie, mots-clés, annonces, paramétrage et suivi des conversions.', prix: 500, unite: 'forfait' },
      { id: 'sea-gestion', nom: 'Gestion mensuelle Google Ads', desc: 'Pilotage des enchères, audiences et annonces, reporting. Budget publicitaire non inclus.', prix: 350, unite: 'mois', rec: true },
      { id: 'sea-shopping', nom: 'Campagne Shopping / YouTube', desc: 'Paramétrage d’une campagne supplémentaire (Shopping, Display ou YouTube).', prix: 250, unite: 'campagne' },
    ] },
    { id: 'geo', nom: 'Référencement IA (GEO)', items: [
      { id: 'geo-audit', nom: 'Audit GEO', desc: 'Analyse de votre visibilité dans ChatGPT, Gemini et Perplexity.', prix: 700, unite: 'forfait' },
      { id: 'geo-struct', nom: 'Structuration & optimisation GEO', desc: 'Restructuration des contenus et signaux d’autorité pour les moteurs d’IA.', prix: 900, unite: 'forfait' },
      { id: 'geo-mensuel', nom: 'Suivi GEO mensuel', desc: 'Suivi de vos apparitions dans les réponses des IA et ajustements.', prix: 500, unite: 'mois', rec: true },
    ] },
    { id: 'social', nom: 'Réseaux sociaux', items: [
      { id: 'soc-strategie', nom: 'Stratégie éditoriale', desc: 'Analyse, ligne éditoriale, calendrier de publication.', prix: 600, unite: 'forfait' },
      { id: 'soc-gestion', nom: 'Gestion d’un réseau social', desc: 'Planification, publication, animation et modération d’un réseau.', prix: 400, unite: 'mois', rec: true },
      { id: 'soc-reseau-sup', nom: 'Réseau supplémentaire', desc: 'Un réseau de plus dans la gestion mensuelle (LinkedIn, Instagram, TikTok, Facebook…).', prix: 150, unite: 'mois', rec: true },
      { id: 'soc-visuels', nom: 'Pack de 10 visuels / vidéos courtes', desc: 'Création graphique et montage adaptés à chaque plateforme.', prix: 250, unite: 'pack' },
      { id: 'soc-ads', nom: 'Gestion des campagnes Social Ads', desc: 'Campagnes sponsorisées ciblées. Budget publicitaire non inclus.', prix: 250, unite: 'mois', rec: true },
    ] },
    { id: 'marketing', nom: 'Marketing d’entreprise', items: [
      { id: 'mkt-identite', nom: 'Identité visuelle', desc: 'Logo, charte graphique et déclinaisons.', prix: 1500, unite: 'forfait' },
      { id: 'mkt-video', nom: 'Vidéo corporate ou événementielle', desc: 'Scénario, tournage et montage d’une vidéo.', prix: 1800, unite: 'vidéo' },
      { id: 'mkt-plaquette', nom: 'Plaquette / présentation / affiche', desc: 'Conception d’un support print ou digital.', prix: 600, unite: 'support' },
      { id: 'mkt-emailing', nom: 'Campagne e-mailing', desc: 'Création et envoi d’une campagne ciblée, avec reporting.', prix: 300, unite: 'campagne' },
    ] },
    { id: 'app', nom: 'Application web & mobile', items: [
      { id: 'app-cadrage', nom: 'Cadrage & UX design', desc: 'Ateliers, spécifications, maquettes interactives.', prix: 2500, unite: 'forfait' },
      { id: 'app-web', nom: 'Application web sur mesure', desc: 'Développement d’une WebApp sécurisée et évolutive.', prix: 12000, unite: 'forfait' },
      { id: 'app-mobile', nom: 'Application mobile iOS + Android', desc: 'Développement multi-plateforme et publication sur les stores.', prix: 18000, unite: 'forfait' },
      { id: 'app-maintenance', nom: 'Maintenance & évolutions applicatives', desc: 'Corrections, mises à jour et support.', prix: 200, unite: 'mois', rec: true },
      { id: 'app-formation', nom: 'Formation à la prise en main', desc: 'Session de formation de vos équipes.', prix: 150, unite: 'h' },
    ] },
  ]

  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v } catch (e) { return d } }
  function save(k, v) { localStorage.setItem(k, JSON.stringify(v)) }
  function pad(n, l) { n = String(n); while (n.length < l) n = '0' + n; return n }

  var Local = {
    TVA: TVA,
    STATUTS: [['nouveau', 'Nouveau'], ['envoye', 'Envoyé'], ['accepte', 'Accepté'], ['refuse', 'Refusé']],
    defaultCatalogue: function () { return JSON.parse(JSON.stringify(DEFAULT)) },
    catalogue: function () { return Promise.resolve(load(K_CAT, DEFAULT)) },
    saveCatalogue: function (c) { save(K_CAT, c); return Promise.resolve() },
    devisList: function () { return Promise.resolve(load(K_DEV, [])) },
    saveDevis: function (d) {
      var l = load(K_DEV, [])
      if (!d.id) {
        var max = 0
        l.forEach(function (x) { var m = /(\d+)$/.exec(x.ref || ''); if (m) max = Math.max(max, +m[1]) })
        d.id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
        d.ref = 'DEV-' + new Date().getFullYear() + '-' + pad(max + 1, 4)
        d.creeLe = new Date().toISOString()
        l.unshift(d)
      } else {
        l = l.map(function (x) { return x.id === d.id ? d : x })
      }
      save(K_DEV, l)
      return Promise.resolve(d)
    },
    deleteDevis: function (id) { save(K_DEV, load(K_DEV, []).filter(function (x) { return x.id !== id })); return Promise.resolve() },
    // Collections de l'admin (clients, rdv, factures, projets, messages, blog) : même principe, une liste par nom
    COLLS: ['clients', 'rdv', 'factures', 'projets', 'messages', 'blog'],
    list: function (n) { return Promise.resolve(load('creatigo.' + n + '.v1', [])) },
    put: function (n, o) {
      var l = load('creatigo.' + n + '.v1', [])
      if (!o.id) { o.id = n[0] + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); o.creeLe = new Date().toISOString(); l.unshift(o) }
      else l = l.map(function (x) { return x.id === o.id ? o : x })
      save('creatigo.' + n + '.v1', l); return Promise.resolve(o)
    },
    del: function (n, id) { save('creatigo.' + n + '.v1', load('creatigo.' + n + '.v1', []).filter(function (x) { return x.id !== id })); return Promise.resolve() },
    // Numérotation FAC-2026-0001 : plus grand numéro de l'année + 1
    nextRef: function (prefix, list) {
      var an = new Date().getFullYear(), max = 0
      list.forEach(function (x) { var m = new RegExp('^' + prefix + '-' + an + '-([0-9]+)$').exec(x.ref || ''); if (m) max = Math.max(max, +m[1]) })
      return prefix + '-' + an + '-' + pad(max + 1, 4)
    },
    exportAll: function () {
      var o = { catalogue: load(K_CAT, DEFAULT), devis: load(K_DEV, []) }
      this.COLLS.forEach(function (n) { o[n] = load('creatigo.' + n + '.v1', []) })
      return o
    },
    replaceAll: function (o) {
      if (o.catalogue) save(K_CAT, o.catalogue); if (o.devis) save(K_DEV, o.devis)
      this.COLLS.forEach(function (n) { if (Array.isArray(o[n])) save('creatigo.' + n + '.v1', o[n]) })
      return Promise.resolve()
    },

    ligne: function (it, qty) { return { itemId: it.id, nom: it.nom, desc: it.desc || '', prix: it.prix, unite: it.unite, rec: !!it.rec, qty: qty || 1 } },
    // Totaux : « unique » = prestations ponctuelles, « mensuel » = abonnements. La remise s’applique aux deux.
    calc: function (d) {
      var u = 0, m = 0
      ;(d.lignes || []).forEach(function (l) { var t = (+l.prix || 0) * (+l.qty || 0); if (l.rec) m += t; else u += t })
      var r = Math.min(Math.max(+d.remise || 0, 0), 100) / 100
      var uHT = u * (1 - r), mHT = m * (1 - r)
      return { uniqueHT: uHT, mensuelHT: mHT, uniqueTTC: uHT * (1 + TVA), mensuelTTC: mHT * (1 + TVA), remiseMontant: (u + m) * r, brutHT: u + m }
    },
    eur: function (n) { return (+n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) },
    statutLabel: function (s) { var r = this.STATUTS.filter(function (x) { return x[0] === s })[0]; return r ? r[1] : s },
  }

  // ---------- Base partagée (Supabase) : utilisée seulement quand un compte est connecté (espace admin) ----------
  // Chaque liste de l'admin a sa table (supabase/platform.sql) : l'objet complet est dans « data », la base en tire les colonnes typées
  // (statut, montants, liens entre fiches). Suppression = mise à la corbeille (deleted_at), restaurable. Aucune dépendance : fetch vers l'API REST.
  var TABLE = { clients: 'clients', rdv: 'appointments', factures: 'invoices', projets: 'projects', messages: 'contact_messages', blog: 'blog_posts', devis: 'quotes' }
  var SB = window.CREATIGO_SB, K_SES = 'creatigo.sb.session', cache = {}
  function session() { try { var s = JSON.parse(sessionStorage.getItem(K_SES)); return s && s.access_token ? s : null } catch (e) { return null } }
  function saveSession(j) {
    var s = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || (Math.floor(Date.now() / 1000) + (j.expires_in || 3600)), email: (j.user && j.user.email) || (session() || {}).email || '' }
    sessionStorage.setItem(K_SES, JSON.stringify(s)); return s
  }
  function authCall(path, body) {
    return fetch(SB.url + '/auth/v1/' + path, { method: 'POST', headers: { apikey: SB.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {} }).then(function (j) { if (!r.ok) throw new Error(j.error_description || j.msg || ('Erreur ' + r.status)); return j }) })
  }
  function fresh() {
    var s = session(); if (!s) return Promise.reject(new Error('non connecté'))
    if (s.expires_at * 1000 - Date.now() > 60000) return Promise.resolve(s)
    return authCall('token?grant_type=refresh_token', { refresh_token: s.refresh_token }).then(saveSession, function () { sessionStorage.removeItem(K_SES); throw new Error('session expirée') })
  }
  function api(path, opt) {
    opt = opt || {}
    return fresh().then(function (s) {
      var h = { apikey: SB.key, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' }
      for (var k in (opt.headers || {})) h[k] = opt.headers[k]
      return fetch(SB.url + '/rest/v1/' + path, { method: opt.method || 'GET', headers: h, body: opt.body }).then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error('Base : erreur ' + r.status + ' ' + t.slice(0, 200)) })
        return r.status === 204 ? null : r.text().then(function (t) { return t ? JSON.parse(t) : null })
      })
    })
  }
  var q = encodeURIComponent
  function tbl(coll) { var t = TABLE[coll]; if (!t) throw new Error('liste inconnue : ' + coll); return t }
  function toObj(r) { var o = r.data || {}; o.id = r.id; if (!o.creeLe && r.created_at) o.creeLe = r.created_at; return o }
  function rows(coll) {
    return cache[coll] || (cache[coll] = api(tbl(coll) + '?deleted_at=is.null&select=id,data,created_at&order=created_at.desc&limit=5000').then(function (rs) {
      return rs.map(toObj)
    }).catch(function (e) { delete cache[coll]; throw e }))
  }
  // enregistre et renvoie les objets tels que la base les a gardés (numéro de devis / facture attribué par la base, par exemple)
  function upsert(coll, list) {
    var body = list.map(function (o) {
      var r = { id: String(o.id), data: o, deleted_at: null }; if (o.creeLe && !isNaN(Date.parse(o.creeLe))) r.created_at = o.creeLe
      // projet : visible dans l'espace client dès qu'il a un client (sauf si on a choisi « interne ») ; l'étape montrée au client suit l'étape du projet
      if (coll === 'projets') { r.visible_client = !!o.clientId && o.visibleClient !== 'non'; r.etape = { afaire: 1, encours: 2, relecture: 3, livre: 4 }[o.statut] || 1 }
      return r
    })
    delete cache[coll]
    var chunks = [], i, out = []; for (i = 0; i < body.length; i += 300) chunks.push(body.slice(i, i + 300))
    return chunks.reduce(function (p, c) { return p.then(function () { return api(tbl(coll) + '?on_conflict=id&select=id,data,created_at', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(c) }).then(function (rs) { out = out.concat((rs || []).map(toObj)) }) }) }, Promise.resolve())
      .then(function () { return out })
  }
  var Remote = {
    list: function (n) { return rows(n).then(function (l) { return JSON.parse(JSON.stringify(l)) }) },
    put: function (n, o) {
      if (!o.id) { o.id = n[0] + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); o.creeLe = new Date().toISOString() }
      return upsert(n, [o]).then(function (r) { return r[0] || o })
    },
    // mise à la corbeille (restaurable par la direction), jamais d'effacement direct depuis l'interface
    del: function (n, id) { delete cache[n]; return api(tbl(n) + '?id=eq.' + q(id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ deleted_at: new Date().toISOString() }) }).then(function () {}) },
    devisList: function () { return Remote.list('devis') },
    // nouveau devis : identifiant ici, numéro DEV-AAAA-NNNN attribué par la base (pas de doublon possible)
    saveDevis: function (d) {
      if (!d.id) { d.id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); d.creeLe = new Date().toISOString(); delete d.ref }
      return upsert('devis', [d]).then(function (r) { return r[0] || d })
    },
    deleteDevis: function (id) { return Remote.del('devis', id) },
    catalogue: function () { return api('settings?key=eq.catalogue&select=value').then(function (l) { return l[0] && Array.isArray(l[0].value) ? l[0].value : JSON.parse(JSON.stringify(DEFAULT)) }) },
    saveCatalogue: function (c) { return api('settings?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ key: 'catalogue', value: c }]) }) },
    exportAll: function () {
      var o = {}
      return Promise.all(Local.COLLS.concat(['devis']).map(function (n) { return Remote.list(n).then(function (l) { o[n] = l }) }))
        .then(function () { return Remote.catalogue() }).then(function (c) { o.catalogue = c; return o })
    },
    // remplace tout le contenu de la base par ce fichier
    replaceAll: function (o) {
      var colls = Local.COLLS.concat(['devis'])
      return colls.reduce(function (p, n) {
        // « remplacer » = tout mettre à la corbeille puis réenregistrer le fichier : rien n'est effacé définitivement
        return Array.isArray(o[n]) ? p.then(function () { delete cache[n]; return api(tbl(n) + '?deleted_at=is.null', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ deleted_at: new Date().toISOString() }) }) }).then(function () { return upsert(n, o[n]) }) : p
      }, Promise.resolve()).then(function () { return o.catalogue ? Remote.saveCatalogue(o.catalogue) : null })
    },
  }
  var Store = {}
  for (var k in Local) Store[k] = Local[k]
  ;['catalogue', 'saveCatalogue', 'devisList', 'saveDevis', 'deleteDevis', 'list', 'put', 'del', 'exportAll', 'replaceAll'].forEach(function (m) {
    Store[m] = function () { var b = SB && session() ? Remote : Local; return b[m].apply(b, arguments) }
  })
  Store.auth = {
    enabled: !!(SB && SB.url && SB.key),
    session: session,
    signIn: function (email, pw) { return authCall('token?grant_type=password', { email: email, password: pw }).then(saveSession).then(function (s) { api('rpc/log_event', { method: 'POST', body: JSON.stringify({ kind: 'connexion' }) }).catch(function () {}); return s }) },
    signOut: function () { var s = session(); sessionStorage.removeItem(K_SES); cache = {}; if (s) fetch(SB.url + '/auth/v1/logout', { method: 'POST', headers: { apikey: SB.key, Authorization: 'Bearer ' + s.access_token } }).catch(function () {}); return Promise.resolve() },
  }
  // Accès direct aux tables de l'espace client (portal_*) : la sécurité est faite par les règles de la base, ligne par ligne
  Store.sb = {
    enabled: !!(SB && SB.url && SB.key),
    on: function () { return !!(SB && session()) },
    get: function (path) { return api(path) },
    post: function (path, body) { return api(path, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) }) },
    upsert: function (path, body) { return api(path, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(body) }) },
    patch: function (path, body) { return api(path, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) }) },
    del: function (path) { return api(path, { method: 'DELETE' }) },
    // lien temporaire (5 min) vers un fichier du stockage privé « documents » ; la base vérifie que le compte peut le lire
    fichier: function (chemin) {
      return fresh().then(function (s) {
        return fetch(SB.url + '/storage/v1/object/sign/documents/' + String(chemin).split('/').map(encodeURIComponent).join('/'), { method: 'POST', headers: { apikey: SB.key, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 300 }) })
          .then(function (r) { if (!r.ok) throw new Error('Fichier indisponible (' + r.status + ')'); return r.json() })
          .then(function (j) { var u = j.signedURL || j.signedUrl; return /^https?:/.test(u) ? u : SB.url + '/storage/v1' + u })
      })
    },
  }
  // le compte connecté est-il un membre de l'équipe ? (réponse de la base, pas du navigateur)
  Store.auth.isAdmin = function () { return api('rpc/is_admin', { method: 'POST', body: '{}' }).then(function (r) { return r === true }, function () { return false }) }
  Store.auth.email = function () { return (session() || {}).email || '' }
  // rôle donné par la base : super_admin, admin, chef_projet, collaborateur, client (ou null)
  Store.auth.role = function () { return api('rpc/my_role', { method: 'POST', body: '{}' }).catch(function () { return null }) }
  Store.flush = function (n) { if (n) delete cache[n]; else cache = {} }   // relire une liste modifiée ailleurs (espace client)
  Store.rpc = function (name, args) { return api('rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}) }) }
  // formulaires du site public : dépôt contrôlé par la base (public_submit), sans compte. Renvoie { ok, ref? }
  Store.submitPublic = function (kind, payload) {
    if (!(SB && SB.url && SB.key)) return Promise.reject(new Error('base non configurée'))
    return fetch(SB.url + '/rest/v1/rpc/public_submit', { method: 'POST', headers: { apikey: SB.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: kind, payload: payload }) })
      .then(function (r) { return r.json().catch(function () { return {} }).then(function (j) { if (!r.ok) throw new Error(j.message || ('Erreur ' + r.status)); return j }) })
  }
  // mot de passe oublié : la base envoie un e-mail avec un lien qui ramène sur la page
  Store.auth.recover = function (email, back) { return authCall('recover' + (back ? '?redirect_to=' + encodeURIComponent(back) : ''), { email: email }) }
  // lien d'invitation / de réinitialisation : l'adresse contient la session dans le « # » ; on la récupère puis on nettoie l'adresse
  Store.auth.fromHash = function () {
    var h = location.hash.replace(/^#/, ''); if (h.indexOf('access_token=') < 0) return Promise.resolve(null)
    var p = {}; h.split('&').forEach(function (x) { var i = x.indexOf('='); if (i > 0) p[x.slice(0, i)] = decodeURIComponent(x.slice(i + 1)) })
    history.replaceState(null, '', location.pathname + location.search)
    if (!p.access_token) return Promise.resolve(null)
    saveSession({ access_token: p.access_token, refresh_token: p.refresh_token, expires_in: +p.expires_in || 3600, expires_at: +p.expires_at || 0 })
    return fetch(SB.url + '/auth/v1/user', { headers: { apikey: SB.key, Authorization: 'Bearer ' + p.access_token } }).then(function (r) { return r.json() }).then(function (u) {
      var s = session(); s.email = (u && u.email) || ''; sessionStorage.setItem(K_SES, JSON.stringify(s)); return p.type || 'login'
    })
  }
  Store.auth.setPassword = function (pw) {
    return fresh().then(function (s) {
      return fetch(SB.url + '/auth/v1/user', { method: 'PUT', headers: { apikey: SB.key, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) })
        .then(function (r) { return r.json().catch(function () { return {} }).then(function (j) { if (!r.ok) throw new Error(j.msg || j.error_description || ('Erreur ' + r.status)) }) })
    })
  }
  // envoie dans la base (sans rien supprimer) les données qui étaient enregistrées dans CE navigateur avant la connexion à la base
  Store.sendLocal = function () {
    if (!(SB && session())) return Promise.reject(new Error('non connecté'))
    var o = Local.exportAll(), colls = Local.COLLS.concat(['devis'])
    return colls.reduce(function (p, n) { return p.then(function () { return (o[n] || []).length ? upsert(n, o[n]) : null }) }, Promise.resolve())
      .then(function () { return localStorage.getItem(K_CAT) ? Remote.saveCatalogue(o.catalogue) : null })
      .then(function () { return colls.reduce(function (a, n) { return a + (o[n] || []).length }, 0) })
  }
  // envoi d'un formulaire du site : vers la base (l'agence le retrouve dans l'admin) ET vers Netlify Forms (e-mail), en parallèle.
  // Réussi si au moins l'un des deux a abouti. extra : champs ajoutés (ex. lignes du devis).
  Store.sendForm = function (kind, form, extra) {
    var p = {}; new FormData(form).forEach(function (v, k) { if (typeof v === 'string') p[k] = v })
    for (var k in extra || {}) p[k] = extra[k]
    var net = fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(form)).toString() }).then(function (r) { return r.ok }, function () { return false })
    var db = Store.submitPublic(kind, p).then(function (j) { return j }, function () { return null })
    return Promise.all([db, net]).then(function (r) { return { db: r[0], netlify: r[1], ok: !!(r[0] || r[1]) } })
  }
  // tarifs publics du catalogue enregistré par l'agence (sans compte) ; à défaut, les tarifs de départ
  Store.publicCatalogue = function () {
    if (!(SB && SB.url && SB.key)) return Local.catalogue()
    return fetch(SB.url + '/rest/v1/rpc/public_catalogue', { method: 'POST', headers: { apikey: SB.key, 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.ok ? r.json() : null }).then(function (c) { return Array.isArray(c) && c.length ? c : Local.catalogue() }, function () { return Local.catalogue() })
  }
  window.CreatigoStore = Store
})()
