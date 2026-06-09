import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
// Responsive fixes — mobile.css first, then responsive.css for additional breakpoints
import './styles/mobile.css';
import './styles/responsive.css';

// StrictMode is NOT used — it double-fires effects and breaks YouTubePlayer
createRoot(document.getElementById('root')).render(
  <ErrorBoundary showDetails={import.meta.env.DEV}>
    <App />
  </ErrorBoundary>
);
