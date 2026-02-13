import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { keccak256, toHex } from "viem";

const CREATOR_ROLE = keccak256(toHex("CREATOR"));
const ADMIN_ROLE = keccak256(toHex("ADMIN"));
const EDITOR_ROLE = keccak256(toHex("EDITOR"));

const Gender = { Male: 0, Female: 1, Other: 2 } as const;
const ProposalStatus = { Pending: 0, Executed: 1, Cancelled: 2 } as const;
const ProposalType = {
  AddPerson: 0,
  UpdatePerson: 1,
  CreateCouple: 2,
  AddChildToCouple: 3,
} as const;

async function proposalFixture() {
  const [creator, admin, editor1, editor2] = await hre.viem.getWalletClients();
  const familyTree = await hre.viem.deployContract("FamilyTree");
  const publicClient = await hre.viem.getPublicClient();

  // Create a tree with threshold=1
  await familyTree.write.createTree([
    "Smith Family",
    { name: "John", dob: 0n, gender: Gender.Male, profileURI: "" },
    { name: "Jane", dob: 0n, gender: Gender.Female, profileURI: "" },
    1n,
  ]);

  // Grant editor roles
  await familyTree.write.grantEditor([1n, editor1.account.address]);
  await familyTree.write.grantEditor([1n, editor2.account.address]);

  // Grant admin role
  await familyTree.write.grantAdmin([1n, admin.account.address]);

  const asCreator = familyTree;
  const asAdmin = await hre.viem.getContractAt("FamilyTree", familyTree.address, {
    client: { wallet: admin },
  });
  const asEditor1 = await hre.viem.getContractAt("FamilyTree", familyTree.address, {
    client: { wallet: editor1 },
  });
  const asEditor2 = await hre.viem.getContractAt("FamilyTree", familyTree.address, {
    client: { wallet: editor2 },
  });

  return {
    familyTree,
    creator,
    admin,
    editor1,
    editor2,
    asCreator,
    asAdmin,
    asEditor1,
    asEditor2,
    publicClient,
    treeId: 1n,
  };
}

describe("FamilyTree - Proposal System", function () {
  describe("proposeAddPerson", function () {
    it("should allow editor to propose adding a person", async function () {
      const { asEditor1, treeId } = await loadFixture(proposalFixture);

      await asEditor1.write.proposeAddPerson([
        treeId,
        "New Person",
        100n,
        Gender.Male,
        "ipfs://new",
      ]);

      const proposal = await asEditor1.read.getProposal([1n]);
      expect(proposal.treeId).to.equal(treeId);
      expect(proposal.proposalType).to.equal(ProposalType.AddPerson);
      expect(proposal.status).to.equal(ProposalStatus.Pending);
      expect(proposal.approvalCount).to.equal(0n);
    });

    it("should revert if caller is not an editor", async function () {
      const { asAdmin, treeId } = await loadFixture(proposalFixture);

      await expect(
        asAdmin.write.proposeAddPerson([treeId, "X", 0n, Gender.Male, ""])
      ).to.be.rejectedWith("Caller is not an editor");
    });

    it("should revert with empty name", async function () {
      const { asEditor1, treeId } = await loadFixture(proposalFixture);

      await expect(
        asEditor1.write.proposeAddPerson([treeId, "", 0n, Gender.Male, ""])
      ).to.be.rejectedWith("Name cannot be empty");
    });
  });

  describe("proposeUpdatePerson", function () {
    it("should allow editor to propose updating a person", async function () {
      const { asEditor1, treeId } = await loadFixture(proposalFixture);

      await asEditor1.write.proposeUpdatePerson([
        treeId,
        1n,
        "Updated John",
        "ipfs://updated",
      ]);

      const proposal = await asEditor1.read.getProposal([1n]);
      expect(proposal.proposalType).to.equal(ProposalType.UpdatePerson);
    });

    it("should revert for non-existent person", async function () {
      const { asEditor1, treeId } = await loadFixture(proposalFixture);

      await expect(
        asEditor1.write.proposeUpdatePerson([treeId, 999n, "X", ""])
      ).to.be.rejectedWith("Person does not exist");
    });
  });

  describe("proposeCreateCouple", function () {
    it("should allow editor to propose creating a couple", async function () {
      const { familyTree, asEditor1, treeId } = await loadFixture(proposalFixture);

      // Add two unpartnered people first (as creator/admin)
      await familyTree.write.addPerson([treeId, "Son", 200n, Gender.Male, ""]);
      await familyTree.write.addPerson([treeId, "DIL", 200n, Gender.Female, ""]);

      await asEditor1.write.proposeCreateCouple([treeId, 3n, 4n]);

      const proposal = await asEditor1.read.getProposal([1n]);
      expect(proposal.proposalType).to.equal(ProposalType.CreateCouple);
    });

    it("should allow proposing couple for person already in a couple", async function () {
      const { familyTree, asEditor1, treeId } = await loadFixture(proposalFixture);

      // Add a third person so person 1 can form a second couple
      await familyTree.write.addPerson([treeId, "Third", 200n, Gender.Female, ""]);

      // Person 1 is already in root couple, but can be proposed for another
      await asEditor1.write.proposeCreateCouple([treeId, 1n, 3n]);

      const proposal = await asEditor1.read.getProposal([1n]);
      expect(proposal.proposalType).to.equal(ProposalType.CreateCouple);
    });
  });

  describe("proposeAddChildToCouple", function () {
    it("should allow editor to propose adding child to couple", async function () {
      const { familyTree, asEditor1, treeId } = await loadFixture(proposalFixture);

      // Add a child person
      await familyTree.write.addPerson([treeId, "Child", 300n, Gender.Female, ""]);

      await asEditor1.write.proposeAddChildToCouple([treeId, 1n, 3n]);

      const proposal = await asEditor1.read.getProposal([1n]);
      expect(proposal.proposalType).to.equal(ProposalType.AddChildToCouple);
    });

    it("should revert if child already has biological parents", async function () {
      const { familyTree, asEditor1, treeId } = await loadFixture(proposalFixture);

      await familyTree.write.addPerson([treeId, "Child", 300n, Gender.Female, ""]);
      await familyTree.write.addChildToCouple([treeId, 1n, 3n]);

      await expect(
        asEditor1.write.proposeAddChildToCouple([treeId, 1n, 3n])
      ).to.be.rejectedWith("Child already has biological parents");
    });
  });

  describe("approveProposal", function () {
    it("should allow admin to approve and auto-execute (threshold=1)", async function () {
      const { asEditor1, asAdmin, treeId } = await loadFixture(proposalFixture);

      // Editor proposes
      await asEditor1.write.proposeAddPerson([
        treeId,
        "Proposed Person",
        100n,
        Gender.Male,
        "",
      ]);

      // Admin approves → auto-executes
      await asAdmin.write.approveProposal([1n]);

      const proposal = await asEditor1.read.getProposal([1n]);
      expect(proposal.status).to.equal(ProposalStatus.Executed);
      expect(proposal.approvalCount).to.equal(1n);

      // Person should now exist
      const person = await asEditor1.read.getPerson([3n]);
      expect(person.name).to.equal("Proposed Person");
    });

    it("should allow creator to approve", async function () {
      const { asEditor1, asCreator, treeId } = await loadFixture(proposalFixture);

      await asEditor1.write.proposeAddPerson([treeId, "P", 0n, Gender.Male, ""]);
      await asCreator.write.approveProposal([1n]);

      const proposal = await asEditor1.read.getProposal([1n]);
      expect(proposal.status).to.equal(ProposalStatus.Executed);
    });

    it("should allow another editor to approve", async function () {
      const { asEditor1, asEditor2, treeId } = await loadFixture(proposalFixture);

      await asEditor1.write.proposeAddPerson([treeId, "P", 0n, Gender.Male, ""]);
      await asEditor2.write.approveProposal([1n]);

      const proposal = await asEditor1.read.getProposal([1n]);
      expect(proposal.status).to.equal(ProposalStatus.Executed);
    });

    it("should NOT auto-execute if threshold not met", async function () {
      const { familyTree, asEditor1, asEditor2, treeId } =
        await loadFixture(proposalFixture);

      // Set threshold to 2
      await familyTree.write.setApprovalThreshold([treeId, 2n]);

      await asEditor1.write.proposeAddPerson([treeId, "P", 0n, Gender.Male, ""]);
      await asEditor2.write.approveProposal([1n]);

      const proposal = await asEditor1.read.getProposal([1n]);
      expect(proposal.status).to.equal(ProposalStatus.Pending);
      expect(proposal.approvalCount).to.equal(1n);
    });

    it("should auto-execute when threshold is reached", async function () {
      const { familyTree, asEditor1, asEditor2, asAdmin, treeId } =
        await loadFixture(proposalFixture);

      // Set threshold to 2
      await familyTree.write.setApprovalThreshold([treeId, 2n]);

      await asEditor1.write.proposeAddPerson([treeId, "P", 0n, Gender.Male, ""]);

      // First approval
      await asEditor2.write.approveProposal([1n]);
      let proposal = await asEditor1.read.getProposal([1n]);
      expect(proposal.status).to.equal(ProposalStatus.Pending);

      // Second approval → execute
      await asAdmin.write.approveProposal([1n]);
      proposal = await asEditor1.read.getProposal([1n]);
      expect(proposal.status).to.equal(ProposalStatus.Executed);
    });

    it("should revert if proposer tries to self-approve", async function () {
      const { asEditor1, treeId } = await loadFixture(proposalFixture);

      await asEditor1.write.proposeAddPerson([treeId, "P", 0n, Gender.Male, ""]);

      await expect(asEditor1.write.approveProposal([1n])).to.be.rejectedWith(
        "Proposer cannot self-approve"
      );
    });

    it("should revert if caller has no role", async function () {
      const { asEditor1, treeId } = await loadFixture(proposalFixture);
      const [, , , , noRole] = await hre.viem.getWalletClients();

      await asEditor1.write.proposeAddPerson([treeId, "P", 0n, Gender.Male, ""]);

      const asNoRole = await hre.viem.getContractAt(
        "FamilyTree",
        asEditor1.address,
        { client: { wallet: noRole } }
      );

      await expect(asNoRole.write.approveProposal([1n])).to.be.rejectedWith(
        "Caller has no role in this tree"
      );
    });

    it("should revert if already approved", async function () {
      const { familyTree, asEditor1, asAdmin, treeId } =
        await loadFixture(proposalFixture);

      // Need threshold > 1 to test double-approval
      await familyTree.write.setApprovalThreshold([treeId, 3n]);

      await asEditor1.write.proposeAddPerson([treeId, "P", 0n, Gender.Male, ""]);
      await asAdmin.write.approveProposal([1n]);

      await expect(asAdmin.write.approveProposal([1n])).to.be.rejectedWith(
        "Already approved"
      );
    });

    it("should revert for non-existent proposal", async function () {
      const { asAdmin } = await loadFixture(proposalFixture);

      await expect(asAdmin.write.approveProposal([999n])).to.be.rejectedWith(
        "Proposal does not exist"
      );
    });

    it("should track who approved via hasApproved", async function () {
      const { familyTree, asEditor1, asAdmin, admin, editor1, treeId } =
        await loadFixture(proposalFixture);

      await familyTree.write.setApprovalThreshold([treeId, 3n]);
      await asEditor1.write.proposeAddPerson([treeId, "P", 0n, Gender.Male, ""]);
      await asAdmin.write.approveProposal([1n]);

      expect(await familyTree.read.hasApproved([1n, admin.account.address])).to.be.true;
      expect(await familyTree.read.hasApproved([1n, editor1.account.address])).to.be.false;
    });
  });

  describe("cancelProposal", function () {
    it("should allow proposer to cancel", async function () {
      const { asEditor1, treeId } = await loadFixture(proposalFixture);

      await asEditor1.write.proposeAddPerson([treeId, "P", 0n, Gender.Male, ""]);
      await asEditor1.write.cancelProposal([1n]);

      const proposal = await asEditor1.read.getProposal([1n]);
      expect(proposal.status).to.equal(ProposalStatus.Cancelled);
    });

    it("should allow creator to cancel", async function () {
      const { asEditor1, asCreator, treeId } = await loadFixture(proposalFixture);

      await asEditor1.write.proposeAddPerson([treeId, "P", 0n, Gender.Male, ""]);
      await asCreator.write.cancelProposal([1n]);

      const proposal = await asEditor1.read.getProposal([1n]);
      expect(proposal.status).to.equal(ProposalStatus.Cancelled);
    });

    it("should allow admin to cancel", async function () {
      const { asEditor1, asAdmin, treeId } = await loadFixture(proposalFixture);

      await asEditor1.write.proposeAddPerson([treeId, "P", 0n, Gender.Male, ""]);
      await asAdmin.write.cancelProposal([1n]);

      const proposal = await asEditor1.read.getProposal([1n]);
      expect(proposal.status).to.equal(ProposalStatus.Cancelled);
    });

    it("should revert if another editor tries to cancel", async function () {
      const { asEditor1, asEditor2, treeId } = await loadFixture(proposalFixture);

      await asEditor1.write.proposeAddPerson([treeId, "P", 0n, Gender.Male, ""]);

      await expect(asEditor2.write.cancelProposal([1n])).to.be.rejectedWith(
        "Not authorized to cancel"
      );
    });

    it("should revert if proposal already executed", async function () {
      const { asEditor1, asAdmin, treeId } = await loadFixture(proposalFixture);

      await asEditor1.write.proposeAddPerson([treeId, "P", 0n, Gender.Male, ""]);
      await asAdmin.write.approveProposal([1n]);

      await expect(asEditor1.write.cancelProposal([1n])).to.be.rejectedWith(
        "Proposal is not pending"
      );
    });

    it("should revert if proposal already cancelled", async function () {
      const { asEditor1, treeId } = await loadFixture(proposalFixture);

      await asEditor1.write.proposeAddPerson([treeId, "P", 0n, Gender.Male, ""]);
      await asEditor1.write.cancelProposal([1n]);

      await expect(asEditor1.write.cancelProposal([1n])).to.be.rejectedWith(
        "Proposal is not pending"
      );
    });

    it("should not allow approval after cancel", async function () {
      const { asEditor1, asAdmin, treeId } = await loadFixture(proposalFixture);

      await asEditor1.write.proposeAddPerson([treeId, "P", 0n, Gender.Male, ""]);
      await asEditor1.write.cancelProposal([1n]);

      await expect(asAdmin.write.approveProposal([1n])).to.be.rejectedWith(
        "Proposal is not pending"
      );
    });
  });

  describe("Proposal execution - UpdatePerson", function () {
    it("should execute update person proposal", async function () {
      const { asEditor1, asAdmin, treeId } = await loadFixture(proposalFixture);

      await asEditor1.write.proposeUpdatePerson([
        treeId,
        1n,
        "Updated Name",
        "ipfs://updated",
      ]);
      await asAdmin.write.approveProposal([1n]);

      const person = await asEditor1.read.getPerson([1n]);
      expect(person.name).to.equal("Updated Name");
      expect(person.profileURI).to.equal("ipfs://updated");
    });
  });

  describe("Proposal execution - CreateCouple", function () {
    it("should execute create couple proposal", async function () {
      const { familyTree, asEditor1, asAdmin, treeId } =
        await loadFixture(proposalFixture);

      // Add two people first
      await familyTree.write.addPerson([treeId, "Son", 200n, Gender.Male, ""]);
      await familyTree.write.addPerson([treeId, "DIL", 200n, Gender.Female, ""]);

      await asEditor1.write.proposeCreateCouple([treeId, 3n, 4n]);
      await asAdmin.write.approveProposal([1n]);

      const couple = await familyTree.read.getCouple([2n]);
      expect(couple.partner1Id).to.equal(3n);
      expect(couple.partner2Id).to.equal(4n);
    });
  });

  describe("Proposal execution - AddChildToCouple", function () {
    it("should execute add child to couple proposal", async function () {
      const { familyTree, asEditor1, asAdmin, treeId } =
        await loadFixture(proposalFixture);

      // Add a child
      await familyTree.write.addPerson([treeId, "Child", 300n, Gender.Male, ""]);

      await asEditor1.write.proposeAddChildToCouple([treeId, 1n, 3n]);
      await asAdmin.write.approveProposal([1n]);

      const children = await familyTree.read.getCoupleChildren([1n]);
      expect(children).to.deep.equal([3n]);
    });
  });
});
