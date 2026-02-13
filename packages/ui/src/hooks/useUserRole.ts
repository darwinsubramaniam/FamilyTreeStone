"use client";

import { useReadContracts, useAccount } from "wagmi";
import { familyTreeConfig } from "@/config/contract";
import { CREATOR_ROLE, ADMIN_ROLE, EDITOR_ROLE } from "@/config/constants";
import type { UserRole } from "@/types";

export function useUserRole(treeId: bigint | undefined) {
  const { address } = useAccount();

  const { data, isLoading } = useReadContracts({
    contracts:
      treeId !== undefined && address
        ? [
            {
              ...familyTreeConfig,
              functionName: "hasRole",
              args: [treeId, CREATOR_ROLE, address],
            },
            {
              ...familyTreeConfig,
              functionName: "hasRole",
              args: [treeId, ADMIN_ROLE, address],
            },
            {
              ...familyTreeConfig,
              functionName: "hasRole",
              args: [treeId, EDITOR_ROLE, address],
            },
          ]
        : undefined,
    query: {
      enabled: treeId !== undefined && !!address,
    },
  });

  let role: UserRole = "none";
  if (data) {
    if (data[0]?.result) role = "creator";
    else if (data[1]?.result) role = "admin";
    else if (data[2]?.result) role = "editor";
  }

  const canDirectEdit = role === "creator" || role === "admin";
  const canPropose = role === "editor";
  const canManageRoles = role === "creator";
  const canApproveProposals =
    role === "creator" || role === "admin" || role === "editor";

  return {
    role,
    canDirectEdit,
    canPropose,
    canManageRoles,
    canApproveProposals,
    isLoading,
    isConnected: !!address,
  };
}
