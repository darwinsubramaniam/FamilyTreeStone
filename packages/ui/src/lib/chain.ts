import { defineChain } from "viem";

export const polkadotHub = defineChain({
  id: 420420419,
  name: "Polkadot Hub",
  nativeCurrency: {
    name: "DOT",
    symbol: "DOT",
    decimals: 10,
  },
  rpcUrls: {
    default: {
      http: ["https://eth-rpc.polkadot.io/"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://blockscout.polkadot.io",
    },
  },
});

export const kusamaHub = defineChain({
  id: 420420418,
  name: "Kusama Hub",
  nativeCurrency: {
    name: "KSM",
    symbol: "KSM",
    decimals: 12,
  },
  rpcUrls: {
    default: {
      http: ["https://eth-rpc-kusama.polkadot.io/"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://blockscout-kusama.polkadot.io",
    },
  },
});

export const polkadotHubTestnet = defineChain({
  id: 420420417,
  name: "Polkadot Hub TestNet",
  nativeCurrency: {
    name: "PAS",
    symbol: "PAS",
    decimals: 10,
  },
  rpcUrls: {
    default: {
      http: ["https://services.polkadothub-rpc.com/testnet"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://blockscout-testnet.polkadot.io",
    },
  },
  testnet: true,
});
