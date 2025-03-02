import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class MenuViewProvider implements vscode.WebviewViewProvider {
    constructor(private readonly extensionUri: vscode.Uri) {}
  
    resolveWebviewView(
      webviewView: vscode.WebviewView,
      context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken
    ) {
      // Enable scripts in the webview
      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'out'),
          vscode.Uri.joinPath(this.extensionUri, 'media'),
          vscode.Uri.joinPath(this.extensionUri, 'webview-ui/build')
        ]
      };
  
      // Set the webview's HTML content
      webviewView.webview.html = this._getWebviewContent(webviewView.webview);

      // Initial scan for .tf files
      this._scanForTerraformFiles(webviewView.webview);

      // Listen for file system changes
      const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.tf');
      fileWatcher.onDidCreate(() => this._scanForTerraformFiles(webviewView.webview));
      fileWatcher.onDidDelete(() => this._scanForTerraformFiles(webviewView.webview));
      fileWatcher.onDidChange(() => this._scanForTerraformFiles(webviewView.webview));

      // Handle messages from the webview
      webviewView.webview.onDidReceiveMessage(
        message => {
          switch (message.command) {
            case 'createDiagram':
              if (message.filePath) {
                this._createDiagramFromFile(message.filePath);
              }
              return;
            case 'getTerraformFiles':
              this._scanForTerraformFiles(webviewView.webview);
              return;
          }
        },
        undefined,
        []
      );

      // Clean up the file watcher when the webview is disposed
      webviewView.onDidDispose(() => {
        fileWatcher.dispose();
      });
    }

    /**
     * Scan the workspace for .tf files and send them to the webview
     */
    private async _scanForTerraformFiles(webview: vscode.Webview) {
      try {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
          webview.postMessage({ 
            command: 'tfFiles',
            files: [] 
          });
          return;
        }

        // Get all .tf files in the workspace
        const tfFiles = await vscode.workspace.findFiles('**/*.tf', '**/node_modules/**');
        
        // Convert to a more manageable structure with relative paths
        const fileStructure = tfFiles.map(file => {
          // Get workspace folder that contains this file
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(file);
          if (!workspaceFolder) {
            return null;
          }

          // Get the relative path from the workspace folder
          const relativePath = path.relative(workspaceFolder.uri.fsPath, file.fsPath);
          
          return {
            uri: file.toString(),
            path: relativePath,
            name: path.basename(file.fsPath),
            workspaceName: workspaceFolder.name
          };
        }).filter(Boolean); // Remove null entries
        
        // Send the file list to the webview
        webview.postMessage({
          command: 'tfFiles',
          files: fileStructure
        });
      } catch (error) {
        console.error('Error scanning for .tf files:', error);
        vscode.window.showErrorMessage(`Error scanning for .tf files: ${error}`);
      }
    }

    /**
     * Create a diagram from the selected Terraform file
     */
    private async _createDiagramFromFile(filePath: string) {
      try {
        // Get the file content
        const fileUri = vscode.Uri.parse(filePath);
        const document = await vscode.workspace.openTextDocument(fileUri);
        
        // Create a new untitled diagram file
        const fileName = path.basename(fileUri.fsPath, '.tf');
        const untitledUri = vscode.Uri.parse(`untitled:${fileName}.diagram`);
        
        // Open the document with the diagram editor
        await vscode.commands.executeCommand('extension-test.createDiagram');
        
        // Show a success message
        vscode.window.showInformationMessage(`Created diagram from ${fileName}.tf`);
      } catch (error) {
        console.error('Error creating diagram:', error);
        vscode.window.showErrorMessage(`Error creating diagram: ${error}`);
      }
    }
  
    private _getWebviewContent(webview: vscode.Webview): string {
      // Path to the built React app
      const reactDistPath = vscode.Uri.joinPath(this.extensionUri, 'webview-ui/build');
      
      try {
        // Try to load the built React app if it exists
        if (fs.existsSync(path.join(reactDistPath.fsPath, 'index.html'))) {
          // Get paths to scripts and styles
          const indexHtml = fs.readFileSync(
            path.join(reactDistPath.fsPath, 'index.html'),
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
              
              const uri = vscode.Uri.joinPath(reactDistPath, value);
              return `${attr}="${webview.asWebviewUri(uri)}"`;
            }
          );
        }
      } catch (error) {
        console.error('Error loading React app:', error);
      }
  
      // Fallback to basic HTML if React app is not available
      return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Custom Menu</title>
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
          <div>Placeholder</div>
        </body>
        </html>
      `;
    }
}