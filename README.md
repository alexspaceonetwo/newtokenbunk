spl-lab/
├── package.json
├── config.json                 # cluster registry — add your own devnets/testnets
├── src/
│   ├── cluster.js              # RPC + cluster resolution
│   ├── keypair.js              # load/save owner keypair
│   ├── mint.js                 # create mint + metadata + mint supply
│   ├── freeze.js               # freeze authority plumbing
│   ├── wallet.js               # list mints held by a wallet
│   └── cli.js                  # entrypoint
├── templates/
│   └── metadata.json           # name/symbol/description/uri template
└── README.md