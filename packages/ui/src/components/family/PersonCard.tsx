"use client";

import type { Person } from "@/types";
import { Gender } from "@/types";
import { uintToDateString } from "@/lib/date";

interface PersonCardProps {
  person: Person;
  onClick?: () => void;
}

export function PersonCard({ person, onClick }: PersonCardProps) {
  const genderColor = 
    person.gender === Gender.Male ? "text-blue-400" :
    person.gender === Gender.Female ? "text-pink-400" :
    "text-purple-400";

  const dob = uintToDateString(person.dob, "short");

  return (
    <button
      onClick={onClick}
      className="text-left w-full p-2 rounded-lg hover:bg-white/5 transition-colors group"
    >
      <div className="flex items-center gap-2">
        <span className={`text-lg ${genderColor}`}>
          {person.gender === Gender.Male ? "♂" : person.gender === Gender.Female ? "♀" : "⚥"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate group-hover:text-pink-400 transition-colors">
            {person.name}
          </p>
          <p className="text-xs text-gray-500">{dob}</p>
        </div>
      </div>
    </button>
  );
}
