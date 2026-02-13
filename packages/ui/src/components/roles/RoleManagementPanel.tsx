"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useReadContracts } from "wagmi";
import { familyTreeConfig } from "@/config/contract";
import { CREATOR_ROLE, ADMIN_ROLE, EDITOR_ROLE } from "@/config/constants";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { UserRole } from "@/types";

interface RoleManagementPanelProps {
  treeId: bigint;
  role: UserRole;
  threshold: bigint;
}

type RoleAction = "grantAdmin" | "revokeAdmin" | "grantEditor" | "revokeEditor";

const ACTION_OPTIONS: { value: RoleAction; label: string }[] = [
  { value: "grantAdmin", label: "Grant Admin" },
  { value: "revokeAdmin", label: "Revoke Admin" },
  { value: "grantEditor", label: "Grant Editor" },
  { value: "revokeEditor", label: "Revoke Editor" },
];

export function RoleManagementPanel({ treeId, role, threshold }: RoleManagementPanelProps) {
  const [action, setAction] = useState<RoleAction>("grantAdmin");
  const [address, setAddress] = useState("");
  const [newThreshold, setNewThreshold] = useState(threshold.toString());

  const { writeContract: writeRole, data: roleTxHash, isPending: rolePending } = useWriteContract();
  const { isLoading: roleConfirming, isSuccess: roleSuccess } = useWaitForTransactionReceipt({ hash: roleTxHash });

  const { writeContract: writeThreshold, data: thresholdTxHash, isPending: thresholdPending } = useWriteContract();
  const { isLoading: thresholdConfirming, isSuccess: thresholdSuccess } = useWaitForTransactionReceipt({ hash: thresholdTxHash });

  const { data: roleCounts } = useReadContracts({
    contracts: [
      { ...familyTreeConfig, functionName: "getRoleHolderCount", args: [treeId, CREATOR_ROLE] },
      { ...familyTreeConfig, functionName: "getRoleHolderCount", args: [treeId, ADMIN_ROLE] },
      { ...familyTreeConfig, functionName: "getRoleHolderCount", args: [treeId, EDITOR_ROLE] },
    ],
  });

  const creatorCount = roleCounts?.[0]?.result as bigint | undefined;
  const adminCount = roleCounts?.[1]?.result as bigint | undefined;
  const editorCount = roleCounts?.[2]?.result as bigint | undefined;

  const canManage = role === "creator";

  const handleRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const addr = address as `0x${string}`;
    writeRole({
      ...familyTreeConfig,
      functionName: action,
      args: [treeId, addr],
    });
  };

  const handleThresholdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    writeThreshold({
      ...familyTreeConfig,
      functionName: "setApprovalThreshold",
      args: [treeId, BigInt(newThreshold)],
    });
  };

  if (!canManage) {
    return (
      <div className="text-gray-500 text-sm">
        Only the tree creator can manage roles and threshold.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Role counts summary */}
      <div className="flex gap-4 text-sm">
        <div className="bg-gray-800/50 rounded-lg px-4 py-2 text-center">
          <p className="text-pink-400 font-medium">{creatorCount?.toString() ?? "-"}</p>
          <p className="text-gray-500 text-xs">Creators</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg px-4 py-2 text-center">
          <p className="text-purple-400 font-medium">{adminCount?.toString() ?? "-"}</p>
          <p className="text-gray-500 text-xs">Admins</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg px-4 py-2 text-center">
          <p className="text-cyan-400 font-medium">{editorCount?.toString() ?? "-"}</p>
          <p className="text-gray-500 text-xs">Editors</p>
        </div>
      </div>

      {/* Role management */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Manage Roles</h3>
        {roleSuccess && <div className="text-green-400 text-sm">Role updated successfully!</div>}
        <form onSubmit={handleRoleSubmit} className="space-y-4">
          <Select
            id="roleAction"
            label="Action"
            options={ACTION_OPTIONS}
            value={action}
            onChange={(e) => setAction(e.target.value as RoleAction)}
          />
          <Input
            id="roleAddress"
            label="Address"
            placeholder="0x..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
          <Button type="submit" loading={rolePending || roleConfirming}>
            {rolePending ? "Confirm in Wallet..." : roleConfirming ? "Confirming..." : "Execute"}
          </Button>
        </form>
      </div>

      {/* Threshold */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Approval Threshold</h3>
        <p className="text-sm text-gray-400">Current threshold: {threshold.toString()}</p>
        {thresholdSuccess && <div className="text-green-400 text-sm">Threshold updated!</div>}
        <form onSubmit={handleThresholdSubmit} className="flex gap-3">
          <Input
            id="newThreshold"
            type="number"
            min="1"
            value={newThreshold}
            onChange={(e) => setNewThreshold(e.target.value)}
            className="flex-1"
            required
          />
          <Button type="submit" loading={thresholdPending || thresholdConfirming}>
            {thresholdPending ? "Confirm..." : thresholdConfirming ? "Confirming..." : "Update"}
          </Button>
        </form>
      </div>
    </div>
  );
}
