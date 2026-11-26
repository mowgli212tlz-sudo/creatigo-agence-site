// Aides de l'interface : création d'éléments, formats, appels à l'API et
// composants communs (tuiles, badges, avatars, tableau interactif).
import { icone } from './icones.js';
import { illustration, ILLU_PAR_ICONE } from './illustrations.js';
import { Prefs } from './prefs.js';
import { creerCache } from './cache.js';

// h('div', { class: 'carte', onclick: f }, 'texte', autreElement)
// Le texte passe toujours par textContent : aucune donnée n'est injectée
// comme du HTML, donc pas de faille XSS possible depuis la base.
export function h(balise, attrs = {}, ...enfants) {
  const el = document.createElement(balise);
  for (const [cle, valeur] of Object.entries(attrs || {})) {
    if (valeur === null || valeur === undefined || valeur === false) continue;
    if (cle === 'class') el.className = valeur;
    else if (cle === 'style') el.style.cssText = valeur;
    else if (cle.startsWith('on')) el.addEventListener(cle.slice(2), valeur);
    else if (cle === 'value') el.value = valeur;
    else el.setAttribute(cle, valeur === true ? '' : valeur);
  }
  for (const enfant of enfants.flat(Infinity)) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    el.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
  }
  return el;
}

const vide = (n) => n === null || n === undefined || Number.isNaN(n);

export const fmt = {
  nombre: (n, d = 0) => (vide(n) ? '–' : Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })),
  euros: (n) => (vide(n) ? '–' : `${Math.round(n).toLocaleString('fr-FR')} €`),
  pct: (n) => (vide(n) ? '–' : `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`),
  pctSigne: (n) => (vide(n) ? '–' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`),
  date: (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '–'),
  dateHeure: (iso) => (iso ? `${iso.slice(0, 10).split('-').reverse().join('/')} à ${iso.slice(11, 16)}` : '–'),
  heure: (iso) => (iso ? iso.slice(11, 16) : ''),
  annees: (n) => (vide(n) ? '–' : `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${n >= 2 ? 'ans' : 'an'}`),
  pluriel: (n, singulier, pluriel) => `${Number(n).toLocaleString('fr-FR')} ${Math.abs(n) >= 2 ? (pluriel || `${singulier}s`) : singulier}`,
};

export class ErreurApi extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Les lectures passent par la mémoire (cache.js) ; toute écriture la vide, réussie ou non.
export const cacheApi = creerCache((chemin) => requeteHttp('GET', chemin));

// opts.frais : lecture exacte, sans passer par la mémoire (exports)
export async function api(methode, chemin, corps, opts = {}) {
  if (methode === 'GET') return cacheApi.lire(chemin, opts);
  try {
    return await requeteHttp(methode, chemin, corps);
  } finally {
    cacheApi.vider();
  }
}

async function requeteHttp(methode, chemin, corps) {
  let reponse;
  try {
    reponse = await fetch(chemin, {
      method: methode,
      headers: corps ? { 'Content-Type': 'application/json' } : (methode === 'GET' ? {} : { 'Content-Type': 'application/json' }),
      body: methode === 'GET' ? undefined : JSON.stringify(corps || {}),
      credentials: 'same-origin',
    });
  } catch {
    throw new ErreurApi(0, 'Le serveur ne répond pas. Vérifiez qu\'il est bien lancé.');
  }
  let donnees = {};
  try { donnees = await reponse.json(); } catch { /* réponse sans JSON */ }
  if (!reponse.ok) throw new ErreurApi(reponse.status, donnees.erreur || `Erreur ${reponse.status}`);
  return donnees;
}

// ---------- Petits composants
export function etatVide(message = 'Aucune ligne.', nomIcone = 'search') {
  return h('div', { class: 'vide' }, h('div', { class: 'ico-vide' }, icone(nomIcone, 22)), h('span', {}, message));
}

// Texte brut d'une cellule (texte ou élément), pour la recherche et le tri.
const texteDe = (c) => (c instanceof Node ? c.textContent : String(c ?? ''));

// colonnes : [{ titre, num }] ; lignes : tableaux de cellules (texte ou élément)
export function tableau(colonnes, lignes, { vide: messageVide = 'Aucune ligne.', legende } = {}) {
  if (!lignes.length) return etatVide(messageVide);
  return h('div', { class: 'table-zone', tabindex: '0', role: 'region', 'aria-label': legende || 'Tableau de données' },
    h('table', {},
      h('thead', {}, h('tr', {}, colonnes.map((c) => h('th', { class: c.num ? 'num' : null, scope: 'col' }, c.titre)))),
      h('tbody', {}, lignes.map((l) => h('tr', {}, l.map((cellule, i) => h('td', { class: colonnes[i] && colonnes[i].num ? 'num' : null }, cellule)))))));
}

// Nombre lu dans un texte français (« 3 126 € », « −14,7 % », « 02/03/2024 » -> null)
function nombreDe(t) {
  if (/\d{2}\/\d{2}\/\d{4}/.test(t)) {
    const [j, m, a] = t.match(/(\d{2})\/(\d{2})\/(\d{4})/).slice(1);
    return Number(`${a}${m}${j}`);
  }
  const propre = t.replace(/[\s  ]/g, '').replace('−', '-').replace(',', '.');
  return /^-?\d+(\.\d+)?(€|%|j|ans|an|ms)?$/.test(propre) ? parseFloat(propre) : null;
}

// Tableau avec recherche, tri par colonne et pagination.
//   const t = tableauInteractif(colonnes, lignes, { parPage, recherche, filtres, legende, vide })
//   t.element -> à insérer ; t.definir(nouvellesLignes) -> remplace les données.
export function tableauInteractif(colonnes, lignes, opts = {}) {
  const { recherche = true, placeholder = 'Rechercher…', filtres = [], legende = 'Tableau de données', vide: messageVide = 'Aucun résultat.', nom = 'ligne' } = opts;
  // le réglage « Lignes par page » s'applique à tous les tableaux
  // (plafonné par opts.max sur les pages de synthèse, où un tableau partage l'écran avec d'autres)
  const parPage = Math.min(Number(Prefs.lire('lignesParPage')) || opts.parPage || 10, opts.max || Infinity);
  const etat = { q: String(opts.q || '').trim().toLowerCase(), page: 1, tri: null, dir: 'ascending', lignes };
  const racine = h('div', {});
  const corps = h('div', {});
  const compteur = h('span', { class: 'compteur', 'aria-live': 'polite' });
  const champ = recherche ? h('input', {
    type: 'search', placeholder, 'aria-label': placeholder, value: opts.q || '',
    oninput: (e) => { etat.q = e.target.value.trim().toLowerCase(); etat.page = 1; dessiner(); },
  }) : null;

  const barre = (recherche || filtres.length)
    ? h('div', { class: 'outils-table' },
      recherche ? h('div', { class: 'recherche' }, icone('search', 16), champ) : null, filtres, compteur)
    : null;

  function ordonner(rows) {
    if (etat.tri === null) return rows;
    const i = etat.tri;
    const sens = etat.dir === 'ascending' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const ta = texteDe(a[i]); const tb = texteDe(b[i]);
      const na = nombreDe(ta); const nb = nombreDe(tb);
      if (na !== null && nb !== null) return (na - nb) * sens;
      return ta.localeCompare(tb, 'fr', { numeric: true, sensitivity: 'base' }) * sens;
    });
  }

  function dessiner() {
    // une ligne peut porter un texte de recherche en plus de ses cellules (ligne.recherche)
    const sansAccent = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const q = sansAccent(etat.q);
    const filtrees = q
      ? etat.lignes.filter((l) => l.some((c) => sansAccent(texteDe(c)).includes(q)) || sansAccent(l.recherche || '').includes(q))
      : etat.lignes;
    const triees = ordonner(filtrees);
    const pages = Math.max(1, Math.ceil(triees.length / parPage));
    etat.page = Math.min(etat.page, pages);
    const debut = (etat.page - 1) * parPage;
    const visibles = triees.slice(debut, debut + parPage);
    compteur.textContent = fmt.pluriel(triees.length, nom) + (etat.q && triees.length !== etat.lignes.length ? ` sur ${fmt.nombre(etat.lignes.length)}` : '');

    const entetes = colonnes.map((c, i) => h('th', { class: c.num ? 'num' : null, scope: 'col', 'aria-sort': etat.tri === i ? etat.dir : 'none' },
      c.tri === false ? c.titre : h('button', {
        class: 'tri', type: 'button',
        onclick: () => {
          if (etat.tri === i) etat.dir = etat.dir === 'ascending' ? 'descending' : 'ascending'; else { etat.tri = i; etat.dir = 'ascending'; }
          dessiner();
        },
      }, c.titre, icone(etat.tri === i ? (etat.dir === 'ascending' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down', 13))));

    const table = visibles.length
      ? h('div', { class: 'table-zone', tabindex: '0', role: 'region', 'aria-label': legende },
        h('table', {}, h('thead', {}, h('tr', {}, entetes)),
          h('tbody', {}, visibles.map((l) => h('tr', {}, l.map((cellule, i) => h('td', { class: colonnes[i] && colonnes[i].num ? 'num' : null }, cellule)))))))
      : etatVide(messageVide);

    const nav = triees.length > parPage ? h('nav', { class: 'pagination', 'aria-label': `Pagination : ${legende}` },
      h('span', {}, `${fmt.nombre(debut + 1)}–${fmt.nombre(debut + visibles.length)} sur ${fmt.nombre(triees.length)}`),
      h('div', { class: 'pages' },
        h('button', { type: 'button', 'aria-label': 'Page précédente', disabled: etat.page === 1, onclick: () => { etat.page -= 1; dessiner(); } }, icone('chevron-left', 16)),
        numerosDePages(etat.page, pages).map((p) => (p === '…' ? h('span', { class: 'discret' }, '…')
          : h('button', { type: 'button', 'aria-label': `Page ${p}`, 'aria-current': p === etat.page ? 'page' : null, onclick: () => { etat.page = p; dessiner(); } }, p))),
        h('button', { type: 'button', 'aria-label': 'Page suivante', disabled: etat.page === pages, onclick: () => { etat.page += 1; dessiner(); } }, icone('chevron-right', 16)))) : null;

    // replaceChildren écrirait « null » pour un élément absent
    corps.replaceChildren(...[table, nav].filter(Boolean));
  }

  // append écrirait « null » sans barre d'outils (tableau sans recherche ni filtre)
  racine.append(...[barre, corps].filter(Boolean));
  dessiner();
  return { element: racine, definir(nouvelles) { etat.lignes = nouvelles; etat.page = 1; dessiner(); } };
}

function numerosDePages(courante, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const p = new Set([1, total, courante - 1, courante, courante + 1]);
  const liste = Array.from(p).filter((x) => x >= 1 && x <= total).sort((a, b) => a - b);
  const sortie = [];
  liste.forEach((x, i) => { if (i && x - liste[i - 1] > 1) sortie.push('…'); sortie.push(x); });
  return sortie;
}

export function carte(titre, ...contenu) {
  const [sous, ...reste] = contenu;
  const aSousTitre = typeof sous === 'string';
  return h('section', { class: 'carte' },
    h('header', {}, h('h2', {}, titre), aSousTitre ? h('span', { class: 'discret' }, sous) : null),
    aSousTitre ? reste : contenu);
}

// Carte sans marge intérieure : pour un tableau qui va jusqu'aux bords.
export function carteTableau(titre, sousTitre, ...contenu) {
  return h('section', { class: 'carte sans-marge' },
    h('header', {}, h('h2', {}, titre), sousTitre ? h('span', { class: 'discret' }, sousTitre) : null), contenu);
}

// Indicateur : opts = { ton ('bon' | 'attention'), visuel (élément), delta (élément) }
// (opts.icone n'est plus dessiné : une pastille d'icône sur chaque tuile faisait « modèle générique »)
// opts.illustration : le nom d'un objet de illustrations.js ; à défaut, celui qui correspond à opts.icone.
// Sans objet connu, la pastille d'icône reste.
export function tuile(libelle, valeur, precision, alerte = false, opts = {}) {
  const dessin = illustration(opts.illustration || ILLU_PAR_ICONE[opts.icone] || '');
  const texte = [
    h('div', { class: 'tete' }, h('span', { class: 'libelle' }, libelle), !dessin && opts.icone ? h('span', { class: 'pastille-ico', 'aria-hidden': 'true' }, icone(opts.icone, 18)) : null),
    h('div', { style: 'display:flex;align-items:baseline;gap:8px;flex-wrap:wrap' }, h('div', { class: 'valeur' }, valeur), opts.delta || null),
    precision ? h('div', { class: 'precision' }, precision) : null,
    opts.visuel ? h('div', { class: 'visuel' }, opts.visuel) : null,
  ];
  return h('div', { class: `tuile${dessin ? ' avec-illu' : ''}${alerte ? ' alerte' : ''}${opts.ton ? ` ${opts.ton}` : ''}` },
    dessin ? [h('div', { class: 'tuile-texte' }, texte), h('div', { class: 'tuile-illu', 'aria-hidden': 'true' }, dessin)] : texte);
}

// l'objet qui illustre l'en-tête d'une page (d'après sa route), ou null
export function illustrationEntete(nom) {
  const d = illustration(nom || '');
  return d ? h('div', { class: 'entete-illu', 'aria-hidden': 'true' }, d) : null;
}

export function delta(texte, sens = 'neutre') {
  return h('span', { class: `delta ${sens}` },
    sens === 'haut' ? icone('trending-up', 12) : sens === 'bas' ? icone('trending-down', 12) : null, texte);
}

// Badge : badge('Actif', 'bon'), badge('Critique', 'critique', 'circle-alert')
export function badge(texte, ton = '', nomIcone = null) {
  return h('span', { class: `badge ${ton}${nomIcone ? ' sans-point' : ''}` }, nomIcone ? icone(nomIcone, 13) : null, texte);
}

const GRAVITES = {
  critique: ['Critique', 'circle-alert'],
  importante: ['Importante', 'triangle-alert'],
  info: ['Information', 'info'],
};
export function etiquetteGravite(gravite) {
  const [texte, ic] = GRAVITES[gravite] || [gravite, 'info'];
  return badge(texte, gravite, ic);
}

const STATUTS = { nouvelle: ['À traiter', 'attention'], validee: ['Validée par le RH', 'bon'], ecartee: ['Écartée', 'non'], resolue: ['Résolue', 'bon'] };
export function etiquetteStatut(statut) {
  const [texte, ton] = STATUTS[statut] || [statut, ''];
  return badge(texte, ton);
}

export function initiales(nom) {
  const mots = String(nom || '?').replace(/\(.*?\)/g, '').trim().split(/\s+/);
  return ((mots[0] || '?')[0] + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase();
}

export function avatar(nom, taille = '') {
  let somme = 0;
  for (const c of String(nom)) somme += c.charCodeAt(0);
  const ton = ['', 't2', 't3', 't4'][somme % 4];
  return h('span', { class: `avatar ${taille} ${ton}`.trim(), 'aria-hidden': 'true' }, initiales(nom));
}

// ---------- Photos de profil des comptes
// Les photos se chargent une fois (GET /api/photos, mis en mémoire comme toute lecture) ; un
// avatar de compte s'affiche d'abord en initiales, puis prend la photo dès qu'elle est là. Chaque
// avatar porte l'identifiant de son compte : une photo changée se remplace partout à la fois.
let chargementPhotos = null;
let cartePhotos = {};
export const photosComptes = {
  charger(forcer = false) {
    if (!chargementPhotos || forcer) {
      chargementPhotos = api('GET', '/api/photos').then((r) => { cartePhotos = r.photos || {}; return cartePhotos; }).catch(() => cartePhotos);
    }
    return chargementPhotos;
  },
  de: (identifiant) => cartePhotos[identifiant] || null,
  // une photo téléversée (data:) se distingue d'une photo par défaut (fichier du site)
  televersee: (identifiant) => String(cartePhotos[identifiant] || '').startsWith('data:'),
  maj(identifiant, url) {
    if (url) cartePhotos[identifiant] = url; else delete cartePhotos[identifiant];
    for (const el of document.querySelectorAll('[data-compte-photo]')) if (el.dataset.comptePhoto === identifiant) habillerAvatar(el, url);
  },
};

function habillerAvatar(el, url) {
  if (url) {
    el.classList.add('avec-photo');
    el.replaceChildren(h('img', { src: url, alt: '', decoding: 'async' }));
  } else {
    el.classList.remove('avec-photo');
    el.replaceChildren(initiales(el.dataset.nom || ''));
  }
}

export function avatarCompte(identifiant, nom, taille = '') {
  const el = avatar(nom, taille);
  el.dataset.comptePhoto = identifiant;
  el.dataset.nom = nom;
  const deja = photosComptes.de(identifiant);
  if (deja) habillerAvatar(el, deja);
  else photosComptes.charger().then(() => { const url = photosComptes.de(identifiant); if (url) habillerAvatar(el, url); });
  return el;
}

// Photos des salariés : même principe, mais réservées aux rôles qui voient les données individuelles.
// « autorise » est posé à la connexion : pour la Direction on ne demande rien (la route répondrait
// 403, et chaque refus s'inscrirait au journal des accès comme une tentative).
let chargementSalaries = null;
let carteSalaries = {};
let autoriseSalaries = false;
export const photosSalaries = {
  reinitialiser(autorise) { autoriseSalaries = Boolean(autorise); chargementSalaries = null; carteSalaries = {}; },
  charger() {
    if (!autoriseSalaries) return Promise.resolve({});
    if (!chargementSalaries) chargementSalaries = api('GET', '/api/photos/salaries').then((r) => { carteSalaries = r.photos || {}; return carteSalaries; }).catch(() => carteSalaries);
    return chargementSalaries;
  },
  de: (id) => carteSalaries[id] || null,
  televersee: (id) => String(carteSalaries[id] || '').startsWith('data:'),
  maj(id, url) {
    if (url) carteSalaries[id] = url; else delete carteSalaries[id];
    for (const el of document.querySelectorAll('[data-salarie-photo]')) if (el.dataset.salariePhoto === String(id)) habillerAvatar(el, url);
  },
};

export function avatarSalarie(id, nom, taille = '') {
  const el = avatar(nom, taille);
  if (!autoriseSalaries) return el;
  el.dataset.salariePhoto = String(id);
  el.dataset.nom = nom;
  const deja = photosSalaries.de(id);
  if (deja) habillerAvatar(el, deja);
  else photosSalaries.charger().then(() => { const url = photosSalaries.de(id); if (url) habillerAvatar(el, url); });
  return el;
}

// Ouvre le sélecteur de fichier, recadre l'image en carré (centré), la réduit à 256 px et la
// compresse en JPEG : 15 à 40 Ko au lieu de plusieurs Mo. Rend une data URL, ou null si annulé.
export function choisirPhoto() {
  return new Promise((resoudre, rejeter) => {
    const champ = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true });
    champ.addEventListener('change', async () => {
      const fichier = champ.files && champ.files[0];
      champ.remove();
      if (!fichier) { resoudre(null); return; }
      try { resoudre(await reduirePhoto(fichier)); } catch (e) { rejeter(e); }
    });
    document.body.append(champ);
    champ.click();
  });
}

async function reduirePhoto(fichier) {
  if (!/^image\/(png|jpeg|webp)$/.test(fichier.type)) throw new Error('Choisissez une image JPEG, PNG ou WebP.');
  if (fichier.size > 15 * 1024 * 1024) throw new Error('Image trop lourde (15 Mo au plus).');
  // lecture en data: et pas en blob: — la politique de sécurité du site (img-src 'self' data:)
  // refuse les adresses blob:, et l'image ne se chargerait jamais
  const url = await new Promise((ok, ko) => { const l = new FileReader(); l.onload = () => ok(l.result); l.onerror = () => ko(new Error('Ce fichier ne peut pas être lu.')); l.readAsDataURL(fichier); });
  {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Cette image ne peut pas être lue.')); i.src = url; });
    const cote = Math.min(img.naturalWidth, img.naturalHeight);
    const toile = document.createElement('canvas');
    toile.width = 384; toile.height = 384;
    const ctx = toile.getContext('2d');
    ctx.fillStyle = '#ffffff'; // une image transparente ne sort pas noire en JPEG
    ctx.fillRect(0, 0, 384, 384);
    ctx.drawImage(img, (img.naturalWidth - cote) / 2, (img.naturalHeight - cote) / 2, cote, cote, 0, 0, 384, 384);
    for (const qualite of [0.86, 0.75, 0.6]) {
      const donnees = toile.toDataURL('image/jpeg', qualite);
      if (donnees.length < 190 * 1024) return donnees;
    }
    throw new Error('Image trop détaillée, même réduite.');
  }
}

// ---------- Icône d'un service, d'après son nom. Les noms viennent de la base : on reconnaît des
// mots, pas des libellés exacts, et un service inconnu reçoit une icône neutre plutôt qu'une fausse.
const ICONES_SERVICES = [
  [/informatique|\bsi\b|\bit\b|tech|developpement|digital|numerique/, 'cpu'],
  [/marketing|communication/, 'megaphone'],
  [/vente|commercial/, 'trending-up'],
  [/compta|financ|tresorerie|controle de gestion/, 'calculator'],
  [/direction|general/, 'building-2'],
  [/support|client|assistance/, 'headset'],
  [/achat|approvisionnement/, 'shopping-cart'],
  [/juridique|legal|droit|conformite/, 'scale'],
  [/ressources humaines|\brh\b|personnel|paie/, 'users-round'],
  [/logistique|transport|livraison|stock/, 'truck'],
];
export function iconeService(libelle) {
  const nom = String(libelle || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const trouve = ICONES_SERVICES.find(([motif]) => motif.test(nom));
  return trouve ? trouve[1] : 'briefcase';
}

export function sourcesTables(tables) {
  return h('p', { class: 'discret petit', style: 'display:flex;align-items:center;gap:6px' },
    icone('database', 14), `Source : ${tables.length >= 2 ? 'tables' : 'table'} ${tables.join(', ')}.`);
}

// ---------- Notifications et confirmation
let zoneToasts = null;
export function toast(message, ton = '') {
  if (!zoneToasts) {
    zoneToasts = h('div', { class: 'toasts', 'aria-live': 'polite', role: 'status' });
    document.body.append(zoneToasts);
  }
  const t = h('div', { class: `toast ${ton}` }, ton === 'erreur' ? icone('circle-alert', 17) : ton === 'bon' ? icone('circle-check', 17) : icone('info', 17), h('span', {}, message));
  zoneToasts.append(t);
  setTimeout(() => t.remove(), ton === 'erreur' ? 6000 : 3800);
}

// Boîte de confirmation : rend une promesse (true si l'utilisateur confirme).
export function confirmer({ titre, texte, bouton = 'Confirmer', danger = false }) {
  return new Promise((resoudre) => {
    const dialogue = h('dialog', { 'aria-label': titre });
    const finir = (valeur) => { dialogue.close(); dialogue.remove(); resoudre(valeur); };
    dialogue.addEventListener('cancel', (e) => { e.preventDefault(); finir(false); });
    dialogue.append(h('div', { class: 'confirmation' },
      h('h2', {}, titre), h('p', { class: 'discret' }, texte),
      h('div', { class: 'boutons' },
        h('button', { class: 'btn', type: 'button', onclick: () => finir(false) }, 'Annuler'),
        h('button', { class: `btn ${danger ? 'danger' : 'principal'}`, type: 'button', onclick: () => finir(true) }, bouton))));
    document.body.append(dialogue);
    dialogue.showModal();
  });
}

// ---------- Montants masqués : chaque « 1 234 € » reçoit la classe .montant
// (le flou ne s'applique que si le réglage « Masquer les montants » est actif).
const MONTANT = /\d[\d\u00a0\u202f ]*\u00a0€/g;
export function marquerMontants(racine) {
  const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && !n.parentElement.closest('.montant, script, style, input, textarea, select') && /\u00a0€/.test(n.nodeValue)
      ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const noeuds = [];
  while (marcheur.nextNode()) noeuds.push(marcheur.currentNode);
  for (const n of noeuds) {
    const texte = n.nodeValue;
    const frag = document.createDocumentFragment();
    let dernier = 0;
    for (const m of texte.matchAll(MONTANT)) {
      frag.append(texte.slice(dernier, m.index), h('span', { class: 'montant', tabindex: '0' }, m[0]));
      dernier = m.index + m[0].length;
    }
    if (dernier) { frag.append(texte.slice(dernier)); n.replaceWith(frag); }
  }
}

// Barre de pages « ‹ 1 2 3 … 9 › » réutilisable (même rendu que celle des tableaux).
// aller(n) : appelé avec le numéro de page choisi.
export function barrePages({ page, total, parPage, legende, aller }) {
  const pages = Math.max(1, Math.ceil(total / parPage));
  if (pages <= 1) return null;
  const debut = (page - 1) * parPage;
  return h('nav', { class: 'pagination', 'aria-label': `Pagination : ${legende}` },
    h('span', {}, `${fmt.nombre(debut + 1)}–${fmt.nombre(Math.min(debut + parPage, total))} sur ${fmt.nombre(total)}`),
    h('div', { class: 'pages' },
      h('button', { type: 'button', 'aria-label': 'Page précédente', disabled: page === 1, onclick: () => aller(page - 1) }, icone('chevron-left', 16)),
      numerosDePages(page, pages).map((p) => (p === '…' ? h('span', { class: 'discret' }, '…')
        : h('button', { type: 'button', 'aria-label': `Page ${p}`, 'aria-current': p === page ? 'page' : null, onclick: () => aller(p) }, p))),
      h('button', { type: 'button', 'aria-label': 'Page suivante', disabled: page === pages, onclick: () => aller(page + 1) }, icone('chevron-right', 16))));
}
