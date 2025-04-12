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
            
            try {
                const fileInfo = await parser.buildFileDependencyTree(itemUri.fsPath);
                
                // Display file dependencies
                if (fileInfo.dependencies && fileInfo.dependencies.length > 0) {
                    for (let j = 0; j < fileInfo.dependencies.length; j++) {
                        const dep = fileInfo.dependencies[j];
                        const depIsLast = j === fileInfo.dependencies.length - 1;
                        const depPrefix = depIsLast ? `${childPrefix}└── ` : `${childPrefix}├── `;
                        
                        if (dep.isModule && dep.moduleName) {
                            // Display module folder name
                            output.appendLine(`${depPrefix}${dep.moduleName}`);
                            
                            // Path to module directory
                            const moduleDirPath = path.dirname(dep.path);
                            const modulePrefix = childPrefix + (depIsLast ? '    ' : '│   ');
                            
                            // List common terraform files in the module directory
                            const commonFiles = ['variables.tf', 'main.tf', 'outputs.tf'];
                            const foundCommonFiles = [];
                            
                            // Check if these files exist
                            for (const fileName of commonFiles) {
                                const filePath = path.join(moduleDirPath, fileName);
                                if (fs.existsSync(filePath)) {
                                    foundCommonFiles.push(fileName);
                                }
                            }
                            
                            // Display common files
                            for (let k = 0; k < foundCommonFiles.length; k++) {
                                const commonFileName = foundCommonFiles[k];
                                const fileIsLast = k === foundCommonFiles.length - 1 && 
                                                (!dep.dependencies || dep.dependencies.length === 0);
                                const filePrefix = `${modulePrefix}${fileIsLast ? '└── ' : '├── '}`;
                                output.appendLine(`${filePrefix}${commonFileName}`);
                            }
                            
                            // List any sub-modules if they exist
                            if (dep.dependencies && dep.dependencies.length > 0) {
                                const submoduleDirName = 'modules';
                                const submoduleIsLast = true;
                                const submodulePrefix = `${modulePrefix}${submoduleIsLast ? '└── ' : '├── '}`;
                                output.appendLine(`${submodulePrefix}${submoduleDirName}`);
                                
                                const submoduleNestedPrefix = modulePrefix + (submoduleIsLast ? '    ' : '│   ');
                                
                                // Display each sub-module
                                for (let k = 0; k < dep.dependencies.length; k++) {
                                    const submodule = dep.dependencies[k];
                                    const subIsLast = k === dep.dependencies.length - 1;
                                    const subPrefix = `${submoduleNestedPrefix}${subIsLast ? '└── ' : '├── '}`;
                                    
                                    if (submodule.isModule) {
                                        output.appendLine(`${subPrefix}${submodule.name}`);
                                        
                                        // For sub-modules, display their common files too
                                        const subModuleDirPath = path.dirname(submodule.path);
                                        const subModuleNestedPrefix = submoduleNestedPrefix + (subIsLast ? '    ' : '│   ');
                                        
                                        // Check for common files in the sub-module
                                        const subFoundCommonFiles = [];
                                        for (const fileName of commonFiles) {
                                            const filePath = path.join(subModuleDirPath, fileName);
                                            if (fs.existsSync(filePath)) {
                                                subFoundCommonFiles.push(fileName);
                                            }
                                        }
                                        
                                        // Display common files for sub-module
                                        for (let l = 0; l < subFoundCommonFiles.length; l++) {
                                            const commonFileName = subFoundCommonFiles[l];
                                            const fileIsLast = l === subFoundCommonFiles.length - 1;
                                            const filePrefix = `${subModuleNestedPrefix}${fileIsLast ? '└── ' : '├── '}`;
                                            output.appendLine(`${filePrefix}${commonFileName}`);
                                        }
                                    }
                                }
                            }
                        }
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
            // Handle Terraform files - just show the filename
            output.appendLine(`${itemPrefix}${name}`);
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
    
    try {
        // Process and display dependencies
        if (fileInfo.dependencies && fileInfo.dependencies.length > 0) {
            for (let i = 0; i < fileInfo.dependencies.length; i++) {
                const dependency = fileInfo.dependencies[i];
                const depIsLast = i === fileInfo.dependencies.length - 1;
                
                // Special handling for modules - display their file structure
                if (dependency.isModule && dependency.moduleName) {
                    // Create a module folder entry
                    const modulePrefix = `${childPrefix}${depIsLast ? '└── ' : '├── '}`;
                    const moduleFolderName = dependency.moduleName;
                    output.appendLine(`${modulePrefix}${moduleFolderName}`);
                    
                    // Path to module directory
                    const moduleDirPath = path.dirname(dependency.path);
                    const moduleNestedPrefix = childPrefix + (depIsLast ? '    ' : '│   ');
                    
                    // List common terraform files in the module directory
                    const commonFiles = ['variables.tf', 'main.tf', 'outputs.tf'];
                    const foundCommonFiles = [];
                    
                    // Check if these files exist
                    for (const fileName of commonFiles) {
                        const filePath = path.join(moduleDirPath, fileName);
                        if (fs.existsSync(filePath)) {
                            foundCommonFiles.push(fileName);
                        }
                    }
                    
                    // Display common files
                    for (let j = 0; j < foundCommonFiles.length; j++) {
                        const commonFileName = foundCommonFiles[j];
                        const fileIsLast = j === foundCommonFiles.length - 1 && 
                                        (!dependency.dependencies || dependency.dependencies.length === 0);
                        const filePrefix = `${moduleNestedPrefix}${fileIsLast ? '└── ' : '├── '}`;
                        output.appendLine(`${filePrefix}${commonFileName}`);
                    }
                    
                    // List any sub-modules if they exist
                    if (dependency.dependencies && dependency.dependencies.length > 0) {
                        const submoduleDirName = 'modules';
                        const submoduleIsLast = true;
                        const submodulePrefix = `${moduleNestedPrefix}${submoduleIsLast ? '└── ' : '├── '}`;
                        output.appendLine(`${submodulePrefix}${submoduleDirName}`);
                        
                        const submoduleNestedPrefix = moduleNestedPrefix + (submoduleIsLast ? '    ' : '│   ');
                        
                        // Display each sub-module
                        for (let j = 0; j < dependency.dependencies.length; j++) {
                            const submodule = dependency.dependencies[j];
                            const subIsLast = j === dependency.dependencies.length - 1;
                            const subPrefix = `${submoduleNestedPrefix}${subIsLast ? '└── ' : '├── '}`;
                            
                            if (submodule.isModule) {
                                output.appendLine(`${subPrefix}${submodule.name}`);
                                
                                // For sub-modules, display their common files too
                                const subModuleDirPath = path.dirname(submodule.path);
                                const subModuleNestedPrefix = submoduleNestedPrefix + (subIsLast ? '    ' : '│   ');
                                
                                // Check for common files in the sub-module
                                const subFoundCommonFiles = [];
                                for (const fileName of commonFiles) {
                                    const filePath = path.join(subModuleDirPath, fileName);
                                    if (fs.existsSync(filePath)) {
                                        subFoundCommonFiles.push(fileName);
                                    }
                                }
                                
                                // Display common files for sub-module
                                for (let k = 0; k < subFoundCommonFiles.length; k++) {
                                    const commonFileName = subFoundCommonFiles[k];
                                    const fileIsLast = k === subFoundCommonFiles.length - 1;
                                    const filePrefix = `${subModuleNestedPrefix}${fileIsLast ? '└── ' : '├── '}`;
                                    output.appendLine(`${filePrefix}${commonFileName}`);
                                }
                            }
                        }
                    }
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