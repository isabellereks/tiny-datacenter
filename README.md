# tiny datacenter simulator

A simulator game where you build and run a datacenter, floor by floor. It's 3D, drawn as cross-stitch on cloth.

## How to play

**Set up.** You get a $100M budget. Pick a location, a foundation, a shape, your floors, a customer and colors, then apply for a building permit with your datacenter's name and yours. Every choice has a price, and the forecast shows your profit, power, cooling and trees cut as you go. Whatever you don't spend is your starting cash.

**Run it.** The bar at the top shows the month, your cash, profit per month and trust. The button on its right pauses and fast-forwards (space pauses, 1 to 3 pick a speed); a month takes 8 seconds at normal speed. Tap it to build floors, hire techs, see your books and buy upgrades. A goal card at the bottom tells you what to do next.

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

## The long game

- **Notoriety** comes from your size, your grid use, your other sites and the complaints you ignore. It brings customers (up to 20% higher prices) and backlash.
- **A moratorium bill** is filed once you're noticed. It moves forward every month with notoriety, power bills, water and low trust, and slows with lobbyists, a happy town and local jobs. At 40% and 80% you're called to testify. If it passes, nothing new gets built at home for five years, and copycat laws can hit your other sites.
- **Shell companies:** file your permit under a code name and people notice you less, until it leaks. Lobbyists can leak too.
- **The AI market** booms (prices +30%, cheap loans) and crashes (prices −35%, dear loans).
- **Loans:** borrow $10M to $150M against your buildings and land, paid back monthly over 10 years. Rates follow the market and your debt.
- **Contracts:** a hyperscaler offers 10 years of fixed prices for 80% of your capacity. They protect you in a crash and cost you in a boom, and outages bring penalties; five strikes and they walk.
- **Things come back:** running diesel generators leads to a lawsuit years later, clearing lots of trees floods homes downhill, ignoring the hum leads to a sleep study and a class action, and in the desert the wells can run dry.
- **Map:** buy existing datacenters in the other locations. They send their profit home every month.
- **A yearly briefing** pauses the game every January: market, notoriety, the bill's odds, grid, debt, contract, sites and lawsuit risk.

## Campus

Big datacenters are campuses of several wide buildings. With site plan approval from the county you can add up to three buildings, side by side, each with its own stack of floors. Pick which building to build on in the Build tab. A foundation upgrade applies to every building.

## Staff

Hire from town or overseas. Locals count as town jobs, but each one pushes local wages up 3% as the labor pool runs dry. Overseas techs earn 30% less but need a work visa when hired and again every year, and the town council complains if they outnumber locals. Recruiting gets pricier as you grow. Morale (Staff tab) comes from pay, health insurance, a retirement plan, break rooms (one per 8 techs), overtime and outages. Letting people go hurts morale, more with each layoff, and a wave of layoffs makes the news. Low morale brings requests, then a union drive (recognize it or pay lawyers to fight it), then a strike that runs halls at 30%, and unhappy techs quit.

Boosts: run a server hall hot for 3 months (+25% output, more power and outages), turn on overtime (+10% output, +30% wages, lower morale), or hold a team event.

## Government

Everything big needs a permit, and permits take months. The Gov tab shows each one, what it allows, what it costs and how long it takes.

- **Zoning approval** from the county for a bigger foundation, decided at a hearing that needs enough trust. In Loudoun County it takes 6 months, after its 2025 special exception rule.
- **Height permits:** the county allows up to 20 floors; past 20 (about 200 ft) you need a flight safety review from the FAA, or Iceland's transport authority, and past 40 a skyscraper review. Deep caissons (50 floors) and a mega-frame core (99) unlock after bedrock. Tall towers also bring view and shadow complaints, and the town counts the skyline against you.
- **Air permits** for the diesel backup generators on power floors. Three generator violations and the regulator stops approving them.
- **Site plan approval** for each new building on the campus.

Reviewers sometimes ask for more before deciding (a traffic study, a shadow study, a public comment period), adding 1 to 3 months, more often under a slow-growth board. Each permit card shows what you have, what is next, the last decision and why, and the trust a hearing needs.
- **Water allocation** in Phoenix for more server halls, unless you switch to water-saving cooling.

Inspections come once a year, announced two months ahead, with the checklist visible in the Gov tab. Failing costs a fine, makes the news and brings a stop-work order: no income while staff, taxes, upkeep and standby power keep billing, plus a penalty for every failed monthly reinspection until everything passes. Iceland alternates with an EU energy report on PUE.

Every four years the county or city holds an election, and your town's trust sets the odds for the pro-growth side. US sites also get national elections, a coin flip your town can't sway: a build-fast administration speeds up permits, a clean-energy one brings back the solar credit and tightens generator rules. A pro-growth board makes permits faster and hearings easier; a slow-growth board does the opposite, and in Loudoun can pause new datacenters.

Laws follow each place's real timeline, simplified:

- **US:** a federal clean energy credit cuts the solar farm price until Congress ends it; an executive order fast-tracks permits for two years; a state large-load law makes you install a remote disconnect or accept less grid; grid emergencies ask you to run diesel generators.
- **Virginia:** a sales tax break on equipment, then a tax on datacenter power.
- **Arizona:** a tax break that the legislature freezes for three years, summer heat waves and water hearings.
- **Oregon:** a strategic investment tax deal that needs 10 local jobs by year 3 and ends after 15 years.
- **Iceland:** dry winters when the utility cuts big users, unless you pay for a priority contract.

## Locations

| | Land | Power | Town grid | Room | Permits | Notes |
|---|---|---|---|---|---|---|
| Oregon | $150k/acre | $60/MWh | 30 MW | 3 buildings | Normal | Hydro power, lots of trees, a 15-year tax deal that needs local jobs |
| Iceland | $120k/acre | $45/MWh | 24 MW | 2 buildings, low height near the airport | Normal | Free cooling, dry-winter power cuts, EU energy reports |
| Arizona | $600k/acre | $75/MWh | 20 MW | 3 buildings | Normal | Hot, water permits, heat waves, a tax break the legislature freezes |
| Virginia | $2M/acre | $85/MWh | 16 MW | 2 buildings | Slow | Customers pay the most, special exception hearings, a datacenter power tax |
| Texas | $30k/acre | $55/MWh | 40 MW | 3 buildings, 20 floors to start | Fast | Cheap land and wind, property tax abatement, winter storms, the large-load law early |
| Ohio | $250k/acre | $70/MWh | 22 MW | 3 buildings | Fast | Coal-heavy grid, tax abatement, a utility tariff that bills 85% of reserved power |
| Ireland | $1.5M/acre | $150/MWh | 10 MW | 1 building, 16 floors at most | Slow | 12.5% profit tax until the global minimum tax, a grid moratorium that blocks substations |
| Sweden | $50k/acre | $40/MWh | 35 MW | 3 buildings | Normal | Cold and cheap, a power tax cut that ends, EU energy reports |

Prices, taxes, PUE and water use are rough estimates based on public figures.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Calls

People from town phone you about what you are actually doing to them: cut trees, the hum, power bills, water, jobs, the skyline, a strike. Angrier towns call more. Answering helps a little; declining or letting it ring costs trust. Now and then someone calls to say thanks.

## Share

Share on X (View tab, or the end screen) stitches a card from your datacenter with your run's stats. On a phone it goes straight to the share sheet; on a computer the image downloads and X opens with the post text ready.

## How it's built

- Next.js (App Router), React and TypeScript
- three.js renders the scene twice at stitch resolution; `lib/game/stitchPass.ts` turns every cell into an X stitch
- `lib/game/`: `data.ts` (prices and rates), `state.ts` (monthly books and simulation), `gov.ts` (permits, inspections, elections, laws), `events.ts` (town mood, complaints, outages, goals, rating, endings), `actions.ts` (player actions), `models.ts` (3D pieces), `engine.ts` (render loop, camera, the ending)
- `components/`: `SetupCard` (setup), `Island` (top bar), `GoalCard`, `EndCard`
- Progress saves to `localStorage`
