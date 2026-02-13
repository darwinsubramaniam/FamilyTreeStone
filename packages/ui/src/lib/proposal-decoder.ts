import { decodeFunctionData } from "viem";
import { familyTreeAbi } from "@/lib/abi";
import { ProposalType, GENDER_LABELS, type Gender } from "@/types";
import { uintToDateString } from "@/lib/date";

export interface DecodedProposal {
  description: string;
  details: Record<string, string>;
}

export function decodeProposalData(
  proposalType: ProposalType,
  data: `0x${string}`
): DecodedProposal {
  try {
    switch (proposalType) {
      case ProposalType.AddPerson: {
        const decoded = decodeFunctionData({ abi: familyTreeAbi, data });
        const args = decoded.args as [bigint, string, bigint, number, string];
        return {
          description: `Add person "${args[1]}"`,
          details: {
            Name: args[1],
            "Date of Birth": uintToDateString(args[2]),
            Gender: GENDER_LABELS[args[3] as Gender] ?? "Unknown",
            "Profile URI": args[4] || "(none)",
          },
        };
      }
      case ProposalType.UpdatePerson: {
        const decoded = decodeFunctionData({ abi: familyTreeAbi, data });
        const args = decoded.args as [bigint, bigint, string, string];
        return {
          description: `Update person #${args[1]}`,
          details: {
            "Person ID": args[1].toString(),
            "New Name": args[2],
            "New Profile URI": args[3] || "(none)",
          },
        };
      }
      case ProposalType.CreateCouple: {
        const decoded = decodeFunctionData({ abi: familyTreeAbi, data });
        const args = decoded.args as [bigint, bigint, bigint];
        return {
          description: `Create couple: #${args[1]} + #${args[2]}`,
          details: {
            "Partner 1 ID": args[1].toString(),
            "Partner 2 ID": args[2].toString(),
          },
        };
      }
      case ProposalType.AddChildToCouple: {
        const decoded = decodeFunctionData({ abi: familyTreeAbi, data });
        const args = decoded.args as [bigint, bigint, bigint];
        return {
          description: `Add child #${args[2]} to couple #${args[1]}`,
          details: {
            "Couple ID": args[1].toString(),
            "Child ID": args[2].toString(),
          },
        };
      }
      default:
        return { description: "Unknown proposal type", details: {} };
    }
  } catch {
    return { description: "Unable to decode proposal data", details: {} };
  }
}
