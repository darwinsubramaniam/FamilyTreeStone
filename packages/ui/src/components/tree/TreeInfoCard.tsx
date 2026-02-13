"use client";

import type { Tree } from "@/types";
import { useUserRole } from "@/hooks/useUserRole";

interface TreeInfoCardProps {
  tree: Tree;
}

export function TreeInfoCard({ tree }: TreeInfoCardProps) {
  const { role } = useUserRole(tree.id);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{tree.name}</h2>
          <p className="text-sm text-gray-400 mt-1">Tree #{tree.id.toString()}</p>
        </div>
        {role !== "none" && (
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20 capitalize">
            {role}
          </span>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-gray-500">Creator</dt>
          <dd className="text-gray-300 font-mono text-xs mt-0.5">
            {tree.creator.slice(0, 6)}...{tree.creator.slice(-4)}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Approval Threshold</dt>
          <dd className="text-gray-300 mt-0.5">
            {tree.approvalThreshold.toString()}
          </dd>
        </div>
      </dl>
    </div>
  );
}
