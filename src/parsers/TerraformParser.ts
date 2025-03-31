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
        visitedPaths.add(filePath);
        
        // For each file in the directory, process it for module references
        const directoryFiles = Array.from(allFiles);
        for (const dirFile of directoryFiles) {
            await this.processFileForUris(dirFile, rootDir, allFiles, visitedPaths);
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
                    const moduleFiles = this.findAllTerraformFiles(modulePath);
                    
                    // Process each file in the directory
                    for (const moduleFilePath of moduleFiles) {
                        // Skip already visited files
                        if (visitedPaths.has(moduleFilePath)) {
                            continue;
                        }
                        
                        visitedPaths.add(moduleFilePath);
                        
                        // Create file info with module metadata
                        const fileInfo: FileInfo = {
                            path: moduleFilePath,
                            relativePath: workspacePath ? path.relative(workspacePath, moduleFilePath) : moduleFilePath,
                            name: path.basename(moduleFilePath),
                            isModule: true,
                            moduleName: moduleRef.name,
                            moduleSource: moduleRef.source,
                            dependencies: []
                        };
                        
                        // Add to parent's dependencies
                        parentFile.dependencies.push(fileInfo);
                        
                        // Process this file's dependencies
                        await this.processFileForTree(
                            fileInfo,
                            moduleFilePath,
                            path.dirname(moduleFilePath),
                            visitedPaths,
                            workspacePath
                        );
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
                    const moduleRegex = /module\s+"([^"]+)"\s+{([^}]*)}/gs;
                    let match;
                    
                    while ((match = moduleRegex.exec(content)) !== null) {
                        const moduleName = match[1];
                        const moduleBody = match[2];
                        
                        // Extract source from module body
                        const sourceRegex = /source\s*=\s*"([^"]+)"/;
                        const sourceMatch = moduleBody.match(sourceRegex);
                        
                        if (sourceMatch && sourceMatch[1]) {
                            moduleRefs.push({
                                name: moduleName,
                                source: sourceMatch[1]
                            });
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
                const resolvedPath = path.resolve(basePath, source);
                
                // Check if it exists
                if (fs.existsSync(resolvedPath)) {
                    return resolvedPath;
                } else {
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
    
    /**
     * Generate a formatted string representation of the file dependency tree
     * @param file The file to format
     * @param indent Indentation for formatting
     * @param visitedPaths Set of already visited paths to avoid infinite recursion
     * @returns Formatted string representation of the tree
     */
    formatFileDependencyTree(file: FileInfo, indent: string = '', visitedPaths: Set<string> = new Set()): string {
        let result = '';
        
        // Avoid infinite recursion
        if (visitedPaths.has(file.path)) {
            return `${indent}├─ ${file.relativePath || file.path} (circular reference)\n`;
        }
        
        visitedPaths.add(file.path);
        
        // Use relative path if available, otherwise full path
        const displayPath = file.relativePath || file.path;
        
        // Show file information
        if (file.isModule && file.moduleName && file.moduleSource) {
            result += `${indent}├─ ${displayPath} (Module: ${file.moduleName}, Source: ${file.moduleSource})\n`;
        } else if (indent === '') {
            result += `${indent}📄 Root File: ${displayPath}\n`;
        } else {
            result += `${indent}├─ ${displayPath} (Same Directory)\n`;
        }
        
        // Show dependencies
        if (file.dependencies.length === 0) {
            result += `${indent}   └─ No dependencies\n`;
        } else {
            result += `${indent}   └─ Dependencies (${file.dependencies.length}):\n`;
            for (let i = 0; i < file.dependencies.length; i++) {
                const dependency = file.dependencies[i];
                const isLast = i === file.dependencies.length - 1;
                // Use different indentation for the last item
                const nextIndent = `${indent}${isLast ? '    ' : '   │'}`;
                result += this.formatFileDependencyTree(dependency, nextIndent, new Set(visitedPaths));
            }
        }
        
        return result;
    }
    
    /**
     * Print a file dependency tree to the console
     * @param file The file to print
     */
    printFileDependencyTree(file: FileInfo): void {
        const treeOutput = this.formatFileDependencyTree(file);
        console.log(treeOutput);
    }
}