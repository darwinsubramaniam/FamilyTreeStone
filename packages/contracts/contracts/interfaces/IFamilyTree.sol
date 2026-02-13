// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IFamilyTree {
    // ──────────────────────────── Enums ────────────────────────────

    enum Gender { Male, Female, Other }
    enum ProposalType { AddPerson, UpdatePerson, CreateCouple, AddChildToCouple }
    enum ProposalStatus { Pending, Executed, Cancelled }

    // ──────────────────────────── Structs ──────────────────────────

    struct Person {
        uint256 id;
        string name;
        uint256 dob;
        Gender gender;
        string profileURI;
        bool exists;
    }

    struct CoupleNode {
        uint256 id;
        uint256 partner1Id;
        uint256 partner2Id;
        uint256[] childrenIds;
        bool exists;
    }

    struct Tree {
        uint256 id;
        string name;
        address creator;
        uint256 rootPersonId;
        uint256 rootCoupleId;
        uint256 approvalThreshold;
        bool exists;
    }

    struct Proposal {
        uint256 id;
        uint256 treeId;
        ProposalType proposalType;
        address proposer;
        ProposalStatus status;
        uint256 approvalCount;
        bytes data;
    }

    struct PersonInput {
        string name;
        uint256 dob;
        Gender gender;
        string profileURI;
    }

    struct CrossTreeCouple {
        uint256 id;
        uint256 partner1Id;
        uint256 partner2Id;
        uint256 tree1Id;
        uint256 tree2Id;
        uint256[] childrenIds;
        bool approved;
        bool exists;
    }

    // ──────────────────────────── Events ───────────────────────────

    event TreeCreated(uint256 indexed treeId, string name, address indexed creator);
    event PersonAdded(uint256 indexed treeId, uint256 indexed personId, string name);
    event PersonUpdated(uint256 indexed personId, string name, string profileURI);
    event CoupleCreated(uint256 indexed treeId, uint256 indexed coupleId, uint256 partner1Id, uint256 partner2Id);
    event ChildAddedToCouple(uint256 indexed coupleId, uint256 indexed childId);

    event AdminGranted(uint256 indexed treeId, address indexed account);
    event AdminRevoked(uint256 indexed treeId, address indexed account);
    event EditorGranted(uint256 indexed treeId, address indexed account);
    event EditorRevoked(uint256 indexed treeId, address indexed account);
    event ApprovalThresholdUpdated(uint256 indexed treeId, uint256 newThreshold);
    event ThresholdExceedsApprovers(uint256 indexed treeId, uint256 threshold, uint256 approverCount);

    event ProposalCreated(uint256 indexed proposalId, uint256 indexed treeId, ProposalType proposalType, address indexed proposer);
    event ProposalApproved(uint256 indexed proposalId, address indexed approver, uint256 approvalCount);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);

    event CrossTreeCoupleProposed(uint256 indexed crossCoupleId, uint256 indexed tree1Id, uint256 indexed tree2Id, uint256 partner1Id, uint256 partner2Id);
    event CrossTreeCoupleApproved(uint256 indexed crossCoupleId);
    event CrossTreeCoupleCancelled(uint256 indexed crossCoupleId);
    event ChildAddedToCrossCouple(uint256 indexed crossCoupleId, uint256 indexed childId);

    event ChildAdoptedByCouple(uint256 indexed coupleId, uint256 indexed childId);
    event ChildAdoptedByCrossCouple(uint256 indexed crossCoupleId, uint256 indexed childId);

    // ──────────────────────── Tree Management ─────────────────────

    function createTree(
        string calldata treeName,
        PersonInput calldata partner1,
        PersonInput calldata partner2,
        uint256 threshold
    ) external returns (uint256 treeId);

    function createTreeSingle(
        string calldata treeName,
        PersonInput calldata founder,
        uint256 threshold
    ) external returns (uint256 treeId);

    // ──────────────────── Role Management ─────────────────────────

    function grantAdmin(uint256 treeId, address account) external;
    function revokeAdmin(uint256 treeId, address account) external;
    function grantEditor(uint256 treeId, address account) external;
    function revokeEditor(uint256 treeId, address account) external;
    function setApprovalThreshold(uint256 treeId, uint256 threshold) external;

    // ──────────────── Direct Edits (Creator/Admin) ────────────────

    function addPerson(
        uint256 treeId,
        string calldata name,
        uint256 dob,
        Gender gender,
        string calldata profileURI
    ) external returns (uint256 personId);

    function updatePerson(
        uint256 treeId,
        uint256 personId,
        string calldata name,
        string calldata profileURI
    ) external;

    function createCouple(
        uint256 treeId,
        uint256 partner1Id,
        uint256 partner2Id
    ) external returns (uint256 coupleId);

    function addChildToCouple(
        uint256 treeId,
        uint256 coupleId,
        uint256 childId
    ) external;

    // ──────────────── Proposals (Editors) ─────────────────────────

    function proposeAddPerson(
        uint256 treeId,
        string calldata name,
        uint256 dob,
        Gender gender,
        string calldata profileURI
    ) external returns (uint256 proposalId);

    function proposeUpdatePerson(
        uint256 treeId,
        uint256 personId,
        string calldata name,
        string calldata profileURI
    ) external returns (uint256 proposalId);

    function proposeCreateCouple(
        uint256 treeId,
        uint256 partner1Id,
        uint256 partner2Id
    ) external returns (uint256 proposalId);

    function proposeAddChildToCouple(
        uint256 treeId,
        uint256 coupleId,
        uint256 childId
    ) external returns (uint256 proposalId);

    function approveProposal(uint256 proposalId) external;
    function cancelProposal(uint256 proposalId) external;

    // ──────────────────── View Functions ──────────────────────────

    function getPerson(uint256 personId) external view returns (Person memory);
    function getCouple(uint256 coupleId) external view returns (CoupleNode memory);
    function getTree(uint256 treeId) external view returns (Tree memory);
    function getCoupleChildren(uint256 coupleId) external view returns (uint256[] memory);
    function hasRole(uint256 treeId, bytes32 role, address account) external view returns (bool);
    function getApprovalThreshold(uint256 treeId) external view returns (uint256);
    function getProposal(uint256 proposalId) external view returns (Proposal memory);
    function hasApproved(uint256 proposalId, address account) external view returns (bool);
    function getRoleHolderCount(uint256 treeId, bytes32 role) external view returns (uint256);
    function getTreePersons(uint256 treeId, uint256 offset, uint256 limit) external view returns (uint256[] memory personIds, uint256 total);

    // ──────────── Cross-Tree Couple ─────────────────────────

    function proposeCrossTreeCouple(uint256 tree1Id, uint256 tree2Id, uint256 partner1Id, uint256 partner2Id) external returns (uint256 crossCoupleId);
    function approveCrossTreeCouple(uint256 crossCoupleId) external;
    function cancelCrossTreeCouple(uint256 crossCoupleId) external;
    function addChildToCrossCouple(uint256 crossCoupleId, uint256 childId) external;
    function getCrossTreeCouple(uint256 crossCoupleId) external view returns (CrossTreeCouple memory);
    function getTreeCrossCouples(uint256 treeId) external view returns (uint256[] memory);

    // ──────────── Adoption ──────────────────────────────────

    function adoptChildToCouple(uint256 treeId, uint256 coupleId, uint256 childId) external;
    function adoptChildToCrossCouple(uint256 crossCoupleId, uint256 childId) external;
    function getAdoptedChildren(uint256 coupleId) external view returns (uint256[] memory);
    function getAdoptedChildrenOfCrossCouple(uint256 crossCoupleId) external view returns (uint256[] memory);
    function getPersonCouples(uint256 personId) external view returns (uint256[] memory);
    function getPersonCrossCouples(uint256 personId) external view returns (uint256[] memory);
}
