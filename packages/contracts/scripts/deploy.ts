import hre from "hardhat";
import {
  defineChain,
  createPublicClient,
  createWalletClient,
  http,
  getContractAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const polkadotHubTestNet = defineChain({
  id: 420420417,
  name: "Polkadot Hub TestNet",
  nativeCurrency: { name: "DOT", symbol: "DOT", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://services.polkadothub-rpc.com/testnet"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://blockscout-testnet.polkadot.io",
    },
  },
});

async function main() {
  console.log("Deploying FamilyTree contract...");

  const key = process.env.PRIVATE_KEY!;
  const privateKey = (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: polkadotHubTestNet,
    transport: http("https://services.polkadothub-rpc.com/testnet"),
  });

  const walletClient = createWalletClient({
    account,
    chain: polkadotHubTestNet,
    transport: http("https://services.polkadothub-rpc.com/testnet"),
  });

  console.log(`Deployer: ${account.address}`);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${balance} wei`);

  // Get compiled artifact
  const artifact = await hre.artifacts.readArtifact("FamilyTree");

  // Deploy
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
  });

  console.log(`Transaction hash: ${hash}`);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  console.log(`FamilyTree deployed at: ${receipt.contractAddress}`);
  console.log(`Block: ${receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.gasUsed}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
