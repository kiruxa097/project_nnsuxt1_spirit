import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import LaunchPage from './pages/LaunchPage'
import NotFoundPage from './pages/NotFoundPage'
import ProcessesPage from './pages/ProcessesPage'
import ResultsPage from './pages/ResultsPage'
import { orchestratorRoutes } from './front2/routes'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="processes" element={<ProcessesPage />} />
          <Route path="processes/:processId/launch" element={<LaunchPage />} />
          <Route path="results" element={<ResultsPage />} />
          {orchestratorRoutes}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}