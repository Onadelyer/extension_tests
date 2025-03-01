import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "extension-test" is now active!');

  // Register the original Hello World command
  const disposable = vscode.commands.registerCommand('extension-test.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from extension_test!');
  });
  context.subscriptions.push(disposable);

  // Register the custom webview provider for the activity bar view
  const provider = new MenuViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('extension-test.menuView', provider)
  );
}

/**
 * WebviewViewProvider implementation for the activity bar menu
 */
class MenuViewProvider implements vscode.WebviewViewProvider {
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

export function deactivate() {}