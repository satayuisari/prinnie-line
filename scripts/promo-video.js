// วิดีโอโปรโม Prinnie333 — motion graphics 9:16 (1080x1920) สำหรับ TikTok/Reels/Shorts
// ไปป์ไลน์: สร้าง SVG ต่อเฟรม → resvg เรนเดอร์ PNG → ffmpeg-static เข้ารหัส MP4
// รัน: node scripts/promo-video.js
const fs   = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const { execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');

const W = 1080, H = 1920, FPS = 30, DUR = 28;          // 28 วินาที
const TOTAL = DUR * FPS;
const OUT_DIR = path.join(__dirname, '..', 'video');
const FR_DIR  = path.join(OUT_DIR, 'frames');
const FONT    = 'C:/Windows/Fonts/LeelaUIb.ttf';

const GOLD = '#E7C66B', GOLD2 = '#F6E2A0', WHITE = '#F4EEFF', PINK = '#F2A9C4';

// ---------- helpers ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
// fade เข้า-ออกในช่วงฉาก (คืนค่า opacity 0..1)
function fade(local, dur, fin = 0.5, fout = 0.5) {
  if (local < 0 || local > dur) return 0;
  if (local < fin) return easeOut(local / fin);
  if (local > dur - fout) return easeOut((dur - local) / fout);
  return 1;
}
// seeded RNG (เฟรมคงที่)
function mkRand(seed) { let s = seed; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; }

// ดาวพื้นหลัง + ผงทอง (คงที่ทั้งคลิป)
const rnd = mkRand(7);
const STARS = Array.from({ length: 110 }, () => ({ x: rnd() * W, y: rnd() * H, r: 0.6 + rnd() * 1.8, ph: rnd(), sp: 0.4 + rnd() * 0.8 }));
const DUST  = Array.from({ length: 36 }, () => ({ x: rnd() * W, y: rnd() * H, r: 1.2 + rnd() * 2.6, sp: 12 + rnd() * 30, sw: 8 + rnd() * 26, ph: rnd() * 6.28 }));

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function text(x, y, str, size, fill, op = 1, anchor = 'middle', ls = 0) {
  return `<text x="${x}" y="${y}" font-family="Leelawadee UI" font-size="${size}" fill="${fill}" fill-opacity="${op}" text-anchor="${anchor}"${ls ? ` letter-spacing="${ls}"` : ''}>${esc(str)}</text>`;
}

// ---------- ไอคอนเวกเตอร์ (เลี่ยง emoji ที่ resvg เรนเดอร์ไม่ได้) ----------
function sun(cx, cy, r, op = 1) {
  let rays = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    rays += `<line x1="${cx + Math.cos(a) * r * 1.35}" y1="${cy + Math.sin(a) * r * 1.35}" x2="${cx + Math.cos(a) * r * 1.75}" y2="${cy + Math.sin(a) * r * 1.75}" stroke="${GOLD}" stroke-width="3" stroke-opacity="${op}" stroke-linecap="round"/>`;
  }
  return `${rays}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${GOLD2}" fill-opacity="${op}"/>`;
}
function moon(cx, cy, r, op = 1) {
  return `<path d="M ${cx + r * 0.35} ${cy - r} A ${r} ${r} 0 1 0 ${cx + r * 0.35} ${cy + r} A ${r * 0.8} ${r * 0.8} 0 1 1 ${cx + r * 0.35} ${cy - r} Z" fill="${GOLD2}" fill-opacity="${op}"/>`;
}
function chevron(cx, cy, r, op = 1) { // ลัคนา = ลูกศรขึ้น
  return `<path d="M ${cx} ${cy - r} L ${cx + r} ${cy + r * 0.5} M ${cx} ${cy - r} L ${cx - r} ${cy + r * 0.5}" stroke="${GOLD}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke-opacity="${op}"/>`;
}
function heart(cx, cy, s, fill, op = 1) {
  return `<path transform="translate(${cx},${cy}) scale(${s})" d="M0,3 C-3,-2 -9,-1 -9,4 C-9,8 -4,11 0,14 C4,11 9,8 9,4 C9,-1 3,-2 0,3 Z" fill="${fill}" fill-opacity="${op}"/>`;
}
function star4(cx, cy, r, fill, op = 1) {
  return `<path d="M ${cx} ${cy - r} Q ${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy} Q ${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r} Q ${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy} Q ${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r} Z" fill="${fill}" fill-opacity="${op}"/>`;
}
function orb(cx, cy, r, op, inner) {
  return `<circle cx="${cx}" cy="${cy}" r="${r * 1.5}" fill="url(#glow)" opacity="${0.6 * op}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#2A1B3D" fill-opacity="${op}" stroke="${GOLD}" stroke-opacity="${op}" stroke-width="2"/>${inner}`;
}

// ---------- พื้นหลัง ----------
function background(t) {
  let s = `<rect width="${W}" height="${H}" fill="url(#bg)"/><ellipse cx="${W * 0.7}" cy="${H * 0.28}" rx="520" ry="520" fill="url(#neb1)"/><ellipse cx="${W * 0.25}" cy="${H * 0.72}" rx="600" ry="600" fill="url(#neb2)"/>`;
  for (const st of STARS) {
    const tw = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * st.sp * 2 + st.ph * 6.28));
    s += `<circle cx="${st.x.toFixed(1)}" cy="${st.y.toFixed(1)}" r="${st.r.toFixed(2)}" fill="#FFFFFF" fill-opacity="${tw.toFixed(2)}"/>`;
  }
  for (const d of DUST) {
    const y = ((d.y - t * d.sp) % (H + 40) + (H + 40)) % (H + 40);
    const x = d.x + Math.sin(t * 0.6 + d.ph) * d.sw;
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${d.r.toFixed(2)}" fill="${GOLD}" fill-opacity="0.5"/>`;
  }
  return s;
}

// ---------- ฉากต่าง ๆ ----------
function scenes(t) {
  let s = '';
  // แบรนด์ด้านบน (โผล่หลัง 0.4s ค้างถึงจบ)
  s += `<g opacity="${fade(t, DUR, 0.6, 0.4).toFixed(3)}">${text(W / 2, 180, 'PRINNIE333', 40, GOLD, 0.9, 'middle', 14)}${star4(W / 2, 230, 7, GOLD, 0.8)}</g>`;

  // S1 0–4.5 Hook
  let o = fade(t - 0, 4.5); if (o > 0) {
    const k = easeOut(clamp((t) / 1.2)); const yy = lerp(40, 0, k);
    s += `<g opacity="${o.toFixed(3)}" transform="translate(0 ${yy.toFixed(1)})">`
      + sun(W / 2, 720, 70, o * 0.9)
      + text(W / 2, 980, 'ดวงของคุณ', 96, WHITE, 1)
      + text(W / 2, 1110, 'ไม่เหมือนใคร', 120, GOLD2, 1)
      + text(W / 2, 1230, 'คำนวณจากวัน เวลา และสถานที่เกิดจริง', 42, WHITE, 0.85)
      + text(W / 2, 1290, 'ไม่ใช่ดวง 12 ราศีทั่วไป', 42, WHITE, 0.7)
      + `</g>`;
  }

  // S2 4.5–9 พื้นดวงส่วนตัว (3 orb)
  o = fade(t - 4.5, 4.5); if (o > 0) {
    const cx = [W / 2 - 270, W / 2, W / 2 + 270], yy = 1000;
    const icons = [sun(cx[0], yy, 34, o), moon(cx[1], yy, 36, o), chevron(cx[2], yy, 30, o)];
    const labels = ['อาทิตย์', 'จันทร์', 'ลัคนา'];
    let g = text(W / 2, 720, 'พื้นดวงส่วนตัวของคุณ', 70, GOLD2, 1);
    for (let i = 0; i < 3; i++) {
      const pop = easeOut(clamp((t - 4.5 - i * 0.25) / 0.6));
      g += orb(cx[i], yy, 95, o * pop, icons[i]) + text(cx[i], yy + 175, labels[i], 44, WHITE, o);
    }
    g += text(W / 2, 1320, 'รู้จักตัวตนที่แท้จริง จากดวงกำเนิดของคุณ', 42, WHITE, o * 0.85);
    s += `<g opacity="${o.toFixed(3)}">${g}</g>`;
  }

  // S3 9–13.5 ดวงรายวัน (การ์ด)
  o = fade(t - 9, 4.5); if (o > 0) {
    const slide = lerp(60, 0, easeOut(clamp((t - 9) / 0.7)));
    const cardX = 140, cardY = 820 + slide, cardW = 800, cardH = 560;
    let g = text(W / 2, 640, 'ดวงรายวันส่วนตัว ส่งถึงคุณทุกเช้า', 56, GOLD2, 1);
    g += `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="36" fill="#1C1030" fill-opacity="${0.92 * o}" stroke="${GOLD}" stroke-opacity="${0.5 * o}" stroke-width="2"/>`;
    g += sun(cardX + 70, cardY + 90, 22, o) + text(cardX + 120, cardY + 105, 'พลังอาทิตย์ ตรีโกณ จันทร์', 38, GOLD2, o, 'start');
    g += text(cardX + 50, cardY + 165, 'วันนี้พลังใจดี เหมาะเริ่มสิ่งใหม่ ๆ', 34, WHITE, o * 0.9, 'start');
    g += `<line x1="${cardX + 50}" y1="${cardY + 215}" x2="${cardX + cardW - 50}" y2="${cardY + 215}" stroke="${GOLD}" stroke-opacity="${0.4 * o}" stroke-dasharray="6 8"/>`;
    g += moon(cardX + 72, cardY + 288, 24, o) + text(cardX + 120, cardY + 300, 'พลังจันทร์ ร่วม ศุกร์', 38, GOLD2, o, 'start');
    g += text(cardX + 50, cardY + 360, 'เสน่ห์เด่น มีโอกาสพบความรัก', 34, WHITE, o * 0.9, 'start');
    g += star4(cardX + 70, cardY + 460, 20, GOLD, o) + text(cardX + 120, cardY + 472, 'ไพ่ประจำวัน: The Star', 36, WHITE, o * 0.85, 'start');
    s += `<g opacity="${o.toFixed(3)}">${g}</g>`;
  }

  // S4 13.5–17.5 ไพ่ทาโรต์
  o = fade(t - 13.5, 4); if (o > 0) {
    const p = easeOut(clamp((t - 13.5) / 0.8));
    const sc = lerp(0.6, 1, p), rot = lerp(-12, 0, p);
    const cx = W / 2, cy = 1040, cw = 360, ch = 560;
    let g = text(W / 2, 660, 'ไพ่ทาโรต์ ไขคำตอบในใจ', 58, GOLD2, 1);
    g += `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${sc}) translate(${-cx} ${-cy})">`
      + `<rect x="${cx - cw / 2}" y="${cy - ch / 2}" width="${cw}" height="${ch}" rx="28" fill="#26133F" stroke="${GOLD}" stroke-width="4"/>`
      + `<rect x="${cx - cw / 2 + 18}" y="${cy - ch / 2 + 18}" width="${cw - 36}" height="${ch - 36}" rx="18" fill="none" stroke="${GOLD}" stroke-opacity="0.4"/>`
      + star4(cx, cy - 60, 70, GOLD2, 1) + sun(cx, cy + 110, 34, 0.9)
      + text(cx, cy + 235, 'THE STAR', 34, GOLD, 1, 'middle', 6)
      + `</g>`;
    s += `<g opacity="${o.toFixed(3)}">${g}</g>`;
  }

  // S5 17.5–22 ผูกดวงคู่
  o = fade(t - 17.5, 4.5); if (o > 0) {
    const p = easeInOut(clamp((t - 17.5) / 1.2));
    const gap = lerp(360, 150, p), cy = 1020;
    const lx = W / 2 - gap, rx = W / 2 + gap;
    let g = text(W / 2, 700, 'ผูกดวงคู่', 84, GOLD2, 1);
    g += orb(lx, cy, 90, o, sun(lx, cy, 32, o)) + orb(rx, cy, 90, o, moon(rx, cy, 34, o));
    const hp = easeOut(clamp((t - 18.8) / 0.6));
    g += heart(W / 2, cy - 14, 3.2 * hp, PINK, o);
    g += text(W / 2, 1320, 'ดูความเข้ากันจากดวงจริงของสองคน', 44, WHITE, o * 0.9);
    s += `<g opacity="${o.toFixed(3)}">${g}</g>`;
  }

  // S6 22–28 CTA
  o = fade(t - 22, 6, 0.6, 0.6); if (o > 0) {
    const p = easeOut(clamp((t - 22) / 0.8));
    let g = text(W / 2, 760, 'เริ่มรู้จักดวงของคุณ', 74, WHITE, 1);
    g += text(W / 2, 870, 'วันนี้ ฟรี!', 92, GOLD2, 1);
    // ปุ่ม pill
    const bw = 720, bx = W / 2 - bw / 2, by = 1000, bh = 130;
    const pulse = 1 + 0.02 * Math.sin((t - 22) * 4);
    g += `<g transform="translate(${W / 2} ${by + bh / 2}) scale(${(p * pulse).toFixed(3)}) translate(${-W / 2} ${-(by + bh / 2)})">`
      + `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="65" fill="${GOLD2}"/>`
      + text(W / 2, by + 85, 'รับพื้นดวงส่วนตัวฟรี', 52, '#2A1438', 1)
      + `</g>`;
    g += `<rect x="${W / 2 - 300}" y="1230" width="600" height="92" rx="20" fill="#1C1030" stroke="${GOLD}" stroke-width="2"/>`;
    g += text(W / 2, 1290, 'LINE  @prinnie333', 52, GOLD2, 1, 'middle', 2);
    g += text(W / 2, 1410, 'ดวงส่วนตัว • รายวัน • ไพ่ • ดวงคู่', 40, WHITE, 0.85);
    s += `<g opacity="${o.toFixed(3)}">${g}</g>`;
  }
  return s;
}

const DEFS = `<defs>
  <radialGradient id="bg" cx="50%" cy="38%" r="80%"><stop offset="0%" stop-color="#3A1E63"/><stop offset="55%" stop-color="#1A0E2E"/><stop offset="100%" stop-color="#0A0614"/></radialGradient>
  <radialGradient id="neb1" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#6B3FA0" stop-opacity="0.5"/><stop offset="100%" stop-color="#6B3FA0" stop-opacity="0"/></radialGradient>
  <radialGradient id="neb2" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#9C5BC2" stop-opacity="0.35"/><stop offset="100%" stop-color="#9C5BC2" stop-opacity="0"/></radialGradient>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${GOLD}" stop-opacity="0.7"/><stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/></radialGradient>
  <radialGradient id="vig" cx="50%" cy="50%" r="62%"><stop offset="60%" stop-color="#000000" stop-opacity="0"/><stop offset="100%" stop-color="#000000" stop-opacity="0.55"/></radialGradient>
</defs>`;

function frameSVG(t) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${DEFS}${background(t)}${scenes(t)}<rect width="${W}" height="${H}" fill="url(#vig)"/></svg>`;
}

// ---------- render ----------
(function main() {
  fs.rmSync(FR_DIR, { recursive: true, force: true });
  fs.mkdirSync(FR_DIR, { recursive: true });
  console.log(`เรนเดอร์ ${TOTAL} เฟรม (${W}x${H} @${FPS}fps)...`);
  const opts = { font: { loadSystemFonts: false, fontFiles: [FONT], defaultFontFamily: 'Leelawadee UI' } };
  const t0 = Date.now();
  for (let f = 0; f < TOTAL; f++) {
    const t = f / FPS;
    const png = new Resvg(frameSVG(t), opts).render().asPng();
    fs.writeFileSync(path.join(FR_DIR, `frame-${String(f + 1).padStart(5, '0')}.png`), png);
    if ((f + 1) % 60 === 0) console.log(`  ${f + 1}/${TOTAL}`);
  }
  console.log(`เรนเดอร์เฟรมเสร็จใน ${((Date.now() - t0) / 1000).toFixed(0)}s — เข้ารหัส MP4...`);
  const out = path.join(OUT_DIR, 'prinnie-promo-9x16.mp4');
  execFileSync(ffmpeg, [
    '-y', '-framerate', String(FPS), '-i', path.join(FR_DIR, 'frame-%05d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium',
    '-movflags', '+faststart', out,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log('✅ วิดีโอเสร็จ:', out);

  // โปสเตอร์ (ภาพนิ่งสำหรับโพสต์/ปก) จากเฟรม hook + CTA
  const sharp = require('sharp');
  const poster = async (frame, name) => {
    await sharp(path.join(FR_DIR, `frame-${String(frame).padStart(5, '0')}.png`))
      .jpeg({ quality: 90 }).toFile(path.join(OUT_DIR, name));
    console.log('🖼️  โปสเตอร์:', name);
  };
  Promise.all([poster(70, 'poster-hook.jpg'), poster(790, 'poster-cta.jpg')]);
})();
