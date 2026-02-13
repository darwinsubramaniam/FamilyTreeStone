import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  polkadotHub,
  kusamaHub,
  polkadotHubTestnet,
} from "@/lib/chain";
import { cookieStorage, createStorage } from "wagmi";

export const wagmiConfig = getDefaultConfig({
  appName: "FamilyTreeStone",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  chains: [polkadotHubTestnet, polkadotHub, kusamaHub],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
});
