import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'
import { loadAppearanceSettings, applyAppearanceSettings } from './lib/appearance'

// Apply appearance settings on initial load
const appearanceSettings = loadAppearanceSettings();
applyAppearanceSettings(appearanceSettings);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
