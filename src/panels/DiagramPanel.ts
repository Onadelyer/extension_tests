import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DiagramModel } from '../models/aws/DiagramModel';
import { AwsComponentRegistry } from '../models/aws/ComponentRegistry';
import { VpcComponent } from '../models/aws/components/VpcComponent';
import { SubnetComponent } from '../models/aws/components/SubnetComponent';
import { EC2InstanceComponent } from '../models/aws/components/EC2InstanceComponent';
import { TerraformParser } from '../parsers/TerraformParser';
import { RelationshipType } from '../models/aws/ComponentRelationship';

import { ResourceMappingConfigManager } from '../config/ResourceMappingConfig';
import { TerraformResourceParser, TerraformResource } from '../parsers/TerraformResourceParser';
import { TerraformToDiagramConverter } from '../converters/TerraformToDiagramConverter';
import { ComponentRelationship } from '../models/aws/ComponentRelationship';

// Initialize the component registry
AwsComponentRegistry.initialize();

/**
 * Opens a diagram editor in a webview panel
 * @param context Extension context
 * @param initialData Optional initial data for the diagram
 * @returns The created webview panel
 */
export function openDiagramPanel(context: vscode.ExtensionContext, initialData?: any): vscode.WebviewPanel {
  // Create panel
  const panel = vscode.window.createWebviewPanel(
    'extension-test.diagramPanel', 
    'AWS Diagram Editor',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'out'),
        vscode.Uri.joinPath(context.extensionUri, 'media'),
        vscode.Uri.joinPath(context.extensionUri, 'editor-ui/build')
      ]
    }
  );

  // Set webview content
  getEditorContent(context, panel.webview)
    .then(html => {
      panel.webview.html = html;
      
      // Prepare the diagram data
      let diagramData: string;
      
      try {
        // Handle different types of input data
        if (!initialData) {
          // Create a default diagram
          const diagram = new DiagramModel('New Diagram');
          diagramData = JSON.stringify(diagram.toJSON(), null, 2);
        } else if (initialData.source && typeof initialData.source === 'string') {
          // Create diagram from source file - but don't save it
          const diagramName = path.basename(initialData.source, '.tf');
          const diagram = new DiagramModel(diagramName);
          diagram.terraformSource = initialData.source;
          
          // Parse the Terraform file and populate the diagram with resources
          populateDiagramFromTerraformFile(diagram, initialData.source)
            .then(() => {
              // Send the updated diagram with resources to the webview
              const updatedDiagramData = JSON.stringify(diagram.toJSON(), null, 2);
              panel.webview.postMessage({
                type: 'update',
                content: updatedDiagramData
              });
            })
            .catch(error => {
              console.error('Error populating diagram from Terraform:', error);
              vscode.window.showWarningMessage(`Error parsing Terraform resources: ${error.message}`);
            });
          
          // Send initial diagram without resources (will be updated later)
          diagramData = JSON.stringify(diagram.toJSON(), null, 2);
        } else if (typeof initialData === 'string') {
          // Use raw string data
          diagramData = initialData;
        } else {
          // Convert object to string
          diagramData = JSON.stringify(initialData, null, 2);
        }
        
        // Send the data to the webview
        panel.webview.postMessage({
          type: 'update',
          content: diagramData
        });
      } catch (error) {
        console.error('Error preparing diagram data:', error);
        
        // Fallback to empty diagram
        const diagram = new DiagramModel('New Diagram');
        panel.webview.postMessage({
          type: 'update',
          content: JSON.stringify(diagram.toJSON(), null, 2)
        });
      }
    })
    .catch(error => {
      console.error('Error setting up diagram panel:', error);
      panel.webview.html = `<html><body><h2>Error</h2><p>${error.message}</p></body></html>`;
    });

  // Handle messages from the webview - only handle necessary messages
  panel.webview.onDidReceiveMessage(
    message => {
      switch (message.type) {
        case 'update':
          // Process diagram updates - only for UI updates, not for saving
          try {
            if (message.content) {
              const diagramData = JSON.parse(message.content);
              // Update panel title if diagram name is available
              if (diagramData.name) {
                panel.title = `${diagramData.name} - AWS Diagram`;
              }
            }
          } catch (error) {
            console.error('Error processing diagram update:', error);
          }
          break;
        case 'requestDiagram':
          // Respond to diagram requests without loading from file
          break;
      }
    }
  );

  return panel;
}

/**
 * Populate a diagram model with components based on a Terraform file
 * @param diagram The diagram model to populate
 * @param filePath Path to the Terraform file
 */
async function populateDiagramFromTerraformFile(diagram: DiagramModel, filePath: string): Promise<void> {
  try {
    // Read the file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Use the Terraform Parser first to get all dependent files
    const parser = new TerraformParser();
    const allDependentFiles = await parser.getAllDependentFileUris(filePath);
    
    // Load resource mapping config
    const resourceMappingConfig = await ResourceMappingConfigManager.loadConfig();
    
    // Create resource parser with the config
    const resourceParser = new TerraformResourceParser();
    
    // Use ResourceMappingConfig to parse and convert resources
    const resources = await resourceParser.parseResourcesFromFiles(
      allDependentFiles, 
      resourceMappingConfig
    );
    
    // Convert resources to diagram components
    const converter = new TerraformToDiagramConverter(resources, resourceMappingConfig);
    const convertedDiagram = converter.convert(path.basename(filePath));
    
    // Copy components and relationships to the original diagram
    convertedDiagram.region.children.forEach(component => {
      diagram.addComponent(component);
    });
    
    convertedDiagram.relationships.forEach(rel => {
      diagram.addRelationship(rel.sourceId, rel.targetId, rel.type, rel.label);
    });
        
  } catch (error) {
    console.error('Error parsing Terraform files:', error);
    throw error;
  }
}

/**
 * Parse a Terraform file and add resources to the diagram model
 */
async function parseResourcesAndAddToModel(filePath: string, diagram: DiagramModel): Promise<void> {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Try using the HCL parser
    try {
      const { parse } = require('@evops/hcl-terraform-parser');
      const parsed = parse(content);
      
      // Process resources
      await processHclResources(parsed, diagram);
      
    } catch (parserError) {
      console.error('Error using HCL parser, falling back to regex:', parserError);
      
      // Fallback to regex-based parsing
      await processWithRegexFallback(content, diagram);
    }
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
  }
}

/**
 * Process resources from parsed HCL
 */
async function processHclResources(parsed: any, diagram: DiagramModel): Promise<void> {
  // Starting positions for components
  let xPos = 100;
  let yPos = 100;
  
  // Check if we have managed_resources in the parsed output (newer parser format)
  if (parsed.managed_resources) {
    // Process managed resources
    for (const [resourceType, resourceInstances] of Object.entries(parsed.managed_resources)) {
      for (const [resourceName, resourceConfig] of Object.entries(resourceInstances as Record<string, any>)) {
        await addResourceToModel(resourceType, resourceName, resourceConfig, diagram, { x: xPos, y: yPos });
        
        // Update position for next component
        xPos += 150;
        if (xPos > 600) {
          xPos = 100;
          yPos += 120;
        }
      }
    }
  } else {
    // Check for 'resource' block directly (older format)
    for (const [key, value] of Object.entries(parsed)) {
      if (key === 'resource' && typeof value === 'object') {
        for (const [resourceType, resourceInstances] of Object.entries(value as Record<string, any>)) {
          for (const [resourceName, resourceConfig] of Object.entries(resourceInstances as Record<string, any>)) {
            await addResourceToModel(resourceType, resourceName, resourceConfig, diagram, { x: xPos, y: yPos });
            
            // Update position for next component
            xPos += 150;
            if (xPos > 600) {
              xPos = 100;
              yPos += 120;
            }
          }
        }
      }
    }
  }
}

/**
 * Process file with regex as fallback
 */
async function processWithRegexFallback(content: string, diagram: DiagramModel): Promise<void> {
  let xPos = 100;
  let yPos = 100;
  
  // Resource regex
  const resourceRegex = /resource\s+"([^"]+)"\s+"([^"]+)"\s+{([^}]*)}/gs;
  
  let match;
  while ((match = resourceRegex.exec(content)) !== null) {
    const resourceType = match[1];
    const resourceName = match[2];
    const configBlock = match[3];
    
    // Extract simple config properties
    const config: Record<string, any> = {};
    const propRegex = /([a-zA-Z0-9_]+)\s*=\s*"([^"]*)"/g;
    let propMatch;
    
    while ((propMatch = propRegex.exec(configBlock)) !== null) {
      config[propMatch[1]] = propMatch[2];
    }
    
    await addResourceToModel(resourceType, resourceName, config, diagram, { x: xPos, y: yPos });
    
    // Update position for next component
    xPos += 150;
    if (xPos > 600) {
      xPos = 100;
      yPos += 120;
    }
  }
}

/**
 * Add a resource to the diagram model based on its type
 */
async function addResourceToModel(
  resourceType: string, 
  resourceName: string, 
  config: any, 
  diagram: DiagramModel,
  position: { x: number, y: number }
): Promise<void> {
  // Map Terraform resource types to our model components
  if (resourceType === 'aws_vpc') {
    const vpc = new VpcComponent({
      name: `VPC: ${resourceName}`,
      cidrBlock: config.cidr_block || '10.0.0.0/16',
      position: position,
      properties: {
        terraformId: `${resourceType}.${resourceName}`,
        ...config
      }
    });
    
    diagram.addComponent(vpc);
    
  } else if (resourceType === 'aws_subnet') {
    const subnet = new SubnetComponent({
      name: `Subnet: ${resourceName}`,
      cidrBlock: config.cidr_block || '10.0.1.0/24',
      availabilityZone: config.availability_zone || 'us-east-1a',
      isPublic: config.map_public_ip_on_launch === 'true',
      position: position,
      properties: {
        terraformId: `${resourceType}.${resourceName}`,
        ...config
      }
    });
    
    diagram.addComponent(subnet);
    
  } else if (resourceType === 'aws_instance') {
    const instance = new EC2InstanceComponent({
      name: `EC2: ${resourceName}`,
      instanceType: config.instance_type || 't2.micro',
      ami: config.ami || 'ami-12345',
      position: position,
      properties: {
        terraformId: `${resourceType}.${resourceName}`,
        ...config
      }
    });
    
    diagram.addComponent(instance);
  }
  // Add more resource types as needed
}

/**
 * Create relationships between components
 */
function createComponentRelationships(diagram: DiagramModel): void {
  const components = diagram.region.getAllChildren();
  
  // Find subnet-VPC relationships
  const vpcs = components.filter(c => c instanceof VpcComponent);
  const subnets = components.filter(c => c instanceof SubnetComponent);
  const instances = components.filter(c => c instanceof EC2InstanceComponent);
  
  // Connect subnets to VPCs based on properties
  for (const subnet of subnets) {
    const subnetProps = subnet.properties;
    if (subnetProps.vpc_id) {
      // Find the VPC with matching ID in properties
      const matchingVpc = vpcs.find(vpc => 
        vpc.properties.id === subnetProps.vpc_id || 
        vpc.properties.terraformId === subnetProps.vpc_id
      );
      
      if (matchingVpc) {
        diagram.addRelationship(matchingVpc.id, subnet.id, RelationshipType.CONTAINS, 'contains');
      }
    }
  }
  
  // Connect instances to subnets
  for (const instance of instances) {
    const instanceProps = instance.properties;
    if (instanceProps.subnet_id) {
      // Find the subnet with matching ID
      const matchingSubnet = subnets.find(subnet => 
        subnet.properties.id === instanceProps.subnet_id || 
        subnet.properties.terraformId === instanceProps.subnet_id
      );
      
      if (matchingSubnet) {
        diagram.addRelationship(matchingSubnet.id, instance.id, RelationshipType.CONTAINS, 'deployed in');
      }
    }
  }
}

/**
 * Get the HTML content for the diagram editor
 */
async function getEditorContent(context: vscode.ExtensionContext, webview: vscode.Webview): Promise<string> {
  // Path to the editor UI build
  const editorDistPath = vscode.Uri.joinPath(context.extensionUri, 'editor-ui/build');
  
  try {
    // Try to load the built React app if it exists
    if (fs.existsSync(path.join(editorDistPath.fsPath, 'index.html'))) {
      // Get paths to scripts and styles
      const indexHtml = fs.readFileSync(
        path.join(editorDistPath.fsPath, 'index.html'),
        'utf8'
      );
      
      // Replace paths in the HTML to use the webview resource URI scheme
      return indexHtml.replace(
        /(href|src)="(.*?)"/g,
        (_, attr, value) => {
          // Skip external URLs
          if (value.startsWith('http') || value.startsWith('https')) {
            return `${attr}="${value}"`;
          }
          
          // For relative paths, convert to vscode-webview-resource URI
          if (value.startsWith('./')) {
            value = value.substring(2);
          }
          if (value.startsWith('/')) {
            value = value.substring(1);
          }
          
          const uri = vscode.Uri.joinPath(editorDistPath, value);
          return `${attr}="${webview.asWebviewUri(uri)}"`;
        }
      );
    }
  } catch (error) {
    console.error('Error loading editor UI:', error);
  }

  // Fallback to basic HTML if React app is not available
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AWS Diagram Editor</title>
      <style>
        body {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          padding: 0;
          color: var(--vscode-foreground);
          font-family: var(--vscode-font-family);
          background-color: var(--vscode-editor-background);
        }
      </style>
    </head>
    <body>
      <div>
        <h2>AWS Diagram Editor</h2>
        <p>The editor is being set up. If you see this message for an extended period, 
          please ensure you've run the build process for the editor UI.</p>
      </div>
    </body>
    </html>
  `;
}