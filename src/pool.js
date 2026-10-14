// language: JavaScript (ESM), file: src/pool.js
// Raydium v4 AMM liquidity-pool creation using @raydium-io/raydium-sdk-v2.
// Flow mirrors the official SDK demo: 1) create an OpenBook market,
// 2) create the AMM v4 pool against that market (SOL/WSOL quote).
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BN from 'bn.js';

// The SDK ships as CJS (lib/index.js); Node ESM named-import interop can be
// unreliable, so we import the default export and destructure from it.
import RaydiumSdk from '@raydium-io/raydium-sdk-v2';
const {
  Raydium,
  TxVersion,
  AMM_V4,
  OPEN_BOOK_PROGRAM,
  FEE_DESTINATION_ID,
  WSOLMint,
  DEVNET_PROGRAM_ID,
} = RaydiumSdk;

const WSOL_DECIMALS = 9;

export function clusterForRaydium(clusterName) {
  return clusterName === 'devnet' ? 'devnet' : 'mainnet';
}

async function initRaydium(connection, owner, clusterName) {
  const cluster = clusterForRaydium(clusterName);
  return Raydium.load({
    owner,
    connection,
    cluster,
    disableFeatureCheck: true,
    disableLoadToken: true,
    blockhashCommitment: 'finalized',
  });
}

export function poolPlan({
  mint,
  decimals = 6,
  solAmount,
  tokenAmount,
  marketId,
  clusterName,
}) {
  const cluster = clusterForRaydium(clusterName);
  const baseAmount = BigInt(tokenAmount) * (10n ** BigInt(decimals));
  const quoteAmount = BigInt(Math.round(solAmount * 1e9));
  const priceSol = solAmount / tokenAmount;
  return {
    clusterName,
    cluster,
    mint,
    decimals,
    solAmount,
    tokenAmount,
    marketId,
    baseAmount,
    quoteAmount,
    priceSol,
    programId: cluster === 'devnet' ? DEVNET_PROGRAM_ID.AMM_V4 : AMM_V4,
    marketProgramId:
      cluster === 'devnet' ? DEVNET_PROGRAM_ID.OPEN_BOOK_PROGRAM : OPEN_BOOK_PROGRAM,
    feeDestinationId:
      cluster === 'devnet' ? DEVNET_PROGRAM_ID.FEE_DESTINATION_ID : FEE_DESTINATION_ID,
    quoteMint: WSOLMint,
  };
}

// Step 1: create an OpenBook (serum) order-book market for the token.
export async function createOpenBookMarket({
  connection,
  payer,
  clusterName,
  baseMint,
  baseDecimals = 6,
  lotSize = 1,
  tickSize = 0.01,
}) {
  const cluster = clusterForRaydium(clusterName);
  const raydium = await initRaydium(connection, payer, clusterName);
  const dexProgramId =
    cluster === 'devnet' ? DEVNET_PROGRAM_ID.OPEN_BOOK_PROGRAM : OPEN_BOOK_PROGRAM;

  const { execute, extInfo, transactions } = await raydium.marketV2.create({
    baseInfo: { mint: new PublicKey(baseMint), decimals: baseDecimals },
    quoteInfo: { mint: WSOLMint, decimals: WSOL_DECIMALS },
    lotSize,
    tickSize,
    dexProgramId,
    txVersion: TxVersion.V0,
  });

  const marketId = extInfo.address.marketId.toBase58();
  console.log(`[${clusterName}] openbook market: ${marketId}`);
  console.log(`[${clusterName}] sending ${transactions.length} market tx(s)...`);
  const txIds = await execute({ sequentially: true });
  console.log(`[${clusterName}] market created, txs: ${txIds.join(', ')}`);
  return { marketId, txIds };
}

// Step 2: create the Raydium AMM v4 pool on top of an existing market.
export async function createAmmPool({
  connection,
  payer,
  clusterName,
  mint,
  decimals = 6,
  solAmount,
  tokenAmount,
  marketId,
}) {
  const cluster = clusterForRaydium(clusterName);
  const plan = poolPlan({ mint, decimals, solAmount, tokenAmount, marketId, clusterName });
  const raydium = await initRaydium(connection, payer, clusterName);

  if (solAmount < 4) {
    console.warn(
      `[${clusterName}] WARNING: < 4 SOL initial liquidity can fail on Raydium ` +
        `("lp amount is too less"). Prefer >= 4 SOL.`
    );
  }

  const { execute, extInfo } = await raydium.liquidity.createPoolV4({
    programId: plan.programId,
    marketInfo: {
      marketId: new PublicKey(marketId),
      programId: plan.marketProgramId,
    },
    baseMintInfo: { mint: new PublicKey(mint), decimals },
    quoteMintInfo: { mint: WSOLMint, decimals: WSOL_DECIMALS },
    baseAmount: new BN(plan.baseAmount.toString()),
    quoteAmount: new BN(plan.quoteAmount.toString()),
    startTime: new BN(0), // 0 = trading starts immediately
    ownerInfo: { useSOLBalance: true }, // SDK wraps SOL into WSOL automatically
    associatedOnly: false,
    txVersion: TxVersion.V0,
    feeDestinationId: plan.feeDestinationId,
  });

  const poolKeys = Object.keys(extInfo.address).reduce((acc, key) => {
    acc[key] = extInfo.address[key].toBase58();
    return acc;
  }, {});

  console.log(`[${clusterName}] building pool (BUNK=${mint}, market=${marketId})...`);
  const { txId } = await execute({ sendAndConfirm: true });
  console.log(`[${clusterName}] AMM pool created! pool id: ${poolKeys.ammId}`);
  console.log(`[${clusterName}] tx: ${txId}`);
  return { ...poolKeys, txId };
}

// Re-export for CLI convenience.
export { TOKEN_PROGRAM_ID };
