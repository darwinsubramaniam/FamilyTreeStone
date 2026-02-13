export enum Gender {
  Male = 0,
  Female = 1,
  Other = 2,
}

export enum ProposalType {
  AddPerson = 0,
  UpdatePerson = 1,
  CreateCouple = 2,
  AddChildToCouple = 3,
}

export enum ProposalStatus {
  Pending = 0,
  Executed = 1,
  Cancelled = 2,
}

export interface Person {
  id: bigint;
  name: string;
  dob: bigint;
  gender: Gender;
  profileURI: string;
  exists: boolean;
}

export interface CoupleNode {
  id: bigint;
  partner1Id: bigint;
  partner2Id: bigint;
  childrenIds: readonly bigint[];
  exists: boolean;
}

export interface Tree {
  id: bigint;
  name: string;
  creator: `0x${string}`;
  rootPersonId: bigint;
  rootCoupleId: bigint;
  approvalThreshold: bigint;
  exists: boolean;
}

export interface CrossTreeCouple {
  id: bigint;
  partner1Id: bigint;
  partner2Id: bigint;
  tree1Id: bigint;
  tree2Id: bigint;
  childrenIds: readonly bigint[];
  approved: boolean;
  exists: boolean;
}

export interface PersonInput {
  name: string;
  dob: bigint;
  gender: Gender;
  profileURI: string;
}

export interface Proposal {
  id: bigint;
  treeId: bigint;
  proposalType: ProposalType;
  proposer: `0x${string}`;
  status: ProposalStatus;
  approvalCount: bigint;
  data: `0x${string}`;
}

export type UserRole = "creator" | "admin" | "editor" | "none";

export type TreeHierarchyNode = CoupleHierarchyNode | PersonHierarchyNode;

export interface CoupleHierarchyNode {
  type: "couple";
  coupleId: bigint;
  partner1: Person;
  partner2: Person;
  children: TreeHierarchyNode[];
  crossTree?: boolean;
}

export interface PersonHierarchyNode {
  type: "person";
  person: Person;
  children: TreeHierarchyNode[];
}

export const GENDER_LABELS: Record<Gender, string> = {
  [Gender.Male]: "Male",
  [Gender.Female]: "Female",
  [Gender.Other]: "Other",
};

export const PROPOSAL_TYPE_LABELS: Record<ProposalType, string> = {
  [ProposalType.AddPerson]: "Add Person",
  [ProposalType.UpdatePerson]: "Update Person",
  [ProposalType.CreateCouple]: "Create Couple",
  [ProposalType.AddChildToCouple]: "Add Child to Couple",
};

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  [ProposalStatus.Pending]: "Pending",
  [ProposalStatus.Executed]: "Executed",
  [ProposalStatus.Cancelled]: "Cancelled",
};
