import { keccak256, toBytes } from "viem";

export const CREATOR_ROLE = keccak256(toBytes("CREATOR"));
export const ADMIN_ROLE = keccak256(toBytes("ADMIN"));
export const EDITOR_ROLE = keccak256(toBytes("EDITOR"));
