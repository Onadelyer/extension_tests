import { AwsComponent } from "./AwsComponent";

export abstract class ContainerComponent extends AwsComponent {
  children: AwsComponent[] = [];
  
  constructor(props: Partial<ContainerComponent> = {}) {
    super(props);
    this.children = props.children || [];
  }
  
  addChild(component: AwsComponent): void {
    console.log(`[DEBUG] ContainerComponent.addChild - Adding child ${component.id} (${component.type}) to ${this.id} (${this.type})`);
    this.children.push(component);
    console.log(`[DEBUG] ContainerComponent.addChild - Children count: ${this.children.length}`);
  }
  
  removeChild(componentId: string): void {
    console.log(`[DEBUG] ContainerComponent.removeChild - Removing child ${componentId} from ${this.id} (${this.type})`);
    const beforeCount = this.children.length;
    this.children = this.children.filter(c => c.id !== componentId);
    console.log(`[DEBUG] ContainerComponent.removeChild - Removed: ${beforeCount - this.children.length}`);
  }
  
  getChild(componentId: string): AwsComponent | undefined {
    return this.children.find(c => c.id === componentId);
  }
  
  getAllChildren(): AwsComponent[] {
    let all: AwsComponent[] = [...this.children];
    
    this.children.forEach(child => {
      if (child instanceof ContainerComponent) {
        all = [...all, ...child.getAllChildren()];
      }
    });
    
    return all;
  }
  
  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      position: this.position,
      size: this.size,
      properties: this.properties,
      children: this.children.map(c => c.toJSON())
    };
  }
}