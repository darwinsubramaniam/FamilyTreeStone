"use client";

import { use } from "react";
import { useTreeData } from "@/hooks/useTreeData";
import { useUserRole } from "@/hooks/useUserRole";
import { RoleManagementPanel } from "@/components/roles/RoleManagementPanel";
import { RoleStatusBadge } from "@/components/roles/RoleStatusBadge";
import { Spinner } from "@/components/ui/Spinner";

export default function ManageRolesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const treeId = BigInt(id);
  const { tree, isLoading } = useTreeData(treeId);
  const { role, isConnected } = useUserRole(treeId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!tree?.exists) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-white">Tree Not Found</h2>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Role Management</h1>
        {isConnected && <RoleStatusBadge role={role} />}
      </div>

      {!isConnected ? (
        <p className="text-gray-400">Connect your wallet to manage roles.</p>
      ) : (
        <RoleManagementPanel
          treeId={treeId}
          role={role}
          threshold={tree.approvalThreshold}
        />
      )}
    </div>
  );
}
