# tiny datacenter simulator

A simulator game where you build and run a datacenter, floor by floor. It's 3D, drawn as cross-stitch on cloth.

## How to play

**Set up.** You get a $100M budget. Pick a location, a foundation, a shape, your floors, a customer and colors, then apply for a building permit with your datacenter's name and yours. Every choice has a price, and the forecast shows your profit, power, cooling and trees cut as you go. Whatever you don't spend is your starting cash.

**Run it.** The bar at the top shows the month, your cash, profit per month and trust. Tap it to build floors, hire techs, see your books and buy upgrades. A goal card at the bottom tells you what to do next.

- Server halls earn money. They need enough power and cooling floors to run at full speed.
- Building costs about what real datacenters do, roughly $10M per MW. Power gear is the biggest cost, then cooling, which is cheapest in Iceland and most expensive in Arizona.
- A server hall needs at least one tech to run. More techs fill it with more customers and fix outages on their floor. If a floor has no techs, tap it to fix it.
- Every month you pay for power, water, staff, property tax and profit tax. Three months in debt and you go bankrupt.
- Every button shows what it does before you tap: what a floor costs and how it changes your monthly profit, what a hire adds, what the town gains.
- The town has an opinion of you, built from local jobs, noise, trees cut, water, power bills, pollution and the taxes you pay. Trust moves toward that number every month, so a big datacenter that does nothing for the town slowly loses it. The Town tab shows every reason.
- Your power comes from the town grid. Over 60% of its capacity, power costs more; over 85%, the town gets brownouts; over 100%, blackouts and your halls get cut back. Pay for substations, solar or batteries to keep up.
- Help the town with trees, open houses, school funding or a monthly community fund, or finish projects like a sound wall, water-saving cooling and heat reuse. Gifts fade; projects last.
- Neighbors, the council, the water board, the power company and the paper complain by name. Pay to fix it or ignore it. Ignoring costs trust, and the town holds a grudge.
- Costs rise about 3% a year and upkeep grows with your building, while customer prices rise more slowly, so margins shrink unless you keep improving.
- Your rating (0 to 100) scores how well you run things right now: trust, profit margin, halls running, jobs and grid. It doesn't grow by waiting.
- 20 goals take you from your first hire to a 20-floor datacenter the town still likes.
- If trust hits 0, the town tears down your datacenter, you lose all your money, and it's breaking news.

## Staff

Hire from town or overseas. Locals count as town jobs, but each one pushes local wages up 3% as the labor pool runs dry. Overseas techs on work visas cost less a month and more to hire, and the town council complains if they outnumber locals. Recruiting gets pricier as you grow. Morale (Staff tab) comes from pay, health insurance, a retirement plan, break rooms (one per 8 techs), overtime and outages. Low morale brings requests, then a union drive (recognize it or pay lawyers to fight it), then a strike that runs halls at 30%, and unhappy techs quit.

Boosts: run a server hall hot for 3 months (+25% output, more power and outages), turn on overtime (+10% output, +30% wages, lower morale), or hold a team event.

## Government

Everything big needs a permit, and permits take months. The Gov tab shows each one, what it allows, what it costs and how long it takes.

- **Zoning approval** from the county for a bigger foundation, decided at a hearing that needs enough trust. In Loudoun County it takes 6 months, after its 2025 special exception rule.
- **Height permits:** the county allows up to 20 floors; past 20 (about 200 ft) you need a flight safety review from the FAA, or Iceland's transport authority, and past 40 a skyscraper review. Deep caissons (50 floors) and a mega-frame core (99) unlock after bedrock. Tall towers also bring view and shadow complaints, and the town counts the skyline against you.
- **Air permits** for the diesel backup generators on power floors. Three generator violations and the regulator stops approving them.
- **Water allocation** in Phoenix for more server halls, unless you switch to water-saving cooling.

Inspections come once a year, announced two months ahead, with the checklist visible in the Gov tab. Failing costs a fine and makes the news. Iceland alternates with an EU energy report on PUE.

Every four years the county or city holds an election. Your trust sets the polls. A pro-growth board makes permits faster and hearings easier; a slow-growth board does the opposite, and in Loudoun can pause new datacenters.

Laws follow each place's real timeline, simplified:

- **US:** a federal clean energy credit cuts the solar farm price until Congress ends it; an executive order fast-tracks permits for two years; a state large-load law makes you install a remote disconnect or accept less grid; grid emergencies ask you to run diesel generators.
- **Virginia:** a sales tax break on equipment, then a tax on datacenter power.
- **Arizona:** a tax break that the legislature freezes for three years, summer heat waves and water hearings.
- **Oregon:** a strategic investment tax deal that needs 10 local jobs by year 3 and ends after 15 years.
- **Iceland:** dry winters when the utility cuts big users, unless you pay for a priority contract.

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
- `lib/game/`: `data.ts` (prices and rates), `state.ts` (monthly books and simulation), `gov.ts` (permits, inspections, elections, laws), `events.ts` (town mood, complaints, outages, goals, rating, endings), `actions.ts` (player actions), `models.ts` (3D pieces), `engine.ts` (render loop, camera, the ending)
- `components/`: `SetupCard` (setup), `Island` (top bar), `GoalCard`, `EndCard`
- Progress saves to `localStorage`
