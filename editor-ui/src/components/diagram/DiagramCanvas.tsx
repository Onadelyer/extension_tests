import React, { useState, useRef, useEffect } from 'react';
import { AwsComponentData, Position, Size, DiagramData } from '../../types/aws';
import { getAwsIconByType } from '../../assets/aws-icons';
import { v4 as uuidv4 } from 'uuid'; // You'll need to add this package

interface DiagramCanvasProps {
  diagram: DiagramData;
  activeTool: string;
  onComponentSelect?: (component: AwsComponentData | null) => void;
  onToolFinished?: () => void;
  onDiagramChange?: (updatedDiagram: DiagramData) => void;
}

const DiagramCanvas: React.FC<DiagramCanvasProps> = ({
  diagram,
  activeTool,
  onComponentSelect,
  onToolFinished,
  onDiagramChange
}) => {
  const [selectedComponent, setSelectedComponent] = useState<AwsComponentData | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [draggedPosition, setDraggedPosition] = useState<Position | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [ghostComponent, setGhostComponent] = useState<{type: string, position: Position} | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const gridSize = 20; // Size of grid for snapping

  // Snap a position to the grid
  const snapToGrid = (position: Position): Position => {
    if (!showGrid) return position;
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: Math.round(position.y / gridSize) * gridSize
    };
  };
  
  // Handle component selection
  const handleComponentClick = (component: AwsComponentData, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (isDragging) {
      return; // Don't select if we're just finishing a drag
    }
    
    setSelectedComponent(component);
    if (onComponentSelect) {
      onComponentSelect(component);
    }
  };
  
  // Start dragging a component
  const handleComponentDragStart = (component: AwsComponentData, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Calculate offset from the mouse position to the component origin
    if (canvasRef.current) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const canvasRect = canvasRef.current.getBoundingClientRect();
      setDragOffset({
        x: event.clientX - rect.left + canvasRef.current.scrollLeft,
        y: event.clientY - rect.top + canvasRef.current.scrollTop
      });
    }
    
    setIsDragging(true);
    setSelectedComponent(component);
    if (onComponentSelect) {
      onComponentSelect(component);
    }
  };
  
  // Handle mouse move for dragging
  const handleMouseMove = (event: React.MouseEvent) => {
    if (isDragging && selectedComponent && canvasRef.current) {
      // Calculate new position
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - canvasRect.left + canvasRef.current.scrollLeft - dragOffset.x;
      const y = event.clientY - canvasRect.top + canvasRef.current.scrollTop - dragOffset.y;
      
      const snappedPosition = snapToGrid({ x, y });
      setDraggedPosition(snappedPosition);
    } else if (activeTool !== 'select' && canvasRef.current) {
      // Show ghost component when using placement tool
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - canvasRect.left + canvasRef.current.scrollLeft;
      const y = event.clientY - canvasRect.top + canvasRef.current.scrollTop;
      
      const snappedPosition = snapToGrid({ x, y });
      setGhostComponent({ type: activeTool, position: snappedPosition });
    } else {
      setGhostComponent(null);
    }
  };
  
  // Handle mouse up to end dragging
  const handleMouseUp = () => {
    if (isDragging && selectedComponent && draggedPosition && onDiagramChange) {
      // Update the component position in the diagram
      const updatedDiagram = { ...diagram };
      
      if (selectedComponent.id === updatedDiagram.region.id) {
        // Update region position
        updatedDiagram.region = {
          ...updatedDiagram.region,
          position: draggedPosition
        };
      } else {
        // Update child component position
        const updatedChildren = updatedDiagram.region.children.map(child => 
          child.id === selectedComponent.id 
            ? { ...child, position: draggedPosition } 
            : child
        );
        
        updatedDiagram.region.children = updatedChildren;
      }
      
      onDiagramChange(updatedDiagram);
    }
    
    setIsDragging(false);
    setDraggedPosition(null);
  };
  
  // Handle canvas click (deselect)
  const handleCanvasClick = (event: React.MouseEvent) => {
    if (activeTool !== 'select' && canvasRef.current) {
      // Create a new component
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - canvasRect.left + canvasRef.current.scrollLeft;
      const y = event.clientY - canvasRect.top + canvasRef.current.scrollTop;
      
      createNewComponent(activeTool, snapToGrid({ x, y }));
      
      // Return to select tool after placing a component
      if (onToolFinished) {
        onToolFinished();
      }
    } else {
      // Just deselect when using select tool
      setSelectedComponent(null);
      if (onComponentSelect) {
        onComponentSelect(null);
      }
    }
  };
  
  // Handle drag over for external components
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    
    if (canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - canvasRect.left + canvasRef.current.scrollLeft;
      const y = event.clientY - canvasRect.top + canvasRef.current.scrollTop;
      
      const snappedPosition = snapToGrid({ x, y });
      setGhostComponent({ 
        type: event.dataTransfer.getData('componentType') || activeTool, 
        position: snappedPosition 
      });
    }
  };
  
  // Handle drop for external components
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    
    const componentType = event.dataTransfer.getData('componentType');
    if (componentType && canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - canvasRect.left + canvasRef.current.scrollLeft;
      const y = event.clientY - canvasRect.top + canvasRef.current.scrollTop;
      
      createNewComponent(componentType, snapToGrid({ x, y }));
    }
    
    setGhostComponent(null);
  };
  
  // Handle drag leave
  const handleDragLeave = () => {
    setGhostComponent(null);
  };
  
  // Create a new component
  const createNewComponent = (componentType: string, position: Position) => {
    if (!onDiagramChange) return;
    
    const updatedDiagram = { ...diagram };
    
    // Create a new component with default properties
    const newComponent: AwsComponentData = {
      id: uuidv4(),
      name: `New ${componentType.replace('Component', '')}`,
      type: componentType,
      position: position,
      size: { width: 100, height: 80 },
      properties: {},
    };
    
    // Add component-specific properties based on type
    switch (componentType) {
      case 'VpcComponent':
        newComponent.cidrBlock = '10.0.0.0/16';
        break;
      case 'SubnetComponent':
        newComponent.cidrBlock = '10.0.1.0/24';
        newComponent.availabilityZone = updatedDiagram.region.availabilityZones[0];
        newComponent.isPublic = false;
        break;
      case 'EC2InstanceComponent':
        newComponent.instanceType = 't2.micro';
        newComponent.ami = 'ami-12345';
        break;
      // Add properties for other component types as needed
    }
    
    // Add component to the diagram
    updatedDiagram.region.children.push(newComponent);
    
    onDiagramChange(updatedDiagram);
    
    // Select the new component
    setSelectedComponent(newComponent);
    if (onComponentSelect) {
      onComponentSelect(newComponent);
    }
  };
  
  // Render a grid pattern for the background
  const renderGrid = () => {
    if (!showGrid) return null;
    
    const gridPattern = [];
    const width = canvasRef.current?.clientWidth || 2000;
    const height = canvasRef.current?.clientHeight || 2000;
    
    // Horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      gridPattern.push(
        <line 
          key={`h-${y}`} 
          x1={0} 
          y1={y} 
          x2={width} 
          y2={y} 
          stroke="#ddd" 
          strokeWidth="1" 
        />
      );
    }
    
    // Vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      gridPattern.push(
        <line 
          key={`v-${x}`} 
          x1={x} 
          y1={0} 
          x2={x} 
          y2={height} 
          stroke="#ddd" 
          strokeWidth="1" 
        />
      );
    }
    
    return (
      <svg 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%',
          pointerEvents: 'none'
        }}
      >
        {gridPattern}
      </svg>
    );
  };
  
  // Render a component
  const renderComponent = (component: AwsComponentData, isDragged: boolean = false) => {
    const isSelected = selectedComponent?.id === component.id;
    const position = isDragged && draggedPosition ? draggedPosition : component.position;
    
    return (
      <div
        key={component.id}
        className={`diagram-component ${component.type} ${isSelected ? 'selected' : ''}`}
        style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${component.size.width}px`,
          height: `${component.size.height}px`,
          border: '1px solid #ccc',
          backgroundColor: isSelected ? 'rgba(0, 120, 212, 0.1)' : 'rgba(255, 255, 255, 0.7)',
          borderColor: isSelected ? '#0078d4' : '#ccc',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: isDragging && isSelected ? 'grabbing' : 'pointer',
          zIndex: isSelected ? 100 : 1,
          boxShadow: isSelected ? '0 0 0 2px #0078d4' : '0 1px 3px rgba(0,0,0,0.12)',
          borderRadius: '4px',
          userSelect: 'none'
        }}
        onClick={(e) => handleComponentClick(component, e)}
        onMouseDown={(e) => handleComponentDragStart(component, e)}
      >
        <div className="component-icon" style={{ marginBottom: '5px' }}>
          {getAwsIconByType(component.type, { size: 24 })}
        </div>
        <div className="component-name" style={{ fontSize: '12px', fontWeight: 'bold' }}>
          {component.name}
        </div>
      </div>
    );
  };
  
  // Render ghost component during drag or placement
  const renderGhostComponent = () => {
    if (!ghostComponent) return null;
    
    return (
      <div
        className="ghost-component"
        style={{
          position: 'absolute',
          left: `${ghostComponent.position.x}px`,
          top: `${ghostComponent.position.y}px`,
          width: '100px',
          height: '80px',
          border: '1px dashed #0078d4',
          backgroundColor: 'rgba(0, 120, 212, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 200,
          borderRadius: '4px'
        }}
      >
        <div className="component-icon" style={{ marginBottom: '5px', opacity: 0.7 }}>
          {getAwsIconByType(ghostComponent.type, { size: 24 })}
        </div>
        <div className="component-name" style={{ fontSize: '12px' }}>
          {ghostComponent.type.replace('Component', '')}
        </div>
      </div>
    );
  };
  
  // Render all components in the region
  const renderRegionComponents = (regionData: AwsComponentData) => {
    return (
      <>
        {renderComponent(regionData, regionData.id === selectedComponent?.id && isDragging)}
        {regionData.children?.map((child: AwsComponentData) => 
          renderComponent(child, child.id === selectedComponent?.id && isDragging)
        )}
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
        backgroundColor: '#f8f9fa',
        border: '1px solid #ddd',
        overflow: 'auto'
      }}
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      {renderGrid()}
      {renderRegionComponents(diagram.region)}
      {ghostComponent && renderGhostComponent()}
      
      <div className="canvas-controls" style={{ 
        position: 'absolute', 
        right: '10px', 
        top: '10px',
        display: 'flex',
        gap: '5px',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        padding: '5px',
        borderRadius: '4px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <button 
          onClick={() => setShowGrid(!showGrid)}
          style={{
            background: 'none',
            border: '1px solid #ccc',
            borderRadius: '3px',
            padding: '5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px'
          }}
          title={showGrid ? 'Hide Grid' : 'Show Grid'}
        >
          {showGrid ? '□ Grid' : '■ Grid'}
        </button>
      </div>
    </div>
  );
};

export default DiagramCanvas;