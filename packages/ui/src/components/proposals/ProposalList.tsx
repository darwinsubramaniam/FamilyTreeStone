"use client";

import { useState } from "react";
import type { Proposal, UserRole } from "@/types";
import { ProposalStatus } from "@/types";
import { ProposalCard } from "./ProposalCard";
import clsx from "clsx";

interface ProposalListProps {
  proposals: Proposal[];
  role: UserRole;
  isLoading: boolean;
}

type FilterTab = "all" | "pending" | "executed" | "cancelled";

export function ProposalList({ proposals, role, isLoading }: ProposalListProps) {
  const [filter, setFilter] = useState<FilterTab>("all");

  const filtered = proposals.filter((p) => {
    if (filter === "all") return true;
    if (filter === "pending") return p.status === ProposalStatus.Pending;
    if (filter === "executed") return p.status === ProposalStatus.Executed;
    if (filter === "cancelled") return p.status === ProposalStatus.Cancelled;
    return true;
  });

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: `All (${proposals.length})` },
    { key: "pending", label: `Pending (${proposals.filter((p) => p.status === ProposalStatus.Pending).length})` },
    { key: "executed", label: `Executed (${proposals.filter((p) => p.status === ProposalStatus.Executed).length})` },
    { key: "cancelled", label: `Cancelled (${proposals.filter((p) => p.status === ProposalStatus.Cancelled).length})` },
  ];

  if (isLoading) {
    return <div className="text-gray-500 text-sm">Loading proposals...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={clsx(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              filter === tab.key
                ? "bg-pink-500/10 text-pink-400 border border-pink-500/20"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm">No proposals found.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <ProposalCard key={p.id.toString()} proposal={p} role={role} />
          ))}
        </div>
      )}
    </div>
  );
}
