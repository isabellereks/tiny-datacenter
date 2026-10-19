import { ImageResponse } from 'next/og';
import { LOCS } from '@/lib/game/data';
import { money } from '@/lib/game/state';
import { decodeRun } from '@/lib/shareLink';

/** The link preview for a shared run: the tower in its own threads, and the stats. */

const W = 1200, H = 630;
const grade = (r: number) => (r >= 85 ? 'S' : r >= 70 ? 'A' : r >= 55 ? 'B' : r >= 40 ? 'C' : 'D');
const gradeColor = (r: number) => (r >= 70 ? '#30D158' : r >= 40 ? '#FFD60A' : '#FF453A');

/** A Google font as TTF, which the image renderer can read. Falls back to its built-in font if offline. */
async function font(family: string, text: string) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const run = decodeRun(new URL(req.url).searchParams);
  const L = LOCS[run.loc];
  const line = `#${run.outline}`;
  const tallest = Math.max(...run.towers.map(t => t.length), 1);
  const fh = Math.max(6, Math.min(40, Math.floor(430 / tallest)));
  const tw = run.towers.length > 1 ? 130 : 180;
  const stats: [string, string, string?][] = [
    ['Profit', run.end ? money(run.profit) : `${money(run.profit)}/mo`, run.profit < 0 ? '#FF8A80' : undefined],
    ['Floors', String(run.floors)],
    ['Techs', String(run.techs)],
    ['Years', String(run.years)],
  ];

  const all = [run.name, run.owner, L.name, ...stats.flat(), 'TINY DATACENTER SIMULATOR', 'best rating', 'BANKRUPT SHUT DOWN', grade(run.rating), String(run.rating)].join(' ');
  const [pixel, body] = await Promise.all([font('Pixelify+Sans:wght@700', all), font('Nunito:wght@600', all)]);
  const fonts = [
    ...(pixel ? [{ name: 'Pixel', data: pixel, weight: 700 as const }] : []),
    ...(body ? [{ name: 'Body', data: body, weight: 600 as const }] : []),
  ];

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', background: L.cloth, fontFamily: 'Pixel, sans-serif' }}>
        {/* the stats */}
        <div style={{ width: 640, height: H, display: 'flex', flexDirection: 'column', padding: '56px 0 48px 64px', background: '#0A0C14', color: '#fff' }}>
          <div style={{ display: 'flex' }}>
            <div style={{ display: 'flex', background: L.deco, color: '#fff', fontSize: 18, fontWeight: 700, padding: '6px 14px', borderRadius: 8, letterSpacing: 2 }}>
              TINY DATACENTER SIMULATOR
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: run.name.length > 18 ? 48 : 60, fontWeight: 800, marginTop: 28, lineHeight: 1.05 }}>{run.name}</div>
          <div style={{ display: 'flex', fontSize: 24, color: 'rgba(255,255,255,.65)', marginTop: 10, fontFamily: 'Body' }}>
            {[run.owner, L.name].filter(Boolean).join(' · ')}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 34 }}>
            <div style={{ display: 'flex', fontSize: 150, fontWeight: 900, color: gradeColor(run.rating), lineHeight: 0.9 }}>{run.rating}</div>
            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 16, marginBottom: 6 }}>
              <div style={{ display: 'flex', width: 60, height: 60, borderRadius: 12, background: gradeColor(run.rating), color: '#0A0C14', fontSize: 40, fontWeight: 900, alignItems: 'center', justifyContent: 'center' }}>
                {grade(run.rating)}
              </div>
              <div style={{ display: 'flex', fontSize: 24, color: 'rgba(255,255,255,.6)', marginTop: 8 }}>{run.end ? 'best rating' : 'rating'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', marginTop: 'auto' }}>
            {stats.map(([k, v, c]) => (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', width: 130, marginRight: 12, padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,.08)' }}>
                <div style={{ display: 'flex', fontSize: 16, color: 'rgba(255,255,255,.55)', fontFamily: 'Body' }}>{k}</div>
                <div style={{ display: 'flex', fontSize: v.length > 9 ? 18 : v.length > 6 ? 22 : 30, fontWeight: 700, color: c ?? '#fff', marginTop: 4, whiteSpace: 'nowrap' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* the tower, floor by floor in its own threads */}
        <div style={{ flex: 1, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', position: 'relative', paddingBottom: 70 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            {run.towers.map((t, b) => (
              <div key={b} style={{ display: 'flex', flexDirection: 'column-reverse', margin: '0 8px' }}>
                {t.map((fill, i) => (
                  <div key={i} style={{ display: 'flex', width: tw, height: fh, background: fill ? `#${fill}` : L.cloth, border: `3px solid ${line}`, marginTop: -3, alignItems: 'center', justifyContent: 'space-around' }}>
                    {fh >= 14 && [0, 1, 2, 3].map(k => <div key={k} style={{ display: 'flex', width: tw / 9, height: Math.max(4, fh * 0.35), background: line, opacity: 0.55 }} />)}
                  </div>
                ))}
                <div style={{ display: 'flex', width: tw + 24, height: 10, marginLeft: -12, background: line, marginTop: -3 }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', position: 'absolute', bottom: 40, width: 460, height: 40, borderRadius: 999, background: L.edge, opacity: 0.6 }} />
          {run.end && (
            <div style={{ display: 'flex', position: 'absolute', top: 60, right: 50, border: '6px solid #FF453A', color: '#FF453A', fontSize: 40, fontWeight: 900, padding: '6px 18px', transform: 'rotate(-9deg)', letterSpacing: 2 }}>
              {run.end === 'town' ? 'SHUT DOWN' : 'BANKRUPT'}
            </div>
          )}
        </div>
      </div>
    ),
    { width: W, height: H, fonts, headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  );
}
