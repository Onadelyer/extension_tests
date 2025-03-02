import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class DiagramEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = 'extension-test.diagramEditor';

  constructor(private readonly context: vscode.ExtensionContext) {}

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
      const edit = new vscode.WorkspaceEdit();
      edit.insert(document.uri, new vscode.Position(0, 0), JSON.stringify({
        type: 'diagram',
        elements: []
      }, null, 2));
      
      // Apply the edit
      await vscode.workspace.applyEdit(edit);
    }

    // Set the webview content
    webviewPanel.webview.html = await this._getEditorContent(webviewPanel.webview);

    // Handle text document changes
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        // Pass the updated content to the webview if needed
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

    // Handle messages from the webview
    webviewPanel.webview.onDidReceiveMessage(
      async message => {
        switch (message.type) {
          case 'update':
            // Update the document when the webview sends changes
            if (message.content) {
              const edit = new vscode.WorkspaceEdit();
              edit.replace(
                document.uri,
                new vscode.Range(0, 0, document.lineCount, 0),
                message.content
              );
              
              await vscode.workspace.applyEdit(edit);
            }
            return;
        }
      }
    );
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
        <title>Diagram Editor</title>
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