# tiny datacenter simulator

A simulator game where you build and run a datacenter, floor by floor. It's 3D, drawn as cross-stitch on cloth.

## How to play

**Set up.** You get a $250M budget. Pick a location (tap one to see what it's like), a foundation, a shape, your first floors, your first customer and colors, then apply for a building permit with your datacenter's name and yours. Whatever you don't spend is your starting cash.

**Run it.** The bar at the top shows the month, your cash, profit per month and trust. The button on its right pauses and fast-forwards (space pauses, 1 to 3 pick a speed); a month takes 8 seconds at normal speed. Tap the bar for the controls: a panel on the right on a computer, a sheet from the bottom on a phone. Tabs: Build, Power, Floors, Deals, Staff, Town, Gov and Money. A goal card says what to aim for next. Only big news pops up on the bar; the rest goes in the log. Letters, calls, briefings and new tiers pause the game, and only one comes at a time.

**Hints.** The game shows prices and results, like a real business. Turn on Hints in settings to also see predictions: what a floor or hire does to your monthly profit, where trust and morale are heading and why, and when the moratorium bill will pass.

**Money is close to real.** A datacenter costs about $8M per MW to build. Customers pay about $140 to $220 per kW a month. Banks lend interest-only construction loans against what you've built and the leases you've signed, about 6.5% in normal times. Every three months a small card shows the quarter's profit or loss; tap Books for the full statement. The game keeps running.

### The loop

1. **Customers.** Your first customer signs a 1-year deal at opening. Early deals are short (1–2 years) so space frees up for bigger customers; deals get longer as you grow, up to 10 years. New offers arrive every few months in the Deals tab: who they are, how many MW, what they pay, for how long, and when they move in. Some need clean power, no outages or the newest chips. Sign the ones you can supply by their move-in date. If you can't deliver the power you promised, you pay credits (never more than they paid that month) and get a strike; three strikes and they leave. Spare capacity sells on the spot market, cheaply. Deal prices rise 2.5% a year, like real contracts.
2. **Build.** Server halls hold the chips. Power and cooling floors each support 10 MW of halls. Building takes months: a hall 3, cooling 3, power 6 (longer in a transformer shortage). You have two construction crews and can hire more. A crane stands on site while they work. Techs keep halls running: a hall with no techs is off, and three fill it. Network floors make customers pay more; break rooms make techs faster. Liquid cooling is an upgrade in the Build tab.
3. **Chips.** A new chip generation ships every couple of years. Halls keep the chips they were fitted with, so customers pay less for older halls (10% less per generation) and old chips fail more. Refit a hall with new chips from the Floors tab. From the fourth generation on, chips need liquid cooling.
4. **Power.** Your power comes from the town grid. Over 60% of its capacity, power costs more and bills go up in town; over 85%, brownouts; over 100%, blackouts and your halls get cut back. More grid means joining the utility's interconnection queue: pay a deposit and wait through its studies, from 9 months in Texas to 5 years in Dublin. Pay for the substation yourself to go faster, or take a flexible connection that arrives in months but can be cut at peaks. All of this lives in the Power tab. Meanwhile you can make power on site: solar farms and gas turbines (as many as you like, a few months apart), batteries, and at the top a small nuclear reactor.
5. **Grow.** Run more IT power to move up the tiers: edge room, colocation (6 MW), hyperscale (18 MW) and AI factory (45 MW). Each tier brings bigger customers and bigger grid requests, and unlocks gas turbines, liquid cooling and the reactor.

Every month you pay for power, fuel, water, staff, upkeep, property tax, profit tax and loan interest. You can end a deal early for an exit fee. The first month you're in the red, your bank writes: a bridge loan, an expensive emergency loan, or go it alone. Three months in the red and you go bankrupt.

### Surprises

- **Rush orders:** when you have spare capacity, someone who needs power right now offers a lot for a few months.
- **A rival** opens across town, wins customers while it's bigger than you, and tries to hire your techs away. Outgrow it and it leaves.
- **Milestones** get a party: your first $1M month, 10 MW, $100M in the bank.
- **People in town:** tap someone walking by to hear what they think.

### The town

The town judges you on four things you can see, plus what you've done for it:

- **Jobs:** they expect two local hires per server hall.
- **Noise:** more floors and gas turbines are louder; a sound wall fixes most of it.
- **Power bills:** go up when you push the town grid.
- **Nature:** trees cut, water used and carbon.
- **Good deeds:** plant trees, fund the school, heat homes with server heat. Sound walls, water-saving cooling and heat for homes are in the Town tab. These fade; ignored complaints leave a grudge.

Trust moves toward that score every month. You can see it in the world too: more homes go up as you hire locals, windows go dark in a blackout, "For sale" signs appear and people picket your gate when trust drops. The town writes to you about each of the four, and phones you. At 0 trust the town tears the datacenter down.

### The long game

- **The economy** moves in phases: steady growth, inflation spikes, recessions and energy crises. Costs creep up a little faster than prices, but prices never fall more than 20% behind.
- **The AI market** booms (more offers, higher prices) and crashes (fewer offers, cheap spot prices). Signed deals keep paying.
- **A moratorium bill** gets filed once you're big or the town turns on you. It moves with your size, power bills, water and low trust, and slows when the town likes you and you hire locals. At 40% and 80% you're called to testify. If it passes, no new server halls or buildings for five years, though you can still upgrade power and cooling.
- **Loans:** $10M to $150M against your buildings, land and signed deals, paid back monthly over 15 years.
- **Things come back:** running diesel generators leads to a lawsuit years later, clearing lots of trees floods homes downhill, ignoring the noise leads to a class action, and in the desert the wells can run dry, after which new halls need water-saving cooling.
- **A yearly briefing** every January: size, customers, chips, grid, economy, the bill, debt and lawsuit risk.

## Staff

Hire from town or overseas. Locals count as town jobs and push local wages up as the labor pool runs dry. Overseas techs earn half as much but need a work visa every year. Morale comes from pay, health insurance, retirement, break rooms (one per 8 techs), overtime and outages. Low morale brings requests, then a union drive, then a strike that runs halls at 30%. You can settle a strike any time, and long strikes make the news.

## Government

Permits take months. Zoning, height and site plans go to a hearing, a vote where more trust means better odds; close votes often pass with conditions (you pay community benefits), and after a denial you can reapply in 3 months. They cover zoning for bigger foundations, height permits (past 20 floors a flight safety review, past 40 a skyscraper review), air permits for the backup generators on power floors, site plan approval for each new building, and water in Phoenix. Inspections come once a year with the checklist visible ahead of time; failing two or more items brings a stop-work order. County elections are decided by trust; US national elections are a coin flip. Laws follow each place's real timeline, simplified.

## Locations

| | Land | Power | Town grid | Grid queue | Room | Notes |
|---|---|---|---|---|---|---|
| Oregon | $150k/acre | $60/MWh | 30 MW | 18 mo | 3 buildings | Hydro power, lots of trees, a tax deal that needs local jobs |
| Iceland | $120k/acre | $45/MWh | 24 MW | 12 mo | 2 buildings | Free cooling, dry-winter power cuts, snow |
| Arizona | $600k/acre | $75/MWh | 20 MW | 24 mo | 3 buildings | Hardest: hot, heat waves, and the wells can run dry. Get water-saving cooling early |
| Virginia | $2M/acre | $85/MWh | 16 MW | 42 mo | 2 buildings | Customers pay the most, slow permits, a power tax |
| Texas | $30k/acre | $55/MWh | 40 MW | 9 mo | 3 buildings | Cheap land and wind, fast permits, winter storms |
| Ohio | $250k/acre | $70/MWh | 22 MW | 24 mo | 3 buildings | Coal-heavy grid, a utility tariff on reserved power |
| Ireland | $1.5M/acre | $150/MWh | 10 MW | 60 mo | 1 building | Low profit tax, the grid closed for years. Grow on gas turbines |
| Sweden | $50k/acre | $40/MWh | 35 MW | 12 mo | 3 buildings | Cold and cheap, snow half the year |

Prices, taxes, PUE and water use are rough estimates based on public figures.

## Look and sound

Every card is a linen patch with a running stitch. In-world things look like the real objects: the news is a TV broadcast, complaints are letters you stamp, callers come on air, and outages set off an alarm. Days turn to night slowly and lit windows glow; it snows and rains by place and season. Sound is made on the fly: a hum that rises with load, a needle when floors are stitched in, stamps, the phone and the news. Turn it off in settings.

## Share

Share on X (settings, or the end screen) posts your stats with a link to your run. The link preview on X shows your tower in its own threads with your rating and stats, drawn on the server from the link. Copy and Save give you the full picture of your datacenter too.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## How it's built

- Next.js (App Router), React and TypeScript
- three.js renders the scene twice at stitch resolution; `lib/game/stitchPass.ts` turns every cell into an X stitch and handles night
- `lib/game/`: `data.ts` (prices, chips, tiers), `state.ts` (monthly books and simulation), `deals.ts` (customers, chips, the grid queue, tiers), `events.ts` (town, complaints, outages, goals, rating), `gov.ts` (permits, inspections, elections, laws), `staff.ts`, `strategy.ts` (economy, market, the bill, loans, lawsuits, briefing), `calls.ts`, `sound.ts`, `actions.ts`, `models.ts` (3D pieces), `engine.ts` (render loop, camera, town life, weather)
- Progress saves to `localStorage`
