'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { LOCS } from '@/lib/game/data';
import { rating } from '@/lib/game/events';
import { hallCount, ledger, money, ownerName, siteName, type GameState } from '@/lib/game/state';

const W = 1200, H = 675;

/** Text for the post. */
export function shareText(s: GameState) {
  const years = Math.max(1, Math.floor(s.month / 12) + 1);
  const where = LOCS[s.loc].short;
  const r = s.phase === 'over' ? s.tally.best : rating(s).total;
  const end = s.phase === 'over' ? (s.over?.reason === 'town' ? ' until the town tore it down' : ' until it went bankrupt') : '';
  return `I ran ${siteName(s)} in ${where} for ${years} ${years === 1 ? 'year' : 'years'}${end}. ` +
    `Rating ${r}/100, ${s.floors.length} floors, ${s.workers.length} techs. #tinydatacenter`;
}

const grade = (r: number) => (r >= 85 ? 'S' : r >= 70 ? 'A' : r >= 55 ? 'B' : r >= 40 ? 'C' : 'D');
const gradeColor = (r: number) => (r >= 70 ? '#30D158' : r >= 40 ? '#FFD60A' : '#FF453A');

/** Draws a 1200x675 card onto `c`: the stitched datacenter as the background, run stats on top. */
function drawCard(c: HTMLCanvasElement, s: GameState, shot: HTMLCanvasElement | null, font: string, ui: string) {
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const L = LOCS[s.loc];
  const over = s.phase === 'over';
  const l = ledger(s);
  const r = over ? s.tally.best : rating(s).total;
  const years = Math.max(1, Math.floor(s.month / 12) + 1);

  // the scene, scaled to cover the card and nudged right so the stats have room
  g.fillStyle = L.cloth;
  g.fillRect(0, 0, W, H);
  g.imageSmoothingEnabled = false;
  if (shot) {
    const k = Math.max(W / shot.width, H / shot.height) * 1.05;
    const sw = shot.width * k, sh = shot.height * k;
    g.drawImage(shot, (W - sw) / 2 + 230, (H - sh) / 2 - 30, sw, sh);
  }

  // dark wash from the left and bottom
  const side = g.createLinearGradient(0, 0, W * 0.6, 0);
  side.addColorStop(0, 'rgba(8,10,18,.94)');
  side.addColorStop(0.5, 'rgba(8,10,18,.72)');
  side.addColorStop(1, 'rgba(8,10,18,0)');
  g.fillStyle = side;
  g.fillRect(0, 0, W, H);
  const foot = g.createLinearGradient(0, H - 220, 0, H);
  foot.addColorStop(0, 'rgba(8,10,18,0)');
  foot.addColorStop(1, 'rgba(8,10,18,.9)');
  g.fillStyle = foot;
  g.fillRect(0, H - 220, W, 220);

  // scanlines
  g.fillStyle = 'rgba(0,0,0,.06)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);

  const X = 64;
  g.textBaseline = 'alphabetic';

  // badge
  g.font = `16px ${font}`;
  const badge = 'TINY DATACENTER SIMULATOR';
  const bw = g.measureText(badge).width + 28;
  g.fillStyle = L.deco;
  g.beginPath(); g.roundRect(X, 52, bw, 34, 8); g.fill();
  g.fillStyle = '#fff';
  g.fillText(badge, X + 14, 75);

  // name, fit to width
  const name = siteName(s).toUpperCase();
  let size = 64;
  g.font = `${size}px ${font}`;
  while (g.measureText(name).width > 620 && size > 30) { size -= 2; g.font = `${size}px ${font}`; }
  g.fillStyle = 'rgba(0,0,0,.6)';
  g.fillText(name, X + 4, 170 + 4);
  g.fillStyle = '#fff';
  g.fillText(name, X, 170);
  g.font = `22px ${ui}`;
  g.fillStyle = 'rgba(255,255,255,.72)';
  g.fillText(`${ownerName(s)} · ${L.name} · year ${years}`, X, 210);

  // big rating
  g.font = `15px ${font}`;
  g.fillStyle = 'rgba(255,255,255,.6)';
  g.fillText(over ? 'Best rating' : 'Rating', X, 280);
  g.font = `150px ${font}`;
  g.fillStyle = 'rgba(0,0,0,.6)';
  g.fillText(String(r), X + 6, 410 + 6);
  g.fillStyle = gradeColor(r);
  g.fillText(String(r), X, 410);
  const rw = g.measureText(String(r)).width;
  g.font = `28px ${font}`;
  g.fillStyle = 'rgba(255,255,255,.6)';
  g.fillText('/100', X + rw + 12, 410);
  // grade chip
  g.font = `40px ${font}`;
  g.fillStyle = gradeColor(r);
  g.beginPath(); g.roundRect(X + rw + 12, 300, 64, 64, 12); g.fill();
  g.fillStyle = '#0A0C14';
  g.textAlign = 'center';
  g.fillText(grade(r), X + rw + 44, 348);
  g.textAlign = 'left';
  // pixel meter
  for (let i = 0; i < 20; i++) {
    g.fillStyle = i < Math.round(r / 5) ? gradeColor(r) : 'rgba(255,255,255,.15)';
    g.fillRect(X + i * 22, 432, 18, 10);
  }

  // stat tiles along the bottom
  const stats: [string, string, string?][] = [
    ['Profit', over ? money(s.tally.profit) : `${money(l.net)}/mo`, (over ? s.tally.profit : l.net) < 0 ? '#FF8A80' : '#fff'],
    ['Floors', String(s.floors.length)],
    ['Halls', String(hallCount(s))],
    ['Techs', String(s.workers.length)],
    ['Trust', String(Math.round(s.trust))],
  ];
  const tw = 168, th = 92, gap = 14, ty = H - th - 52;
  stats.forEach(([label, value, color], i) => {
    const x = X + i * (tw + gap);
    g.fillStyle = 'rgba(255,255,255,.08)';
    g.beginPath(); g.roundRect(x, ty, tw, th, 14); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.14)';
    g.lineWidth = 2;
    g.stroke();
    g.font = `13px ${font}`;
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.fillText(label, x + 18, ty + 32);
    let vs = 32;
    g.font = `${vs}px ${font}`;
    while (g.measureText(value).width > tw - 36 && vs > 16) { vs -= 2; g.font = `${vs}px ${font}`; }
    g.fillStyle = color ?? '#fff';
    g.fillText(value, x + 18, ty + 72);
  });

  // a stamp when the run is over
  if (over) {
    const word = s.over?.reason === 'town' ? 'SHUT DOWN' : 'BANKRUPT';
    g.save();
    g.translate(W - 230, 150);
    g.rotate(-0.16);
    g.font = `46px ${font}`;
    const sw = g.measureText(word).width + 44;
    g.strokeStyle = '#FF453A';
    g.lineWidth = 6;
    g.strokeRect(-sw / 2, -40, sw, 80);
    g.fillStyle = '#FF453A';
    g.textAlign = 'center';
    g.fillText(word, 0, 16);
    g.restore();
  }
}

/** Touch devices get the native share sheet; computers copy the image and open X. */
const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export function Share({ s, capture, font, ui, onClose }: {
  s: GameState; capture: () => HTMLCanvasElement | null; font: string; ui: string; onClose: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const blob = useRef<Blob | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const text = shareText(s);
  const file = `${siteName(s).replace(/[^\w]+/g, '-').toLowerCase() || 'datacenter'}.png`;

  // draw before the first paint so the card is there the moment it opens; fonts are already loaded by the game
  useLayoutEffect(() => {
    const c = canvas.current;
    if (!c) return;
    drawCard(c, s, capture(), font, ui);
    c.toBlob(b => { blob.current = b; setReady(true); }, 'image/png');
    // one card per opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [onClose]);

  const copy = () => {
    const b = blob.current;
    if (!b || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return Promise.resolve(false);
    return navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).then(() => true, () => false);
  };
  const save = () => {
    const b = blob.current;
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = file; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setStatus('Image saved');
  };
  const post = () => {
    const b = blob.current;
    if (b && isTouch()) {
      const f = new File([b], file, { type: 'image/png' });
      if (navigator.canShare?.({ files: [f] })) { navigator.share({ files: [f], text }).catch(() => {}); return; }
    }
    // copy first while this tab still has focus, then open X right away
    const copied = copy();
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    copied.then(ok => { if (ok) setStatus('Image copied. Paste it into your post.'); else save(); });
  };
  const copyOnly = () => copy().then(ok => setStatus(ok ? 'Image copied' : 'Copy not supported here. Try Save.'));

  return (
    <div className="share-back sharing" role="dialog" aria-label="Share your datacenter" onClick={onClose}>
      <div className="share card-pop" onClick={e => e.stopPropagation()}>
        <div className="share-img"><canvas ref={canvas} aria-label="Your datacenter with its stats" /></div>
        <p className="share-text">{text}</p>
        <div className="share-foot">
          <span className="share-status" aria-live="polite">{status}</span>
          <button className="back" onClick={onClose}>Close</button>
          <button className="back" disabled={!ready} onClick={save}>Save</button>
          <button className="back" disabled={!ready} onClick={copyOnly}>Copy</button>
          <button className="go" disabled={!ready} onClick={post}>Post on X</button>
        </div>
      </div>
    </div>
  );
}
