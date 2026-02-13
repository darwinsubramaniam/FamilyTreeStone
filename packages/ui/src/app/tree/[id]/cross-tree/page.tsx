"use client";

import { use, useState, useCallback } from "react";
import { useCrossTreeCouples } from "@/hooks/useCrossTreeCouples";
import { useUserRole } from "@/hooks/useUserRole";
import { useInvalidateTreeQueries } from "@/hooks/useInvalidateTreeQueries";
import { CrossTreeCoupleList } from "@/components/crossTree/CrossTreeCoupleList";
import { ProposeCrossTreeCoupleForm } from "@/components/crossTree/ProposeCrossTreeCoupleForm";
import { AddChildToCrossCoupleForm } from "@/components/crossTree/AddChildToCrossCoupleForm";
import { RoleStatusBadge } from "@/components/roles/RoleStatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export default function CrossTreePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const treeId = BigInt(id);
  const { couples, isLoading } = useCrossTreeCouples(treeId);
  const { role, canDirectEdit, isConnected } = useUserRole(treeId);
  const invalidate = useInvalidateTreeQueries();
  const [showPropose, setShowPropose] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);

  const handleProposeSuccess = useCallback(() => {
    invalidate();
    setShowPropose(false);
  }, [invalidate]);

  const handleAddChildSuccess = useCallback(() => {
    invalidate();
    setShowAddChild(false);
  }, [invalidate]);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Cross-Tree Couples</h1>
          {isConnected && <RoleStatusBadge role={role} />}
        </div>
        {canDirectEdit && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setShowPropose(true)}>
              Propose Couple
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowAddChild(true)}
            >
              Add Child
            </Button>
          </div>
        )}
      </div>

      {!canDirectEdit && isConnected && (
        <div className="text-xs text-gray-500 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2">
          Only creators and admins can propose or manage cross-tree couples.
        </div>
      )}

      <CrossTreeCoupleList
        couples={couples}
        currentTreeId={treeId}
        role={role}
        isLoading={isLoading}
      />

      <Modal
        open={showPropose}
        onClose={() => setShowPropose(false)}
        title="Propose Cross-Tree Couple"
      >
        <ProposeCrossTreeCoupleForm
          treeId={treeId}
          onSuccess={handleProposeSuccess}
        />
      </Modal>

      <Modal
        open={showAddChild}
        onClose={() => setShowAddChild(false)}
        title="Add Child to Cross-Tree Couple"
      >
        <AddChildToCrossCoupleForm
          onSuccess={handleAddChildSuccess}
        />
      </Modal>
    </div>
  );
}
