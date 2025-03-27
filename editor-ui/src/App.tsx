import React, { useEffect, useState } from 'react';
import './App.css';
import DiagramEditor from './components/diagram/DiagramEditor';
import { DiagramData } from './types/aws';

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
  const [diagram, setDiagram] = useState<DiagramData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Try to get cached state first
    try {
      const savedState = vscode.getState();
      if (savedState && savedState.diagram) {
        setDiagram(savedState.diagram);
      }
    } catch (err) {
      console.log('No saved state found');
    }

    // Listen for messages from the extension
    const messageListener = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.type) {
        case 'update':
          try {
            // Parse the diagram from the content
            const diagramData = JSON.parse(message.content);
            setDiagram(diagramData);
            
            // Save to state
            vscode.setState({ diagram: diagramData });
            
            // Clear any errors
            setError(null);
          } catch (error) {
            console.error('Error parsing diagram data:', error);
            setError('Failed to parse diagram data. See console for details.');
          }
          break;
          
        case 'error':
          setError(message.message || 'An unknown error occurred');
          break;
      }
    };

    window.addEventListener('message', messageListener);
    
    // Request the current diagram data
    vscode.postMessage({ type: 'requestDiagram' });
    
    // Clean up
    return () => {
      window.removeEventListener('message', messageListener);
    };
  }, []);

  // Handle diagram save
  const handleSaveDiagram = (updatedDiagram: DiagramData) => {
    // Save to state
    vscode.setState({ diagram: updatedDiagram });
    
    // Send the updated diagram back to the extension
    vscode.postMessage({
      type: 'update',
      content: JSON.stringify(updatedDiagram, null, 2)
    });
  };

  if (error) {
    return (
      <div className="error-container" style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        padding: '20px',
        color: '#d9534f',
        textAlign: 'center'
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="#d9534f" strokeWidth="2" />
          <path d="M8 8L16 16M8 16L16 8" stroke="#d9534f" strokeWidth="2" />
        </svg>
        <h2 style={{ marginTop: '15px' }}>Error</h2>
        <p>{error}</p>
        <button
          onClick={() => vscode.postMessage({ type: 'requestDiagram' })}
          style={{
            marginTop: '15px',
            padding: '8px 16px',
            backgroundColor: '#0078d4',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Reload Diagram
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      {diagram ? (
        <DiagramEditor
          initialDiagram={diagram}
          onSave={handleSaveDiagram}
        />
      ) : (
        <div className="editor-container">
          <div className="placeholder-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="loading-spinner" style={{ 
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #0078d4',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              animation: 'spin 2s linear infinite',
              marginBottom: '15px'
            }} />
            Loading diagram...
          </div>
        </div>
      )}
    </div>
  );
}

export default App;