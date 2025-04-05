import * as yaml from 'js-yaml';
import { DiagramData } from '../types/aws';

/**
 * Convert a diagram to YAML format
 * @param diagram The diagram data
 * @returns YAML string
 */
export const diagramToYaml = (diagram: DiagramData): string => {
  try {
    console.log("Converting diagram to YAML:", diagram);
    
    // Create a formatted version optimized for YAML
    const yamlFriendlyDiagram = {
      id: diagram.id,
      name: diagram.name,
      // Include source files information if available
      sourceFiles: diagram.sourceFiles ? {
        rootFolder: diagram.sourceFiles.rootFolder,
        files: diagram.sourceFiles.files
      } : undefined,
      region: {
        id: diagram.region.id,
        name: diagram.region.name,
        type: diagram.region.type,
        position: diagram.region.position,
        size: diagram.region.size,
        properties: diagram.region.properties,
        regionName: diagram.region.regionName,
        availabilityZones: diagram.region.availabilityZones,
        children: diagram.region.children.map(child => ({
          id: child.id,
          name: child.name,
          type: child.type,
          position: child.position,
          size: child.size,
          // Include component-specific properties
          ...(child.cidrBlock ? { cidrBlock: child.cidrBlock } : {}),
          ...(child.instanceType ? { instanceType: child.instanceType } : {}),
          ...(child.ami ? { ami: child.ami } : {}),
          ...(child.availabilityZone ? { availabilityZone: child.availabilityZone } : {}),
          ...(child.isPublic !== undefined ? { isPublic: child.isPublic } : {}),
          // Add other properties as needed
          properties: child.properties
        }))
      },
      relationships: diagram.relationships.map(rel => ({
        id: rel.id,
        sourceId: rel.sourceId,
        targetId: rel.targetId,
        type: rel.type,
        ...(rel.label ? { label: rel.label } : {})
      }))
    };

    // Convert to YAML
    return yaml.dump(yamlFriendlyDiagram, {
      indent: 2,
      lineWidth: -1,  // Prevent folding of long lines
      noRefs: true,
      sortKeys: false
    });
  } catch (error) {
    console.error('Error converting diagram to YAML:', error);
    throw new Error(`Failed to convert diagram to YAML: ${error}`);
  }
};

/**
 * Parse YAML string to diagram data
 * @param yamlString YAML string
 * @returns Diagram data
 */
export const yamlToDiagram = (yamlString: string): DiagramData => {
  try {
    const parsedYaml = yaml.load(yamlString) as any;
    
    if (!parsedYaml || typeof parsedYaml !== 'object') {
      throw new Error('Invalid YAML format');
    }
    
    // Convert YAML to DiagramData format
    return {
      id: parsedYaml.id || '',
      name: parsedYaml.name || 'Untitled Diagram',
      // Include source files if available
      sourceFiles: parsedYaml.sourceFiles ? {
        rootFolder: parsedYaml.sourceFiles.rootFolder || '',
        files: Array.isArray(parsedYaml.sourceFiles.files) ? parsedYaml.sourceFiles.files : []
      } : undefined,
      region: {
        id: parsedYaml.region?.id || '',
        name: parsedYaml.region?.name || 'Region',
        type: parsedYaml.region?.type || 'RegionComponent',
        position: parsedYaml.region?.position || { x: 0, y: 0 },
        size: parsedYaml.region?.size || { width: 800, height: 600 },
        properties: parsedYaml.region?.properties || {},
        regionName: parsedYaml.region?.regionName || 'us-east-1',
        availabilityZones: parsedYaml.region?.availabilityZones || ['us-east-1a', 'us-east-1b', 'us-east-1c'],
        children: Array.isArray(parsedYaml.region?.children) 
          ? parsedYaml.region.children.map((child: any) => ({
              id: child.id || '',
              name: child.name || '',
              type: child.type || '',
              position: child.position || { x: 0, y: 0 },
              size: child.size || { width: 120, height: 80 },
              properties: child.properties || {},
              // Include component-specific properties
              ...(child.cidrBlock ? { cidrBlock: child.cidrBlock } : {}),
              ...(child.instanceType ? { instanceType: child.instanceType } : {}),
              ...(child.ami ? { ami: child.ami } : {}),
              ...(child.availabilityZone ? { availabilityZone: child.availabilityZone } : {}),
              ...(child.isPublic !== undefined ? { isPublic: child.isPublic } : {})
              // Add other properties as needed
            }))
          : []
      },
      relationships: Array.isArray(parsedYaml.relationships)
        ? parsedYaml.relationships.map((rel: any) => ({
            id: rel.id || '',
            sourceId: rel.sourceId || '',
            targetId: rel.targetId || '',
            type: rel.type || 'connects_to',
            label: rel.label || undefined
          }))
        : []
    };
  } catch (error) {
    console.error('Error parsing YAML to diagram:', error);
    throw new Error(`Failed to parse YAML to diagram: ${error}`);
  }
};