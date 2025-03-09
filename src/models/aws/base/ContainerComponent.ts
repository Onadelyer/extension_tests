import { AwsComponent } from "./AwsComponent";

export abstract class ContainerComponent extends AwsComponent {
  children: AwsComponent[] = [];
  
  constructor(props: Partial<ContainerComponent> = {}) {
    super(props);
    this.children = props.children || [];
  }
  
  addChild(component: AwsComponent): void {
    this.children.push(component);
  }
  
  removeChild(componentId: string): void {
    this.children = this.children.filter(c => c.id !== componentId);
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