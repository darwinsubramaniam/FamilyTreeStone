"use client";

import type { UserRole } from "@/types";
import clsx from "clsx";

interface RoleStatusBadgeProps {
  role: UserRole;
}

export function RoleStatusBadge({ role }: RoleStatusBadgeProps) {
  if (role === "none") return null;

  return (
    <span
      className={clsx(
        "px-2.5 py-0.5 text-xs font-medium rounded-full border capitalize",
        role === "creator" && "bg-pink-500/10 text-pink-400 border-pink-500/20",
        role === "admin" && "bg-purple-500/10 text-purple-400 border-purple-500/20",
        role === "editor" && "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
      )}
    >
      {role}
    </span>
  );
}
