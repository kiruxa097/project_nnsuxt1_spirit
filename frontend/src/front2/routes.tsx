import { Route } from 'react-router-dom'
import './orchestrator.css'
import ConflictsPage from './pages/ConflictsPage'
import HistoryPage from './pages/HistoryPage'
import LocksPage from './pages/LocksPage'
import QueuePage from './pages/QueuePage'
import RunDetailPage from './pages/RunDetailPage'


export const orchestratorRoutes = (
  <>
    <Route path="queue" element={<QueuePage />} />
    <Route path="runs/:runId" element={<RunDetailPage />} />
    <Route path="locks" element={<LocksPage />} />
    <Route path="conflicts" element={<ConflictsPage />} />
    <Route path="history" element={<HistoryPage />} />
  </>
)
