'use client';

import { useEffect, useRef, useState } from 'react';
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

/** Draws a 1200x675 card: the stitched datacenter as the background, run stats on top. */
function drawCard(s: GameState, shot: HTMLCanvasElement, font: string, ui: string) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const L = LOCS[s.loc];
  g.fillStyle = L.cloth;
  g.fillRect(0, 0, W, H);
  // the scene, scaled to cover the card, kept crisp
  g.imageSmoothingEnabled = false;
  const k = Math.max(W / shot.width, H / shot.height);
  const sw = shot.width * k, sh = shot.height * k;
  g.drawImage(shot, (W - sw) / 2, (H - sh) / 2 - 40, sw, sh);

  const l = ledger(s);
  const r = s.phase === 'over' ? s.tally.best : rating(s).total;
  const years = Math.max(1, Math.floor(s.month / 12) + 1);
  const stats: [string, string][] = [
    ['Year', String(years)],
    [s.phase === 'over' ? 'Best rating' : 'Rating', `${r}/100`],
    ['Profit', s.phase === 'over' ? money(s.tally.profit) : `${money(l.net)}/mo`],
    ['Floors', String(s.floors.length)],
    ['Halls', String(hallCount(s))],
    ['Techs', String(s.workers.length)],
    ['Trust', String(Math.round(s.trust))],
  ];

  // a dark panel along the bottom, like the game's top bar
  const px = 32, ph = 150, py = H - ph - 28;
  g.fillStyle = 'rgba(5,5,5,.92)';
  g.beginPath();
  g.roundRect(px, py, W - px * 2, ph, 28);
  g.fill();
  g.fillStyle = '#fff';
  g.font = `28px ${font}`;
  g.textBaseline = 'top';
  g.fillText(siteName(s).toUpperCase(), px + 28, py + 24);
  g.fillStyle = 'rgba(255,255,255,.6)';
  g.font = `18px ${ui}`;
  const status = s.phase === 'over' ? (s.over?.reason === 'town' ? 'Shut down by the town' : 'Bankrupt') : 'Still running';
  g.fillText(`${ownerName(s)} · ${L.name} · ${status}`, px + 28, py + 62);
  const cw = (W - px * 2 - 56) / stats.length;
  stats.forEach(([label, value], i) => {
    const x = px + 28 + i * cw;
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.font = `15px ${ui}`;
    g.fillText(label, x, py + 98);
    g.fillStyle = label.includes('Profit') && l.net < 0 && s.phase !== 'over' ? '#FF8A80' : '#fff';
    g.font = `22px ${ui}`;
    g.fillText(value, x, py + 116);
  });
  g.fillStyle = 'rgba(31,42,68,.55)';
  g.font = `14px ${font}`;
  g.textAlign = 'right';
  g.fillText('TINY DATACENTER SIMULATOR', W - px, 24);
  return c;
}

export function Share({ s, capture, font, ui, onClose }: {
  s: GameState; capture: () => HTMLCanvasElement | null; font: string; ui: string; onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const blob = useRef<Blob | null>(null);
  const text = shareText(s);

  useEffect(() => {
    let gone = false;
    Promise.all([document.fonts.load(`28px ${font}`), document.fonts.load(`22px ${ui}`)]).finally(() => {
      const shot = capture();
      if (!shot || gone) return;
      drawCard(s, shot, font, ui).toBlob(b => {
        if (!b || gone) return;
        blob.current = b;
        setUrl(URL.createObjectURL(b));
      }, 'image/png');
    });
    return () => { gone = true; };
    // one card per opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const file = `${siteName(s).replace(/[^\w]+/g, '-').toLowerCase() || 'datacenter'}.png`;
  const save = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = file; a.click();
  };
  const post = async () => {
    // phones can share the picture straight to the X app
    const f = blob.current && new File([blob.current], file, { type: 'image/png' });
    if (f && navigator.canShare?.({ files: [f] })) {
      try { await navigator.share({ files: [f], text }); return; } catch { /* cancelled */ }
    }
    save();
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  return (
    <div className="share-back" role="dialog" aria-label="Share your datacenter" onClick={onClose}>
      <div className="share" onClick={e => e.stopPropagation()}>
        <div className="share-img">
          {url
            // a local blob, so next/image has nothing to optimize
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={url} alt="Your datacenter with its stats" />
            : <span>Stitching your card…</span>}
        </div>
        <p className="share-text">{text}</p>
        <p className="muted small">On a computer the image downloads, then X opens. Attach the image to your post.</p>
        <div className="share-foot">
          <button className="back" onClick={onClose}>Close</button>
          <button className="back" disabled={!url} onClick={save}>Save image</button>
          <button className="go" disabled={!url} onClick={post}>Post on X</button>
        </div>
      </div>
    </div>
  );
}
