import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
// Mobile responsive fixes — import AFTER index.css (App.jsx imports index.css)
import './styles/mobile.css';

// StrictMode is NOT used — it double-fires effects and breaks YouTubePlayer
createRoot(document.getElementById('root')).render(
  <ErrorBoundary showDetails={import.meta.env.DEV}>
    <App />
  </ErrorBoundary>
);
