import React, { useCallback, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  ReactFlowInstance,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  NodeChange,
  EdgeChange,
  Connection,
  applyNodeChanges,
  XYPosition,
  applyEdgeChanges
} from 'reactflow';
import 'reactflow/dist/style.css';

import useDiagramStore from '../../store/diagramStore';
import { nodeTypes } from './nodes';
import ConnectionEdge from './edges/ConnectionEdge';

// Define custom edge types
const edgeTypes = {
  connectionEdge: ConnectionEdge
};

const DiagramCanvas: React.FC = () => {
  const [nodePositions, setNodePositions] = useState<Record<string, XYPosition>>({});

  const {
    nodes,
    edges,
    updateNode,
    selectNode,
    deselectAll,
    reactFlowInstance,
    setReactFlowInstance,
    addNode,
    removeNode,
    addEdge,
    removeEdge,
    setNodes
  } = useDiagramStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project } = useReactFlow();

  // Handle node changes (position, selection, deletion)
  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Apply changes directly to nodes array to ensure real-time updates during dragging
      const updatedNodes = applyNodeChanges(changes, nodes);
      setNodes(updatedNodes);
      
      // Handle different types of node changes for additional state updates
      changes.forEach(change => {
        switch (change.type) {
          case 'position':
            if (change.dragging === false && change.position) {
              // When dragging ends, update the node data to keep everything in sync
              updateNode(change.id, { 
                data: { position: change.position }
              });
            }
            break;
          case 'select':
            if (change.selected) {
              selectNode(change.id);
            } else {
              deselectAll();
            }
            break;
          case 'remove':
            removeNode(change.id);
            break;
        }
      });
    },
    [nodes, setNodes, updateNode, selectNode, deselectAll, removeNode]
  );

  // Handle edge changes
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Apply changes directly to edges array
      const updatedEdges = applyEdgeChanges(changes, edges);
      // Update the edges in our store
      if (JSON.stringify(updatedEdges) !== JSON.stringify(edges)) {
        // Only update if there are actual changes
        setNodes(nodes, updatedEdges);
      }
      
      // Handle edge deletion
      changes.forEach(change => {
        if (change.type === 'remove') {
          removeEdge(change.id);
        }
      });
    },
    [edges, nodes, setNodes, removeEdge]
  );

  // Handle connecting nodes
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        addEdge(connection);
      }
    },
    [addEdge]
  );

  // Handle dropping new nodes
  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
  
      if (reactFlowWrapper.current && reactFlowInstance) {
        const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
        const componentType = event.dataTransfer.getData('application/reactflow');
  
        if (!componentType) {
          return;
        }
  
        // The key change: Use the project method instead of screenToFlowPosition
        // This correctly accounts for the current pan and zoom
        const position = reactFlowInstance.project({
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top
        });
  
        // Snap to grid
        const snappedPosition = {
          x: Math.round(position.x / 20) * 20,
          y: Math.round(position.y / 20) * 20
        };
  
        // Add the new node
        addNode(componentType, snappedPosition);
      }
    },
    [reactFlowInstance, addNode]
  );

  return (
    <div 
      className="diagram-canvas-wrapper" 
      ref={reactFlowWrapper} 
      style={{ width: '100%', height: '100%' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onDrop={onDrop}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move';} }
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        draggable={true}
        nodesDraggable={true}
        selectNodesOnDrag={true}
        fitView
        snapToGrid
        snapGrid={[20, 20]}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.1}
        maxZoom={1.5}
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background variant={nodes.length > 0 ? BackgroundVariant.Dots : BackgroundVariant.Lines}  gap={20} size={1} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
      </ReactFlow>
    </div>
  );
};

// Wrap with ReactFlowProvider at parent level
const DiagramCanvasWithProvider: React.FC = () => (
  <ReactFlowProvider>
    <DiagramCanvas />
  </ReactFlowProvider>
);

export default DiagramCanvasWithProvider;