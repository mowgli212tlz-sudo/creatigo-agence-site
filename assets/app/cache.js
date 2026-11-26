// Mémoire des réponses GET de l'API, pour qu'une page déjà vue (ou préchargée)
// s'affiche tout de suite au lieu de repasser par « Chargement… ».
//
//   · moins de FRAIS_MS     : servie telle quelle ;
//   · jusqu'à PERIME_MS     : servie tout de suite ET relue en arrière-plan ; si la
//                             réponse a changé, les abonnés sont prévenus (la page se redessine) ;
//   · au-delà               : on attend la réponse fraîche, comme sans mémoire.
// Toute écriture (POST, PUT, DELETE) vide la mémoire : après une action, aucun chiffre
// ancien ne peut s'afficher.
//
// Jamais mis en mémoire :
//   · /api/auth/…          : l'état de la session doit toujours être celui du serveur ;
//   · /api/agent/conversations et /usage : les conversations et les jetons de la personne doivent être exacts à chaque lecture ;
//   · /api/salaries/<n°>   : ouvrir une fiche est INSCRIT au journal des accès (RGPD) ;
//                            la servir de mémoire ferait disparaître une consultation ;
// tests/cache.test.js exige que toute route GET qui écrit en base soit couverte ici.
// Un export (CSV d'un journal) doit être exact : il demande une lecture fraîche ({ frais: true }).
export const JAMAIS_EN_CACHE = /^\/api\/(auth\/|salaries\/\d|agent\/(conversations|usage))/;
export const FRAIS_MS = 15 * 1000;
export const PERIME_MS = 5 * 60 * 1000;

const copie = (d) => (typeof structuredClone === 'function' ? structuredClone(d) : JSON.parse(JSON.stringify(d)));

// charger(chemin) -> Promise<données> : la vraie requête réseau
export function creerCache(charger, { maintenant = () => Date.now() } = {}) {
  const memoire = new Map(); // chemin -> { d, texte, t }
  const enCours = new Map(); // chemin -> Promise (une seule requête à la fois par chemin)
  const abonnes = new Set();
  let generation = 0; // une réponse partie avant un vidage ne doit pas revenir le remplir

  function telecharger(chemin) {
    if (enCours.has(chemin)) return enCours.get(chemin);
    const gen = generation;
    const p = charger(chemin).then((d) => {
      if (gen === generation) {
        const avant = memoire.get(chemin);
        const texte = JSON.stringify(d);
        memoire.set(chemin, { d, texte, t: maintenant() });
        if (avant && avant.texte !== texte) abonnes.forEach((f) => f(chemin, null));
      }
      return d;
    }).finally(() => { if (enCours.get(chemin) === p) enCours.delete(chemin); });
    enCours.set(chemin, p);
    return p;
  }

  return {
    async lire(chemin, { frais = false } = {}) {
      if (JAMAIS_EN_CACHE.test(chemin)) return charger(chemin);
      const e = memoire.get(chemin);
      const age = e && !frais ? maintenant() - e.t : Infinity;
      if (age > PERIME_MS) return copie(await telecharger(chemin));
      if (age > FRAIS_MS) telecharger(chemin).catch((err) => abonnes.forEach((f) => f(chemin, err)));
      return copie(e.d);
    },
    // précharge les chemins absents de la mémoire, UN PAR UN (pas de rafale de requêtes) ;
    // les erreurs sont ignorées : la page concernée les montrera si on l'ouvre
    async precharger(chemins) {
      for (const c of chemins) {
        if (JAMAIS_EN_CACHE.test(c) || memoire.has(c)) continue;
        await telecharger(c).catch(() => {});
      }
    },
    vider() {
      generation += 1;
      memoire.clear();
      enCours.clear();
    },
    // f(chemin, erreur) : réponse relue différente (erreur null), ou relecture en échec
    abonner(f) { abonnes.add(f); return () => abonnes.delete(f); },
    taille: () => memoire.size,
  };
}
