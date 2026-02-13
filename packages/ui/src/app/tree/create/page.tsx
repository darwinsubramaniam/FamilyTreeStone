"use client";

import { CreateTreeForm } from "@/components/tree/CreateTreeForm";
import Link from "next/link";

export default function CreateTreePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back to Home
        </Link>
        <h1 className="text-2xl font-bold text-white mt-4">
          Create a Family Tree
        </h1>
        <p className="text-gray-400 mt-2">
          Start a new family tree with a founding couple or a single founder.
          You&apos;ll be the creator with full control.
        </p>
      </div>
      <CreateTreeForm />
    </div>
  );
}
