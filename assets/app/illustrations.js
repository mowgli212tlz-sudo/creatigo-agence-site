// Illustrations des cartes de chiffres et des en-têtes de page : de petits objets « 3D » dessinés en SVG, dans le
// style du site (verre sombre, reflets, accents vert / ambre / rouge / violet, ombre portée).
//
// Pourquoi du SVG plutôt que des images :
//   · elles suivent le thème : les couleurs du verre viennent de variables CSS (--il-*), donc clair et sombre
//     sont servis par le même dessin ;
//   · nettes à toute taille et à toute densité d'écran, quelques centaines d'octets chacune, aucune requête ;
//   · animables (elles flottent doucement) et sans fond : elles se posent sur n'importe quelle carte.
//
// Chaque illustration est un objet posé sur une ombre, légèrement incliné, dans une boîte de 200 × 150.
// illustration(nom) rend un <svg> prêt à insérer ; ILLU_PAR_ICONE et ILLU_PAR_ROUTE disent laquelle choisir.

const NS = 'http://www.w3.org/2000/svg';
let compteur = 0;

function E(tag, attrs = {}, ...enfants) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, String(v));
  for (const c of enfants.flat()) if (c) e.append(c);
  return e;
}

const FAMILLES = {
  vert: ['var(--il-g1, #a7c2f3)', 'var(--il-g2, #3468d3)', 'var(--il-g3, #042778)'],
  ambre: ['#fef3c7', '#fbbf24', '#b45309'],
  rouge: ['#fecaca', '#f87171', '#b91c1c'],
  violet: ['#ede9fe', '#a78bfa', '#6d28d9'],
};

// ---- le contexte d'un dessin : ses dégradés (identifiants uniques par instance) et ses primitives
function contexte() {
  const uid = `il${++compteur}`;
  const defs = E('defs');
  const id = (n) => `${uid}-${n}`;
  const url = (n) => `url(#${id(n)})`;
  const stop = (o, c, extra = {}) => E('stop', { offset: o, style: `stop-color:${c}`, ...extra });
  const lin = (n, stops, x1 = 0, y1 = 0, x2 = 1, y2 = 1) => defs.append(E('linearGradient', { id: id(n), x1, y1, x2, y2 }, stops));
  const rad = (n, stops, cx = 0.5, cy = 0.5, r = 0.5, fx, fy) => defs.append(E('radialGradient', { id: id(n), cx, cy, r, fx, fy }, stops));
  // le verre (variables du thème), son bord, son reflet, l'ombre portée
  lin('verre', [stop(0, 'var(--il-v1)'), stop(1, 'var(--il-v2)')]);
  lin('bord', [stop(0, 'rgba(255,255,255,.5)'), stop(0.45, 'rgba(255,255,255,.08)'), stop(1, 'rgba(255,255,255,.18)')]);
  lin('reflet', [stop(0, '#ffffff', { 'stop-opacity': 0.34 }), stop(1, '#ffffff', { 'stop-opacity': 0 })], 0, 0, 0.55, 1);
  rad('ombre', [stop(0, 'var(--il-ombre)'), stop(1, 'var(--il-ombre)', { 'stop-opacity': 0 })]);
  for (const [nom, [c1, c2, c3]] of Object.entries(FAMILLES)) {
    lin(nom, [stop(0, c1), stop(0.45, c2), stop(1, c3)]);
    lin(`${nom}H`, [stop(0, c3), stop(0.5, c2), stop(1, c1)], 0, 0, 1, 0);
    rad(`lueur-${nom}`, [stop(0, c2, { 'stop-opacity': 0.5 }), stop(1, c2, { 'stop-opacity': 0 })]);
    rad(`bille-${nom}`, [stop(0, c1), stop(0.55, c2), stop(1, c3)], 0.5, 0.5, 0.62, 0.34, 0.3);
  }
  const svg = E('svg', { viewBox: '0 0 200 150', class: 'illu', 'aria-hidden': 'true', focusable: 'false', role: 'presentation' }, defs);
  const c = {
    svg, url,
    ombre: (cx, cy, rx, ry) => svg.append(E('ellipse', { cx, cy, rx, ry, fill: url('ombre') })),
    lueur: (cx, cy, r, fam) => svg.append(E('circle', { cx, cy, r, fill: url(`lueur-${fam}`) })),
    // une dalle de verre : surface, bord lumineux, reflet sur sa moitié haute
    dalle: (x, y, w, h, rx = 14) => E('g', {},
      E('rect', { x, y, width: w, height: h, rx, fill: url('verre'), stroke: url('bord'), 'stroke-width': 1.4 }),
      E('rect', { x: x + 1, y: y + 1, width: w - 2, height: h * 0.55, rx: rx - 1, fill: url('reflet'), opacity: 0.7 })),
    bille: (cx, cy, r, fam) => E('g', {},
      E('circle', { cx, cy, r, fill: url(`bille-${fam}`) }),
      E('ellipse', { cx: cx - r * 0.3, cy: cy - r * 0.42, rx: r * 0.42, ry: r * 0.22, fill: '#fff', opacity: 0.55, transform: `rotate(-28 ${cx - r * 0.3} ${cy - r * 0.42})` })),
    // un trait de « texte » : une pilule
    trait: (x, y, w, fam = null, h = 5) => E('rect', { x, y, width: w, height: h, rx: h / 2, fill: fam ? url(fam) : 'var(--il-trait)', opacity: fam ? 1 : 0.9 }),
    coche: (cx, cy, s = 1, couleur = '#040914') => E('path', { d: `M${cx - 6 * s},${cy} l${4.5 * s},${4.8 * s} l${8.5 * s},${-9.6 * s}`, fill: 'none', stroke: couleur, 'stroke-width': 3 * s, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    // incline un groupe autour d'un point (rotation + cisaillement : la « perspective » de l'objet)
    incliner: (g, cx, cy, rot = 0, skx = 0, sky = 0) => { g.setAttribute('transform', `translate(${cx} ${cy}) rotate(${rot}) skewX(${skx}) skewY(${sky}) translate(${-cx} ${-cy})`); return g; },
    ajouter: (...gs) => { svg.append(...gs.flat()); return svg; },
  };
  return c;
}

// ============================================================ les objets
const OBJETS = {
  // trois fiches de profil en éventail
  effectif(c) {
    c.ombre(100, 134, 62, 8); c.lueur(112, 74, 56, 'vert');
    const fiche = (cx, cy, rot, fam, avecCoche) => {
      const g = E('g', {}, c.dalle(cx - 33, cy - 44, 66, 88), c.bille(cx, cy - 17, 13, fam), c.trait(cx - 18, cy + 6, 36), c.trait(cx - 12, cy + 18, 24));
      if (avecCoche) g.append(c.bille(cx + 24, cy + 36, 11, 'vert'), c.coche(cx + 24, cy + 36, 0.8));
      return c.incliner(g, cx, cy, rot);
    };
    return c.ajouter(fiche(62, 78, -17, 'violet'), fiche(138, 78, 15, 'ambre'), fiche(100, 72, -2, 'vert', true));
  },
  // un bulletin de paie (en-tête, lignes, total) et une pile de pièces : la paie, pas une carte bancaire
  salaire(c) {
    c.ombre(100, 136, 66, 8); c.lueur(120, 84, 58, 'vert');
    const carte = E('g', {}, c.dalle(34, 26, 86, 108, 12),
      c.trait(48, 44, 34, 'vert', 6), c.trait(48, 58, 56), c.trait(48, 70, 48),
      E('line', { x1: 48, x2: 106, y1: 88, y2: 88, stroke: 'var(--il-trait)', 'stroke-width': 1.5 }),
      c.trait(48, 98, 26, null, 6), E('rect', { x: 80, y: 94, width: 26, height: 14, rx: 7, fill: c.url('ambre') }),
      c.trait(48, 116, 40));
    c.incliner(carte, 77, 80, -9);
    const piece = (cx, cy) => E('g', {},
      E('ellipse', { cx, cy: cy + 8, rx: 27, ry: 10, fill: c.url('vertH') }),
      E('rect', { x: cx - 27, y: cy, width: 54, height: 8, fill: c.url('vertH') }),
      E('ellipse', { cx, cy, rx: 27, ry: 10, fill: c.url('vert') }),
      E('ellipse', { cx, cy, rx: 19, ry: 6.5, fill: 'none', stroke: '#2a2c2e', 'stroke-width': 1.2, opacity: 0.55 }));
    const pile = E('g', {}, piece(140, 108), piece(140, 99), piece(140, 90),
      E('text', { x: 140, y: 94.5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, fill: '#2a2c2e', 'font-family': 'Inter, system-ui, sans-serif' }, '€'));
    return c.ajouter(carte, pile);
  },
  // une dalle de graphique en barres, qui monte
  graphique(c) {
    c.ombre(100, 134, 62, 8); c.lueur(104, 74, 54, 'vert');
    const hauteurs = [20, 32, 26, 46, 60];
    const g = E('g', {}, c.dalle(36, 30, 128, 92, 14),
      E('line', { x1: 50, x2: 150, y1: 104, y2: 104, stroke: 'var(--il-trait)', 'stroke-width': 1.5 }),
      hauteurs.map((h, i) => E('rect', { x: 52 + i * 20, y: 104 - h, width: 13, height: h, rx: 4, fill: c.url(i === 4 ? 'ambre' : 'vert') })),
      E('path', { d: 'M58,78 L78,66 L98,72 L118,54 L138,42', fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.55 }));
    c.incliner(g, 100, 76, -6);
    return c.ajouter(g);
  },
  // deux feuilles, une signature, un sceau
  contrat(c) {
    c.ombre(100, 136, 58, 8); c.lueur(104, 76, 54, 'vert');
    const arriere = c.incliner(E('g', {}, c.dalle(70, 24, 82, 108, 12), c.trait(84, 44, 40), c.trait(84, 58, 52), c.trait(84, 72, 34)), 110, 78, 11);
    const avant = E('g', {}, c.dalle(48, 28, 84, 110, 12),
      E('path', { d: 'M116,28 L132,44 H122 a6 6 0 0 1 -6 -6 Z', fill: 'var(--il-trait)', opacity: 0.9 }),
      c.trait(62, 46, 34, 'vert', 6), c.trait(62, 62, 58), c.trait(62, 74, 50), c.trait(62, 86, 44),
      E('path', { d: 'M62,112 q8,-16 14,0 t14,-6 t16,4', fill: 'none', stroke: c.url('vert'), 'stroke-width': 3, 'stroke-linecap': 'round' }),
      c.bille(116, 112, 14, 'vert'), c.coche(116, 112, 0.9));
    c.incliner(avant, 90, 82, -7);
    return c.ajouter(arriere, avant);
  },
  sablier(c) {
    c.ombre(100, 136, 50, 7); c.lueur(100, 76, 50, 'ambre');
    const g = E('g', {},
      E('path', { d: 'M72,36 H128 C128,60 108,68 108,75 C108,82 128,90 128,114 H72 C72,90 92,82 92,75 C92,68 72,60 72,36Z', fill: 'rgba(255,255,255,.07)', stroke: c.url('bord'), 'stroke-width': 1.6 }),
      E('path', { d: 'M77,42 H123 C121,56 108,61 104,69 H96 C92,61 79,56 77,42Z', fill: c.url('ambre') }),
      E('rect', { x: 99, y: 70, width: 2.4, height: 30, rx: 1.2, fill: c.url('ambre') }),
      E('path', { d: 'M75,112 C81,98 91,93 100,93 C109,93 119,98 125,112Z', fill: c.url('ambre') }),
      E('path', { d: 'M78,40 C78,58 88,66 94,72', fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.4 }),
      E('rect', { x: 62, y: 24, width: 76, height: 13, rx: 6.5, fill: c.url('verre'), stroke: c.url('bord'), 'stroke-width': 1.2 }),
      E('rect', { x: 62, y: 113, width: 76, height: 13, rx: 6.5, fill: c.url('verre'), stroke: c.url('bord'), 'stroke-width': 1.2 }));
    c.incliner(g, 100, 76, -9);
    return c.ajouter(g);
  },
  balance(c) {
    c.ombre(100, 136, 60, 7); c.lueur(100, 70, 56, 'vert');
    const pied = E('g', {}, E('ellipse', { cx: 100, cy: 126, rx: 38, ry: 8, fill: c.url('verre'), stroke: c.url('bord'), 'stroke-width': 1.2 }),
      E('rect', { x: 95, y: 36, width: 10, height: 90, rx: 5, fill: c.url('verre'), stroke: c.url('bord'), 'stroke-width': 1.2 }));
    const poutre = E('path', { d: 'M40,52 L160,38', stroke: c.url('vertH'), 'stroke-width': 7, 'stroke-linecap': 'round', fill: 'none' });
    const plateau = (x, y, fam, nb) => E('g', {},
      E('path', { d: `M${x - 22},${y - 36} L${x - 22},${y} M${x + 22},${y - 36} L${x + 22},${y}`.replace(/L/g, 'L'), stroke: 'var(--il-trait)', 'stroke-width': 1.6, fill: 'none' }),
      E('path', { d: `M${x - 28},${y} H${x + 28} C${x + 26},${y + 14} ${x + 12},${y + 18} ${x},${y + 18} C${x - 12},${y + 18} ${x - 26},${y + 14} ${x - 28},${y}Z`, fill: c.url('verre'), stroke: c.url('bord'), 'stroke-width': 1.3 }),
      Array.from({ length: nb }, (_, i) => c.bille(x - 8 + i * 14, y - 7, 8, fam)));
    return c.ajouter(pied, poutre, plateau(46, 90, 'ambre', 3), plateau(154, 76, 'vert', 1), c.bille(100, 36, 9, 'ambre'));
  },
  calendrier(c) {
    c.ombre(100, 136, 62, 8); c.lueur(100, 78, 54, 'ambre');
    const g = E('g', {}, c.dalle(42, 32, 116, 94, 14),
      E('path', { d: 'M42,48 a14,14 0 0 1 14,-14 H144 a14,14 0 0 1 14,14 V58 H42Z', fill: c.url('vert') }),
      E('rect', { x: 66, y: 24, width: 9, height: 20, rx: 4.5, fill: c.url('verre'), stroke: c.url('bord'), 'stroke-width': 1.2 }),
      E('rect', { x: 125, y: 24, width: 9, height: 20, rx: 4.5, fill: c.url('verre'), stroke: c.url('bord'), 'stroke-width': 1.2 }),
      [0, 1, 2].flatMap((r) => [0, 1, 2, 3, 4].map((col) => E('rect', { x: 56 + col * 20, y: 68 + r * 17, width: 14, height: 11, rx: 3.5, fill: (r === 1 && col === 3) ? c.url('ambre') : 'var(--il-trait)', opacity: (r === 1 && col === 3) ? 1 : 0.7 }))));
    c.incliner(g, 100, 78, -5);
    const horloge = E('g', {}, c.bille(150, 112, 22, 'ambre'), E('circle', { cx: 150, cy: 112, r: 15, fill: 'none', stroke: '#fff', 'stroke-width': 1.5, opacity: 0.6 }),
      E('path', { d: 'M150,112 V102 M150,112 L157,116', stroke: '#3b2200', 'stroke-width': 2.6, 'stroke-linecap': 'round', fill: 'none' }));
    return c.ajouter(g, horloge);
  },
  cloche(c) {
    c.ombre(100, 138, 46, 6); c.lueur(100, 72, 54, 'rouge');
    const g = E('g', {},
      E('circle', { cx: 100, cy: 27, r: 6, fill: c.url('rouge') }),
      E('path', { d: 'M100,30 C78,30 68,50 68,72 C68,94 58,100 54,108 H146 C142,100 132,94 132,72 C132,50 122,30 100,30Z', fill: c.url('rouge') }),
      E('path', { d: 'M82,42 C72,52 72,70 72,76', fill: 'none', stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.45 }),
      E('rect', { x: 52, y: 106, width: 96, height: 7, rx: 3.5, fill: c.url('rouge'), opacity: 0.9 }),
      c.bille(100, 122, 9, 'rouge'));
    c.incliner(g, 100, 80, 8);
    const badge = E('g', {}, c.bille(142, 40, 14, 'ambre'), E('rect', { x: 140.5, y: 33, width: 3, height: 9, rx: 1.5, fill: '#3b2200' }), E('circle', { cx: 142, cy: 46, r: 2, fill: '#3b2200' }));
    return c.ajouter(g, badge);
  },
  alerte(c) {
    c.ombre(100, 138, 54, 7); c.lueur(100, 82, 56, 'ambre');
    const g = E('g', {},
      E('path', { d: 'M100,30 L156,122 H44Z', fill: c.url('ambre'), stroke: c.url('ambre'), 'stroke-width': 12, 'stroke-linejoin': 'round' }),
      E('path', { d: 'M62,112 L96,52', fill: 'none', stroke: '#fff', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.4 }),
      E('rect', { x: 95.5, y: 62, width: 9, height: 32, rx: 4.5, fill: '#3b2200' }),
      E('circle', { cx: 100, cy: 108, r: 5.5, fill: '#3b2200' }));
    c.incliner(g, 100, 80, -4);
    return c.ajouter(g);
  },
  bouclier(c, fam = 'rouge') {
    c.ombre(100, 138, 46, 6); c.lueur(100, 78, 56, fam);
    const contour = 'M100,24 L152,42 V80 C152,108 130,126 100,138 C70,126 48,108 48,80 V42Z';
    const g = E('g', {}, E('path', { d: contour, fill: c.url(fam) }),
      E('path', { d: 'M100,34 L142,48 V80 C142,102 124,116 100,127 C76,116 58,102 58,80 V48Z', fill: 'rgba(0,0,0,.22)' }),
      E('path', { d: 'M62,52 C62,80 70,96 86,110', fill: 'none', stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.4 }));
    if (fam === 'rouge') g.append(E('rect', { x: 95.5, y: 54, width: 9, height: 34, rx: 4.5, fill: '#fff' }), E('circle', { cx: 100, cy: 102, r: 5.5, fill: '#fff' }));
    else g.append(c.coche(100, 82, 2.2, '#fff'));
    c.incliner(g, 100, 82, -5);
    return c.ajouter(g);
  },
  marteau(c) {
    c.ombre(100, 136, 60, 7); c.lueur(104, 70, 54, 'violet');
    const socle = E('g', {}, c.dalle(44, 108, 112, 22, 8));
    const g = E('g', {},
      E('rect', { x: 95, y: 58, width: 11, height: 62, rx: 5.5, fill: c.url('ambre') }),
      E('rect', { x: 64, y: 34, width: 74, height: 32, rx: 11, fill: c.url('violet') }),
      E('rect', { x: 76, y: 34, width: 9, height: 32, fill: c.url('verre') }), E('rect', { x: 117, y: 34, width: 9, height: 32, fill: c.url('verre') }),
      E('path', { d: 'M70,42 H130', stroke: '#fff', 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: 0.4 }));
    c.incliner(g, 100, 92, -28);
    return c.ajouter(socle, g);
  },
  cle(c) {
    c.ombre(100, 136, 62, 7); c.lueur(100, 78, 56, 'vert');
    const g = E('g', {},
      E('rect', { x: 88, y: 66, width: 70, height: 13, rx: 6.5, fill: c.url('vertH') }),
      E('rect', { x: 128, y: 77, width: 9, height: 14, rx: 3, fill: c.url('vert') }), E('rect', { x: 144, y: 77, width: 9, height: 19, rx: 3, fill: c.url('vert') }),
      E('circle', { cx: 70, cy: 72, r: 28, fill: c.url('bille-vert') }),
      E('circle', { cx: 70, cy: 72, r: 11, fill: 'var(--il-v2)', stroke: 'rgba(255,255,255,.35)', 'stroke-width': 1.5 }),
      E('path', { d: 'M52,58 C58,48 70,44 80,46', fill: 'none', stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.5 }));
    c.incliner(g, 100, 80, -22);
    return c.ajouter(g);
  },
  oeil(c) {
    c.ombre(100, 130, 62, 7); c.lueur(100, 76, 58, 'vert');
    return c.ajouter(
      E('path', { d: 'M24,76 C56,36 144,36 176,76 C144,116 56,116 24,76Z', fill: c.url('verre'), stroke: c.url('bord'), 'stroke-width': 1.6 }),
      E('path', { d: 'M24,76 C56,36 144,36 176,76', fill: 'none', stroke: '#fff', 'stroke-width': 2, opacity: 0.25 }),
      c.bille(100, 76, 27, 'vert'),
      E('circle', { cx: 100, cy: 76, r: 11, fill: '#040914' }),
      E('circle', { cx: 91, cy: 66, r: 4.5, fill: '#fff', opacity: 0.9 }));
  },
  bulles(c) {
    c.ombre(100, 136, 60, 7); c.lueur(104, 74, 54, 'vert');
    const a = E('g', {}, E('path', { d: 'M54,34 H124 a16,16 0 0 1 16,16 V76 a16,16 0 0 1 -16,16 H78 L56,108 V92 a16,16 0 0 1 -16,-16 V50 a16,16 0 0 1 14,-16Z', fill: c.url('vert') }),
      c.trait(56, 52, 60, null, 6), c.trait(56, 66, 40, null, 6));
    a.querySelectorAll('rect').forEach((r) => { r.setAttribute('fill', 'rgba(4, 9, 20,.55)'); });
    const b = E('g', {}, E('path', { d: 'M86,64 H156 a16,16 0 0 1 16,16 V104 a16,16 0 0 1 -14,16 V134 L136,120 H100 a16,16 0 0 1 -16,-16 V80 a16,16 0 0 1 2,-16Z', fill: c.url('verre'), stroke: c.url('bord'), 'stroke-width': 1.4 }),
      E('path', { d: 'M86,64 H156 a16,16 0 0 1 16,16 V92 H84 V80 a16,16 0 0 1 2,-16Z', fill: c.url('reflet'), opacity: 0.6 }),
      c.bille(106, 92, 6, 'vert'), c.bille(126, 92, 6, 'violet'), c.bille(146, 92, 6, 'ambre'));
    return c.ajouter(a, b);
  },
  jauge(c) {
    c.ombre(100, 130, 62, 7); c.lueur(100, 86, 56, 'vert');
    const arc = 'M38,110 A62,62 0 0 1 162,110';
    return c.ajouter(
      E('path', { d: arc, fill: 'none', stroke: 'var(--il-trait)', 'stroke-width': 16, 'stroke-linecap': 'round', opacity: 0.8 }),
      E('path', { d: arc, fill: 'none', stroke: c.url('vertH'), 'stroke-width': 16, 'stroke-linecap': 'round', 'stroke-dasharray': '154 400' }),
      E('path', { d: 'M100,110 L128,72', stroke: '#fff', 'stroke-width': 4.5, 'stroke-linecap': 'round' }),
      c.bille(100, 110, 11, 'ambre'));
  },
  puce(c) {
    c.ombre(100, 136, 56, 7); c.lueur(100, 78, 56, 'vert');
    const broches = [0, 1, 2, 3].flatMap((i) => [
      E('rect', { x: 52, y: 52 + i * 15, width: 12, height: 6, rx: 3, fill: '#cbced5', opacity: 0.85 }), E('rect', { x: 136, y: 52 + i * 15, width: 12, height: 6, rx: 3, fill: '#cbced5', opacity: 0.85 }),
      E('rect', { x: 62 + i * 15, y: 34, width: 6, height: 12, rx: 3, fill: '#cbced5', opacity: 0.85 }), E('rect', { x: 62 + i * 15, y: 112, width: 6, height: 12, rx: 3, fill: '#cbced5', opacity: 0.85 })]);
    const g = E('g', {}, broches, c.dalle(60, 42, 80, 76, 14),
      E('rect', { x: 78, y: 60, width: 44, height: 40, rx: 9, fill: c.url('vert') }),
      E('rect', { x: 86, y: 68, width: 28, height: 24, rx: 5, fill: 'rgba(4, 9, 20,.45)' }));
    c.incliner(g, 100, 80, -6);
    return c.ajouter(g);
  },
  mallette(c) {
    c.ombre(100, 136, 62, 7); c.lueur(100, 82, 54, 'ambre');
    const g = E('g', {},
      E('path', { d: 'M80,58 V46 a9,9 0 0 1 9,-9 H111 a9,9 0 0 1 9,9 V58', fill: 'none', stroke: c.url('bord'), 'stroke-width': 7, 'stroke-linecap': 'round' }),
      c.dalle(42, 56, 116, 68, 14),
      E('path', { d: 'M42,88 H158', stroke: 'var(--il-trait)', 'stroke-width': 2 }),
      E('rect', { x: 90, y: 80, width: 20, height: 18, rx: 5, fill: c.url('ambre') }));
    c.incliner(g, 100, 90, -5);
    return c.ajouter(g);
  },
  journal(c) {
    c.ombre(100, 136, 60, 7); c.lueur(100, 78, 54, 'vert');
    const ligne = (y, fam, l1, l2) => E('g', {}, c.bille(66, y, 8, fam), c.trait(82, y - 6, l1, null, 6), c.trait(82, y + 4, l2), E('rect', { x: 128, y: y - 6, width: 22, height: 12, rx: 6, fill: 'var(--il-trait)', opacity: 0.8 }));
    const g = E('g', {}, c.dalle(44, 28, 112, 98, 14), ligne(56, 'vert', 36, 24), ligne(82, 'violet', 30, 40), ligne(108, 'rouge', 40, 22));
    c.incliner(g, 100, 78, -5);
    return c.ajouter(g);
  },
  robot(c) {
    c.ombre(100, 138, 50, 7); c.lueur(100, 78, 56, 'vert');
    const g = E('g', {},
      E('rect', { x: 98.5, y: 22, width: 3, height: 14, fill: 'var(--il-trait)' }), c.bille(100, 20, 6, 'vert'),
      c.bille(42, 80, 11, 'verre'.replace('verre', 'violet')), c.bille(158, 80, 11, 'violet'),
      c.dalle(52, 36, 96, 88, 22),
      E('rect', { x: 66, y: 56, width: 68, height: 40, rx: 14, fill: '#060910', opacity: 0.85 }),
      E('rect', { x: 77, y: 66, width: 13, height: 15, rx: 6.5, fill: c.url('vert') }), E('rect', { x: 110, y: 66, width: 13, height: 15, rx: 6.5, fill: c.url('vert') }),
      E('path', { d: 'M88,90 q12,8 24,0', fill: 'none', stroke: c.url('vert'), 'stroke-width': 3, 'stroke-linecap': 'round' }));
    c.incliner(g, 100, 80, -4);
    return c.ajouter(g);
  },
  reglages(c) {
    c.ombre(100, 136, 60, 7); c.lueur(100, 78, 54, 'vert');
    const piste = (y, pos, fam) => E('g', {}, E('rect', { x: 58, y: y - 3, width: 84, height: 6, rx: 3, fill: 'var(--il-trait)', opacity: 0.8 }), E('rect', { x: 58, y: y - 3, width: pos, height: 6, rx: 3, fill: c.url(fam) }), c.bille(58 + pos, y, 9, fam));
    const g = E('g', {}, c.dalle(42, 30, 116, 92, 14), piste(54, 52, 'vert'), piste(76, 30, 'violet'), piste(98, 66, 'ambre'));
    c.incliner(g, 100, 78, -5);
    return c.ajouter(g);
  },
};

// « bouclier vert » : la même forme, en vert (page Transparence)
OBJETS['bouclier-vert'] = (c) => OBJETS.bouclier(c, 'vert');

export function illustration(nom) {
  const dessin = OBJETS[nom];
  if (!dessin) return null;
  const c = contexte();
  dessin(c);
  return c.svg;
}

export const NOMS_ILLUSTRATIONS = Object.keys(OBJETS);

// l'icône (Lucide) d'une carte de chiffres -> l'objet qui l'illustre
export const ILLU_PAR_ICONE = {
  users: 'effectif', euro: 'salaire', wallet: 'salaire', percent: 'graphique', 'chart-column': 'graphique',
  'file-signature': 'contrat', 'clipboard-check': 'contrat', hourglass: 'sablier', history: 'sablier', clock: 'sablier',
  scale: 'balance', 'calendar-clock': 'calendrier', bell: 'cloche', 'triangle-alert': 'alerte', 'circle-alert': 'alerte', info: 'alerte',
  'shield-alert': 'bouclier', gavel: 'marteau', 'log-in': 'cle', 'key-round': 'cle', eye: 'oeil', 'message-square': 'bulles', 'thumbs-up': 'bulles',
  gauge: 'jauge', cpu: 'puce', monitor: 'puce', briefcase: 'mallette', 'scroll-text': 'journal',
};

// la route d'une page -> l'objet de son en-tête
export const ILLU_PAR_ROUTE = {
  remunerations: 'salaire', contrats: 'contrat', salaries: 'effectif', alertes: 'cloche', agent: 'robot',
  conformite: 'bouclier-vert', journal: 'journal', admin: 'cle', parametres: 'reglages',
};
