// Illustrations des 4 étapes du parcours client : compositions à plat, traits fins, couleurs de l'agence
// (bleu électrique, bleu nuit, violet en accent, gris très clairs). Dessins fixes : aucune donnée n'y entre.
const B = '#0055ff', N = '#0b1430', V = '#6d4bff', C = '#e8eefc', G = '#c9d3ea', W = '#ffffff';

const fenetre = (x, y, w, hgt) => `
  <rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="12" fill="${W}" stroke="${G}" stroke-width="1.5"/>
  <path d="M${x} ${y + 22}h${w}" stroke="${G}" stroke-width="1.5"/>
  <circle cx="${x + 13}" cy="${y + 11}" r="3" fill="${G}"/><circle cx="${x + 23}" cy="${y + 11}" r="3" fill="${G}"/><circle cx="${x + 33}" cy="${y + 11}" r="3" fill="${G}"/>`;

const DESSINS = {
  // 1. Découverte : le brief, la loupe, la conversation
  1: `
  <circle cx="168" cy="118" r="92" fill="${C}"/>
  <circle cx="168" cy="118" r="92" fill="none" stroke="${G}" stroke-dasharray="3 7"/>
  <g class="il-flotte">
    <rect x="86" y="46" width="132" height="160" rx="14" fill="${W}" stroke="${G}" stroke-width="1.5"/>
    <rect x="104" y="66" width="56" height="8" rx="4" fill="${N}"/>
    <rect x="104" y="84" width="92" height="6" rx="3" fill="${G}"/>
    ${[108, 132, 156, 180].map((y, i) => `<rect x="104" y="${y}" width="14" height="14" rx="4" fill="${i < 3 ? B : W}" stroke="${i < 3 ? B : G}" stroke-width="1.5"/>${i < 3 ? `<path d="M107.5 ${y + 7.5}l3 3 5-6" stroke="${W}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ''}<rect x="126" y="${y + 4}" width="${[70, 56, 64, 48][i]}" height="6" rx="3" fill="${G}"/>`).join('')}
  </g>
  <g class="il-flotte il-d2">
    <circle cx="214" cy="138" r="34" fill="${W}" fill-opacity=".55" stroke="${N}" stroke-width="7"/>
    <path d="M238 162l26 26" stroke="${N}" stroke-width="11" stroke-linecap="round"/>
    <circle cx="204" cy="128" r="8" fill="${W}" fill-opacity=".9"/>
  </g>
  <g class="il-flotte il-d3">
    <path d="M232 38h52a10 10 0 0 1 10 10v26a10 10 0 0 1-10 10h-30l-12 12v-12h-10a10 10 0 0 1-10-10V48a10 10 0 0 1 10-10z" fill="${V}"/>
    <circle cx="246" cy="61" r="3.5" fill="${W}"/><circle cx="258" cy="61" r="3.5" fill="${W}"/><circle cx="270" cy="61" r="3.5" fill="${W}"/>
  </g>`,

  // 2. Conception : la maquette qui se dessine, la palette, le crayon
  2: `
  <circle cx="160" cy="120" r="92" fill="${C}"/>
  <g class="il-flotte">
    ${fenetre(62, 42, 196, 150)}
    <rect x="78" y="78" width="98" height="12" rx="6" fill="${N}"/>
    <rect x="78" y="98" width="70" height="7" rx="3.5" fill="${G}"/>
    <rect x="78" y="114" width="46" height="16" rx="8" fill="${B}"/>
    <rect x="190" y="74" width="54" height="58" rx="10" fill="${C}" stroke="${B}" stroke-width="1.5" stroke-dasharray="4 4"/>
    <path d="M204 118l10-14 8 9 6-6 10 11" stroke="${B}" stroke-width="2" fill="none" stroke-linejoin="round"/>
    ${[78, 136, 194].map((x) => `<rect x="${x}" y="146" width="50" height="34" rx="8" fill="${W}" stroke="${G}" stroke-width="1.5"/><rect x="${x + 8}" y="156" width="26" height="5" rx="2.5" fill="${G}"/><rect x="${x + 8}" y="166" width="34" height="5" rx="2.5" fill="${C}"/>`).join('')}
  </g>
  <g class="il-flotte il-d2">
    <rect x="236" y="30" width="62" height="24" rx="12" fill="${W}" stroke="${G}" stroke-width="1.5"/>
    <circle cx="250" cy="42" r="6" fill="${B}"/><circle cx="266" cy="42" r="6" fill="${V}"/><circle cx="282" cy="42" r="6" fill="${N}"/>
  </g>
  <g class="il-flotte il-d3" transform="rotate(38 270 170)">
    <rect x="262" y="128" width="16" height="72" rx="4" fill="${V}"/>
    <path d="M262 200h16l-8 16z" fill="${N}"/>
    <rect x="262" y="128" width="16" height="12" rx="4" fill="${N}"/>
  </g>`,

  // 3. Lancement : le site qui part en ligne, les tests validés
  3: `
  <circle cx="160" cy="124" r="92" fill="${C}"/>
  <path d="M56 196c40-6 70-30 96-62s60-56 104-62" stroke="${B}" stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round" fill="none"/>
  <g class="il-flotte">
    ${fenetre(70, 70, 168, 124)}
    <rect x="86" y="106" width="84" height="10" rx="5" fill="${N}"/>
    <rect x="86" y="124" width="120" height="6" rx="3" fill="${G}"/>
    <rect x="86" y="146" width="136" height="10" rx="5" fill="${C}"/>
    <rect x="86" y="146" width="104" height="10" rx="5" fill="${B}" class="il-charge"/>
    <rect x="86" y="166" width="40" height="14" rx="7" fill="${N}"/>
  </g>
  <g class="il-flotte il-d2">
    <circle cx="246" cy="66" r="26" fill="${B}"/>
    <path d="M234 66l8 8 15-17" stroke="${W}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <g class="il-flotte il-d3">
    <rect x="34" y="96" width="62" height="24" rx="12" fill="${W}" stroke="${G}" stroke-width="1.5"/>
    <circle cx="48" cy="108" r="5" fill="${V}"/><rect x="58" y="105" width="28" height="6" rx="3" fill="${G}"/>
  </g>`,

  // 4. Suivi : les visites qui montent, la sécurité, le rapport
  4: `
  <circle cx="160" cy="120" r="92" fill="${C}"/>
  <g class="il-flotte">
    <rect x="58" y="52" width="190" height="136" rx="14" fill="${W}" stroke="${G}" stroke-width="1.5"/>
    <rect x="76" y="70" width="60" height="8" rx="4" fill="${N}"/>
    <rect x="76" y="84" width="38" height="6" rx="3" fill="${G}"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${84 + i * 24}" y="${168 - [22, 30, 26, 44, 52, 66][i]}" width="12" height="${[22, 30, 26, 44, 52, 66][i]}" rx="4" fill="${i === 5 ? B : C}"/>`).join('')}
    <path d="M80 150l28-12 24 6 24-22 24 4 34-30" stroke="${V}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="214" cy="96" r="5" fill="${W}" stroke="${V}" stroke-width="3"/>
  </g>
  <g class="il-flotte il-d2">
    <path d="M262 92l30 11v22c0 20-13 34-30 40-17-6-30-20-30-40v-22z" fill="${N}"/>
    <path d="M250 124l9 9 16-18" stroke="${W}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <g class="il-flotte il-d3">
    <rect x="30" y="34" width="70" height="26" rx="13" fill="${B}"/>
    <path d="M44 51l6-6 5 4 8-9" stroke="${W}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="70" y="44" width="20" height="6" rx="3" fill="${W}" fill-opacity=".7"/>
  </g>`,
};

export function illustrationEtape(n) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 320 230');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'il-etape');
  svg.innerHTML = DESSINS[n] || DESSINS[1];
  return svg;
}
