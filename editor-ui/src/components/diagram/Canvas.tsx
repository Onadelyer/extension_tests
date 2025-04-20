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
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  // Track nodes being dragged
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

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
    setNodes,
    addNodeAsChild,
    moveNodeToParent
  } = useDiagramStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project } = useReactFlow();

  // Helper to find node at a position
  const findNodeAtPosition = useCallback(
    (position: XYPosition) => {
      console.log(`Looking for node at position: (${position.x}, ${position.y})`);
      const areaTypes = ['VpcComponent', 'SubnetComponent', 'SecurityGroupComponent', 'RegionComponent'];
      
      // Collect all area nodes for debugging
      const areaNodes = nodes.filter(node => node.type && areaTypes.includes(node.type));
      console.log(`Found ${areaNodes.length} area nodes to check`);
      
      // Check each area node if the position is inside it
      return nodes.find(node => {
        // Check if the node is an area type
        if (!node.type || !areaTypes.includes(node.type)) {
          return false;
        }
        
        // Skip if this is the node being dragged
        if (node.id === draggedNodeId) {
          return false;
        }
        
        // Check if the position is within the node's boundaries
        const nodeX = node.position.x;
        const nodeY = node.position.y;
        const nodeWidth = node.style?.width as number || 300;
        const nodeHeight = node.style?.height as number || 200;
        
        const isInside = 
          position.x >= nodeX && 
          position.x <= nodeX + nodeWidth && 
          position.y >= nodeY && 
          position.y <= nodeY + nodeHeight;
        
        if (isInside) {
          console.log(`Found node ${node.id} (${node.type}) at position containing point`);
        }
        
        return isInside;
      });
    },
    [nodes, draggedNodeId]
  );

  // Handle node changes (position, selection, deletion)
  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Apply changes directly to nodes array to ensure real-time updates during dragging
      const updatedNodes = applyNodeChanges(changes, nodes);
      setNodes(updatedNodes);
      
      // Process each change individually
      changes.forEach(change => {
        switch (change.type) {
          case 'position':
            if (change.dragging) {
              // Node drag started or continues
              setDraggedNodeId(change.id);
              console.log(`Dragging node: ${change.id}`);
              
              // Get the dragged node's current position and check if it can be contained
              const draggedNode = updatedNodes.find(n => n.id === change.id);
              if (draggedNode && change.position) {
                // Skip area nodes being dragged - they can't be contained in other areas
                const areaTypes = ['VpcComponent', 'SubnetComponent', 'SecurityGroupComponent', 'RegionComponent'];
                const isDraggingAreaNode = draggedNode.type && areaTypes.includes(draggedNode.type);
                
                if (isDraggingAreaNode) {
                  console.log(`Dragging an area node (${draggedNode.type}) - cannot be contained in other areas`);
                  // Reset any existing drop target
                  if (dropTargetId) {
                    const prevTarget = updatedNodes.find(n => n.id === dropTargetId);
                    if (prevTarget) {
                      updateNode(prevTarget.id, {
                        style: {
                          ...prevTarget.style,
                          borderColor: '#ccc',
                          borderWidth: 1,
                          borderStyle: 'dashed',
                          boxShadow: 'none'
                        },
                        data: {
                          ...prevTarget.data,
                          isDropTarget: false
                        }
                      });
                    }
                    setDropTargetId(null);
                  }
                  break;
                }
                
                // Calculate center of the dragged node
                const nodeWidth = (draggedNode.style?.width as number) || 120;
                const nodeHeight = (draggedNode.style?.height as number) || 80;
                const nodeCenter = {
                  x: change.position.x + nodeWidth / 2,
                  y: change.position.y + nodeHeight / 2
                };
                
                console.log(`Node center at: (${nodeCenter.x}, ${nodeCenter.y})`);
                
                // Find potential area node at this position
                const potentialDropTarget = findNodeAtPosition(nodeCenter);
                
                // If found a drop target, highlight it
                if (potentialDropTarget) {
                  console.log(`Setting drop target: ${potentialDropTarget.id} (${potentialDropTarget.type})`);
                  if (dropTargetId !== potentialDropTarget.id) {
                    // Reset previous target if changed
                    if (dropTargetId) {
                      const prevTarget = updatedNodes.find(n => n.id === dropTargetId);
                      if (prevTarget) {
                        updateNode(prevTarget.id, {
                          style: {
                            ...prevTarget.style,
                            borderColor: '#ccc',
                            borderWidth: 1,
                            borderStyle: 'dashed',
                            boxShadow: 'none'
                          },
                          data: {
                            ...prevTarget.data,
                            isDropTarget: false
                          }
                        });
                      }
                    }
                    
                    // Set new drop target
                    setDropTargetId(potentialDropTarget.id);
                    
                    // Highlight it
                    updateNode(potentialDropTarget.id, {
                      style: {
                        ...potentialDropTarget.style,
                        borderColor: '#0078d4',
                        borderWidth: 2,
                        borderStyle: 'dashed',
                        boxShadow: '0 0 10px rgba(0, 120, 212, 0.3)'
                      },
                      data: {
                        ...potentialDropTarget.data,
                        isDropTarget: true
                      }
                    });
                  }
                } else if (dropTargetId) {
                  // Reset previous target when not over any target
                  const prevTarget = updatedNodes.find(n => n.id === dropTargetId);
                  if (prevTarget) {
                    updateNode(prevTarget.id, {
                      style: {
                        ...prevTarget.style,
                        borderColor: '#ccc',
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        boxShadow: 'none'
                      },
                      data: {
                        ...prevTarget.data,
                        isDropTarget: false
                      }
                    });
                  }
                  setDropTargetId(null);
                }
              }
            } else if (change.dragging === false) {
              // Node drag has ended
              
              // Check if we have both a dragged node and drop target
              if (draggedNodeId && dropTargetId) {
                // Check that they're not the same node
                if (draggedNodeId !== dropTargetId) {
                  console.log(`Moving node ${draggedNodeId} to parent ${dropTargetId}`);
                  moveNodeToParent(draggedNodeId, dropTargetId);
                }
              }
              
              // Reset all styles and state
              updatedNodes.forEach(node => {
                if (node.style?.borderColor === '#0078d4') {
                  updateNode(node.id, {
                    style: {
                      ...node.style,
                      borderColor: '#ccc',
                      borderWidth: 1,
                      borderStyle: 'dashed',
                      boxShadow: 'none'
                    }
                  });
                }
              });
              
              // Reset tracking state
              setDropTargetId(null);
              setDraggedNodeId(null);
              
              // Update position in the node data
              if (change.position) {
              updateNode(change.id, { 
                data: { position: change.position }
              });
              }
            }
            break;
            
          case 'select':
            // Force selection to update the store
            if (change.selected) {
              // Slight delay to ensure selection works even with click events
              setTimeout(() => {
                selectNode(change.id);
              }, 0);
            } else if (!changes.some(c => c.type === 'select' && c.selected)) {
              // Only deselect if there are no other nodes being selected
              setTimeout(() => {
                deselectAll();
              }, 0);
            }
            break;
            
          case 'remove':
            removeNode(change.id);
            break;
        }
      });
    },
    [nodes, setNodes, updateNode, selectNode, deselectAll, removeNode, dropTargetId, draggedNodeId, moveNodeToParent]
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

  // Handle drag over for highlighting potential drop areas
  const onDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      
      // Only process if we have ReactFlow instance
      if (reactFlowWrapper.current && reactFlowInstance) {
        const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
        const position = reactFlowInstance.project({
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top
        });
        
        // Find if we're over an area node
        const nodeAtPosition = findNodeAtPosition(position);
        
        // Update the drop target id
        setDropTargetId(nodeAtPosition ? nodeAtPosition.id : null);
        
        // If we found a node, add a visual indicator by updating its style
        if (nodeAtPosition) {
          // Update node style to show it's a valid drop target
          updateNode(nodeAtPosition.id, {
            style: {
              ...nodeAtPosition.style,
              borderColor: '#0078d4',
              borderWidth: 2,
              borderStyle: 'dashed',
              boxShadow: '0 0 10px rgba(0, 120, 212, 0.3)'
            },
            data: {
              ...nodeAtPosition.data,
              isDropTarget: true
            }
          });
        }
        
        // Reset styles for other nodes
        nodes.forEach(node => {
          if (node.id !== (nodeAtPosition?.id || '')) {
            // Only reset the ones we've modified
            if (node.style?.borderColor === '#0078d4') {
              updateNode(node.id, {
                style: {
                  ...node.style,
                  borderColor: '#ccc',
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  boxShadow: 'none'
                }
              });
            }
          }
        });
      }
    },
    [reactFlowInstance, updateNode, nodes, findNodeAtPosition]
  );

  // Reset styles when drag leaves or ends
  const onDragLeave = useCallback(() => {
    // Reset drop target and styles
    if (dropTargetId) {
      const nodeToReset = nodes.find(n => n.id === dropTargetId);
      if (nodeToReset) {
        updateNode(nodeToReset.id, {
          style: {
            ...nodeToReset.style,
            borderColor: '#ccc',
            borderWidth: 1,
            borderStyle: 'dashed',
            boxShadow: 'none'
          },
          data: {
            ...nodeToReset.data,
            isDropTarget: false
          }
        });
      }
      setDropTargetId(null);
    }
  }, [dropTargetId, nodes, updateNode]);

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
  
        // Get the drop position in ReactFlow coordinates
        const position = reactFlowInstance.project({
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top
        });
  
        // Snap to grid
        const snappedPosition = {
          x: Math.round(position.x / 20) * 20,
          y: Math.round(position.y / 20) * 20
        };
  
        // Check if the drop position is over an Area node
        const nodeAtPosition = findNodeAtPosition(position);
        
        // Reset all drop target styling
        nodes.forEach(node => {
          if (node.style?.borderColor === '#0078d4' || node.data.isDropTarget) {
            updateNode(node.id, {
              style: {
                ...node.style,
                borderColor: '#ccc',
                borderWidth: 1,
                borderStyle: 'dashed',
                boxShadow: 'none'
              },
              data: {
                ...node.data,
                isDropTarget: false
              }
            });
          }
        });
        
        // Reset drop target
        setDropTargetId(null);
        
        if (nodeAtPosition) {
          // If the drop is over an Area node, add the new node as its child
          addNodeAsChild(componentType, snappedPosition, nodeAtPosition.id);
        } else {
          // If not, add it to the canvas as usual
        addNode(componentType, snappedPosition);
        }
      }
    },
    [reactFlowInstance, addNode, addNodeAsChild, findNodeAtPosition, nodes, updateNode]
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
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDragEnd={onDragLeave}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        draggable={true}
        nodesDraggable={true}
        elementsSelectable={true}
        selectNodesOnDrag={false}
        onClick={() => deselectAll()} // Deselect when clicking on empty canvas
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