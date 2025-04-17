// src/parsers/TerraformParser.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parse, TerraformConfig } from '@evops/hcl-terraform-parser';

/**
 * Represents a Terraform file with its dependencies
 */
export interface FileInfo {
    path: string;                     // Full path to the file
    relativePath?: string;            // Path relative to the workspace
    name: string;                     // Filename
    isModule?: boolean;               // Whether this file is part of a module
    moduleSource?: string;            // Source of the module (if applicable)
    moduleName?: string;              // Name of the module (if applicable)
    resources?: string[];             // Resources defined in this file
    outputs?: string[];               // Outputs defined in this file
    dependencies: FileInfo[];         // Files this file depends on
}

/**
 * Parser for Terraform files to extract file dependencies
 */
export class TerraformParser {
    /**
     * Get all dependent file URIs for a Terraform file including:
     * - All files in the same directory as the selected file
     * - All files in module directories referenced by any file in the directory
     * 
     * @param filePath Path to the root Terraform file
     * @returns Array of all related file paths
     */
    async getAllDependentFileUris(filePath: string): Promise<string[]> {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return [];
        }
        
        // Set to keep track of all unique file paths
        const allFiles = new Set<string>();
        
        // Add the selected file
        allFiles.add(filePath);
        
        // Get directory of the selected file
        const rootDir = path.dirname(filePath);
        
        // Add all files from the directory to start with
        this.addDirectoryFiles(rootDir, allFiles);
        
        // Track visited paths to avoid circular dependencies
        const visitedPaths = new Set<string>();
        
        // First, process the selected file to make sure its dependencies are analyzed
        // This ensures that main.tf module references are processed even if it's the selected file
        await this.processFileForUris(filePath, rootDir, allFiles, visitedPaths);
        
        // Then, process all other files in the directory
        // This ensures we don't miss any dependencies
        const directoryFiles = Array.from(allFiles);
        for (const dirFile of directoryFiles) {
            if (!visitedPaths.has(dirFile)) {
                await this.processFileForUris(dirFile, rootDir, allFiles, visitedPaths);
            }
        }
        
        // Convert to array and return
        return Array.from(allFiles);
    }
    
    /**
     * Process a file to find all module dependencies
     * @param filePath Path to process
     * @param basePath Base path for resolving module sources
     * @param allFiles Set to collect all file paths
     * @param visitedPaths Set to track visited paths
     */
    private async processFileForUris(
        filePath: string, 
        basePath: string, 
        allFiles: Set<string>,
        visitedPaths: Set<string>
    ): Promise<void> {
        try {
            if (visitedPaths.has(filePath)) {
                return; // Skip already processed files
            }
            
            visitedPaths.add(filePath);
            
            // Get module references from the file
            const moduleRefs = await this.extractModuleReferences(filePath);
            
            // Process each module
            for (const moduleRef of moduleRefs) {
                // Resolve module path
                const modulePath = this.resolveModulePath(moduleRef.source, basePath);
                
                if (!modulePath) {
                    continue; // Skip non-resolvable modules
                }
                
                // If module path is a directory, process all files in it
                if (fs.existsSync(modulePath) && fs.statSync(modulePath).isDirectory()) {
                    // Add all files from the module directory
                    this.addDirectoryFiles(modulePath, allFiles);
                    
                    // Process each file in the module directory
                    const moduleFiles = this.findAllTerraformFiles(modulePath);
                    for (const moduleFile of moduleFiles) {
                        if (!visitedPaths.has(moduleFile)) {
                            // Process this module file for its own dependencies
                            await this.processFileForUris(
                                moduleFile,
                                path.dirname(moduleFile),
                                allFiles,
                                visitedPaths
                            );
                        }
                    }
                } else if (modulePath && !visitedPaths.has(modulePath)) {
                    // It's a file, add it and process it
                    allFiles.add(modulePath);
                    
                    // Process this file
                    await this.processFileForUris(
                        modulePath,
                        path.dirname(modulePath),
                        allFiles,
                        visitedPaths
                    );
                }
            }
        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
        }
    }
    
    /**
     * Add all Terraform files from a directory to the set
     * @param dirPath Directory path
     * @param allFiles Set to collect file paths
     */
    private addDirectoryFiles(dirPath: string, allFiles: Set<string>): void {
        try {
            if (!fs.existsSync(dirPath)) {
                return;
            }
            
            const entries = fs.readdirSync(dirPath);
            
            for (const entry of entries) {
                if (entry.endsWith('.tf')) {
                    const fullPath = path.join(dirPath, entry);
                    if (fs.statSync(fullPath).isFile()) {
                        allFiles.add(fullPath);
                    }
                }
            }
        } catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
        }
    }
    
    /**
     * Finds Terraform outputs defined in a file
     * @param filePath Path to the file
     * @returns Array of output names
     */
    async findOutputs(filePath: string): Promise<string[]> {
        const outputs: string[] = [];
        
        try {
            // Read file content
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Use regex to find outputs
            const outputRegex = /output\s+"([^"]+)"\s+{/g;
            let match;
            
            while ((match = outputRegex.exec(content)) !== null) {
                outputs.push(match[1]);
            }
        } catch (error) {
            console.error(`Error finding outputs in ${filePath}:`, error);
        }
        
        return outputs;
    }
    
    /**
     * Finds Terraform resources defined in a file
     * @param filePath Path to the file
     * @returns Array of resource identifiers (type.name)
     */
    async findResources(filePath: string): Promise<string[]> {
        const resources: string[] = [];
        
        try {
            // Read file content
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Try HCL parser first
            try {
                const parsedContent = parse(content);
                
                // Handle both old and new parser formats
                if (parsedContent.managed_resources) {
                    // New parser format
                    for (const [resourceType, resourceInstances] of Object.entries(parsedContent.managed_resources)) {
                        for (const [resourceName, _] of Object.entries(resourceInstances as Record<string, any>)) {
                            resources.push(`${resourceType}.${resourceName}`);
                        }
                    }
                } else if (parsedContent.resource) {
                    // Old parser format
                    for (const [resourceType, resourceInstances] of Object.entries(parsedContent.resource)) {
                        if (Array.isArray(resourceInstances)) {
                            resourceInstances.forEach((instance: any, index: number) => {
                                for (const resourceName of Object.keys(instance)) {
                                    resources.push(`${resourceType}.${resourceName}`);
                                }
                            });
                        } else if (typeof resourceInstances === 'object') {
                            for (const resourceName of Object.keys(resourceInstances)) {
                                resources.push(`${resourceType}.${resourceName}`);
                            }
                        }
                    }
                }
            } catch (error) {
                // If HCL parser fails, try regex fallback
                try {
                    const resourceRegex = /resource\s+"([^"]+)"\s+"([^"]+)"\s+{/g;
                    let match;
                    
                    while ((match = resourceRegex.exec(content)) !== null) {
                        resources.push(`${match[1]}.${match[2]}`);
                    }
                } catch (regexError) {
                    // Ignore regex errors
                }
            }
        } catch (error) {
            console.error(`Error finding resources in ${filePath}:`, error);
        }
        
        return resources;
    }
    
    /**
     * Build a dependency tree for a Terraform file including all .tf files
     * @param rootFilePath Path to the root Terraform file
     * @param workspacePath Optional workspace path for calculating relative paths
     * @returns Root file with file dependencies
     */
    async buildFileDependencyTree(rootFilePath: string, workspacePath?: string): Promise<FileInfo> {
        // Verify the file exists
        if (!fs.existsSync(rootFilePath)) {
            throw new Error(`File not found: ${rootFilePath}`);
        }
        
        const rootDir = path.dirname(rootFilePath);
        const rootFileName = path.basename(rootFilePath);
        
        // Create the root file representation
        const rootFile: FileInfo = {
            path: rootFilePath,
            relativePath: workspacePath ? path.relative(workspacePath, rootFilePath) : rootFilePath,
            name: rootFileName,
            dependencies: []
        };
        
        // Track visited paths to avoid circular dependencies
        const visitedPaths = new Set<string>();
        visitedPaths.add(rootFilePath); // Mark root file as visited
        
        // Get all sibling Terraform files in the same directory
        const directoryFiles = this.findAllTerraformFiles(rootDir).filter(f => f !== rootFilePath);
        
        // Find outputs in the root file
        const outputs = await this.findOutputs(rootFilePath);
        if (outputs.length > 0) {
            rootFile.outputs = outputs;
        }
        
        // Find resources in the root file
        const resources = await this.findResources(rootFilePath);
        if (resources.length > 0) {
            rootFile.resources = resources;
        }
        
        // Process each sibling file and add it as a direct dependency
        for (const siblingFilePath of directoryFiles) {
            const fileName = path.basename(siblingFilePath);
            
            // Create file info for this sibling file
            const fileInfo: FileInfo = {
                path: siblingFilePath,
                relativePath: workspacePath ? path.relative(workspacePath, siblingFilePath) : siblingFilePath,
                name: fileName,
                dependencies: []
            };
            
            // Find outputs in the sibling file
            const outputs = await this.findOutputs(siblingFilePath);
            if (outputs.length > 0) {
                fileInfo.outputs = outputs;
            }
            
            // Find resources in the sibling file
            const resources = await this.findResources(siblingFilePath);
            if (resources.length > 0) {
                fileInfo.resources = resources;
            }
            
            // Add to root file's dependencies
            rootFile.dependencies.push(fileInfo);
            
            // Mark as visited
            visitedPaths.add(siblingFilePath);
            
            // Process this sibling file for its own module dependencies
            await this.processFileForTree(fileInfo, siblingFilePath, rootDir, visitedPaths, workspacePath);
        }
        
        // Process the root file's module dependencies
        await this.processFileForTree(rootFile, rootFilePath, rootDir, visitedPaths, workspacePath);
        
        return rootFile;
    }
    
    /**
     * Process a file to build the dependency tree
     * @param parentFile Parent file to add dependencies to
     * @param filePath Path to the file
     * @param basePath Base path for resolving module sources
     * @param visitedPaths Set to track visited paths
     * @param workspacePath Optional workspace path for relative paths
     */
    private async processFileForTree(
        parentFile: FileInfo,
        filePath: string,
        basePath: string,
        visitedPaths: Set<string>,
        workspacePath?: string
    ): Promise<void> {
        try {
            // Extract module references
            const moduleRefs = await this.extractModuleReferences(filePath);
            
            // Process each module reference
            for (const moduleRef of moduleRefs) {
                // Resolve module path
                const modulePath = this.resolveModulePath(moduleRef.source, basePath);
                
                if (!modulePath) {
                    continue; // Skip non-resolvable modules
                }
                
                // If module path is a directory, process all files in it
                if (fs.existsSync(modulePath) && fs.statSync(modulePath).isDirectory()) {
                    // First find main.tf, variables.tf, and outputs.tf
                    const moduleFiles = this.findAllTerraformFiles(modulePath);
                    const mainFile = moduleFiles.find(f => path.basename(f) === 'main.tf');
                    const outputsFile = moduleFiles.find(f => path.basename(f) === 'outputs.tf');
                    const variablesFile = moduleFiles.find(f => path.basename(f) === 'variables.tf');
                    
                    // Create a "virtual" module file to represent the module
                    const moduleFileInfo: FileInfo = {
                        path: mainFile || moduleFiles[0] || modulePath,
                        relativePath: workspacePath ? path.relative(workspacePath, modulePath) : modulePath,
                        name: path.basename(modulePath),
                        isModule: true,
                        moduleName: moduleRef.name,
                        moduleSource: moduleRef.source,
                        dependencies: []
                    };
                    
                    // Find resources in main.tf
                    if (mainFile) {
                        const resources = await this.findResources(mainFile);
                        if (resources.length > 0) {
                            moduleFileInfo.resources = resources;
                        }
                    }
                    
                    // Find outputs in outputs.tf
                    if (outputsFile) {
                        const outputs = await this.findOutputs(outputsFile);
                        if (outputs.length > 0) {
                            moduleFileInfo.outputs = outputs;
                        }
                    }
                    
                    // Add the module to parent's dependencies
                    parentFile.dependencies.push(moduleFileInfo);
                    
                    // Process nested modules (only if the main.tf file wasn't already visited)
                    if (mainFile && !visitedPaths.has(mainFile)) {
                        visitedPaths.add(mainFile);
                        await this.processFileForTree(
                            moduleFileInfo,
                            mainFile,
                            path.dirname(mainFile),
                            visitedPaths,
                            workspacePath
                        );
                    }
                    
                    // Process other files in the module
                    for (const moduleFile of moduleFiles) {
                        if (moduleFile !== mainFile && moduleFile !== outputsFile && moduleFile !== variablesFile && 
                            !visitedPaths.has(moduleFile)) {
                              
                            visitedPaths.add(moduleFile);
                            
                            // Create file info
                            const fileInfo: FileInfo = {
                                path: moduleFile,
                                relativePath: workspacePath ? path.relative(workspacePath, moduleFile) : moduleFile,
                                name: path.basename(moduleFile),
                                isModule: true,
                                dependencies: []
                            };
                            
                            // Find resources
                            const resources = await this.findResources(moduleFile);
                            if (resources.length > 0) {
                                fileInfo.resources = resources;
                            }
                            
                            // Add to module's dependencies
                            moduleFileInfo.dependencies.push(fileInfo);
                            
                            // Recursively process this file
                            await this.processFileForTree(
                                fileInfo,
                                moduleFile,
                                path.dirname(moduleFile),
                                visitedPaths,
                                workspacePath
                            );
                        }
                    }
                } else if (modulePath && !visitedPaths.has(modulePath)) {
                    // It's a file
                    visitedPaths.add(modulePath);
                    
                    // Create file info with module metadata
                    const fileInfo: FileInfo = {
                        path: modulePath,
                        relativePath: workspacePath ? path.relative(workspacePath, modulePath) : modulePath,
                        name: path.basename(modulePath),
                        isModule: true,
                        moduleName: moduleRef.name,
                        moduleSource: moduleRef.source,
                        dependencies: []
                    };
                    
                    // Find resources
                    const resources = await this.findResources(modulePath);
                    if (resources.length > 0) {
                        fileInfo.resources = resources;
                    }
                    
                    // Find outputs
                    const outputs = await this.findOutputs(modulePath);
                    if (outputs.length > 0) {
                        fileInfo.outputs = outputs;
                    }
                    
                    // Add to parent's dependencies
                    parentFile.dependencies.push(fileInfo);
                    
                    // Process this file's dependencies
                    await this.processFileForTree(
                        fileInfo,
                        modulePath,
                        path.dirname(modulePath),
                        visitedPaths,
                        workspacePath
                    );
                }
            }
        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
        }
    }
    
    /**
     * Extract module references from Terraform content
     * @param filePath Path to the file
     * @returns Array of module references
     */
    private async extractModuleReferences(filePath: string): Promise<{name: string, source: string}[]> {
        const moduleRefs: {name: string, source: string}[] = [];
        
        try {
            // Read file content
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Try HCL parser first
            try {
                const parsedContent = parse(content);
                
                // Handle both old and new parser formats
                if (parsedContent.module_calls) {
                    // New parser format
                    for (const [moduleName, moduleConfig] of Object.entries(parsedContent.module_calls)) {
                        if (moduleConfig && typeof moduleConfig === 'object') {
                            const typedConfig = moduleConfig as Record<string, unknown>;
                            if (typedConfig.source && typeof typedConfig.source === 'string') {
                                moduleRefs.push({
                                    name: moduleName,
                                    source: typedConfig.source
                                });
                            }
                        }
                    }
                } else if (parsedContent.module) {
                    // Old parser format
                    for (const [moduleName, moduleConfig] of Object.entries(parsedContent.module)) {
                        if (moduleConfig) {
                            if (Array.isArray(moduleConfig)) {
                                moduleConfig.forEach((config, index) => {
                                    const typedConfig = config as Record<string, unknown>;
                                    if (typedConfig.source && typeof typedConfig.source === 'string') {
                                        moduleRefs.push({
                                            name: `${moduleName}[${index}]`,
                                            source: typedConfig.source
                                        });
                                    }
                                });
                            } else if (typeof moduleConfig === 'object') {
                                const typedConfig = moduleConfig as Record<string, unknown>;
                                if (typedConfig.source && typeof typedConfig.source === 'string') {
                                    moduleRefs.push({
                                        name: moduleName,
                                        source: typedConfig.source
                                    });
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                // If HCL parser fails, try regex fallback
                try {
                    // Improved regex to match more formats of module declarations
                    // This will match both quoted and unquoted module names
                    const moduleRegex = /module\s+(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_-]+))\s+{([^}]*)}/gs;
                    let match;
                    
                    while ((match = moduleRegex.exec(content)) !== null) {
                        // Get module name from any of the capture groups
                        const moduleName = match[1] || match[2] || match[3];
                        const moduleBody = match[4];
                        
                        // Improved source extraction regex
                        // This will match both quoted and unquoted source values
                        const sourceRegex = /source\s*=\s*(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_\.\/-]+))/;
                        const sourceMatch = moduleBody.match(sourceRegex);
                        
                        if (sourceMatch) {
                            // Get source from any of the capture groups
                            const source = sourceMatch[1] || sourceMatch[2] || sourceMatch[3];
                            if (source) {
                                moduleRefs.push({
                                    name: moduleName,
                                    source: source
                                });
                            }
                        }
                    }
                } catch (regexError) {
                    // Ignore regex errors
                }
            }
        } catch (error) {
            console.error(`Error extracting module references from ${filePath}:`, error);
        }
        
        return moduleRefs;
    }
    
    /**
     * Resolve a module source to a filesystem path
     * @param source Module source string
     * @param basePath Base path for resolving relative paths
     * @returns Resolved path or null if not resolvable
     */
    private resolveModulePath(source: string, basePath: string): string | null {
        // Handle local file paths
        if (source.startsWith('./') || source.startsWith('../') || path.isAbsolute(source) || !source.includes('://')) {
            try {
                // Resolve the path
                let resolvedPath = path.resolve(basePath, source);
                
                // Check if it exists
                if (fs.existsSync(resolvedPath)) {
                    // If it's a directory, return it
                    if (fs.statSync(resolvedPath).isDirectory()) {
                        return resolvedPath;
                    }
                    // If it's a file, return it
                    return resolvedPath;
                } 
                
                // Try adding .tf extension
                const withTfExt = `${resolvedPath}.tf`;
                if (fs.existsSync(withTfExt)) {
                    return withTfExt;
                }
                
                // Special case: if source doesn't start with ./ or ../ but is a local path
                // This handles module references like "modules/vpc" instead of "./modules/vpc"
                if (!source.startsWith('./') && !source.startsWith('../') && !path.isAbsolute(source)) {
                    resolvedPath = path.resolve(basePath, `./${source}`);
                    
                    if (fs.existsSync(resolvedPath)) {
                        if (fs.statSync(resolvedPath).isDirectory()) {
                            return resolvedPath;
                        }
                        return resolvedPath;
                    }
                    
                    // Try adding .tf extension
                    const withTfExt = `${resolvedPath}.tf`;
                    if (fs.existsSync(withTfExt)) {
                        return withTfExt;
                    }
                }
            } catch (error) {
                console.error(`Error resolving module path ${source}:`, error);
            }
        }
        
        // For remote sources (GitHub, Terraform Registry, etc.)
        return null;
    }
    
    /**
     * Find all Terraform files in a directory or return a single file
     * @param dirOrFilePath Directory or file path
     * @returns Array of file paths
     */
    private findAllTerraformFiles(dirOrFilePath: string): string[] {
        const files: string[] = [];
        
        try {
            const stats = fs.statSync(dirOrFilePath);
            
            if (stats.isFile()) {
                // If it's a file and has .tf extension, add it
                if (dirOrFilePath.endsWith('.tf')) {
                    files.push(dirOrFilePath);
                }
                return files;
            }
            
            // It's a directory, find all .tf files
            const entries = fs.readdirSync(dirOrFilePath);
            
            for (const entry of entries) {
                if (entry.endsWith('.tf')) {
                    const fullPath = path.join(dirOrFilePath, entry);
                    try {
                        const entryStats = fs.statSync(fullPath);
                        if (entryStats.isFile()) {
                            files.push(fullPath);
                        }
                    } catch (error) {
                        // Skip files with stat errors
                    }
                }
            }
        } catch (error) {
            console.error(`Error finding Terraform files in ${dirOrFilePath}:`, error);
        }
        
        return files;
    }
}