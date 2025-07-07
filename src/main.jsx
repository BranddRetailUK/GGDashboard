import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { TagProvider } from './context/TagContext';

console.log("🟢 React app booting");

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <TagProvider>
        <App />
      </TagProvider>
    </HashRouter>
  </React.StrictMode>
);