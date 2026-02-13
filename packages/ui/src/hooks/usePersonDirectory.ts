"use client";

import { usePublicClient, useReadContracts } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { familyTreeConfig, CONTRACT_DEPLOY_BLOCK } from "@/config/contract";
import { parseAbiItem } from "viem";
import type { Person } from "@/types";
import { useMemo } from "react";

const MAX_BLOCK_RANGE = 50_000n;

export function usePersonDirectory(treeId: bigint | undefined) {
  const publicClient = usePublicClient();

  // Step 1: Discover person IDs from PersonAdded events
  const { data: personIds, isLoading: logsLoading } = useQuery({
    queryKey: ["personDirectory", treeId?.toString()],
    queryFn: async (): Promise<bigint[]> => {
      if (treeId === undefined || !publicClient) return [];

      const currentBlock = await publicClient.getBlockNumber();
      const ids: bigint[] = [];

      let fromBlock = CONTRACT_DEPLOY_BLOCK;
      while (fromBlock <= currentBlock) {
        const toBlock =
          fromBlock + MAX_BLOCK_RANGE - 1n > currentBlock
            ? currentBlock
            : fromBlock + MAX_BLOCK_RANGE - 1n;

        const logs = await publicClient.getLogs({
          address: familyTreeConfig.address,
          event: parseAbiItem(
            "event PersonAdded(uint256 indexed treeId, uint256 indexed personId, string name)"
          ),
          fromBlock,
          toBlock,
        });

        for (const log of logs) {
          if (log.args.personId != null && log.args.treeId === treeId) {
            ids.push(log.args.personId);
          }
        }

        fromBlock = toBlock + 1n;
      }

      return ids;
    },
    enabled: treeId !== undefined && !!publicClient,
    retry: 1,
  });

  // Step 2: Batch fetch all person data
  const personContracts = useMemo(() => {
    if (!personIds || personIds.length === 0) return undefined;
    return personIds.map((id) => ({
      ...familyTreeConfig,
      functionName: "getPerson" as const,
      args: [id] as const,
    }));
  }, [personIds]);

  const { data: personsData, isLoading: personsLoading } = useReadContracts({
    contracts: personContracts,
    query: {
      enabled: !!personContracts && personContracts.length > 0,
    },
  });

  const persons = useMemo(() => {
    if (!personsData) return [];
    return personsData
      .filter((p) => p.status === "success" && p.result)
      .map((p) => p.result as unknown as Person);
  }, [personsData]);

  return {
    persons,
    isLoading: logsLoading || personsLoading,
  };
}
