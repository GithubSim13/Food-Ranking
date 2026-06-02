import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import EntryList from './components/entries/EntryList'
import EntryForm from './components/entries/EntryForm'
import EntryDetail from './components/entries/EntryDetail'
import RankingsPage from './components/rankings/RankingsPage'
import CategoriesPage from './components/categories/CategoriesPage'
import RestaurantsPage from './components/restaurants/RestaurantsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/entries" replace />} />
        <Route path="entries" element={<EntryList />} />
        <Route path="entries/new" element={<EntryForm />} />
        <Route path="entries/:id" element={<EntryDetail />} />
        <Route path="rankings" element={<RankingsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="restaurants" element={<RestaurantsPage />} />
      </Route>
    </Routes>
  )
}
