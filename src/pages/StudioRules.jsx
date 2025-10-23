import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Clock, Calendar, AlertTriangle } from 'lucide-react'
import Logo from '../components/Logo'
import { useTranslation } from 'react-i18next'

const StudioRules = () => {
  const { profile } = useAuth()
  const { t, i18n } = useTranslation()

  useEffect(() => {
    if (profile?.preferred_language) {
      i18n.changeLanguage(profile.preferred_language)
    }
  }, [profile, i18n])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/student/dashboard" className="mr-4">
                <ArrowLeft className="h-6 w-6 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white" />
              </Link>
              <Logo className="h-8 w-8 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('rules.title')}</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('rules.title')}</h2>
          <p className="text-gray-600 dark:text-gray-300">{t('rules.subtitle')}</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2 text-primary" />
                {t('rules.classDuration')}
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                {t('rules.classDurationDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  {t('rules.classDurationText')}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
                {t('rules.arrivalPolicy')}
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                {t('rules.arrivalPolicyDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                <p className="text-lg font-semibold text-orange-800 dark:text-orange-200 mb-2">
                  {t('rules.arrivalPolicyText')}
                </p>
                <p className="text-orange-700 dark:text-orange-300">
                  {t('rules.arrivalPolicyDetail')}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-red-500" />
                {t('rules.cancellationPolicy')}
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                {t('rules.cancellationPolicyDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <p className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                  {t('rules.cancellationPolicyText')}
                </p>
                <p className="text-red-700 dark:text-red-300 mb-3">
                  {t('rules.cancellationPolicyDetail')}
                </p>
                <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded border-l-4 border-red-500">
                  <p className="text-red-800 dark:text-red-200 font-medium">
                    ⚠️ {t('rules.cancellationWarning')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('rules.additionalGuidelines')}</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                {t('rules.additionalGuidelinesDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{t('rules.wearComfortableClothing')}</p>
                    <p className="text-gray-600 dark:text-gray-300">{t('rules.wearComfortableClothingDesc')}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{t('rules.stayHydrated')}</p>
                    <p className="text-gray-600 dark:text-gray-300">{t('rules.stayHydratedDesc')}</p>
                  </div>
                </div>
             </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('rules.contactInformation')}</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                {t('rules.contactInformationDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  {t('rules.contactIntro')}
                </p>
                <div className="space-y-2 text-gray-600 dark:text-gray-400">
                  <p>💬 {t('rules.whatsapp')}: +1 438 274-8396</p>
                  <p>📧 {t('rules.email')}: josi@josipilates.com</p>
                  <div className="flex items-center space-x-2">
                    <span>📍</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{t('rules.studioLocation')}:</p>
                      <p className="text-gray-600 dark:text-gray-300">10145 Avenue Hamel, Montreal, QC H2N 2X1</p>
                      <a
                        href="https://www.google.com/maps/search/?api=1&query=10145+Avenue+Hamel+Montreal+QC+H2N+2X1"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline text-sm"
                      >
                        {t('rules.viewOnGoogleMaps')}
                      </a>
                    </div>
                  </div>
                </div>
                <div className="mt-4 rounded-lg overflow-hidden border">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2795.1234567890123!2d-73.64712345678901!3d45.541234567890123!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4cc919c9c9c9c9c9%3A0x1234567890abcdef!2s10145%20Avenue%20Hamel%2C%20Montreal%2C%20QC%20H2N%202X1!5e0!3m2!1sen!2sca!4v1699999999999!5m2!1sen!2sca"
                    width="100%"
                    height="200"
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

        <div className="mt-8 text-center">
          <Link to="/student/dashboard">
            <Button>
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