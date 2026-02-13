import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { keccak256, toHex } from "viem";

const CREATOR_ROLE = keccak256(toHex("CREATOR"));

const Gender = { Male: 0, Female: 1, Other: 2 } as const;

async function deployFixture() {
  const [creator, admin, editor, stranger] = await hre.viem.getWalletClients();
  const familyTree = await hre.viem.deployContract("FamilyTree");
  const publicClient = await hre.viem.getPublicClient();
  return { familyTree, creator, admin, editor, stranger, publicClient };
}

async function singleTreeFixture() {
  const fixture = await deployFixture();
  const { familyTree } = fixture;

  await familyTree.write.createTreeSingle([
    "Solo Family",
    { name: "Alice Smith", dob: 0n, gender: Gender.Female, profileURI: "ipfs://alice" },
    1n,
  ]);

  return { ...fixture, treeId: 1n };
}

describe("FamilyTree - Single-Person Tree", function () {
  describe("createTreeSingle", function () {
    it("should create a tree with one person and no root couple", async function () {
      const { familyTree, creator } = await loadFixture(deployFixture);

      await familyTree.write.createTreeSingle([
        "Solo Family",
        { name: "Alice Smith", dob: 0n, gender: Gender.Female, profileURI: "ipfs://alice" },
        1n,
      ]);

      const tree = await familyTree.read.getTree([1n]);
      expect(tree.id).to.equal(1n);
      expect(tree.name).to.equal("Solo Family");
      expect(tree.creator.toLowerCase()).to.equal(
        creator.account.address.toLowerCase()
      );
      expect(tree.rootPersonId).to.equal(1n);
      expect(tree.rootCoupleId).to.equal(0n);
      expect(tree.approvalThreshold).to.equal(1n);
    });

    it("should create the founding person", async function () {
      const { familyTree } = await loadFixture(singleTreeFixture);

      const person = await familyTree.read.getPerson([1n]);
      expect(person.name).to.equal("Alice Smith");
      expect(person.gender).to.equal(Gender.Female);
      expect(person.profileURI).to.equal("ipfs://alice");
    });

    it("should grant creator role to the caller", async function () {
      const { familyTree, creator } = await loadFixture(singleTreeFixture);

      const isCreator = await familyTree.read.hasRole([
        1n,
        CREATOR_ROLE,
        creator.account.address,
      ]);
      expect(isCreator).to.be.true;
    });

    it("should emit TreeCreated event", async function () {
      const { familyTree, publicClient } = await loadFixture(deployFixture);

      const hash = await familyTree.write.createTreeSingle([
        "Solo Family",
        { name: "Alice", dob: 0n, gender: Gender.Female, profileURI: "" },
        1n,
      ]);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).to.equal("success");
    });

    it("should have no couples in the tree", async function () {
      const { familyTree, treeId } = await loadFixture(singleTreeFixture);

      const couples = await familyTree.read.getTreeCouples([treeId]);
      expect(couples).to.deep.equal([]);
    });

    it("should revert with empty tree name", async function () {
      const { familyTree } = await loadFixture(deployFixture);

      await expect(
        familyTree.write.createTreeSingle([
          "",
          { name: "Alice", dob: 0n, gender: Gender.Female, profileURI: "" },
          1n,
        ])
      ).to.be.rejectedWith("Tree name cannot be empty");
    });

    it("should revert with zero threshold", async function () {
      const { familyTree } = await loadFixture(deployFixture);

      await expect(
        familyTree.write.createTreeSingle([
          "Test",
          { name: "Alice", dob: 0n, gender: Gender.Female, profileURI: "" },
          0n,
        ])
      ).to.be.rejectedWith("Threshold must be >= 1");
    });

    it("should revert with empty person name", async function () {
      const { familyTree } = await loadFixture(deployFixture);

      await expect(
        familyTree.write.createTreeSingle([
          "Test",
          { name: "", dob: 0n, gender: Gender.Female, profileURI: "" },
          1n,
        ])
      ).to.be.rejectedWith("Name cannot be empty");
    });

    it("should revert with future DOB", async function () {
      const { familyTree } = await loadFixture(deployFixture);
      const futureTimestamp = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 3600);

      await expect(
        familyTree.write.createTreeSingle([
          "Test",
          { name: "Alice", dob: futureTimestamp, gender: Gender.Female, profileURI: "" },
          1n,
        ])
      ).to.be.rejectedWith("DOB cannot be in the future");
    });
  });

  describe("Adding partner later", function () {
    it("should allow adding a partner and forming a couple after creation", async function () {
      const { familyTree, treeId } = await loadFixture(singleTreeFixture);

      // Add a partner
      await familyTree.write.addPerson([
        treeId,
        "Bob Smith",
        0n,
        Gender.Male,
        "ipfs://bob",
      ]);

      // Form the couple
      await familyTree.write.createCouple([treeId, 1n, 2n]);

      const couple = await familyTree.read.getCouple([1n]);
      expect(couple.partner1Id).to.equal(1n);
      expect(couple.partner2Id).to.equal(2n);

      const couples = await familyTree.read.getTreeCouples([treeId]);
      expect(couples).to.deep.equal([1n]);
    });

    it("should support full family tree from single-person root", async function () {
      const { familyTree, treeId } = await loadFixture(singleTreeFixture);

      // Add partner and form root couple
      await familyTree.write.addPerson([treeId, "Bob Smith", 0n, Gender.Male, ""]);
      await familyTree.write.createCouple([treeId, 1n, 2n]);

      // Add child and assign to couple
      await familyTree.write.addPerson([treeId, "Child Smith", 200n, Gender.Male, ""]);
      await familyTree.write.addChildToCouple([treeId, 1n, 3n]);

      const children = await familyTree.read.getCoupleChildren([1n]);
      expect(children).to.deep.equal([3n]);
    });
  });
});
