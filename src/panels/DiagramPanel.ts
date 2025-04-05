import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DiagramModel } from '../models/aws/DiagramModel';

/**
 * Opens a diagram editor in a webview panel
 * @param context Extension context
 * @param initialData Optional initial data for the diagram
 * @returns The created webview panel
 */
export function openDiagramPanel(context: vscode.ExtensionContext, initialData?: any): vscode.WebviewPanel {
  // Create panel
  const panel = vscode.window.createWebviewPanel(
    'extension-test.diagramPanel', 
    'AWS Diagram Editor',
    vscode.ViewColumn.One,
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
  getEditorContent(context, panel.webview)
    .then(html => {
      panel.webview.html = html;
      
      // Prepare the diagram data
      let diagramData: string;
      
      try {
        // Handle different types of input data
        if (!initialData) {
          // Create a default diagram
          const diagram = new DiagramModel('New Diagram');
          diagramData = JSON.stringify(diagram.toJSON(), null, 2);
        } else if (initialData.source && typeof initialData.source === 'string') {
          // Create diagram from source file
          const diagramName = path.basename(initialData.source, '.tf');
          const diagram = new DiagramModel(diagramName);
          diagram.terraformSource = initialData.source;
          diagramData = JSON.stringify(diagram.toJSON(), null, 2);
        } else if (typeof initialData === 'string') {
          // Use raw string data
          diagramData = initialData;
        } else {
          // Convert object to string
          diagramData = JSON.stringify(initialData, null, 2);
        }
        
        // Send the data to the webview
        panel.webview.postMessage({
          type: 'update',
          content: diagramData
        });
      } catch (error) {
        console.error('Error preparing diagram data:', error);
        
        // Fallback to empty diagram
        const diagram = new DiagramModel('New Diagram');
        panel.webview.postMessage({
          type: 'update',
          content: JSON.stringify(diagram.toJSON(), null, 2)
        });
      }
    })
    .catch(error => {
      console.error('Error setting up diagram panel:', error);
      panel.webview.html = `<html><body><h2>Error</h2><p>${error.message}</p></body></html>`;
    });

  // Handle messages from the webview
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
          break;
      }
    }
  );

  return panel;
}

/**
 * Get the HTML content for the diagram editor
 */
async function getEditorContent(context: vscode.ExtensionContext, webview: vscode.Webview): Promise<string> {
  // Path to the editor UI build
  const editorDistPath = vscode.Uri.joinPath(context.extensionUri, 'editor-ui/build');
  
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