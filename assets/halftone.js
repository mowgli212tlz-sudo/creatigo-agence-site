/* Nos services : fond « halftone flow » (trame de points sur un champ d'écoulement, WebGL), repris du site Creatigo RH et passé au bleu Creatigo.
   Ne tourne que lorsque la section est à l'écran ; sans WebGL le fond uni reste ; mouvement réduit : image fixe. */
;(function () {
// Fond « halftone flow » de l'écran final : une trame de points dont la taille suit un champ
// d'écoulement qui ondule (déformation de domaine : le champ est replié sur lui-même plusieurs fois,
// ce qui donne ces volutes). WebGL, un seul shader, aucune bibliothèque : la politique de sécurité du site
// interdit tout chargement extérieur.
//
// Interaction (si « interactif ») :
//   · le curseur est un TOURBILLON : autour de lui les points grossissent, s'éclaircissent et le champ
//     tourne ; plus on bouge vite, plus il remue ;
//   · un clic lance une ONDE qui s'étend depuis le curseur et déforme la trame sur son passage.
//
// Principes :
//   · il ne tourne QUE quand son écran est affiché (demarrer / arreter) — et les écouteurs de souris
//     avec lui : un fond animé qui calcule en coulisses use la batterie pour rien ;
//   · sans WebGL, rien ne casse : creerHalftone rend null et le fond sombre du CSS reste ;
//   · moins de mouvement demandé : pas d'interaction, une image fixe (image) au lieu d'une boucle ;
//   · la résolution suit l'écran mais plafonne à 1,5 : une trame de points n'a pas besoin de plus, et le
//     calcul est par pixel.

const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform float uCell;
uniform vec2 uSouris;   // position lissée du curseur, en pixels de l'écran de dessin (origine en bas à gauche)
uniform float uForce;   // 0 = curseur absent, 1 = curseur qui remue
uniform vec3 uOnde;     // x, y du clic et son âge en secondes (< 0 : aucune onde)

// le champ : on déforme les coordonnées quatre fois par un déplacement qui dépend d'elles-mêmes
float champ(vec2 p, float t) {
  vec2 q = p;
  for (int i = 0; i < 4; i++) {
    float k = float(i);
    q += 0.62 * vec2(sin(q.y * 1.7 + t * 0.35 + k * 1.3), cos(q.x * 1.5 - t * 0.30 + k * 2.1));
  }
  return 0.5 + 0.5 * sin(q.x * 2.2 + q.y * 1.3 + length(q) * 1.1);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 id = floor(frag / uCell);
  vec2 centre = (id + 0.5) * uCell;
  // les coordonnées du CHAMP viennent du centre de la case : tous les pixels d'un point voient la même valeur
  vec2 uv = (centre - 0.5 * uRes) / uRes.y * 3.2;

  // --- le curseur : un tourbillon qui s'estompe avec la distance
  vec2 versLui = centre - uSouris;
  float dm = length(versLui) / (uCell * 8.0);
  float inf = exp(-dm * dm) * uForce;
  vec2 dir = versLui / max(length(versLui), 1.0);
  uv += (dir * 0.35 + vec2(-dir.y, dir.x) * 0.55) * inf;

  // --- l'onde du clic : une couronne qui s'élargit et s'éteint
  float onde = 0.0;
  if (uOnde.z >= 0.0) {
    vec2 depuis = centre - uOnde.xy;
    float rayon = uOnde.z * uCell * 24.0;
    float bande = exp(-pow((length(depuis) - rayon) / (uCell * 2.4), 2.0));
    onde = bande * exp(-uOnde.z * 1.5);
    uv += (depuis / max(length(depuis), 1.0)) * onde * 0.32;
  }

  // le curseur et l'onde RELÈVENT la valeur du champ : les zones creuses se remplissent de points, les crêtes
  // (déjà à leur taille maximale) restent des points. Gonfler le rayon faisait fusionner les points en blocs carrés.
  float v = clamp(champ(uv, uTime) + inf * 0.42 + onde * 0.5, 0.0, 1.0);
  float r = uCell * 0.54 * smoothstep(0.12, 0.96, v);
  float d = length(frag - centre);
  float a = 1.0 - smoothstep(r - 0.9, r + 0.9, d);
  // du vert profond (creux du champ) au menthe clair (crête) ; le curseur et l'onde éclaircissent
  vec3 col = mix(vec3(0.03, 0.15, 0.55), vec3(0.45, 0.68, 1.0), smoothstep(0.35, 1.0, v));
  // pas d'éclaircissement blanc autour du curseur ni de l'onde : seuls les points grossissent
  gl_FragColor = vec4(col * a, a);
}
`;

function compiler(gl, type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
  return s;
}

function creerHalftone(canvas, { interactif = false } = {}) {
  if (!canvas) return null;
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' });
  if (!gl) return null;
  const vs = compiler(gl, gl.VERTEX_SHADER, VERT);
  const fs = compiler(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  // un rectangle qui couvre tout l'écran
  const tampon = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const place = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(place);
  gl.vertexAttribPointer(place, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uCell = gl.getUniformLocation(prog, 'uCell');
  const uSouris = gl.getUniformLocation(prog, 'uSouris');
  const uForce = gl.getUniformLocation(prog, 'uForce');
  const uOnde = gl.getUniformLocation(prog, 'uOnde');

  let largeur = 0;
  let hauteur = 0;
  let dpr = 1;
  const mesurer = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (w === largeur && h === hauteur) return;
    largeur = w; hauteur = h;
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
  };

  // ---- l'état du curseur (en pixels de l'écran de dessin) ; x, y : position lissée ; cx, cy : la vraie
  const s = { x: 0, y: 0, cx: 0, cy: 0, vu: false, presence: 0, cible: 0, energie: 0, onde: null };
  let dernierMs = 0;
  const avancer = (maintenant) => {
    const dt = dernierMs ? Math.min(0.1, (maintenant - dernierMs) / 1000) : 0.016;
    dernierMs = maintenant;
    if (!interactif) return;
    const k = 1 - Math.exp(-dt * 9);
    s.x += (s.cx - s.x) * k;
    s.y += (s.cy - s.y) * k;
    s.presence += (s.cible - s.presence) * (1 - Math.exp(-dt * 6));
    s.energie *= Math.exp(-dt * 2.5);
    if (s.onde && (maintenant - s.onde.t) / 1000 > 3.5) s.onde = null;
  };

  let temps = 0;
  const dessiner = (t) => {
    temps = t;
    mesurer();
    const maintenant = performance.now();
    avancer(maintenant);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uRes, largeur, hauteur);
    gl.uniform1f(uTime, t);
    // taille d'un point : 16 px d'écran sur ordinateur, 11 sur un petit écran (sinon la trame mange le texte)
    gl.uniform1f(uCell, (canvas.clientWidth < 700 ? 11 : 16) * dpr);
    gl.uniform2f(uSouris, s.x, s.y);
    gl.uniform1f(uForce, interactif ? s.presence * (0.55 + 0.45 * s.energie) : 0);
    gl.uniform3f(uOnde, s.onde ? s.onde.x : 0, s.onde ? s.onde.y : 0, s.onde ? (maintenant - s.onde.t) / 1000 : -1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  // ---- les écouteurs : posés au démarrage, retirés à l'arrêt (rien ne s'écoute hors de l'écran final)
  const versEcran = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    return { gx: x * dpr, gy: (r.height - y) * dpr, dedans: x >= 0 && x <= r.width && y >= 0 && y <= r.height, deltaPx: 0 };
  };
  const surDeplacement = (e) => {
    const p = versEcran(e);
    s.cible = p.dedans ? 1 : 0;
    if (!p.dedans) return;
    if (!s.vu) { s.x = p.gx; s.y = p.gy; s.cx = p.gx; s.cy = p.gy; s.vu = true; } // la première fois : pas de traînée depuis le coin
    s.energie = Math.min(1, Math.max(s.energie, Math.hypot(p.gx - s.cx, p.gy - s.cy) / dpr / 45));
    s.cx = p.gx; s.cy = p.gy;
  };
  const surClic = (e) => {
    const p = versEcran(e);
    if (p.dedans) s.onde = { x: p.gx, y: p.gy, t: performance.now() };
  };
  const surSortie = () => { s.cible = 0; s.vu = false; };

  let raf = 0;
  let depart = 0;
  let perdu = false;
  let temps0 = 0;
  const boucle = (ms) => {
    dessiner(temps0 + (ms - depart) / 1000 * 0.55);
    raf = requestAnimationFrame(boucle);
  };
  const ecouter = (oui) => {
    if (!interactif) return;
    const f = oui ? 'addEventListener' : 'removeEventListener';
    window[f]('pointermove', surDeplacement, { passive: true });
    window[f]('pointerdown', surClic, { passive: true });
    document.documentElement[f]('pointerleave', surSortie);
    window[f]('blur', surSortie);
  };
  const api = {
    // lance la boucle (reprend là où elle s'était arrêtée : pas de saut quand on revient sur l'écran)
    demarrer() {
      if (raf || perdu) return;
      temps0 = temps;
      depart = performance.now();
      dernierMs = 0;
      ecouter(true);
      // une première image TOUT DE SUITE, à la bonne taille : sans elle, le canvas reste à sa taille par
      // défaut (300 × 150) étiré sur tout l'écran jusqu'au premier cycle d'animation
      dessiner(temps);
      raf = requestAnimationFrame(boucle);
    },
    arreter() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      ecouter(false);
      surSortie();
    },
    // une image fixe : pour « moins de mouvement »
    image(t = 3) { if (!perdu) dessiner(t); },
    dessiner,
    // pour les essais : simule le curseur sans événement du navigateur
    _curseur(gx, gy, energie = 1) { s.cible = 1; s.vu = true; s.x = s.cx = gx; s.y = s.cy = gy; s.energie = energie; s.presence = 1; },
    _clic(gx, gy) { s.onde = { x: gx, y: gy, t: performance.now() }; },
    detruire() {
      api.arreter();
      ro.disconnect();
      canvas.removeEventListener('webglcontextlost', perte);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    },
  };
  const perte = (e) => { e.preventDefault(); perdu = true; api.arreter(); };
  canvas.addEventListener('webglcontextlost', perte);
  const ro = new ResizeObserver(() => { if (!perdu && largeur) dessiner(temps); });
  ro.observe(canvas);
  return api;
}

  var canvas = document.querySelector('.ht-bg'); if (!canvas) return
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches
  var fond = creerHalftone(canvas, { interactif: !calm && matchMedia('(hover: hover) and (pointer: fine)').matches })
  if (!fond) return
  if (calm || !('IntersectionObserver' in window)) { fond.image(3); return }
  new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? fond.demarrer() : fond.arreter() }) }, { threshold: 0.05 }).observe(document.querySelector('#services'))
})()
