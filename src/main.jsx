import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { applicaTema } from './lib'
import './styles.css'

applicaTema()
createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>)
