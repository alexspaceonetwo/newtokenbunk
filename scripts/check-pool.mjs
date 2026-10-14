import * as pool from '../src/pool.js';
console.log('pool.js import OK; exports:', Object.keys(pool).join(', '));
const plan = pool.poolPlan({
  mint: 'BUNKMINTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  decimals: 6,
  solAmount: 10,
  tokenAmount: 1000000,
  marketId: 'MARKETIDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  clusterName: 'mainnet-beta',
});
console.log('plan.programId:', plan.programId);
console.log('plan.marketProgramId:', plan.marketProgramId);
console.log('plan.feeDestinationId:', plan.feeDestinationId);
console.log('plan.quoteMint:', plan.quoteMint);
console.log('plan.baseAmount:', plan.baseAmount.toString());
console.log('plan.quoteAmount:', plan.quoteAmount.toString());
console.log('plan.priceSol:', plan.priceSol);
