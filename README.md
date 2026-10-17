# tiny datacenter simulator

A simulator game where you build and run a datacenter, floor by floor. It's 3D, drawn as cross-stitch on cloth.

## How to play

**Set up.** You get a $100M budget. Pick a location, a foundation, a shape, your floors, a customer and colors. Every choice has a price, and the forecast shows your profit, power, cooling and trees cut as you go. Whatever you don't spend is your starting cash.

**Run it.** The bar at the top shows the month, your cash, profit per month and trust. Tap it to build floors, hire techs, see your books and buy upgrades. A goal card at the bottom tells you what to do next.

- Server halls earn money. They need enough power and cooling floors to run at full speed.
- Building costs about what real datacenters do, roughly $10M per MW. Power gear is the biggest cost, then cooling, which is cheapest in Iceland and most expensive in Arizona.
- Techs fill halls with more customers and fix outages on their floor. If a floor has no techs, tap it to fix it.
- Every month you pay for power, water, staff, property tax and profit tax. Three months in debt and you go bankrupt.
- Building cuts down trees and uses water and power. Neighbors, the water board, the power company and the paper will complain. Pay to fix it or ignore it. Ignoring costs trust and score.
- If trust hits 0, the town tears down your datacenter and you lose all your money.

## Locations

| | Land | Power | Cooling floor | Notes |
|---|---|---|---|---|
| Oregon | $150k/acre | $60/MWh | $10M | Hydro power, lots of trees, almost no property tax |
| Iceland | $120k/acre | $45/MWh | $7M | Free cooling, little water, customers pay less |
| Arizona | $600k/acre | $75/MWh | $17M | Hot, uses lots of water |
| Virginia | $2M/acre | $85/MWh | $12M | Customers pay the most, high property tax |

Prices, taxes, PUE and water use are rough estimates based on public figures.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## How it's built

- Next.js (App Router), React and TypeScript
- three.js renders the scene twice at stitch resolution; `lib/game/stitchPass.ts` turns every cell into an X stitch
- `lib/game/`: `data.ts` (prices and rates), `state.ts` (monthly books and simulation), `events.ts` (complaints, outages, goals, score, endings), `actions.ts` (player actions), `models.ts` (3D pieces), `engine.ts` (render loop, camera, the ending)
- `components/`: `SetupCard` (setup), `Island` (top bar), `GoalCard`, `EndCard`
- Progress saves to `localStorage`
