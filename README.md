# tiny datacenter simulator

A simulator game where you build and run a datacenter, floor by floor. It's 3D, drawn as cross-stitch on cloth.

## How to play

**Set up.** You get a $100M budget. Pick a location, a foundation, a shape, your floors, a customer and colors, then apply for a building permit with your datacenter's name and yours. Every choice has a price, and the forecast shows your profit, power, cooling and trees cut as you go. Whatever you don't spend is your starting cash.

**Run it.** The bar at the top shows the month, your cash, profit per month and trust. Tap it to build floors, hire techs, see your books and buy upgrades. A goal card at the bottom tells you what to do next.

- Server halls earn money. They need enough power and cooling floors to run at full speed.
- Building costs about what real datacenters do, roughly $10M per MW. Power gear is the biggest cost, then cooling, which is cheapest in Iceland and most expensive in Arizona.
- Techs fill halls with more customers and fix outages on their floor. If a floor has no techs, tap it to fix it.
- Every month you pay for power, water, staff, property tax and profit tax. Three months in debt and you go bankrupt.
- Every button shows what it does before you tap: what a floor costs and how it changes your monthly profit, what a hire adds, what the town gains.
- The town has an opinion of you, built from local jobs, noise, trees cut, water, power bills, pollution and the taxes you pay. Trust moves toward that number every month, so a big datacenter that does nothing for the town slowly loses it. The Town tab shows every reason.
- Your power comes from the town grid. Over 60% of its capacity, power costs more; over 85%, the town gets brownouts; over 100%, blackouts and your halls get cut back. Pay for substations, solar or batteries to keep up.
- Help the town with trees, open houses, school funding or a monthly community fund, or finish projects like a sound wall, water-saving cooling and heat reuse. Gifts fade; projects last.
- Neighbors, the council, the water board, the power company and the paper complain by name. Pay to fix it or ignore it. Ignoring costs trust and score, and the town holds a grudge.
- 20 goals take you from your first hire to a 20-floor datacenter the town still likes.
- If trust hits 0, the town tears down your datacenter, you lose all your money, and it's breaking news.

## Locations

| | Land | Power | Cooling floor | Town grid | Notes |
|---|---|---|---|---|---|
| Oregon | $150k/acre | $60/MWh | $10M | 30 MW | Hydro power, lots of trees, almost no property tax |
| Iceland | $120k/acre | $45/MWh | $7M | 24 MW | Free cooling, little water, customers pay less |
| Arizona | $600k/acre | $75/MWh | $17M | 20 MW | Hot, uses lots of water |
| Virginia | $2M/acre | $85/MWh | $12M | 16 MW | Customers pay the most, high property tax |

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
