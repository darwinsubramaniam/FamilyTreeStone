"use client";

import { use } from "react";
import { TreeSubNav } from "@/components/layout/TreeSubNav";

export default function TreeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div>
      <TreeSubNav treeId={id} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </div>
    </div>
  );
}
