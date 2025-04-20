import { AwsComponent } from "./base/AwsComponent";
import { RegionComponent } from "./components/RegionComponent";
import { VpcComponent } from "./components/VpcComponent";
import { EC2InstanceComponent } from "./components/EC2InstanceComponent";
import { SubnetComponent } from "./components/SubnetComponent";
import { SecurityGroupComponent } from "./components/SecurityGroupComponent";
import { InternetGatewayComponent } from "./components/InternetGatewayComponent";
import { RouteTableComponent } from "./components/RouteTableComponent";

// Interface for component class with static method
interface AwsComponentClass {
  new (...args: any[]): AwsComponent;
  fromJSON(json: any): AwsComponent;
}

// Registry for AWS component classes
export class AwsComponentRegistry {
  private static registry: Map<string, AwsComponentClass> = new Map();

  // Initialize the registry with component types
  static initialize(): void {
    // Register base components
    this.register('RegionComponent', RegionComponent);
    this.register('VpcComponent', VpcComponent);
    this.register('SubnetComponent', SubnetComponent);
    this.register('EC2InstanceComponent', EC2InstanceComponent);
    this.register('SecurityGroupComponent', SecurityGroupComponent);
    this.register('InternetGatewayComponent', InternetGatewayComponent);
    this.register('RouteTableComponent', RouteTableComponent);
  }

  // Register a component class
  static register(type: string, componentClass: AwsComponentClass): void {
    this.registry.set(type, componentClass);
  }

  // Get a component class by type
  static getComponentClass(type: string): AwsComponentClass | undefined {
    return this.registry.get(type);
  }

  // Get all registered component types
  static getAllComponentTypes(): string[] {
    return Array.from(this.registry.keys());
  }

  // Create a component instance from JSON
  static createFromJSON(json: any): AwsComponent | null {
    if (!json || !json.type) {
      return null;
    }

    const componentClass = this.getComponentClass(json.type);
    if (!componentClass) {
      return null;
    }

    return componentClass.fromJSON(json);
  }
}