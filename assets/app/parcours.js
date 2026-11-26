// Schémas propres à l'agence : le parcours d'un projet (4 étapes expliquées), le planning des projets
// et l'entonnoir commercial. Tout passe par h() : aucun texte n'est injecté comme du HTML.
import { h } from './outils.js';
import { icone } from './icones.js';

// ---------- Les 4 étapes d'un projet avec Creatigo : ce que fait l'agence, ce qu'on attend du client, ce qui est livré.
// « jusqua » : avancement (en %) à la fin de l'étape, pour estimer les jalons franchis à l'intérieur de l'étape en cours.
export const PHASES = [
  {
    n: 1, desc: 'Nous prenons le temps de comprendre votre activité, vos clients et vos objectifs, pour vous proposer le bon site, au bon prix.', nom: 'Découverte', titre: 'On comprend votre projet', duree: '≈ 1 semaine', ic: 'search', jusqua: 15,
    agence: ['Rendez-vous de cadrage (1 h)', 'Analyse de votre activité et de vos concurrents', 'Proposition : contenu, planning et devis'],
    client: ['Présenter votre activité et vos objectifs', 'Partager des sites que vous aimez', 'Valider le devis'],
    livrable: 'Cahier des charges et planning validés',
  },
  {
    n: 2, desc: 'Nous dessinons chaque page de votre site et rédigeons les textes, jusqu’à ce que le résultat vous ressemble.', nom: 'Conception', titre: 'On imagine votre site', duree: '≈ 2 à 3 semaines', ic: 'palette', jusqua: 45,
    agence: ['Plan du site (les pages et leur ordre)', 'Maquettes de chaque page, ordinateur et mobile', 'Textes rédigés pour Google'],
    client: ['Envoyer logo, photos et informations', 'Relire les textes', 'Valider les maquettes (2 allers-retours inclus)'],
    livrable: 'Maquettes validées',
  },
  {
    n: 3, desc: 'Nous développons votre site, le testons sur tous les écrans, puis le mettons en ligne avec vous.', nom: 'Lancement', titre: 'On construit et on met en ligne', duree: '≈ 2 à 4 semaines', ic: 'rocket', jusqua: 85,
    agence: ['Développement du site', 'Tests : mobile, vitesse, sécurité, référencement', 'Mise en ligne et prise en main'],
    client: ['Tester la version de prévisualisation', 'Donner l’accès au nom de domaine', 'Donner le feu vert'],
    livrable: 'Site en ligne',
  },
  {
    n: 4, desc: 'Votre site est en ligne : nous le gardons à jour et sécurisé, et vous rendons compte chaque mois de ses résultats.', nom: 'Suivi', titre: 'On fait vivre votre site', duree: 'en continu', ic: 'activity', jusqua: 100,
    agence: ['Mises à jour, sauvegardes et sécurité', 'Rapport mensuel : visites et positions Google', 'Petites évolutions sur demande'],
    client: ['Nous signaler un besoin', 'Lire le rapport mensuel'],
    livrable: 'Rapport mensuel',
  },
];

const borne = (v) => Math.max(0, Math.min(100, Number(v) || 0));
// nombre de jalons franchis dans l'étape en cours, estimé d'après l'avancement global
function jalonsFaits(phase, avancement) {
  const debut = phase.n > 1 ? PHASES[phase.n - 2].jusqua : 0;
  const part = (borne(avancement) - debut) / (phase.jusqua - debut);
  return Math.max(0, Math.min(phase.agence.length, Math.floor(part * phase.agence.length)));
}
function etatPhase(p, etape) { return p.n < etape ? 'fait' : p.n === etape ? 'cours' : 'avenir'; }
const LIB_ETAT = { fait: 'Terminée', cours: 'En cours', avenir: 'À venir' };

// ---------- Grand schéma : la feuille de route du projet
// Les 4 cartes SONT le parcours : reliées par des flèches, chacune donne tout le détail de son étape
// (avancement, ce que fait l'agence, ce qu'on attend du client, livrable, durée).
// opts.vue : 'client' (dit « vous ») ou 'agence' (dit « le client »)
export function feuilleDeRoute(etape, avancement, opts = {}) {
  const e = Math.max(1, Math.min(4, Number(etape) || 1));
  const av = borne(avancement);
  const vous = opts.vue !== 'agence';
  return h('ol', { class: 'fr', 'aria-label': 'Les quatre étapes du projet' }, PHASES.map((p) => {
    const etat = etatPhase(p, e);
    const faits = etat === 'fait' ? p.agence.length : etat === 'cours' ? jalonsFaits(p, av) : 0;
    const debut = p.n > 1 ? PHASES[p.n - 2].jusqua : 0;
    const part = etat === 'fait' ? 100 : etat === 'cours' ? Math.max(4, Math.min(100, ((av - debut) / (p.jusqua - debut)) * 100)) : 0;
    return h('li', { class: `fr-carte ${etat}`, 'aria-current': etat === 'cours' ? 'step' : null },
      etat === 'cours' ? h('span', { class: 'fr-ici' }, icone('map-pin', 13), vous ? 'Vous êtes ici' : 'Étape en cours') : null,
      // en-tête coloré : numéro, icône, état, avancement de l'étape
      h('div', { class: 'fr-tete' },
        h('div', { class: 'fr-tete-ligne' },
          h('span', { class: 'fr-ico', 'aria-hidden': 'true' }, etat === 'fait' ? icone('check', 18) : icone(p.ic, 18)),
          h('span', { class: 'fr-num' }, `Étape ${p.n}`),
          h('span', { class: `fr-etat ${etat}` }, LIB_ETAT[etat])),
        h('h3', {}, p.nom),
        h('p', { class: 'fr-titre' }, p.titre),
        h('div', { class: 'fr-prog', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(part)), 'aria-label': `Avancement de l’étape ${p.nom}` },
          h('i', { style: `width:${part}%` })),
        h('small', { class: 'fr-prog-txt' }, etat === 'fait' ? 'Étape terminée' : etat === 'cours' ? `${faits} sur ${p.agence.length} points faits` : 'Pas encore commencée')),
      // ce que fait l'agence : les jalons, cochés au fil de l'avancement
      h('div', { class: 'fr-bloc agence' },
        h('h4', {}, icone('users-round', 14), 'Ce que fait l’agence'),
        h('ul', { class: 'fr-jalons' }, p.agence.map((j, i) => h('li', { class: i < faits ? 'ok' : (etat === 'cours' && i === faits ? 'actuel' : '') },
          h('span', { class: 'fr-coche', 'aria-hidden': 'true' }, i < faits ? icone('check', 11) : null), h('span', {}, j), etat === 'cours' && i === faits ? h('em', { class: 'fr-encours' }, 'en cours') : null)))),
      // ce qu'on attend du client
      h('div', { class: 'fr-bloc client' },
        h('h4', {}, icone('user', 14), vous ? 'Ce dont nous avons besoin de vous' : 'Ce qu’on attend du client'),
        h('ul', {}, p.client.map((x) => h('li', {}, x)))),
      // livrable et durée
      h('div', { class: 'fr-pied' },
        h('div', { class: 'fr-livrable' }, h('span', { class: 'fr-pied-ico' }, icone('badge-check', 15)), h('div', {}, h('small', {}, 'À la fin de l’étape'), h('b', {}, p.livrable))),
        h('span', { class: 'fr-duree' }, icone('clock', 13), p.duree)),
      p.n < 4 ? h('span', { class: 'fr-fleche', 'aria-hidden': 'true' }, icone('arrow-right', 16)) : null);
  }));
}

// ---------- Version compacte (cartes de projet, tableaux de bord) : 4 segments nommés
export function miniParcours(etape, avancement) {
  const e = Math.max(1, Math.min(4, Number(etape) || 1));
  const av = borne(avancement);
  return h('ol', { class: 'mp', 'aria-label': `Étape ${e} sur 4 : ${PHASES[e - 1].nom}` }, PHASES.map((p) => {
    const etat = etatPhase(p, e);
    const debut = p.n > 1 ? PHASES[p.n - 2].jusqua : 0;
    const rempli = etat === 'fait' ? 100 : etat === 'cours' ? Math.max(6, ((av - debut) / (p.jusqua - debut)) * 100) : 0;
    return h('li', { class: etat, 'data-bulle': `${p.nom} : ${LIB_ETAT[etat].toLowerCase()}` },
      h('span', { class: 'mp-barre' }, h('i', { style: `width:${Math.min(100, rempli)}%` })),
      h('span', { class: 'mp-nom' }, p.nom));
  }));
}

// ---------- Planning (diagramme de Gantt) : une barre par projet, du début à l'échéance, ligne « aujourd'hui »
// lignes : [{ libelle, sous, debut (iso), fin (iso), ton ('retard' | 'fini' | ''), href, avance (0-100) }]
export function planning(lignes, { description = 'Planning des projets' } = {}) {
  const jour = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00`).getTime();
  const auj = Date.now();
  const valides = lignes.filter((l) => l.debut && l.fin);
  if (!valides.length) return h('p', { class: 'discret' }, 'Ajoutez une échéance à vos projets pour les voir sur le planning.');
  const min = Math.min(auj, ...valides.map((l) => jour(l.debut)));
  const max = Math.max(auj, ...valides.map((l) => jour(l.fin)));
  // de début du mois du plus ancien à la fin du mois du plus lointain
  const d0 = new Date(min); d0.setDate(1); d0.setHours(0, 0, 0, 0);
  const d1 = new Date(max); d1.setMonth(d1.getMonth() + 1, 1); d1.setHours(0, 0, 0, 0);
  const t0 = d0.getTime(); const duree = d1.getTime() - t0;
  const pos = (t) => ((t - t0) / duree) * 100;
  const mois = [];
  for (const d = new Date(d0); d < d1; d.setMonth(d.getMonth() + 1)) mois.push({ l: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''), x: pos(d.getTime()) });
  return h('div', { class: 'gantt', role: 'img', 'aria-label': description },
    h('div', { class: 'gantt-axe', 'aria-hidden': 'true' }, h('span', { class: 'gantt-vide' }), h('div', { class: 'gantt-mois' }, mois.map((m) => h('span', { style: `left:${m.x}%` }, m.l)))),
    h('div', { class: 'gantt-corps' },
      h('i', { class: 'gantt-auj', style: `left:calc(var(--gantt-nom) + (100% - var(--gantt-nom)) * ${pos(auj) / 100})`, 'data-bulle': 'Aujourd’hui' }),
      valides.map((l) => {
        const a = pos(jour(l.debut)); const b = Math.max(a + 1.5, pos(jour(l.fin)));
        const fin = new Date(jour(l.fin)).toLocaleDateString('fr-FR');
        return h('div', { class: 'gantt-ligne' },
          h('a', { class: 'gantt-nom', href: l.href || null }, h('b', {}, l.libelle), l.sous ? h('small', {}, l.sous) : null),
          h('div', { class: 'gantt-piste' },
            mois.map((m) => h('i', { class: 'gantt-grille', style: `left:${m.x}%` })),
            h('span', { class: `gantt-barre ${l.ton || ''}`, style: `left:${a}%;width:${b - a}%`, tabindex: '0', 'data-bulle': `${l.libelle}\nÉchéance : ${fin}${l.avance != null ? ` · ${Math.round(l.avance)} %` : ''}` },
              l.avance != null ? h('i', { style: `width:${borne(l.avance)}%` }) : null)));
      })));
}

// ---------- Entonnoir commercial : chaque étape plus étroite, taux de passage entre deux étapes
// etapes : [{ libelle, valeur, detail, ic }]
export function entonnoir(etapes, { description = 'Entonnoir commercial' } = {}) {
  const max = Math.max(...etapes.map((x) => x.valeur), 1);
  let largeur = 100;
  return h('ol', { class: 'ent', role: 'img', 'aria-label': description }, etapes.map((x, i) => {
    const prec = i ? etapes[i - 1].valeur : null;
    // un entonnoir ne s'élargit jamais : au plus la largeur de l'étape précédente, et pas de taux au-delà de 100 %
    largeur = Math.min(largeur, Math.max(18, (x.valeur / max) * 100));
    const taux = prec && x.valeur <= prec ? Math.round((x.valeur / prec) * 100) : null;
    return h('li', { style: `--l:${largeur}%;--i:${i}` },
      i ? h('span', { class: 'ent-taux', 'aria-label': taux == null ? 'Taux de passage non calculable' : `Taux de passage ${taux} %` }, icone('arrow-down', 12), taux == null ? '–' : `${taux} %`) : null,
      h('div', { class: 'ent-barre', 'data-bulle': `${x.libelle} : ${x.valeur}${x.detail ? `\n${x.detail}` : ''}` },
        h('span', { class: 'ent-ico', 'aria-hidden': 'true' }, icone(x.ic || 'circle-check', 15)),
        h('span', { class: 'ent-lib' }, x.libelle),
        h('b', {}, String(x.valeur))),
      x.detail ? h('small', {}, x.detail) : null);
  }));
}

// Avancement d'une étape (0-100) déduit de l'avancement réel du projet et de son étape enregistrée :
// étapes passées 100, étapes à venir 0, étape en cours : la part de son intervalle d'avancement déjà parcourue.
export function partEtape(n, etape, avancement) {
  const e = Math.max(1, Math.min(4, Number(etape) || 1));
  if (n < e) return 100;
  if (n > e) return 0;
  const p = PHASES[n - 1]; const debut = n > 1 ? PHASES[n - 2].jusqua : 0;
  return Math.max(0, Math.min(100, ((borne(avancement) - debut) / (p.jusqua - debut)) * 100));
}
