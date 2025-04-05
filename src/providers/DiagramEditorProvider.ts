// src/providers/DiagramEditorProvider.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DiagramModel } from '../models/aws/DiagramModel';
import { AwsComponentRegistry } from '../models/aws/ComponentRegistry';

export class DiagramEditorProvider {
  constructor(private readonly context: vscode.ExtensionContext) {
    // Initialize the AWS component registry
    AwsComponentRegistry.initialize();
  }

  /**
   * Open a diagram in a webview panel
   */
  public static openDiagramPanel(context: vscode.ExtensionContext, initialData?: any): vscode.WebviewPanel {
    // Create panel
    const panel = vscode.window.createWebviewPanel(
      'extension-test.diagramEditor', // Identifier
      'AWS Diagram Editor',           // Title
      vscode.ViewColumn.One,          // Column to show the panel in
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'out'),
          vscode.Uri.joinPath(context.extensionUri, 'media'),
          vscode.Uri.joinPath(context.extensionUri, 'editor-ui/build')
        ]
      }
    );

    // Set webview content
    const provider = new DiagramEditorProvider(context);
    provider._getEditorContent(panel.webview)
      .then(html => {
        panel.webview.html = html;
        
        // If no initial data, create a new diagram
        if (!initialData) {
          const diagramName = 'New Diagram';
          const diagram = new DiagramModel(diagramName);
          
          panel.webview.postMessage({
            type: 'update',
            content: JSON.stringify(diagram.toJSON(), null, 2)
          });
        } else if (initialData.source && typeof initialData.source === 'string') {
          // If we have a source file path, create a diagram from it
          try {
            const diagramName = path.basename(initialData.source, '.tf');
            const diagram = new DiagramModel(diagramName);
            
            // Add source file metadata
            diagram.terraformSource = initialData.source;
            
            panel.webview.postMessage({
              type: 'update',
              content: JSON.stringify(diagram.toJSON(), null, 2)
            });
          } catch (error) {
            console.error('Error creating diagram from source:', error);
            
            // Fallback to empty diagram
            const diagram = new DiagramModel('New Diagram');
            panel.webview.postMessage({
              type: 'update',
              content: JSON.stringify(diagram.toJSON(), null, 2)
            });
          }
        } else {
          // Handle other data formats safely
          try {
            const content = typeof initialData === 'string' 
              ? initialData 
              : JSON.stringify(initialData, null, 2);
              
            panel.webview.postMessage({
              type: 'update',
              content: content
            });
          } catch (error) {
            console.error('Error processing initial data:', error);
            
            // Fallback to empty diagram
            const diagram = new DiagramModel('New Diagram');
            panel.webview.postMessage({
              type: 'update',
              content: JSON.stringify(diagram.toJSON(), null, 2)
            });
          }
        }
      })
      .catch(error => {
        console.error('Error setting up diagram panel:', error);
        panel.webview.html = `<html><body><h2>Error</h2><p>${error.message}</p></body></html>`;
      });

    // Update panel title when diagram name changes
    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.type) {
          case 'update':
            // Process diagram updates
            try {
              if (message.content) {
                const diagramData = JSON.parse(message.content);
                // Update panel title if diagram name is available
                if (diagramData.name) {
                  panel.title = `${diagramData.name} - AWS Diagram`;
                }
              }
            } catch (error) {
              console.error('Error processing diagram update:', error);
            }
            return;
            
          case 'requestDiagram':
            // In case the webview requests current data (e.g., after reload)
            // But here we don't need to do anything since the initial data is already sent
            return;
            
          case 'saveToFile':
            // Handle explicit save request from webview
            if (message.content) {
              this.saveDiagramToFile(message.content)
                .then(success => {
                  panel.webview.postMessage({
                    type: 'saveResult',
                    success
                  });
                })
                .catch(error => {
                  panel.webview.postMessage({
                    type: 'saveResult',
                    success: false,
                    error: error.message
                  });
                });
            }
            return;
        }
      }
    );

    return panel;
  }

  /**
   * Register the diagram editor related commands
   */
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const registrations = [
      // Register the command to create a new diagram
      vscode.commands.registerCommand('extension-test.createDiagram', () => {
        this.openDiagramPanel(context);
      })
    ];

    return vscode.Disposable.from(...registrations);
  }

  /**
   * Save diagram data to a file
   * @param diagramData The diagram data to save
   * @returns Promise resolving to true if save was successful
   */
  private static async saveDiagramToFile(diagramData: string): Promise<boolean> {
    try {
      // Parse the diagram data to get the name for the file
      const diagram = JSON.parse(diagramData);
      const defaultFileName = `${diagram.name || 'diagram'}.diagram`;
      
      // Show save dialog
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(defaultFileName),
        filters: {
          'Diagram Files': ['diagram'],
          'All Files': ['*']
        },
        saveLabel: 'Save Diagram'
      });
      
      if (saveUri) {
        // Write the file
        await vscode.workspace.fs.writeFile(
          saveUri,
          Buffer.from(diagramData, 'utf8')
        );
        
        vscode.window.showInformationMessage(`Diagram saved to ${saveUri.fsPath}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error saving diagram to file:', error);
      vscode.window.showErrorMessage(`Error saving diagram: ${error}`);
      return false;
    }
  }

  /**
   * Get the HTML content for the editor
   */
  async _getEditorContent(webview: vscode.Webview): Promise<string> {
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