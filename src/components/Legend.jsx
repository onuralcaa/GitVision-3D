import React, { useState } from 'react'
import { getLegendItemsForFiles } from '../utils/fileTypeColors'

export default function Legend({ repoData }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const items = getLegendItemsForFiles(repoData?.files)

  if (!repoData || items.length === 0) {
    return null
  }

  return (
    <div className={`legend ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <button 
        className="legend-toggle" 
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? 'Göstergeyi kapat' : 'Göstergeyi aç'}
      >
        <span className="legend-icon">🏷️</span>
      </button>
      
      {isExpanded && (
        <div className="legend-content">
          <h4>File Types</h4>
          <div className="legend-items">
            {items.map(item => (
              <div key={item.category} className="legend-item">
                <div 
                  className="legend-color"
                  style={{ backgroundColor: item.color }}
                  title={item.category}
                />
                <div className="legend-label">
                  <div className="legend-category">{item.category}</div>
                  <div className="legend-extensions">{item.extensions}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
