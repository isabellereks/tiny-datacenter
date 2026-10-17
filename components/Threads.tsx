import { THREADS, type Fill } from '@/lib/game/data';

/** A row of thread colours. `cloth` adds a bare-cloth swatch first. */
export function Threads({ value, onPick, cloth = true, colors, label }: {
  value: Fill; onPick: (f: Fill) => void; cloth?: boolean; colors?: string[]; label: string;
}) {
  const list = colors ?? THREADS.map(t => t.hex);
  const name = (hex: string) => THREADS.find(t => t.hex === hex)?.name ?? hex;
  return (
    <div className="threads" role="group" aria-label={label}>
      {cloth && (
        <button className="thread cloth" aria-pressed={value === 'cloth'} title="Bare cloth" aria-label="Bare cloth" onClick={() => onPick('cloth')} />
      )}
      {list.map(hex => (
        <button key={hex} className="thread" style={{ background: hex }} aria-pressed={value === hex}
          title={name(hex)} aria-label={name(hex)} onClick={() => onPick(hex)} />
      ))}
    </div>
  );
}
