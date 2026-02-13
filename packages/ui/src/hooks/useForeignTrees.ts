"use client";

import { useReadContracts } from "wagmi";
import { familyTreeConfig } from "@/config/contract";
import type { Tree, Person, CoupleNode, TreeHierarchyNode } from "@/types";
import { useMemo } from "react";

/**
 * Fetches full tree data (couples, persons, hierarchy) for multiple foreign
 * trees. Used to power the "explode" view for cross-tree couples.
 */
export function useForeignTrees(foreignTreeIds: bigint[]) {
  const uniqueIds = useMemo(() => {
    const seen = new Set<bigint>();
    return foreignTreeIds.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [foreignTreeIds]);

  // Step 1: Batch fetch tree info
  const treeContracts = useMemo(() => {
    if (uniqueIds.length === 0) return undefined;
    return uniqueIds.map((id) => ({
      ...familyTreeConfig,
      functionName: "getTree" as const,
      args: [id] as const,
    }));
  }, [uniqueIds]);

  const { data: treesData, isLoading: treesLoading } = useReadContracts({
    contracts: treeContracts,
    query: { enabled: !!treeContracts },
  });

  // Step 2: Batch fetch couple IDs for all trees
  const coupleIdContracts = useMemo(() => {
    if (uniqueIds.length === 0) return undefined;
    return uniqueIds.map((id) => ({
      ...familyTreeConfig,
      functionName: "getTreeCouples" as const,
      args: [id] as const,
    }));
  }, [uniqueIds]);

  const { data: coupleIdsData, isLoading: coupleIdsLoading } = useReadContracts({
    contracts: coupleIdContracts,
    query: { enabled: !!coupleIdContracts },
  });

  // Step 3: Flatten all couple IDs and batch fetch couple details
  const allCoupleIds = useMemo(() => {
    if (!coupleIdsData) return [];
    const ids: bigint[] = [];
    for (const result of coupleIdsData) {
      if (result.status === "success" && result.result) {
        ids.push(...(result.result as readonly bigint[]));
      }
    }
    return ids;
  }, [coupleIdsData]);

  const coupleContracts = useMemo(() => {
    if (allCoupleIds.length === 0) return undefined;
    return allCoupleIds.map((id) => ({
      ...familyTreeConfig,
      functionName: "getCouple" as const,
      args: [id] as const,
    }));
  }, [allCoupleIds]);

  const { data: couplesData, isLoading: couplesLoading } = useReadContracts({
    contracts: coupleContracts,
    query: { enabled: !!coupleContracts },
  });

  // Step 4: Collect all person IDs and batch fetch
  const personIds = useMemo(() => {
    if (!couplesData) return [];
    const ids = new Set<bigint>();
    for (const c of couplesData) {
      if (c.status === "success" && c.result) {
        const couple = c.result as unknown as CoupleNode;
        ids.add(couple.partner1Id);
        ids.add(couple.partner2Id);
        for (const childId of couple.childrenIds) {
          ids.add(childId);
        }
      }
    }
    return Array.from(ids);
  }, [couplesData]);

  const personContracts = useMemo(() => {
    if (personIds.length === 0) return undefined;
    return personIds.map((id) => ({
      ...familyTreeConfig,
      functionName: "getPerson" as const,
      args: [id] as const,
    }));
  }, [personIds]);

  const { data: personsData, isLoading: personsLoading } = useReadContracts({
    contracts: personContracts,
    query: { enabled: !!personContracts },
  });

  // Build hierarchy per foreign tree
  const foreignTrees = useMemo(() => {
    const result = new Map<bigint, TreeHierarchyNode | null>();

    if (!treesData || !coupleIdsData || !couplesData || !personsData) return result;

    // Global person map (person IDs are globally unique)
    const personMap = new Map<bigint, Person>();
    personsData.forEach((p, i) => {
      if (p.status === "success" && p.result) {
        personMap.set(personIds[i], p.result as unknown as Person);
      }
    });

    // Global couple map (couple IDs are globally unique)
    const coupleMap = new Map<bigint, CoupleNode>();
    couplesData.forEach((c) => {
      if (c.status === "success" && c.result) {
        const couple = c.result as unknown as CoupleNode;
        coupleMap.set(couple.id, couple);
      }
    });

    // For each tree, build its hierarchy
    uniqueIds.forEach((treeId, i) => {
      const treeResult = treesData[i];
      if (treeResult?.status !== "success" || !treeResult.result) return;
      const tree = treeResult.result as unknown as Tree;
      if (!tree.exists) return;

      const coupleIdsResult = coupleIdsData[i];
      if (coupleIdsResult?.status !== "success" || !coupleIdsResult.result) return;
      const treeCoupleIds = coupleIdsResult.result as readonly bigint[];

      // Couples belonging to this tree
      const treeCouples = new Map<bigint, CoupleNode>();
      for (const cId of treeCoupleIds) {
        const couple = coupleMap.get(cId);
        if (couple) treeCouples.set(cId, couple);
      }

      // Person→couple lookup for this tree
      const personToCoupleMap = new Map<bigint, bigint>();
      for (const [coupleId, couple] of treeCouples) {
        personToCoupleMap.set(couple.partner1Id, coupleId);
        personToCoupleMap.set(couple.partner2Id, coupleId);
      }

      const buildNode = (coupleId: bigint): TreeHierarchyNode | null => {
        const couple = treeCouples.get(coupleId);
        if (!couple) return null;

        const partner1 = personMap.get(couple.partner1Id);
        const partner2 = personMap.get(couple.partner2Id);
        if (!partner1 || !partner2) return null;

        const children: TreeHierarchyNode[] = [];
        for (const childId of couple.childrenIds) {
          const childCoupleId = personToCoupleMap.get(childId);
          if (childCoupleId && childCoupleId !== coupleId) {
            const childNode = buildNode(childCoupleId);
            if (childNode) children.push(childNode);
          } else if (!childCoupleId) {
            const childPerson = personMap.get(childId);
            if (childPerson) {
              children.push({ type: "person", person: childPerson, children: [] });
            }
          }
        }

        return { type: "couple", coupleId, partner1, partner2, children };
      };

      result.set(treeId, buildNode(tree.rootCoupleId));
    });

    return result;
  }, [treesData, coupleIdsData, couplesData, personsData, personIds, uniqueIds]);

  const isLoading = treesLoading || coupleIdsLoading || couplesLoading || personsLoading;

  return { foreignTrees, isLoading };
}
