import { AwsComponent } from "./base/AwsComponent";
import { ComponentRelationship, RelationshipType } from "./ComponentRelationship";
import { RegionComponent } from "./components/RegionComponent";
import { AwsComponentRegistry } from "./ComponentRegistry";
import { generateUUID } from "../utils/IdGenerator";

export interface SourceFileInfo {
  rootFolder: string;
  files: string[];
}

export class DiagramModel {
  id: string;
  name: string;
  region: RegionComponent;
  relationships: ComponentRelationship[] = [];
  terraformSource?: string;
  sourceFiles?: SourceFileInfo;
  
  constructor(name: string, regionName: string = 'us-east-1') {
    this.id = generateUUID();
    this.name = name;
    this.region = new RegionComponent({ 
      name: 'Region',
      regionName: regionName
    });
  }
  
  // Add source file information
  setSourceFiles(rootFolder: string, files: string[]) {
    this.sourceFiles = {
      rootFolder,
      files
    };
  }
  
  // Add component to the region (or specified parent container)
  addComponent(component: AwsComponent, parentId?: string): void {
    if (!parentId) {
      // Add to root region by default
      this.region.addChild(component);
      return;
    }
    
    // Find the parent container
    const findParent = (container: RegionComponent): boolean => {
      if (container.id === parentId) {
        container.addChild(component);
        return true;
      }
      
      // Search in children
      for (const child of container.children) {
        if (child instanceof RegionComponent) {
          if (findParent(child)) {
            return true;
          }
        }
      }
      
      return false;
    };
    
    if (!findParent(this.region)) {
      console.error(`Parent container with ID ${parentId} not found`);
      // Add to root region as fallback
      this.region.addChild(component);
    }
  }
  
  // Remove component from the diagram
  removeComponent(componentId: string): void {
    // Remove from region/container
    const removeFromContainer = (container: RegionComponent): boolean => {
      // Check direct children
      const index = container.children.findIndex(c => c.id === componentId);
      if (index >= 0) {
        container.children.splice(index, 1);
        return true;
      }
      
      // Check in nested containers
      for (const child of container.children) {
        if (child instanceof RegionComponent) {
          if (removeFromContainer(child)) {
            return true;
          }
        }
      }
      
      return false;
    };
    
    removeFromContainer(this.region);
    
    // Remove any relationships with this component
    this.relationships = this.relationships.filter(
      r => r.sourceId !== componentId && r.targetId !== componentId
    );
  }
  
  // Find a component by ID
  findComponentById(id: string): AwsComponent | null {
    // Check if it's the region itself
    if (this.region.id === id) {
      return this.region;
    }
    
    // Search in the region hierarchy
    const findInContainer = (container: RegionComponent): AwsComponent | null => {
      // Check direct children
      for (const child of container.children) {
        if (child.id === id) {
          return child;
        }
        
        // Recursively search in container children
        if (child instanceof RegionComponent) {
          const found = findInContainer(child);
          if (found) {
            return found;
          }
        }
      }
      
      return null;
    };
    
    return findInContainer(this.region);
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
    
    // Create and add the relationship
    const relationship = new ComponentRelationship(sourceId, targetId, type, label);
    this.relationships.push(relationship);
  }
  
  // Remove a relationship
  removeRelationship(relationshipId: string): void {
    this.relationships = this.relationships.filter(r => r.id !== relationshipId);
  }
  
  // Convert to JSON for serialization
  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      region: this.region.toJSON(),
      relationships: this.relationships.map(r => r.toJSON()),
      terraformSource: this.terraformSource,
      sourceFiles: this.sourceFiles
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
    
    // Restore source files information
    if (json.sourceFiles) {
      diagram.sourceFiles = {
        rootFolder: json.sourceFiles.rootFolder,
        files: json.sourceFiles.files
      };
    }
    
    return diagram;
  }
}