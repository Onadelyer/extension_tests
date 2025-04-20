import { ContainerComponent } from "./ContainerComponent";
import { AwsComponent } from "./AwsComponent";

/**
 * Base class for all "Area" type components that can contain other components
 * Areas represent logical groupings like VPC, Subnet, Security Group, Region
 */
export abstract class AreaComponent extends ContainerComponent {
  // List of component types that can be contained within this area
  abstract allowedChildTypes: string[];
  
  constructor(props: Partial<AreaComponent> = {}) {
    super(props);
    // Default larger size for area components
    this.size = props.size || { width: 300, height: 200 };
  }
  
  /**
   * Check if this area can contain the specified component type
   */
  canContain(componentType: string): boolean {
    return this.allowedChildTypes.includes(componentType);
  }
  
  /**
   * Add a child component if it's an allowed type
   * @returns boolean indicating if the child was added
   */
  addChildIfAllowed(component: AwsComponent): boolean {
    if (this.canContain(component.type)) {
      this.addChild(component);
      return true;
    }
    return false;
  }
  
  /**
   * JSON representation including allowedChildTypes
   */
  toJSON(): object {
    return {
      ...super.toJSON(),
      allowedChildTypes: this.allowedChildTypes
    };
  }
} 