import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppWithAuth from './AppWithAuth.jsx'

// Debug logging for main entry point
console.log('🚀 main.jsx loading');
console.log('📦 React StrictMode:', !!StrictMode);
console.log('🎯 Root element:', document.getElementById('root'));
console.log('🌐 Window object:', typeof window);
console.log('📱 Document ready state:', document.readyState);

const root = document.getElementById('root');
if (!root) {
  console.error('❌ Root element not found!');
} else {
  console.log('✅ Root element found, creating React app');
  try {
    const reactRoot = createRoot(root);
    console.log('✅ React root created');
    reactRoot.render(
      <StrictMode>
        <AppWithAuth />
      </StrictMode>
    );
    console.log('✅ React app rendered successfully');
  } catch (error) {
    console.error('❌ React render error:', error);
    // Fallback: render error message directly to DOM
    root.innerHTML = '<h1 style="color: red;">React Error: ' + error.message + '</h1>';
  }
}
