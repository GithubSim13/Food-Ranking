import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import HomePage from './components/home/HomePage'
import EntryList from './components/entries/EntryList'
import EntryForm from './components/entries/EntryForm'
import EntryDetail from './components/entries/EntryDetail'
import EntryModal from './components/entries/EntryModal'
import RankingsPage from './components/rankings/RankingsPage'
import CategoriesPage from './components/categories/CategoriesPage'
import RestaurantsPage from './components/restaurants/RestaurantsPage'
import AnalyticsPage from './components/analytics/AnalyticsPage'
import QuickRatePage from './components/rate/QuickRatePage'
import NotFoundPage from './components/NotFoundPage'

export default function App() {
  const location = useLocation()
  const background = (location.state as { background?: Location } | null)?.background

  return (
    <>
      <Routes location={background ?? location}>
        <Route path="/" element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="entries" element={<EntryList />} />
          <Route path="entries/new" element={<EntryForm />} />
          <Route path="entries/:id" element={<EntryDetail />} />
          <Route path="starred" element={<Navigate to="/entries" replace />} />
          <Route path="rankings" element={<RankingsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="restaurants" element={<RestaurantsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="rate" element={<QuickRatePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      {background && (
        <Routes>
          <Route path="/entries/:id" element={<EntryModal />} />
        </Routes>
      )}
    </>
  )
}
