# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Prerequisites

Node 22 is required (pinned in `.nvmrc`). Before running any command:
```bash
source ~/.nvm/nvm.sh && nvm use 22
```

## Commands

All commands run from the monorepo root unless noted.

```bash
# Compile contracts (also syncs ABI to UI package)
npm run compile

# Run all contract tests
npm run test

# Run a single test file
npx hardhat test test/FamilyTree.roles.ts --config packages/contracts/hardhat.config.ts

# Run tests with gas reporting
npm run test:gas -w @family-tree/contracts

# Deploy to Polkadot Hub TestNet (requires PRIVATE_KEY in packages/contracts/.env)
npm run deploy:testnet -w @family-tree/contracts

# Sync ABI only (without recompiling)
npm run sync-abi

# UI development
npm run dev

# Lint UI
npx eslint --config packages/ui/eslint.config.mjs packages/ui/
```

## Monorepo Structure

npm workspaces with two packages:
- **`packages/contracts`** — Solidity smart contract, Hardhat tests, deploy scripts
- **`packages/ui`** — Next.js 16 frontend (React 19, Tailwind 4, RainbowKit + wagmi)

The `compile` script runs `hardhat compile` then `scripts/sync-abi.js`, which copies the compiled ABI into `packages/ui/src/generated/abi.ts`. The UI imports from `packages/ui/src/lib/abi.ts` (hand-maintained) or the generated file.

## Contract Architecture

Single `FamilyTree.sol` contract (no factory/proxy pattern) managing multiple independent trees. Near the 24KB contract size limit — optimizer runs set to 50.

**Data model:** Global ID counters for persons, couples, and trees. A person belongs to exactly one tree. Couples link two persons within the same tree. Cross-tree couples link persons from different trees via a bilateral handshake (propose → approve).

**Relationship rules:**
- A person can be a partner in multiple couples (no monogamy enforcement)
- A child has exactly one biological parent couple (regular or cross-tree), enforced on-chain
- Adoption is separate: a child can be adopted into additional couples without overwriting biological parents

**Role hierarchy (per-tree):** CREATOR (immutable, set at tree creation) > ADMIN (granted by creator/admin) > EDITOR (proposals only). Creators and admins can make direct edits. Editors must submit proposals that are approved by other role holders; proposals auto-execute when `approvalThreshold` is met. Proposers cannot self-approve.

**Cross-tree couples:** Creator/admin of either tree proposes → creator/admin of the *other* tree approves. Children can be added by the creator/admin of the child's tree.

## Test Organization

Tests use Hardhat + viem (`@nomicfoundation/hardhat-toolbox-viem`) with `loadFixture` for snapshot-based isolation. Each test file defines its own deploy/setup fixtures.

- `test/FamilyTree.ts` — core lifecycle (deploy, create tree, add person/couple/child)
- `test/FamilyTree.single.ts` — single-person tree creation (`createTreeSingle`)
- `test/FamilyTree.roles.ts` — role grant/revoke, threshold management
- `test/FamilyTree.tree.ts` — tree operations, pagination
- `test/FamilyTree.proposals.ts` — editor proposal workflow, approval, cancellation
- `test/FamilyTree.crosscouple.ts` — cross-tree couples, adoption

## UI Architecture

Next.js App Router. Wallet connection via RainbowKit + wagmi. Targets Polkadot Hub TestNet (chain ID 420420417), with Polkadot Hub mainnet and Kusama Hub defined in `src/lib/chain.ts`.

Contract config (address, deploy block, ABI) lives in `src/config/contract.ts`. Hooks in `src/hooks/` wrap wagmi contract reads. Tree visualization uses d3-hierarchy/d3-zoom (`src/lib/tree-layout.ts`).

Key env vars for UI: `NEXT_PUBLIC_CONTRACT_ADDRESS`, `NEXT_PUBLIC_CONTRACT_DEPLOY_BLOCK`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.

## Solidity Conventions

- Solidity 0.8.28, OpenZeppelin v5 (ReentrancyGuard)
- `PersonInput` struct used in `createTree`/`createTreeSingle` to avoid stack-too-deep
- Proposal data stored as `abi.encode`d bytes, decoded in `_executeProposal`
- All public functions have `nonReentrant` modifier
- `package.json` does NOT use `"type": "module"` (Hardhat requires CommonJS)
