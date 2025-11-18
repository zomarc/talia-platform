/**
 * Test Page for New Architecture Components
 * Access at: http://localhost:5173/test
 * 
 * This page demonstrates the new architecture patterns:
 * - Separated concerns (Container/Presenter)
 * - Custom hooks for data fetching
 * - Shared components (Loading, Error)
 * - Service layer
 */

import React, { useState } from 'react';
import { useSailingData } from '../hooks/data/useSailingData';
import SailingTableContainer from './focus-panels/SailingTable';
import { LoadingSpinner, ErrorMessage, EventMonitor } from './shared';

const TestPage = () => {
  // State for filters
  const [limit, setLimit] = useState(100);
  const [filters, setFilters] = useState({ limit: 100 });
  const [sailCode, setSailCode] = useState('');
  const [shipName, setShipName] = useState('');
  const [isFixedWidth, setIsFixedWidth] = useState(true);
  const [showRawData, setShowRawData] = useState(false);

  // Use the new hook
  const { 
    data: sailingData, 
    loading, 
    error, 
    refetch 
  } = useSailingData(filters);

  // Theme for components
  const theme = {
    colors: {
      background: '#ffffff',
      foreground: '#2b2b2b',
      sidebar: '#f7f3ee',
      sidebarBorder: '#e8dfd0',
      sidebarHeader: '#f5efe6',
      accent: '#b08d57',
    }
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setFilters(prev => ({ ...prev, limit: newLimit }));
  };

  const handleApplyFilters = () => {
    const newFilters = {
      limit: limit,
      ...(sailCode && { sail_code: sailCode }),
      ...(shipName && { ship_name: shipName }),
    };
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setSailCode('');
    setShipName('');
    setFilters({ limit: limit });
  };

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <div style={{
        maxWidth: isFixedWidth ? '1400px' : '100%',
        margin: isFixedWidth ? '0 auto' : '0'
      }}>
        {/* Header */}
        <div style={{
          background: 'white',
          padding: '24px',
          borderRadius: '8px',
          marginBottom: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ margin: '0 0 8px 0', color: '#2b2b2b' }}>
            🧪 New Architecture Test Page
          </h1>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
            Testing the refactored components with separated concerns and custom hooks
          </p>
        </div>

        {/* Configuration Section with Event Monitor Side-by-Side */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '20px',
          marginBottom: '20px'
        }}>
          {/* Left: Configuration */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
              Configuration
            </h3>
          
          {/* Width Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
            padding: '12px',
            background: '#f5f5f5',
            borderRadius: '4px'
          }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#666' }}>
              Layout Width:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setIsFixedWidth(true)}
                style={{
                  padding: '6px 12px',
                  background: isFixedWidth ? '#b08d57' : '#e0e0e0',
                  color: isFixedWidth ? 'white' : '#333',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500'
                }}
              >
                Fixed (1400px)
              </button>
              <button
                onClick={() => setIsFixedWidth(false)}
                style={{
                  padding: '6px 12px',
                  background: !isFixedWidth ? '#b08d57' : '#e0e0e0',
                  color: !isFixedWidth ? 'white' : '#333',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500'
                }}
              >
                Max Width (100%)
              </button>
            </div>
          </div>

          <h3 style={{ margin: '16px 0', fontSize: '14px', fontWeight: '600', color: '#666' }}>
            Data Filters
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                color: '#666',
                marginBottom: '4px',
                fontWeight: '500'
              }}>
                Sail Code
              </label>
              <input
                type="text"
                value={sailCode}
                onChange={(e) => setSailCode(e.target.value)}
                placeholder="Filter by sail code..."
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                color: '#666',
                marginBottom: '4px',
                fontWeight: '500'
              }}>
                Ship Name
              </label>
              <input
                type="text"
                value={shipName}
                onChange={(e) => setShipName(e.target.value)}
                placeholder="Filter by ship name..."
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                color: '#666',
                marginBottom: '4px',
                fontWeight: '500'
              }}>
                Limit
              </label>
              <input
                type="number"
                value={limit}
                onChange={(e) => handleLimitChange(parseInt(e.target.value) || 100)}
                min="10"
                max="1000"
                step="10"
                placeholder="Number of records..."
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleApplyFilters}
              style={{
                padding: '10px 20px',
                background: '#b08d57',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Apply Filters
            </button>
            <button
              onClick={handleClearFilters}
              style={{
                padding: '10px 20px',
                background: '#e0e0e0',
                color: '#333',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Clear
            </button>
            <button
              onClick={refetch}
              style={{
                padding: '10px 20px',
                background: '#e0e0e0',
                color: '#333',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ↻ Refresh Data
            </button>
          </div>
          </div>

          {/* Right: Compact Event Monitor */}
          <div>
            <EventMonitor />
          </div>
        </div>

        {/* Raw Data Button */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <div></div>
          <button
            onClick={() => setShowRawData(!showRawData)}
            style={{
              padding: '8px 16px',
              background: '#e0e0e0',
              color: '#333',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            {showRawData ? '▼ Hide' : '▶ Show'} Raw Data
          </button>
        </div>

        {/* Raw Data Preview - Collapsible */}
        {showRawData && (
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
              Raw Data (for debugging)
            </h3>

            {loading && (
              <LoadingSpinner 
                size="small" 
                message="Loading sailing data..." 
              />
            )}
            
            {error && (
              <ErrorMessage 
                error={error} 
                title="Error loading data"
                onRetry={refetch}
              />
            )}
            
            {!loading && !error && sailingData && (
              <div style={{ fontSize: '13px' }}>
                <p style={{ color: '#666', marginBottom: '8px' }}>
                  Records loaded: <strong>{sailingData.length}</strong>
                </p>
                <pre style={{
                  background: '#f5f5f5',
                  padding: '16px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '300px',
                  fontSize: '12px'
                }}>
                  {JSON.stringify(sailingData.slice(0, 5), null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Sailing Table Component */}
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
            New SailingTable Component
          </h3>
          
          <div style={{ 
            height: '600px',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            {!loading && !error && (
              <SailingTableContainer 
                filters={filters}
                theme={theme}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPage;

