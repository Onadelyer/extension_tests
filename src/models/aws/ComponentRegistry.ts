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
  private static areaTypes: Set<string> = new Set([
    'RegionComponent',
    'VpcComponent',
    'SubnetComponent',
    'SecurityGroupComponent'
  ]);

  // Initialize the registry with component types
  static initialize(): void {
    console.log('[DEBUG] AwsComponentRegistry - Initializing registry');
    // Register base components
    this.register('RegionComponent', RegionComponent);
    this.register('VpcComponent', VpcComponent);
    this.register('SubnetComponent', SubnetComponent);
    this.register('EC2InstanceComponent', EC2InstanceComponent);
    this.register('SecurityGroupComponent', SecurityGroupComponent);
    this.register('InternetGatewayComponent', InternetGatewayComponent);
    this.register('RouteTableComponent', RouteTableComponent);
    console.log('[DEBUG] AwsComponentRegistry - Registered components:', this.getAllComponentTypes());
    console.log('[DEBUG] AwsComponentRegistry - Area components:', Array.from(this.areaTypes));
  }

  // Register a component class
  static register(type: string, componentClass: AwsComponentClass): void {
    console.log(`[DEBUG] AwsComponentRegistry - Registering ${type}, isArea: ${this.areaTypes.has(type)}`);
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

  // Check if a component type is an area type
  static isAreaType(type: string): boolean {
    return this.areaTypes.has(type);
  }

  // Create a component instance from JSON
  static createFromJSON(json: any): AwsComponent | null {
    console.log(`[DEBUG] AwsComponentRegistry - Creating component from JSON: ${json?.type}`);
    if (!json || !json.type) {
      console.log('[DEBUG] AwsComponentRegistry - Missing type in JSON');
      return null;
    }

    const componentClass = this.getComponentClass(json.type);
    if (!componentClass) {
      console.log(`[DEBUG] AwsComponentRegistry - No component class found for type: ${json.type}`);
      return null;
    }

    console.log(`[DEBUG] AwsComponentRegistry - Creating component of type: ${json.type}`);
    return componentClass.fromJSON(json);
  }
}