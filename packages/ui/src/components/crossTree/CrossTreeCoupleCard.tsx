"use client";

import { useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { familyTreeConfig } from "@/config/contract";
import { Button } from "@/components/ui/Button";
import type { CrossTreeCouple, UserRole } from "@/types";
import { useInvalidateTreeQueries } from "@/hooks/useInvalidateTreeQueries";
import clsx from "clsx";

interface CrossTreeCoupleCardProps {
  couple: CrossTreeCouple;
  currentTreeId: bigint;
  role: UserRole;
}

export function CrossTreeCoupleCard({
  couple,
  currentTreeId,
  role,
}: CrossTreeCoupleCardProps) {
  const canDirectEdit = role === "creator" || role === "admin";
  const invalidate = useInvalidateTreeQueries();

  // The current tree is the "other" side if the proposal came from the opposite tree
  const isOtherSide = couple.tree1Id !== currentTreeId;

  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: approvePending,
  } = useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approveSuccess } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  const {
    writeContract: writeCancel,
    data: cancelTxHash,
    isPending: cancelPending,
  } = useWriteContract();
  const { isLoading: cancelConfirming, isSuccess: cancelSuccess } =
    useWaitForTransactionReceipt({ hash: cancelTxHash });

  useEffect(() => {
    if (approveSuccess || cancelSuccess) invalidate();
  }, [approveSuccess, cancelSuccess, invalidate]);

  const handleApprove = () => {
    writeApprove({
      ...familyTreeConfig,
      functionName: "approveCrossTreeCouple",
      args: [couple.id],
    });
  };

  const handleCancel = () => {
    writeCancel({
      ...familyTreeConfig,
      functionName: "cancelCrossTreeCouple",
      args: [couple.id],
    });
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-gray-500">
          Cross-Couple #{couple.id.toString()}
        </span>
        <span
          className={clsx(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            couple.approved
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
          )}
        >
          {couple.approved ? "Approved" : "Pending"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500 text-xs">Tree 1</p>
          <p className="text-gray-200">
            #{couple.tree1Id.toString()} &mdash; Person #{couple.partner1Id.toString()}
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Tree 2</p>
          <p className="text-gray-200">
            #{couple.tree2Id.toString()} &mdash; Person #{couple.partner2Id.toString()}
          </p>
        </div>
      </div>

      {couple.childrenIds.length > 0 && (
        <div className="text-sm">
          <p className="text-gray-500 text-xs">Children</p>
          <p className="text-gray-200">
            {couple.childrenIds.map((id) => `#${id.toString()}`).join(", ")}
          </p>
        </div>
      )}

      {approveSuccess && (
        <div className="text-green-400 text-xs">Approved successfully!</div>
      )}
      {cancelSuccess && (
        <div className="text-green-400 text-xs">Cancelled successfully!</div>
      )}

      {canDirectEdit && !couple.approved && !approveSuccess && !cancelSuccess && (
        <div className="flex gap-2 pt-1">
          {isOtherSide && (
            <Button
              size="sm"
              onClick={handleApprove}
              loading={approvePending || approveConfirming}
            >
              {approvePending
                ? "Confirm..."
                : approveConfirming
                ? "Confirming..."
                : "Approve"}
            </Button>
          )}
          <Button
            size="sm"
            variant="danger"
            onClick={handleCancel}
            loading={cancelPending || cancelConfirming}
          >
            {cancelPending
              ? "Confirm..."
              : cancelConfirming
              ? "Confirming..."
              : "Cancel"}
          </Button>
        </div>
      )}
    </div>
  );
}
