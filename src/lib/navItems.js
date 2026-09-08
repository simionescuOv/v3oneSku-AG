import { User, BookOpen, Warehouse, Store, LayoutDashboard, Settings } from 'lucide-react'

export const NAV_ITEMS = [
  { path: '/account',    labelKey: 'nav.account',    Icon: User },
  { path: '/catalog',    labelKey: 'nav.catalog',    Icon: BookOpen },
  { path: '/stockhub',   labelKey: 'nav.stockhub',   Icon: Warehouse },
  { path: '/storefront', labelKey: 'nav.storefront', Icon: Store },
  { path: '/dashboard',  labelKey: 'nav.dashboard',  Icon: LayoutDashboard },
  { path: '/settings',   labelKey: 'nav.settings',   Icon: Settings },
]
