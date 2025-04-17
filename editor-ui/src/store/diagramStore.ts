import { create } from 'zustand';
import { produce } from 'immer';
import { Node, Edge, ReactFlowInstance, Connection } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import { DiagramData, AwsComponentData, RelationshipType } from '../types/aws';
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
    set({ diagram });
    get().convertToReactFlowData();
  },
  
  // Update nodes and edges directly
  setNodes: (nodes, edges) => {
    if (edges) {
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
        size: { width: 120, height: 80 },
        properties: {}
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
      set({ nodes: [], edges: [] });
      return;
    }
    
    const { nodes, edges } = diagramToReactFlow(diagram);
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
  }
}));

export default useDiagramStore;