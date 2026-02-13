"use client";

import { use, useState } from "react";
import { useProposals } from "@/hooks/useProposals";
import { useUserRole } from "@/hooks/useUserRole";
import { ProposalList } from "@/components/proposals/ProposalList";
import { CreateProposalForm } from "@/components/proposals/CreateProposalForm";
import { RoleStatusBadge } from "@/components/roles/RoleStatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export default function ProposalsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const treeId = BigInt(id);
  const { proposals, isLoading } = useProposals(treeId);
  const { role, canDirectEdit, canPropose, isConnected } = useUserRole(treeId);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Proposals</h1>
          {isConnected && <RoleStatusBadge role={role} />}
        </div>
        {(canDirectEdit || canPropose) && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            New Action
          </Button>
        )}
      </div>

      <ProposalList proposals={proposals} role={role} isLoading={isLoading} />

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={canPropose ? "Create Proposal" : "New Action"}
      >
        <CreateProposalForm treeId={treeId} role={role} />
      </Modal>
    </div>
  );
}
