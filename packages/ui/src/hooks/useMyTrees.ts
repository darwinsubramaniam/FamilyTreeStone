"use client";

import { useAccount, usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { familyTreeConfig, CONTRACT_DEPLOY_BLOCK } from "@/config/contract";
import { parseAbiItem } from "viem";

interface MyTree {
  treeId: bigint;
  name: string;
}

const MAX_BLOCK_RANGE = 50_000n;

export function useMyTrees() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();

  const { data: trees, isLoading, error } = useQuery({
    queryKey: ["myTrees", address, chainId, familyTreeConfig.address],
    queryFn: async (): Promise<MyTree[]> => {
      if (!address || !publicClient) return [];

      const currentBlock = await publicClient.getBlockNumber();
      const allLogs: MyTree[] = [];

      // Scan in chunks from contract deployment to current block
      let fromBlock = CONTRACT_DEPLOY_BLOCK;
      while (fromBlock <= currentBlock) {
        const toBlock =
          fromBlock + MAX_BLOCK_RANGE - 1n > currentBlock
            ? currentBlock
            : fromBlock + MAX_BLOCK_RANGE - 1n;

        const logs = await publicClient.getLogs({
          address: familyTreeConfig.address,
          event: parseAbiItem(
            "event TreeCreated(uint256 indexed treeId, string name, address indexed creator)"
          ),
          fromBlock,
          toBlock,
        });

        for (const log of logs) {
          if (
            log.args.treeId != null &&
            log.args.name != null &&
            log.args.creator?.toLowerCase() === address.toLowerCase()
          ) {
            allLogs.push({
              treeId: log.args.treeId,
              name: log.args.name,
            });
          }
        }

        fromBlock = toBlock + 1n;
      }

      return allLogs;
    },
    enabled: !!address && !!publicClient,
    retry: 1,
  });

  return { trees: trees ?? [], isLoading, error };
}
