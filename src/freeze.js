// language: JavaScript (ESM), file: src/freeze.js
import { getOrCreateAssociatedTokenAccount, freezeAccount, thawAccount } from '@solana/spl-token';

export async function setFrozen({ connection, payer, mint, owner, frozen }) {
  const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, owner, false);
  if (frozen) {
    await freezeAccount(connection, payer, ata.address, mint, payer);
  } else {
    await thawAccount(connection, payer, ata.address, mint, payer);
  }
  return ata.address.toBase58();
}