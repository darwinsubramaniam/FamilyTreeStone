import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { keccak256, toHex } from "viem";

const ADMIN_ROLE = keccak256(toHex("ADMIN"));
const Gender = { Male: 0, Female: 1, Other: 2 } as const;

async function treeFixture() {
  const [creator, admin, editor, stranger] = await hre.viem.getWalletClients();
  const familyTree = await hre.viem.deployContract("FamilyTree");
  const publicClient = await hre.viem.getPublicClient();

  await familyTree.write.createTree([
    "Smith Family",
    { name: "John Smith", dob: 0n, gender: Gender.Male, profileURI: "" },
    { name: "Jane Smith", dob: 100n, gender: Gender.Female, profileURI: "" },
    1n,
  ]);

  const asAdmin = await hre.viem.getContractAt("FamilyTree", familyTree.address, {
    client: { wallet: admin },
  });
  const asStranger = await hre.viem.getContractAt("FamilyTree", familyTree.address, {
    client: { wallet: stranger },
  });

  return { familyTree, creator, admin, editor, stranger, asAdmin, asStranger, publicClient, treeId: 1n };
}

describe("FamilyTree - Tree Structure Operations", function () {
  describe("addPerson", function () {
    it("should allow creator to add a person", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      await familyTree.write.addPerson([
        treeId,
        "Child Smith",
        200n,
        Gender.Male,
        "ipfs://child",
      ]);

      const person = await familyTree.read.getPerson([3n]);
      expect(person.name).to.equal("Child Smith");
      expect(person.dob).to.equal(200n);
      expect(person.gender).to.equal(Gender.Male);
      expect(person.profileURI).to.equal("ipfs://child");
    });

    it("should allow admin to add a person", async function () {
      const { familyTree, admin, asAdmin, treeId } = await loadFixture(treeFixture);

      await familyTree.write.grantAdmin([treeId, admin.account.address]);

      await asAdmin.write.addPerson([treeId, "New Person", 0n, Gender.Female, ""]);

      const person = await familyTree.read.getPerson([3n]);
      expect(person.name).to.equal("New Person");
    });

    it("should revert if caller is not creator or admin", async function () {
      const { asStranger, treeId } = await loadFixture(treeFixture);

      await expect(
        asStranger.write.addPerson([treeId, "Bad", 0n, Gender.Male, ""])
      ).to.be.rejectedWith("Caller is not creator or admin");
    });

    it("should revert with empty name", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      await expect(
        familyTree.write.addPerson([treeId, "", 0n, Gender.Male, ""])
      ).to.be.rejectedWith("Name cannot be empty");
    });

    it("should revert with future DOB", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);
      const futureTs = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 3600);

      await expect(
        familyTree.write.addPerson([treeId, "Future", futureTs, Gender.Male, ""])
      ).to.be.rejectedWith("DOB cannot be in the future");
    });
  });

  describe("updatePerson", function () {
    it("should allow creator to update a person", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      await familyTree.write.updatePerson([
        treeId,
        1n,
        "John S. Smith",
        "ipfs://updated",
      ]);

      const person = await familyTree.read.getPerson([1n]);
      expect(person.name).to.equal("John S. Smith");
      expect(person.profileURI).to.equal("ipfs://updated");
    });

    it("should revert for person not in the tree", async function () {
      const { familyTree, stranger, treeId } = await loadFixture(treeFixture);

      // Create second tree
      const asStranger = await hre.viem.getContractAt(
        "FamilyTree",
        familyTree.address,
        { client: { wallet: stranger } }
      );
      await asStranger.write.createTree([
        "Other Family",
        { name: "X", dob: 0n, gender: Gender.Male, profileURI: "" },
        { name: "Y", dob: 0n, gender: Gender.Female, profileURI: "" },
        1n,
      ]);

      // Try to update person from tree 2 in tree 1
      await expect(
        familyTree.write.updatePerson([treeId, 3n, "Hacked", ""])
      ).to.be.rejectedWith("Person not in this tree");
    });

    it("should revert with empty name", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      await expect(
        familyTree.write.updatePerson([treeId, 1n, "", ""])
      ).to.be.rejectedWith("Name cannot be empty");
    });
  });

  describe("createCouple", function () {
    it("should create a couple from two persons in the tree", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      // Add two new persons
      await familyTree.write.addPerson([treeId, "Son", 200n, Gender.Male, ""]);
      await familyTree.write.addPerson([treeId, "Daughter-in-law", 200n, Gender.Female, ""]);

      await familyTree.write.createCouple([treeId, 3n, 4n]);

      const couple = await familyTree.read.getCouple([2n]);
      expect(couple.partner1Id).to.equal(3n);
      expect(couple.partner2Id).to.equal(4n);
    });

    it("should revert if coupling with self", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      await familyTree.write.addPerson([treeId, "Solo", 0n, Gender.Male, ""]);

      await expect(
        familyTree.write.createCouple([treeId, 3n, 3n])
      ).to.be.rejectedWith("Cannot couple with self");
    });

    it("should allow a person to be in multiple couples", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      // Person 1 is already in root couple with person 2
      await familyTree.write.addPerson([treeId, "Third", 0n, Gender.Male, ""]);

      // Person 1 can form another couple with person 3
      await familyTree.write.createCouple([treeId, 1n, 3n]);

      const couples = await familyTree.read.getPersonCouples([1n]);
      expect(couples.length).to.equal(2);
    });

    it("should track couples in tree", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      await familyTree.write.addPerson([treeId, "Son", 200n, Gender.Male, ""]);
      await familyTree.write.addPerson([treeId, "DIL", 200n, Gender.Female, ""]);
      await familyTree.write.createCouple([treeId, 3n, 4n]);

      const couples = await familyTree.read.getTreeCouples([treeId]);
      expect(couples).to.deep.equal([1n, 2n]);
    });
  });

  describe("addChildToCouple", function () {
    it("should add a child to a couple", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      await familyTree.write.addPerson([treeId, "Child", 200n, Gender.Male, ""]);
      await familyTree.write.addChildToCouple([treeId, 1n, 3n]);

      const children = await familyTree.read.getCoupleChildren([1n]);
      expect(children).to.deep.equal([3n]);
    });

    it("should add multiple children", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      await familyTree.write.addPerson([treeId, "Child 1", 200n, Gender.Male, ""]);
      await familyTree.write.addPerson([treeId, "Child 2", 300n, Gender.Female, ""]);
      await familyTree.write.addChildToCouple([treeId, 1n, 3n]);
      await familyTree.write.addChildToCouple([treeId, 1n, 4n]);

      const children = await familyTree.read.getCoupleChildren([1n]);
      expect(children).to.deep.equal([3n, 4n]);
    });

    it("should revert if child already has parents", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      await familyTree.write.addPerson([treeId, "Child", 200n, Gender.Male, ""]);
      await familyTree.write.addChildToCouple([treeId, 1n, 3n]);

      // Try to add same child to another couple
      await familyTree.write.addPerson([treeId, "S1", 0n, Gender.Male, ""]);
      await familyTree.write.addPerson([treeId, "S2", 0n, Gender.Female, ""]);
      await familyTree.write.createCouple([treeId, 4n, 5n]);

      await expect(
        familyTree.write.addChildToCouple([treeId, 2n, 3n])
      ).to.be.rejectedWith("Child already has biological parents");
    });

    it("should revert if couple does not exist", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      await familyTree.write.addPerson([treeId, "Child", 200n, Gender.Male, ""]);

      await expect(
        familyTree.write.addChildToCouple([treeId, 999n, 3n])
      ).to.be.rejectedWith("Couple does not exist");
    });
  });

  describe("Multi-generation scenario", function () {
    it("should support 3 generations", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      // Gen 1: Root couple (persons 1 & 2, couple 1) - already created

      // Gen 2: Add child + spouse, form couple
      await familyTree.write.addPerson([treeId, "Son Smith", 200n, Gender.Male, ""]);       // person 3
      await familyTree.write.addChildToCouple([treeId, 1n, 3n]);
      await familyTree.write.addPerson([treeId, "Lisa Jones", 200n, Gender.Female, ""]);     // person 4
      await familyTree.write.createCouple([treeId, 3n, 4n]);                                 // couple 2

      // Gen 3: Add grandchild
      await familyTree.write.addPerson([treeId, "Grandchild", 400n, Gender.Female, ""]);    // person 5
      await familyTree.write.addChildToCouple([treeId, 2n, 5n]);

      // Verify structure
      const rootCouple = await familyTree.read.getCouple([1n]);
      expect(rootCouple.childrenIds).to.deep.equal([3n]);

      const gen2Couple = await familyTree.read.getCouple([2n]);
      expect(gen2Couple.partner1Id).to.equal(3n);
      expect(gen2Couple.partner2Id).to.equal(4n);
      expect(gen2Couple.childrenIds).to.deep.equal([5n]);

      const grandchild = await familyTree.read.getPerson([5n]);
      expect(grandchild.name).to.equal("Grandchild");

      const treeCouples = await familyTree.read.getTreeCouples([treeId]);
      expect(treeCouples).to.deep.equal([1n, 2n]);
    });
  });

  describe("getTreePersons (paginated)", function () {
    it("should return all persons for a tree", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      // Tree already has 2 founding persons (1, 2)
      const [personIds, total] = await familyTree.read.getTreePersons([treeId, 0n, 10n]);
      expect(total).to.equal(2n);
      expect(personIds).to.deep.equal([1n, 2n]);
    });

    it("should paginate with offset and limit", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      // Add more persons to have enough for pagination
      await familyTree.write.addPerson([treeId, "Child1", 200n, Gender.Male, ""]);
      await familyTree.write.addPerson([treeId, "Child2", 300n, Gender.Female, ""]);
      await familyTree.write.addPerson([treeId, "Child3", 400n, Gender.Male, ""]);

      // 5 persons total (1..5). Get page 2: offset=2, limit=2
      const [page, total] = await familyTree.read.getTreePersons([treeId, 2n, 2n]);
      expect(total).to.equal(5n);
      expect(page).to.deep.equal([3n, 4n]);
    });

    it("should return partial page when near end", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      // 2 persons. offset=1, limit=10 → should return [2n]
      const [personIds, total] = await familyTree.read.getTreePersons([treeId, 1n, 10n]);
      expect(total).to.equal(2n);
      expect(personIds).to.deep.equal([2n]);
    });

    it("should return empty array when offset >= total", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      const [personIds, total] = await familyTree.read.getTreePersons([treeId, 100n, 10n]);
      expect(total).to.equal(2n);
      expect(personIds).to.deep.equal([]);
    });

    it("should return empty array when limit is zero", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      const [personIds, total] = await familyTree.read.getTreePersons([treeId, 0n, 0n]);
      expect(total).to.equal(2n);
      expect(personIds).to.deep.equal([]);
    });

    it("should revert for non-existent tree", async function () {
      const { familyTree } = await loadFixture(treeFixture);

      await expect(
        familyTree.read.getTreePersons([999n, 0n, 10n])
      ).to.be.rejectedWith("Tree does not exist");
    });

    it("should include persons added via addPerson", async function () {
      const { familyTree, treeId } = await loadFixture(treeFixture);

      await familyTree.write.addPerson([treeId, "Added", 0n, Gender.Male, ""]);

      const [personIds, total] = await familyTree.read.getTreePersons([treeId, 0n, 10n]);
      expect(total).to.equal(3n);
      expect(personIds).to.deep.equal([1n, 2n, 3n]);
    });

    it("should include persons from single-person tree", async function () {
      const { familyTree } = await loadFixture(treeFixture);

      // Create a second tree as single-person
      await familyTree.write.createTreeSingle([
        "Solo",
        { name: "Solo Person", dob: 0n, gender: Gender.Male, profileURI: "" },
        1n,
      ]);

      const [personIds, total] = await familyTree.read.getTreePersons([2n, 0n, 10n]);
      expect(total).to.equal(1n);
      expect(personIds).to.deep.equal([3n]);
    });
  });
});
