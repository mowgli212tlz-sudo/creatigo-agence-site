// Kit d'interface de l'espace agence et de l'espace client : le même système que l'appli RH
// Creatigo (composants, graphiques, illustrations), aux couleurs de l'agence.
// Les scripts de l'admin (non modules) le trouvent dans window.UI : ils sont chargés en « defer »
// après ce module, donc il est prêt quand ils s'exécutent.
import { icone } from './icones.js';
import { illustration, ILLU_PAR_ICONE } from './illustrations.js';
import { h, fmt, carte, carteTableau, tuile, delta, badge, initiales, avatar, etatVide, tableau, tableauInteractif, toast, confirmer } from './outils.js';
import * as G from './graphiques.js';
import { illustrationEtape } from './illus-etapes.js';
import { PHASES, feuilleDeRoute, miniParcours, planning, entonnoir, partEtape } from './parcours.js';

// mascotte du site (assets/mascotte/<nom>.webp) : les pages de l'admin et de l'espace client sont à un niveau de la racine
// les images n'ont pas de pupilles dessinées : on les pose par-dessus (positions en % de l'image, largeur en % aussi),
// comme sur le site ; celles des mascottes illustrées viennent de mk.json
const PUPILLES = { mascotte: [[[47.62, 24.7], [79.58, 39.01]], 9.2], mascotte2: [[[22.35, 30.2], [67.29, 47.78]], 12.5], mascotte3: [[[52.17, 20.86], [71.55, 32.3]], 6] };
let mkJson = null;
function poserPupilles(boite, nom) {
  const poser = (pts, pw) => { const yeux = h('span', { class: 'masc-yeux' }); for (const [x, y] of pts) yeux.append(h('i', { class: 'masc-p', style: `left:${x}%;top:${y}%;width:${pw}%` })); boite.append(yeux); };
  if (PUPILLES[nom]) return poser(...PUPILLES[nom]);
  if (!nom.startsWith('mk-')) return;
  mkJson = mkJson || fetch(new URL('../mascotte/mk.json', import.meta.url)).then((r) => r.json()).catch(() => ({}));
  mkJson.then((d) => { const k = d[nom.slice(3)]; if (k && k.pupils) poser(k.pupils, k.pw); });
}
// les pupilles regardent vers la souris (un seul écouteur pour toute la page)
let suivi = false;
function suivreSouris() {
  if (suivi || matchMedia('(prefers-reduced-motion: reduce)').matches) return; suivi = true;
  addEventListener('pointermove', (e) => {
    for (const p of document.querySelectorAll('.masc-p')) {
      const r = p.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1, m = Math.min(1, d / 300) * 0.28;
      p.style.setProperty('--dx', (dx / d * m * 100).toFixed(1) + '%'); p.style.setProperty('--dy', (dy / d * m * 100).toFixed(1) + '%');
    }
  }, { passive: true });
}
function mascotte(nom, classe = 'entete-masc') {
  const boite = h('div', { class: 'masc-boite' }, h('img', { src: `../assets/mascotte/${nom}.webp`, alt: '', loading: 'lazy', decoding: 'async' }));
  poserPupilles(boite, nom); suivreSouris();
  return h('div', { class: classe, 'aria-hidden': 'true' }, boite);
}

// en-tête de page en bandeau : titre, phrase, mascotte (« m:nom ») ou illustration, actions
function entete(titre, sousTitre, illu, ...actions) {
  if (illu && illu.startsWith('m:')) {
    return h('div', { class: 'entete avec-masc' },
      h('div', {}, h('h1', {}, titre), sousTitre ? h('p', {}, sousTitre) : null),
      actions.flat().filter(Boolean).length ? h('div', { class: 'actions' }, actions) : null,
      mascotte(illu.slice(2)));
  }
  const dessin = illu ? illustration(illu) : null;
  return h('div', { class: `entete${dessin ? ' avec-illu' : ''}` },
    h('div', {}, h('h1', {}, titre), sousTitre ? h('p', {}, sousTitre) : null),
    actions.flat().filter(Boolean).length ? h('div', { class: 'actions' }, actions) : null,
    dessin ? h('div', { class: 'entete-illu', 'aria-hidden': 'true' }, dessin) : null);
}

// indicateurs : le carré d'icône coloré des cartes du site plutôt que l'objet 3D de l'appli RH
const tuileMarque = (libelle, valeur, precision, alerte, opts = {}) => tuile(libelle, valeur, precision, alerte, { ...opts, illustration: '-' });

window.UI = { h, fmt, icone, illustration, ILLU_PAR_ICONE, carte, carteTableau, tuile: tuileMarque, delta, badge, initiales, avatar, etatVide, tableau, tableauInteractif, toast, confirmer, entete, mascotte, G, PHASES, feuilleDeRoute, miniParcours, planning, entonnoir, partEtape, illustrationEtape };
// les icônes SVG en texte (anciens appels window.icone(nom, taille) qui renvoient du HTML)
window.icone = (nom, taille = 18) => icone(nom, taille).outerHTML;
