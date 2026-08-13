import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import CurriculumPage from './pages/CurriculumPage.jsx'
import NameGate from './components/NameGate.jsx'
import { UserProvider } from './context/UserProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <UserProvider>
        <NameGate>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/curriculum" element={<CurriculumPage />} />
          </Routes>
        </NameGate>
      </UserProvider>
    </BrowserRouter>
  </StrictMode>,
)
