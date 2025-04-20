import { create } from 'zustand';
import { produce } from 'immer';
import { Node, Edge, ReactFlowInstance, Connection } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import { DiagramData, AwsComponentData, RelationshipType, RelationshipData } from '../types/aws';
import { diagramToReactFlow, reactFlowToDiagram } from '../utils/diagramConverters';

interface DiagramState {
  // Diagram data
  diagram: DiagramData | null;
  nodes: Node[];
  edges: Edge[];
  
  // Selection state
  selectedNodes: string[];
  
  // ReactFlow instance
  reactFlowInstance: ReactFlowInstance | null;
  
  // Actions
  setDiagram: (diagram: DiagramData) => void;
  updateNode: (nodeId: string, data: Partial<Node>) => void;
  addNode: (nodeType: string, position: { x: number, y: number }) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (connection: Connection) => void;
  removeEdge: (edgeId: string) => void;
  
  // Selection actions
  selectNode: (nodeId: string) => void;
  deselectAll: () => void;
  
  // ReactFlow instance
  setReactFlowInstance: (instance: ReactFlowInstance) => void;
  
  // Nodes and edges actions
  setNodes: (nodes: Node[], edges?: Edge[]) => void;
  
  // Conversion utilities
  convertToReactFlowData: () => void;
  convertToVSCodeData: () => DiagramData;
  
  // New function
  addNodeAsChild: (nodeType: string, position: { x: number, y: number }, parentId: string) => string;
  
  // Move existing node to parent
  moveNodeToParent: (nodeId: string, newParentId: string) => void;
}

// Define default component properties based on type
const getDefaultComponentProps = (type: string): Partial<AwsComponentData> => {
  switch (type) {
    case 'VpcComponent':
      return {
        cidrBlock: '10.0.0.0/16'
      };
    case 'SubnetComponent':
      return {
        cidrBlock: '10.0.1.0/24',
        availabilityZone: 'us-east-1a',
        isPublic: false
      };
    case 'EC2InstanceComponent':
      return {
        instanceType: 't2.micro',
        ami: 'ami-12345'
      };
    case 'SecurityGroupComponent':
      return {};
    case 'InternetGatewayComponent':
      return {};
    case 'RouteTableComponent':
      return {};
    case 'S3BucketComponent':
      return {};
    case 'RDSInstanceComponent':
      return {
        engine: 'mysql',
        instanceClass: 'db.t3.micro'
      };
    case 'LambdaFunctionComponent':
      return {
        runtime: 'nodejs18.x',
        handler: 'index.handler'
      };
    default:
      return {};
  }
};

const useDiagramStore = create<DiagramState>((set, get) => ({
  diagram: null,
  nodes: [],
  edges: [],
  selectedNodes: [],
  reactFlowInstance: null,
  
  // Set the entire diagram
  setDiagram: (diagram) => {
    console.log('[DEBUG] Setting diagram data:', diagram);
    console.log('[DEBUG] Region children count:', diagram.region.children.length);
    console.log('[DEBUG] Relationships count:', diagram.relationships.length);
    set({ diagram });
    get().convertToReactFlowData();
  },
  
  // Update nodes and edges directly
  setNodes: (nodes, edges) => {
    console.log('[DEBUG] Setting nodes count:', nodes.length);
    if (edges) {
      console.log('[DEBUG] Setting edges count:', edges.length);
      set({ nodes, edges });
    } else {
      set({ nodes });
    }
  },
  
  // Update a node
  updateNode: (nodeId, newData) => {
    set(
      produce((state: DiagramState) => {
        const index = state.nodes.findIndex(node => node.id === nodeId);
        if (index !== -1) {
          if (newData.data) {
            state.nodes[index].data = { ...state.nodes[index].data, ...newData.data };
          }
          if (newData.position) {
            state.nodes[index].position = newData.position;
          }
          if (newData.style) {
            state.nodes[index].style = { ...state.nodes[index].style, ...newData.style };
          }
        }
      })
    );
  },
  
  // Add a new node
  addNode: (nodeType, position) => {
    const id = uuidv4();
    const displayName = nodeType.replace('Component', '');
    
    // Get default properties for this component type
    const defaultProps = getDefaultComponentProps(nodeType);
    
    // Determine if this is an area component
    const isAreaComponent = ['VpcComponent', 'SubnetComponent', 'SecurityGroupComponent', 'RegionComponent'].includes(nodeType);
    
    // Set appropriate size based on component type
    const defaultSize = isAreaComponent 
      ? { width: 300, height: 200 } 
      : { width: 120, height: 80 };
    
    // Only RegionComponent should be even larger
    const size = nodeType === 'RegionComponent' 
      ? { width: 800, height: 600 }
      : defaultSize;
    
    // Create the new node
    const newNode: Node = {
      id,
      type: nodeType,
      position,
      data: {
        id,
        name: `New ${displayName}`,
        type: nodeType,
        ...defaultProps,
        position,
        size: size,
        properties: {}
      },
      style: {
        width: size.width,
        height: size.height
      }
    };
    
    set(
      produce((state: DiagramState) => {
        state.nodes.push(newNode);
        
        // Also update the diagram structure
        if (state.diagram && newNode.type !== 'RegionComponent') {
          state.diagram.region.children.push(newNode.data as AwsComponentData);
        }
      })
    );
  },
  
  // Remove a node
  removeNode: (nodeId) => {
    set(
      produce((state: DiagramState) => {
        // Remove the node
        state.nodes = state.nodes.filter(node => node.id !== nodeId);
        
        // Remove any edges connected to this node
        state.edges = state.edges.filter(
          edge => edge.source !== nodeId && edge.target !== nodeId
        );
        
        // Update the diagram structure
        if (state.diagram) {
          state.diagram.region.children = state.diagram.region.children.filter(
            child => child.id !== nodeId
          );
          
          state.diagram.relationships = state.diagram.relationships.filter(
            rel => rel.sourceId !== nodeId && rel.targetId !== nodeId
          );
        }
        
        // Clear selection if it was selected
        if (state.selectedNodes.includes(nodeId)) {
          state.selectedNodes = state.selectedNodes.filter(id => id !== nodeId);
        }
      })
    );
  },
  
  // Add a node as a child of an area component
  addNodeAsChild: (nodeType, position, parentId) => {
    const id = uuidv4();
    const displayName = nodeType.replace('Component', '');
    
    // Get default properties for this component type
    const defaultProps = getDefaultComponentProps(nodeType);
    
    // Determine if this is an area component
    const isAreaComponent = ['VpcComponent', 'SubnetComponent', 'SecurityGroupComponent', 'RegionComponent'].includes(nodeType);
    
    // Set appropriate size based on component type
    const defaultSize = isAreaComponent 
      ? { width: 300, height: 200 } 
      : { width: 120, height: 80 };
    
    // Only RegionComponent should be even larger
    const size = nodeType === 'RegionComponent' 
      ? { width: 800, height: 600 }
      : defaultSize;
    
    // Create the new node
    const newNode: Node = {
      id,
      type: nodeType,
      position,
      data: {
        id,
        name: `New ${displayName}`,
        type: nodeType,
        ...defaultProps,
        position,
        size: size,
        properties: {},
        parentId // Store the parent ID
      },
      style: {
        width: size.width,
        height: size.height
      }
    };
    
    set(
      produce((state: DiagramState) => {
        // Add the node to the canvas
        state.nodes.push(newNode);
        
        // Add the node to the diagram structure
        if (state.diagram && newNode.type !== 'RegionComponent') {
          state.diagram.region.children.push(newNode.data as AwsComponentData);
        }
        
        // Add a "contains" relationship between parent and child
        const parentNode = state.nodes.find(node => node.id === parentId);
        if (parentNode) {
          // Add containedResources to parent node data if not exists
          if (!parentNode.data.containedResources) {
            parentNode.data.containedResources = [];
          }
          
          // Add the new node to the parent's containedResources
          parentNode.data.containedResources.push({
            id: newNode.data.id,
            name: newNode.data.name,
            type: newNode.data.type
          });
          
          // Create a "contains" relationship for the diagram
          if (state.diagram) {
            const relationshipId = uuidv4();
            const relationship: RelationshipData = {
              id: relationshipId,
              sourceId: parentId,
              targetId: id,
              type: RelationshipType.CONTAINS,
              label: 'contains'
            };
            
            state.diagram.relationships.push(relationship);
            
            // Also add a visual edge to represent containment
            const newEdge: Edge = {
              id: relationshipId,
              source: parentId,
              target: id,
              type: 'connectionEdge',
              data: {
                type: 'contains',
                label: 'contains'
              }
            };
            
            state.edges.push(newEdge);
          }
        }
      })
    );
    
    return id;
  },
  
  // Add an edge between nodes
  addEdge: (connection) => {
    const id = uuidv4();
    
    const newEdge: Edge = {
      id,
      source: connection.source!,
      target: connection.target!,
      type: 'connectionEdge',
      data: {
        type: 'connects_to',
        label: 'connects to'
      }
    };
    
    set(
      produce((state: DiagramState) => {
        state.edges.push(newEdge);
        
        // Also update the diagram structure
        if (state.diagram) {
          state.diagram.relationships.push({
            id,
            sourceId: connection.source!,
            targetId: connection.target!,
            type: RelationshipType.CONNECTS_TO,
            label: 'connects to'
          });
        }
      })
    );
  },
  
  // Remove an edge
  removeEdge: (edgeId) => {
    set(
      produce((state: DiagramState) => {
        // Remove the edge
        state.edges = state.edges.filter(edge => edge.id !== edgeId);
        
        // Update the diagram structure
        if (state.diagram) {
          state.diagram.relationships = state.diagram.relationships.filter(
            rel => rel.id !== edgeId
          );
        }
      })
    );
  },
  
  // Select a node
  selectNode: (nodeId) => {
    set({ selectedNodes: [nodeId] });
  },
  
  // Deselect all nodes
  deselectAll: () => {
    set({ selectedNodes: [] });
  },
  
  // Set the ReactFlow instance
  setReactFlowInstance: (instance) => {
    set({ reactFlowInstance: instance });
  },
  
  // Convert from VSCode data format to ReactFlow format
  convertToReactFlowData: () => {
    const { diagram } = get();
    
    if (!diagram) {
      console.log('[DEBUG] No diagram data found, setting empty nodes/edges');
      set({ nodes: [], edges: [] });
      return;
    }
    
    console.log('[DEBUG] Converting diagram to ReactFlow format');
    console.log('[DEBUG] Region before conversion:', diagram.region);
    console.log('[DEBUG] Children count before conversion:', diagram.region.children.length);
    
    const { nodes, edges } = diagramToReactFlow(diagram);
    console.log('[DEBUG] Converted nodes count:', nodes.length);
    console.log('[DEBUG] Converted edges count:', edges.length);
    console.log('[DEBUG] Node types after conversion:', nodes.map(n => n.type));
    set({ nodes, edges });
  },
  
  // Convert from ReactFlow format to VSCode data format
  convertToVSCodeData: () => {
    const { nodes, edges, diagram } = get();
    
    if (!diagram) {
      throw new Error('No diagram data available');
    }
    
    const updatedDiagram = reactFlowToDiagram(
      nodes,
      edges,
      diagram.id,
      diagram.name
    );
    
    return updatedDiagram;
  },
  
  // Move an existing node to a new parent
  moveNodeToParent: (nodeId, newParentId) => {
    console.log(`moveNodeToParent called: nodeId=${nodeId}, newParentId=${newParentId}`);
    
    set(
      produce((state: DiagramState) => {
        // Find the node to move
        const nodeToMove = state.nodes.find(node => node.id === nodeId);
        if (!nodeToMove) {
          console.error(`Node to move (${nodeId}) not found`);
          return;
        }
        
        // Find the new parent node
        const newParentNode = state.nodes.find(node => node.id === newParentId);
        if (!newParentNode) {
          console.error(`New parent node (${newParentId}) not found`);
          return;
        }
        
        console.log(`Moving node: ${nodeToMove.data.name} (${nodeToMove.type}) to parent: ${newParentNode.data.name} (${newParentNode.type})`);
        
        // Find the old parent if any
        const oldParentId = nodeToMove.data.parentId;
        if (oldParentId) {
          console.log(`Found old parent: ${oldParentId}`);
          const oldParentNode = state.nodes.find(node => node.id === oldParentId);
          
          // Remove the node from the old parent's containedResources
          if (oldParentNode && oldParentNode.data.containedResources) {
            console.log(`Removing from old parent's containedResources`);
            oldParentNode.data.containedResources = oldParentNode.data.containedResources.filter(
              (resource: { id: string }) => resource.id !== nodeId
            );
          }
          
          // Remove the old "contains" relationship
          if (state.diagram) {
            console.log(`Removing old relationships`);
            const edgesBefore = state.edges.length;
            state.edges = state.edges.filter(edge => 
              !(edge.source === oldParentId && edge.target === nodeId && edge.data?.type === 'contains')
            );
            console.log(`Removed ${edgesBefore - state.edges.length} edges`);
            
            const relsBefore = state.diagram.relationships.length;
            state.diagram.relationships = state.diagram.relationships.filter(rel => 
              !(rel.sourceId === oldParentId && rel.targetId === nodeId && rel.type === RelationshipType.CONTAINS)
            );
            console.log(`Removed ${relsBefore - state.diagram.relationships.length} relationships`);
          }
        }
        
        // Update the node's parent reference
        console.log(`Setting new parent ID on node data`);
        nodeToMove.data.parentId = newParentId;
        
        // Add the node to the new parent's containedResources
        if (!newParentNode.data.containedResources) {
          console.log(`Initializing containedResources array for new parent`);
          newParentNode.data.containedResources = [];
        }
        
        // Add only if not already in the list
        if (!newParentNode.data.containedResources.some((r: { id: string }) => r.id === nodeId)) {
          console.log(`Adding node to new parent's containedResources`);
          newParentNode.data.containedResources.push({
            id: nodeToMove.data.id,
            name: nodeToMove.data.name,
            type: nodeToMove.data.type
          });
        } else {
          console.log(`Node already in parent's containedResources`);
        }
        
        // Create a new "contains" relationship in the diagram
        if (state.diagram) {
          const relationshipId = uuidv4();
          console.log(`Creating new relationship with ID: ${relationshipId}`);
          
          const relationship: RelationshipData = {
            id: relationshipId,
            sourceId: newParentId,
            targetId: nodeId,
            type: RelationshipType.CONTAINS,
            label: 'contains'
          };
          
          // Add the relationship to the diagram
          state.diagram.relationships.push(relationship);
          
          // Add a visual edge to represent containment
          const newEdge: Edge = {
            id: relationshipId,
            source: newParentId,
            target: nodeId,
            type: 'connectionEdge',
            data: {
              type: 'contains',
              label: 'contains'
            }
          };
          
          state.edges.push(newEdge);
          console.log(`Added new edge and relationship`);
        }
        
        console.log(`Node successfully moved to new parent`);
      })
    );
  }
}));

export default useDiagramStore;