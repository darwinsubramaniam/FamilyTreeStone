"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useChainId } from "wagmi";
import { FAMILY_TREE_ADDRESS } from "@/config/contract";
import { polkadotHub, kusamaHub, polkadotHubTestnet } from "@/lib/chain";

const EXPLORER_MAP: Record<number, string> = {
  [polkadotHubTestnet.id]: polkadotHubTestnet.blockExplorers.default.url,
  [polkadotHub.id]: polkadotHub.blockExplorers.default.url,
  [kusamaHub.id]: kusamaHub.blockExplorers.default.url,
};

function ContractBadge() {
  const chainId = useChainId();
  const explorerUrl = EXPLORER_MAP[chainId];
  const short = `${FAMILY_TREE_ADDRESS.slice(0, 6)}...${FAMILY_TREE_ADDRESS.slice(-4)}`;

  const inner = (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700 text-xs font-mono text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
      {short}
    </span>
  );

  if (explorerUrl) {
    return (
      <a
        href={`${explorerUrl}/address/${FAMILY_TREE_ADDRESS}`}
        target="_blank"
        rel="noopener noreferrer"
        title={`Contract: ${FAMILY_TREE_ADDRESS}`}
      >
        {inner}
      </a>
    );
  }

  return <span title={`Contract: ${FAMILY_TREE_ADDRESS}`}>{inner}</span>;
}

export function Header() {
  return (
    <header className="border-b border-white/10 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-white">
                FamilyTree<span className="text-pink-500">Stone</span>
              </span>
            </Link>
            <nav className="hidden sm:flex items-center gap-4">
              <Link
                href="/"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Home
              </Link>
              <Link
                href="/tree/create"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Create Tree
              </Link>
            </nav>
            <ContractBadge />
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
