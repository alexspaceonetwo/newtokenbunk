// language: JavaScript (ESM), file: src/calc.js
// Launch-price / liquidity calculator for a new SPL token on a Raydium AMM pool.
// Pure math — no external dependencies.

const DEFAULT_SOL_USD = 200;

export async function fetchSolUsd() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
    );
    if (!res.ok) return DEFAULT_SOL_USD;
    const data = await res.json();
    const price = data?.solana?.usd;
    return typeof price === 'number' && price > 0 ? price : DEFAULT_SOL_USD;
  } catch {
    return DEFAULT_SOL_USD;
  }
}

export async function runCalc(opts) {
  const decimals = Number(opts.decimals) > 0 ? Number(opts.decimals) : 6;
  const solUsd = Number(opts.solusd) > 0 ? Number(opts.solusd) : await fetchSolUsd();

  const hasSol = opts.sol !== undefined && Number(opts.sol) > 0;
  const hasTokens = opts.tokens !== undefined && Number(opts.tokens) > 0;
  const hasPrice = opts.price !== undefined && Number(opts.price) > 0;

  if (!hasSol && !hasTokens && !hasPrice) {
    throw new Error('Provide at least two of --sol, --tokens, --price');
  }
  if (!hasSol && !hasTokens) {
    throw new Error('Provide --sol and/or --tokens (a concrete amount)');
  }

  let sol = hasSol ? Number(opts.sol) : null;
  let tokens = hasTokens ? Number(opts.tokens) : null;
  let priceUsd = hasPrice ? Number(opts.price) : null;

  if (sol && tokens && !priceUsd) {
    priceUsd = (sol / tokens) * solUsd; // derive price
  } else if (sol && priceUsd && !tokens) {
    tokens = (sol * solUsd) / priceUsd; // derive token amount for a target price
  } else if (tokens && priceUsd && !sol) {
    sol = (tokens * priceUsd) / solUsd; // derive SOL needed for a target price
  }

  if (!sol || !tokens || !priceUsd || sol <= 0 || tokens <= 0 || priceUsd <= 0) {
    throw new Error('Could not derive a valid launch setup — check your inputs.');
  }

  const priceSol = sol / tokens;
  const marketCap = tokens * priceUsd;

  return {
    sol,
    tokens,
    decimals,
    priceSol,
    priceUsd,
    solUsd,
    marketCap,
    rawSol: BigInt(Math.round(sol * 1e9)),
    rawTokens: BigInt(Math.round(tokens * 10 ** decimals)),
  };
}

export function formatCalc(r) {
  return [
    `SOL liquidity:        ${r.sol.toLocaleString(undefined, { maximumFractionDigits: 2 })} SOL`,
    `BUNK paired:          ${r.tokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} BUNK`,
    `BUNK price (SOL):     ${r.priceSol.toExponential(6)} SOL`,
    `BUNK price (USD):     $${r.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 8 })}`,
    `SOL price used:       $${r.solUsd.toFixed(2)}`,
    `Fully-diluted market cap (at launch): $${r.marketCap.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    `Raw SOL to deposit (1e9):  ${r.rawSol}`,
    `Raw BUNK to deposit (1e${r.decimals}): ${r.rawTokens}`,
  ];
}
