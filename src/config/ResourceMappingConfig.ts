// src/config/ResourceMappingConfig.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Configuration for mapping Terraform resources to diagram components
 */
export interface ResourceMappingConfig {
  version: string;
  resourceMappings: ResourceMapping[];
}

/**
 * Maps a Terraform resource type to a diagram component
 */
export interface ResourceMapping {
  terraformType: string;     // e.g., "aws_instance", "aws_vpc"
  componentType: string;     // e.g., "EC2InstanceComponent", "VpcComponent"
  // Maps terraform attributes to component properties
  attributeMapping: {
    [terraformAttr: string]: string;  // e.g., { "instance_type": "instanceType" }
  };
  required?: boolean;        // Whether to always include this resource type
  includePattern?: string;   // Regex to include resources by name
  excludePattern?: string;   // Regex to exclude resources by name
}

/**
 * Manages the resource mapping configuration
 */
export class ResourceMappingConfigManager {
  private static CONFIG_FILENAME = 'terraform-diagram.config.json';
  
  /**
   * Get the configuration file path
   * @param workspaceFolder The workspace folder to use
   * @returns Path to the configuration file
   */
  private static getConfigPath(workspaceFolder: vscode.WorkspaceFolder): string {
    return path.join(workspaceFolder.uri.fsPath, this.CONFIG_FILENAME);
  }
  
  /**
   * Load configuration from workspace file or use default
   * @returns The loaded or default configuration
   */
  static async loadConfig(): Promise<ResourceMappingConfig> {
    // Get the workspace folder
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return this.getDefaultConfig();
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const configPath = this.getConfigPath(workspaceFolder);
    
    try {
      // Check if config file exists
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
      }
    } catch (error) {
      console.error('Error loading resource mapping config:', error);
    }
    
    // If no config file or error, return default
    return this.getDefaultConfig();
  }
  
  /**
   * Save configuration to workspace file
   * @param config The configuration to save
   */
  static async saveConfig(config: ResourceMappingConfig): Promise<void> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      throw new Error('No workspace folder available');
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const configPath = this.getConfigPath(workspaceFolder);
    
    try {
      // Format and save the config
      const configData = JSON.stringify(config, null, 2);
      fs.writeFileSync(configPath, configData, 'utf8');
    } catch (error) {
      console.error('Error saving resource mapping config:', error);
      throw error;
    }
  }
  
  /**
   * Get the default configuration with common AWS resources
   * @returns Default configuration
   */
  static getDefaultConfig(): ResourceMappingConfig {
    return {
      version: "1.0",
      resourceMappings: [
        // Networking resources
        {
          terraformType: "aws_vpc",
          componentType: "VpcComponent",
          attributeMapping: {
            "cidr_block": "cidrBlock",
            "tags.Name": "name",
            "id": "id",
            "name": "name"
          }
        },
        {
          terraformType: "aws_subnet",
          componentType: "SubnetComponent",
          attributeMapping: {
            "cidr_block": "cidrBlock",
            "availability_zone": "availabilityZone",
            "tags.Name": "name",
            "map_public_ip_on_launch": "isPublic",
            "id": "id",
            "name": "name"
          }
        },
        // Compute resources
        {
          terraformType: "aws_instance",
          componentType: "EC2InstanceComponent",
          attributeMapping: {
            "instance_type": "instanceType",
            "ami": "ami",
            "tags.Name": "name",
            "id": "id",
            "name": "name"
          }
        },
        // Security resources
        {
          terraformType: "aws_security_group",
          componentType: "SecurityGroupComponent",
          attributeMapping: {
            "name": "name",
            "description": "description",
            "tags.Name": "name",
            "id": "id"
          }
        },
        // Storage resources
        {
          terraformType: "aws_s3_bucket",
          componentType: "S3BucketComponent",
          attributeMapping: {
            "bucket": "name",
            "tags.Name": "name",
            "id": "id"
          }
        },
        // Database resources
        {
          terraformType: "aws_db_instance",
          componentType: "RDSInstanceComponent",
          attributeMapping: {
            "engine": "engine",
            "instance_class": "instanceClass",
            "name": "name",
            "tags.Name": "name",
            "id": "id"
          }
        },
        // Serverless resources
        {
          terraformType: "aws_lambda_function",
          componentType: "LambdaFunctionComponent",
          attributeMapping: {
            "function_name": "name",
            "runtime": "runtime",
            "handler": "handler",
            "tags.Name": "name",
            "id": "id"
          }
        },
        // Gateway resources
        {
          terraformType: "aws_internet_gateway",
          componentType: "InternetGatewayComponent",
          attributeMapping: {
            "tags.Name": "name",
            "id": "id",
            "name": "name"
          }
        },
        // Route table resources
        {
          terraformType: "aws_route_table",
          componentType: "RouteTableComponent",
          attributeMapping: {
            "tags.Name": "name",
            "id": "id",
            "name": "name"
          }
        }
      ]
    };
  }

  /**
   * Create command to edit configuration
   */
  static registerCommands(context: vscode.ExtensionContext): void {
    // Register command to open/create config file
    context.subscriptions.push(
      vscode.commands.registerCommand('extension-test.editResourceMappingConfig', async () => {
        try {
          if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder available');
            return;
          }
          
          const workspaceFolder = vscode.workspace.workspaceFolders[0];
          const configPath = this.getConfigPath(workspaceFolder);
          
          // Create default config if it doesn't exist
          if (!fs.existsSync(configPath)) {
            const defaultConfig = this.getDefaultConfig();
            await this.saveConfig(defaultConfig);
          }
          
          // Open the config file
          const document = await vscode.workspace.openTextDocument(configPath);
          await vscode.window.showTextDocument(document);
        } catch (error) {
          vscode.window.showErrorMessage(`Error opening config: ${error}`);
        }
      })
    );
  }
}