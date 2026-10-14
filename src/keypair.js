// language: JavaScript (ESM), file: src/keypair.js
import { readFileSync, writeFileSync, existsSync, chmodSync, mkdirSync } from 'node:fs';
import { Keypair } from '@solana/web3.js';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const DEFAULT_PATH = join(homedir(), '.config', 'solana', 'id.json');

export function loadOrCreateKeypair(path = DEFAULT_PATH) {
  if (existsSync(path)) {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }
  const kp = Keypair.generate();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
  chmodSync(path, 0o600);
  return kp;
}

export async function loadKeypairFromEnv() {
  const b58 = process.env.SOLANA_KEYPAIR;
  if (!b58) return null;
  // dynamic import to avoid bs58 as hard dep at top level
  const bs58 = await import('bs58');
  return Keypair.fromSecretKey(bs58.decode(b58));
}