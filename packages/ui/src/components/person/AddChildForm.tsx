"use client";

import { useState, useEffect, useMemo } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useReadContracts } from "wagmi";
import { familyTreeConfig } from "@/config/contract";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useTreeData } from "@/hooks/useTreeData";
import type { UserRole, Person } from "@/types";

interface AddChildFormProps {
  treeId: bigint;
  role: UserRole;
  defaultCoupleId?: string;
  onSuccess?: () => void;
}

// Dropdown values use prefixes to distinguish couple types:
//   "c-{id}"  → regular couple
//   "xc-{id}" → cross-tree couple
function parseCoupleValue(value: string): { isCross: boolean; id: bigint } | null {
  if (!value) return null;
  if (value.startsWith("xc-")) return { isCross: true, id: BigInt(value.slice(3)) };
  if (value.startsWith("c-")) return { isCross: false, id: BigInt(value.slice(2)) };
  return null;
}

export function AddChildForm({ treeId, role, defaultCoupleId = "", onSuccess }: AddChildFormProps) {
  const [coupleValue, setCoupleValue] = useState(defaultCoupleId);
  const [childId, setChildId] = useState("");

  const { persons: couplePersons, couples, crossCouples, isLoading: treeDataLoading } = useTreeData(treeId);

  // Clear child selection when couple changes (partner may now be excluded)
  const handleCoupleChange = (value: string) => {
    setCoupleValue(value);
    const parsed = parseCoupleValue(value);
    if (parsed && childId) {
      if (!parsed.isCross) {
        const couple = couples.get(parsed.id);
        if (couple && (childId === couple.partner1Id.toString() || childId === couple.partner2Id.toString())) {
          setChildId("");
        }
      } else {
        const xc = crossCouples.find((c) => c.id === parsed.id);
        if (xc && (childId === xc.partner1Id.toString() || childId === xc.partner2Id.toString())) {
          setChildId("");
        }
      }
    }
  };

  // Fetch ALL person IDs in the tree (not just those in couples)
  const { data: treePersonsResult, isLoading: treePersonsLoading } = useReadContract({
    ...familyTreeConfig,
    functionName: "getTreePersons",
    args: [treeId, 0n, 1000n],
  });

  const allPersonIds = useMemo(() => {
    if (!treePersonsResult) return [];
    const [personIds] = treePersonsResult as [readonly bigint[], bigint];
    return personIds;
  }, [treePersonsResult]);

  // Batch fetch person details for IDs not already in couplePersons
  const missingPersonContracts = useMemo(() => {
    const missing = allPersonIds.filter((id) => !couplePersons.has(id));
    if (missing.length === 0) return undefined;
    return missing.map((id) => ({
      ...familyTreeConfig,
      functionName: "getPerson" as const,
      args: [id] as const,
    }));
  }, [allPersonIds, couplePersons]);

  const { data: missingPersonsData, isLoading: missingPersonsLoading } = useReadContracts({
    contracts: missingPersonContracts,
    query: { enabled: !!missingPersonContracts && missingPersonContracts.length > 0 },
  });

  // Merge all persons: couple-derived + standalone
  const allPersons = useMemo(() => {
    const merged = new Map(couplePersons);
    if (missingPersonsData && missingPersonContracts) {
      const missingIds = allPersonIds.filter((id) => !couplePersons.has(id));
      missingPersonsData.forEach((p, i) => {
        if (p.status === "success" && p.result) {
          const person = p.result as unknown as Person;
          merged.set(missingIds[i], person);
        }
      });
    }
    return merged;
  }, [couplePersons, missingPersonsData, missingPersonContracts, allPersonIds]);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const isEditor = role === "editor";
  const parsed = parseCoupleValue(coupleValue);
  const isCrossSelected = parsed?.isCross ?? false;

  // Build couple dropdown options (regular + cross-tree)
  const coupleOptions = useMemo(() => {
    const opts: { value: string; label: string; description?: string }[] = [];

    for (const [id, couple] of couples) {
      const p1 = allPersons.get(couple.partner1Id);
      const p2 = allPersons.get(couple.partner2Id);
      const name1 = p1?.name ?? `#${couple.partner1Id}`;
      const name2 = p2?.name ?? `#${couple.partner2Id}`;
      opts.push({
        value: `c-${id.toString()}`,
        label: `${name1} & ${name2}`,
        description: `Couple #${id}`,
      });
    }

    for (const xc of crossCouples) {
      const p1 = allPersons.get(xc.partner1Id);
      const p2 = allPersons.get(xc.partner2Id);
      const name1 = p1?.name ?? `#${xc.partner1Id}`;
      const name2 = p2?.name ?? `#${xc.partner2Id}`;
      opts.push({
        value: `xc-${xc.id.toString()}`,
        label: `${name1} & ${name2}`,
        description: `Cross-Couple #${xc.id} (Trees #${xc.tree1Id} & #${xc.tree2Id})`,
      });
    }

    return opts;
  }, [couples, crossCouples, allPersons]);

  // Exclude the selected couple's partners from child candidates
  const personOptions = useMemo(() => {
    const excludeIds = new Set<bigint>();
    if (parsed) {
      if (!parsed.isCross) {
        const couple = couples.get(parsed.id);
        if (couple) {
          excludeIds.add(couple.partner1Id);
          excludeIds.add(couple.partner2Id);
        }
      } else {
        const xc = crossCouples.find((c) => c.id === parsed.id);
        if (xc) {
          excludeIds.add(xc.partner1Id);
          excludeIds.add(xc.partner2Id);
        }
      }
    }
    const opts: { value: string; label: string; description?: string }[] = [];
    for (const [id, person] of allPersons) {
      if (excludeIds.has(id)) continue;
      opts.push({
        value: id.toString(),
        label: person.name,
        description: `#${id}`,
      });
    }
    return opts;
  }, [allPersons, parsed, couples, crossCouples]);

  const isLoadingData = treeDataLoading || treePersonsLoading || missingPersonsLoading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed) return;

    if (parsed.isCross) {
      // Cross-tree couples: direct call only (no editor proposal path)
      writeContract({
        ...familyTreeConfig,
        functionName: "addChildToCrossCouple",
        args: [parsed.id, BigInt(childId)],
      });
    } else if (isEditor) {
      writeContract({
        ...familyTreeConfig,
        functionName: "proposeAddChildToCouple",
        args: [treeId, parsed.id, BigInt(childId)],
      });
    } else {
      writeContract({
        ...familyTreeConfig,
        functionName: "addChildToCouple",
        args: [treeId, parsed.id, BigInt(childId)],
      });
    }
  };

  useEffect(() => {
    if (isSuccess) onSuccess?.();
  }, [isSuccess, onSuccess]);

  if (isSuccess) {
    return <div className="text-green-400 text-sm py-2">{isCrossSelected ? "Child added to cross-couple!" : isEditor ? "Proposal created!" : "Child added!"}</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isEditor && !isCrossSelected && (
        <div className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
          As an editor, this will create a proposal that requires approvals.
        </div>
      )}
      {isCrossSelected && isEditor && (
        <div className="text-xs text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded-lg px-3 py-2">
          Cross-tree couples require creator/admin role. Editors cannot propose for cross-tree couples.
        </div>
      )}
      <SearchableSelect
        label="Couple"
        placeholder="Search couples..."
        options={coupleOptions}
        value={coupleValue}
        onChange={handleCoupleChange}
        isLoading={isLoadingData}
        required
      />
      <SearchableSelect
        label="Child"
        placeholder="Search persons..."
        options={personOptions}
        value={childId}
        onChange={setChildId}
        isLoading={isLoadingData}
        required
      />
      <Button
        type="submit"
        loading={isPending || isConfirming}
        disabled={isCrossSelected && isEditor}
        className="w-full"
      >
        {isPending
          ? "Confirm in Wallet..."
          : isConfirming
            ? "Confirming..."
            : isCrossSelected
              ? "Add Child to Cross-Couple"
              : isEditor
                ? "Propose Add Child"
                : "Add Child to Couple"}
      </Button>
    </form>
  );
}
