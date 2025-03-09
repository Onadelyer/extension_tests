import { AwsComponent } from "./base/AwsComponent";
import { RegionComponent } from "./components/RegionComponent";
import { VpcComponent } from "./components/VpcComponent";
import { EC2InstanceComponent } from "./components/EC2InstanceComponent";
import { SubnetComponent } from "./components/SubnetComponent";

// Interface for component class with static method
interface AwsComponentClass {
  new (...args: any[]): AwsComponent;
  fromJSON(json: any): AwsComponent;
}

export class AwsComponentRegistry {
  private static componentTypes: Map<string, AwsComponentClass> = new Map();
  
  static initialize(): void {
    // Register all component types
    this.register('RegionComponent', RegionComponent);
    this.register('VpcComponent', VpcComponent);
    this.register('EC2InstanceComponent', EC2InstanceComponent);
    this.register('SubnetComponent', SubnetComponent);
  }
  
  static register(typeName: string, componentClass: AwsComponentClass): void {
    this.componentTypes.set(typeName, componentClass);
  }
  
  static getComponentClass(typeName: string): AwsComponentClass | undefined {
    return this.componentTypes.get(typeName);
  }
  
  static createComponentFromJSON(json: any): AwsComponent | null {
    const componentClass = this.getComponentClass(json.type);
    if (!componentClass) {
      console.error(`Unknown component type: ${json.type}`);
      return null;
    }
    
    // Use the static fromJSON method if available
    if (typeof componentClass.fromJSON === 'function') {
      return componentClass.fromJSON(json);
    }
    
    // Fallback to constructor with JSON properties
    return new componentClass(json);
  }
  
  static getAllComponentTypes(): string[] {
    return Array.from(this.componentTypes.keys());
  }
}