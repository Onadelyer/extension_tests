import React from 'react';
import './App.css';

// Declare the VS Code API which is available in the webview
declare global {
  interface Window {
    acquireVsCodeApi: any;
  }
}

// Get VS Code API
const vscode = window.acquireVsCodeApi();

function App() {
  const handleCreateDiagram = () => {
    // Send a message to the extension
    vscode.postMessage({
      command: 'createDiagram'
    });
  };

  return (
    <div className="app-container">
      <div className="button-container">
        <button className="create-button" onClick={handleCreateDiagram}>
          Create diagram
        </button>
      </div>
      <div className="placeholder-text">Placeholder</div>
    </div>
  );
}

export default App;