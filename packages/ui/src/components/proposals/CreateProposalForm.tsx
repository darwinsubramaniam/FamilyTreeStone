"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { AddPersonForm } from "@/components/person/AddPersonForm";
import { CreateCoupleForm } from "@/components/person/CreateCoupleForm";
import { AddChildForm } from "@/components/person/AddChildForm";
import type { UserRole } from "@/types";

const PROPOSAL_OPTIONS = [
  { value: "addPerson", label: "Add Person" },
  { value: "createCouple", label: "Create Couple" },
  { value: "addChild", label: "Add Child to Couple" },
];

interface CreateProposalFormProps {
  treeId: bigint;
  role: UserRole;
}

export function CreateProposalForm({ treeId, role }: CreateProposalFormProps) {
  const [type, setType] = useState("addPerson");

  return (
    <div className="space-y-4">
      <Select
        id="proposalType"
        label="Action Type"
        options={PROPOSAL_OPTIONS}
        value={type}
        onChange={(e) => setType(e.target.value)}
      />
      {type === "addPerson" && <AddPersonForm treeId={treeId} role={role} />}
      {type === "createCouple" && <CreateCoupleForm treeId={treeId} role={role} />}
      {type === "addChild" && <AddChildForm treeId={treeId} role={role} />}
    </div>
  );
}
