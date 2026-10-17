# tiny datacenter simulator

A Tiny Tower–style idle game where you build a datacenter layer by layer. It's 3D, but every frame is drawn as cross-stitch on cloth.

**Build it.** A short setup walks you through it: pour a foundation (tap it right on the cloth), pick a shape, choose where it goes, set how tall to start, colour each layer with thread, choose who you're serving, and name it. The name gets stitched underneath.

**Run it.** Once you open for business, everything lives in a dynamic island at the top. It shows the day, cash and status, pops up with news, and expands into Build, Floor, Crew, Impact, Site and Look.

- Stack floors (server halls, cooling, power, network, break rooms) and hire tiny techs to staff the halls
- Each location has its own cloth, ground and scenery: Oregon pines, Icelandic snow, Arizona desert, Virginia's data center alley
- Building clears the trees around your lot, and the Impact tab tracks trees, water, carbon and goodwill
- Days pass while you play. Stay at a stage too long and complaints arrive: neighbors, the water board, the utility, protests. Fix them or ignore them; goodwill scales your revenue
- Drag to turn the building, scroll to zoom; Inside shows the floors and crew, Outside shows the facade

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## How it's built

- Next.js (App Router) + React + TypeScript
- three.js renders the scene twice at stitch resolution (view normals + depth, then flat role colours and the lit ground); `lib/game/stitchPass.ts` turns every cell into a thread and draws the X stitches
- Game logic is plain TypeScript in `lib/game/`: `state.ts` (economy and days), `actions.ts` (player actions), `events.ts` (environmental impact and complaints), `models.ts` (3D pieces and scenery), `engine.ts` (render loop and camera)
- UI lives in `components/`: `Game`, `SetupCard` for the build walkthrough, `Island` for the dynamic island
- Progress saves to `localStorage`
