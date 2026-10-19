// 原创插画（全部以 SVG 绘制）：角色、道具、场景。风格参考老师提供的设计图：明亮卡通冒险风。
let uid = 0;
const id = (p) => `${p}${++uid}`;
const INK = '#3a2418';

export const MASCOT_NAME = '阿算';

// ---------------------------------------------------------------- 角色
/** 向导“阿算”：白蓝色的小精灵 */
export function mascot(mood = 'happy', size = 120) {
  const g = id('mg');
  const mouth = mood === 'sad' ? '<path d="M86 132q14-10 28 0" stroke="#2b3a67" stroke-width="4" fill="none" stroke-linecap="round"/>'
    : mood === 'wow' ? '<ellipse cx="100" cy="132" rx="9" ry="11" fill="#2b3a67"/><ellipse cx="100" cy="137" rx="5" ry="4" fill="#ff7b9c"/>'
      : '<path d="M84 126q16 18 32 0z" fill="#2b3a67"/><path d="M90 133q10 7 20 0" fill="#ff7b9c"/>';
  return `<svg class="mascot ${mood}" width="${size}" height="${size * 1.1}" viewBox="0 0 200 220" role="img" aria-label="向导阿算">
    <defs><radialGradient id="${g}" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d8ecff"/></radialGradient></defs>
    <ellipse cx="100" cy="212" rx="50" ry="7" fill="rgba(0,0,0,.16)"/>
    <path d="M150 168q34-10 30-44q-6 18-26 22" fill="url(#${g})" stroke="#2b3a67" stroke-width="4" stroke-linejoin="round"/>
    <path d="M150 150q20-4 26-26" stroke="#5aa8f0" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M62 150q-6 50 38 58q44-8 38-58z" fill="url(#${g})" stroke="#2b3a67" stroke-width="4"/>
    <path d="M76 176q24 10 48 0" stroke="#bcd8f5" stroke-width="4" fill="none"/>
    <path d="M60 160q-20 4-18 22M140 160q18 2 18 18" stroke="#2b3a67" stroke-width="4" fill="#fff" stroke-linecap="round"/>
    <path d="M44 74L30 14l46 34zM156 74l14-60-46 34z" fill="url(#${g})" stroke="#2b3a67" stroke-width="4" stroke-linejoin="round"/>
    <path d="M40 58L34 28l22 18zM160 58l6-30-22 18z" fill="#5aa8f0"/>
    <path d="M40 100c0-44 28-62 60-62s60 18 60 62c0 34-26 56-60 56s-60-22-60-56z" fill="url(#${g})" stroke="#2b3a67" stroke-width="4"/>
    <path d="M86 40q14-22 34-12q-10 2-12 14q16-6 26 8q-24-6-48-10z" fill="#5aa8f0" stroke="#2b3a67" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="78" cy="98" rx="15" ry="18" fill="#2b3a67"/><ellipse cx="122" cy="98" rx="15" ry="18" fill="#2b3a67"/>
    <ellipse cx="78" cy="103" rx="10" ry="12" fill="#3f8ee8"/><ellipse cx="122" cy="103" rx="10" ry="12" fill="#3f8ee8"/>
    <circle cx="73" cy="92" r="5" fill="#fff"/><circle cx="117" cy="92" r="5" fill="#fff"/><circle cx="82" cy="108" r="2.4" fill="#fff"/><circle cx="126" cy="108" r="2.4" fill="#fff"/>
    <ellipse cx="60" cy="122" rx="9" ry="6" fill="#ffb3c4" opacity=".75"/><ellipse cx="140" cy="122" rx="9" ry="6" fill="#ffb3c4" opacity=".75"/>
    ${mouth}
    <path d="M86 156q14 8 28 0l-4 12q-10 5-20 0z" fill="#ff8a1e" stroke="#2b3a67" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="100" cy="163" r="4" fill="#ffd23f" stroke="#2b3a67" stroke-width="2"/>
  </svg>`;
}

function kid({ girl = false, pose = 'stand' } = {}, size = 120) {
  const s = id('sk');
  const hair = girl ? '#5a3220' : '#6b3a1c';
  const top = girl ? '#ff7eb3' : '#f6f2e6';
  const accent = girl ? '#b86bd8' : '#d63a2f';
  const armL = pose === 'cheer' ? 'M64 136q-26-26-20-54' : pose === 'point' ? 'M64 136q-30 0-44-14' : 'M64 136q-18 26-12 52';
  const armR = pose === 'cheer' ? 'M136 136q26-26 20-54' : 'M136 136q18 26 12 52';
  const handL = pose === 'cheer' ? [44, 80] : pose === 'point' ? [20, 120] : [52, 190];
  const handR = pose === 'cheer' ? [156, 80] : [148, 190];
  return `<svg class="kid ${girl ? 'girl' : 'boy'}" width="${size}" height="${size * 1.32}" viewBox="0 0 200 264" role="img" aria-label="${girl ? '小冒险家（女生）' : '小冒险家（男生）'}">
    <defs><linearGradient id="${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe2c4"/><stop offset="1" stop-color="#f6c79e"/></linearGradient></defs>
    <ellipse cx="100" cy="256" rx="58" ry="7" fill="rgba(0,0,0,.18)"/>
    ${girl ? '' : `<path d="M60 124q-24 70-10 116h100q14-46-10-116z" fill="${accent}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M60 124q-10 60-2 112" stroke="#a82b22" stroke-width="5" fill="none"/>`}
    <rect x="126" y="128" width="44" height="66" rx="14" fill="${girl ? '#9b6bd6' : '#a8632a'}" stroke="${INK}" stroke-width="4"/>
    <rect x="132" y="150" width="32" height="18" rx="5" fill="${girl ? '#c49af0' : '#c98848'}" stroke="${INK}" stroke-width="3"/>
    <rect x="76" y="198" width="20" height="40" rx="8" fill="${girl ? '#ffd9e9' : '#3d5ba8'}" stroke="${INK}" stroke-width="4"/>
    <rect x="104" y="198" width="20" height="40" rx="8" fill="${girl ? '#ffd9e9' : '#3d5ba8'}" stroke="${INK}" stroke-width="4"/>
    <path d="M70 236q12-8 28 0v10H68zM102 236q16-8 28 0l2 10h-30z" fill="${girl ? '#e0457b' : '#6b3f1c'}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    ${girl ? `<path d="M64 132q36-14 72 0l14 74q-50 14-100 0z" fill="${top}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M58 196q42 14 84 0" stroke="#fff" stroke-width="5" fill="none"/>`
    : `<path d="M64 132q36-14 72 0l4 70H60z" fill="${top}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
       <path d="M64 132l20-6 4 76H60zM136 132l-20-6-4 76h28z" fill="#3c8a4e" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
       <rect x="60" y="186" width="80" height="10" rx="3" fill="#6b3f1c"/><rect x="94" y="185" width="12" height="12" rx="2" fill="#ffd23f" stroke="${INK}" stroke-width="2"/>`}
    <path d="${armL}" stroke="${INK}" stroke-width="18" fill="none" stroke-linecap="round"/><path d="${armL}" stroke="${girl ? top : '#3c8a4e'}" stroke-width="11" fill="none" stroke-linecap="round"/>
    <path d="${armR}" stroke="${INK}" stroke-width="18" fill="none" stroke-linecap="round"/><path d="${armR}" stroke="${girl ? top : '#3c8a4e'}" stroke-width="11" fill="none" stroke-linecap="round"/>
    <circle cx="${handL[0]}" cy="${handL[1]}" r="10" fill="url(#${s})" stroke="${INK}" stroke-width="3.5"/><circle cx="${handR[0]}" cy="${handR[1]}" r="10" fill="url(#${s})" stroke="${INK}" stroke-width="3.5"/>
    ${girl ? `<path d="M144 54q34 6 30 56q-6 26-22 30q8-30-14-50z" fill="${hair}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><circle cx="146" cy="56" r="9" fill="#ff7eb3" stroke="${INK}" stroke-width="3"/>` : ''}
    <ellipse cx="100" cy="84" rx="52" ry="50" fill="url(#${s})" stroke="${INK}" stroke-width="4"/>
    ${girl ? `<path d="M46 92q-4-62 54-62t54 62q-14-22-34-30q-6 12-26 16q10-10 8-18q-20 10-56 32z" fill="${hair}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`
    : `<path d="M44 90q-8-30 6-48l-6-16 22 8q6-22 26-24l2 16q14-22 38-16l-10 14q24-6 34 10l-16 4q18 12 16 40q-12-18-30-22l4 14q-16-14-36-14l2 14q-14-12-30-8q2 12-4 24q-8-10-18 4z" fill="${hair}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`}
    <ellipse cx="80" cy="96" rx="9" ry="11" fill="#3b2314"/><ellipse cx="120" cy="96" rx="9" ry="11" fill="#3b2314"/>
    <circle cx="77" cy="92" r="3.6" fill="#fff"/><circle cx="117" cy="92" r="3.6" fill="#fff"/>
    <ellipse cx="66" cy="112" rx="8" ry="5" fill="#ff9a9a" opacity=".55"/><ellipse cx="134" cy="112" rx="8" ry="5" fill="#ff9a9a" opacity=".55"/>
    <path d="M86 114q14 14 28 0z" fill="#8a2b2b" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M92 120q8 4 16 0" fill="#ff7b7b"/>
  </svg>`;
}
export const explorer = (size = 90, pose = 'stand') => kid({ pose }, size * 0.8);
export const explorerGirl = (size = 90, pose = 'stand') => kid({ girl: true, pose }, size * 0.8);

/** 老师（教学模式） */
export function teacherArt(size = 140) {
  return `<svg width="${size}" height="${size * 1.3}" viewBox="0 0 200 260" role="img" aria-label="老师">
    <ellipse cx="100" cy="252" rx="56" ry="7" fill="rgba(0,0,0,.15)"/>
    <path d="M58 132q42-16 84 0l14 112H44z" fill="#ffffff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M60 196q40 14 80 0l10 48H50z" fill="#2f3b63" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M86 128l14 18 14-18" fill="#e0457b" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="30" y="150" width="56" height="40" rx="5" fill="#c0392b" stroke="${INK}" stroke-width="4" transform="rotate(-12 58 170)"/>
    <path d="M150 140l40-40" stroke="#a8632a" stroke-width="6" stroke-linecap="round"/><circle cx="148" cy="142" r="10" fill="#ffd9b8" stroke="${INK}" stroke-width="3"/>
    <path d="M42 70q0-54 58-54t58 54v70q-20-30-20-60q-36 12-76 0q0 30-20 60z" fill="#4a2a1a" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <ellipse cx="100" cy="84" rx="44" ry="46" fill="#ffe2c4" stroke="${INK}" stroke-width="4"/>
    <path d="M56 70q30-34 88 0q-30-10-44 4q-14-14-44-4z" fill="#4a2a1a"/>
    <circle cx="82" cy="90" r="13" fill="none" stroke="${INK}" stroke-width="3.5"/><circle cx="118" cy="90" r="13" fill="none" stroke="${INK}" stroke-width="3.5"/><path d="M95 90h10" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="82" cy="91" r="4.5" fill="#3b2314"/><circle cx="118" cy="91" r="4.5" fill="#3b2314"/>
    <path d="M88 112q12 10 24 0" stroke="#8a2b2b" stroke-width="4" fill="none" stroke-linecap="round"/>
  </svg>`;
}

/** 混乱魔王 */
export function boss(state = 'idle', size = 220) {
  const g = id('bg'), w = id('bw');
  const eyes = state === 'hurt' ? '<path d="M72 98l20 12M92 98l-20 12M128 98l20 12M148 98l-20 12" stroke="#ffe14d" stroke-width="6" stroke-linecap="round"/>'
    : '<path d="M66 96l30 10-4 10-26-8z" fill="#ffe14d" stroke="#1d1238" stroke-width="3"/><path d="M154 96l-30 10 4 10 26-8z" fill="#ffe14d" stroke="#1d1238" stroke-width="3"/><circle cx="86" cy="106" r="3.4" fill="#c0102a"/><circle cx="134" cy="106" r="3.4" fill="#c0102a"/>';
  return `<svg class="boss ${state}" width="${size}" height="${size}" viewBox="0 0 220 220" role="img" aria-label="混乱魔王">
    <defs><radialGradient id="${g}" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#7b4ad6"/><stop offset="1" stop-color="#3a1d6e"/></radialGradient>
      <linearGradient id="${w}" x1="0" x2="1"><stop offset="0" stop-color="#2a1550"/><stop offset="1" stop-color="#5a32ad"/></linearGradient></defs>
    <ellipse cx="110" cy="210" rx="78" ry="9" fill="rgba(0,0,0,.35)"/>
    <path d="M58 104L6 52l18 70-16 4 40 20zM162 104l52-52-18 70 16 4-40 20z" fill="url(#${w})" stroke="#1d1238" stroke-width="5" stroke-linejoin="round"/>
    <path d="M70 60L52 6l36 40zM150 60l18-54-36 40z" fill="#f2e2c4" stroke="#1d1238" stroke-width="5" stroke-linejoin="round"/>
    <path d="M36 140c0-62 32-96 74-96s74 34 74 96c0 44-30 66-74 66s-74-22-74-66z" fill="url(#${g})" stroke="#1d1238" stroke-width="6"/>
    <path d="M70 150c0-20 18-28 40-28s40 8 40 28-16 44-40 44-40-24-40-44z" fill="#a47de8" opacity=".55"/>
    ${eyes}
    <path d="M78 140q32 26 64 0l-6 18q-26 14-52 0z" fill="#1d1238"/>
    <path d="M86 142l5 12 6-10 7 12 6-12 7 12 6-10 5 10" fill="#fff" stroke="#fff" stroke-width="1"/>
    <path d="M54 186l-12 18h24zM166 186l12 18h-24z" fill="#3a1d6e" stroke="#1d1238" stroke-width="4" stroke-linejoin="round"/>
    <text x="110" y="182" text-anchor="middle" font-size="22" font-weight="900" fill="#ffb13b" opacity=".9">÷ × ?</text>
  </svg>`;
}

// ---------------------------------------------------------------- 道具
export function chest(open = false, size = 90) {
  const g = id('cg');
  return `<svg class="chest ${open ? 'open' : ''}" width="${size}" height="${size}" viewBox="0 0 120 110" role="img" aria-label="${open ? '打开的宝箱' : '宝箱'}">
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e09a4a"/><stop offset="1" stop-color="#a5601f"/></linearGradient></defs>
    <ellipse cx="60" cy="104" rx="46" ry="5" fill="rgba(0,0,0,.2)"/>
    ${open ? `<path d="M18 50L30 14h60l12 36z" fill="url(#${g})" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <g><circle cx="44" cy="46" r="9" fill="#ffd23f" stroke="#c98a00" stroke-width="2"/><circle cx="62" cy="40" r="9" fill="#ffe680" stroke="#c98a00" stroke-width="2"/><circle cx="78" cy="48" r="8" fill="#ffd23f" stroke="#c98a00" stroke-width="2"/>
      <path d="M58 22l4-12 4 12 12 4-12 4-4 12-4-12-12-4z" fill="#fff8c4"/></g>`
    : `<path d="M14 56q0-38 46-38t46 38z" fill="url(#${g})" stroke="${INK}" stroke-width="4"/><path d="M14 46h92" stroke="#ffcf3f" stroke-width="7"/>`}
    <rect x="14" y="52" width="92" height="48" rx="7" fill="url(#${g})" stroke="${INK}" stroke-width="4"/>
    <path d="M14 68h92" stroke="#ffcf3f" stroke-width="7"/><path d="M34 52v48M86 52v48" stroke="#8a4a14" stroke-width="3" opacity=".6"/>
    <rect x="51" y="60" width="18" height="20" rx="4" fill="#ffcf3f" stroke="${INK}" stroke-width="3"/><circle cx="60" cy="69" r="3" fill="${INK}"/>
  </svg>`;
}

export function door(open = false, num = '') {
  const g = id('dg');
  return `<svg class="door ${open ? 'open' : ''}" viewBox="0 0 90 120" width="84" height="112" role="img" aria-label="${open ? '打开的门' : '锁着的门'}">
    <defs><linearGradient id="${g}" x1="0" x2="1"><stop offset="0" stop-color="#9a6a3e"/><stop offset="1" stop-color="#6e4422"/></linearGradient></defs>
    <path d="M4 118V44Q4 4 45 4t41 40v74z" fill="#8c8aa6" stroke="#2b2140" stroke-width="4"/>
    <path d="M4 44Q4 4 45 4t41 40" fill="none" stroke="#b9b7cf" stroke-width="6" stroke-dasharray="14 6"/>
    ${open ? '<path d="M14 116V46q0-30 31-30t31 30v70z" fill="#140c22"/><path d="M14 116V46q0-30 12-30v100z" fill="#8a5a30"/><path d="M45 116l-8-40 8-16 8 16z" fill="#ffd36b" opacity=".25"/>'
    : `<path d="M14 116V46q0-30 31-30t31 30v70z" fill="url(#${g})" stroke="#2b2140" stroke-width="3"/>
       <path d="M30 22v94M45 16v100M60 22v94" stroke="#5a3418" stroke-width="2.5" opacity=".7"/><path d="M14 56h62M14 92h62" stroke="#4a4a5a" stroke-width="6"/>
       <circle cx="45" cy="74" r="11" fill="#ffd23f" stroke="#2b2140" stroke-width="3"/><path d="M45 72v8" stroke="#2b2140" stroke-width="3"/>
       <text x="45" y="44" text-anchor="middle" font-size="17" font-weight="900" fill="#fff4d6">${num}</text>`}
  </svg>`;
}

export const KEY = `<svg viewBox="0 0 70 34" width="70" height="34" aria-hidden="true"><circle cx="15" cy="17" r="10" fill="none" stroke="#c98a00" stroke-width="9"/><circle cx="15" cy="17" r="10" fill="none" stroke="#ffd23f" stroke-width="5"/><path d="M25 17h40M54 17v10M63 17v8" stroke="#c98a00" stroke-width="8" stroke-linecap="round"/><path d="M25 17h40M54 17v10M63 17v8" stroke="#ffd23f" stroke-width="4" stroke-linecap="round"/></svg>`;

export function stars(n, max = 3, size = 22) {
  let s = '';
  for (let i = 0; i < max; i++) {
    const g = id('sg');
    s += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff07a"/><stop offset="1" stop-color="#ffb300"/></linearGradient></defs>
      <path d="M12 1.6l3.2 6.6 7.2 1-5.2 5 1.3 7.2L12 18l-6.5 3.4 1.3-7.2-5.2-5 7.2-1z" fill="${i < n ? `url(#${g})` : '#5b4a3a'}" stroke="${i < n ? '#b86b00' : '#3a2e24'}" stroke-width="1.4" stroke-linejoin="round"/>
      ${i < n ? '<path d="M8 8.5l2.5-.4" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>' : ''}</svg>`;
  }
  return `<span class="stars" aria-label="${n} 颗星">${s}</span>`;
}

export function heart(full = true, size = 26) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-5.3-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.7-8 11-8 11z" fill="${full ? '#ff3b5c' : '#5b4a52'}" stroke="#7a1022" stroke-width="1.6"/><path d="M7 8.5q1-2 3-2" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="${full ? 0.8 : 0}"/></svg>`;
}

export function coin(size = 24) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffc93c" stroke="#b86b00" stroke-width="1.8"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#e8a000" stroke-width="1.4"/><path d="M12 7.5l1.4 2.9 3.1.4-2.3 2.1.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.1 3.1-.4z" fill="#fff3b0"/></svg>`;
}

/** “数学王者”金奖牌 */
export function medal(label = '数学王者', size = 150) {
  const g = id('md');
  return `<svg width="${size}" height="${size * 1.1}" viewBox="0 0 160 176" role="img" aria-label="${label}奖牌">
    <defs><radialGradient id="${g}" cx="40%" cy="35%"><stop offset="0" stop-color="#fff3a0"/><stop offset=".6" stop-color="#ffc93c"/><stop offset="1" stop-color="#d98f00"/></radialGradient></defs>
    <path d="M44 6h30l-6 50zM116 6H86l6 50z" fill="#e0453b" stroke="#7a1a12" stroke-width="3"/>
    <circle cx="80" cy="84" r="52" fill="url(#${g})" stroke="#9a5a00" stroke-width="5"/>
    <circle cx="80" cy="84" r="38" fill="none" stroke="#fff6c4" stroke-width="3" stroke-dasharray="5 5"/>
    <path d="M58 92l-6-30 16 12 12-20 12 20 16-12-6 30z" fill="#fff6c4" stroke="#9a5a00" stroke-width="3" stroke-linejoin="round"/>
    <rect x="22" y="128" width="116" height="32" rx="8" fill="#e0453b" stroke="#7a1a12" stroke-width="3"/>
    <text x="80" y="151" text-anchor="middle" font-size="19" font-weight="900" fill="#fff">${label}</text>
  </svg>`;
}

const BADGE_COLORS = { starter: '#2ba3d8', trainee: '#5cc24a', solo: '#ff8a1e', maze: '#8a6fb3', boss: '#c0392b', king: '#ffc93c', persist: '#e0457b', treasure: '#c9853b', perfect: '#1f9d55' };
const BADGE_ICON = { starter: '⛵', trainee: '✎', solo: '★', maze: '⌘', boss: '⚔', king: '♛', persist: '♥', treasure: '◆', perfect: '✔' };
export function badge(key, name, earned = true) {
  const c = earned ? BADGE_COLORS[key] || '#2ba3d8' : '#bdb4a2';
  const g = id('bd');
  return `<div class="badge ${earned ? '' : 'locked'}" title="${name}">
    <svg viewBox="0 0 64 70" width="56" height="62" aria-hidden="true"><defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <path d="M32 3l26 10v20c0 16-11 27-26 32C17 60 6 49 6 33V13z" fill="${c}" stroke="#3a2418" stroke-width="3"/>
    <path d="M32 3l26 10v20c0 16-11 27-26 32C17 60 6 49 6 33V13z" fill="url(#${g})"/>
    <text x="32" y="42" text-anchor="middle" font-size="22" fill="#fff">${BADGE_ICON[key] || '★'}</text></svg><span>${name}</span></div>`;
}

// ---------------------------------------------------------------- 场景
function cloud(x, y, s = 1, o = 0.95) {
  return `<g transform="translate(${x} ${y}) scale(${s})" opacity="${o}"><ellipse cx="0" cy="0" rx="60" ry="22" fill="#fff"/><circle cx="-24" cy="-14" r="24" fill="#fff"/><circle cx="12" cy="-22" r="30" fill="#fff"/><circle cx="40" cy="-8" r="20" fill="#fff"/></g>`;
}
function tree(x, y, s = 1, c = '#3f9b3a') {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-5" y="-6" width="10" height="26" rx="3" fill="#7a4a22"/><circle cx="0" cy="-26" r="24" fill="${c}"/><circle cx="-14" cy="-14" r="16" fill="${c}"/><circle cx="14" cy="-14" r="16" fill="${c}"/><circle cx="-6" cy="-34" r="9" fill="#fff" opacity=".18"/></g>`;
}
function palm(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0q4-30 -2-56" stroke="#8a5a2a" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M-2-56q-26-4-34 12q16-12 34-12zM-2-56q26-6 36 10q-18-10-36-10zM-2-56q-10-20-28-20q18 6 28 20zM-2-56q12-22 30-20q-18 4-30 20z" fill="#3fa34a" stroke="#256b2d" stroke-width="2"/></g>`;
}
function castleTower(x, y, h, roof, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-14" y="${-h}" width="28" height="${h}" fill="#f1ece4" stroke="#7a6a5a" stroke-width="2.5"/>
    <path d="M-20 ${-h}L0 ${-h - 46}L20 ${-h}z" fill="${roof}" stroke="#5a3a4a" stroke-width="2.5"/><path d="M0 ${-h - 46}v-14" stroke="#5a3a4a" stroke-width="2"/><path d="M0 ${-h - 60}l14 5-14 5z" fill="#e0453b"/>
    <rect x="-5" y="${-h + 14}" width="10" height="14" rx="5" fill="#4a3f6b"/></g>`;
}

/** 首页背景：天空、山、城堡、草地 */
export function homeScene() {
  const sky = id('sky'), hill = id('hl');
  return `<svg class="scene" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="${sky}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ccfff"/><stop offset=".7" stop-color="#d9f3ff"/></linearGradient>
      <linearGradient id="${hill}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd65a"/><stop offset="1" stop-color="#3f9b3a"/></linearGradient></defs>
    <rect width="1600" height="900" fill="url(#${sky})"/>
    <circle cx="1380" cy="120" r="70" fill="#fff6c4" opacity=".9"/>
    ${cloud(220, 130, 1.3)}${cloud(760, 90, 1)}${cloud(1180, 220, 1.1, .9)}${cloud(1500, 330, .8, .8)}
    <path d="M0 520L180 300l120 140 160-220 200 260 140-120 220 160L1600 330v570H0z" fill="#b9a6e0" opacity=".55"/>
    <path d="M0 600L240 400l150 120 220-200 180 220 200-140 260 200 350-150v450H0z" fill="#8fc7e6" opacity=".7"/>
    <g transform="translate(1180 560)">
      <path d="M-260 60q120-140 260-140t260 140z" fill="#6cc04a"/>
      <rect x="-150" y="-110" width="300" height="110" fill="#efe7da" stroke="#7a6a5a" stroke-width="3"/>
      <path d="M-150-110h300v-14h-300z" fill="#d8cfc0"/>
      ${[-150, -118, -86, -54, -22, 10, 42, 74, 106].map(x => `<rect x="${x}" y="-136" width="20" height="16" fill="#efe7da" stroke="#7a6a5a" stroke-width="2"/>`).join('')}
      <path d="M-26 0v-60q26-30 52 0v60z" fill="#6b4a2a" stroke="#4a2f1a" stroke-width="3"/>
      ${castleTower(-170, 0, 190, '#e05a8a', 1)}${castleTower(170, 0, 210, '#4a7ae0', 1)}${castleTower(-70, -110, 120, '#9a5ad8', .9)}${castleTower(70, -110, 150, '#e05a8a', .9)}${castleTower(0, -110, 210, '#4a7ae0', 1.05)}
    </g>
    <path d="M0 720q200-120 440-60t480 40 420-90 260 40v250H0z" fill="url(#${hill})"/>
    <path d="M0 790q260-80 520-30t560 20 520-40v160H0z" fill="#4fae3f"/>
    <path d="M700 900q40-120 160-170q60-24 120-20q-80 30-110 80t-30 110z" fill="#e8d29a" opacity=".85"/>
    ${tree(120, 740, 1.4)}${tree(210, 770, 1.1, '#4aa83f')}${tree(1500, 760, 1.5)}${tree(1420, 790, 1.1, '#4aa83f')}${tree(960, 700, .9, '#5ab84a')}${tree(420, 700, .8, '#5ab84a')}
    ${[[300, 840], [560, 860], [1100, 850], [1300, 870]].map(([x, y]) => `<g transform="translate(${x} ${y})"><circle r="7" fill="#ff7eb3"/><circle r="3" fill="#ffd23f"/></g>`).join('')}
  </svg>`;
}

/** 冒险地图：六座主题岛与木桥（文字、编号与星星由程序另外叠加） */
export const ISLANDS = [
  { x: 190, y: 330, name: '数学启航站' },
  { x: 470, y: 250, name: '解题训练营' },
  { x: 760, y: 250, name: '独立挑战区' },
  { x: 1040, y: 260, name: '数学迷宫' },
  { x: 1000, y: 560, name: '终极 Boss 挑战' },
  { x: 620, y: 570, name: '数学王者认证' },
];
function islandBase(x, y, rx, ry, top, side) {
  return `<g transform="translate(${x} ${y})">
    <ellipse cx="0" cy="${ry * 0.9}" rx="${rx * 1.15}" ry="${ry * 0.55}" fill="#bff0ff" opacity=".55"/>
    <path d="M${-rx} 0q0 ${ry * 1.1} ${rx} ${ry * 1.15}q${rx} -${ry * 0.05} ${rx} -${ry * 1.15}z" fill="${side}" stroke="#5a3a20" stroke-width="3"/>
    <path d="M${-rx} 0q${rx * 0.1} -${ry * 0.95} ${rx} -${ry}q${rx * 0.9} ${ry * 0.05} ${rx} ${ry}q-${rx * 0.1} ${ry * 0.7} -${rx} ${ry * 0.72}q-${rx * 0.9} -${ry * 0.02} -${rx} -${ry * 0.72}z" fill="${top}" stroke="#2f6b2a" stroke-width="3"/>
    <path d="M${-rx * 0.7} ${-ry * 0.2}q${rx * 0.7} -${ry * 0.55} ${rx * 1.4} 0" stroke="#fff" stroke-width="4" fill="none" opacity=".25"/>
  </g>`;
}
function bridge(x1, y1, x2, y2) {
  const n = Math.max(4, Math.round(Math.hypot(x2 - x1, y2 - y1) / 22));
  let planks = '';
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t + Math.sin(t * Math.PI) * 18;
    const ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI + 90;
    planks += `<rect x="${x - 13}" y="${y - 4}" width="26" height="9" rx="2" fill="#c98848" stroke="#6b3f1c" stroke-width="2" transform="rotate(${ang} ${x} ${y})"/>`;
  }
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + 18;
  return `<g class="bridge"><path d="M${x1} ${y1 - 12}Q${mx} ${my - 12} ${x2} ${y2 - 12}" stroke="#6b3f1c" stroke-width="3" fill="none"/><path d="M${x1} ${y1 + 12}Q${mx} ${my + 12} ${x2} ${y2 + 12}" stroke="#6b3f1c" stroke-width="3" fill="none"/>${planks}</g>`;
}
export function mapScene(skip = []) {
  const sea = id('sea'), wv = id('wv'), lava = id('lv'), gold = id('gd');
  const I = ISLANDS;
  return `<defs>
      <radialGradient id="${sea}" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#5fd0f5"/><stop offset="1" stop-color="#1f86c7"/></radialGradient>
      <pattern id="${wv}" width="80" height="34" patternUnits="userSpaceOnUse"><path d="M0 17q20-12 40 0t40 0" stroke="rgba(255,255,255,.35)" stroke-width="3" fill="none"/></pattern>
      <radialGradient id="${lava}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffcf3f"/><stop offset=".5" stop-color="#ff6a1e"/><stop offset="1" stop-color="#c0221a" stop-opacity="0"/></radialGradient>
      <linearGradient id="${gold}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff07a"/><stop offset="1" stop-color="#e8a000"/></linearGradient>
    </defs>
    <rect width="1240" height="760" fill="url(#${sea})"/>
    <rect class="wave" x="-80" width="1400" height="760" fill="url(#${wv})"/>
    ${cloud(140, 70, .7, .85)}${cloud(1120, 120, .6, .8)}
    ${bridge(I[0].x + 90, I[0].y - 10, I[1].x - 90, I[1].y + 10)}${bridge(I[1].x + 95, I[1].y, I[2].x - 95, I[2].y)}${bridge(I[2].x + 95, I[2].y, I[3].x - 95, I[3].y)}
    ${bridge(I[3].x - 10, I[3].y + 76, I[4].x + 10, I[4].y - 76)}${bridge(I[4].x - 120, I[4].y, I[5].x + 120, I[5].y)}
    ${skip.includes(0) ? '' : `<!-- 1 启航站：绿岛、灯塔、帆船 -->
    ${islandBase(I[0].x, I[0].y, 110, 60, '#6fcf4a', '#b07a45')}
    <g transform="translate(${I[0].x} ${I[0].y})">${palm(-70, -10, 1)}${palm(74, -4, .9)}
      <rect x="-14" y="-96" width="28" height="80" fill="#fff" stroke="#5a3a20" stroke-width="3"/><path d="M-14-76h28M-14-50h28" stroke="#e0453b" stroke-width="10"/>
      <path d="M-20-96h40l-6-14h-28z" fill="#e0453b" stroke="#5a3a20" stroke-width="3"/><circle cx="0" cy="-118" r="9" fill="#ffd23f" stroke="#5a3a20" stroke-width="3"/>
      <g transform="translate(-150 70)"><path d="M-30 0h60l-10 16h-40z" fill="#a5601f" stroke="#5a3a20" stroke-width="3"/><path d="M0 0v-52M0-50l26 40H0z" fill="#fff" stroke="#5a3a20" stroke-width="3"/></g></g>
    `}${skip.includes(1) ? '' : `<!-- 2 训练营：沙地、帐篷、旗帜 -->
    ${islandBase(I[1].x, I[1].y, 115, 62, '#f2c46a', '#b07a45')}
    <g transform="translate(${I[1].x} ${I[1].y})">${tree(-80, -6, .8)}
      <path d="M-60-8l34-56 34 56z" fill="#ff8a1e" stroke="#5a3a20" stroke-width="3"/><path d="M-26-64v56" stroke="#5a3a20" stroke-width="2"/><path d="M-36-8l10-24 10 24z" fill="#7a3a0a"/>
      <path d="M10-8l30-48 30 48z" fill="#e0453b" stroke="#5a3a20" stroke-width="3"/><path d="M30-8l10-20 10 20z" fill="#7a1a12"/>
      <path d="M86-10v-80" stroke="#5a3a20" stroke-width="4"/><path d="M86-90l34 12-34 12z" fill="#5cc24a" stroke="#2f6b2a" stroke-width="2"/>
      ${[-96, -76, -56, 60, 80].map(x => `<path d="M${x} 20v-18" stroke="#8a5a2a" stroke-width="5"/>`).join('')}<path d="M-100 10h60M54 10h40" stroke="#8a5a2a" stroke-width="4"/></g>
    `}${skip.includes(2) ? '' : `<!-- 3 独立挑战区：蓝色塔楼与冰晶 -->
    ${islandBase(I[2].x, I[2].y, 112, 62, '#8fd6ff', '#7a8fb0')}
    <g transform="translate(${I[2].x} ${I[2].y})">
      ${castleTower(-36, -6, 70, '#2b7ae0', .9)}${castleTower(36, -6, 86, '#2b7ae0', .9)}${castleTower(0, -6, 110, '#1f5fc0', 1)}
      <path d="M-96 6l12-40 12 40zM78 10l10-34 10 34z" fill="#c9f0ff" stroke="#3a7ab0" stroke-width="2.5"/></g>
    `}${skip.includes(3) ? '' : `<!-- 4 数学迷宫：紫色城堡 -->
    ${islandBase(I[3].x, I[3].y, 112, 62, '#b48ae8', '#6e5a8a')}
    <g transform="translate(${I[3].x} ${I[3].y})">
      <rect x="-60" y="-70" width="120" height="62" fill="#6e4aa8" stroke="#2b1a4a" stroke-width="3"/>
      ${[-60, -36, -12, 12, 36].map(x => `<rect x="${x}" y="-82" width="16" height="12" fill="#6e4aa8" stroke="#2b1a4a" stroke-width="2"/>`).join('')}
      <path d="M-14-8v-34q14-18 28 0v34z" fill="#1d1238"/>
      <path d="M-74-8v-84l14-20 14 20v84z" fill="#5a3a90" stroke="#2b1a4a" stroke-width="3"/><path d="M46-8v-96l14-22 14 22v96z" fill="#5a3a90" stroke="#2b1a4a" stroke-width="3"/>
      <circle cx="-60" cy="-80" r="5" fill="#ffd23f"/><circle cx="60" cy="-86" r="5" fill="#ffd23f"/>${tree(-96, 10, .6, '#5a9a4a')}</g>
    `}${skip.includes(4) ? '' : `<!-- 5 终极 Boss：火山与熔岩 -->
    <circle cx="${I[4].x}" cy="${I[4].y - 40}" r="140" fill="url(#${lava})" opacity=".55"/>
    ${islandBase(I[4].x, I[4].y, 125, 66, '#6a4a4a', '#4a2f2f')}
    <g transform="translate(${I[4].x} ${I[4].y})">
      <path d="M-92 4l60-120h64l60 120z" fill="#4a2f2f" stroke="#1d1010" stroke-width="3"/><path d="M-32-116h64l-8 18h-48z" fill="#ff6a1e"/>
      <path d="M-14-112q-6 40 -30 70q20-10 30-30q8 34 -8 70q24-30 22-70q8 26 22 34q-14-30-6-74z" fill="#ff8a1e" stroke="#c0221a" stroke-width="2"/>
      <path d="M-20-130q-10-24 10-34q-6 16 10 20q-4-22 16-28q-6 22 6 40" fill="#5a5050" opacity=".7"/>
      <path d="M50 10q20-6 40 4" stroke="#ff6a1e" stroke-width="6" fill="none" stroke-linecap="round"/></g>
    `}${skip.includes(5) ? '' : `<!-- 6 王者认证：金色城堡 -->
    ${islandBase(I[5].x, I[5].y, 120, 64, '#ffe27a', '#c99a3a')}
    <g transform="translate(${I[5].x} ${I[5].y})">
      <rect x="-64" y="-72" width="128" height="64" fill="url(#${gold})" stroke="#8a5a00" stroke-width="3"/>
      ${castleTower(-70, -8, 96, '#e0453b', .85)}${castleTower(70, -8, 96, '#e0453b', .85)}${castleTower(0, -60, 70, '#ffb300', 1)}
      <path d="M-16-8v-30q16-16 32 0v30z" fill="#8a5a00"/>
      <path d="M-30-170l12-24 12 14 12-20 12 20 12-14 12 24z" fill="#ffd23f" stroke="#8a5a00" stroke-width="3" transform="translate(0 30)"/></g>
    `}<g transform="translate(330 660)"><path d="M-40 0h80l-14 18h-52z" fill="#a5601f" stroke="#5a3a20" stroke-width="3"/><path d="M0 0v-46M0-44l-26 36H0z" fill="#fff" stroke="#5a3a20" stroke-width="3"/></g>
    <g transform="translate(1160 640)">${palm(0, 0, .9)}<ellipse cx="0" cy="6" rx="40" ry="12" fill="#f2d79a" stroke="#b07a45" stroke-width="2"/></g>`;
}

/** 迷宫洞穴背景 */
export function mazeScene() {
  const bg = id('mz'), glow = id('mg');
  const torch = (x, y) => `<g transform="translate(${x} ${y})"><rect x="-4" y="0" width="8" height="34" fill="#6b4a2b"/><circle cx="0" cy="-6" r="26" fill="url(#${glow})"/><path d="M0-20q12 12 0 22q-12-10 0-22z" fill="#ffcf3f"/><path d="M0-12q6 6 0 12q-6-6 0-12z" fill="#fff6c4"/></g>`;
  let bricks = '';
  for (let r = 0; r < 9; r++) for (let c = 0; c < 18; c++) bricks += `<rect x="${c * 70 + (r % 2) * 35 - 35}" y="${r * 44}" width="66" height="40" rx="6" fill="${(r + c) % 3 ? '#4a3a70' : '#55447e'}"/>`;
  return `<svg class="scene" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="${bg}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1f48"/><stop offset="1" stop-color="#3d2e63"/></linearGradient>
      <radialGradient id="${glow}"><stop offset="0" stop-color="#ffcf3f" stop-opacity=".7"/><stop offset="1" stop-color="#ff8a1e" stop-opacity="0"/></radialGradient></defs>
    <rect width="1200" height="420" fill="url(#${bg})"/><g opacity=".7">${bricks}</g>
    <rect y="300" width="1200" height="120" fill="#2a2140"/><path d="M0 300h1200" stroke="#6e5a9a" stroke-width="6"/>
    ${[90, 330, 570, 810, 1050].map(x => torch(x, 120)).join('')}
    <path d="M40 300l20-50 16 30 14-40 18 60z M1110 300l16-44 14 26 14-36 18 54z" fill="#b48ae8" opacity=".8"/>
  </svg>`;
}

/** 熔岩场景（Boss） */
export function bossScene() {
  const sky = id('bs'), lv = id('bl');
  let embers = '';
  for (let i = 0; i < 26; i++) embers += `<circle class="ember" cx="${(i * 97) % 1200}" cy="${(i * 53) % 380}" r="${2 + (i % 3)}" fill="#ffb13b" opacity=".7" style="animation-delay:${(i % 7) * 0.4}s"/>`;
  return `<svg class="scene" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="${sky}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1020"/><stop offset=".6" stop-color="#7a1f1f"/><stop offset="1" stop-color="#d9481e"/></linearGradient>
      <linearGradient id="${lv}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffcf3f"/><stop offset="1" stop-color="#ff4a1e"/></linearGradient></defs>
    <rect width="1200" height="420" fill="url(#${sky})"/>
    <path d="M0 300L150 170l80 60 120-130 140 160 160-110 150 120 170-150 230 230v150H0z" fill="#2a1414"/>
    <path d="M760 140l70-110h70l60 120z" fill="#3a1a1a"/><path d="M830 30h70l-12 26h-46z" fill="#ff6a1e"/>
    <path d="M0 330q300-30 600 0t600-10v100H0z" fill="url(#${lv})"/>
    <path d="M0 360q200-20 420 6t480-10 300 4v60H0z" fill="#3a1414"/>
    <path d="M120 350l40-30 50 24 40-20 60 30" stroke="#ffcf3f" stroke-width="5" fill="none" opacity=".7"/>
    ${embers}
  </svg>`;
}

/** 森林庆祝场景（结算） */
export function forestScene() {
  const sky = id('fs');
  return `<svg class="scene" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="${sky}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9be0ff"/><stop offset="1" stop-color="#e8fbff"/></linearGradient></defs>
    <rect width="1200" height="700" fill="url(#${sky})"/>
    <g opacity=".9">${[60, 180, 1040, 1150].map((x, i) => tree(x, 420, 3.2 - i % 2 * .6, i % 2 ? '#4aa83f' : '#3a8f35')).join('')}</g>
    <path d="M0 560q300-80 600-20t600-30v190H0z" fill="#5cc24a"/><path d="M0 620q300-40 600 0t600-10v90H0z" fill="#4aa83f"/>
    ${[[160, 600], [420, 640], [800, 630], [1040, 600]].map(([x, y]) => `<g transform="translate(${x} ${y})"><circle r="8" fill="#ffd23f"/><circle r="4" fill="#ff7eb3"/></g>`).join('')}
    <g transform="translate(150 140)"><path d="M0 0v300" stroke="#8a5a2a" stroke-width="8"/><path d="M4 0q60 10 110 -6q-20 30 0 60q-50 16-110 6z" fill="#e0453b" stroke="#7a1a12" stroke-width="3"/></g>
    <g transform="translate(1050 140) scale(-1 1)"><path d="M0 0v300" stroke="#8a5a2a" stroke-width="8"/><path d="M4 0q60 10 110 -6q-20 30 0 60q-50 16-110 6z" fill="#e0453b" stroke="#7a1a12" stroke-width="3"/></g>
  </svg>`;
}

/** 关卡选择画面里的小图标（加减 / 乘除） */
export function topicIcon(kind) {
  return kind === 'U1-7-1'
    ? `<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#ffe08a" stroke="#c98a00" stroke-width="2"/><path d="M12 20h16M20 12v16" stroke="#e0453b" stroke-width="4" stroke-linecap="round"/></svg>`
    : `<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#bfe3ff" stroke="#2b7ae0" stroke-width="2"/><path d="M13 13l14 14M27 13L13 27" stroke="#2b7ae0" stroke-width="4" stroke-linecap="round"/></svg>`;
}
