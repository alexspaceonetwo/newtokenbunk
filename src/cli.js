import { Command } from 'commander';
import { loadConfig, resolveCluster, connectionFor } from './cluster.js';
import { loadOrCreateKeypair } from './keypair.js';
import { mint } from './mint.js';
import { listWalletMints } from './wallet.js';
import { runCalc, formatCalc } from './calc.js';
import { createOpenBookMarket, createAmmPool, poolPlan } from './pool.js';

const program = new Command();
program.name('spl-lab').description('SPL deployment CLI');

program
  .command('mint')
  .requiredOption('--name <name>', 'token name, e.g. BUNK')
  .requiredOption('--symbol <symbol>', 'token symbol, e.g. BUNK')
  .option('--decimals <decimals>', 'token decimals', '6')
  .option('--supply <supply>', 'whole-token supply', '1000000')
  .option('--cluster <cluster>', 'cluster name from config.json')
  .option('--rpc <rpc>', 'override RPC URL')
  .option('--keypair <keypair>', 'path to keypair JSON')
  .action(async (opts) => {
    const cfg = loadConfig();
    const clusterName = opts.cluster || cfg.activeCluster || 'mainnet-beta';
    const cluster = opts.rpc
      ? { label: clusterName, rpc: opts.rpc }
      : resolveCluster(cfg, clusterName);
    const connection = connectionFor(cluster);
    const payer = loadOrCreateKeypair(opts.keypair);

    // Safety pre-flight for mainnet: fail fast with a clear message instead of
    // a confusing "insufficient funds" RPC error mid-transaction.
    const MIN_BALANCE_SOL = 0.02;
    const balance = await connection.getBalance(payer.publicKey);
    if (balance / 1e9 < MIN_BALANCE_SOL) {
      console.error(
        `[${cluster.label}] ERROR: wallet ${payer.publicKey.toBase58()} has only ` +
        `${(balance / 1e9).toFixed(4)} SOL (need >= ${MIN_BALANCE_SOL} SOL).`
      );
      console.error(`[${cluster.label}] Fund this wallet, then re-run.`);
      process.exit(1);
    }

    console.log(`[${cluster.label}] minting on ${clusterName} via ${cluster.rpc}`);
    console.log(`[${cluster.label}] owner: ${payer.publicKey.toBase58()}`);

    const result = await mint({
      connection,
      payer,
      owner: payer.publicKey,
      name: opts.name,
      symbol: opts.symbol,
      decimals: Number(opts.decimals),
      supply: BigInt(opts.supply),
      clusterName,
    });

    console.log(`[${cluster.label}] mint:  ${result.mint}`);
    console.log(`[${cluster.label}] ata:   ${result.ata}`);
    console.log(`[${cluster.label}] supply: ${result.supply}`);
    if (cluster.explorer) {
      console.log(`[${cluster.label}] explorer: ${cluster.explorer}/address/${result.mint}`);
    }
    if (cluster.solscan) {
      console.log(`[${cluster.label}] solscan:  ${cluster.solscan}/token/${result.mint}`);
    }
  });

program
  .command('list')
  .option('--owner <owner>', 'wallet address to list (defaults to keypair)')
  .option('--cluster <cluster>', 'cluster name from config.json')
  .option('--rpc <rpc>', 'override RPC URL')
  .option('--keypair <keypair>', 'path to keypair JSON')
  .action(async (opts) => {
    const cfg = loadConfig();
    const clusterName = opts.cluster || cfg.activeCluster || 'mainnet-beta';
    const cluster = opts.rpc
      ? { label: clusterName, rpc: opts.rpc }
      : resolveCluster(cfg, clusterName);
    const connection = connectionFor(cluster);
    const owner = opts.owner || loadOrCreateKeypair(opts.keypair).publicKey.toBase58();

    console.log(`[${cluster.label}] wallet ${owner} on ${clusterName}`);
    const mints = await listWalletMints({ connection, owner, cluster: clusterName });
    for (const m of mints) {
      console.log(
        `  ${m.symbol || '???'} (${m.name || 'unknown'})  amount=${m.amount}  ` +
        `mint=${m.mint}`
      );
    }
    if (mints.length === 0) console.log('  (no token accounts)');
  });

program
  .command('calc')
  .description('launch-price / liquidity calculator for the token')
  .option('--sol <sol>', 'SOL to commit as liquidity')
  .option('--tokens <tokens>', 'BUNK tokens to pair into the pool')
  .option('--price <price>', 'target BUNK price in USD (derive the missing amount)')
  .option('--solusd <solusd>', 'SOL price in USD (default: live CoinGecko, fallback 200)')
  .option('--decimals <decimals>', 'token decimals', '6')
  .action(async (opts) => {
    const result = await runCalc(opts);
    for (const line of formatCalc(result)) console.log(line);
  });

program
  .command('pool-market')
  .description('create an OpenBook market for the token (Raydium AMM pool requires one)')
  .requiredOption('--mint <mint>', 'token mint address (base)')
  .option('--decimals <decimals>', 'token decimals', '6')
  .option('--lot-size <lotSize>', 'minimum order size in base units', '1')
  .option('--tick-size <tickSize>', 'price tick size in quote units', '0.01')
  .option('--cluster <cluster>', 'cluster name from config.json')
  .option('--rpc <rpc>', 'override RPC URL')
  .option('--keypair <keypair>', 'path to keypair JSON')
  .option('--dry-run', 'print the plan without sending anything')
  .action(async (opts) => {
    const cfg = loadConfig();
    const clusterName = opts.cluster || cfg.activeCluster || 'mainnet-beta';
    const cluster = opts.rpc
      ? { label: clusterName, rpc: opts.rpc }
      : resolveCluster(cfg, clusterName);
    const connection = connectionFor(cluster);
    const payer = loadOrCreateKeypair(opts.keypair);

    console.log(`[${cluster.label}] OpenBook market for mint ${opts.mint} (base)`);
    console.log(`[${cluster.label}] quote: WSOL, lotSize=${opts.lotSize}, tickSize=${opts.tickSize}`);

    if (opts.dryRun) {
      console.log(`[${cluster.label}] DRY-RUN — no transaction sent.`);
      return;
    }
    const balance = await connection.getBalance(payer.publicKey);
    if (balance / 1e9 < 0.02) {
      console.error(`[${cluster.label}] ERROR: wallet ${payer.publicKey.toBase58()} has only ${(balance / 1e9).toFixed(4)} SOL. Fund it, then re-run.`);
      process.exit(1);
    }
    const { marketId } = await createOpenBookMarket({
      connection,
      payer,
      clusterName,
      baseMint: opts.mint,
      baseDecimals: Number(opts.decimals),
      lotSize: Number(opts.lotSize),
      tickSize: Number(opts.tickSize),
    });
    console.log(`[${cluster.label}] SAVE THIS MARKET ID for the pool step: ${marketId}`);
  });

program
  .command('pool')
  .description('create a Raydium AMM v4 liquidity pool (SOL/BUNK) on an existing market')
  .requiredOption('--mint <mint>', 'token mint address (base)')
  .requiredOption('--market <market>', 'OpenBook market id (run pool-market first)')
  .requiredOption('--sol <sol>', 'SOL liquidity to deposit')
  .requiredOption('--tokens <tokens>', 'BUNK liquidity to deposit')
  .option('--decimals <decimals>', 'token decimals', '6')
  .option('--cluster <cluster>', 'cluster name from config.json')
  .option('--rpc <rpc>', 'override RPC URL')
  .option('--keypair <keypair>', 'path to keypair JSON')
  .option('--dry-run', 'print the plan without sending anything')
  .action(async (opts) => {
    const cfg = loadConfig();
    const clusterName = opts.cluster || cfg.activeCluster || 'mainnet-beta';
    const cluster = opts.rpc
      ? { label: clusterName, rpc: opts.rpc }
      : resolveCluster(cfg, clusterName);
    const connection = connectionFor(cluster);
    const payer = loadOrCreateKeypair(opts.keypair);

    const plan = poolPlan({
      mint: opts.mint,
      decimals: Number(opts.decimals),
      solAmount: Number(opts.sol),
      tokenAmount: Number(opts.tokens),
      marketId: opts.market,
      clusterName,
    });

    console.log(`[${cluster.label}] Raydium AMM v4 pool plan`);
    console.log(`[${cluster.label}] base:  ${plan.mint} (${plan.decimals} decimals)`);
    console.log(`[${cluster.label}] quote: ${plan.quoteMint} (WSOL)`);
    console.log(`[${cluster.label}] market: ${plan.marketId}`);
    console.log(`[${cluster.label}] program: ${plan.programId}`);
    console.log(`[${cluster.label}] SOL ${plan.solAmount} -> raw ${plan.quoteAmount} (1e9)`);
    console.log(`[${cluster.label}] BUNK ${plan.tokenAmount} -> raw ${plan.baseAmount} (1e${plan.decimals})`);
    console.log(`[${cluster.label}] initial BUNK price: ${plan.priceSol.toExponential(6)} SOL`);

    if (opts.dryRun) {
      console.log(`[${cluster.label}] DRY-RUN — no transaction sent.`);
      return;
    }
    const balance = await connection.getBalance(payer.publicKey);
    if (balance / 1e9 < 0.05) {
      console.error(`[${cluster.label}] ERROR: wallet ${payer.publicKey.toBase58()} has only ${(balance / 1e9).toFixed(4)} SOL (need >= 0.05 SOL + liquidity). Fund it, then re-run.`);
      process.exit(1);
    }
    await createAmmPool({
      connection,
      payer,
      clusterName,
      mint: opts.mint,
      decimals: Number(opts.decimals),
      solAmount: Number(opts.sol),
      tokenAmount: Number(opts.tokens),
      marketId: opts.market,
    });
  });

program.parse();