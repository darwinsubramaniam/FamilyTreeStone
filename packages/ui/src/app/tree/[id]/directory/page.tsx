"use client";

import { use, useState } from "react";
import { usePersonDirectory } from "@/hooks/usePersonDirectory";
import { useUserRole } from "@/hooks/useUserRole";
import { PersonDetailModal } from "@/components/family/PersonDetailModal";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";
import { Gender, GENDER_LABELS } from "@/types";
import { uintToDateString } from "@/lib/date";
import type { Person } from "@/types";
import clsx from "clsx";

export default function PersonDirectoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const treeId = BigInt(id);
  const { persons, isLoading } = usePersonDirectory(treeId);
  const { role } = useUserRole(treeId);
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [genderFilter, setGenderFilter] = useState<Gender | "all">("all");

  const filtered = persons.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesGender =
      genderFilter === "all" || p.gender === genderFilter;
    return matchesSearch && matchesGender;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Person Directory</h1>
        <p className="text-sm text-gray-400 mt-1">
          {persons.length} {persons.length === 1 ? "person" : "people"} in tree #{id}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <div className="flex gap-1">
          {(["all", Gender.Male, Gender.Female, Gender.Other] as const).map(
            (g) => {
              const label =
                g === "all" ? "All" : GENDER_LABELS[g as Gender];
              const isActive = genderFilter === g;
              return (
                <button
                  key={String(g)}
                  onClick={() => setGenderFilter(g)}
                  className={clsx(
                    "px-3 py-2 text-xs font-medium rounded-lg transition-colors",
                    isActive
                      ? "bg-pink-500/10 text-pink-400 border border-pink-500/20"
                      : "text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent"
                  )}
                >
                  {label}
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* Person grid */}
      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">
          {persons.length === 0
            ? "No people in this tree yet."
            : "No results match your filters."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((person) => (
            <button
              key={person.id.toString()}
              onClick={() => setSelectedPerson(person)}
              className="text-left bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-pink-500/50 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <span
                  className={clsx(
                    "text-2xl mt-0.5",
                    person.gender === Gender.Male && "text-blue-400",
                    person.gender === Gender.Female && "text-pink-400",
                    person.gender === Gender.Other && "text-purple-400"
                  )}
                >
                  {person.gender === Gender.Male
                    ? "♂"
                    : person.gender === Gender.Female
                    ? "♀"
                    : "⚥"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white truncate group-hover:text-pink-400 transition-colors">
                    {person.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {uintToDateString(person.dob, "short")}
                  </p>
                  <p className="text-[10px] text-gray-600 font-mono mt-1">
                    ID #{person.id.toString()}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <PersonDetailModal
        person={selectedPerson}
        open={!!selectedPerson}
        onClose={() => setSelectedPerson(null)}
        treeId={treeId}
        role={role}
      />
    </div>
  );
}
