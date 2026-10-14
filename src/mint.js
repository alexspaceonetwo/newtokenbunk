import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  setAuthority,
  AuthorityType,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Keypair } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createV1,
  mplTokenMetadata,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import { percentAmount, publicKey } from '@metaplex-foundation/umi';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export async function mint({
  connection,
  payer,
  owner,
  name,
  symbol,
  decimals = 6,
  supply = 1_000_000n,
  clusterName = 'mainnet-beta',
  templatePath = 'templates/metadata.json',
}) {
  const raw = JSON.parse(readFileSync(templatePath, 'utf8'));
  const meta = JSON.parse(
    JSON.stringify(raw)
      .replaceAll('{NAME}', name)
      .replaceAll('{SYMBOL}', symbol)
      .replaceAll('{CLUSTER}', clusterName)
  );

  // Persist the rendered off-chain metadata JSON so it can be hosted
  // (IPFS/Arweave/any web server) and the URI below can point at it.
  mkdirSync('dist', { recursive: true });
  const metadataFile = join('dist', `${symbol}.metadata.json`);
  writeFileSync(metadataFile, JSON.stringify(meta, null, 2));

  const mint = await createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    decimals,
    Keypair.generate(),
    { commitment: 'confirmed' },
    TOKEN_PROGRAM_ID
  );

  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    owner,
    false
  );

  await mintTo(
    connection,
    payer,
    mint,
    ata.address,
    payer,
    BigInt(supply) * (10n ** BigInt(decimals))
  );

  const umi = createUmi(connection.rpcEndpoint).use(mplTokenMetadata());
  const umiPayer = umi.eddsa.createKeypairFromSecretKey(payer.secretKey);
  umi.use({
    install(umi) {
      umi.identity = umiPayer;
      umi.payer = umiPayer;
    },
  });

  await createV1(umi, {
    mint: publicKey(mint.toBase58()),
    authority: umiPayer,
    name: meta.name,
    symbol: meta.symbol,
    uri: meta.uri || 'https://example.com/token-metadata.json',
    sellerFeeBasisPoints: percentAmount(0),
    decimals,
    tokenStandard: TokenStandard.Fungible,
    isMutable: true,
  }).sendAndConfirm(umi);

  await setAuthority(
    connection,
    payer,
    mint,
    payer,
    AuthorityType.MintTokens,
    null
  );

  return {
    mint: mint.toBase58(),
    ata: ata.address.toBase58(),
    supply: supply.toString(),
    decimals,
    metadata: meta,
    metadataFile,
  };
}