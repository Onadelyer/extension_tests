import React, { useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
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
            if (change.position && change.dragging === false) {
              // Update node position when dragging ends
              updateNode(change.id, { position: change.position });
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
    [updateNode, selectNode, deselectAll, removeNode]
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
  
        // Fix: Calculate position correctly by considering scroll position
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top
        });
  
        // Apply any necessary adjustment to correct the offset
        // You may need to adjust these values based on your specific offset
        const correctedPosition = {
          x: position.x,
          y: position.y
        };
  
        // Snap to grid (20px)
        const snappedPosition = {
          x: Math.round(correctedPosition.x / 20) * 20,
          y: Math.round(correctedPosition.y / 20) * 20
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