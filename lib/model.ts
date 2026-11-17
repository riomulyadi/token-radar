// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// the pre-token protocols below that floor: the early rows the radar exists to find. A protocol
// is pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol);
// the snapshot's live-token protocols are kept apart and shown as the market's own values, never
// mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures. Four terms, each from a field the
// file carries, and no protocol name is ever special-cased: the same function scores every row.
//
//   size       = log-scaled TVL, capped at 1. A protocol twice as large is worth more, but not
//               twice as much: the biggest pools in DeFi do not mint the biggest tokens.
//   growth     = the seven-day TVL change, weighted lightly and then capped, so one week of
//               flows is evidence but never proof: it can move the number by at most 18%.
//   maturity   = how long the protocol has run with no token, up to three years. A protocol that
//               has gone three years without issuing one is unlikely to be close, so the longer it
//               has waited the less its launch is worth. A protocol new today keeps the full
//               weight; one three years in keeps the floor.
//   category   = what the protocol does. A lending pool with a token is worth a different share
//               of its TVL than a DEX with one, and the snapshot's own live-token protocols say
//               which share: for each category the model measures the median ratio of market cap
//               to TVL across the protocols that already have a token, and applies it. The
//               share is measured from the data, not written down by hand. A category with too
//               few live-token protocols to measure uses the snapshot-wide median instead.
//
//   implied    = tvl_usd x size_weight x growth_weight x maturity_weight x category_share
//
// The constants are stated in the dashboard and are changeable in the model sandbox.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  /** The TVL at which the size term reaches its ceiling. */
  size_reference_usd: number;
  /** How far the size term may scale a protocol up. */
  size_span: number;
  /** The weight the size term starts at, at no TVL. */
  size_floor: number;
  /** How much a point of seven-day growth moves the number. */
  growth_weight: number;
  /** The seven-day growth the model will believe, above and below. */
  growth_cap: number;
  /** The most a week of TVL change can move the number, up or down. */
  growth_move_cap: number;
  /** The share of the size term a brand-new protocol keeps. */
  maturity_floor: number;
  /** The extra share a protocol earns by running three years with no token. */
  maturity_range: number;
  /** The days of waiting at which the maturity term reaches its ceiling. */
  maturity_days: number;
  /** The days a protocol of unknown age is credited with. */
  unknown_age_days: number;
  /** The live-token protocols a category needs before its own share is used. */
  category_min_samples: number;
  /** The share used for a category with too few live-token protocols to measure. */
  category_default_share: number;
  /** The highest share any category may reach. */
  category_share_cap: number;
  /** The lowest share any category may fall to. */
  category_share_floor: number;
}

export const MODEL: ModelConstants = {
  size_reference_usd: 1_000_000_000,
  size_span: 2.5,
  size_floor: 0.5,
  growth_weight: 0.35,
  growth_cap: 120,
  growth_move_cap: 0.18,
  maturity_floor: 0.45,
  maturity_range: 0.55,
  maturity_days: 1095,
  unknown_age_days: 365,
  category_min_samples: 3,
  category_default_share: 0.06,
  category_share_cap: 1.2,
  category_share_floor: 0.01,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 260;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    size_weight: number;
    growth_pct: number;
    growth_weight: number;
    maturity_weight: number;
    category_share: number;
    category_samples: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  size_weight: number;
  growth_weight: number;
  maturity_weight: number;
  category_share: number;
  category_samples: number;
  /** The share of the size term this protocol keeps before the category takes its cut. */
  gross_weight: number;
  /**
   * The farm plan, as the very strings board.json carries for this row. The page renders these
   * instead of recomputing them, so what a reader reads is exactly what the gate checks.
   */
  farm_steps: FarmStep[];
  /** The capital the plan puts to work, in dollars. */
  farm_capital: number;
  /** The days the plan asks the position to be held. */
  farm_hold_days: number;
  /** The gas the whole plan costs, in dollars. */
  farm_total_gas: number;
  /** The exact TVL, so a reader can recompute the chain without rounding. */
  tvl_usd_exact: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  /** The market's own ratio of market cap to TVL, the figure the category share is measured against. */
  mcap_to_tvl: number | null;
}

/** One category's measured share of TVL a token is worth, and how it was measured. */
export interface CategoryShare {
  category: string;
  share: number;
  samples: number;
  /** The median market-cap-to-TVL ratio of the live-token protocols in this category. */
  median_ratio: number | null;
  /** The live-token protocols the share was measured from. */
  names: string[];
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  /** The measured category shares, so the dashboard can show how each one was derived. */
  categories: CategoryShare[];
  /** The snapshot's own global median market-cap-to-TVL ratio, the fallback for an unmeasured category. */
  global_median_ratio: number;
  /** How many protocols in the snapshot record a token, the sample the shares are measured from. */
  live_sample_size: number;
  /** The watchlist's slugs, so the dashboard can tell the watchlist rows from the early radar. */
  watchlist_slugs: string[];
  /** How many protocols the snapshot holds in all. */
  protocol_count: number;
  /** How many of them record no token at all. */
  pre_token_count: number;
  /** Why the board ranks fewer protocols than record no token. */
  exclusions: Exclusions;
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/**
 * The share of a protocol's TVL that its token would be worth, measured per category from the
 * snapshot's own live-token protocols: the median ratio of market cap to TVL among the protocols
 * in that category that already have a token.
 */
export function categoryShares(snapshot: Snapshot, model: ModelConstants): Map<string, CategoryShare> {
  const groups = new Map<string, { ratio: number; name: string }[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const key = p.category ?? 'Uncategorised';
    const ratio = p.mcap_usd / p.tvl_usd;
    all.push(ratio);
    const list = groups.get(key) ?? [];
    list.push({ ratio, name: p.name });
    groups.set(key, list);
  }
  const shares = new Map<string, CategoryShare>();
  for (const [category, items] of groups) {
    if (items.length < model.category_min_samples) continue;
    const sorted = [...items].sort((a, b) => a.ratio - b.ratio);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 1
      ? sorted[mid]!.ratio
      : (sorted[mid - 1]!.ratio + sorted[mid]!.ratio) / 2;
    shares.set(category, {
      category,
      share: Math.min(model.category_share_cap, Math.max(model.category_share_floor, median)),
      samples: items.length,
      median_ratio: median,
      names: sorted.slice(0, 6).map((i) => i.name),
    });
  }
  return shares;
}

/**
 * The snapshot's own median ratio of market cap to TVL across every
 * live-token protocol: the fallback for a category with too few samples.
 */
export function globalMedianRatio(snapshot: Snapshot): number {
  const ratios: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    ratios.push(p.mcap_usd / p.tvl_usd);
  }
  if (ratios.length === 0) return 0.06;
  ratios.sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  return ratios.length % 2 === 1 ? ratios[mid]! : (ratios[mid - 1]! + ratios[mid]!) / 2;
}

/**
 * The share a protocol's category carries, measured or defaulted.
 *
 * A category with too few live-token protocols to measure falls back on the
 * snapshot's own global median ratio, so even an unmeasured category is
 * scored from the data rather than from a number written down by hand.
 */
function shareFor(
  shares: Map<string, CategoryShare>,
  category: string | null,
  model: ModelConstants,
  globalMedian: number,
): { share: number; samples: number } {
  const found = shares.get(category ?? 'Uncategorised');
  if (found) return { share: found.share, samples: found.samples };
  return { share: Math.min(model.category_share_cap, Math.max(model.category_share_floor, globalMedian)), samples: 0 };
}

/**
 * The four weights one protocol gets under `model`, and the implied value they produce.
 *
 * The size term is logarithmic: a protocol twice as large is worth more than a small one, but the
 * largest pools in DeFi do not mint the largest tokens, so the term is capped and grows with the
 * log of TVL. The growth term moves the number a little. The maturity term falls as the waiting
 * grows, because a protocol that has run three years without a token is not close to one. The
 * category share is measured from the snapshot's live-token protocols.
 */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  shares: Map<string, CategoryShare>,
  globalMedian: number,
): {
  implied: number;
  sizeWeight: number;
  growthPct: number;
  growthWeight: number;
  maturityWeight: number;
  categoryShare: number;
  categorySamples: number;
  grossWeight: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(-model.growth_cap, rawGrowth));
  // One week of flows is evidence, not proof: whatever the change, the growth term may move the
  // number by at most growth_move_cap, so a single week can never decide a protocol's rank.
  const rawMove = (growthPct / 100) * model.growth_weight;
  const growthMove = Math.min(model.growth_move_cap, Math.max(-model.growth_move_cap, rawMove));
  const growthWeight = 1 + growthMove;

  const ageForModel = age ?? model.unknown_age_days;
  const waited = Math.min(Math.max(ageForModel, 0), model.maturity_days);
  const maturityWeight = model.maturity_floor + (1 - waited / model.maturity_days) * model.maturity_range;

  // The size term: the log of the TVL, scaled, so the figure stays in a sane band.
  // It is capped: the biggest pools in DeFi do not mint the biggest tokens, so a protocol
  // ten times the size of another is not worth ten times as much.
  const sizeRatio = Math.max(protocol.tvl_usd, 1) / model.size_reference_usd;
  const sizeWeight = Math.min(
    1,
    model.size_floor + (Math.log10(sizeRatio + 1) / Math.log10(model.size_span + 1)) * (1 - model.size_floor),
  );

  const { share, samples } = shareFor(shares, protocol.category, model, globalMedian);
  const grossWeight = sizeWeight * growthWeight * maturityWeight;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * grossWeight * share));
  return {
    implied,
    sizeWeight: round4(sizeWeight),
    growthPct,
    growthWeight: round4(growthWeight),
    maturityWeight: round4(maturityWeight),
    categoryShare: round4(share),
    categorySamples: samples,
    grossWeight: round4(grossWeight),
    age,
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** Why a pre-token protocol the board does not rank was left out, and how many there are. */
export interface Exclusions {
  /** Protocols that record no token but trade as an exchange. */
  cex: number;
  /** Protocols whose name carries a version marker: a pool of another protocol. */
  versioned: number;
  /** Protocols above the house floor that the house's own rule leaves out. */
  house_rule: number;
  /** The total pre-token protocols in the snapshot. */
  pre_token: number;
  /** The total the board ranks. */
  ranked: number;
}

/** Why the board holds fewer protocols than the snapshot records no token for. */
export function countExclusions(snapshot: Snapshot, ranked: number): Exclusions {
  const pre = snapshot.protocols.filter(isPreToken);
  const watch = new Set(snapshot.watchlist);
  const out = pre.filter((p) => !watch.has(p.slug));
  let cex = 0;
  let versioned = 0;
  let houseRule = 0;
  for (const p of out) {
    if (p.category === 'CEX') cex++;
    else if (VERSIONED.test(p.name)) versioned++;
    else if (p.tvl_usd >= snapshot.floor_usd) houseRule++;
  }
  return { cex, versioned, house_rule: houseRule, pre_token: pre.length, ranked };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { board: BoardRow[]; shares: Map<string, CategoryShare> } {
  const index = bySlug(snapshot.protocols);
  const shares = categoryShares(snapshot, model);
  const globalMedian = globalMedianRatio(snapshot);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped. Never a
  // replacement for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, shares, globalMedian);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.slug ? 1 : 0));
  const board = scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      size_weight: s.sizeWeight,
      growth_pct: s.growthPct,
      growth_weight: s.growthWeight,
      maturity_weight: s.maturityWeight,
      category_share: s.categoryShare,
      category_samples: s.categorySamples,
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
  return { board, shares };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time.
 *
 * The plan is derived from the protocol's own record (category, chains, TVL, age, seven-day
 * growth) and never from a hand-written list of names. The steps that name the protocol name it
 * because the category chose the action; the step that sets the capital size comes from the
 * protocol's TVL; the step that sets the holding window comes from how long it has run.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = capital >= 150 ? 8 : 4;
  const weeklyGas = 2;
  const totalGas = gas + weeklyGas * Math.ceil(hold / 7);
  const totalDays = hold + 14;
  const action = actionFor(p, capital, chain);
  const growth = p.change_7d === null ? 'unreported' : `${p.change_7d > 0 ? '+' : ''}${p.change_7d.toFixed(1)}%`;
  return [
    {
      text: `Open a fresh wallet that holds only the money you mean to farm, and keep its seed phrase offline and out of any cloud notes.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Confirm ${p.name} is on ${chain} and that the pool or vault you picked is the one the protocol's own app lists, before you deposit anything.`,
      cost: 'no fee to check, and it costs nothing to be wrong here',
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, so the activity is counted in more than one weekly snapshot.`,
      cost: `about $${weeklyGas} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days. Its seven-day TVL change over the snapshot period was ${growth}, so size the position against a pool that can take it without moving the price against you.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open ${p.name}'s own points or rewards page and claim only from the link the app itself shows you.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Unwind in the reverse order you built it: withdraw the position, then stop the recurring action, then move the funds out of the protocol's own contracts.`,
      cost: `about $${gas} of gas again`,
      time: '15 minutes',
    },
    {
      text: `Write the wallet, the dates, the position size and every transaction in a farm log, so you can repeat the position or unwind it without guessing.`,
      cost: `about $${totalGas} of gas in total over ${totalDays} days`,
      time: '5 minutes, once',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      mcap_to_tvl: p.tvl_usd > 0 && p.mcap_usd !== null ? p.mcap_usd / p.tvl_usd : null,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    size_weight: row.model.size_weight,
    growth_weight: row.model.growth_weight,
    maturity_weight: row.model.maturity_weight,
    category_share: row.model.category_share,
    category_samples: row.model.category_samples,
    gross_weight: round4(
      row.model.size_weight * row.model.growth_weight * row.model.maturity_weight,
    ),
    farm_steps: parseSteps(row.farm_steps),
    farm_capital: capitalFor({
      slug: row.slug,
      name: row.name,
      category: row.category,
      chains: row.chains,
      tvl_usd: row.tvl_usd,
      change_7d: row.change_7d,
      mcap_usd: row.mcap_usd,
      listed_at: row.listed_at,
      gecko_id: row.gecko_id,
      symbol: row.symbol,
    }),
    farm_hold_days: holdDaysFor(row.age_days),
    farm_total_gas: 4 + 2 * Math.ceil(holdDaysFor(row.age_days) / 7) + 4,
    tvl_usd_exact: row.tvl_usd,
  };
}

/**
 * The farm steps read back out of the row's own strings: the plan the page shows is the plan
 * board.json carries, split back into its action, cost and time.
 */
function parseSteps(steps: string[]): FarmStep[] {
  return steps.map((s) => {
    const cost = s.match(/Cost: (.*?)\. Time: /);
    const time = s.match(/\. Time: (.*)\.$/);
    const text = cost ? s.slice(0, cost.index) : s;
    return {
      text,
      cost: cost ? cost[1]! : '',
      time: time ? time[1]! : '',
    };
  });
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { board: BoardRow[]; radar: RadarData } {
  const { board, shares } = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const categories: CategoryShare[] = [...shares.values()]
    .sort((a, b) => b.samples - a.samples)
    .map((c) => ({ ...c, share: round4(c.share) }));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
    categories,
    global_median_ratio: round4(globalMedianRatio(snapshot)),
    live_sample_size: snapshot.protocols.filter((p) => !isPreToken(p)).length,
    watchlist_slugs: [...snapshot.watchlist],
    protocol_count: snapshot.protocols.length,
    pre_token_count: snapshot.protocols.filter((p) => isPreToken(p)).length,
    exclusions: countExclusions(snapshot, board.length),
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
