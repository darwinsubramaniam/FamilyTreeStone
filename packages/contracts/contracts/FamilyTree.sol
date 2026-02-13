// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IFamilyTree.sol";

/**
 * @title FamilyTree
 * @notice Permissionless family tree registry with role-based governance.
 *         Anyone can create a root tree (founding couple). A per-tree role
 *         system (Creator / Admin / Editor) controls who can edit and how
 *         edits are approved.
 */
contract FamilyTree is IFamilyTree, ReentrancyGuard {
    // ──────────────────────────── Constants ────────────────────────

    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN");
    bytes32 public constant EDITOR_ROLE = keccak256("EDITOR");

    // ──────────────────────────── Counters ─────────────────────────

    uint256 private _nextTreeId = 1;
    uint256 private _nextPersonId = 1;
    uint256 private _nextCoupleId = 1;
    uint256 private _nextProposalId = 1;

    // ──────────────────────────── Storage ──────────────────────────

    mapping(uint256 => Person) private _persons;
    mapping(uint256 => CoupleNode) private _couples;
    mapping(uint256 => Tree) private _trees;

    // Membership tracking
    mapping(uint256 => uint256) private _treeOfPerson;
    mapping(uint256 => uint256) private _treeOfCouple;

    // Relationship links
    mapping(uint256 => uint256[]) private _couplesOfPerson;     // personId → coupleId[] (as partner, multiple allowed)
    mapping(uint256 => uint256) private _parentCoupleOfPerson;  // personId → coupleId (biological parent — one only)

    // Per-tree lists
    mapping(uint256 => uint256[]) private _treePersons;
    mapping(uint256 => uint256[]) private _treeCouples;

    // Role system: treeId → role → address → bool
    mapping(uint256 => mapping(bytes32 => mapping(address => bool))) private _roles;
    mapping(uint256 => mapping(bytes32 => uint256)) private _roleCount;

    // Proposal system
    mapping(uint256 => Proposal) private _proposals;
    mapping(uint256 => mapping(address => bool)) private _proposalApprovals;

    // Cross-tree couple system
    uint256 private _nextCrossCoupleId = 1;
    mapping(uint256 => CrossTreeCouple) private _crossCouples;
    mapping(uint256 => uint256[]) private _crossCouplesOfPerson;     // personId → crossCoupleId[] (as partner, multiple allowed)
    mapping(uint256 => uint256) private _parentCrossCoupleOfPerson;  // personId → crossCoupleId (biological parent — one only)
    mapping(uint256 => uint256[]) private _treeCrossCouples;         // treeId → crossCoupleId[]
    mapping(uint256 => address) private _crossCoupleProposer;        // crossCoupleId → proposer address
    mapping(uint256 => uint256) private _crossCoupleProposerTree;    // crossCoupleId → which treeId the proposer represents

    // Adoption system
    mapping(uint256 => uint256[]) private _adoptedChildrenOfCouple;       // coupleId → childId[]
    mapping(uint256 => uint256[]) private _adoptedChildrenOfCrossCouple;  // crossCoupleId → childId[]
    mapping(uint256 => uint256[]) private _adoptiveCouplesOfChild;        // childId → coupleId[]
    mapping(uint256 => uint256[]) private _adoptiveCrossCouplesOfChild;   // childId → crossCoupleId[]

    // ──────────────────────────── Modifiers ────────────────────────

    modifier onlyCreator(uint256 treeId) {
        require(_trees[treeId].exists, "Tree does not exist");
        require(
            _roles[treeId][CREATOR_ROLE][msg.sender],
            "Caller is not the tree creator"
        );
        _;
    }

    modifier onlyCreatorOrAdmin(uint256 treeId) {
        require(_trees[treeId].exists, "Tree does not exist");
        require(
            _roles[treeId][CREATOR_ROLE][msg.sender] ||
            _roles[treeId][ADMIN_ROLE][msg.sender],
            "Caller is not creator or admin"
        );
        _;
    }

    modifier onlyEditor(uint256 treeId) {
        require(_trees[treeId].exists, "Tree does not exist");
        require(
            _roles[treeId][EDITOR_ROLE][msg.sender],
            "Caller is not an editor"
        );
        _;
    }

    // ──────────────────── Tree Management ─────────────────────────

    /// @inheritdoc IFamilyTree
    function createTree(
        string calldata treeName,
        PersonInput calldata partner1,
        PersonInput calldata partner2,
        uint256 threshold
    ) external nonReentrant returns (uint256 treeId) {
        require(bytes(treeName).length > 0, "Tree name cannot be empty");
        require(threshold >= 1, "Threshold must be >= 1");

        treeId = _nextTreeId++;

        // Create the two founding persons
        uint256 p1Id = _addPerson(treeId, partner1.name, partner1.dob, partner1.gender, partner1.profileURI);
        uint256 p2Id = _addPerson(treeId, partner2.name, partner2.dob, partner2.gender, partner2.profileURI);

        // Create root couple
        uint256 coupleId = _createCoupleInternal(treeId, p1Id, p2Id);

        // Initialize tree
        _trees[treeId] = Tree({
            id: treeId,
            name: treeName,
            creator: msg.sender,
            rootPersonId: p1Id,
            rootCoupleId: coupleId,
            approvalThreshold: threshold,
            exists: true
        });

        // Grant creator role
        _roles[treeId][CREATOR_ROLE][msg.sender] = true;
        _roleCount[treeId][CREATOR_ROLE] = 1;

        emit TreeCreated(treeId, treeName, msg.sender);
    }

    /// @inheritdoc IFamilyTree
    function createTreeSingle(
        string calldata treeName,
        PersonInput calldata founder,
        uint256 threshold
    ) external nonReentrant returns (uint256 treeId) {
        require(bytes(treeName).length > 0, "Tree name cannot be empty");
        require(threshold >= 1, "Threshold must be >= 1");

        treeId = _nextTreeId++;

        uint256 personId = _addPerson(treeId, founder.name, founder.dob, founder.gender, founder.profileURI);

        _trees[treeId] = Tree({
            id: treeId,
            name: treeName,
            creator: msg.sender,
            rootPersonId: personId,
            rootCoupleId: 0,
            approvalThreshold: threshold,
            exists: true
        });

        _roles[treeId][CREATOR_ROLE][msg.sender] = true;
        _roleCount[treeId][CREATOR_ROLE] = 1;

        emit TreeCreated(treeId, treeName, msg.sender);
    }

    // ──────────────────── Role Management ─────────────────────────

    /// @inheritdoc IFamilyTree
    function grantAdmin(uint256 treeId, address account)
        external
        nonReentrant
        onlyCreatorOrAdmin(treeId)
    {
        require(account != address(0), "Invalid address");
        require(!_roles[treeId][ADMIN_ROLE][account], "Already an admin");

        _roles[treeId][ADMIN_ROLE][account] = true;
        _roleCount[treeId][ADMIN_ROLE]++;

        emit AdminGranted(treeId, account);
    }

    /// @inheritdoc IFamilyTree
    function revokeAdmin(uint256 treeId, address account)
        external
        nonReentrant
        onlyCreatorOrAdmin(treeId)
    {
        require(_roles[treeId][ADMIN_ROLE][account], "Not an admin");

        _roles[treeId][ADMIN_ROLE][account] = false;
        _roleCount[treeId][ADMIN_ROLE]--;

        emit AdminRevoked(treeId, account);
    }

    /// @inheritdoc IFamilyTree
    function grantEditor(uint256 treeId, address account)
        external
        nonReentrant
        onlyCreatorOrAdmin(treeId)
    {
        require(account != address(0), "Invalid address");
        require(!_roles[treeId][EDITOR_ROLE][account], "Already an editor");

        _roles[treeId][EDITOR_ROLE][account] = true;
        _roleCount[treeId][EDITOR_ROLE]++;

        emit EditorGranted(treeId, account);
    }

    /// @inheritdoc IFamilyTree
    function revokeEditor(uint256 treeId, address account)
        external
        nonReentrant
        onlyCreatorOrAdmin(treeId)
    {
        require(_roles[treeId][EDITOR_ROLE][account], "Not an editor");

        _roles[treeId][EDITOR_ROLE][account] = false;
        _roleCount[treeId][EDITOR_ROLE]--;

        emit EditorRevoked(treeId, account);
    }

    /// @inheritdoc IFamilyTree
    function setApprovalThreshold(uint256 treeId, uint256 threshold)
        external
        nonReentrant
        onlyCreatorOrAdmin(treeId)
    {
        require(threshold >= 1, "Threshold must be >= 1");

        _trees[treeId].approvalThreshold = threshold;

        // Soft warning if threshold exceeds approver count
        uint256 approverCount = _roleCount[treeId][ADMIN_ROLE] +
            _roleCount[treeId][EDITOR_ROLE];
        if (threshold > approverCount) {
            emit ThresholdExceedsApprovers(treeId, threshold, approverCount);
        }

        emit ApprovalThresholdUpdated(treeId, threshold);
    }

    // ──────────── Direct Edits (Creator/Admin only) ───────────────

    /// @inheritdoc IFamilyTree
    function addPerson(
        uint256 treeId,
        string calldata name,
        uint256 dob,
        Gender gender,
        string calldata profileURI
    ) external nonReentrant onlyCreatorOrAdmin(treeId) returns (uint256 personId) {
        personId = _addPerson(treeId, name, dob, gender, profileURI);
    }

    /// @inheritdoc IFamilyTree
    function updatePerson(
        uint256 treeId,
        uint256 personId,
        string calldata name,
        string calldata profileURI
    ) external nonReentrant onlyCreatorOrAdmin(treeId) {
        _updatePerson(treeId, personId, name, profileURI);
    }

    /// @inheritdoc IFamilyTree
    function createCouple(
        uint256 treeId,
        uint256 partner1Id,
        uint256 partner2Id
    ) external nonReentrant onlyCreatorOrAdmin(treeId) returns (uint256 coupleId) {
        coupleId = _createCoupleInternal(treeId, partner1Id, partner2Id);
    }

    /// @inheritdoc IFamilyTree
    function addChildToCouple(
        uint256 treeId,
        uint256 coupleId,
        uint256 childId
    ) external nonReentrant onlyCreatorOrAdmin(treeId) {
        _addChildToCouple(treeId, coupleId, childId);
    }

    // ──────────────── Proposals (Editors) ─────────────────────────

    /// @inheritdoc IFamilyTree
    function proposeAddPerson(
        uint256 treeId,
        string calldata name,
        uint256 dob,
        Gender gender,
        string calldata profileURI
    ) external nonReentrant onlyEditor(treeId) returns (uint256 proposalId) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(dob <= block.timestamp, "DOB cannot be in the future");

        bytes memory data = abi.encode(treeId, name, dob, gender, profileURI);
        proposalId = _createProposal(treeId, ProposalType.AddPerson, data);
    }

    /// @inheritdoc IFamilyTree
    function proposeUpdatePerson(
        uint256 treeId,
        uint256 personId,
        string calldata name,
        string calldata profileURI
    ) external nonReentrant onlyEditor(treeId) returns (uint256 proposalId) {
        require(_persons[personId].exists, "Person does not exist");
        require(_treeOfPerson[personId] == treeId, "Person not in this tree");
        require(bytes(name).length > 0, "Name cannot be empty");

        bytes memory data = abi.encode(treeId, personId, name, profileURI);
        proposalId = _createProposal(treeId, ProposalType.UpdatePerson, data);
    }

    /// @inheritdoc IFamilyTree
    function proposeCreateCouple(
        uint256 treeId,
        uint256 partner1Id,
        uint256 partner2Id
    ) external nonReentrant onlyEditor(treeId) returns (uint256 proposalId) {
        require(_persons[partner1Id].exists, "Partner 1 does not exist");
        require(_persons[partner2Id].exists, "Partner 2 does not exist");
        require(partner1Id != partner2Id, "Cannot couple with self");
        require(_treeOfPerson[partner1Id] == treeId, "Partner 1 not in this tree");
        require(_treeOfPerson[partner2Id] == treeId, "Partner 2 not in this tree");

        bytes memory data = abi.encode(treeId, partner1Id, partner2Id);
        proposalId = _createProposal(treeId, ProposalType.CreateCouple, data);
    }

    /// @inheritdoc IFamilyTree
    function proposeAddChildToCouple(
        uint256 treeId,
        uint256 coupleId,
        uint256 childId
    ) external nonReentrant onlyEditor(treeId) returns (uint256 proposalId) {
        require(_couples[coupleId].exists, "Couple does not exist");
        require(_persons[childId].exists, "Child does not exist");
        require(_treeOfCouple[coupleId] == treeId, "Couple not in this tree");
        require(_treeOfPerson[childId] == treeId, "Child not in this tree");
        require(
            _parentCoupleOfPerson[childId] == 0 &&
            _parentCrossCoupleOfPerson[childId] == 0,
            "Child already has biological parents"
        );

        bytes memory data = abi.encode(treeId, coupleId, childId);
        proposalId = _createProposal(treeId, ProposalType.AddChildToCouple, data);
    }

    /// @inheritdoc IFamilyTree
    function approveProposal(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = _proposals[proposalId];
        require(proposal.id != 0, "Proposal does not exist");
        require(
            proposal.status == ProposalStatus.Pending,
            "Proposal is not pending"
        );

        uint256 treeId = proposal.treeId;
        require(
            _roles[treeId][CREATOR_ROLE][msg.sender] ||
            _roles[treeId][ADMIN_ROLE][msg.sender] ||
            _roles[treeId][EDITOR_ROLE][msg.sender],
            "Caller has no role in this tree"
        );
        require(
            msg.sender != proposal.proposer,
            "Proposer cannot self-approve"
        );
        require(
            !_proposalApprovals[proposalId][msg.sender],
            "Already approved"
        );

        _proposalApprovals[proposalId][msg.sender] = true;
        proposal.approvalCount++;

        emit ProposalApproved(proposalId, msg.sender, proposal.approvalCount);

        // Auto-execute if threshold met
        if (proposal.approvalCount >= _trees[treeId].approvalThreshold) {
            _executeProposal(proposalId);
        }
    }

    /// @inheritdoc IFamilyTree
    function cancelProposal(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = _proposals[proposalId];
        require(proposal.id != 0, "Proposal does not exist");
        require(
            proposal.status == ProposalStatus.Pending,
            "Proposal is not pending"
        );

        uint256 treeId = proposal.treeId;
        require(
            msg.sender == proposal.proposer ||
            _roles[treeId][CREATOR_ROLE][msg.sender] ||
            _roles[treeId][ADMIN_ROLE][msg.sender],
            "Not authorized to cancel"
        );

        proposal.status = ProposalStatus.Cancelled;

        emit ProposalCancelled(proposalId);
    }

    // ──────────────────── View Functions ──────────────────────────

    /// @inheritdoc IFamilyTree
    function getPerson(uint256 personId) external view returns (Person memory) {
        require(_persons[personId].exists, "Person does not exist");
        return _persons[personId];
    }

    /// @inheritdoc IFamilyTree
    function getCouple(uint256 coupleId)
        external
        view
        returns (CoupleNode memory)
    {
        require(_couples[coupleId].exists, "Couple does not exist");
        return _couples[coupleId];
    }

    /// @inheritdoc IFamilyTree
    function getTree(uint256 treeId) external view returns (Tree memory) {
        require(_trees[treeId].exists, "Tree does not exist");
        return _trees[treeId];
    }

    /// @inheritdoc IFamilyTree
    function getCoupleChildren(uint256 coupleId)
        external
        view
        returns (uint256[] memory)
    {
        require(_couples[coupleId].exists, "Couple does not exist");
        return _couples[coupleId].childrenIds;
    }

    /// @inheritdoc IFamilyTree
    function hasRole(
        uint256 treeId,
        bytes32 role,
        address account
    ) external view returns (bool) {
        return _roles[treeId][role][account];
    }

    /// @inheritdoc IFamilyTree
    function getApprovalThreshold(uint256 treeId)
        external
        view
        returns (uint256)
    {
        require(_trees[treeId].exists, "Tree does not exist");
        return _trees[treeId].approvalThreshold;
    }

    /// @inheritdoc IFamilyTree
    function getProposal(uint256 proposalId)
        external
        view
        returns (Proposal memory)
    {
        require(_proposals[proposalId].id != 0, "Proposal does not exist");
        return _proposals[proposalId];
    }

    /// @inheritdoc IFamilyTree
    function hasApproved(uint256 proposalId, address account)
        external
        view
        returns (bool)
    {
        return _proposalApprovals[proposalId][account];
    }

    /// @inheritdoc IFamilyTree
    function getRoleHolderCount(uint256 treeId, bytes32 role)
        external
        view
        returns (uint256)
    {
        return _roleCount[treeId][role];
    }

    /// @notice Returns all couple IDs in a tree
    function getTreeCouples(uint256 treeId)
        external
        view
        returns (uint256[] memory)
    {
        require(_trees[treeId].exists, "Tree does not exist");
        return _treeCouples[treeId];
    }

    /// @inheritdoc IFamilyTree
    function getTreePersons(
        uint256 treeId,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory personIds, uint256 total) {
        require(_trees[treeId].exists, "Tree does not exist");

        uint256[] storage all = _treePersons[treeId];
        total = all.length;

        if (offset >= total || limit == 0) {
            return (new uint256[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 count = end - offset;
        personIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            personIds[i] = all[offset + i];
        }
    }

    // ──────────── Cross-Tree Couple ─────────────────────────

    /// @inheritdoc IFamilyTree
    function proposeCrossTreeCouple(
        uint256 tree1Id,
        uint256 tree2Id,
        uint256 partner1Id,
        uint256 partner2Id
    ) external nonReentrant returns (uint256 crossCoupleId) {
        require(_trees[tree1Id].exists, "Tree 1 does not exist");
        require(_trees[tree2Id].exists, "Tree 2 does not exist");
        require(tree1Id != tree2Id, "Trees must be different");
        require(_persons[partner1Id].exists, "Partner 1 does not exist");
        require(_persons[partner2Id].exists, "Partner 2 does not exist");
        require(partner1Id != partner2Id, "Cannot couple with self");
        require(_treeOfPerson[partner1Id] == tree1Id, "Partner 1 not in tree 1");
        require(_treeOfPerson[partner2Id] == tree2Id, "Partner 2 not in tree 2");

        // Caller must be creator/admin of one of the two trees
        bool isTree1Auth = _roles[tree1Id][CREATOR_ROLE][msg.sender] ||
            _roles[tree1Id][ADMIN_ROLE][msg.sender];
        bool isTree2Auth = _roles[tree2Id][CREATOR_ROLE][msg.sender] ||
            _roles[tree2Id][ADMIN_ROLE][msg.sender];
        require(isTree1Auth || isTree2Auth, "Caller is not creator or admin of either tree");

        crossCoupleId = _nextCrossCoupleId++;

        _crossCouples[crossCoupleId] = CrossTreeCouple({
            id: crossCoupleId,
            partner1Id: partner1Id,
            partner2Id: partner2Id,
            tree1Id: tree1Id,
            tree2Id: tree2Id,
            childrenIds: new uint256[](0),
            approved: false,
            exists: true
        });

        _crossCoupleProposer[crossCoupleId] = msg.sender;
        // Record which tree the proposer represents
        _crossCoupleProposerTree[crossCoupleId] = isTree1Auth ? tree1Id : tree2Id;

        _treeCrossCouples[tree1Id].push(crossCoupleId);
        _treeCrossCouples[tree2Id].push(crossCoupleId);

        emit CrossTreeCoupleProposed(crossCoupleId, tree1Id, tree2Id, partner1Id, partner2Id);
    }

    /// @inheritdoc IFamilyTree
    function approveCrossTreeCouple(uint256 crossCoupleId) external nonReentrant {
        CrossTreeCouple storage cc = _crossCouples[crossCoupleId];
        require(cc.exists, "Cross-tree couple does not exist");
        require(!cc.approved, "Already approved");

        uint256 proposerTree = _crossCoupleProposerTree[crossCoupleId];
        uint256 otherTree = proposerTree == cc.tree1Id ? cc.tree2Id : cc.tree1Id;

        require(
            _roles[otherTree][CREATOR_ROLE][msg.sender] ||
            _roles[otherTree][ADMIN_ROLE][msg.sender],
            "Caller is not creator or admin of the other tree"
        );

        cc.approved = true;
        _crossCouplesOfPerson[cc.partner1Id].push(crossCoupleId);
        _crossCouplesOfPerson[cc.partner2Id].push(crossCoupleId);

        emit CrossTreeCoupleApproved(crossCoupleId);
    }

    /// @inheritdoc IFamilyTree
    function cancelCrossTreeCouple(uint256 crossCoupleId) external nonReentrant {
        CrossTreeCouple storage cc = _crossCouples[crossCoupleId];
        require(cc.exists, "Cross-tree couple does not exist");
        require(!cc.approved, "Cannot cancel an approved cross-tree couple");

        require(
            msg.sender == _crossCoupleProposer[crossCoupleId] ||
            _roles[cc.tree1Id][CREATOR_ROLE][msg.sender] ||
            _roles[cc.tree1Id][ADMIN_ROLE][msg.sender] ||
            _roles[cc.tree2Id][CREATOR_ROLE][msg.sender] ||
            _roles[cc.tree2Id][ADMIN_ROLE][msg.sender],
            "Not authorized to cancel"
        );

        cc.exists = false;

        emit CrossTreeCoupleCancelled(crossCoupleId);
    }

    /// @inheritdoc IFamilyTree
    function addChildToCrossCouple(uint256 crossCoupleId, uint256 childId)
        external
        nonReentrant
    {
        CrossTreeCouple storage cc = _crossCouples[crossCoupleId];
        require(cc.exists, "Cross-tree couple does not exist");
        require(cc.approved, "Cross-tree couple not yet approved");
        require(_persons[childId].exists, "Child does not exist");

        uint256 childTree = _treeOfPerson[childId];
        require(
            childTree == cc.tree1Id || childTree == cc.tree2Id,
            "Child not in either linked tree"
        );

        // Caller must be creator/admin of the child's tree
        require(
            _roles[childTree][CREATOR_ROLE][msg.sender] ||
            _roles[childTree][ADMIN_ROLE][msg.sender],
            "Caller is not creator or admin of child's tree"
        );

        require(
            _parentCoupleOfPerson[childId] == 0 &&
            _parentCrossCoupleOfPerson[childId] == 0,
            "Child already has biological parents"
        );

        cc.childrenIds.push(childId);
        _parentCrossCoupleOfPerson[childId] = crossCoupleId;

        emit ChildAddedToCrossCouple(crossCoupleId, childId);
    }

    /// @inheritdoc IFamilyTree
    function getCrossTreeCouple(uint256 crossCoupleId)
        external
        view
        returns (CrossTreeCouple memory)
    {
        require(_crossCouples[crossCoupleId].exists, "Cross-tree couple does not exist");
        return _crossCouples[crossCoupleId];
    }

    /// @inheritdoc IFamilyTree
    function getTreeCrossCouples(uint256 treeId)
        external
        view
        returns (uint256[] memory)
    {
        require(_trees[treeId].exists, "Tree does not exist");
        return _treeCrossCouples[treeId];
    }

    // ──────────── Adoption ──────────────────────────────────

    /// @inheritdoc IFamilyTree
    function adoptChildToCouple(
        uint256 treeId,
        uint256 coupleId,
        uint256 childId
    ) external nonReentrant onlyCreatorOrAdmin(treeId) {
        require(_couples[coupleId].exists, "Couple does not exist");
        require(_persons[childId].exists, "Child does not exist");
        require(_treeOfCouple[coupleId] == treeId, "Couple not in this tree");
        require(_treeOfPerson[childId] == treeId, "Child not in this tree");

        _adoptedChildrenOfCouple[coupleId].push(childId);
        _adoptiveCouplesOfChild[childId].push(coupleId);

        emit ChildAdoptedByCouple(coupleId, childId);
    }

    /// @inheritdoc IFamilyTree
    function adoptChildToCrossCouple(uint256 crossCoupleId, uint256 childId)
        external
        nonReentrant
    {
        CrossTreeCouple storage cc = _crossCouples[crossCoupleId];
        require(cc.exists, "Cross-tree couple does not exist");
        require(cc.approved, "Cross-tree couple not yet approved");
        require(_persons[childId].exists, "Child does not exist");

        uint256 childTree = _treeOfPerson[childId];
        require(
            childTree == cc.tree1Id || childTree == cc.tree2Id,
            "Child not in either linked tree"
        );

        require(
            _roles[childTree][CREATOR_ROLE][msg.sender] ||
            _roles[childTree][ADMIN_ROLE][msg.sender],
            "Caller is not creator or admin of child's tree"
        );

        _adoptedChildrenOfCrossCouple[crossCoupleId].push(childId);
        _adoptiveCrossCouplesOfChild[childId].push(crossCoupleId);

        emit ChildAdoptedByCrossCouple(crossCoupleId, childId);
    }

    /// @inheritdoc IFamilyTree
    function getAdoptedChildren(uint256 coupleId)
        external
        view
        returns (uint256[] memory)
    {
        require(_couples[coupleId].exists, "Couple does not exist");
        return _adoptedChildrenOfCouple[coupleId];
    }

    /// @inheritdoc IFamilyTree
    function getAdoptedChildrenOfCrossCouple(uint256 crossCoupleId)
        external
        view
        returns (uint256[] memory)
    {
        require(_crossCouples[crossCoupleId].exists, "Cross-tree couple does not exist");
        return _adoptedChildrenOfCrossCouple[crossCoupleId];
    }

    /// @inheritdoc IFamilyTree
    function getPersonCouples(uint256 personId)
        external
        view
        returns (uint256[] memory)
    {
        require(_persons[personId].exists, "Person does not exist");
        return _couplesOfPerson[personId];
    }

    /// @inheritdoc IFamilyTree
    function getPersonCrossCouples(uint256 personId)
        external
        view
        returns (uint256[] memory)
    {
        require(_persons[personId].exists, "Person does not exist");
        return _crossCouplesOfPerson[personId];
    }

    // ──────────────────── Internal Helpers ─────────────────────────

    function _addPerson(
        uint256 treeId,
        string memory name,
        uint256 dob,
        Gender gender,
        string memory profileURI
    ) internal returns (uint256 personId) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(dob <= block.timestamp, "DOB cannot be in the future");

        personId = _nextPersonId++;

        _persons[personId] = Person({
            id: personId,
            name: name,
            dob: dob,
            gender: gender,
            profileURI: profileURI,
            exists: true
        });

        _treeOfPerson[personId] = treeId;
        _treePersons[treeId].push(personId);

        emit PersonAdded(treeId, personId, name);
    }

    function _updatePerson(
        uint256 treeId,
        uint256 personId,
        string memory name,
        string memory profileURI
    ) internal {
        require(_persons[personId].exists, "Person does not exist");
        require(_treeOfPerson[personId] == treeId, "Person not in this tree");
        require(bytes(name).length > 0, "Name cannot be empty");

        _persons[personId].name = name;
        _persons[personId].profileURI = profileURI;

        emit PersonUpdated(personId, name, profileURI);
    }

    function _createCoupleInternal(
        uint256 treeId,
        uint256 partner1Id,
        uint256 partner2Id
    ) internal returns (uint256 coupleId) {
        require(_persons[partner1Id].exists, "Partner 1 does not exist");
        require(_persons[partner2Id].exists, "Partner 2 does not exist");
        require(partner1Id != partner2Id, "Cannot couple with self");
        require(_treeOfPerson[partner1Id] == treeId, "Partner 1 not in this tree");
        require(_treeOfPerson[partner2Id] == treeId, "Partner 2 not in this tree");

        coupleId = _nextCoupleId++;

        _couples[coupleId] = CoupleNode({
            id: coupleId,
            partner1Id: partner1Id,
            partner2Id: partner2Id,
            childrenIds: new uint256[](0),
            exists: true
        });

        _couplesOfPerson[partner1Id].push(coupleId);
        _couplesOfPerson[partner2Id].push(coupleId);
        _treeOfCouple[coupleId] = treeId;
        _treeCouples[treeId].push(coupleId);

        emit CoupleCreated(treeId, coupleId, partner1Id, partner2Id);
    }

    function _addChildToCouple(
        uint256 treeId,
        uint256 coupleId,
        uint256 childId
    ) internal {
        require(_couples[coupleId].exists, "Couple does not exist");
        require(_persons[childId].exists, "Child does not exist");
        require(_treeOfCouple[coupleId] == treeId, "Couple not in this tree");
        require(_treeOfPerson[childId] == treeId, "Child not in this tree");
        require(
            _parentCoupleOfPerson[childId] == 0 &&
            _parentCrossCoupleOfPerson[childId] == 0,
            "Child already has biological parents"
        );

        _couples[coupleId].childrenIds.push(childId);
        _parentCoupleOfPerson[childId] = coupleId;

        emit ChildAddedToCouple(coupleId, childId);
    }

    function _createProposal(
        uint256 treeId,
        ProposalType proposalType,
        bytes memory data
    ) internal returns (uint256 proposalId) {
        proposalId = _nextProposalId++;

        _proposals[proposalId] = Proposal({
            id: proposalId,
            treeId: treeId,
            proposalType: proposalType,
            proposer: msg.sender,
            status: ProposalStatus.Pending,
            approvalCount: 0,
            data: data
        });

        emit ProposalCreated(proposalId, treeId, proposalType, msg.sender);
    }

    function _executeProposal(uint256 proposalId) internal {
        Proposal storage proposal = _proposals[proposalId];
        proposal.status = ProposalStatus.Executed;

        if (proposal.proposalType == ProposalType.AddPerson) {
            (
                uint256 treeId,
                string memory name,
                uint256 dob,
                Gender gender,
                string memory profileURI
            ) = abi.decode(proposal.data, (uint256, string, uint256, Gender, string));

            _addPerson(treeId, name, dob, gender, profileURI);

        } else if (proposal.proposalType == ProposalType.UpdatePerson) {
            (
                uint256 treeId,
                uint256 personId,
                string memory name,
                string memory profileURI
            ) = abi.decode(proposal.data, (uint256, uint256, string, string));

            _updatePerson(treeId, personId, name, profileURI);

        } else if (proposal.proposalType == ProposalType.CreateCouple) {
            (
                uint256 treeId,
                uint256 partner1Id,
                uint256 partner2Id
            ) = abi.decode(proposal.data, (uint256, uint256, uint256));

            _createCoupleInternal(treeId, partner1Id, partner2Id);

        } else if (proposal.proposalType == ProposalType.AddChildToCouple) {
            (
                uint256 treeId,
                uint256 coupleId,
                uint256 childId
            ) = abi.decode(proposal.data, (uint256, uint256, uint256));

            _addChildToCouple(treeId, coupleId, childId);
        }

        emit ProposalExecuted(proposalId);
    }
}
