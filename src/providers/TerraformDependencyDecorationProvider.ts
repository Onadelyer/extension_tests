// src/providers/TerraformDependencyDecorationProvider.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { TerraformParser } from '../parsers/TerraformParser';

/**
 * Provides file decorations for Terraform dependencies,
 * including highlighting folders containing dependencies
 */
export class TerraformDependencyDecorationProvider implements vscode.FileDecorationProvider {
  private selectedFile: vscode.Uri | undefined;
  private dependencyFiles: Set<string> = new Set();
  private dependencyFolders: Set<string> = new Set();
  private parser: TerraformParser = new TerraformParser();
  
  private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
  
  /**
   * Set the currently selected file and update dependencies
   * @param uri The selected file URI
   */
  async setSelectedFile(uri: vscode.Uri | undefined) {
    this.selectedFile = uri;
    this.dependencyFiles.clear();
    this.dependencyFolders.clear();
    
    if (uri && uri.fsPath.endsWith('.tf')) {
      // Get all dependencies
      const dependencies = await this.parser.getAllDependentFileUris(uri.fsPath);
      
      // Add dependency files
      dependencies.forEach(dep => {
        this.dependencyFiles.add(dep);
        
        // Add all parent folders to dependencyFolders
        let currentDir = path.dirname(dep);
        const rootDir = path.dirname(uri.fsPath);
        
        // Don't highlight the directory of the selected file
        if (currentDir !== rootDir) {
          while (currentDir && currentDir.length > rootDir.length) {
            this.dependencyFolders.add(currentDir);
            currentDir = path.dirname(currentDir);
          }
        }
      });
    }
    
    // Refresh all decorations
    this._onDidChangeFileDecorations.fire(undefined);
  }
  
  /**
   * Check if a URI is a directory that contains dependencies
   * @param uri The URI to check
   * @returns True if the directory contains dependencies
   */
  private isDirectoryWithDependencies(uri: vscode.Uri): boolean {
    return this.dependencyFolders.has(uri.fsPath);
  }
  
  /**
   * Provide decoration for a file or folder
   * @param uri The file or folder URI
   * @returns Decoration to apply
   */
  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (!this.selectedFile) {
      return undefined;
    }
    
    // If this is the selected file
    if (uri.fsPath === this.selectedFile.fsPath) {
      return {
        badge: '▶',
        color: new vscode.ThemeColor('charts.blue'),
        tooltip: 'Selected Terraform File'
      };
    }
    
    // If this is a dependency file
    if (this.dependencyFiles.has(uri.fsPath)) {
      return {
        badge: '↓',
        color: new vscode.ThemeColor('charts.green'),
        tooltip: 'Terraform Dependency'
      };
    }
    
    // If this is a folder containing dependencies
    if (this.isDirectoryWithDependencies(uri)) {
      return {
        badge: '↓',
        color: new vscode.ThemeColor('charts.green'),
        tooltip: 'Folder with Terraform Dependencies'
      };
    }
    
    return undefined;
  }
}