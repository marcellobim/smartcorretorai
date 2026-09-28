import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { AuthProvider } from './lib/auth-context'
import AnalyticsProvider from './components/analytics/AnalyticsProvider'
import { LocaleProvider } from './i18n/LocaleProvider'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AnalyticsProvider>
        <LocaleProvider>
          <AuthProvider>
            <App />
            <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1f2937',
              color: '#f9fafb',
              fontSize: '14px',
              borderRadius: '10px',
            },
            success: { iconTheme: { primary: '#6270f3', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
            />
          </AuthProvider>
        </LocaleProvider>
      </AnalyticsProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
