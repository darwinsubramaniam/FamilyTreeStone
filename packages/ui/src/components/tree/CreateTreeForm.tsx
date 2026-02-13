"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { familyTreeConfig } from "@/config/contract";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Gender } from "@/types";
import { dateInputToUint } from "@/lib/date";

const GENDER_OPTIONS = [
  { value: Gender.Male, label: "Male" },
  { value: Gender.Female, label: "Female" },
  { value: Gender.Other, label: "Other" },
];

export function CreateTreeForm() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const [treeName, setTreeName] = useState("");
  const [threshold, setThreshold] = useState("1");
  const [isSingle, setIsSingle] = useState(false);

  const [p1Name, setP1Name] = useState("");
  const [p1Dob, setP1Dob] = useState("");
  const [p1Gender, setP1Gender] = useState<Gender>(Gender.Male);
  const [p1Profile, setP1Profile] = useState("");

  const [p2Name, setP2Name] = useState("");
  const [p2Dob, setP2Dob] = useState("");
  const [p2Gender, setP2Gender] = useState<Gender>(Gender.Female);
  const [p2Profile, setP2Profile] = useState("");

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSingle) {
      writeContract({
        ...familyTreeConfig,
        functionName: "createTreeSingle",
        args: [
          treeName,
          {
            name: p1Name,
            dob: dateInputToUint(p1Dob),
            gender: p1Gender,
            profileURI: p1Profile,
          },
          BigInt(threshold),
        ],
      });
    } else {
      writeContract({
        ...familyTreeConfig,
        functionName: "createTree",
        args: [
          treeName,
          {
            name: p1Name,
            dob: dateInputToUint(p1Dob),
            gender: p1Gender,
            profileURI: p1Profile,
          },
          {
            name: p2Name,
            dob: dateInputToUint(p2Dob),
            gender: p2Gender,
            profileURI: p2Profile,
          },
          BigInt(threshold),
        ],
      });
    }
  };

  if (isSuccess) {
    return (
      <div className="text-center space-y-4">
        <div className="text-green-400 text-lg font-semibold">
          Tree created successfully!
        </div>
        <p className="text-gray-400 text-sm">
          Transaction:{" "}
          <code className="text-xs text-gray-500">{txHash}</code>
        </p>
        <Button onClick={() => router.push("/")}>Go Home</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Tree info */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Tree Details</h3>
        <Input
          id="treeName"
          label="Tree Name"
          placeholder="e.g. Smith Family"
          value={treeName}
          onChange={(e) => setTreeName(e.target.value)}
          required
        />
        <Input
          id="threshold"
          label="Approval Threshold"
          type="number"
          min="1"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          required
        />
      </div>

      {/* Single founder toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isSingle}
          onChange={(e) => setIsSingle(e.target.checked)}
          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-pink-500 focus:ring-pink-500/50"
        />
        <span className="text-sm text-gray-300">
          Single founder (no founding couple)
        </span>
      </label>

      {/* Partner 1 / Founder */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">
          {isSingle ? "Founder" : "Partner 1 (Founding)"}
        </h3>
        <Input
          id="p1Name"
          label="Name"
          placeholder="Full name"
          value={p1Name}
          onChange={(e) => setP1Name(e.target.value)}
          required
        />
        <Input
          id="p1Dob"
          label="Date of Birth"
          type="date"
          value={p1Dob}
          onChange={(e) => setP1Dob(e.target.value)}
          required
        />
        <Select
          id="p1Gender"
          label="Gender"
          options={GENDER_OPTIONS}
          value={p1Gender}
          onChange={(e) => setP1Gender(Number(e.target.value) as Gender)}
        />
        <Input
          id="p1Profile"
          label="Profile URI (optional)"
          placeholder="https://..."
          value={p1Profile}
          onChange={(e) => setP1Profile(e.target.value)}
        />
      </div>

      {/* Partner 2 (hidden when single) */}
      {!isSingle && <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Partner 2 (Founding)</h3>
        <Input
          id="p2Name"
          label="Name"
          placeholder="Full name"
          value={p2Name}
          onChange={(e) => setP2Name(e.target.value)}
          required
        />
        <Input
          id="p2Dob"
          label="Date of Birth"
          type="date"
          value={p2Dob}
          onChange={(e) => setP2Dob(e.target.value)}
          required
        />
        <Select
          id="p2Gender"
          label="Gender"
          options={GENDER_OPTIONS}
          value={p2Gender}
          onChange={(e) => setP2Gender(Number(e.target.value) as Gender)}
        />
        <Input
          id="p2Profile"
          label="Profile URI (optional)"
          placeholder="https://..."
          value={p2Profile}
          onChange={(e) => setP2Profile(e.target.value)}
        />
      </div>}

      {writeError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {writeError.message.includes("User rejected")
            ? "Transaction rejected in wallet."
            : writeError.message.length > 200
            ? writeError.message.slice(0, 200) + "..."
            : writeError.message}
        </div>
      )}

      {!isConnected ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Connect your wallet to create a family tree.
        </div>
      ) : (
        <Button
          type="submit"
          size="lg"
          loading={isPending || isConfirming}
          className="w-full"
        >
          {isPending
            ? "Confirm in Wallet..."
            : isConfirming
            ? "Waiting for confirmation..."
            : "Create Family Tree"}
        </Button>
      )}
    </form>
  );
}
