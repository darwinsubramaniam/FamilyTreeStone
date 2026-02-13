"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { CoupleNodeData } from "@/lib/tree-layout";
import { Gender } from "@/types";
import { uintToDateString } from "@/lib/date";
import type { Person } from "@/types";

function PartnerCard({ person }: { person: Person }) {
  const genderColor =
    person.gender === Gender.Male
      ? "text-blue-400"
      : person.gender === Gender.Female
        ? "text-pink-400"
        : "text-purple-400";

  const dob = uintToDateString(person.dob, "short");

  return (
    <div className="flex items-center gap-1.5 min-w-0 flex-1">
      <span className={`text-base ${genderColor}`}>
        {person.gender === Gender.Male
          ? "\u2642"
          : person.gender === Gender.Female
            ? "\u2640"
            : "\u26A5"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-white truncate">{person.name}</p>
        <p className="text-[10px] text-gray-500">{dob}</p>
      </div>
    </div>
  );
}

function CoupleGroupNodeInner({ data }: NodeProps) {
  const { coupleId, partner1, partner2, crossTree, foreign } = data as unknown as CoupleNodeData;

  const borderClass = foreign
    ? "border-emerald-500/40 hover:border-emerald-400/70"
    : crossTree
      ? "border-cyan-500/40 hover:border-cyan-400/70"
      : "border-gray-700 hover:border-pink-500/50";

  const bgClass = foreign ? "bg-emerald-950/40" : "bg-gray-900";

  const label = foreign
    ? `C#${coupleId.toString()}`
    : crossTree
      ? `XC#${coupleId.toString()}`
      : `C#${coupleId.toString()}`;

  const labelClass = foreign
    ? "text-emerald-500/70"
    : crossTree
      ? "text-cyan-500/70"
      : "text-gray-600";

  const heartClass = foreign
    ? "text-emerald-400"
    : crossTree
      ? "text-cyan-400"
      : "text-pink-500";

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-gray-600 !w-2 !h-2" />
      <div className={`${bgClass} border rounded-xl px-3 py-2 w-[260px] shadow-lg transition-colors cursor-pointer ${borderClass}`}>
        <span className={`text-[10px] font-mono block mb-1 ${labelClass}`}>
          {label}
        </span>
        <div className="flex items-center gap-2">
          <PartnerCard person={partner1} />
          <span className={`text-sm shrink-0 ${heartClass}`}>&hearts;</span>
          <PartnerCard person={partner2} />
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-600 !w-2 !h-2" />
    </>
  );
}

export const CoupleGroupNode = memo(CoupleGroupNodeInner);
