// Graphiques du tableau de bord, dessinés à la main en HTML et SVG.
// Règles suivies : barres fines, une seule échelle par graphique, couleurs
// attribuées à une catégorie une fois pour toutes, valeurs lisibles sans la
// couleur (étiquette, infobulle et tableau de données en dessous).
import { h, fmt } from './outils.js';
import { traduireTexte } from './traduction.js';

const SVG = 'http://www.w3.org/2000/svg';
function s(balise, attrs = {}, ...enfants) {
  const el = document.createElementNS(SVG, balise);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, v);
  for (const e of enfants) el.append(e instanceof Node ? e : document.createTextNode(String(e)));
  return el;
}

// Une couleur par type de contrat, toujours la même partout.
export const COULEURS_CONTRAT = {
  CDI: 'var(--serie-1)',
  CDD: 'var(--serie-2)',
  Alternance: 'var(--serie-3)',
  Stage: 'var(--serie-4)',
  'Sans contrat en cours': 'var(--serie-neutre)',
};
const TEXTE_SOMBRE = ['Stage', 'Sans contrat en cours'];

// ---------- Infobulles (une seule bulle partagée)
export function installerBulles() {
  const bulle = document.getElementById('bulle');
  const montrer = (cible, x, y) => {
    bulle.textContent = cible.dataset.bulle;
    bulle.hidden = false;
    const r = bulle.getBoundingClientRect();
    bulle.style.left = `${Math.max(8, Math.min(x + 12, window.innerWidth - r.width - 8))}px`;
    bulle.style.top = `${Math.max(8, y - r.height - 10)}px`;
  };
  document.addEventListener('mousemove', (e) => {
    const cible = e.target.closest ? e.target.closest('[data-bulle]') : null;
    if (cible) montrer(cible, e.clientX, e.clientY); else bulle.hidden = true;
  });
  document.addEventListener('focusin', (e) => {
    const cible = e.target.closest ? e.target.closest('[data-bulle]') : null;
    if (!cible) return;
    const r = cible.getBoundingClientRect();
    montrer(cible, r.left + r.width / 2, r.top);
  });
  document.addEventListener('focusout', () => { bulle.hidden = true; });
}

// ---------- Barres horizontales : [{ libelle, valeur, detail }]
export function barres(donnees, { format = fmt.nombre, couleur = 'var(--serie-1)', description } = {}) {
  const max = Math.max(...donnees.map((d) => d.valeur), 1);
  return h('div', { class: 'barres', role: 'img', 'aria-label': description || 'Graphique en barres' },
    donnees.flatMap((d, i) => {
      // sans couleur imposée, chaque barre prend la suivante de la palette du thème (en clair : plusieurs couleurs de tableau de bord ; en sombre : la couleur du site)
      const c = couleur === 'var(--serie-1)' ? `var(--barre-${i % 6}, var(--serie-1))` : couleur;
      return [
        h('div', { class: 'nom', title: d.libelle }, d.libelle),
        h('div', { class: 'piste', 'data-bulle': `${d.libelle} : ${format(d.valeur)}${d.detail ? `\n${d.detail}` : ''}` },
          h('div', { class: 'barre-h', style: `width:${(d.valeur / max) * 100}%;background:${c};--g-lueur:${c}` })),
        h('div', { class: 'val' }, format(d.valeur)),
      ];
    }));
}

// ---------- Barre segmentée : un tout découpé en parts [{ libelle, nombre, part }]
export function segmentee(parts, couleurs, description) {
  const total = parts.reduce((t, p) => t + p.nombre, 0) || 1;
  return h('div', {},
    h('div', { class: 'segmentee', role: 'img', 'aria-label': description },
      parts.filter((p) => p.nombre > 0).map((p) => {
        const largeur = (p.nombre / total) * 100;
        return h('div', {
          class: 'part', tabindex: '0',
          style: `flex:${p.nombre} 0 0;background:${couleurs[p.libelle] || 'var(--serie-neutre)'};color:${TEXTE_SOMBRE.includes(p.libelle) ? '#0b0b0b' : '#fff'}`,
          'data-bulle': `${p.libelle} : ${fmt.nombre(p.nombre)} (${fmt.pct(p.part)})`,
        }, largeur >= 9 ? fmt.pct(p.part) : '');
      })),
    h('div', { class: 'legende', style: 'margin-top:10px' },
      parts.map((p) => h('span', {}, h('i', { style: `background:${couleurs[p.libelle] || 'var(--serie-neutre)'}` }), `${p.libelle} (${fmt.nombre(p.nombre)})`))));
}

// ---------- Colonnes groupées par année : [{ annee, entrees, departs }]
export function colonnes(donnees, series, description) {
  const L = 640; const H = 220; const g = { haut: 12, droite: 8, bas: 26, gauche: 30 };
  const max = Math.max(...donnees.flatMap((d) => series.map((se) => d[se.cle])), 1);
  const pas = max <= 5 ? 1 : max <= 10 ? 2 : 5;
  const sommet = Math.ceil(max / pas) * pas;
  const zoneL = L - g.gauche - g.droite; const zoneH = H - g.haut - g.bas;
  const bande = zoneL / donnees.length;
  const largeur = Math.min(14, (bande - 6) / series.length - 2);
  const y = (v) => g.haut + zoneH - (v / sommet) * zoneH;
  const svg = s('svg', { viewBox: `0 0 ${L} ${H}`, role: 'img', 'aria-label': description });

  for (let v = 0; v <= sommet; v += pas) {
    svg.append(s('line', { x1: g.gauche, x2: L - g.droite, y1: y(v), y2: y(v), stroke: v === 0 ? 'var(--trait-fort)' : 'var(--trait)', 'stroke-width': 1 }));
    svg.append(s('text', { x: g.gauche - 6, y: y(v) + 4, 'text-anchor': 'end' }, v));
  }
  donnees.forEach((d, i) => {
    const centre = g.gauche + bande * i + bande / 2;
    const groupe = s('g', { 'data-bulle': `${d.annee}\n${series.map((se) => `${se.libelle} : ${d[se.cle]}`).join('\n')}`, tabindex: '0' });
    // zone de survol plus large que les barres
    groupe.append(s('rect', { x: centre - bande / 2, y: g.haut, width: bande, height: zoneH, fill: 'transparent' }));
    series.forEach((se, k) => {
      const v = d[se.cle];
      if (!v) return;
      const x = centre - (series.length * (largeur + 2)) / 2 + k * (largeur + 2) + 1;
      const hauteur = g.haut + zoneH - y(v);
      const r = Math.min(4, hauteur);
      // coins arrondis en haut seulement, base carrée sur l'axe
      groupe.append(s('path', {
        class: 'col', style: `animation-delay:${i * 35}ms`,
        d: `M${x},${y(0)} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + largeur - r} Q${x + largeur},${y(v)} ${x + largeur},${y(v) + r} V${y(0)} Z`,
        fill: se.couleur,
      }));
    });
    svg.append(groupe);
    if (donnees.length <= 10 || i % 2 === 0) svg.append(s('text', { x: centre, y: H - 8, 'text-anchor': 'middle' }, d.annee));
  });
  return h('div', { class: 'graphique' },
    h('div', { class: 'legende', style: 'margin-bottom:8px' }, series.map((se) => h('span', {}, h('i', { style: `background:${se.couleur}` }), se.libelle))),
    svg);
}

// ---------- Anneau : un tout découpé en parts [{ libelle, nombre, part }]
// Segments arrondis et séparés (une petite part reste visible), chacun en dégradé de sa couleur ;
// un cercle intérieur fin ; le centre donne le total, puis la part survolée (souris ou clavier).
// La légende écrit chaque part avec une barre de la même longueur relative.
let anneauxNum = 0;
export function anneau(parts, couleurs, { total, libelleTotal = 'au total', description } = {}) {
  const num = (anneauxNum += 1);
  const somme = parts.reduce((t, p) => t + p.nombre, 0) || 1;
  const R = 15.9155; // circonférence = 100, donc les longueurs sont des pourcentages
  const EPAISSEUR = 2.6;
  // les bouts arrondis dépassent d'une demi-épaisseur de chaque côté : l'écart visible vaut ECART - EPAISSEUR
  const ECART = EPAISSEUR + 1.3;
  const MINI = 0.01; // une part minuscule devient un point rond, toujours visible
  const visibles = parts.filter((x) => x.nombre > 0);
  const couleur = (p) => couleurs[p.libelle] || 'var(--serie-neutre)';
  const defs = s('defs', {});
  const svg = s('svg', { viewBox: '0 0 36 36', role: 'img', 'aria-label': description }, defs);
  svg.append(s('circle', { class: 'anneau-piste', cx: 18, cy: 18, r: R, fill: 'none', 'stroke-width': EPAISSEUR }));
  svg.append(s('circle', { class: 'anneau-interieur', cx: 18, cy: 18, r: 11.6, fill: 'none', 'stroke-width': 0.25 }));
  const centreValeur = h('b', {}, fmt.nombre(total ?? somme));
  const centreLibelle = h('span', {}, libelleTotal);
  const centrePart = h('em', { hidden: true });
  const montrer = (p) => {
    centreValeur.textContent = fmt.nombre(p.nombre);
    centreLibelle.textContent = p.libelle;
    centrePart.textContent = fmt.pct(p.part);
    centrePart.hidden = false;
    centreValeur.style.color = couleur(p);
  };
  const reposer = () => {
    centreValeur.textContent = fmt.nombre(total ?? somme);
    centreLibelle.textContent = libelleTotal;
    centrePart.hidden = true;
    centreValeur.style.color = '';
  };
  let decalage = 0;
  visibles.forEach((p, i) => {
    const gid = `anneau-${num}-${i}`;
    defs.append(s('linearGradient', { id: gid, x1: '0', y1: '0', x2: '1', y2: '1' },
      s('stop', { offset: '0', style: `stop-color:color-mix(in srgb, ${couleur(p)} 65%, #ffffff)` }),
      s('stop', { offset: '1', style: `stop-color:${couleur(p)}` })));
    const brut = (p.nombre / somme) * 100;
    const longueur = visibles.length > 1 ? Math.max(brut - ECART, MINI) : 100;
    const arc = s('circle', {
      class: 'arc', cx: 18, cy: 18, r: R, fill: 'none', stroke: `url(#${gid})`, 'stroke-width': EPAISSEUR, 'stroke-linecap': visibles.length > 1 ? 'round' : 'butt',
      'stroke-dasharray': `${longueur} ${100 - longueur}`, 'stroke-dashoffset': -(decalage + (visibles.length > 1 ? ECART / 2 : 0)),
      'data-bulle': `${p.libelle} : ${fmt.nombre(p.nombre)} (${fmt.pct(p.part)})`, tabindex: '0',
      style: `--g-lueur:${couleur(p)};animation-delay:${i * 120}ms`,
    });
    arc.addEventListener('pointerenter', () => montrer(p));
    arc.addEventListener('focus', () => montrer(p));
    arc.addEventListener('pointerleave', reposer);
    arc.addEventListener('blur', reposer);
    svg.append(arc);
    decalage += brut;
  });
  const maxPart = Math.max(...parts.map((p) => p.part), 1);
  return h('div', { class: 'donut-bloc' },
    h('div', { class: 'donut' }, svg, h('div', { class: 'centre' }, centreValeur, centreLibelle, centrePart)),
    h('div', { class: 'donut-legende' }, parts.map((p) => h('div', { class: 'ligne' },
      h('i', { style: `background:${couleur(p)};--g-lueur:${couleur(p)}` }), h('span', { class: 'l' }, p.libelle),
      h('span', { class: 'v' }, fmt.nombre(p.nombre)), h('span', { class: 'p' }, fmt.pct(p.part)),
      h('span', { class: 'barre-part', 'aria-hidden': 'true' }, h('span', { style: `width:${(p.part / maxPart) * 100}%;background:${couleur(p)}` }))))));
}

// ---------- Mini-courbe (tendance d'une série de nombres)
export function courbeMini(valeurs, { couleur = 'var(--serie-1)', description } = {}) {
  const L = 120; const H = 34;
  if (valeurs.length < 2) return h('span', {});
  const min = Math.min(...valeurs); const max = Math.max(...valeurs);
  const etendue = max - min || 1;
  const pts = valeurs.map((v, i) => [(i / (valeurs.length - 1)) * L, H - 3 - ((v - min) / etendue) * (H - 8)]);
  const ligne = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const svg = s('svg', { class: 'spark', viewBox: `0 0 ${L} ${H}`, preserveAspectRatio: 'none', role: 'img', 'aria-label': description });
  svg.append(s('path', { d: `${ligne} L${L},${H} L0,${H} Z`, fill: couleur, opacity: 0.1 }));
  svg.append(s('path', { d: ligne, fill: 'none', stroke: couleur, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }));
  return svg;
}

// ---------- Barre de progression à plusieurs tronçons : [{ valeur, couleur, libelle }]
export function progression(troncons, { description } = {}) {
  const total = troncons.reduce((t, x) => t + x.valeur, 0) || 1;
  return h('div', { class: 'progres', role: 'img', 'aria-label': description },
    // chaque tronçon : une pilule en dégradé de sa couleur, qui se remplit à son tour ; la largeur suit
    // la part (flex), le libellé et la valeur sont dans l'infobulle (souris ou clavier)
    troncons.filter((x) => x.valeur > 0).map((x, i) => h('i', {
      tabindex: '0',
      style: `flex:${x.valeur} 0 0;--c:${x.couleur};--g-lueur:${x.couleur};animation-delay:${i * 140}ms`,
      'data-bulle': `${x.libelle} : ${fmt.nombre(x.valeur)} (${fmt.pct((x.valeur / total) * 100)})`,
    })));
}

// ---------- Colonnes groupées : un vrai graphique, axe des euros à gauche, lignes de repère,
// une colonne par série et par groupe, le nom du groupe dessous. La valeur exacte est dans
// l'infobulle et dans le tableau de données ; l'œil compare les hauteurs.
// series : [{ cle, libelle, couleur }]
// opts : { format, description, detail(l) -> texte sous le nom, pastille(l) -> élément sous le nom,
//          reference : { valeur, libelle } ligne pointillée, note }
function pasLisible(max) {
  const brut = max / 4;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  return [1, 2, 2.5, 5, 10].map((m) => m * puissance).find((p) => p >= brut);
}

export function colonnesGroupees(lignes, series, { format = fmt.euros, description, detail, pastille, reference, note, valeurs = false } = {}) {
  const max = Math.max(...lignes.flatMap((l) => series.map((x) => l[x.cle] || 0)), reference ? reference.valeur : 0, 1);
  const pas = pasLisible(max);
  const sommet = Math.ceil((max * 1.04) / pas) * pas;
  const haut = (v) => `${Math.max(0, Math.min(1, (v || 0) / sommet)) * 100}%`;
  const reperes = [];
  for (let v = 0; v <= sommet + 1e-9; v += pas) reperes.push(v);

  const axe = h('div', { class: 'gc-axe', 'aria-hidden': 'true' }, reperes.map((v) => h('span', { style: `bottom:${haut(v)}` }, format(v))));
  const zone = h('div', { class: 'gc-zone' },
    reperes.map((v) => h('i', { class: `gc-repere${v === 0 ? ' base' : ''}`, style: `bottom:${haut(v)}`, 'aria-hidden': 'true' })),
    reference ? h('div', { class: 'gc-reference', style: `bottom:${haut(reference.valeur)}`, 'aria-hidden': 'true' }, h('span', {}, `${reference.libelle} : ${format(reference.valeur)}`)) : null,
    lignes.map((l, i) => h('div', { class: 'gc-groupe', tabindex: '0', 'data-bulle': [l.libelle, ...series.map((x) => `${x.libelle} : ${format(l[x.cle])}`)].join('\n') },
      // valeurs : le nombre est écrit au-dessus de la colonne (un zéro reste muet : la colonne n'existe pas)
      series.map((x) => h('div', { class: 'gc-col', style: `height:${haut(l[x.cle])};background:${x.couleur};--g-lueur:${x.couleur};animation-delay:${i * 40}ms` }, valeurs && l[x.cle] ? h('em', { class: 'gc-val' }, format(l[x.cle])) : null)))));
  const noms = h('div', { class: 'gc-noms' }, lignes.map((l) => h('div', { class: 'gc-nom' },
    h('b', {}, l.libelle), detail ? h('span', {}, detail(l)) : null, pastille ? pastille(l) : null)));

  return h('div', { class: 'graphique gc-graphique' },
    h('div', { class: 'legende gc-legende' }, series.map((x) => h('span', {}, h('i', { style: `background:${x.couleur}` }), x.libelle)), note || null),
    h('div', { class: 'gc-defile', tabindex: '0', role: 'img', 'aria-label': description },
      h('div', { class: 'gc', style: `--n:${lignes.length}` }, axe, zone, h('span', {}), noms)));
}

// ---------- Salaires par service : salaire moyen et médian, la moyenne de l'entreprise en pointillé
export function etendues(lignes, description, { reference } = {}) {
  return colonnesGroupees(lignes, [
    { cle: 'moyenne', libelle: 'Salaire moyen', couleur: 'var(--serie-1)' },
    { cle: 'mediane', libelle: 'Salaire médian', couleur: 'color-mix(in srgb, var(--serie-1) 42%, var(--surface-2))' },
  ], {
    description,
    detail: (l) => fmt.pluriel(l.n, 'salarié'),
    reference: reference ? { valeur: reference, libelle: 'Moyenne entreprise' } : null,
  });
}

// ---------- Écart F/H : femmes et hommes côte à côte, l'écart écrit sous chaque groupe
export function ecarts(lignes, seuil, description) {
  return colonnesGroupees(lignes, [
    { cle: 'moyenne_femmes', libelle: 'Femmes', couleur: 'var(--serie-3)' },
    { cle: 'moyenne_hommes', libelle: 'Hommes', couleur: 'var(--serie-1)' },
  ], {
    description,
    detail: (l) => `${l.femmes} F · ${l.hommes} H`,
    pastille: (l) => h('em', {
      class: `gc-ecart${l.significatif ? ' fort' : ''}`,
      title: `${l.ecart_pct < 0 ? 'En défaveur des femmes' : l.ecart_pct > 0 ? 'En faveur des femmes' : 'À égalité'}${l.significatif ? `, au-delà du seuil d'alerte de ${fmt.pct(seuil)}` : ''}`,
    }, fmt.pctSigne(l.ecart_pct)),
    note: h('span', { class: 'discret' }, `Écart des femmes par rapport aux hommes · en rouge au-delà de ${fmt.pct(seuil)}`),
  });
}

// ---------- Jauge en demi-cercle (part d'un tout, en %), dégradé vert et halo
// valeur : 0..100 ; le chiffre est écrit au centre, les bornes 0 % et 100 % de part et d'autre.
let jauges = 0;
export function jauge(valeur, { libelle = '', description } = {}) {
  const id = `jauge-${(jauges += 1)}`;
  const v = Math.max(0, Math.min(100, Number(valeur) || 0));
  const arc = 'M 14 92 A 78 78 0 0 1 170 92';
  const svg = s('svg', { viewBox: '0 0 184 104', role: 'img', 'aria-label': description || `${fmt.pct(v)} ${libelle}` },
    s('defs', {}, s('linearGradient', { id, x1: '0', x2: '1', y1: '0', y2: '0' },
      s('stop', { offset: '0', 'stop-color': 'var(--serie-1)' }), s('stop', { offset: '1', 'stop-color': 'var(--serie-1-fort)' }))),
    s('path', { d: arc, fill: 'none', stroke: 'var(--survol)', 'stroke-width': 12, 'stroke-linecap': 'round', pathLength: 100 }),
    s('path', { class: 'jauge-arc', d: arc, fill: 'none', stroke: `url(#${id})`, 'stroke-width': 12, 'stroke-linecap': 'round', pathLength: 100, 'stroke-dasharray': `${v} 100` }));
  return h('div', { class: 'jauge' }, svg,
    h('div', { class: 'jauge-centre' }, h('b', {}, fmt.pct(v)), libelle ? h('span', {}, libelle) : null),
    h('div', { class: 'jauge-bornes', 'aria-hidden': 'true' }, h('span', {}, '0 %'), h('span', {}, '100 %')));
}

// ---------- Courbes lisses avec aire en dégradé et halo (« Sales overview » des maquettes)
// lignes : [{ x: libellé, [cle]: nombre }] ; series : [{ cle, libelle, couleur }]
let aires = 0;
function cheminLisse(points, haut, bas) {
  if (!points.length) return '';
  let d = `M${points[0][0]},${points[0][1]}`;
  const borne = (y) => Math.max(haut, Math.min(bas, y));
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, borne(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, borne(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function airesLisses(lignes, series, { format = fmt.nombre, description } = {}) {
  const id = `aire-${(aires += 1)}`;
  const L = 760; const H = 280; const g = { haut: 16, droite: 14, bas: 30, gauche: 40 };
  const max = Math.max(...lignes.flatMap((l) => series.map((x) => l[x.cle] || 0)), 1);
  const brut = max / 4;
  const p10 = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * p10).find((p) => p >= brut);
  const sommet = Math.ceil(max / pas) * pas;
  const zoneL = L - g.gauche - g.droite; const zoneH = H - g.haut - g.bas;
  const x = (i) => g.gauche + (lignes.length === 1 ? zoneL / 2 : (i * zoneL) / (lignes.length - 1));
  const y = (v) => g.haut + zoneH - ((v || 0) / sommet) * zoneH;
  const svg = s('svg', { class: 'aires', viewBox: `0 0 ${L} ${H}`, role: 'img', 'aria-label': description });
  const defs = s('defs', {});
  svg.append(defs);
  for (let v = 0; v <= sommet + 1e-9; v += pas) {
    svg.append(s('line', { class: 'aires-repere', x1: g.gauche, x2: L - g.droite, y1: y(v), y2: y(v) }));
    svg.append(s('text', { class: 'aires-axe', x: g.gauche - 8, y: y(v) + 4, 'text-anchor': 'end' }, format(v)));
  }
  series.forEach((serie, k) => {
    const gid = `${id}-${k}`;
    defs.append(s('linearGradient', { id: gid, x1: '0', x2: '0', y1: '0', y2: '1' },
      s('stop', { offset: '0', 'stop-color': serie.couleur, 'stop-opacity': '.42' }),
      s('stop', { offset: '1', 'stop-color': serie.couleur, 'stop-opacity': '0' })));
    const points = lignes.map((l, i) => [x(i), y(l[serie.cle])]);
    const ligne = cheminLisse(points, g.haut, g.haut + zoneH);
    svg.append(s('path', { class: 'aires-fond', d: `${ligne} L${x(lignes.length - 1)},${y(0)} L${x(0)},${y(0)} Z`, fill: `url(#${gid})` }));
    svg.append(s('path', { class: 'aires-ligne', d: ligne, fill: 'none', stroke: serie.couleur, 'stroke-width': 2.6, 'stroke-linecap': 'round', style: `--g-lueur:${serie.couleur}` }));
  });
  // une zone de survol par abscisse : la bulle donne toutes les séries
  lignes.forEach((l, i) => {
    const largeur = lignes.length > 1 ? zoneL / (lignes.length - 1) : zoneL;
    const groupe = s('g', { class: 'aires-point', tabindex: '0', 'data-bulle': [l.x, ...series.map((x2) => `${x2.libelle} : ${format(l[x2.cle] || 0)}`)].join('\n') },
      s('rect', { x: x(i) - largeur / 2, y: g.haut, width: largeur, height: zoneH, fill: 'transparent' }),
      s('line', { class: 'aires-curseur', x1: x(i), x2: x(i), y1: g.haut, y2: g.haut + zoneH }),
      series.map((x2) => s('circle', { cx: x(i), cy: y(l[x2.cle]), r: 4.5, fill: 'var(--surface)', stroke: x2.couleur, 'stroke-width': 2.5 })));
    svg.append(groupe);
    if (lignes.length <= 12 || i % 2 === 0) svg.append(s('text', { class: 'aires-axe', x: x(i), y: H - 8, 'text-anchor': 'middle' }, l.x));
  });
  return h('div', { class: 'graphique' },
    h('div', { class: 'legende', style: 'margin-bottom:6px' }, series.map((x2) => h('span', {}, h('i', { style: `background:${x2.couleur}` }), x2.libelle))),
    svg);
}

// ---------- Barres fines dans un panneau sombre (« Active users » des maquettes)
export function barresFines(donnees, { format = fmt.nombre, description } = {}) {
  const max = Math.max(...donnees.map((d) => d.valeur), 1);
  const brut = max / 4;
  const p10 = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * p10).find((p) => p >= brut);
  const sommet = Math.ceil(max / pas) * pas;
  const reperes = [];
  for (let v = 0; v <= sommet + 1e-9; v += pas) reperes.push(v);
  // on abrège APRÈS traduction : « Ressourc. » ne se traduirait plus
  const court = (brut) => { const t = traduireTexte(brut); return t.length > 9 ? `${t.split(/\s+/)[0].slice(0, 8)}.` : t; };
  return h('div', { class: 'bf', role: 'img', 'aria-label': description },
    h('div', { class: 'bf-axe', 'aria-hidden': 'true' }, reperes.map((v) => h('span', { style: `bottom:${(v / sommet) * 100}%` }, format(v)))),
    h('div', { class: 'bf-lignes', 'aria-hidden': 'true' }, reperes.map((v) => h('i', { class: v === 0 ? 'zero' : '', style: `bottom:${(v / sommet) * 100}%` }))),
    h('div', { class: 'bf-zone' }, donnees.map((d, i) => h('div', { class: 'bf-col', tabindex: '0', 'data-bulle': `${d.libelle} : ${format(d.valeur)}${d.detail ? `\n${d.detail}` : ''}` },
      h('i', { style: `height:${(d.valeur / sommet) * 100}%;animation-delay:${i * 45}ms` }),
      h('span', {}, court(d.libelle))))));
}

// ---------- Anneau de score (« Referral tracking » des maquettes) : valeur au centre
let anneaux = 0;
export function anneauScore(part, { valeur, libelle = '', sous = '', description } = {}) {
  const id = `score-${(anneaux += 1)}`;
  const p = Math.max(0, Math.min(100, Number(part) || 0));
  const R = 52;
  const svg = s('svg', { viewBox: '0 0 128 128', role: 'img', 'aria-label': description },
    s('defs', {}, s('linearGradient', { id, x1: '0', y1: '0', x2: '1', y2: '1' },
      s('stop', { offset: '0', 'stop-color': 'var(--serie-1-fort)' }), s('stop', { offset: '1', 'stop-color': 'var(--serie-1)' }))),
    s('circle', { cx: 64, cy: 64, r: R, fill: 'none', stroke: 'var(--survol)', 'stroke-width': 9 }),
    s('circle', { class: 'score-arc', cx: 64, cy: 64, r: R, fill: 'none', stroke: `url(#${id})`, 'stroke-width': 9, 'stroke-linecap': 'round', pathLength: 100, 'stroke-dasharray': `${p} 100`, transform: 'rotate(-90 64 64)' }));
  return h('div', { class: 'score' }, svg,
    h('div', { class: 'score-centre' }, libelle ? h('span', {}, libelle) : null, h('b', {}, valeur ?? fmt.pct(p)), sous ? h('small', {}, sous) : null));
}
