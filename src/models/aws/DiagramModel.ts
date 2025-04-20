import { AwsComponent } from "./base/AwsComponent";
import { AreaComponent } from "./base/AreaComponent";
import { ComponentRelationship, RelationshipType } from "./ComponentRelationship";
import { RegionComponent } from "./components/RegionComponent";
import { AwsComponentRegistry } from "./ComponentRegistry";
import { generateUUID } from "../utils/IdGenerator";

export class DiagramModel {
  id: string;
  name: string;
  region: RegionComponent;
  relationships: ComponentRelationship[] = [];
  terraformSource?: string;
  
  constructor(name: string, regionName: string = 'us-east-1') {
    this.id = generateUUID();
    this.name = name;
    this.region = new RegionComponent({ 
      name: 'Region',
      regionName: regionName
    });
  }
  
  // Add a component to the diagram, either to the region directly or to its appropriate area
  addComponent(component: AwsComponent): void {
    console.log(`[DEBUG] DiagramModel.addComponent - Adding component: ${component.id} (${component.type})`);
    
    // Try to find an appropriate area for this component
    const placedInArea = this.tryPlaceInArea(component);
    
    if (!placedInArea) {
      // If not placed in an area, add to region as default
      console.log(`[DEBUG] DiagramModel.addComponent - Adding to region: ${component.id} (${component.type})`);
      this.region.addChild(component);
    } else {
      console.log(`[DEBUG] DiagramModel.addComponent - Placed in area: ${component.id} (${component.type})`);
    }
  }
  
  // Try to place a component in an appropriate area based on allowed children types
  tryPlaceInArea(component: AwsComponent): boolean {
    console.log(`[DEBUG] DiagramModel.tryPlaceInArea - Trying to place: ${component.id} (${component.type})`);
    
    // Get all area components
    const areas = this.getAllAreaComponents();
    console.log(`[DEBUG] DiagramModel.tryPlaceInArea - Found ${areas.length} area components`);
    
    // Find an area that can contain this component
    for (const area of areas) {
      console.log(`[DEBUG] DiagramModel.tryPlaceInArea - Checking area: ${area.id} (${area.type})`);
      
      if (area instanceof AreaComponent && area.canContain(component.type)) {
        console.log(`[DEBUG] DiagramModel.tryPlaceInArea - Area ${area.id} can contain ${component.type}`);
        area.addChild(component);
        return true;
      } else if (area instanceof AreaComponent) {
        console.log(`[DEBUG] DiagramModel.tryPlaceInArea - Area ${area.id} cannot contain ${component.type}`);
      }
    }
    
    console.log(`[DEBUG] DiagramModel.tryPlaceInArea - No suitable area found for: ${component.id} (${component.type})`);
    return false;
  }
  
  // Get all area components in the diagram
  getAllAreaComponents(): AwsComponent[] {
    const allComponents = [this.region, ...this.region.getAllChildren()];
    return allComponents.filter(component => 
      AwsComponentRegistry.isAreaType(component.type)
    );
  }
  
  // Find a component by ID
  findComponentById(id: string): AwsComponent | undefined {
    if (this.region.id === id) {
      return this.region;
    }
    
    return this.region.getAllChildren().find(c => c.id === id);
  }
  
  // Add a relationship between components
  addRelationship(sourceId: string, targetId: string, type: RelationshipType, label?: string): void {
    // Verify both components exist
    const sourceComponent = this.findComponentById(sourceId);
    const targetComponent = this.findComponentById(targetId);
    
    if (!sourceComponent || !targetComponent) {
      console.error('Cannot create relationship: one or both components not found');
      return;
    }
    
    // If this is a CONTAINS relationship and source is an area component,
    // we should add the target as a child of the source area
    if (type === RelationshipType.CONTAINS && sourceComponent instanceof AreaComponent) {
      // First check if target is already in another area
      const existingContainmentRel = this.relationships.find(r => 
        r.type === RelationshipType.CONTAINS && r.targetId === targetId
      );
      
      if (existingContainmentRel) {
        // If it is, remove it from that area first
        const existingArea = this.findComponentById(existingContainmentRel.sourceId);
        if (existingArea instanceof AreaComponent) {
          existingArea.removeChild(targetId);
        }
        
        // Remove the existing relationship
        this.relationships = this.relationships.filter(r => r.id !== existingContainmentRel.id);
      }
      
      // Add target as child of source area if allowed
      if (sourceComponent.canContain(targetComponent.type)) {
        sourceComponent.addChild(targetComponent);
      } else {
        console.error(`${sourceComponent.type} cannot contain ${targetComponent.type}`);
        return;
      }
    }
    
    // Create and add the relationship
    const relationship = new ComponentRelationship(sourceId, targetId, type, label);
    this.relationships.push(relationship);
  }
  
  // Remove a component and its relationships
  removeComponent(componentId: string): void {
    const component = this.findComponentById(componentId);
    if (!component) {
      return;
    }
    
    // Remove component from its parent
    if (this.region.id === componentId) {
      // Cannot remove the region
      return;
    } else {
      // Find all area components
      const areas = this.getAllAreaComponents();
      
      // Remove from any area that contains it
      areas.forEach(area => {
        if (area instanceof AreaComponent) {
          area.removeChild(componentId);
        }
      });
    }
    
    // Remove relationships involving this component
    this.relationships = this.relationships.filter(
      r => r.sourceId !== componentId && r.targetId !== componentId
    );
  }
  
  // Tostring representation
  toString(): string {
    return `Diagram: ${this.name} (${this.id})`;
  }
  
  // Get serializable JSON representation
  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      region: this.region.toJSON(),
      relationships: this.relationships.map(r => r.toJSON()),
      terraformSource: this.terraformSource
    };
  }
  
  // Create from JSON
  static fromJSON(json: any): DiagramModel {
    // Initialize the registry if not already done
    if (AwsComponentRegistry.getAllComponentTypes().length === 0) {
      AwsComponentRegistry.initialize();
    }
    
    const diagram = new DiagramModel(json.name);
    diagram.id = json.id;
    diagram.terraformSource = json.terraformSource;
    
    // Restore the region
    if (json.region) {
      diagram.region = RegionComponent.fromJSON(json.region);
    }
    
    // Restore relationships
    if (json.relationships && Array.isArray(json.relationships)) {
      diagram.relationships = json.relationships.map((r: any) => 
        ComponentRelationship.fromJSON(r)
      );
    }
    
    return diagram;
  }
}