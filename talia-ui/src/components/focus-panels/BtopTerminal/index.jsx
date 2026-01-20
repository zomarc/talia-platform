/**
 * Btop Terminal Component
 * Displays btop system monitor via SSH connection to staging server
 */

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { getThemeForMode } from '../../../themes/modeThemes';

const BtopTerminal = ({ theme: propTheme, mode = 'data' }) => {
  const terminalRef = useRef(null);
  const terminalInstanceRef = useRef(null);
  const fitAddonRef = useRef(null);
  const eventSourceRef = useRef(null);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const theme = propTheme || getThemeForMode(mode);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize terminal
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: 'monospace',
      theme: {
        background: theme.colors.bgSolid || '#151528',
        foreground: theme.colors.foreground || '#e8e8f0',
        cursor: theme.colors.accent || '#5b9bd5',
        selection: theme.colors.selected || 'rgba(91, 155, 213, 0.15)',
      },
      rows: 30,
      cols: 120,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();
    
    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Connect to SSE endpoint for btop output
    const sseUrl = '/api/btop/stream';
    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      terminal.writeln('\r\n\x1b[32m✓ Connected to staging server...\x1b[0m');
      terminal.writeln('\x1b[33mStarting btop...\x1b[0m\r\n');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'output') {
          // Write terminal output (btop uses ANSI codes)
          terminal.write(data.data);
        } else if (data.type === 'error') {
          terminal.write(`\r\n\x1b[31mError: ${data.message}\x1b[0m\r\n`);
          setError(data.message);
        } else if (data.type === 'closed') {
          terminal.write('\r\n\x1b[33mConnection closed.\x1b[0m\r\n');
          eventSource.close();
          setIsConnected(false);
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      if (eventSource.readyState === EventSource.CLOSED) {
        setError('Connection to staging server lost');
        setIsConnected(false);
        terminal.write('\r\n\x1b[31mConnection error. Retrying...\x1b[0m\r\n');
      }
    };

    eventSourceRef.current = eventSource;

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        // Send resize to backend
        if (eventSourceRef.current && isConnected) {
          const dims = terminalInstanceRef.current;
          // We'll add resize handling if needed
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.dispose();
      }
    };
  }, [theme, isConnected]);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: theme.colors.bgSolid || '#151528',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        background: theme.colors.glass || 'rgba(255, 255, 255, 0.08)',
        borderBottom: `1px solid ${theme.colors.glassBorder || 'rgba(255, 255, 255, 0.15)'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🖥️</span>
          <span style={{ fontWeight: '600' }}>System Monitor (btop)</span>
          {isConnected && (
            <span style={{ 
              fontSize: '9px', 
              color: theme.colors.accent || '#5b9bd5',
              marginLeft: '8px'
            }}>
              ● Connected
            </span>
          )}
        </div>
        {error && (
          <span style={{ fontSize: '10px', color: '#ff6b6b' }}>
            ⚠️ {error}
          </span>
        )}
      </div>

      {/* Terminal container */}
      <div 
        ref={terminalRef} 
        style={{
          flex: 1,
          width: '100%',
          padding: '8px',
          overflow: 'hidden',
        }}
      />
    </div>
  );
};

export default BtopTerminal;
