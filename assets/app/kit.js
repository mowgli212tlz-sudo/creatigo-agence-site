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
function mascotte(nom, classe = 'entete-masc') {
  return h('div', { class: classe, 'aria-hidden': 'true' }, h('img', { src: `../assets/mascotte/${nom}.webp`, alt: '', loading: 'lazy', decoding: 'async' }));
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
