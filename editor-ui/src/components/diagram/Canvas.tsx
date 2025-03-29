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
    removeEdge
  } = useDiagramStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project } = useReactFlow();

  // Handle node changes (position, selection, deletion)
  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Handle different types of node changes
      changes.forEach(change => {
        switch (change.type) {
          case 'position':
            if (change.dragging && change.position) {
              // Update our local tracking of positions during drag
              setNodePositions(prev => ({
                ...prev,
                [change.id]: change.position!
              }));
            } else if (change.dragging === false) {
              // When dragging ends, use our locally tracked position
              const finalPosition = nodePositions[change.id];
              
              if (finalPosition) {                
                // Update the node in our store
                updateNode(change.id, { position: finalPosition });
                
                // Also update node data to keep everything in sync
                updateNode(change.id, { 
                  data: { position: finalPosition }
                });
                
                // Clear the tracked position
                setNodePositions(prev => {
                  const newState = { ...prev };
                  delete newState[change.id];
                  return newState;
                });
              }
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
    [updateNode, selectNode, deselectAll, removeNode, nodePositions]
  );

  // Handle edge changes
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Handle edge deletion
      changes.forEach(change => {
        if (change.type === 'remove') {
          removeEdge(change.id);
        }
      });
    },
    [removeEdge]
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