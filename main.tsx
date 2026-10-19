import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './overrides.css';
import './landing-theme.css';
import './workspace-theme.css';
import './cloud-theme.css';
import './refresh.css';
import './landing-clean.css';
import { LanguageProvider } from './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider><App /></LanguageProvider>
  </React.StrictMode>,
);
