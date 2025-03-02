import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Tree item representing a Terraform file or folder
 */
export class TerraformTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly resourceUri?: vscode.Uri,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = resourceUri ? path.basename(resourceUri.fsPath) : label;
    this.description = resourceUri ? path.dirname(resourceUri.fsPath).replace(/^.*[\/\\]/, '') : '';
    
    // Set icon for Terraform files
    if (contextValue === 'terraform-file') {
      this.iconPath = new vscode.ThemeIcon('symbol-field');
    }
  }
}

/**
 * Tree data provider for Terraform files
 */
export class TerraformTreeProvider implements vscode.TreeDataProvider<TerraformTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TerraformTreeItem | undefined | null | void> = new vscode.EventEmitter<TerraformTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TerraformTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  
  private fileWatcher: vscode.FileSystemWatcher | undefined;

  constructor(private context: vscode.ExtensionContext) {
    // Watch for .tf file changes
    this.setupFileWatcher();
  }

  /**
   * Set up a file system watcher for Terraform files
   */
  private setupFileWatcher() {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
    
    this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.tf');
    
    // Refresh when files are added, removed or changed
    this.fileWatcher.onDidCreate(() => this.refresh());
    this.fileWatcher.onDidDelete(() => this.refresh());
    this.fileWatcher.onDidChange(() => this.refresh());
    
    // Clean up on extension deactivation
    this.context.subscriptions.push(this.fileWatcher);
  }

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Refresh the tree without affecting selection
   */

  /**
   * Get the tree item for a given element
   */
  getTreeItem(element: TerraformTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get the children of a tree item
   */
  async getChildren(element?: TerraformTreeItem): Promise<TerraformTreeItem[]> {
    if (!vscode.workspace.workspaceFolders) {
      return [];
    }

    if (!element) {
      // Root level: show workspace folders
      if (vscode.workspace.workspaceFolders.length === 1) {
        // If there's only one workspace folder, skip showing it and show files directly
        return this.getTerraformFiles(vscode.workspace.workspaceFolders[0]);
      }
      
      // Multiple workspace folders, show them as top-level items
      return vscode.workspace.workspaceFolders.map(
        folder => new TerraformTreeItem(
          folder.name,
          vscode.TreeItemCollapsibleState.Expanded,
          'workspace-folder',
          folder.uri
        )
      );
    } else if (element.contextValue === 'workspace-folder' && element.resourceUri) {
      // Workspace folder level: show Terraform files in this workspace
      return this.getTerraformFiles(vscode.workspace.getWorkspaceFolder(element.resourceUri));
    } else if (element.contextValue === 'folder' && element.resourceUri) {
      // Folder level: show contents of this folder
      const folderUri = element.resourceUri;
      return this.getTerraformFilesInFolder(folderUri);
    }

    return [];
  }

  /**
   * Get all Terraform files in a workspace folder
   */
  private async getTerraformFiles(workspaceFolder: vscode.WorkspaceFolder | undefined): Promise<TerraformTreeItem[]> {
    if (!workspaceFolder) {
      return [];
    }

    // Build a tree of files and folders
    const items = new Map<string, TerraformTreeItem>();
    const folderItems = new Map<string, Map<string, boolean>>();
    
    // Find all Terraform files in the workspace
    const tfFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/*.tf'),
      '**/node_modules/**'
    );
    
    // Group files by folder
    for (const fileUri of tfFiles) {
      const relativePath = path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath);
      const folderPath = path.dirname(relativePath);
      
      if (folderPath === '.') {
        // Root level file
        const fileName = path.basename(fileUri.fsPath);
        // No need to track selection state - VS Code handles it
        
        items.set(fileName, new TerraformTreeItem(
          fileName,
          vscode.TreeItemCollapsibleState.None,
          'terraform-file',
          fileUri,
          {
            command: 'extension-test.selectTerraformFile',
            title: 'Select File',
            arguments: [fileUri]
          }
        ));
      } else {
        // Add to parent folder's children
        const folderParts = folderPath.split(/[\/\\]/);
        let currentPath = '';
        
        for (let i = 0; i < folderParts.length; i++) {
          const folder = folderParts[i];
          const prevPath = currentPath;
          currentPath = currentPath ? `${currentPath}/${folder}` : folder;
          
          // Create folder item if it doesn't exist
          if (!items.has(currentPath)) {
            const folderUri = vscode.Uri.joinPath(workspaceFolder.uri, currentPath);
            items.set(currentPath, new TerraformTreeItem(
              folder,
              vscode.TreeItemCollapsibleState.Expanded,
              'folder',
              folderUri
            ));
          }
          
          // Track parent-child relationships
          if (prevPath) {
            if (!folderItems.has(prevPath)) {
              folderItems.set(prevPath, new Map<string, boolean>());
            }
            folderItems.get(prevPath)!.set(currentPath, true);
          }
        }
        
        // Add file to its folder
        const fileName = path.basename(fileUri.fsPath);
        const fileKey = `${folderPath}/${fileName}`;
        
        if (!folderItems.has(folderPath)) {
          folderItems.set(folderPath, new Map<string, boolean>());
        }
        
        // Create command to select this file
        
        items.set(fileKey, new TerraformTreeItem(
          fileName,
          vscode.TreeItemCollapsibleState.None,
          'terraform-file',
          fileUri,
          {
            command: 'extension-test.selectTerraformFile',
            title: 'Select File',
            arguments: [fileUri]
          }
        ));
        
        folderItems.get(folderPath)!.set(fileKey, true);
      }
    }
    
    // Return top-level items (direct children of the workspace folder)
    return Array.from(items.values()).filter(item => {
      if (item.contextValue === 'terraform-file') {
        // Check if this file is in the workspace root
        const relativePath = path.relative(
          workspaceFolder.uri.fsPath,
          item.resourceUri!.fsPath
        );
        return !relativePath.includes('/') && !relativePath.includes('\\');
      } else if (item.contextValue === 'folder') {
        // Check if this folder is a top-level folder
        const relativePath = path.relative(
          workspaceFolder.uri.fsPath,
          item.resourceUri!.fsPath
        );
        return !relativePath.includes('/') && !relativePath.includes('\\');
      }
      return false;
    });
  }

  /**
   * Get all Terraform files in a specific folder
   */
  private async getTerraformFilesInFolder(folderUri: vscode.Uri): Promise<TerraformTreeItem[]> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(folderUri);
    if (!workspaceFolder) {
      return [];
    }
    
    // Find all files and folders in this directory
    const items: TerraformTreeItem[] = [];
    
    // Get all Terraform files in this folder
    const tfFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(folderUri, '*.tf'),
      null
    );
    
    // Add file items
    for (const fileUri of tfFiles) {
      const fileName = path.basename(fileUri.fsPath);
      // No need to track selection state - VS Code handles it
      
      items.push(new TerraformTreeItem(
        fileName,
        vscode.TreeItemCollapsibleState.None,
        'terraform-file',
        fileUri,
        {
          command: 'extension-test.selectTerraformFile',
          title: 'Select File',
          arguments: [fileUri]
        }
      ));
    }
    
    // Get all subdirectories in this folder
    try {
      const relativePath = path.relative(workspaceFolder.uri.fsPath, folderUri.fsPath);
      const pattern = relativePath ? `${relativePath}/*` : '*';
      
      // Find all subdirectories
      const entries = await vscode.workspace.fs.readDirectory(folderUri);
      
      for (const [name, type] of entries) {
        if (type === vscode.FileType.Directory) {
          const subFolderUri = vscode.Uri.joinPath(folderUri, name);
          
          // Check if this folder contains any .tf files
          const subFolderTfFiles = await vscode.workspace.findFiles(
            new vscode.RelativePattern(subFolderUri, '**/*.tf'),
            null,
            1
          );
          
          if (subFolderTfFiles.length > 0) {
            items.push(new TerraformTreeItem(
              name,
              vscode.TreeItemCollapsibleState.Collapsed,
              'folder',
              subFolderUri
            ));
          }
        }
      }
    } catch (error) {
      console.error('Error reading directory:', error);
    }
    
    return items;
  }
}