import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { trackKeyboardInset } from './lib/hooks';
import { registerServiceWorker } from './lib/pwa';
import './styles.css';

trackKeyboardInset();
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
