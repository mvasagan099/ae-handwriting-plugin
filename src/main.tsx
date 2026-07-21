import React from 'react';
import ReactDOM from 'react-dom/client';
import { PluginPanel } from './components/PluginPanel';
import './styles/panel.css';

// Load CEP host scripts if inside After Effects
if (typeof window !== 'undefined' && (window as any).CSInterface) {
  const cs = new (window as any).CSInterface();
  const ext = cs.getSystemPath('extension');
  (window as any).__evalScript = (script: string, cb?: (r: string) => void) =>
    cs.evalScript(script, cb);

  // Pre-load the handwriting ExtendScript
  cs.evalScript(`$.evalFile("${ext}/host/jsx/handwriting.jsx")`);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PluginPanel />
  </React.StrictMode>,
);