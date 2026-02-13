"use client";

import { useReadContracts, usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { familyTreeConfig, CONTRACT_DEPLOY_BLOCK } from "@/config/contract";
import { parseAbiItem } from "viem";
import type { Proposal } from "@/types";
import { useMemo } from "react";

const MAX_BLOCK_RANGE = 50_000n;

export function useProposals(treeId: bigint | undefined) {
  const publicClient = usePublicClient();

  // Step 1: Get proposal IDs from event logs
  const { data: proposalIds, isLoading: logsLoading } = useQuery({
    queryKey: ["proposalIds", treeId?.toString()],
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
            "event ProposalCreated(uint256 indexed proposalId, uint256 indexed treeId, uint8 proposalType, address indexed proposer)"
          ),
          fromBlock,
          toBlock,
        });

        for (const log of logs) {
          if (log.args.proposalId != null && log.args.treeId === treeId) {
            ids.push(log.args.proposalId);
          }
        }

        fromBlock = toBlock + 1n;
      }

      return ids;
    },
    enabled: treeId !== undefined && !!publicClient,
    retry: 1,
  });

  // Step 2: Batch fetch all proposals
  const proposalContracts = useMemo(() => {
    if (!proposalIds || proposalIds.length === 0) return undefined;
    return proposalIds.map((id) => ({
      ...familyTreeConfig,
      functionName: "getProposal" as const,
      args: [id] as const,
    }));
  }, [proposalIds]);

  const { data: proposalsData, isLoading: proposalsLoading } =
    useReadContracts({
      contracts: proposalContracts,
      query: {
        enabled: !!proposalContracts && proposalContracts.length > 0,
      },
    });

  const proposals = useMemo(() => {
    if (!proposalsData) return [];
    return proposalsData
      .filter((p) => p.status === "success" && p.result)
      .map((p) => p.result as unknown as Proposal);
  }, [proposalsData]);

  return {
    proposals,
    isLoading: logsLoading || proposalsLoading,
  };
}
