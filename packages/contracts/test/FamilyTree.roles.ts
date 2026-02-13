import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { keccak256, toHex } from "viem";

const CREATOR_ROLE = keccak256(toHex("CREATOR"));
const ADMIN_ROLE = keccak256(toHex("ADMIN"));
const EDITOR_ROLE = keccak256(toHex("EDITOR"));

const Gender = { Male: 0, Female: 1, Other: 2 } as const;

async function treeWithRolesFixture() {
  const [creator, admin, editor, stranger] = await hre.viem.getWalletClients();
  const familyTree = await hre.viem.deployContract("FamilyTree");
  const publicClient = await hre.viem.getPublicClient();

  // Create a tree
  await familyTree.write.createTree([
    "Smith Family",
    { name: "John", dob: 0n, gender: Gender.Male, profileURI: "" },
    { name: "Jane", dob: 0n, gender: Gender.Female, profileURI: "" },
    1n,
  ]);

  const asAdmin = await hre.viem.getContractAt("FamilyTree", familyTree.address, {
    client: { wallet: admin },
  });
  const asEditor = await hre.viem.getContractAt("FamilyTree", familyTree.address, {
    client: { wallet: editor },
  });
  const asStranger = await hre.viem.getContractAt("FamilyTree", familyTree.address, {
    client: { wallet: stranger },
  });

  return {
    familyTree,
    creator,
    admin,
    editor,
    stranger,
    asAdmin,
    asEditor,
    asStranger,
    publicClient,
    treeId: 1n,
  };
}

describe("FamilyTree - Role Management", function () {
  describe("grantAdmin", function () {
    it("should allow creator to grant admin", async function () {
      const { familyTree, admin, treeId } = await loadFixture(treeWithRolesFixture);

      await familyTree.write.grantAdmin([treeId, admin.account.address]);

      const isAdmin = await familyTree.read.hasRole([
        treeId,
        ADMIN_ROLE,
        admin.account.address,
      ]);
      expect(isAdmin).to.be.true;
    });

    it("should increment role count", async function () {
      const { familyTree, admin, treeId } = await loadFixture(treeWithRolesFixture);

      await familyTree.write.grantAdmin([treeId, admin.account.address]);

      const count = await familyTree.read.getRoleHolderCount([treeId, ADMIN_ROLE]);
      expect(count).to.equal(1n);
    });

    it("should allow admin to grant another admin", async function () {
      const { familyTree, admin, stranger, asAdmin, treeId } =
        await loadFixture(treeWithRolesFixture);

      // Creator grants admin
      await familyTree.write.grantAdmin([treeId, admin.account.address]);

      // Admin grants another admin
      await asAdmin.write.grantAdmin([treeId, stranger.account.address]);

      const isAdmin = await familyTree.read.hasRole([
        treeId,
        ADMIN_ROLE,
        stranger.account.address,
      ]);
      expect(isAdmin).to.be.true;
    });

    it("should revert if caller is not creator or admin", async function () {
      const { asStranger, stranger, treeId } = await loadFixture(treeWithRolesFixture);

      await expect(
        asStranger.write.grantAdmin([treeId, stranger.account.address])
      ).to.be.rejectedWith("Caller is not creator or admin");
    });

    it("should revert if already admin", async function () {
      const { familyTree, admin, treeId } = await loadFixture(treeWithRolesFixture);

      await familyTree.write.grantAdmin([treeId, admin.account.address]);

      await expect(
        familyTree.write.grantAdmin([treeId, admin.account.address])
      ).to.be.rejectedWith("Already an admin");
    });

    it("should revert with zero address", async function () {
      const { familyTree, treeId } = await loadFixture(treeWithRolesFixture);

      await expect(
        familyTree.write.grantAdmin([treeId, "0x0000000000000000000000000000000000000000"])
      ).to.be.rejectedWith("Invalid address");
    });
  });

  describe("revokeAdmin", function () {
    it("should allow creator to revoke admin", async function () {
      const { familyTree, admin, treeId } = await loadFixture(treeWithRolesFixture);

      await familyTree.write.grantAdmin([treeId, admin.account.address]);
      await familyTree.write.revokeAdmin([treeId, admin.account.address]);

      const isAdmin = await familyTree.read.hasRole([
        treeId,
        ADMIN_ROLE,
        admin.account.address,
      ]);
      expect(isAdmin).to.be.false;
    });

    it("should decrement role count", async function () {
      const { familyTree, admin, treeId } = await loadFixture(treeWithRolesFixture);

      await familyTree.write.grantAdmin([treeId, admin.account.address]);
      await familyTree.write.revokeAdmin([treeId, admin.account.address]);

      const count = await familyTree.read.getRoleHolderCount([treeId, ADMIN_ROLE]);
      expect(count).to.equal(0n);
    });

    it("should revert if not an admin", async function () {
      const { familyTree, stranger, treeId } = await loadFixture(treeWithRolesFixture);

      await expect(
        familyTree.write.revokeAdmin([treeId, stranger.account.address])
      ).to.be.rejectedWith("Not an admin");
    });
  });

  describe("grantEditor", function () {
    it("should allow creator to grant editor", async function () {
      const { familyTree, editor, treeId } = await loadFixture(treeWithRolesFixture);

      await familyTree.write.grantEditor([treeId, editor.account.address]);

      const isEditor = await familyTree.read.hasRole([
        treeId,
        EDITOR_ROLE,
        editor.account.address,
      ]);
      expect(isEditor).to.be.true;
    });

    it("should allow admin to grant editor", async function () {
      const { familyTree, admin, editor, asAdmin, treeId } =
        await loadFixture(treeWithRolesFixture);

      await familyTree.write.grantAdmin([treeId, admin.account.address]);
      await asAdmin.write.grantEditor([treeId, editor.account.address]);

      const isEditor = await familyTree.read.hasRole([
        treeId,
        EDITOR_ROLE,
        editor.account.address,
      ]);
      expect(isEditor).to.be.true;
    });

    it("should revert if caller is editor (not admin)", async function () {
      const { familyTree, editor, stranger, asEditor, treeId } =
        await loadFixture(treeWithRolesFixture);

      await familyTree.write.grantEditor([treeId, editor.account.address]);

      await expect(
        asEditor.write.grantEditor([treeId, stranger.account.address])
      ).to.be.rejectedWith("Caller is not creator or admin");
    });
  });

  describe("revokeEditor", function () {
    it("should allow creator to revoke editor", async function () {
      const { familyTree, editor, treeId } = await loadFixture(treeWithRolesFixture);

      await familyTree.write.grantEditor([treeId, editor.account.address]);
      await familyTree.write.revokeEditor([treeId, editor.account.address]);

      const isEditor = await familyTree.read.hasRole([
        treeId,
        EDITOR_ROLE,
        editor.account.address,
      ]);
      expect(isEditor).to.be.false;
    });

    it("should revert if not an editor", async function () {
      const { familyTree, stranger, treeId } = await loadFixture(treeWithRolesFixture);

      await expect(
        familyTree.write.revokeEditor([treeId, stranger.account.address])
      ).to.be.rejectedWith("Not an editor");
    });
  });

  describe("setApprovalThreshold", function () {
    it("should allow creator to set threshold", async function () {
      const { familyTree, treeId } = await loadFixture(treeWithRolesFixture);

      await familyTree.write.setApprovalThreshold([treeId, 3n]);

      const threshold = await familyTree.read.getApprovalThreshold([treeId]);
      expect(threshold).to.equal(3n);
    });

    it("should allow admin to set threshold", async function () {
      const { familyTree, admin, asAdmin, treeId } =
        await loadFixture(treeWithRolesFixture);

      await familyTree.write.grantAdmin([treeId, admin.account.address]);
      await asAdmin.write.setApprovalThreshold([treeId, 5n]);

      const threshold = await familyTree.read.getApprovalThreshold([treeId]);
      expect(threshold).to.equal(5n);
    });

    it("should revert with zero threshold", async function () {
      const { familyTree, treeId } = await loadFixture(treeWithRolesFixture);

      await expect(
        familyTree.write.setApprovalThreshold([treeId, 0n])
      ).to.be.rejectedWith("Threshold must be >= 1");
    });

    it("should revert if caller is not creator or admin", async function () {
      const { asStranger, treeId } = await loadFixture(treeWithRolesFixture);

      await expect(
        asStranger.write.setApprovalThreshold([treeId, 2n])
      ).to.be.rejectedWith("Caller is not creator or admin");
    });
  });

  describe("Role isolation across trees", function () {
    it("admin in tree 1 should not be admin in tree 2", async function () {
      const { familyTree, admin, stranger, treeId } =
        await loadFixture(treeWithRolesFixture);

      // Grant admin in tree 1
      await familyTree.write.grantAdmin([treeId, admin.account.address]);

      // Create tree 2 by stranger
      const asStranger = await hre.viem.getContractAt(
        "FamilyTree",
        familyTree.address,
        { client: { wallet: stranger } }
      );
      await asStranger.write.createTree([
        "Tree 2",
        { name: "A", dob: 0n, gender: Gender.Male, profileURI: "" },
        { name: "B", dob: 0n, gender: Gender.Female, profileURI: "" },
        1n,
      ]);

      const isAdminInTree2 = await familyTree.read.hasRole([
        2n,
        ADMIN_ROLE,
        admin.account.address,
      ]);
      expect(isAdminInTree2).to.be.false;
    });
  });
});
