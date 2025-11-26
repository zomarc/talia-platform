/**
 * Performance Tracking Hook
 * Tracks component mount, render times, and re-render counts
 */

import { useEffect, useRef, useState } from 'react';

/**
 * Hook to track component performance
 * @param {string} componentName - Name of the component being tracked
 * @returns {Object} Performance data and methods
 */
export const usePerformanceTracking = (componentName) => {
  const mountTimeRef = useRef(null);
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(null);
  const [performanceData, setPerformanceData] = useState({
    mountTime: null,
    renderCount: 0,
    lastRenderTime: null,
    avgRenderTime: null,
    renderTimes: []
  });

  // Track mount time
  useEffect(() => {
    mountTimeRef.current = performance.now();
    renderCountRef.current = 1;
    lastRenderTimeRef.current = performance.now();

    setPerformanceData({
      mountTime: mountTimeRef.current,
      renderCount: 1,
      lastRenderTime: null,
      avgRenderTime: null,
      renderTimes: []
    });

    return () => {
      // Component unmounting
      mountTimeRef.current = null;
    };
  }, []);

  // Track render times using refs only (no state updates to avoid infinite loops)
  useEffect(() => {
    const now = performance.now();
    renderCountRef.current += 1;
    lastRenderTimeRef.current = now;
    
    // Only update state periodically or when explicitly needed, not on every render
    // This prevents infinite re-render loops
  });

  return {
    componentName,
    mountTime: performanceData.mountTime,
    renderCount: renderCountRef.current,
    lastRenderTime: performanceData.lastRenderTime,
    avgRenderTime: performanceData.avgRenderTime,
    totalMountTime: mountTimeRef.current 
      ? Math.round((performance.now() - mountTimeRef.current) * 100) / 100 
      : null
  };
};

/**
 * Hook to track memory usage (if available)
 */
export const useMemoryTracking = () => {
  const [memoryData, setMemoryData] = useState(null);

  useEffect(() => {
    const updateMemory = () => {
      if (performance.memory) {
        setMemoryData({
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        });
      }
    };

    updateMemory();
    const interval = setInterval(updateMemory, 1000);

    return () => clearInterval(interval);
  }, []);

  return memoryData;
};

/**
 * Format bytes to human readable
 */
export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export default usePerformanceTracking;

