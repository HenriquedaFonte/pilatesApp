import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Clock, Calendar, AlertTriangle, LogOut, Heart } from 'lucide-react'
import Logo from '../components/Logo'
import { useTranslation } from 'react-i18next'
import { ThemeToggle } from '../components/ThemeToggle'
import { LanguageToggle } from '../components/LanguageToggle'

const StudioRules = () => {
  const { profile, signOut } = useAuth()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  // Set language based on user preference
  useEffect(() => {
    if (profile?.preferred_language) {
      i18n.changeLanguage(profile.preferred_language)
    }
  }, [profile?.preferred_language, i18n])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/student/dashboard" className="mr-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              </Link>
              <Logo className="h-9 w-9 mr-3" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Josi Pilates
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <LanguageToggle />
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                {t('common.signOut', 'Sair')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-6">
        {/* Cabeçalho Editorial */}
        <div className="flex flex-col gap-1.5">
          <h2 className="font-serif-display text-3xl tracking-tight text-foreground">
            {t('rules.title', 'Regras do Studio Josi Pilates')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('rules.subtitle', 'Por favor, leia e siga estas diretrizes importantes')}
          </p>
        </div>
        <div className="space-y-4">
          <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/10 py-3 px-5">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                {t('rules.classDuration')}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {t('rules.classDurationDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="py-4 px-5">
              <div className="bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-200 py-3 px-4 rounded-xl border border-blue-100/50 dark:border-blue-900/30">
                <p className="text-sm font-semibold">
                  {t('rules.classDurationText')}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/10 py-3 px-5">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {t('rules.arrivalPolicy')}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {t('rules.arrivalPolicyDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="py-4 px-5">
              <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 py-3 px-4 rounded-xl border border-amber-100/50 dark:border-amber-900/30 space-y-1.5">
                <p className="text-sm font-bold">
                  {t('rules.arrivalPolicyText')}
                </p>
                <p className="text-sm leading-relaxed text-amber-700 dark:text-amber-300">
                  {t('rules.arrivalPolicyDetail')}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/10 py-3 px-5">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Calendar className="h-5 w-5 text-rose-500" />
                {t('rules.cancellationPolicy')}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {t('rules.cancellationPolicyDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="py-4 px-5">
              <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-200 py-3 px-4 rounded-xl border border-rose-100/50 dark:border-rose-900/30 space-y-2.5">
                <p className="text-sm font-bold">
                  {t('rules.cancellationPolicyText')}
                </p>
                <p className="text-sm leading-relaxed text-rose-700 dark:text-rose-300">
                  {t('rules.cancellationPolicyDetail')}
                </p>
                <div className="bg-rose-100/60 dark:bg-rose-900/40 p-2.5 rounded border-l-4 border-rose-500">
                  <p className="text-rose-900 dark:text-rose-100 font-bold text-xs">
                    ⚠️ {t('rules.cancellationWarning')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/10 py-3 px-5">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                {t('rules.additionalGuidelines')}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {t('rules.additionalGuidelinesDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="py-4 px-5">
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 shrink-0"></div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{t('rules.wearComfortableClothing')}</p>
                    <p className="text-sm text-muted-foreground">{t('rules.wearComfortableClothingDesc')}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 shrink-0"></div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{t('rules.stayHydrated')}</p>
                    <p className="text-sm text-muted-foreground">{t('rules.stayHydratedDesc')}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/10 py-3 px-5">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Logo className="h-5 w-5" />
                {t('rules.contactInformation')}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {t('rules.contactInformationDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="py-4 px-5">
              <div className="bg-muted/10 py-3 px-4 rounded-xl border border-border/40 space-y-4">
                <p className="text-sm text-foreground font-medium">
                  {t('rules.contactIntro')}
                </p>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <span className="text-lg shrink-0">💬</span>
                    <span><strong>{t('rules.whatsapp')}:</strong> +1 (438) 274-8396</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-lg shrink-0">📧</span>
                    <span><strong>{t('rules.email')}:</strong> josi@josipilates.com</span>
                  </p>
                  <div className="flex items-start gap-2 pt-3 border-t border-border/40">
                    <span className="text-lg mt-0.5 shrink-0">📍</span>
                    <div className="space-y-1">
                      <p className="font-bold text-foreground text-xs">{t('rules.studioLocation')}:</p>
                      <p className="text-xs">10145 Avenue Hamel, Montreal, QC H2N 2X1</p>
                      <a
                        href="https://www.google.com/maps/search/?api=1&query=10145+Avenue+Hamel+Montreal+QC+H2N+2X1"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 underline text-xs font-bold inline-block mt-1"
                      >
                        {t('rules.viewOnGoogleMaps')}
                      </a>
                    </div>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl overflow-hidden border border-border/60 shadow-xs">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2795.1234567890123!2d-73.64712345678901!3d45.541234567890123!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4cc919c9c9c9c9c9%3A0x1234567890abcdef!2s10145%20Avenue%20Hamel%2C%20Montreal%2C%20QC%20H2N%202X1!5e0!3m2!1sen!2sca!4v1699999999999!5m2!1sen!2sca"
                    width="100%"
                    height="140"
                    style={{ border: 0 }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Josi Pilates Studio Location"
                  ></iframe>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 text-center">
          <Link to="/student/dashboard">
            <Button className="rounded-2xl shadow-xs font-semibold hover:bg-primary hover:text-primary-foreground py-1.5 h-9">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('rules.backToDashboard')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default StudioRules