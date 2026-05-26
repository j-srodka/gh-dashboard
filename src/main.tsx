import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountProvider } from './contexts/AccountContext';
import App from './App';
import './index.css';

// Register service worker for desktop notification click handling.

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchInterval: 60_000,
      retry: 2,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AccountProvider>
          <App />
        </AccountProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
