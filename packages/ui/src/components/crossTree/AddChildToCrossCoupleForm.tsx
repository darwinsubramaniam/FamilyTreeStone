"use client";

import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { familyTreeConfig } from "@/config/contract";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface AddChildToCrossCoupleFormProps {
  onSuccess?: () => void;
}

export function AddChildToCrossCoupleForm({
  onSuccess,
}: AddChildToCrossCoupleFormProps) {
  const [crossCoupleId, setCrossCoupleId] = useState("");
  const [childId, setChildId] = useState("");

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    writeContract({
      ...familyTreeConfig,
      functionName: "addChildToCrossCouple",
      args: [BigInt(crossCoupleId), BigInt(childId)],
    });
  };

  useEffect(() => {
    if (isSuccess) onSuccess?.();
  }, [isSuccess, onSuccess]);

  if (isSuccess) {
    return (
      <div className="text-green-400 text-sm py-2">
        Child added to cross-tree couple!
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="crossCoupleId"
        label="Cross-Tree Couple ID"
        type="number"
        min="1"
        value={crossCoupleId}
        onChange={(e) => setCrossCoupleId(e.target.value)}
        required
      />
      <Input
        id="childId"
        label="Child Person ID"
        type="number"
        min="1"
        value={childId}
        onChange={(e) => setChildId(e.target.value)}
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
          : "Add Child to Cross-Tree Couple"}
      </Button>
    </form>
  );
}
