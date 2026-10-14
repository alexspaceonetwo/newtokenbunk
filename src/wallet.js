import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata, fetchDigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi';

export async function listWalletMints({ connection, owner, cluster }) {
  const ownerPk = new PublicKey(owner);
  const results = [];

  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    const accounts = await connection.getParsedTokenAccountsByOwner(
      ownerPk,
      { programId }
    );
    for (const { pubkey, account } of accounts.value) {
      const info = account.data.parsed.info;
      const mint = info.mint;
      const amount = info.tokenAmount.uiAmountString;
      const decimals = info.tokenAmount.decimals;

      let name = null, symbol = null, uri = null;
      try {
        const umi = createUmi(connection.rpcEndpoint).use(mplTokenMetadata());
        const asset = await fetchDigitalAsset(umi, publicKey(mint));
        name = asset.metadata.name;
        symbol = asset.metadata.symbol;
        uri = asset.metadata.uri;
      } catch {
      }

      results.push({ mint, ata: pubkey.toBase58(), amount, decimals, name, symbol, uri });
    }
  }
  return results;
}