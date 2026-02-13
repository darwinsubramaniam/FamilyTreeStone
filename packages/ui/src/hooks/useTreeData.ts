"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { familyTreeConfig } from "@/config/contract";
import type { Tree, Person, CoupleNode, CrossTreeCouple, TreeHierarchyNode } from "@/types";
import { useMemo } from "react";

export function useTreeData(treeId: bigint | undefined) {
  // Step 1: Get tree info
  const {
    data: tree,
    isLoading: treeLoading,
    error: treeError,
  } = useReadContract({
    ...familyTreeConfig,
    functionName: "getTree",
    args: treeId !== undefined ? [treeId] : undefined,
    query: { enabled: treeId !== undefined },
  });

  // Step 2: Get all couple IDs for this tree
  const {
    data: coupleIds,
    isLoading: couplesLoading,
  } = useReadContract({
    ...familyTreeConfig,
    functionName: "getTreeCouples",
    args: treeId !== undefined ? [treeId] : undefined,
    query: { enabled: treeId !== undefined && !!tree && (tree as Tree).exists },
  });

  // Step 2b: Get cross-tree couple IDs for this tree
  const {
    data: crossCoupleIds,
    isLoading: crossIdsLoading,
  } = useReadContract({
    ...familyTreeConfig,
    functionName: "getTreeCrossCouples",
    args: treeId !== undefined ? [treeId] : undefined,
    query: { enabled: treeId !== undefined && !!tree && (tree as Tree).exists },
  });

  // Step 3: Batch fetch all regular couples
  const coupleContracts = useMemo(() => {
    if (!coupleIds) return undefined;
    return (coupleIds as readonly bigint[]).map((id) => ({
      ...familyTreeConfig,
      functionName: "getCouple" as const,
      args: [id] as const,
    }));
  }, [coupleIds]);

  const { data: couplesData, isLoading: coupleDetailsLoading } =
    useReadContracts({
      contracts: coupleContracts,
      query: { enabled: !!coupleContracts && coupleContracts.length > 0 },
    });

  // Step 3b: Batch fetch all cross-tree couples
  const crossCoupleContracts = useMemo(() => {
    if (!crossCoupleIds) return undefined;
    return (crossCoupleIds as readonly bigint[]).map((id) => ({
      ...familyTreeConfig,
      functionName: "getCrossTreeCouple" as const,
      args: [id] as const,
    }));
  }, [crossCoupleIds]);

  const { data: crossCouplesData, isLoading: crossCoupleDetailsLoading } =
    useReadContracts({
      contracts: crossCoupleContracts,
      query: { enabled: !!crossCoupleContracts && crossCoupleContracts.length > 0 },
    });

  // Step 4: Collect all unique person IDs (from regular + cross-tree couples) and batch fetch
  const personIds = useMemo(() => {
    const ids = new Set<bigint>();

    if (couplesData) {
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
    }

    if (crossCouplesData) {
      for (const c of crossCouplesData) {
        if (c.status === "success" && c.result) {
          const xc = c.result as unknown as CrossTreeCouple;
          if (xc.approved) {
            ids.add(xc.partner1Id);
            ids.add(xc.partner2Id);
            for (const childId of xc.childrenIds) {
              ids.add(childId);
            }
          }
        }
      }
    }

    return Array.from(ids);
  }, [couplesData, crossCouplesData]);

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
    query: { enabled: !!personContracts && personContracts.length > 0 },
  });

  // Build maps and hierarchy
  const { persons, couples, crossCouples, hierarchy } = useMemo(() => {
    const personMap = new Map<bigint, Person>();
    const coupleMap = new Map<bigint, CoupleNode>();
    const crossCoupleList: CrossTreeCouple[] = [];

    if (personsData) {
      personsData.forEach((p, i) => {
        if (p.status === "success" && p.result) {
          const person = p.result as unknown as Person;
          personMap.set(personIds[i], person);
        }
      });
    }

    if (couplesData) {
      couplesData.forEach((c) => {
        if (c.status === "success" && c.result) {
          const couple = c.result as unknown as CoupleNode;
          coupleMap.set(couple.id, couple);
        }
      });
    }

    if (crossCouplesData) {
      crossCouplesData.forEach((c) => {
        if (c.status === "success" && c.result) {
          const xc = c.result as unknown as CrossTreeCouple;
          if (xc.approved) {
            crossCoupleList.push(xc);
          }
        }
      });
    }

    // Build hierarchy starting from root couple
    let hierarchyRoot: TreeHierarchyNode | null = null;
    const treeInfo = tree as Tree | undefined;

    if (treeInfo?.exists && coupleMap.size > 0) {
      // Track which persons are partnered in a regular couple
      const personToCoupleMap = new Map<bigint, bigint>();
      for (const [coupleId, couple] of coupleMap) {
        personToCoupleMap.set(couple.partner1Id, coupleId);
        personToCoupleMap.set(couple.partner2Id, coupleId);
      }

      // Track which persons (belonging to THIS tree) have a cross-tree couple
      // Key: personId from this tree → CrossTreeCouple
      const personToCrossCoupleMap = new Map<bigint, CrossTreeCouple>();
      for (const xc of crossCoupleList) {
        // Determine which partner belongs to this tree
        if (xc.tree1Id === treeId) {
          personToCrossCoupleMap.set(xc.partner1Id, xc);
        } else if (xc.tree2Id === treeId) {
          personToCrossCoupleMap.set(xc.partner2Id, xc);
        }
      }

      const visited = new Set<string>();

      const buildNode = (coupleId: bigint): TreeHierarchyNode | null => {
        const couple = coupleMap.get(coupleId);
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
          } else {
            // Check if child has a cross-tree couple
            const crossCouple = personToCrossCoupleMap.get(childId);
            const crossKey = crossCouple ? `xc-${crossCouple.id}` : null;

            if (crossCouple && crossKey && !visited.has(crossKey)) {
              visited.add(crossKey);
              const localPerson = personMap.get(childId);
              // Determine the foreign partner
              const foreignId = crossCouple.tree1Id === treeId
                ? crossCouple.partner2Id
                : crossCouple.partner1Id;
              const foreignPerson = personMap.get(foreignId);

              if (localPerson && foreignPerson) {
                // Build cross-tree couple children
                const xcChildren: TreeHierarchyNode[] = [];
                for (const xcChildId of crossCouple.childrenIds) {
                  const xcChildCoupleId = personToCoupleMap.get(xcChildId);
                  if (xcChildCoupleId) {
                    const xcChildNode = buildNode(xcChildCoupleId);
                    if (xcChildNode) xcChildren.push(xcChildNode);
                  } else {
                    const xcChildPerson = personMap.get(xcChildId);
                    if (xcChildPerson) {
                      xcChildren.push({
                        type: "person",
                        person: xcChildPerson,
                        children: [],
                      });
                    }
                  }
                }

                children.push({
                  type: "couple",
                  coupleId: crossCouple.id,
                  partner1: localPerson,
                  partner2: foreignPerson,
                  children: xcChildren,
                  crossTree: true,
                });
              }
            } else if (!crossCouple || (crossKey && visited.has(crossKey))) {
              // Single child (no couple, or cross-couple already rendered)
              if (!childCoupleId) {
                const childPerson = personMap.get(childId);
                if (childPerson) {
                  children.push({
                    type: "person",
                    person: childPerson,
                    children: [],
                  });
                }
              }
            }
          }
        }

        return {
          type: "couple",
          coupleId,
          partner1,
          partner2,
          children,
        };
      };

      hierarchyRoot = buildNode(treeInfo.rootCoupleId);
    }

    return {
      persons: personMap,
      couples: coupleMap,
      crossCouples: crossCoupleList,
      hierarchy: hierarchyRoot,
    };
  }, [tree, treeId, couplesData, crossCouplesData, personsData, personIds]);

  const isLoading =
    treeLoading || couplesLoading || crossIdsLoading ||
    coupleDetailsLoading || crossCoupleDetailsLoading || personsLoading;

  return {
    tree: tree as Tree | undefined,
    persons,
    couples,
    crossCouples,
    hierarchy,
    coupleIds: (coupleIds as readonly bigint[] | undefined) ?? [],
    isLoading,
    error: treeError,
  };
}
