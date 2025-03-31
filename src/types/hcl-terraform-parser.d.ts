// src/types/hcl-terraform-parser.d.ts

declare module '@evops/hcl-terraform-parser' {
    /**
     * Represents a Terraform configuration structure
     */
    export interface TerraformConfig {
      // Direct module structure (old format)
      module?: Record<string, ModuleConfig | ModuleConfig[]>;
      
      // New parser format
      path?: string;
      variables?: Record<string, unknown>;
      outputs?: Record<string, unknown>;
      required_providers?: Record<string, unknown>;
      managed_resources?: Record<string, unknown>;
      data_resources?: Record<string, unknown>;
      module_calls?: Record<string, ModuleConfig>;
      [key: string]: unknown;
    }
  
    /**
     * Represents a module configuration
     */
    export interface ModuleConfig {
      source?: string;
      version?: string;
      [key: string]: unknown;
    }
  
    /**
     * Parses HCL (HashiCorp Configuration Language) content into a JavaScript object
     * @param content The HCL content to parse
     * @returns Parsed JavaScript object representing the HCL structure
     */
    export function parse(content: string): TerraformConfig;
    
    /**
     * Converts a JavaScript object into HCL content
     * @param obj The JavaScript object to convert
     * @returns HCL string representation
     */
    export function stringify(obj: Record<string, unknown>): string;
  }