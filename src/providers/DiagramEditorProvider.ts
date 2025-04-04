// src/providers/DiagramEditorProvider.ts (updated with YAML support)
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DiagramModel } from '../models/aws/DiagramModel';
import { AwsComponentRegistry } from '../models/aws/ComponentRegistry';
import * as yaml from 'js-yaml';
import { SourceFileInfo } from '../models/aws/DiagramModel';

export class DiagramEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = 'extension-test.diagramEditor';

  constructor(private readonly context: vscode.ExtensionContext) {
    // Initialize the AWS component registry
    AwsComponentRegistry.initialize();
  }

  /**
   * Register the custom editor provider
   */
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new DiagramEditorProvider(context);
    
    // Register the provider
    const registrations = [
      vscode.window.registerCustomEditorProvider(
        DiagramEditorProvider.viewType,
        provider,
        {
          webviewOptions: {
            retainContextWhenHidden: true,
          },
          supportsMultipleEditorsPerDocument: false,
        }
      ),
      
      // Register the command to create a new diagram
      vscode.commands.registerCommand('extension-test.createDiagram', async () => {
        try {
          // Create a new untitled file with .diagram extension
          const untitledUri = vscode.Uri.parse('untitled:new-diagram.diagram');
          
          // Create and open the document
          const document = await vscode.workspace.openTextDocument(untitledUri);
          
          // Open with our custom editor
          await vscode.commands.executeCommand(
            'vscode.openWith',
            document.uri,
            DiagramEditorProvider.viewType
          );
        } catch (error) {
          console.error('Error creating diagram:', error);
          vscode.window.showErrorMessage(`Error creating diagram: ${error}`);
        }
      }),
    ];

    return vscode.Disposable.from(...registrations);
  }

  /**
   * Resolve the custom editor for a given text document
   */
  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Set up the webview
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'out'),
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        vscode.Uri.joinPath(this.context.extensionUri, 'editor-ui/build')
      ]
    };

          // Initialize the document if it's empty
    if (document.getText() === '') {
      // Create an empty diagram model
      const diagramName = path.basename(document.uri.fsPath, '.diagram');
      const diagram = new DiagramModel(diagramName || 'New Diagram');
      
      // Check if there's source file information available
      const sourceFilesInfo = this.context.workspaceState.get('diagramSourceFiles') as SourceFileInfo | undefined;
      if (sourceFilesInfo && sourceFilesInfo.rootFolder && sourceFilesInfo.files) {
        console.log("Setting source files:", sourceFilesInfo);
        diagram.setSourceFiles(sourceFilesInfo.rootFolder, sourceFilesInfo.files);
        // Clear the stored info after using it
        this.context.workspaceState.update('diagramSourceFiles', undefined);
      }
      
      const edit = new vscode.WorkspaceEdit();
      edit.insert(
        document.uri, 
        new vscode.Position(0, 0), 
        JSON.stringify(diagram.toJSON(), null, 2)
      );
      
      // Apply the edit
      await vscode.workspace.applyEdit(edit);
    }

    // Set the webview content
    webviewPanel.webview.html = await this._getEditorContent(webviewPanel.webview);

    // Handle text document changes
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        // Pass the updated content to the webview
        webviewPanel.webview.postMessage({
          type: 'update',
          content: document.getText()
        });
      }
    });

    // Clean up on panel close
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    // Initial update of the webview with the document contents
    webviewPanel.webview.postMessage({
      type: 'update',
      content: document.getText()
    });

    // Handle messages from the webview
    webviewPanel.webview.onDidReceiveMessage(
      async message => {
        switch (message.type) {
          case 'requestDiagram':
            // Send the current diagram data to the webview
            webviewPanel.webview.postMessage({
              type: 'update',
              content: document.getText()
            });
            return;
            
          case 'exportYaml':
            // Handle YAML export
            await this._handleYamlExport(message.content, message.name);
            return;
        }
      }
    );
  }

  /**
   * Handle exporting the diagram to YAML
   */
  private async _handleYamlExport(yamlContent: string, diagramName: string): Promise<void> {
    try {
      // Get workspace root folder to use as default save location
      let defaultUri: vscode.Uri | undefined;
      
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        // Use the first workspace folder as the project root
        const rootFolder = vscode.workspace.workspaceFolders[0];
        defaultUri = vscode.Uri.joinPath(rootFolder.uri, `${diagramName}.yaml`);
      } else {
        // Fallback to a simple filename if no workspace is open
        defaultUri = vscode.Uri.file(`${diagramName}.yaml`);
      }
      
      // Let the user choose where to save the file, starting from the project root
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: {
          'YAML files': ['yaml', 'yml'],
          'All files': ['*']
        },
        saveLabel: 'Export as YAML',
        title: 'Export Diagram as YAML'
      });
      
      if (saveUri) {
        // Write the file
        fs.writeFileSync(saveUri.fsPath, yamlContent);
        
        // Show success message
        vscode.window.showInformationMessage(`Diagram exported successfully to ${saveUri.fsPath}`);
        
        // Open the file
        const document = await vscode.workspace.openTextDocument(saveUri);
        await vscode.window.showTextDocument(document);
      }
    } catch (error) {
      console.error('Error exporting diagram to YAML:', error);
      vscode.window.showErrorMessage(`Error exporting diagram to YAML: ${error}`);
    }
  }

  /**
   * Get the HTML content for the editor
   */
  private async _getEditorContent(webview: vscode.Webview): Promise<string> {
    // Path to the editor UI build
    const editorDistPath = vscode.Uri.joinPath(this.context.extensionUri, 'editor-ui/build');
    
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
}