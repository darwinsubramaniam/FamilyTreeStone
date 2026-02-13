"use client";

import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { familyTreeConfig } from "@/config/contract";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import clsx from "clsx";

type AdoptMode = "regular" | "crossTree";

interface AdoptChildFormProps {
  treeId: bigint;
  defaultChildId?: string;
  onSuccess?: () => void;
}

export function AdoptChildForm({
  treeId,
  defaultChildId = "",
  onSuccess,
}: AdoptChildFormProps) {
  const [mode, setMode] = useState<AdoptMode>("regular");
  const [coupleId, setCoupleId] = useState("");
  const [crossCoupleId, setCrossCoupleId] = useState("");
  const [childId, setChildId] = useState(defaultChildId);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "regular") {
      writeContract({
        ...familyTreeConfig,
        functionName: "adoptChildToCouple",
        args: [treeId, BigInt(coupleId), BigInt(childId)],
      });
    } else {
      writeContract({
        ...familyTreeConfig,
        functionName: "adoptChildToCrossCouple",
        args: [BigInt(crossCoupleId), BigInt(childId)],
      });
    }
  };

  useEffect(() => {
    if (isSuccess) onSuccess?.();
  }, [isSuccess, onSuccess]);

  if (isSuccess) {
    return (
      <div className="text-green-400 text-sm py-2">
        Child adopted successfully!
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-1">
        {(["regular", "crossTree"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={clsx(
              "px-3 py-2 text-xs font-medium rounded-lg transition-colors",
              mode === m
                ? "bg-pink-500/10 text-pink-400 border border-pink-500/20"
                : "text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent"
            )}
          >
            {m === "regular" ? "Regular Couple" : "Cross-Tree Couple"}
          </button>
        ))}
      </div>

      {mode === "regular" ? (
        <Input
          id="coupleId"
          label="Couple ID"
          type="number"
          min="1"
          value={coupleId}
          onChange={(e) => setCoupleId(e.target.value)}
          required
        />
      ) : (
        <Input
          id="crossCoupleId"
          label="Cross-Tree Couple ID"
          type="number"
          min="1"
          value={crossCoupleId}
          onChange={(e) => setCrossCoupleId(e.target.value)}
          required
        />
      )}

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
          : mode === "regular"
          ? "Adopt to Couple"
          : "Adopt to Cross-Tree Couple"}
      </Button>
    </form>
  );
}
