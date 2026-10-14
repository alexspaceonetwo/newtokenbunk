import { readFileSync } from 'node:fs';
import { Connection } from '@solana/web3.js';

export function loadConfig(path = 'config.json') {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function resolveCluster(cfg, name) {
  const cluster = cfg.clusters[name];
  if (!cluster) throw new Error(`unknown cluster: ${name}`);
  return cluster;
}

export function connectionFor(cluster) {
  return new Connection(cluster.rpc, 'confirmed');
}
