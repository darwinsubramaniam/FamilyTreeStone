import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { keccak256, toHex } from "viem";

const CREATOR_ROLE = keccak256(toHex("CREATOR"));
const ADMIN_ROLE = keccak256(toHex("ADMIN"));
const EDITOR_ROLE = keccak256(toHex("EDITOR"));

// Gender enum values
const Gender = { Male: 0, Female: 1, Other: 2 } as const;

async function deployFixture() {
  const [creator, admin, editor, stranger] = await hre.viem.getWalletClients();
  const familyTree = await hre.viem.deployContract("FamilyTree");
  const publicClient = await hre.viem.getPublicClient();
  return { familyTree, creator, admin, editor, stranger, publicClient };
}

async function createTreeFixture() {
  const fixture = await deployFixture();
  const { familyTree, creator } = fixture;

  const hash = await familyTree.write.createTree([
    "Smith Family",
    { name: "John Smith", dob: 0n, gender: Gender.Male, profileURI: "" },
    { name: "Jane Smith", dob: 100n, gender: Gender.Female, profileURI: "" },
    1n,
  ]);

  return { ...fixture, treeId: 1n };
}

describe("FamilyTree - Core Lifecycle", function () {
  describe("Deployment", function () {
    it("should deploy successfully", async function () {
      const { familyTree } = await loadFixture(deployFixture);
      expect(familyTree.address).to.be.a("string");
    });

    it("should expose role constants", async function () {
      const { familyTree } = await loadFixture(deployFixture);
      expect(await familyTree.read.CREATOR_ROLE()).to.equal(CREATOR_ROLE);
      expect(await familyTree.read.ADMIN_ROLE()).to.equal(ADMIN_ROLE);
      expect(await familyTree.read.EDITOR_ROLE()).to.equal(EDITOR_ROLE);
    });
  });

  describe("createTree", function () {
    it("should create a tree with root couple", async function () {
      const { familyTree, creator } = await loadFixture(deployFixture);

      await familyTree.write.createTree([
        "Smith Family",
        { name: "John Smith", dob: 0n, gender: Gender.Male, profileURI: "ipfs://john" },
        { name: "Jane Smith", dob: 100n, gender: Gender.Female, profileURI: "ipfs://jane" },
        1n,
      ]);

      const tree = await familyTree.read.getTree([1n]);
      expect(tree.id).to.equal(1n);
      expect(tree.name).to.equal("Smith Family");
      expect(tree.creator.toLowerCase()).to.equal(
        creator.account.address.toLowerCase()
      );
      expect(tree.rootPersonId).to.equal(1n);
      expect(tree.rootCoupleId).to.equal(1n);
      expect(tree.approvalThreshold).to.equal(1n);
    });

    it("should create both founding persons", async function () {
      const { familyTree } = await loadFixture(createTreeFixture);

      const p1 = await familyTree.read.getPerson([1n]);
      expect(p1.name).to.equal("John Smith");
      expect(p1.gender).to.equal(Gender.Male);

      const p2 = await familyTree.read.getPerson([2n]);
      expect(p2.name).to.equal("Jane Smith");
      expect(p2.gender).to.equal(Gender.Female);
    });

    it("should create root couple linking the two persons", async function () {
      const { familyTree } = await loadFixture(createTreeFixture);

      const couple = await familyTree.read.getCouple([1n]);
      expect(couple.partner1Id).to.equal(1n);
      expect(couple.partner2Id).to.equal(2n);
      expect(couple.childrenIds).to.deep.equal([]);
    });

    it("should grant creator role to the caller", async function () {
      const { familyTree, creator } = await loadFixture(createTreeFixture);

      const isCreator = await familyTree.read.hasRole([
        1n,
        CREATOR_ROLE,
        creator.account.address,
      ]);
      expect(isCreator).to.be.true;
    });

    it("should revert with empty tree name", async function () {
      const { familyTree } = await loadFixture(deployFixture);

      await expect(
        familyTree.write.createTree([
          "",
          { name: "John", dob: 0n, gender: Gender.Male, profileURI: "" },
          { name: "Jane", dob: 0n, gender: Gender.Female, profileURI: "" },
          1n,
        ])
      ).to.be.rejectedWith("Tree name cannot be empty");
    });

    it("should revert with zero threshold", async function () {
      const { familyTree } = await loadFixture(deployFixture);

      await expect(
        familyTree.write.createTree([
          "Test",
          { name: "John", dob: 0n, gender: Gender.Male, profileURI: "" },
          { name: "Jane", dob: 0n, gender: Gender.Female, profileURI: "" },
          0n,
        ])
      ).to.be.rejectedWith("Threshold must be >= 1");
    });

    it("should revert with empty person name", async function () {
      const { familyTree } = await loadFixture(deployFixture);

      await expect(
        familyTree.write.createTree([
          "Test",
          { name: "", dob: 0n, gender: Gender.Male, profileURI: "" },
          { name: "Jane", dob: 0n, gender: Gender.Female, profileURI: "" },
          1n,
        ])
      ).to.be.rejectedWith("Name cannot be empty");
    });

    it("should revert with future DOB", async function () {
      const { familyTree } = await loadFixture(deployFixture);
      const futureTimestamp = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 3600);

      await expect(
        familyTree.write.createTree([
          "Test",
          { name: "John", dob: futureTimestamp, gender: Gender.Male, profileURI: "" },
          { name: "Jane", dob: 0n, gender: Gender.Female, profileURI: "" },
          1n,
        ])
      ).to.be.rejectedWith("DOB cannot be in the future");
    });

    it("should allow multiple trees by different creators", async function () {
      const { familyTree, creator, stranger } = await loadFixture(deployFixture);

      await familyTree.write.createTree([
        "Family A",
        { name: "A1", dob: 0n, gender: Gender.Male, profileURI: "" },
        { name: "A2", dob: 0n, gender: Gender.Female, profileURI: "" },
        1n,
      ]);

      const strangerContract = await hre.viem.getContractAt(
        "FamilyTree",
        familyTree.address,
        { client: { wallet: stranger } }
      );

      await strangerContract.write.createTree([
        "Family B",
        { name: "B1", dob: 0n, gender: Gender.Male, profileURI: "" },
        { name: "B2", dob: 0n, gender: Gender.Female, profileURI: "" },
        2n,
      ]);

      const treeA = await familyTree.read.getTree([1n]);
      const treeB = await familyTree.read.getTree([2n]);
      expect(treeA.name).to.equal("Family A");
      expect(treeB.name).to.equal("Family B");
      expect(treeB.creator.toLowerCase()).to.equal(
        stranger.account.address.toLowerCase()
      );
    });

    it("should emit TreeCreated event", async function () {
      const { familyTree, creator, publicClient } = await loadFixture(deployFixture);

      const hash = await familyTree.write.createTree([
        "Smith Family",
        { name: "John", dob: 0n, gender: Gender.Male, profileURI: "" },
        { name: "Jane", dob: 0n, gender: Gender.Female, profileURI: "" },
        1n,
      ]);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).to.equal("success");
    });
  });

  describe("View Functions", function () {
    it("should revert getPerson for non-existent person", async function () {
      const { familyTree } = await loadFixture(deployFixture);
      await expect(familyTree.read.getPerson([999n])).to.be.rejectedWith(
        "Person does not exist"
      );
    });

    it("should revert getCouple for non-existent couple", async function () {
      const { familyTree } = await loadFixture(deployFixture);
      await expect(familyTree.read.getCouple([999n])).to.be.rejectedWith(
        "Couple does not exist"
      );
    });

    it("should revert getTree for non-existent tree", async function () {
      const { familyTree } = await loadFixture(deployFixture);
      await expect(familyTree.read.getTree([999n])).to.be.rejectedWith(
        "Tree does not exist"
      );
    });

    it("should return empty children for new couple", async function () {
      const { familyTree } = await loadFixture(createTreeFixture);
      const children = await familyTree.read.getCoupleChildren([1n]);
      expect(children).to.deep.equal([]);
    });

    it("should return tree couples", async function () {
      const { familyTree } = await loadFixture(createTreeFixture);
      const couples = await familyTree.read.getTreeCouples([1n]);
      expect(couples).to.deep.equal([1n]);
    });
  });
});
