# tiny-datacenter

A Tiny Tower–style idle game where you build a datacenter floor by floor, rendered in 3D as cross-stitch on aida cloth.

- Pick a **site** (The Dalles, Reykjavík, Phoenix, Ashburn) and **who you serve** (AI lab, streaming, bank, game servers)
- Click a **foundation** right in the scene — it sets how tall you can build
- Choose a **shape** (lean-to, sawtooth, box, setback tower, hangar), outline thread and stitch size
- Stack **floors**: server halls, cooling, power, network, break rooms — each one can get its own wall color
- **Hire tiny techs** to staff server halls
- Drag to orbit, scroll to zoom, right-drag to pan; toggle Inside/Outside to see the cutaway

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## How it's built

- Next.js (App Router) + React + TypeScript
- three.js for the scene; a full-screen shader (`lib/game/stitchPass.ts`) turns a low-res render into X stitches, with ink outlines from depth edges
- Game logic is plain TypeScript in `lib/game/` (`state.ts` for the economy, `actions.ts` for player actions, `models.ts` for the 3D pieces, `engine.ts` for the render loop)
- UI lives in `components/` (`Game`, `Hud`, `Sheet`)
- Progress saves to `localStorage`
