# tiny datacenter simulator

A Tiny Tower–style idle game where you build a datacenter floor by floor. The building is 3D, but it is drawn as a cross-stitch pattern: two or three threads, white left unstitched, outlines on every edge.

- Pick a **site** (The Dalles, Reykjavík, Phoenix, Ashburn) and **who you serve** (AI lab, streaming, bank, game servers)
- Click a **foundation** right in the scene — it sets how tall you can build
- Choose a **shape**: lean-to, sawtooth, box, setback tower, hangar
- Stack **floors**: server halls, cooling, power, network, break rooms; fill each with blank cloth, light or dark thread
- Tune the **pattern**: stitches across, thread colours, stitched lettering, and recolour threads from a DMC palette
- The thread key counts stitches and skeins and gives the finished size on 14-count aida
- **Hire tiny techs** to staff server halls
- Drag to turn the factory, up and down to tilt, scroll to zoom; Inside shows the cutaway with the crew

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## How it's built

- Next.js (App Router) + React + TypeScript
- three.js renders the scene twice at stitch resolution (view normals + depth, then flat role colours); `lib/game/stitchPass.ts` classifies every cell into a thread and draws the X stitches
- Game logic is plain TypeScript in `lib/game/` (`state.ts` for the economy, `actions.ts` for player actions, `models.ts` for the 3D pieces, `engine.ts` for the render loop)
- UI lives in `components/` (`Game` for the fabric and toolbar, `Panel` for the pattern and build controls)
- Progress saves to `localStorage`
