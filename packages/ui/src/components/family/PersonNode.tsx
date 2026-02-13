"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { PersonNodeData } from "@/lib/tree-layout";
import { Gender } from "@/types";
import { uintToDateString } from "@/lib/date";

function PersonNodeInner({ data }: NodeProps) {
  const { person, foreign } = data as unknown as PersonNodeData;

  const genderColor =
    person.gender === Gender.Male
      ? "text-blue-400"
      : person.gender === Gender.Female
        ? "text-pink-400"
        : "text-purple-400";

  const dob = uintToDateString(person.dob, "short");

  const borderClass = foreign
    ? "border-emerald-500/40 hover:border-emerald-400/70"
    : "border-gray-700 hover:border-pink-500/50";
  const bgClass = foreign ? "bg-emerald-950/40" : "bg-gray-900";

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-gray-600 !w-2 !h-2" />
      <div className={`${bgClass} border ${borderClass} rounded-lg px-3 py-2 w-[150px] shadow-lg transition-colors cursor-pointer`}>
        <div className="flex items-center gap-2">
          <span className={`text-lg ${genderColor}`}>
            {person.gender === Gender.Male
              ? "\u2642"
              : person.gender === Gender.Female
                ? "\u2640"
                : "\u26A5"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">
              {person.name}
            </p>
            <p className="text-xs text-gray-500">{dob}</p>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-600 !w-2 !h-2" />
    </>
  );
}

export const PersonNode = memo(PersonNodeInner);
