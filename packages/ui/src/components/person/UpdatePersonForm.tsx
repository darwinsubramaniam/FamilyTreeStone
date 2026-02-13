"use client";

import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { familyTreeConfig } from "@/config/contract";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Person, UserRole } from "@/types";

interface UpdatePersonFormProps {
  treeId: bigint;
  person: Person;
  role: UserRole;
  onSuccess?: () => void;
}

export function UpdatePersonForm({ treeId, person, role, onSuccess }: UpdatePersonFormProps) {
  const [name, setName] = useState(person.name);
  const [profileURI, setProfileURI] = useState(person.profileURI);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const isEditor = role === "editor";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditor) {
      writeContract({
        ...familyTreeConfig,
        functionName: "proposeUpdatePerson",
        args: [treeId, person.id, name, profileURI],
      });
    } else {
      writeContract({
        ...familyTreeConfig,
        functionName: "updatePerson",
        args: [treeId, person.id, name, profileURI],
      });
    }
  };

  useEffect(() => {
    if (isSuccess) onSuccess?.();
  }, [isSuccess, onSuccess]);

  if (isSuccess) {
    return <div className="text-green-400 text-sm py-2">{isEditor ? "Proposal created!" : "Person updated!"}</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isEditor && (
        <div className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
          As an editor, this will create a proposal that requires approvals.
        </div>
      )}
      <Input id="updateName" label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input id="updateProfile" label="Profile URI" value={profileURI} onChange={(e) => setProfileURI(e.target.value)} />
      <Button type="submit" loading={isPending || isConfirming} className="w-full">
        {isPending ? "Confirm in Wallet..." : isConfirming ? "Confirming..." : isEditor ? "Propose Update" : "Update Person"}
      </Button>
    </form>
  );
}
