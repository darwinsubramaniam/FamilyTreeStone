import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { keccak256, toHex, getAddress } from "viem";

const CREATOR_ROLE = keccak256(toHex("CREATOR"));
const ADMIN_ROLE = keccak256(toHex("ADMIN"));

const Gender = { Male: 0, Female: 1, Other: 2 } as const;

/**
 * Two independent trees owned by different creators.
 * Tree 1 ("Smith Family") — owned by creator1, persons 1 & 2 (root couple), person 5 (child)
 * Tree 2 ("Lee Family")   — owned by creator2, persons 3 & 4 (root couple), person 6 (child)
 */
async function twoTreeFixture() {
  const [creator1, creator2, admin1, admin2, stranger] =
    await hre.viem.getWalletClients();
  const familyTree = await hre.viem.deployContract("FamilyTree");
  const publicClient = await hre.viem.getPublicClient();

  // Tree 1 by creator1
  await familyTree.write.createTree(
    [
      "Smith Family",
      { name: "John Smith", dob: 0n, gender: Gender.Male, profileURI: "" },
      { name: "Jane Smith", dob: 100n, gender: Gender.Female, profileURI: "" },
      1n,
    ],
    { account: creator1.account }
  );

  // Tree 2 by creator2
  await familyTree.write.createTree(
    [
      "Lee Family",
      { name: "Wei Lee", dob: 0n, gender: Gender.Male, profileURI: "" },
      { name: "Mei Lee", dob: 100n, gender: Gender.Female, profileURI: "" },
      1n,
    ],
    { account: creator2.account }
  );

  // Add a child to each tree
  await familyTree.write.addPerson(
    [1n, "Tom Smith", 200n, Gender.Male, ""],
    { account: creator1.account }
  );
  await familyTree.write.addPerson(
    [2n, "Lin Lee", 200n, Gender.Female, ""],
    { account: creator2.account }
  );

  // Add children to root couples
  await familyTree.write.addChildToCouple([1n, 1n, 5n], {
    account: creator1.account,
  });
  await familyTree.write.addChildToCouple([2n, 2n, 6n], {
    account: creator2.account,
  });

  return {
    familyTree,
    creator1,
    creator2,
    admin1,
    admin2,
    stranger,
    publicClient,
    tree1Id: 1n,
    tree2Id: 2n,
    // persons: 1=John, 2=Jane, 3=Wei, 4=Mei, 5=Tom (tree1 child), 6=Lin (tree2 child)
  };
}

/** twoTreeFixture + admins granted on each tree */
async function twoTreeWithAdminsFixture() {
  const base = await twoTreeFixture();
  const { familyTree, creator1, creator2, admin1, admin2 } = base;

  await familyTree.write.grantAdmin([1n, admin1.account.address], {
    account: creator1.account,
  });
  await familyTree.write.grantAdmin([2n, admin2.account.address], {
    account: creator2.account,
  });

  return base;
}

describe("FamilyTree - Cross-Tree Couples", function () {
  // ────────────────── proposeCrossTreeCouple ──────────────────

  describe("proposeCrossTreeCouple", function () {
    it("should create a pending cross-tree couple", async function () {
      const { familyTree, creator1 } = await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });

      const cc = await familyTree.read.getCrossTreeCouple([1n]);
      expect(cc.id).to.equal(1n);
      expect(cc.partner1Id).to.equal(5n);
      expect(cc.partner2Id).to.equal(6n);
      expect(cc.tree1Id).to.equal(1n);
      expect(cc.tree2Id).to.equal(2n);
      expect(cc.approved).to.equal(false);
      expect(cc.exists).to.equal(true);
      expect(cc.childrenIds.length).to.equal(0);
    });

    it("should emit CrossTreeCoupleProposed event", async function () {
      const { familyTree, creator1, publicClient } =
        await loadFixture(twoTreeFixture);

      const hash = await familyTree.write.proposeCrossTreeCouple(
        [1n, 2n, 5n, 6n],
        { account: creator1.account }
      );

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = receipt.logs.find(
        (l) => l.topics.length > 0
      );
      expect(event).to.not.be.undefined;
    });

    it("should allow tree2 creator to propose", async function () {
      const { familyTree, creator2 } = await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator2.account,
      });

      const cc = await familyTree.read.getCrossTreeCouple([1n]);
      expect(cc.exists).to.equal(true);
    });

    it("should register cross couple for both trees", async function () {
      const { familyTree, creator1 } = await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });

      const tree1Couples = await familyTree.read.getTreeCrossCouples([1n]);
      const tree2Couples = await familyTree.read.getTreeCrossCouples([2n]);
      expect(tree1Couples).to.deep.equal([1n]);
      expect(tree2Couples).to.deep.equal([1n]);
    });

    it("should revert if trees are the same", async function () {
      const { familyTree, creator1 } = await loadFixture(twoTreeFixture);

      await expect(
        familyTree.write.proposeCrossTreeCouple([1n, 1n, 1n, 2n], {
          account: creator1.account,
        })
      ).to.be.rejectedWith("Trees must be different");
    });

    it("should revert if tree does not exist", async function () {
      const { familyTree, creator1 } = await loadFixture(twoTreeFixture);

      await expect(
        familyTree.write.proposeCrossTreeCouple([1n, 99n, 5n, 6n], {
          account: creator1.account,
        })
      ).to.be.rejectedWith("Tree 2 does not exist");
    });

    it("should revert if partner1 not in tree1", async function () {
      const { familyTree, creator1 } = await loadFixture(twoTreeFixture);

      // person 3 is in tree2, not tree1
      await expect(
        familyTree.write.proposeCrossTreeCouple([1n, 2n, 3n, 6n], {
          account: creator1.account,
        })
      ).to.be.rejectedWith("Partner 1 not in tree 1");
    });

    it("should revert if partner2 not in tree2", async function () {
      const { familyTree, creator1 } = await loadFixture(twoTreeFixture);

      // person 1 is in tree1, not tree2
      await expect(
        familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 1n], {
          account: creator1.account,
        })
      ).to.be.rejectedWith("Partner 2 not in tree 2");
    });

    it("should revert if caller has no role in either tree", async function () {
      const { familyTree, stranger } = await loadFixture(twoTreeFixture);

      await expect(
        familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
          account: stranger.account,
        })
      ).to.be.rejectedWith("Caller is not creator or admin of either tree");
    });

    it("should allow partner already in a regular couple", async function () {
      const { familyTree, creator1 } = await loadFixture(twoTreeFixture);

      // person 1 is already in regular couple 1 — should still work
      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 1n, 6n], {
        account: creator1.account,
      });

      const cc = await familyTree.read.getCrossTreeCouple([1n]);
      expect(cc.partner1Id).to.equal(1n);
    });

    it("should allow partner already in a cross-tree couple", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      // Create and approve a cross couple for 5 & 6
      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      // Add new people
      await familyTree.write.addPerson([2n, "Zoe Lee", 300n, Gender.Female, ""], {
        account: creator2.account,
      });

      // person 5 already in cross couple — should still be allowed
      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 7n], {
        account: creator1.account,
      });

      const cc = await familyTree.read.getCrossTreeCouple([2n]);
      expect(cc.partner1Id).to.equal(5n);
    });

    it("should revert when coupling a person with themselves", async function () {
      const { familyTree, creator1 } = await loadFixture(twoTreeFixture);

      await expect(
        familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 5n], {
          account: creator1.account,
        })
      ).to.be.rejectedWith("Cannot couple with self");
    });
  });

  // ────────────────── approveCrossTreeCouple ──────────────────

  describe("approveCrossTreeCouple", function () {
    it("should approve when other tree's creator calls", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });

      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      const cc = await familyTree.read.getCrossTreeCouple([1n]);
      expect(cc.approved).to.equal(true);
    });

    it("should approve when other tree's admin calls", async function () {
      const { familyTree, creator1, admin2 } =
        await loadFixture(twoTreeWithAdminsFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });

      await familyTree.write.approveCrossTreeCouple([1n], {
        account: admin2.account,
      });

      const cc = await familyTree.read.getCrossTreeCouple([1n]);
      expect(cc.approved).to.equal(true);
    });

    it("should track cross couples for both partners", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      const p5Couples = await familyTree.read.getPersonCrossCouples([5n]);
      const p6Couples = await familyTree.read.getPersonCrossCouples([6n]);
      expect(p5Couples).to.deep.equal([1n]);
      expect(p6Couples).to.deep.equal([1n]);
    });

    it("should revert if proposer's tree tries to approve", async function () {
      const { familyTree, creator1 } = await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });

      await expect(
        familyTree.write.approveCrossTreeCouple([1n], {
          account: creator1.account,
        })
      ).to.be.rejectedWith("Caller is not creator or admin of the other tree");
    });

    it("should revert if stranger tries to approve", async function () {
      const { familyTree, creator1, stranger } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });

      await expect(
        familyTree.write.approveCrossTreeCouple([1n], {
          account: stranger.account,
        })
      ).to.be.rejectedWith("Caller is not creator or admin of the other tree");
    });

    it("should revert if already approved", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      await expect(
        familyTree.write.approveCrossTreeCouple([1n], {
          account: creator2.account,
        })
      ).to.be.rejectedWith("Already approved");
    });

    it("should revert if cross couple does not exist", async function () {
      const { familyTree, creator1 } = await loadFixture(twoTreeFixture);

      await expect(
        familyTree.write.approveCrossTreeCouple([99n], {
          account: creator1.account,
        })
      ).to.be.rejectedWith("Cross-tree couple does not exist");
    });

    it("should emit CrossTreeCoupleApproved event", async function () {
      const { familyTree, creator1, creator2, publicClient } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });

      const hash = await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.logs.length).to.be.greaterThan(0);
    });
  });

  // ────────────────── cancelCrossTreeCouple ──────────────────

  describe("cancelCrossTreeCouple", function () {
    it("should allow proposer to cancel", async function () {
      const { familyTree, creator1 } = await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });

      await familyTree.write.cancelCrossTreeCouple([1n], {
        account: creator1.account,
      });

      await expect(
        familyTree.read.getCrossTreeCouple([1n])
      ).to.be.rejectedWith("Cross-tree couple does not exist");
    });

    it("should allow other tree's creator to cancel", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });

      await familyTree.write.cancelCrossTreeCouple([1n], {
        account: creator2.account,
      });

      await expect(
        familyTree.read.getCrossTreeCouple([1n])
      ).to.be.rejectedWith("Cross-tree couple does not exist");
    });

    it("should allow either tree's admin to cancel", async function () {
      const { familyTree, creator1, admin2 } =
        await loadFixture(twoTreeWithAdminsFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });

      await familyTree.write.cancelCrossTreeCouple([1n], {
        account: admin2.account,
      });

      await expect(
        familyTree.read.getCrossTreeCouple([1n])
      ).to.be.rejectedWith("Cross-tree couple does not exist");
    });

    it("should revert if stranger tries to cancel", async function () {
      const { familyTree, creator1, stranger } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });

      await expect(
        familyTree.write.cancelCrossTreeCouple([1n], {
          account: stranger.account,
        })
      ).to.be.rejectedWith("Not authorized to cancel");
    });

    it("should revert if already approved", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      await expect(
        familyTree.write.cancelCrossTreeCouple([1n], {
          account: creator1.account,
        })
      ).to.be.rejectedWith("Cannot cancel an approved cross-tree couple");
    });

    it("should emit CrossTreeCoupleCancelled event", async function () {
      const { familyTree, creator1, publicClient } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });

      const hash = await familyTree.write.cancelCrossTreeCouple([1n], {
        account: creator1.account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.logs.length).to.be.greaterThan(0);
    });
  });

  // ────────────────── addChildToCrossCouple ──────────────────

  describe("addChildToCrossCouple", function () {
    it("should add a child from tree1", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      // Propose and approve
      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      // Add a new person to tree1
      await familyTree.write.addPerson([1n, "Baby Smith", 400n, Gender.Male, ""], {
        account: creator1.account,
      });

      await familyTree.write.addChildToCrossCouple([1n, 7n], {
        account: creator1.account,
      });

      const cc = await familyTree.read.getCrossTreeCouple([1n]);
      expect(cc.childrenIds).to.deep.equal([7n]);
    });

    it("should add a child from tree2", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      // Add a new person to tree2
      await familyTree.write.addPerson([2n, "Baby Lee", 400n, Gender.Female, ""], {
        account: creator2.account,
      });

      await familyTree.write.addChildToCrossCouple([1n, 7n], {
        account: creator2.account,
      });

      const cc = await familyTree.read.getCrossTreeCouple([1n]);
      expect(cc.childrenIds).to.deep.equal([7n]);
    });

    it("should add multiple children", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      await familyTree.write.addPerson([1n, "Kid1", 400n, Gender.Male, ""], {
        account: creator1.account,
      });
      await familyTree.write.addPerson([2n, "Kid2", 400n, Gender.Female, ""], {
        account: creator2.account,
      });

      await familyTree.write.addChildToCrossCouple([1n, 7n], {
        account: creator1.account,
      });
      await familyTree.write.addChildToCrossCouple([1n, 8n], {
        account: creator2.account,
      });

      const cc = await familyTree.read.getCrossTreeCouple([1n]);
      expect(cc.childrenIds).to.deep.equal([7n, 8n]);
    });

    it("should revert if cross couple not approved", async function () {
      const { familyTree, creator1 } = await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });

      await familyTree.write.addPerson([1n, "Baby", 400n, Gender.Male, ""], {
        account: creator1.account,
      });

      await expect(
        familyTree.write.addChildToCrossCouple([1n, 7n], {
          account: creator1.account,
        })
      ).to.be.rejectedWith("Cross-tree couple not yet approved");
    });

    it("should revert if child not in either linked tree", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      // Create a third tree with a person
      await familyTree.write.createTreeSingle(
        ["Third Family", { name: "Bob", dob: 0n, gender: Gender.Male, profileURI: "" }, 1n],
        { account: creator1.account }
      );

      await expect(
        familyTree.write.addChildToCrossCouple([1n, 7n], {
          account: creator1.account,
        })
      ).to.be.rejectedWith("Child not in either linked tree");
    });

    it("should revert if child already has biological parents (regular couple)", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      // Add a child to tree1 regular couple as biological child
      await familyTree.write.addPerson([1n, "Kid Smith", 400n, Gender.Male, ""], {
        account: creator1.account,
      });
      await familyTree.write.addChildToCouple([1n, 1n, 7n], {
        account: creator1.account,
      });

      await expect(
        familyTree.write.addChildToCrossCouple([1n, 7n], {
          account: creator1.account,
        })
      ).to.be.rejectedWith("Child already has biological parents");
    });

    it("should revert if child already has biological parents (cross couple)", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      await familyTree.write.addPerson([1n, "Baby", 400n, Gender.Male, ""], {
        account: creator1.account,
      });
      await familyTree.write.addChildToCrossCouple([1n, 7n], {
        account: creator1.account,
      });

      // Try adding same child as biological to another cross couple
      await expect(
        familyTree.write.addChildToCrossCouple([1n, 7n], {
          account: creator1.account,
        })
      ).to.be.rejectedWith("Child already has biological parents");
    });

    it("should revert if caller is not creator/admin of child's tree", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      // Add person to tree1
      await familyTree.write.addPerson([1n, "Baby Smith", 400n, Gender.Male, ""], {
        account: creator1.account,
      });

      // creator2 is NOT creator/admin of tree1
      await expect(
        familyTree.write.addChildToCrossCouple([1n, 7n], {
          account: creator2.account,
        })
      ).to.be.rejectedWith("Caller is not creator or admin of child's tree");
    });

    it("should emit ChildAddedToCrossCouple event", async function () {
      const { familyTree, creator1, creator2, publicClient } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      await familyTree.write.addPerson([1n, "Baby", 400n, Gender.Male, ""], {
        account: creator1.account,
      });

      const hash = await familyTree.write.addChildToCrossCouple([1n, 7n], {
        account: creator1.account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.logs.length).to.be.greaterThan(0);
    });
  });

  // ────────────── Integration: multi-couple + biological parent rules ──────────────

  describe("Multi-couple and biological parent rules", function () {
    it("person in cross-couple CAN also join a regular couple", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      // Add a new person to tree1
      await familyTree.write.addPerson([1n, "Extra", 300n, Gender.Female, ""], {
        account: creator1.account,
      });

      // Person 5 (in cross couple) can also form a regular couple
      await familyTree.write.createCouple([1n, 5n, 7n], {
        account: creator1.account,
      });

      const regularCouples = await familyTree.read.getPersonCouples([5n]);
      const crossCouples = await familyTree.read.getPersonCrossCouples([5n]);
      expect(regularCouples.length).to.equal(1);
      expect(crossCouples.length).to.equal(1);
    });

    it("biological child of cross-couple cannot be biological child of regular couple", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      // Add a biological child to the cross couple
      await familyTree.write.addPerson([1n, "CrossKid", 400n, Gender.Male, ""], {
        account: creator1.account,
      });
      await familyTree.write.addChildToCrossCouple([1n, 7n], {
        account: creator1.account,
      });

      // Cannot add as biological child to regular couple
      await expect(
        familyTree.write.addChildToCouple([1n, 1n, 7n], {
          account: creator1.account,
        })
      ).to.be.rejectedWith("Child already has biological parents");
    });

    it("biological child of regular couple cannot be biological child of cross-couple", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      // Add biological child to regular couple
      await familyTree.write.addPerson([1n, "RegularKid", 400n, Gender.Male, ""], {
        account: creator1.account,
      });
      await familyTree.write.addChildToCouple([1n, 1n, 7n], {
        account: creator1.account,
      });

      // Cannot add as biological child to cross couple
      await expect(
        familyTree.write.addChildToCrossCouple([1n, 7n], {
          account: creator1.account,
        })
      ).to.be.rejectedWith("Child already has biological parents");
    });

    it("biological child CAN be adopted by another couple", async function () {
      const { familyTree, creator1 } = await loadFixture(twoTreeFixture);

      // Add biological child to regular couple 1
      await familyTree.write.addPerson([1n, "BioKid", 400n, Gender.Male, ""], {
        account: creator1.account,
      });
      await familyTree.write.addChildToCouple([1n, 1n, 7n], {
        account: creator1.account,
      });

      // Create another couple in tree1 (couple 3, since couple 2 is in tree2)
      await familyTree.write.addPerson([1n, "StepMom", 100n, Gender.Female, ""], {
        account: creator1.account,
      });
      await familyTree.write.createCouple([1n, 1n, 8n], {
        account: creator1.account,
      });

      // Adopt child into couple 3
      await familyTree.write.adoptChildToCouple([1n, 3n, 7n], {
        account: creator1.account,
      });

      const adopted = await familyTree.read.getAdoptedChildren([3n]);
      expect(adopted).to.deep.equal([7n]);
    });
  });

  // ────────────────── View functions ──────────────────

  describe("View functions", function () {
    it("getCrossTreeCouple should revert for non-existent id", async function () {
      const { familyTree } = await loadFixture(twoTreeFixture);

      await expect(
        familyTree.read.getCrossTreeCouple([99n])
      ).to.be.rejectedWith("Cross-tree couple does not exist");
    });

    it("getTreeCrossCouples should return empty array initially", async function () {
      const { familyTree } = await loadFixture(twoTreeFixture);

      const couples = await familyTree.read.getTreeCrossCouples([1n]);
      expect(couples).to.deep.equal([]);
    });

    it("getTreeCrossCouples should revert for non-existent tree", async function () {
      const { familyTree } = await loadFixture(twoTreeFixture);

      await expect(
        familyTree.read.getTreeCrossCouples([99n])
      ).to.be.rejectedWith("Tree does not exist");
    });
  });

  // ────────────────── Adoption ──────────────────

  describe("Adoption", function () {
    it("should adopt a child into a regular couple", async function () {
      const { familyTree, creator1 } = await loadFixture(twoTreeFixture);

      // Add a child and assign biological parents
      await familyTree.write.addPerson([1n, "Kid", 400n, Gender.Male, ""], {
        account: creator1.account,
      });
      await familyTree.write.addChildToCouple([1n, 1n, 7n], {
        account: creator1.account,
      });

      // Create another couple in tree1 (couple 3)
      await familyTree.write.addPerson([1n, "StepDad", 100n, Gender.Male, ""], {
        account: creator1.account,
      });
      await familyTree.write.createCouple([1n, 2n, 8n], {
        account: creator1.account,
      });

      // Adopt the child into couple 3
      await familyTree.write.adoptChildToCouple([1n, 3n, 7n], {
        account: creator1.account,
      });

      const adopted = await familyTree.read.getAdoptedChildren([3n]);
      expect(adopted).to.deep.equal([7n]);
    });

    it("should adopt a child into a cross-tree couple", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      // Create and approve cross couple
      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      // Add a child with biological parents in tree1
      await familyTree.write.addPerson([1n, "Kid", 400n, Gender.Male, ""], {
        account: creator1.account,
      });
      await familyTree.write.addChildToCouple([1n, 1n, 7n], {
        account: creator1.account,
      });

      // Adopt into cross couple
      await familyTree.write.adoptChildToCrossCouple([1n, 7n], {
        account: creator1.account,
      });

      const adopted = await familyTree.read.getAdoptedChildrenOfCrossCouple([1n]);
      expect(adopted).to.deep.equal([7n]);
    });

    it("should allow adoption of child without biological parents", async function () {
      const { familyTree, creator1 } = await loadFixture(twoTreeFixture);

      // Add a person with no parents
      await familyTree.write.addPerson([1n, "Orphan", 400n, Gender.Male, ""], {
        account: creator1.account,
      });

      // Adopt directly
      await familyTree.write.adoptChildToCouple([1n, 1n, 7n], {
        account: creator1.account,
      });

      const adopted = await familyTree.read.getAdoptedChildren([1n]);
      expect(adopted).to.deep.equal([7n]);
    });

    it("should allow a child to be adopted by multiple couples", async function () {
      const { familyTree, creator1 } = await loadFixture(twoTreeFixture);

      await familyTree.write.addPerson([1n, "Kid", 400n, Gender.Male, ""], {
        account: creator1.account,
      });

      // Create a second couple in tree1 (couple 3)
      await familyTree.write.addPerson([1n, "P3", 100n, Gender.Male, ""], {
        account: creator1.account,
      });
      await familyTree.write.addPerson([1n, "P4", 100n, Gender.Female, ""], {
        account: creator1.account,
      });
      await familyTree.write.createCouple([1n, 8n, 9n], {
        account: creator1.account,
      });

      // Adopt into couple 1 and couple 3 (both in tree1)
      await familyTree.write.adoptChildToCouple([1n, 1n, 7n], {
        account: creator1.account,
      });
      await familyTree.write.adoptChildToCouple([1n, 3n, 7n], {
        account: creator1.account,
      });

      const adopted1 = await familyTree.read.getAdoptedChildren([1n]);
      const adopted3 = await familyTree.read.getAdoptedChildren([3n]);
      expect(adopted1).to.deep.equal([7n]);
      expect(adopted3).to.deep.equal([7n]);
    });

    it("should revert adoption if couple not in tree", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      // Person 7 in tree1, couple 2 in tree2
      await familyTree.write.addPerson([1n, "Kid", 400n, Gender.Male, ""], {
        account: creator1.account,
      });

      await expect(
        familyTree.write.adoptChildToCouple([1n, 2n, 7n], {
          account: creator1.account,
        })
      ).to.be.rejectedWith("Couple not in this tree");
    });

    it("should revert cross-couple adoption if not approved", async function () {
      const { familyTree, creator1 } = await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });

      await familyTree.write.addPerson([1n, "Kid", 400n, Gender.Male, ""], {
        account: creator1.account,
      });

      await expect(
        familyTree.write.adoptChildToCrossCouple([1n, 7n], {
          account: creator1.account,
        })
      ).to.be.rejectedWith("Cross-tree couple not yet approved");
    });

    it("should revert cross-couple adoption if child not in either tree", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      // Create third tree with a person
      await familyTree.write.createTreeSingle(
        ["Third", { name: "Bob", dob: 0n, gender: Gender.Male, profileURI: "" }, 1n],
        { account: creator1.account }
      );

      await expect(
        familyTree.write.adoptChildToCrossCouple([1n, 7n], {
          account: creator1.account,
        })
      ).to.be.rejectedWith("Child not in either linked tree");
    });

    it("should revert cross-couple adoption if caller not admin of child's tree", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      // Add person to tree1
      await familyTree.write.addPerson([1n, "Kid", 400n, Gender.Male, ""], {
        account: creator1.account,
      });

      // creator2 is NOT admin of tree1
      await expect(
        familyTree.write.adoptChildToCrossCouple([1n, 7n], {
          account: creator2.account,
        })
      ).to.be.rejectedWith("Caller is not creator or admin of child's tree");
    });

    it("should emit ChildAdoptedByCouple event", async function () {
      const { familyTree, creator1, publicClient } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.addPerson([1n, "Kid", 400n, Gender.Male, ""], {
        account: creator1.account,
      });

      const hash = await familyTree.write.adoptChildToCouple([1n, 1n, 7n], {
        account: creator1.account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.logs.length).to.be.greaterThan(0);
    });

    it("should emit ChildAdoptedByCrossCouple event", async function () {
      const { familyTree, creator1, creator2, publicClient } =
        await loadFixture(twoTreeFixture);

      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      await familyTree.write.addPerson([1n, "Kid", 400n, Gender.Male, ""], {
        account: creator1.account,
      });

      const hash = await familyTree.write.adoptChildToCrossCouple([1n, 7n], {
        account: creator1.account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.logs.length).to.be.greaterThan(0);
    });
  });

  // ────────────────── Full lifecycle ──────────────────

  describe("Full lifecycle", function () {
    it("propose → approve → add children from both trees", async function () {
      const { familyTree, creator1, creator2 } =
        await loadFixture(twoTreeFixture);

      // Propose
      await familyTree.write.proposeCrossTreeCouple([1n, 2n, 5n, 6n], {
        account: creator1.account,
      });

      let cc = await familyTree.read.getCrossTreeCouple([1n]);
      expect(cc.approved).to.equal(false);

      // Approve
      await familyTree.write.approveCrossTreeCouple([1n], {
        account: creator2.account,
      });

      cc = await familyTree.read.getCrossTreeCouple([1n]);
      expect(cc.approved).to.equal(true);

      // Add child from tree1
      await familyTree.write.addPerson([1n, "Child A", 500n, Gender.Male, ""], {
        account: creator1.account,
      });
      await familyTree.write.addChildToCrossCouple([1n, 7n], {
        account: creator1.account,
      });

      // Add child from tree2
      await familyTree.write.addPerson([2n, "Child B", 500n, Gender.Female, ""], {
        account: creator2.account,
      });
      await familyTree.write.addChildToCrossCouple([1n, 8n], {
        account: creator2.account,
      });

      cc = await familyTree.read.getCrossTreeCouple([1n]);
      expect(cc.childrenIds).to.deep.equal([7n, 8n]);
    });
  });
});
