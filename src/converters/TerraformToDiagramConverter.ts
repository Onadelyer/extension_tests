// src/converters/TerraformToDiagramConverter.ts
import { DiagramModel } from '../models/aws/DiagramModel';
import { TerraformResource } from '../parsers/TerraformResourceParser';
import { ResourceMappingConfig, ResourceMapping } from '../config/ResourceMappingConfig';
import { AwsComponent } from '../models/aws/base/AwsComponent';
import { AreaComponent } from '../models/aws/base/AreaComponent';
import { VpcComponent } from '../models/aws/components/VpcComponent';
import { SubnetComponent } from '../models/aws/components/SubnetComponent';
import { EC2InstanceComponent } from '../models/aws/components/EC2InstanceComponent';
import { RelationshipType } from '../models/aws/ComponentRelationship';
import * as path from 'path';
import { SecurityGroupComponent } from '../models/aws/components/SecurityGroupComponent';
import { InternetGatewayComponent } from '../models/aws/components/InternetGatewayComponent';
import { RouteTableComponent } from '../models/aws/components/RouteTableComponent';
import { AwsComponentRegistry } from '../models/aws/ComponentRegistry';

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
    console.log('[DEBUG] TerraformToDiagramConverter - Starting conversion');
    console.log('[DEBUG] TerraformToDiagramConverter - Resources count:', this.resources.length);
    console.log('[DEBUG] TerraformToDiagramConverter - Resource types:', this.resources.map(r => r.type));
    
    // Set diagram name from file if provided
    if (baseFileName) {
      const baseName = path.basename(baseFileName, '.tf');
      this.diagram.name = `${baseName} Diagram`;
    }
    
    // First pass: Create components for each resource
    this.createComponents();
    console.log('[DEBUG] TerraformToDiagramConverter - Components created:', this.componentMap.size);
    
    // Second pass: Create relationships
    this.createRelationships();
    
    // Third pass: Create area containment relationships
    this.createAreaContainment();
    
    // Apply auto-layout
    this.applyLayout();
    
    // Store original terraform sources
    this.diagram.terraformSource = JSON.stringify(this.resources.map(r => r.id));
    
    console.log('[DEBUG] TerraformToDiagramConverter - Final diagram components count:', 
      this.diagram.region.getAllChildren().length);
    console.log('[DEBUG] TerraformToDiagramConverter - Final diagram relationships count:',
      this.diagram.relationships.length);
    
    return this.diagram;
  }
  
  /**
   * Create components for all resources
   */
  private createComponents(): void {
    console.log('[DEBUG] TerraformToDiagramConverter - Creating components');
    
    // Sort resources by type to ensure containers are created before their contents
    const sortedResources = [...this.resources].sort((a, b) => {
      // Sort order: Region, VPC, Subnet, Security Group, other resources
      if (a.type === 'aws_region') return -1;
      if (b.type === 'aws_region') return 1;
      if (a.type === 'aws_vpc') return -1;
      if (b.type === 'aws_vpc') return 1;
      if (a.type === 'aws_subnet') return -1;
      if (b.type === 'aws_subnet') return 1;
      if (a.type === 'aws_security_group') return -1;
      if (b.type === 'aws_security_group') return 1;
      return 0;
    });
    
    console.log('[DEBUG] TerraformToDiagramConverter - Sorted resources:', 
      sortedResources.map(r => `${r.type}:${r.id}`));
    
    for (const resource of sortedResources) {
      console.log(`[DEBUG] TerraformToDiagramConverter - Processing resource: ${resource.id} (${resource.type})`);
      
      const mapping = this.config.resourceMappings.find(m => m.terraformType === resource.type);
      
      if (!mapping) {
        console.log(`[DEBUG] TerraformToDiagramConverter - No mapping found for: ${resource.type}`);
        continue; // Skip resources without mapping
      }
      
      // Create component based on resource type
      const component = this.createComponent(resource, mapping);
      
      if (component) {
        console.log(`[DEBUG] TerraformToDiagramConverter - Created component: ${component.id} (${component.type})`);
        
        // Add to component map for relationship creation
        this.componentMap.set(resource.id, component);
        
        // Add to diagram
        this.diagram.addComponent(component);
      } else {
        console.log(`[DEBUG] TerraformToDiagramConverter - Failed to create component for: ${resource.id}`);
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
        
        case 'SecurityGroupComponent':
          component = new SecurityGroupComponent({
            name: this.getAttributeValue(resource, mapping, 'name') || resource.name,
            description: this.getAttributeValue(resource, mapping, 'description')
          });
          break;
          
        case 'InternetGatewayComponent':
          component = new InternetGatewayComponent({
            name: this.getAttributeValue(resource, mapping, 'name') || resource.name
          });
          break;
          
        case 'RouteTableComponent':
          component = new RouteTableComponent({
            name: this.getAttributeValue(resource, mapping, 'name') || resource.name
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
      const targetComponent = this.componentMap.get(resource.id);
      
      if (!targetComponent) {
        continue;
      }
      
      // Process each dependency
      for (const depId of resource.dependencies) {
        const sourceComponent = this.componentMap.get(depId);
        
        if (!sourceComponent) {
          continue;
        }
        
        // Create appropriate relationship based on resource types
        this.createAppropriateRelationship(sourceComponent, targetComponent, resource);
      }
    }
  }
  
  /**
   * Create an appropriate relationship between components based on their types
   */
  private createAppropriateRelationship(
    sourceComponent: AwsComponent, 
    targetComponent: AwsComponent, 
    resource: TerraformResource
  ): void {
    // Determine relationship type based on resource and component types
    let relType = RelationshipType.DEPENDS_ON;
    let label = 'depends on';
    
    // Handle area containment relationships
    if (AwsComponentRegistry.isAreaType(sourceComponent.type)) {
      const sourceArea = sourceComponent as AreaComponent;
      
      // Check if this area can contain the target
      if (sourceArea.canContain(targetComponent.type)) {
        relType = RelationshipType.CONTAINS;
        label = 'contains';
      }
    }
    
    // Special case: subnet in VPC
    if (resource.type === 'aws_subnet' && sourceComponent instanceof VpcComponent) {
      relType = RelationshipType.CONTAINS;
      label = 'contains';
    }
    // Special case: EC2 instance in subnet
    else if (resource.type === 'aws_instance' && 
            (sourceComponent instanceof SubnetComponent || 
            sourceComponent instanceof SecurityGroupComponent)) {
      relType = RelationshipType.CONTAINS;
      label = 'contains';
    }
    // Handle connections between components
    else if (!AwsComponentRegistry.isAreaType(targetComponent.type)) {
      relType = RelationshipType.CONNECTS_TO;
      label = 'connects to';
    }
    
    // Add the relationship
    this.diagram.addRelationship(
      sourceComponent.id,
      targetComponent.id,
      relType,
      label
    );
  }
  
  /**
   * Analyze attributes to establish area containment relationships
   */
  private createAreaContainment(): void {
    const components = Array.from(this.componentMap.values());
    
    // Create a map of vpc_id -> VPC component
    const vpcMap = new Map<string, VpcComponent>();
    const subnetMap = new Map<string, SubnetComponent>();
    const securityGroupMap = new Map<string, SecurityGroupComponent>();
    
    // First identify all areas
    for (const component of components) {
      if (component instanceof VpcComponent) {
        const vpcId = component.properties.id || component.properties.terraformId;
        if (vpcId) {
          vpcMap.set(vpcId, component);
        }
      } else if (component instanceof SubnetComponent) {
        const subnetId = component.properties.id || component.properties.terraformId;
        if (subnetId) {
          subnetMap.set(subnetId, component);
        }
      } else if (component instanceof SecurityGroupComponent) {
        const sgId = component.properties.id || component.properties.terraformId;
        if (sgId) {
          securityGroupMap.set(sgId, component);
        }
      }
    }
    
    // Process subnet containment in VPCs
    for (const component of components) {
      if (component instanceof SubnetComponent) {
        const vpcId = component.properties.vpc_id;
        const vpc = vpcMap.get(vpcId);
        
        if (vpc) {
          this.diagram.addRelationship(vpc.id, component.id, RelationshipType.CONTAINS, 'contains');
        }
      }
    }
    
    // Process EC2 instance containment
    for (const component of components) {
      if (component instanceof EC2InstanceComponent) {
        // Check for subnet containment
        const subnetId = component.properties.subnet_id;
        if (subnetId) {
          const subnet = subnetMap.get(subnetId);
          if (subnet) {
            this.diagram.addRelationship(subnet.id, component.id, RelationshipType.CONTAINS, 'deployed in');
          }
        }
        
        // Check for security group containment
        const sgIds = component.properties.security_groups || 
                    component.properties.vpc_security_group_ids ||
                    [];
        
        if (Array.isArray(sgIds)) {
          for (const sgId of sgIds) {
            const sg = securityGroupMap.get(sgId);
            if (sg) {
              this.diagram.addRelationship(sg.id, component.id, RelationshipType.CONTAINS, 'secured by');
            }
          }
        } else if (typeof sgIds === 'string') {
          const sg = securityGroupMap.get(sgIds);
          if (sg) {
            this.diagram.addRelationship(sg.id, component.id, RelationshipType.CONTAINS, 'secured by');
          }
        }
      }
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