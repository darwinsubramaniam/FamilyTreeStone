"use client";

import { TreeLookupForm } from "@/components/tree/TreeLookupForm";
import { MyTreesList } from "@/components/tree/MyTreesList";
import { RecentTreesList } from "@/components/tree/RecentTreesList";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-12">
      {/* Hero */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-white">
          Family<span className="text-pink-500">Tree</span>Stone
        </h1>
        <p className="text-gray-400 max-w-md mx-auto">
          A decentralized family tree registry on Polkadot Hub. Create, manage,
          and explore family trees on-chain.
        </p>
      </div>

      {/* Lookup */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Look Up a Tree</h2>
        <TreeLookupForm />
      </section>

      {/* My Trees */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">My Trees</h2>
        <MyTreesList />
      </section>

      {/* Recent */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Recently Viewed</h2>
        <RecentTreesList />
      </section>
    </div>
  );
}
