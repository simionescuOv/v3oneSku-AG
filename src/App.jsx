import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/shell/AppShell'
import HomePage from './pages/HomePage'
import AccountPage from './pages/AccountPage'
import CatalogPage from './pages/CatalogPage'
import CategoryPage from './pages/CategoryPage'
import ProductPage from './pages/ProductPage'
import StockHubPage from './pages/StockHubPage'
import SpacePage from './pages/SpacePage'
import StorefrontPage from './pages/StorefrontPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'
import CartPage from './pages/CartPage'
import { useCatalogStore } from './store/useCatalogStore'
import { useAuthStore } from './store/useAuthStore'
import { useStockStore } from './store/useStockStore'

function RequireAuth({ children }) {
  const user = useAuthStore((s) => s.user)
  const initialized = useAuthStore((s) => s.initialized)

  if (!initialized) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const init = useAuthStore((s) => s.init)
  const user = useAuthStore((s) => s.user)
  const tenantId = useAuthStore((s) => s.tenantId)
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog)
  const fetchSpaces = useStockStore((s) => s.fetchSpaces)

  useEffect(() => {
    init()
  }, [init])

  // Supabase e sursa unică de adevăr — cache-ul local se populează o singură
  // dată după ce sesiunea + tenantul sunt cunoscute; mutațiile ulterioare îl
  // reîmprospătează.
  useEffect(() => {
    if (user && tenantId) {
      fetchCatalog()
      fetchSpaces()
    }
  }, [user, tenantId, fetchCatalog, fetchSpaces])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="account"    element={<AccountPage />} />
          <Route path="catalog"    element={<CatalogPage />} />
          <Route path="catalog/category/:categoryId" element={<CategoryPage />} />
          <Route path="catalog/product/:nameId" element={<ProductPage />} />
          <Route path="stockhub"   element={<StockHubPage />} />
          <Route path="stockhub/space/:spaceId" element={<SpacePage />} />
          <Route path="storefront" element={<StorefrontPage />} />
          <Route path="dashboard"  element={<DashboardPage />} />
          <Route path="settings"   element={<SettingsPage />} />
          <Route path="cart"       element={<CartPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
