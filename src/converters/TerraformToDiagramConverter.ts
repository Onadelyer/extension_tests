// src/converters/TerraformToDiagramConverter.ts
import { DiagramModel } from '../models/aws/DiagramModel';
import { TerraformResource } from '../parsers/TerraformResourceParser';
import { ResourceMappingConfig, ResourceMapping } from '../config/ResourceMappingConfig';
import { AwsComponent } from '../models/aws/base/AwsComponent';
import { VpcComponent } from '../models/aws/components/VpcComponent';
import { SubnetComponent } from '../models/aws/components/SubnetComponent';
import { EC2InstanceComponent } from '../models/aws/components/EC2InstanceComponent';
import { RelationshipType } from '../models/aws/ComponentRelationship';
import * as path from 'path';

/**
 * Converts Terraform resources to diagram components
 */
export class TerraformToDiagramConverter {
  private config: ResourceMappingConfig;
  private resources: TerraformResource[];
  private diagram: DiagramModel;
  
  // Track created components by resource ID
  private componentMap: Map<string, AwsComponent> = new Map();
  
  // Layout grid settings
  private gridSpacing = 150;
  private initialOffset = { x: 100, y: 100 };
  
  constructor(resources: TerraformResource[], config: ResourceMappingConfig) {
    this.resources = resources;
    this.config = config;
    this.diagram = new DiagramModel('Terraform Diagram');
  }
  
  /**
   * Convert resources to a diagram
   * @param baseFileName Optional base file name for the diagram
   * @returns The created diagram model
   */
  convert(baseFileName?: string): DiagramModel {
    // Set diagram name from file if provided
    if (baseFileName) {
      const baseName = path.basename(baseFileName, '.tf');
      this.diagram.name = `${baseName} Diagram`;
    }
    
    // First pass: Create components for each resource
    this.createComponents();
    
    // Second pass: Create relationships
    this.createRelationships();
    
    // Apply auto-layout
    this.applyLayout();
    
    // Store original terraform sources
    this.diagram.terraformSource = JSON.stringify(this.resources.map(r => r.id));
    
    return this.diagram;
  }
  
  /**
   * Create components for all resources
   */
  private createComponents(): void {
    // Sort resources by type to ensure containers are created before their contents
    const sortedResources = [...this.resources].sort((a, b) => {
      // Put VPCs first, subnets second, others after
      if (a.type === 'aws_vpc') return -1;
      if (b.type === 'aws_vpc') return 1;
      if (a.type === 'aws_subnet') return -1;
      if (b.type === 'aws_subnet') return 1;
      return 0;
    });
    
    for (const resource of sortedResources) {
      const mapping = this.config.resourceMappings.find(m => m.terraformType === resource.type);
      
      if (!mapping) {
        continue; // Skip resources without mapping
      }
      
      // Create component based on resource type
      const component = this.createComponent(resource, mapping);
      
      if (component) {
        // Add to component map for relationship creation
        this.componentMap.set(resource.id, component);
        
        // Add to diagram
        this.diagram.addComponent(component);
      }
    }
  }
  
  /**
   * Create a component from a resource
   * @param resource The resource to convert
   * @param mapping The resource mapping configuration
   * @returns The created component
   */
  private createComponent(
    resource: TerraformResource, 
    mapping: ResourceMapping
  ): AwsComponent | null {
    try {
      let component: AwsComponent | null = null;
      
      // Create component based on type
      switch (mapping.componentType) {
        case 'VpcComponent':
          component = new VpcComponent({
            name: this.getAttributeValue(resource, mapping, 'name') || resource.name,
            cidrBlock: this.getAttributeValue(resource, mapping, 'cidrBlock') || '10.0.0.0/16'
          });
          break;
          
        case 'SubnetComponent':
          component = new SubnetComponent({
            name: this.getAttributeValue(resource, mapping, 'name') || resource.name,
            cidrBlock: this.getAttributeValue(resource, mapping, 'cidrBlock') || '10.0.1.0/24',
            availabilityZone: this.getAttributeValue(resource, mapping, 'availabilityZone') || 'us-east-1a',
            isPublic: this.getAttributeValue(resource, mapping, 'isPublic') === 'true' || false
          });
          break;
          
        case 'EC2InstanceComponent':
          component = new EC2InstanceComponent({
            name: this.getAttributeValue(resource, mapping, 'name') || resource.name,
            instanceType: this.getAttributeValue(resource, mapping, 'instanceType') || 't2.micro',
            ami: this.getAttributeValue(resource, mapping, 'ami') || 'ami-12345'
          });
          break;
          
        default:
          console.warn(`Unsupported component type: ${mapping.componentType}`);
          return null;
      }
      
      // Add metadata about the source
      component.properties.terraformId = resource.id;
      component.properties.terraformType = resource.type;
      component.properties.sourceFile = resource.sourceFile;
      
      return component;
    } catch (error) {
      console.error(`Error creating component for ${resource.id}:`, error);
      return null;
    }
  }
  
  /**
   * Get mapped attribute value from resource
   * @param resource The resource to get value from
   * @param mapping The resource mapping
   * @param componentAttr The component attribute name
   * @returns The attribute value or undefined
   */
  private getAttributeValue(
    resource: TerraformResource, 
    mapping: ResourceMapping, 
    componentAttr: string
  ): string | undefined {
    // Find terraform attribute mapped to this component attribute
    const terraformAttr = Object.entries(mapping.attributeMapping)
      .find(([_, compAttr]) => compAttr === componentAttr)?.[0];
      
    if (!terraformAttr) {
      return undefined;
    }
    
    // Get value from resource
    return resource.attributes[terraformAttr]?.toString();
  }
  
  /**
   * Create relationships between components
   */
  private createRelationships(): void {
    for (const resource of this.resources) {
      const sourceComponent = this.componentMap.get(resource.id);
      
      if (!sourceComponent) {
        continue;
      }
      
      // Process each dependency
      for (const depId of resource.dependencies) {
        const targetComponent = this.componentMap.get(depId);
        
        if (!targetComponent) {
          continue;
        }
        
        // Determine relationship type based on resource types
        let relType = RelationshipType.DEPENDS_ON;
        
        // Special case: subnet in VPC is a CONTAINS relationship
        if (resource.type === 'aws_subnet' && 
            targetComponent.type === 'VpcComponent') {
          relType = RelationshipType.CONTAINS;
        }
        // Special case: EC2 instance in subnet is a CONTAINS relationship
        else if (resource.type === 'aws_instance' && 
                 targetComponent.type === 'SubnetComponent') {
          relType = RelationshipType.CONTAINS;
        }
        // Default: connection relationship
        else {
          relType = RelationshipType.CONNECTS_TO;
        }
        
        // Add the relationship
        this.diagram.addRelationship(
          sourceComponent.id, 
          targetComponent.id, 
          relType, 
          this.getRelationshipLabel(relType)
        );
      }
    }
  }
  
  /**
   * Get label for relationship type
   * @param type Relationship type
   * @returns Label for the relationship
   */
  private getRelationshipLabel(type: RelationshipType): string {
    switch (type) {
      case RelationshipType.CONTAINS:
        return 'contains';
      case RelationshipType.CONNECTS_TO:
        return 'connects to';
      case RelationshipType.DEPENDS_ON:
        return 'depends on';
      case RelationshipType.REFERENCES:
        return 'references';
      default:
        return '';
    }
  }
  
  /**
   * Apply automatic layout to position components
   */
  private applyLayout(): void {
    // Group components by type for layered layout
    const layers: Map<string, AwsComponent[]> = new Map();
    
    // Define layer order
    const layerOrder = ['VpcComponent', 'SubnetComponent', 'EC2InstanceComponent'];
    
    // Initialize empty layers
    layerOrder.forEach(type => layers.set(type, []));
    
    // Group components by type
    this.componentMap.forEach(component => {
      const layer = layers.get(component.type);
      if (layer) {
        layer.push(component);
      }
    });
    
    // Position each layer
    let y = this.initialOffset.y;
    
    layerOrder.forEach(layerType => {
      const components = layers.get(layerType) || [];
      let x = this.initialOffset.x;
      
      components.forEach(component => {
        // Set component position
        component.position = { x, y };
        
        // Move to next position
        x += this.gridSpacing;
      });
      
      // Move to next layer if this layer had components
      if (components.length > 0) {
        y += this.gridSpacing;
      }
    });
  }
}