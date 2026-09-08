import { useNavigate, useLocation } from 'react-router-dom'
import { X, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { NAV_ITEMS } from '../../lib/navItems'

export default function SideMenu() {
  const open = useAppStore((s) => s.sideMenuOpen)
  const close = useAppStore((s) => s.closeSideMenu)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { t, i18n } = useTranslation()

  const handleNav = (path) => {
    navigate(path)
    close()
  }

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ro' ? 'en' : 'ro'
    i18n.changeLanguage(newLang)
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={close}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 left-0 z-50 w-max min-w-[200px] max-w-[85vw] pr-6 bg-zinc-900 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-800 shrink-0">
          <span className="text-base font-semibold text-zinc-100">oneSku</span>
          <button
            onClick={close}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_ITEMS.map(({ path, labelKey, Icon }) => {
            const active = pathname === path
            return (
              <button
                key={path}
                onClick={() => handleNav(path)}
                className={[
                  'w-full flex items-center gap-4 px-5 py-3.5 text-sm font-medium text-blue-400',
                  'transition-colors',
                  active ? 'bg-zinc-800' : 'hover:bg-zinc-800/60',
                ].join(' ')}
              >
                <Icon size={20} />
                {t(labelKey)}
              </button>
            )
          })}
        </nav>

        {/* Footer with language toggle */}
        <div className="px-5 py-4 border-t border-zinc-800 shrink-0">
          <button
            onClick={toggleLanguage}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            <Globe size={16} />
            {t('common.language')}: {i18n.language.toUpperCase()}
          </button>
        </div>
      </div>
    </>
  )
}
