import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from '@/App';
import { purgeSampleClientData } from '@/lib/clientDataPurge';
import { initMetaPixel, isMetaTrackablePath } from '@/lib/metaPixel';
import '@/index.css';

purgeSampleClientData();
if (isMetaTrackablePath(window.location.pathname)) {
  initMetaPixel(
    import.meta.env.VITE_META_PIXEL_ID || '',
    import.meta.env.VITE_META_BROWSER_PIXEL_ENABLED !== 'false',
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  </React.StrictMode>
);
