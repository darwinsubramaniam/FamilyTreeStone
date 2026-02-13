"use client";

import { useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { useReadContract } from "wagmi";
import { familyTreeConfig } from "@/config/contract";
import { Button } from "@/components/ui/Button";
import type { Proposal, UserRole } from "@/types";
import { ProposalStatus, PROPOSAL_TYPE_LABELS, PROPOSAL_STATUS_LABELS } from "@/types";
import { decodeProposalData } from "@/lib/proposal-decoder";
import { useInvalidateTreeQueries } from "@/hooks/useInvalidateTreeQueries";
import clsx from "clsx";

interface ProposalCardProps {
  proposal: Proposal;
  role: UserRole;
}

export function ProposalCard({ proposal, role }: ProposalCardProps) {
  const { address } = useAccount();
  const decoded = decodeProposalData(proposal.proposalType, proposal.data);
  const isPending = proposal.status === ProposalStatus.Pending;

  const { data: hasApprovedAlready } = useReadContract({
    ...familyTreeConfig,
    functionName: "hasApproved",
    args: address ? [proposal.id, address] : undefined,
    query: { enabled: !!address && isPending },
  });

  const invalidate = useInvalidateTreeQueries();

  const { writeContract: approve, data: approveTx, isPending: approvePending } = useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTx });

  const { writeContract: cancel, data: cancelTx, isPending: cancelPending } = useWriteContract();
  const { isLoading: cancelConfirming, isSuccess: cancelSuccess } = useWaitForTransactionReceipt({ hash: cancelTx });

  useEffect(() => {
    if (approveSuccess || cancelSuccess) invalidate();
  }, [approveSuccess, cancelSuccess, invalidate]);

  const canApprove = isPending && role !== "none" && !hasApprovedAlready;
  const canCancel = isPending && (role === "creator" || role === "admin" || proposal.proposer === address);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-500">#{proposal.id.toString()}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
              {PROPOSAL_TYPE_LABELS[proposal.proposalType]}
            </span>
          </div>
          <p className="text-sm font-medium text-white mt-1">{decoded.description}</p>
        </div>
        <span
          className={clsx(
            "text-xs px-2 py-0.5 rounded-full border",
            proposal.status === ProposalStatus.Pending && "bg-amber-500/10 text-amber-400 border-amber-500/20",
            proposal.status === ProposalStatus.Executed && "bg-green-500/10 text-green-400 border-green-500/20",
            proposal.status === ProposalStatus.Cancelled && "bg-red-500/10 text-red-400 border-red-500/20"
          )}
        >
          {PROPOSAL_STATUS_LABELS[proposal.status]}
        </span>
      </div>

      {/* Details */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {Object.entries(decoded.details).map(([key, value]) => (
          <div key={key}>
            <dt className="text-gray-500">{key}</dt>
            <dd className="text-gray-300 truncate">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Approvals: {proposal.approvalCount.toString()}</span>
        <span>
          Proposer: {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}
        </span>
      </div>

      {/* Actions */}
      {isPending && (
        <div className="flex gap-2 pt-2 border-t border-gray-800">
          {canApprove && (
            <Button
              size="sm"
              onClick={() => approve({ ...familyTreeConfig, functionName: "approveProposal", args: [proposal.id] })}
              loading={approvePending || approveConfirming}
            >
              {hasApprovedAlready ? "Already Approved" : "Approve"}
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => cancel({ ...familyTreeConfig, functionName: "cancelProposal", args: [proposal.id] })}
              loading={cancelPending || cancelConfirming}
            >
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
