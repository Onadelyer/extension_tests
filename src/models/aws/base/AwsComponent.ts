import { generateUUID } from "../../utils/IdGenerator";

export abstract class AwsComponent {
  id: string;
  name: string;
  type: string;
  position: { x: number, y: number };
  size: { width: number, height: number };
  properties: Record<string, any>;
  
  constructor(props: Partial<AwsComponent> = {}) {
    this.id = props.id || generateUUID();
    this.name = props.name || '';
    this.type = this.constructor.name;
    this.position = props.position || { x: 0, y: 0 };
    this.size = props.size || { width: 100, height: 80 };
    this.properties = props.properties || {};
  }
  
  abstract toJSON(): object;
  
  static fromJSON(json: any): AwsComponent {
    throw new Error("Method must be implemented by subclass");
  }
}