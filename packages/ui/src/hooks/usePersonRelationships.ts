"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { familyTreeConfig } from "@/config/contract";
import type { CoupleNode, CrossTreeCouple } from "@/types";
import { useMemo } from "react";

export function usePersonRelationships(personId: bigint | undefined) {
  // Step 1: Get couple IDs
  const { data: coupleIds, isLoading: coupleIdsLoading } = useReadContract({
    ...familyTreeConfig,
    functionName: "getPersonCouples",
    args: personId !== undefined ? [personId] : undefined,
    query: { enabled: personId !== undefined },
  });

  // Step 2: Get cross-tree couple IDs
  const { data: crossCoupleIds, isLoading: crossIdsLoading } = useReadContract({
    ...familyTreeConfig,
    functionName: "getPersonCrossCouples",
    args: personId !== undefined ? [personId] : undefined,
    query: { enabled: personId !== undefined },
  });

  // Step 3: Batch fetch couples
  const coupleContracts = useMemo(() => {
    if (!coupleIds) return undefined;
    return (coupleIds as readonly bigint[]).map((id) => ({
      ...familyTreeConfig,
      functionName: "getCouple" as const,
      args: [id] as const,
    }));
  }, [coupleIds]);

  const { data: couplesData, isLoading: couplesLoading } = useReadContracts({
    contracts: coupleContracts,
    query: { enabled: !!coupleContracts && coupleContracts.length > 0 },
  });

  // Step 4: Batch fetch cross-tree couples
  const crossContracts = useMemo(() => {
    if (!crossCoupleIds) return undefined;
    return (crossCoupleIds as readonly bigint[]).map((id) => ({
      ...familyTreeConfig,
      functionName: "getCrossTreeCouple" as const,
      args: [id] as const,
    }));
  }, [crossCoupleIds]);

  const { data: crossData, isLoading: crossLoading } = useReadContracts({
    contracts: crossContracts,
    query: { enabled: !!crossContracts && crossContracts.length > 0 },
  });

  const couples = useMemo(() => {
    if (!couplesData) return [];
    return couplesData
      .filter((c) => c.status === "success" && c.result)
      .map((c) => c.result as unknown as CoupleNode);
  }, [couplesData]);

  const crossCouples = useMemo(() => {
    if (!crossData) return [];
    return crossData
      .filter((c) => c.status === "success" && c.result)
      .map((c) => c.result as unknown as CrossTreeCouple);
  }, [crossData]);

  return {
    couples,
    crossCouples,
    isLoading: coupleIdsLoading || crossIdsLoading || couplesLoading || crossLoading,
  };
}
