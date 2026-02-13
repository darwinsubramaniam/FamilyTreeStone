"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { familyTreeConfig } from "@/config/contract";
import type { CrossTreeCouple } from "@/types";
import { useMemo } from "react";

export function useCrossTreeCouples(treeId: bigint | undefined) {
  // Step 1: Get cross-tree couple IDs for this tree
  const { data: crossCoupleIds, isLoading: idsLoading } = useReadContract({
    ...familyTreeConfig,
    functionName: "getTreeCrossCouples",
    args: treeId !== undefined ? [treeId] : undefined,
    query: { enabled: treeId !== undefined },
  });

  // Step 2: Batch fetch all cross-tree couples
  const coupleContracts = useMemo(() => {
    if (!crossCoupleIds) return undefined;
    return (crossCoupleIds as readonly bigint[]).map((id) => ({
      ...familyTreeConfig,
      functionName: "getCrossTreeCouple" as const,
      args: [id] as const,
    }));
  }, [crossCoupleIds]);

  const { data: couplesData, isLoading: couplesLoading } = useReadContracts({
    contracts: coupleContracts,
    query: { enabled: !!coupleContracts && coupleContracts.length > 0 },
  });

  const couples = useMemo(() => {
    if (!couplesData) return [];
    return couplesData
      .filter((c) => c.status === "success" && c.result)
      .map((c) => c.result as unknown as CrossTreeCouple);
  }, [couplesData]);

  return {
    couples,
    isLoading: idsLoading || couplesLoading,
  };
}
