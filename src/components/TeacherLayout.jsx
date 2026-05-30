import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { ThemeToggle } from './ThemeToggle'
import { LanguageToggle } from './LanguageToggle'
import Logo from './Logo'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CircleCheck,
  FileText,
  CreditCard,
  History,
  Mail,
  LogOut,
  Menu,
  X
} from 'lucide-react'

const TeacherLayout = ({ children }) => {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const getInitials = (name) => {
    if (!name) return 'JS'
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }

  const navItems = [
    { labelKey: 'teacher.sidebar.overview', path: '/teacher/dashboard', icon: LayoutDashboard },
    { labelKey: 'teacher.sidebar.students', path: '/teacher/students', icon: Users },
    { labelKey: 'teacher.sidebar.classes', path: '/teacher/classes', icon: BookOpen },
    { labelKey: 'teacher.sidebar.checkIn', path: '/teacher/check-in', icon: CircleCheck },
  ]

  const reportItems = [
    { labelKey: 'teacher.sidebar.attendance', path: '/teacher/attendance-report', icon: FileText },
    { labelKey: 'teacher.sidebar.lowCredits', path: '/teacher/low-credits-report', icon: CreditCard },
    { labelKey: 'teacher.sidebar.creditHistory', path: '/teacher/credit-history-report', icon: History },
    { labelKey: 'teacher.sidebar.emails', path: '/teacher/email-notifications', icon: Mail },
  ]

  const isActive = (path) => location.pathname === path

  const renderNavLinks = (items) => {
    return items.map((item) => {
      const Icon = item.icon
      const active = isActive(item.path)
      return (
        <Link
          key={item.path}
          to={item.path}
          onClick={() => setMobileMenuOpen(false)}
          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[14px] font-medium transition-all duration-120 ${
            active
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span>{t(item.labelKey)}</span>
        </Link>
      )
    })
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-card py-6 px-4 border-r border-border md:w-[248px] w-full shrink-0">
      {/* Brand row */}
      <div className="flex items-center gap-3 px-2 pb-6 border-b border-border/50 mb-4">
        <Logo className="h-[38px] w-[38px] rounded-xl object-contain" />
        <span className="text-[17px] font-extrabold tracking-tight text-foreground">
          Josi <span className="text-primary font-extrabold">Pilates</span>
        </span>
      </div>

      {/* Main navigation */}
      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
        {renderNavLinks(navItems)}

        {/* Reports group */}
        <div className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase px-3 pt-6 pb-2">
          {t('teacher.sidebar.reports')}
        </div>
        {renderNavLinks(reportItems)}
      </nav>

      {/* Footer / User section */}
      <div className="flex flex-col gap-4 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-muted-foreground font-medium">{t('teacher.sidebar.controls')}</span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>
        <div className="flex items-center gap-3 px-2 py-3 bg-muted/30 rounded-2xl border border-border/20">
          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
            {getInitials(profile?.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-foreground truncate">
              {profile?.full_name || 'Professora'}
            </div>
            <div className="text-[11.5px] text-muted-foreground font-medium">
              {t('teacher.sidebar.teacher')}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
            title={t('teacher.sidebar.signOut')}
          >
            <LogOut className="h-4.5 w-4.5" />
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background">
      {/* Mobile Header Bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border shrink-0 z-40 sticky top-0">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8 object-contain" />
          <span className="text-base font-extrabold tracking-tight">
            Josi <span className="text-primary">Pilates</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-foreground hover:bg-accent rounded-xl h-9 w-9"
          >
            {mobileMenuOpen ? <X className="h-5.5 w-5.5" /> : <Menu className="h-5.5 w-5.5" />}
          </Button>
        </div>
      </header>

      {/* Desktop Sidebar container */}
      <aside className="hidden md:flex flex-col h-screen sticky top-0 shrink-0 w-[248px]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer content */}
          <aside className="relative flex flex-col w-[280px] max-w-[80vw] h-full bg-card z-40 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 bg-muted/10 px-4 md:px-8 py-6 md:py-8 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto animate-in fade-in duration-300">
          {children}
        </div>
      </main>
    </div>
  )
}

export default TeacherLayout
