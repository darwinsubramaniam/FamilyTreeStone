"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
  type Node,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import type { TreeHierarchyNode, CrossTreeCouple, UserRole, Person } from "@/types";
import { getLayoutedElements, applyDagreLayout, expandHierarchy } from "@/lib/tree-layout";
import type { CoupleNodeData, PersonNodeData } from "@/lib/tree-layout";
import { PersonNode } from "./PersonNode";
import { CoupleGroupNode } from "./CoupleGroupNode";
import { PersonDetailModal } from "./PersonDetailModal";
import { Spinner } from "@/components/ui/Spinner";

const nodeTypes = {
  couple: CoupleGroupNode,
  person: PersonNode,
};

interface FamilyTreeViewProps {
  hierarchy: TreeHierarchyNode | null;
  persons: Map<bigint, Person>;
  isLoading: boolean;
  treeId?: bigint;
  role?: UserRole;
  onAdoptClick?: (personId: bigint) => void;
  onRefresh?: () => void;
  crossCouples?: CrossTreeCouple[];
  foreignTrees?: Map<bigint, TreeHierarchyNode | null>;
}

const DEPTH_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 1, label: "Depth 1" },
  { value: 2, label: "Depth 2" },
  { value: 3, label: "Depth 3" },
];

export function FamilyTreeView({
  hierarchy,
  persons,
  isLoading,
  treeId,
  role,
  onAdoptClick,
  onRefresh,
  crossCouples,
  foreignTrees,
}: FamilyTreeViewProps) {
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [explodeDepth, setExplodeDepth] = useState(0);

  // Expand the hierarchy with foreign family subtrees when explode is on
  const expandedHierarchy = useMemo(() => {
    if (!hierarchy) return null;
    if (explodeDepth === 0 || !foreignTrees || !crossCouples || !treeId) return hierarchy;

    const crossCoupleMap = new Map<bigint, CrossTreeCouple>();
    for (const xc of crossCouples) {
      crossCoupleMap.set(xc.id, xc);
    }

    return expandHierarchy(hierarchy, foreignTrees, crossCoupleMap, treeId, explodeDepth);
  }, [hierarchy, explodeDepth, foreignTrees, crossCouples, treeId]);

  const initial = useMemo(() => {
    if (!expandedHierarchy) return { nodes: [] as Node[], edges: [] as ReturnType<typeof getLayoutedElements>["edges"] };
    return getLayoutedElements(expandedHierarchy);
  }, [expandedHierarchy]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  // Sync when hierarchy changes
  useMemo(() => {
    setNodes(initial.nodes);
    setEdges(initial.edges);
  }, [initial, setNodes, setEdges]);

  const onReLayout = useCallback(() => {
    setNodes((currentNodes) => applyDagreLayout(currentNodes, edges));
  }, [edges, setNodes]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const data = node.data as unknown as CoupleNodeData | PersonNodeData;
      if (data.type === "person") {
        setSelectedPerson(data.person);
      } else if (data.type === "couple") {
        setSelectedPerson(data.partner1);
      }
    },
    []
  );

  const hasCrossTreeCouples = crossCouples && crossCouples.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hierarchy) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        No tree data available
      </div>
    );
  }

  return (
    <>
      <div className="w-full h-[calc(100vh-220px)] min-h-[500px] bg-gray-950 rounded-xl border border-gray-800">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          nodesDraggable={true}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Controls
            className="!bg-gray-900 !border-gray-700 !rounded-lg [&>button]:!bg-gray-800 [&>button]:!border-gray-700 [&>button]:!text-gray-300 [&>button:hover]:!bg-gray-700"
          />
          <Background variant={BackgroundVariant.Dots} color="#374151" gap={20} size={1} />
          <Panel position="top-right">
            <div className="flex items-center gap-2">
              {hasCrossTreeCouples && (
                <select
                  value={explodeDepth}
                  onChange={(e) => setExplodeDepth(Number(e.target.value))}
                  className="px-2 py-1.5 text-xs font-medium bg-gray-800 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-700 focus:outline-none focus:border-cyan-500"
                >
                  {DEPTH_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      Explode: {opt.label}
                    </option>
                  ))}
                </select>
              )}
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-800 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-700 hover:text-white transition-colors"
                >
                  Refresh
                </button>
              )}
              <button
                onClick={onReLayout}
                className="px-3 py-1.5 text-xs font-medium bg-gray-800 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-700 hover:text-white transition-colors"
              >
                Re-align
              </button>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      <PersonDetailModal
        person={selectedPerson}
        open={!!selectedPerson}
        onClose={() => setSelectedPerson(null)}
        treeId={treeId}
        role={role}
        onAdoptClick={
          onAdoptClick
            ? (personId) => {
                setSelectedPerson(null);
                onAdoptClick(personId);
              }
            : undefined
        }
      />
    </>
  );
}
