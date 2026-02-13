import { familyTreeAbi } from "@/lib/abi";

export const FAMILY_TREE_ADDRESS = (process.env
  .NEXT_PUBLIC_CONTRACT_ADDRESS ?? "0xd5763ec0a7938d6ce3309a1bbcf68e2dc0de0201") as `0x${string}`;

/** Block number the contract was deployed at. Event scans start here. */
export const CONTRACT_DEPLOY_BLOCK = BigInt(
  process.env.NEXT_PUBLIC_CONTRACT_DEPLOY_BLOCK ?? "5228917"
);

export const familyTreeConfig = {
  address: FAMILY_TREE_ADDRESS,
  abi: familyTreeAbi,
} as const;
