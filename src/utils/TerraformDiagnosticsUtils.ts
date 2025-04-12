// src/utils/TerraformDiagnosticsUtils.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TerraformParser, FileInfo } from '../parsers/TerraformParser';

/**
 * Represents a Terraform resource
 */
export interface TerraformResource {
    type: string;
    name: string;
    config: Record<string, any>;
}

/**
 * Generate a tree representation of the directory structure and terraform files
 * @param dirUri The directory URI to analyze
 * @param output The output channel to write to
 * @param parser The TerraformParser instance
 */
export async function generateDependencyTree(
    dirUri: vscode.Uri, 
    output: vscode.OutputChannel,
    parser: TerraformParser
): Promise<void> {
    // Get all entries in the directory
    const entries = await vscode.workspace.fs.readDirectory(dirUri);
    
    // Sort entries: directories first, then files
    const sortedEntries = entries.sort((a, b) => {
        // First sort by type (directories first)
        if (a[1] !== b[1]) {
            return a[1] === vscode.FileType.Directory ? -1 : 1;
        }
        // Then sort alphabetically
        return a[0].localeCompare(b[0]);
    });
    
    // Display the root directory name
    const dirName = path.basename(dirUri.fsPath);
    output.appendLine(dirName);
    
    // Process each entry
    for (let i = 0; i < sortedEntries.length; i++) {
        const [name, type] = sortedEntries[i];
        const isLast = i === sortedEntries.length - 1;
        const itemPrefix = isLast ? '└── ' : '├── ';
        const childPrefix = isLast ? '    ' : '│   ';
        
        const itemUri = vscode.Uri.joinPath(dirUri, name);
        
        if (type === vscode.FileType.Directory) {
            // Handle directories
            output.appendLine(`${itemPrefix}${name}`);
            
            // Recursively process subdirectory
            await generateDirectoryTree(itemUri, output, childPrefix, parser);
        } else if (type === vscode.FileType.File && name.endsWith('.tf')) {
            // Handle Terraform files
            output.appendLine(`${itemPrefix}${name}`);
            
            // Extract resources from the file
            try {
                const resources = await extractTerraformResources(itemUri.fsPath);
                const fileInfo = await parser.buildFileDependencyTree(itemUri.fsPath);
                
                // Display resources
                if (resources.length > 0) {
                    for (let j = 0; j < resources.length; j++) {
                        const resource = resources[j];
                        const resourceIsLast = j === resources.length - 1 && 
                                             (!fileInfo.dependencies || fileInfo.dependencies.length === 0);
                        const resourcePrefix = resourceIsLast ? `${childPrefix}└── ` : `${childPrefix}├── `;
                        
                        output.appendLine(`${resourcePrefix}${resource.type}.${resource.name}`);
                    }
                }
                
                // Display file dependencies
                if (fileInfo.dependencies && fileInfo.dependencies.length > 0) {
                    for (let j = 0; j < fileInfo.dependencies.length; j++) {
                        const dep = fileInfo.dependencies[j];
                        const depIsLast = j === fileInfo.dependencies.length - 1;
                        const depPrefix = depIsLast ? `${childPrefix}└── ` : `${childPrefix}├── `;
                        
                        if (dep.isModule) {
                            output.appendLine(`${depPrefix}module.${dep.moduleName || 'unknown'}`);
                        }
                    }
                }
                
                // Display outputs
                if (fileInfo.outputs && fileInfo.outputs.length > 0) {
                    const outputsPrefix = (fileInfo.dependencies && fileInfo.dependencies.length > 0) ? 
                        `${childPrefix}│   ` : childPrefix;
                    
                    for (let j = 0; j < fileInfo.outputs.length; j++) {
                        const outputName = fileInfo.outputs[j];
                        const outputIsLast = j === fileInfo.outputs.length - 1;
                        const outputPrefix = outputIsLast ? `${outputsPrefix}└── ` : `${outputsPrefix}├── `;
                        
                        output.appendLine(`${outputPrefix}${outputName}`);
                    }
                }
            } catch (error) {
                console.error(`Error processing file ${itemUri.fsPath}:`, error);
            }
        }
    }
}

/**
 * Recursively generate a tree representation of a directory
 * @param dirUri The directory URI to analyze
 * @param output The output channel to write to
 * @param prefix The prefix for indentation and tree structure
 * @param parser The TerraformParser instance
 */
export async function generateDirectoryTree(
    dirUri: vscode.Uri, 
    output: vscode.OutputChannel,
    prefix: string,
    parser: TerraformParser
): Promise<void> {
    // Get all entries in the directory
    const entries = await vscode.workspace.fs.readDirectory(dirUri);
    
    // Sort entries: directories first, then files
    const sortedEntries = entries.sort((a, b) => {
        // First sort by type (directories first)
        if (a[1] !== b[1]) {
            return a[1] === vscode.FileType.Directory ? -1 : 1;
        }
        // Then sort alphabetically
        return a[0].localeCompare(b[0]);
    });
    
    // Process each entry
    for (let i = 0; i < sortedEntries.length; i++) {
        const [name, type] = sortedEntries[i];
        const isLast = i === sortedEntries.length - 1;
        const itemPrefix = isLast ? `${prefix}└── ` : `${prefix}├── `;
        const childPrefix = isLast ? `${prefix}    ` : `${prefix}│   `;
        
        const itemUri = vscode.Uri.joinPath(dirUri, name);
        
        if (type === vscode.FileType.Directory) {
            // Handle directories
            output.appendLine(`${itemPrefix}${name}`);
            
            // Recursively process subdirectory
            await generateDirectoryTree(itemUri, output, childPrefix, parser);
        } else if (type === vscode.FileType.File && name.endsWith('.tf')) {
            // Handle Terraform files
            output.appendLine(`${itemPrefix}${name}`);
            
            try {
                // Extract resources from the file
                const resources = await extractTerraformResources(itemUri.fsPath);
                const fileInfo = await parser.buildFileDependencyTree(itemUri.fsPath);
                
                // Display resources
                if (resources.length > 0) {
                    for (let j = 0; j < resources.length; j++) {
                        const resource = resources[j];
                        const resourceIsLast = j === resources.length - 1 && 
                                             (!fileInfo.outputs || fileInfo.outputs.length === 0);
                        const resourcePrefix = resourceIsLast ? `${childPrefix}└── ` : `${childPrefix}├── `;
                        
                        output.appendLine(`${resourcePrefix}${resource.type}.${resource.name}`);
                    }
                }
                
                // Display outputs
                if (fileInfo.outputs && fileInfo.outputs.length > 0) {
                    for (let j = 0; j < fileInfo.outputs.length; j++) {
                        const outputName = fileInfo.outputs[j];
                        const outputIsLast = j === fileInfo.outputs.length - 1;
                        const outputPrefix = outputIsLast ? `${childPrefix}└── ` : `${childPrefix}├── `;
                        
                        output.appendLine(`${outputPrefix}${outputName}`);
                    }
                }
            } catch (error) {
                console.error(`Error processing file ${itemUri.fsPath}:`, error);
            }
        }
    }
}

/**
 * Display a file and its dependencies as a tree
 * @param fileInfo The file information
 * @param output The output channel to write to
 * @param prefix The prefix for indentation and tree structure
 * @param isLast Whether this is the last item in its parent list
 * @param parser The TerraformParser instance
 */
export async function displayFileDependencyTree(
    fileInfo: FileInfo,
    output: vscode.OutputChannel,
    prefix: string,
    isLast: boolean,
    parser: TerraformParser
): Promise<void> {
    // Determine prefixes
    const itemPrefix = prefix + (isLast ? '└── ' : '├── ');
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    
    // Display the file
    output.appendLine(`${itemPrefix}${fileInfo.name}`);
    
    // Extract resources from the file
    try {
        // We'll need to track if we have any items to determine if next items are the last
        const resourcesCount = fileInfo.resources?.length || 0;
        const outputsCount = fileInfo.outputs?.length || 0;
        const dependenciesCount = fileInfo.dependencies?.length || 0;
        const totalItems = resourcesCount + outputsCount + dependenciesCount;
        
        let itemsProcessed = 0;
        
        // Display resources
        if (fileInfo.resources && fileInfo.resources.length > 0) {
            for (let i = 0; i < fileInfo.resources.length; i++) {
                const resource = fileInfo.resources[i];
                itemsProcessed++;
                const resourceIsLast = itemsProcessed === totalItems;
                const resourcePrefix = resourceIsLast ? `${childPrefix}└── ` : `${childPrefix}├── `;
                
                output.appendLine(`${resourcePrefix}${resource}`);
            }
        }
        
        // Display outputs
        if (fileInfo.outputs && fileInfo.outputs.length > 0) {
            for (let i = 0; i < fileInfo.outputs.length; i++) {
                const outputName = fileInfo.outputs[i];
                itemsProcessed++;
                const outputIsLast = itemsProcessed === totalItems;
                const outputPrefix = outputIsLast ? `${childPrefix}└── ` : `${childPrefix}├── `;
                
                output.appendLine(`${outputPrefix}${outputName}`);
            }
        }
        
        // Process and display dependencies
        if (fileInfo.dependencies && fileInfo.dependencies.length > 0) {
            for (let i = 0; i < fileInfo.dependencies.length; i++) {
                const dependency = fileInfo.dependencies[i];
                itemsProcessed++;
                const depIsLast = itemsProcessed === totalItems;
                
                // Display module prefix if it's a module
                if (dependency.isModule && dependency.moduleName) {
                    const modulePrefix = `${childPrefix}${depIsLast ? '└── ' : '├── '}`;
                    output.appendLine(`${modulePrefix}module.${dependency.moduleName}`);
                    
                    // Display module file with increased indentation
                    await displayFileDependencyTree(
                        dependency, 
                        output, 
                        childPrefix + (depIsLast ? '    ' : '│   '), 
                        true,
                        parser
                    );
                } else {
                    // Regular file dependency
                    await displayFileDependencyTree(
                        dependency, 
                        output, 
                        childPrefix, 
                        depIsLast,
                        parser
                    );
                }
            }
        }
    } catch (error) {
        console.error(`Error processing file ${fileInfo.path}:`, error);
    }
}

/**
 * Extract Terraform resources from a file
 * @param filePath Path to the file
 * @returns Array of resources
 */
export async function extractTerraformResources(filePath: string): Promise<TerraformResource[]> {
    // Read the file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Try using the HCL parser if available
    try {
        // Attempt to use @evops/hcl-terraform-parser
        const { parse } = require('@evops/hcl-terraform-parser');
        const parsed = parse(content);
        
        const resources: TerraformResource[] = [];
        
        // Check if we have managed_resources in the parsed output (newer parser format)
        if (parsed.managed_resources) {
            // Process managed resources (newer format)
            for (const [resourceType, resourceInstances] of Object.entries(parsed.managed_resources)) {
                for (const [resourceName, resourceConfig] of Object.entries(resourceInstances as Record<string, any>)) {
                    resources.push({
                        type: resourceType,
                        name: resourceName,
                        config: resourceConfig || {}
                    });
                }
            }
        } else {
            // Process resource blocks directly
            for (const [key, value] of Object.entries(parsed)) {
                if (key === 'resource' && typeof value === 'object') {
                    for (const [resourceType, resourceInstances] of Object.entries(value as Record<string, any>)) {
                        for (const [resourceName, resourceConfig] of Object.entries(resourceInstances as Record<string, any>)) {
                            resources.push({
                                type: resourceType,
                                name: resourceName,
                                config: resourceConfig || {}
                            });
                        }
                    }
                }
            }
        }
        
        return resources;
    } catch (error) {
        console.error('HCL parser failed, falling back to regex-based parser:', error);
        
        // Fallback to regex-based parsing
        const resources: TerraformResource[] = [];
        const resourceRegex = /resource\s+"([^"]+)"\s+"([^"]+)"\s+{/g;
        
        let match;
        while ((match = resourceRegex.exec(content)) !== null) {
            resources.push({
                type: match[1],
                name: match[2],
                config: {} // Simple fallback doesn't parse properties
            });
        }
        
        return resources;
    }
}