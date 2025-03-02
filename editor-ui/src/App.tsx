import React, { useEffect, useState } from 'react';
import './App.css';

// Declare the VS Code API which is available in the webview
declare global {
  interface Window {
    acquireVsCodeApi: () => {
      postMessage: (message: any) => void;
      setState: (state: any) => void;
      getState: () => any;
    };
  }
}

// Get VS Code API
const vscode = window.acquireVsCodeApi();

function App() {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    // Listen for messages from the extension
    const messageListener = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.type) {
        case 'update':
          // Update the content when the extension sends changes
          setContent(message.content);
          break;
      }
    };

    window.addEventListener('message', messageListener);
    
    // Clean up
    return () => {
      window.removeEventListener('message', messageListener);
    };
  }, []);

  return (
    <div className="editor-container">
      <div className="placeholder-text">Placeholder</div>
    </div>
  );
}

export default App;