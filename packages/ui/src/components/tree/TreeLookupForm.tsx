"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function TreeLookupForm() {
  const [treeId, setTreeId] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = treeId.trim();
    if (id && !isNaN(Number(id)) && Number(id) > 0) {
      router.push(`/tree/${id}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <Input
        placeholder="Enter tree ID (e.g. 1)"
        value={treeId}
        onChange={(e) => setTreeId(e.target.value)}
        type="number"
        min="1"
        className="flex-1"
      />
      <Button type="submit" disabled={!treeId.trim()}>
        View Tree
      </Button>
    </form>
  );
}
