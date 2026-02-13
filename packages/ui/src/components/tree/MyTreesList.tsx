"use client";

import Link from "next/link";
import { useMyTrees } from "@/hooks/useMyTrees";
import { useAccount } from "wagmi";
import { Spinner } from "@/components/ui/Spinner";

export function MyTreesList() {
  const { isConnected } = useAccount();
  const { trees, isLoading } = useMyTrees();

  if (!isConnected) {
    return (
      <p className="text-sm text-gray-500">
        Connect your wallet to see your trees.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <Spinner size="sm" />
        <span className="text-sm">Loading your trees...</span>
      </div>
    );
  }

  if (trees.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        You haven&apos;t created any trees yet.{" "}
        <Link href="/tree/create" className="text-pink-400 hover:text-pink-300">
          Create one
        </Link>
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {trees.map((tree) => (
        <li key={tree.treeId.toString()}>
          <Link
            href={`/tree/${tree.treeId.toString()}`}
            className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 hover:border-pink-500/50 transition-colors"
          >
            <span className="font-medium">{tree.name}</span>
            <span className="text-gray-500 text-sm">
              #{tree.treeId.toString()}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
