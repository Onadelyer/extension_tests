"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class MenuViewProvider {
    extensionUri;
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
    }
    resolveWebviewView(webviewView, context, _token) {
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
    _getWebviewContent(webview) {
        // Path to the built React app
        const reactDistPath = vscode.Uri.joinPath(this.extensionUri, 'webview-ui/build');
        try {
            // Try to load the built React app if it exists
            if (fs.existsSync(path.join(reactDistPath.fsPath, 'index.html'))) {
                // Get paths to scripts and styles
                const indexHtml = fs.readFileSync(path.join(reactDistPath.fsPath, 'index.html'), 'utf8');
                // Replace paths in the HTML to use the webview resource URI scheme
                return indexHtml.replace(/(href|src)="(.*?)"/g, (_, attr, value) => {
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
                });
            }
        }
        catch (error) {
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
exports.MenuViewProvider = MenuViewProvider;
//# sourceMappingURL=MenuViewProvider.js.map