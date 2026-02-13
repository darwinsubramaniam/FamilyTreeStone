"use client";

import { use, useState, useEffect, useCallback, useMemo } from "react";
import { useTreeData } from "@/hooks/useTreeData";
import { useForeignTrees } from "@/hooks/useForeignTrees";
import { useUserRole } from "@/hooks/useUserRole";
import { useRecentTrees } from "@/hooks/useRecentTrees";
import { useInvalidateTreeQueries } from "@/hooks/useInvalidateTreeQueries";
import { TreeInfoCard } from "@/components/tree/TreeInfoCard";
import { FamilyTreeView } from "@/components/family/FamilyTreeView";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AddPersonForm } from "@/components/person/AddPersonForm";
import { CreateCoupleForm } from "@/components/person/CreateCoupleForm";
import { AddChildForm } from "@/components/person/AddChildForm";
import { AdoptChildForm } from "@/components/person/AdoptChildForm";
import { Spinner } from "@/components/ui/Spinner";

export default function TreeViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const treeId = BigInt(id);
  const { tree, persons, hierarchy, crossCouples, isLoading, error } = useTreeData(treeId);
  const { role, canDirectEdit, canPropose } = useUserRole(treeId);

  // Compute foreign tree IDs from approved cross-tree couples
  const foreignTreeIds = useMemo(() => {
    if (!crossCouples || crossCouples.length === 0) return [];
    return crossCouples.map((xc) =>
      xc.tree1Id === treeId ? xc.tree2Id : xc.tree1Id
    );
  }, [crossCouples, treeId]);

  const { foreignTrees } = useForeignTrees(foreignTreeIds);
  const { addTree } = useRecentTrees();
  const invalidate = useInvalidateTreeQueries();
  const [actionModal, setActionModal] = useState<string | null>(null);
  const [adoptDefaultChildId, setAdoptDefaultChildId] = useState("");

  const handleSuccess = useCallback(() => {
    invalidate();
    setActionModal(null);
  }, [invalidate]);

  useEffect(() => {
    if (tree?.exists) {
      addTree(id, tree.name);
    }
  }, [tree, id, addTree]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !tree?.exists) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-white">Tree Not Found</h2>
        <p className="text-gray-400 mt-2">
          Tree #{id} does not exist or could not be loaded.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TreeInfoCard tree={tree} />

      {/* Action bar */}
      {(canDirectEdit || canPropose) && (
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => setActionModal("addPerson")}>
            {canDirectEdit ? "Add Person" : "Propose Add Person"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setActionModal("createCouple")}
          >
            {canDirectEdit ? "Create Couple" : "Propose Create Couple"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setActionModal("addChild")}
          >
            {canDirectEdit ? "Add Child" : "Propose Add Child"}
          </Button>
          {canDirectEdit && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setActionModal("adoptChild")}
            >
              Adopt Child
            </Button>
          )}
        </div>
      )}

      <FamilyTreeView
        hierarchy={hierarchy}
        persons={persons}
        isLoading={false}
        treeId={treeId}
        role={role}
        onRefresh={invalidate}
        crossCouples={crossCouples}
        foreignTrees={foreignTrees}
        onAdoptClick={(personId) => {
          setAdoptDefaultChildId(personId.toString());
          setActionModal("adoptChild");
        }}
      />

      {/* Action Modals */}
      <Modal
        open={actionModal === "addPerson"}
        onClose={() => setActionModal(null)}
        title={canDirectEdit ? "Add Person" : "Propose Add Person"}
      >
        <AddPersonForm
          treeId={treeId}
          role={role}
          onSuccess={handleSuccess}
        />
      </Modal>

      <Modal
        open={actionModal === "createCouple"}
        onClose={() => setActionModal(null)}
        title={canDirectEdit ? "Create Couple" : "Propose Create Couple"}
      >
        <CreateCoupleForm
          treeId={treeId}
          role={role}
          onSuccess={handleSuccess}
        />
      </Modal>

      <Modal
        open={actionModal === "addChild"}
        onClose={() => setActionModal(null)}
        title={canDirectEdit ? "Add Child to Couple" : "Propose Add Child"}
      >
        <AddChildForm
          treeId={treeId}
          role={role}
          onSuccess={handleSuccess}
        />
      </Modal>

      <Modal
        open={actionModal === "adoptChild"}
        onClose={() => {
          setActionModal(null);
          setAdoptDefaultChildId("");
        }}
        title="Adopt Child"
      >
        <AdoptChildForm
          treeId={treeId}
          defaultChildId={adoptDefaultChildId}
          onSuccess={() => {
            invalidate();
            setActionModal(null);
            setAdoptDefaultChildId("");
          }}
        />
      </Modal>
    </div>
  );
}
