"use client";

import Link from "next/link";
import { useRecentTrees } from "@/hooks/useRecentTrees";
import { formatDistanceToNow } from "date-fns";

export function RecentTreesList() {
  const { trees, removeTree } = useRecentTrees();

  if (trees.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No recently viewed trees. Look up a tree ID above to get started.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {trees.map((tree) => (
        <li
          key={tree.id}
          className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-4 py-3"
        >
          <Link
            href={`/tree/${tree.id}`}
            className="flex-1 hover:text-pink-400 transition-colors"
          >
            <span className="font-medium">{tree.name}</span>
            <span className="text-gray-500 text-sm ml-2">#{tree.id}</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(tree.visitedAt, { addSuffix: true })}
            </span>
            <button
              onClick={() => removeTree(tree.id)}
              className="text-gray-600 hover:text-red-400 transition-colors text-sm"
            >
              Remove
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
