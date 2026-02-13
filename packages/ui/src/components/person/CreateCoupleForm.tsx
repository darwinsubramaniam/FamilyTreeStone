"use client";

import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { familyTreeConfig } from "@/config/contract";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { UserRole } from "@/types";

interface CreateCoupleFormProps {
  treeId: bigint;
  role: UserRole;
  onSuccess?: () => void;
}

export function CreateCoupleForm({ treeId, role, onSuccess }: CreateCoupleFormProps) {
  const [partner1Id, setPartner1Id] = useState("");
  const [partner2Id, setPartner2Id] = useState("");

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const isEditor = role === "editor";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditor) {
      writeContract({
        ...familyTreeConfig,
        functionName: "proposeCreateCouple",
        args: [treeId, BigInt(partner1Id), BigInt(partner2Id)],
      });
    } else {
      writeContract({
        ...familyTreeConfig,
        functionName: "createCouple",
        args: [treeId, BigInt(partner1Id), BigInt(partner2Id)],
      });
    }
  };

  useEffect(() => {
    if (isSuccess) onSuccess?.();
  }, [isSuccess, onSuccess]);

  if (isSuccess) {
    return <div className="text-green-400 text-sm py-2">{isEditor ? "Proposal created!" : "Couple created!"}</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isEditor && (
        <div className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
          As an editor, this will create a proposal that requires approvals.
        </div>
      )}
      <Input id="p1Id" label="Partner 1 Person ID" type="number" min="1" value={partner1Id} onChange={(e) => setPartner1Id(e.target.value)} required />
      <Input id="p2Id" label="Partner 2 Person ID" type="number" min="1" value={partner2Id} onChange={(e) => setPartner2Id(e.target.value)} required />
      <Button type="submit" loading={isPending || isConfirming} className="w-full">
        {isPending ? "Confirm in Wallet..." : isConfirming ? "Confirming..." : isEditor ? "Propose Create Couple" : "Create Couple"}
      </Button>
    </form>
  );
}
