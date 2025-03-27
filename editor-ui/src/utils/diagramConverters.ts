import { Node, Edge } from 'reactflow';
import { DiagramData, AwsComponentData, RelationshipData, RelationshipType } from '../types/aws';
import { v4 as uuidv4 } from 'uuid';

/**
 * Convert from VSCode diagram format to ReactFlow format
 */
export const diagramToReactFlow = (diagram: DiagramData): { nodes: Node[], edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  // Add region as a node
  nodes.push({
    id: diagram.region.id,
    type: diagram.region.type,
    position: diagram.region.position,
    data: {
      ...diagram.region,
      label: diagram.region.name
    },
    style: {
      width: diagram.region.size.width,
      height: diagram.region.size.height
    }
  });
  
  // Add child components as nodes
  diagram.region.children.forEach(component => {
    nodes.push({
      id: component.id,
      type: component.type,
      position: component.position,
      data: {
        ...component,
        label: component.name
      },
      style: {
        width: component.size.width,
        height: component.size.height
      }
    });
  });
  
  // Add relationships as edges
  diagram.relationships.forEach(relationship => {
    edges.push({
      id: relationship.id,
      source: relationship.sourceId,
      target: relationship.targetId,
      type: 'connectionEdge',
      data: {
        type: relationship.type,
        label: relationship.label
      }
    });
  });
  
  return { nodes, edges };
};

/**
 * Convert from ReactFlow format to VSCode diagram format
 */
export const reactFlowToDiagram = (
  nodes: Node[], 
  edges: Edge[], 
  diagramId: string, 
  diagramName: string
): DiagramData => {
  // Find the region node
  const regionNode = nodes.find(node => node.type === 'RegionComponent');
  
  if (!regionNode) {
    // Create a default region if none exists
    const defaultRegion: AwsComponentData = {
      id: uuidv4(),
      name: 'Region',
      type: 'RegionComponent',
      position: { x: 0, y: 0 },
      size: { width: 800, height: 600 },
      properties: {},
      regionName: 'us-east-1',
      availabilityZones: ['us-east-1a', 'us-east-1b', 'us-east-1c'],
    };
    
    return {
      id: diagramId || uuidv4(),
      name: diagramName || 'New Diagram',
      region: {
        ...defaultRegion,
        children: []
      } as any,
      relationships: []
    };
  }
  
  // Create region component
  const region: any = {
    id: regionNode.id,
    name: regionNode.data.name || 'Region',
    type: regionNode.type,
    position: regionNode.position,
    size: {
      width: regionNode.style?.width || 800,
      height: regionNode.style?.height || 600
    },
    properties: regionNode.data.properties || {},
    regionName: regionNode.data.regionName || 'us-east-1',
    availabilityZones: regionNode.data.availabilityZones || ['us-east-1a', 'us-east-1b', 'us-east-1c'],
    children: []
  };
  
  // Add child components
  nodes.forEach(node => {
    if (node.id !== regionNode.id) {
      const componentData: AwsComponentData = {
        id: node.id,
        name: node.data.name || node.data.label || `Component-${node.id.substring(0, 6)}`,
        type: node.type || '',
        position: node.position,
        size: {
          width: typeof node.style?.width === 'string' ? parseInt(node.style.width) : (node.style?.width || 120),
          height: typeof node.style?.height === 'string' ? parseInt(node.style.height) : (node.style?.height || 80),
        },
        properties: node.data.properties || {},
      };
      
      // Add component-specific properties
      Object.keys(node.data).forEach(key => {
        if (!['id', 'name', 'type', 'position', 'size', 'properties', 'children', 'label'].includes(key)) {
          (componentData as any)[key] = node.data[key];
        }
      });
      
      region.children.push(componentData);
    }
  });
  
  // Convert edges to relationships
  const relationships: RelationshipData[] = edges.map(edge => ({
    id: edge.id,
    sourceId: edge.source,
    targetId: edge.target,
    type: (edge.data?.type || 'connects_to') as RelationshipType,
    label: edge.data?.label
  }));
  
  return {
    id: diagramId,
    name: diagramName,
    region: region as any,
    relationships
  };
};

/**
 * Create a default diagram structure
 */
export const createDefaultDiagram = (name: string = 'New Diagram'): DiagramData => {
  const regionId = uuidv4();
  
  return {
    id: uuidv4(),
    name,
    region: {
      id: regionId,
      name: 'Region',
      type: 'RegionComponent',
      position: { x: 50, y: 50 },
      size: { width: 800, height: 600 },
      properties: {},
      regionName: 'us-east-1',
      availabilityZones: ['us-east-1a', 'us-east-1b', 'us-east-1c'],
      children: []
    },
    relationships: []
  };
};