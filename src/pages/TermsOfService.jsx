import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const TermsOfService = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">{t('termsOfService.title')}</CardTitle>
            <p className="text-center text-muted-foreground">Studio Josi Pilates</p>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <p className="text-sm text-muted-foreground mb-6">
              {t('termsOfService.lastUpdated')}: {new Date().toLocaleDateString()}
            </p>

            <h2>{t('termsOfService.acceptance.title')}</h2>
            <p>{t('termsOfService.acceptance.content')}</p>

            <h2>{t('termsOfService.serviceDescription.title')}</h2>
            <p>{t('termsOfService.serviceDescription.content')}</p>
            <ul>
              {t('termsOfService.serviceDescription.items', { returnObjects: true }).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <h2>{t('termsOfService.eligibility.title')}</h2>
            <p>{t('termsOfService.eligibility.content')}</p>

            <h2>{t('termsOfService.userAccounts.title')}</h2>
            <p>{t('termsOfService.userAccounts.content')}</p>

            <h2>{t('termsOfService.paymentsCredits.title')}</h2>
            <h3>{t('termsOfService.paymentsCredits.purchases.title')}</h3>
            <p>{t('termsOfService.paymentsCredits.purchases.content')}</p>

            <h3>{t('termsOfService.paymentsCredits.cancellation.title')}</h3>
            <p>{t('termsOfService.paymentsCredits.cancellation.content')}</p>

            <h3>{t('termsOfService.paymentsCredits.refunds.title')}</h3>
            <p>{t('termsOfService.paymentsCredits.refunds.content')}</p>

            <h2>{t('termsOfService.studioRules.title')}</h2>
            <p>{t('termsOfService.studioRules.content')}</p>
            <ul>
              {t('termsOfService.studioRules.items', { returnObjects: true }).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <h2>{t('termsOfService.userConduct.title')}</h2>
            <p>{t('termsOfService.userConduct.content')}</p>
            <ul>
              {t('termsOfService.userConduct.items', { returnObjects: true }).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <h2>{t('termsOfService.intellectualProperty.title')}</h2>
            <p>{t('termsOfService.intellectualProperty.content')}</p>

            <h2>{t('termsOfService.liabilityLimitation.title')}</h2>
            <p>{t('termsOfService.liabilityLimitation.content')}</p>

            <h2>{t('termsOfService.warrantyDisclaimer.title')}</h2>
            <p>{t('termsOfService.warrantyDisclaimer.content')}</p>

            <h2>{t('termsOfService.indemnification.title')}</h2>
            <p>{t('termsOfService.indemnification.content')}</p>

            <h2>{t('termsOfService.termination.title')}</h2>
            <p>{t('termsOfService.termination.content')}</p>

            <h2>{t('termsOfService.governingLaw.title')}</h2>
            <p>{t('termsOfService.governingLaw.content')}</p>

            <h2>{t('termsOfService.termsChanges.title')}</h2>
            <p>{t('termsOfService.termsChanges.content')}</p>

            <h2>{t('termsOfService.contact.title')}</h2>
            <p>{t('termsOfService.contact.content')}</p>
            <ul>
              {t('termsOfService.contact.items', { returnObjects: true }).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <div className="mt-8 text-center">
              <Link to="/">
                <Button variant="outline">{t('termsOfService.backToHome')}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TermsOfService;