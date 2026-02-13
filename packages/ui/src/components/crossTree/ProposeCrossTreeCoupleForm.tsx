"use client";

import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { familyTreeConfig } from "@/config/contract";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface ProposeCrossTreeCoupleFormProps {
  treeId: bigint;
  onSuccess?: () => void;
}

export function ProposeCrossTreeCoupleForm({
  treeId,
  onSuccess,
}: ProposeCrossTreeCoupleFormProps) {
  const [tree2Id, setTree2Id] = useState("");
  const [partner1Id, setPartner1Id] = useState("");
  const [partner2Id, setPartner2Id] = useState("");

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    writeContract({
      ...familyTreeConfig,
      functionName: "proposeCrossTreeCouple",
      args: [treeId, BigInt(tree2Id), BigInt(partner1Id), BigInt(partner2Id)],
    });
  };

  useEffect(() => {
    if (isSuccess) onSuccess?.();
  }, [isSuccess, onSuccess]);

  if (isSuccess) {
    return (
      <div className="text-green-400 text-sm py-2">
        Cross-tree couple proposed! Waiting for approval from the other tree.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="partner1Id"
        label="Partner from this tree (Person ID)"
        type="number"
        min="1"
        value={partner1Id}
        onChange={(e) => setPartner1Id(e.target.value)}
        required
      />
      <Input
        id="tree2Id"
        label="Other Tree ID"
        type="number"
        min="1"
        value={tree2Id}
        onChange={(e) => setTree2Id(e.target.value)}
        required
      />
      <Input
        id="partner2Id"
        label="Partner from other tree (Person ID)"
        type="number"
        min="1"
        value={partner2Id}
        onChange={(e) => setPartner2Id(e.target.value)}
        required
      />
      <Button
        type="submit"
        loading={isPending || isConfirming}
        className="w-full"
      >
        {isPending
          ? "Confirm in Wallet..."
          : isConfirming
          ? "Confirming..."
          : "Propose Cross-Tree Couple"}
      </Button>
    </form>
  );
}
