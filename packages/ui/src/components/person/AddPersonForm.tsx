"use client";

import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { familyTreeConfig } from "@/config/contract";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Gender } from "@/types";
import type { UserRole } from "@/types";
import { dateInputToUint } from "@/lib/date";

const GENDER_OPTIONS = [
  { value: Gender.Male, label: "Male" },
  { value: Gender.Female, label: "Female" },
  { value: Gender.Other, label: "Other" },
];

interface AddPersonFormProps {
  treeId: bigint;
  role: UserRole;
  onSuccess?: () => void;
}

export function AddPersonForm({ treeId, role, onSuccess }: AddPersonFormProps) {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<Gender>(Gender.Male);
  const [profileURI, setProfileURI] = useState("");

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const isEditor = role === "editor";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dobTimestamp = dateInputToUint(dob);

    if (isEditor) {
      writeContract({
        ...familyTreeConfig,
        functionName: "proposeAddPerson",
        args: [treeId, name, dobTimestamp, gender, profileURI],
      });
    } else {
      writeContract({
        ...familyTreeConfig,
        functionName: "addPerson",
        args: [treeId, name, dobTimestamp, gender, profileURI],
      });
    }
  };

  useEffect(() => {
    if (isSuccess) onSuccess?.();
  }, [isSuccess, onSuccess]);

  if (isSuccess) {
    return (
      <div className="text-green-400 text-sm py-2">
        {isEditor ? "Proposal created!" : "Person added!"}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isEditor && (
        <div className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
          As an editor, this will create a proposal that requires approvals.
        </div>
      )}
      <Input id="personName" label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input id="personDob" label="Date of Birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
      <Select id="personGender" label="Gender" options={GENDER_OPTIONS} value={gender} onChange={(e) => setGender(Number(e.target.value) as Gender)} />
      <Input id="personProfile" label="Profile URI (optional)" value={profileURI} onChange={(e) => setProfileURI(e.target.value)} />
      <Button type="submit" loading={isPending || isConfirming} className="w-full">
        {isPending ? "Confirm in Wallet..." : isConfirming ? "Confirming..." : isEditor ? "Propose Add Person" : "Add Person"}
      </Button>
    </form>
  );
}
