// editor-ui/src/components/diagram/DiagramCanvas.tsx
import React, { useState, useRef, useEffect } from 'react';
import { AwsComponentData, Position, Size, DiagramData } from '../../types/aws';

interface DiagramCanvasProps {
  diagram: DiagramData;
  activeTool: string;
  onComponentSelect?: (component: AwsComponentData | null) => void;
  onToolFinished?: () => void;
}

const DiagramCanvas: React.FC<DiagramCanvasProps> = ({
  diagram,
  activeTool,
  onComponentSelect,
  onToolFinished
}) => {
  const [selectedComponent, setSelectedComponent] = useState<AwsComponentData | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Handle component selection
  const handleComponentClick = (component: AwsComponentData, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedComponent(component);
    if (onComponentSelect) {
      onComponentSelect(component);
    }
  };
  
  // Handle canvas click (deselect)
  const handleCanvasClick = () => {
    setSelectedComponent(null);
    if (onComponentSelect) {
      onComponentSelect(null);
    }
  };
  
  // Render a component
  const renderComponent = (component: AwsComponentData) => {
    const isSelected = selectedComponent?.id === component.id;
    
    return (
      <div
        key={component.id}
        className={`diagram-component ${component.type} ${isSelected ? 'selected' : ''}`}
        style={{
          position: 'absolute',
          left: `${component.position.x}px`,
          top: `${component.position.y}px`,
          width: `${component.size.width}px`,
          height: `${component.size.height}px`,
          border: '1px solid #ccc',
          backgroundColor: isSelected ? 'rgba(0, 120, 212, 0.1)' : 'rgba(255, 255, 255, 0.7)',
          borderColor: isSelected ? '#0078d4' : '#ccc',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer',
          zIndex: isSelected ? 100 : 1
        }}
        onClick={(e) => handleComponentClick(component, e)}
      >
        <div className="component-type">{component.type}</div>
        <div className="component-name">{component.name}</div>
      </div>
    );
  };
  
  // Render all components in the region
  const renderRegionComponents = (regionData: AwsComponentData) => {
    return (
      <>
        {renderComponent(regionData)}
        {regionData.children?.map((child: AwsComponentData) => renderComponent(child))}
      </>
    );
  };
  
  return (
    <div 
      ref={canvasRef}
      className="diagram-canvas"
      style={{
        position: 'relative',
        width: '100%',
        height: '600px',
        backgroundColor: '#f5f5f5',
        border: '1px solid #ddd',
        overflow: 'auto'
      }}
      onClick={handleCanvasClick}
    >
      {renderRegionComponents(diagram.region)}
    </div>
  );
};

export default DiagramCanvas;