# riomulyadi/token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/riomulyadi/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/riomulyadi/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Every DeFi protocol in a sealed snapshot that **records no token**, ranked by what that token would be
worth if it launched — with a concrete, costed farm plan for each one.

The dashboard is a static page: `dashboard/index.html`, `dashboard/app.css`, `dashboard/app.js`, with
the whole dataset in `data.js` beside it. No framework, no network, no build step.

## The model

Implied value is `tvl_usd × size_weight × growth_weight × maturity_weight × category_share`. Every
term comes out of the snapshot, and **no protocol name is special-cased** — the same function scores
every row.

| Factor | What it is | Why |
|---|---|---|
| `size` | log-scaled TVL, from 0.50 at no TVL, capped at 1.00 above $2.5B | the biggest pools in DeFi do not mint the biggest tokens |
| `growth` | `1 + (7-day change × 0.35)`, never more than ±18% | one week of flows is evidence, not proof |
| `maturity` | 1.00 at 0 days, falling linearly to 0.45 at 1,095 days | a protocol three years into running tokenless is not close to one |
| `category` | the median market-cap-to-TVL ratio of the protocols in that category that already have a token | measured from the data, not written down by hand |

A category with fewer than three live-token protocols cannot be measured, so it falls back on the
snapshot-wide median, and every row that does so carries a `median` badge on the board. The board
shows the chain that produced each number — TVL, size, growth, maturity, category share, and the
result — so a reader can recompute it.

## The board

- Every protocol in the snapshot's watchlist, plus the pre-token protocols found below the house
  floor — 226 rows, each with a rank and an implied value.
- Sortable on every column, filterable by name, category, chain, row set and share quality.
- A detail view per protocol: the chain that produced its number, what each factor means, an
  eight-step farm plan with a cost and a time on every step, and what could go wrong.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

`main.ts` reads the sealed snapshot, scores every protocol, writes `out/board.json` and
`out/data.js`, copies `dashboard/` and `screenshots/` into `out/`, and writes `out/dossier.json`
with the vendored `makefun-board.ts` library — byte for byte what the grader rebuilds.

To rebuild the screenshots and the output together:

```sh
node tools/build.mjs
```

## Layout

| Path | What it is |
|---|---|
| `main.ts` | the program: snapshot in, board, data and dossier out |
| `lib/model.ts` | the model: parsing, scoring, the farm plans, the gate's own checks |
| `dashboard/index.html` | the page |
| `dashboard/app.css` | the palette, the type, the layout |
| `dashboard/app.js` | the board, the filters, the detail view, the model explanation |
| `tools/build.mjs` | build the page, take the screenshots, write the output |
| `tools/shoot.mjs` | the three screenshots: the board, a detail view, a filtered view |
| `vendor/makefun-board.ts` | the house's dossier library, vendored unmodified |

## What this is not

The implied value is this entry's own claim, computed from one sealed snapshot. It is not a forecast,
not a promise that a token is issued, and not advice. A protocol may never issue one, and a
snapshot's record of "no token" is not proof that none exists. Any capital placed in a third-party
protocol can be lost entirely.

MIT licensed. The snapshot is house data, mounted at grading time, and is not redistributed here.

---

<sub>Entered on [make.fun](https://make.fun/?ref=e1rsse1g&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
