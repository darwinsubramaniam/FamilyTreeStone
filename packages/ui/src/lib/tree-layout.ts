import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";
import type {
  TreeHierarchyNode,
  CoupleHierarchyNode,
  PersonHierarchyNode,
  CrossTreeCouple,
  Person,
} from "@/types";

export interface CoupleNodeData {
  type: "couple";
  coupleId: bigint;
  partner1: Person;
  partner2: Person;
  crossTree?: boolean;
  foreign?: boolean;
}

export interface PersonNodeData {
  type: "person";
  person: Person;
  foreign?: boolean;
}

export type FlowNodeData = CoupleNodeData | PersonNodeData;

const COUPLE_WIDTH = 280;
const COUPLE_HEIGHT = 100;
const PERSON_WIDTH = 160;
const PERSON_HEIGHT = 70;

// ---------------------------------------------------------------------------
// Explode helpers — find a person's family context in a foreign tree hierarchy
// and return a depth-limited subtree.
// ---------------------------------------------------------------------------

/**
 * Search the hierarchy for the person (as a partner or single child) and
 * return the subtree root that represents their family context.
 *
 * - If the person is a partner in a couple, return that couple's parent
 *   (the in-laws). Falls back to the couple itself if it's the root.
 * - If the person is a single child, return their parent couple.
 */
function findPersonContext(
  root: TreeHierarchyNode,
  personId: bigint
): CoupleHierarchyNode | null {
  function search(
    node: TreeHierarchyNode,
    parent: CoupleHierarchyNode | null
  ): CoupleHierarchyNode | null {
    if (node.type === "couple") {
      const couple = node as CoupleHierarchyNode;
      if (couple.partner1.id === personId || couple.partner2.id === personId) {
        return parent ?? couple;
      }
      for (const child of couple.children) {
        const result = search(child, couple);
        if (result) return result;
      }
    } else {
      const person = node as PersonHierarchyNode;
      if (person.person.id === personId && parent) {
        return parent;
      }
    }
    return null;
  }
  return search(root, null);
}

/** Return a copy of the subtree limited to `maxDepth` child levels. */
function limitDepth(
  node: TreeHierarchyNode,
  maxDepth: number
): TreeHierarchyNode {
  if (maxDepth <= 0 || node.children.length === 0) {
    return { ...node, children: [] };
  }
  return {
    ...node,
    children: node.children.map((child) => limitDepth(child, maxDepth - 1)),
  };
}

/**
 * Walk the main tree hierarchy. For every cross-tree couple node, look up
 * the foreign partner's family in `foreignTrees` and splice a depth-limited
 * subtree into the cross-tree couple's children.
 */
export function expandHierarchy(
  root: TreeHierarchyNode,
  foreignTrees: Map<bigint, TreeHierarchyNode | null>,
  crossCoupleMap: Map<bigint, CrossTreeCouple>,
  currentTreeId: bigint,
  depth: number
): TreeHierarchyNode {
  function expand(node: TreeHierarchyNode): TreeHierarchyNode {
    if (node.type === "person") return node;

    const couple = node as CoupleHierarchyNode;
    const expandedChildren = couple.children.map(expand);

    if (couple.crossTree && depth > 0) {
      const xc = crossCoupleMap.get(couple.coupleId);
      if (xc) {
        const foreignTreeId =
          xc.tree1Id === currentTreeId ? xc.tree2Id : xc.tree1Id;
        const foreignPartnerId =
          xc.tree1Id === currentTreeId ? xc.partner2Id : xc.partner1Id;
        const foreignHierarchy = foreignTrees.get(foreignTreeId);

        if (foreignHierarchy) {
          const context = findPersonContext(foreignHierarchy, foreignPartnerId);
          if (context) {
            const subtree = limitDepth(context, depth);
            expandedChildren.push(subtree);
          }
        }
      }
    }

    return { ...couple, children: expandedChildren };
  }
  return expand(root);
}

// ---------------------------------------------------------------------------
// Flatten hierarchy → React Flow nodes + edges
// ---------------------------------------------------------------------------

function flattenHierarchy(root: TreeHierarchyNode): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const visitedIds = new Set<string>();

  function visit(
    node: TreeHierarchyNode,
    parentId?: string,
    foreign?: boolean
  ) {
    let nodeId: string;

    if (node.type === "couple") {
      const couple = node as CoupleHierarchyNode;
      const prefix = couple.crossTree ? "xcouple" : "couple";
      nodeId = `${prefix}-${couple.coupleId.toString()}`;

      // Guard against duplicates (foreign subtree may overlap with main tree)
      if (visitedIds.has(nodeId)) return;
      visitedIds.add(nodeId);

      nodes.push({
        id: nodeId,
        type: "couple",
        position: { x: 0, y: 0 },
        data: {
          type: "couple",
          coupleId: couple.coupleId,
          partner1: couple.partner1,
          partner2: couple.partner2,
          crossTree: couple.crossTree,
          foreign,
        } satisfies CoupleNodeData,
      });
    } else {
      const person = node as PersonHierarchyNode;
      nodeId = `person-${person.person.id.toString()}`;

      if (visitedIds.has(nodeId)) return;
      visitedIds.add(nodeId);

      nodes.push({
        id: nodeId,
        type: "person",
        position: { x: 0, y: 0 },
        data: {
          type: "person",
          person: person.person,
          foreign,
        } satisfies PersonNodeData,
      });
    }

    if (parentId) {
      const edgeStyle = foreign
        ? { stroke: "#22d3ee", strokeWidth: 2, strokeDasharray: "6 3" }
        : { stroke: "#4b5563", strokeWidth: 2 };
      edges.push({
        id: `${parentId}->${nodeId}`,
        source: parentId,
        target: nodeId,
        type: "smoothstep",
        style: edgeStyle,
      });
    }

    // Children of a foreign node are also foreign
    const childForeign = foreign || false;
    for (const child of node.children) {
      // Children added by expandHierarchy (foreign family) are from the
      // foreign tree — detect them by checking if the parent is a cross-tree
      // couple and the child is NOT already marked crossTree.
      const isForeignChild =
        childForeign ||
        (node.type === "couple" &&
          (node as CoupleHierarchyNode).crossTree === true &&
          child.type === "couple" &&
          !(child as CoupleHierarchyNode).crossTree);
      visit(child, nodeId, isForeignChild);
    }
  }

  visit(root, undefined, false);
  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Dagre layout
// ---------------------------------------------------------------------------

export function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 100 });

  for (const node of nodes) {
    const width = node.type === "couple" ? COUPLE_WIDTH : PERSON_WIDTH;
    const height = node.type === "couple" ? COUPLE_HEIGHT : PERSON_HEIGHT;
    g.setNode(node.id, { width, height });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    const width = node.type === "couple" ? COUPLE_WIDTH : PERSON_WIDTH;
    const height = node.type === "couple" ? COUPLE_HEIGHT : PERSON_HEIGHT;
    return {
      ...node,
      position: {
        x: pos.x - width / 2,
        y: pos.y - height / 2,
      },
    };
  });
}

export function getLayoutedElements(root: TreeHierarchyNode): {
  nodes: Node[];
  edges: Edge[];
} {
  const { nodes, edges } = flattenHierarchy(root);
  return { nodes: applyDagreLayout(nodes, edges), edges };
}
