"use client";

import { useState } from "react";
import { CrossTreeCoupleCard } from "./CrossTreeCoupleCard";
import { Spinner } from "@/components/ui/Spinner";
import type { CrossTreeCouple, UserRole } from "@/types";
import clsx from "clsx";

type FilterTab = "all" | "pending" | "approved";

interface CrossTreeCoupleListProps {
  couples: CrossTreeCouple[];
  currentTreeId: bigint;
  role: UserRole;
  isLoading: boolean;
}

export function CrossTreeCoupleList({
  couples,
  currentTreeId,
  role,
  isLoading,
}: CrossTreeCoupleListProps) {
  const [filter, setFilter] = useState<FilterTab>("all");

  const filtered = couples.filter((c) => {
    if (filter === "pending") return !c.approved;
    if (filter === "approved") return c.approved;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner size="lg" />
      </div>
    );
  }

  const tabs: { value: FilterTab; label: string }[] = [
    { value: "all", label: `All (${couples.length})` },
    { value: "pending", label: `Pending (${couples.filter((c) => !c.approved).length})` },
    { value: "approved", label: `Approved (${couples.filter((c) => c.approved).length})` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={clsx(
              "px-3 py-2 text-xs font-medium rounded-lg transition-colors",
              filter === tab.value
                ? "bg-pink-500/10 text-pink-400 border border-pink-500/20"
                : "text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">
          {couples.length === 0
            ? "No cross-tree couples yet."
            : "No couples match this filter."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((couple) => (
            <CrossTreeCoupleCard
              key={couple.id.toString()}
              couple={couple}
              currentTreeId={currentTreeId}
              role={role}
            />
          ))}
        </div>
      )}
    </div>
  );
}
