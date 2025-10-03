import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PrivacyPolicy = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">{t('privacyPolicy.title')}</CardTitle>
            <p className="text-center text-muted-foreground">Studio Josi Pilates</p>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <p className="text-sm text-muted-foreground mb-6">
              {t('privacyPolicy.lastUpdated')}: {new Date().toLocaleDateString()}
            </p>

            <h2>{t('privacyPolicy.introduction.title')}</h2>
            <p>{t('privacyPolicy.introduction.content')}</p>

            <h2>{t('privacyPolicy.dataCollection.title')}</h2>
            <h3>{t('privacyPolicy.dataCollection.providedInfo.title')}</h3>
            <ul>
              {t('privacyPolicy.dataCollection.providedInfo.items', { returnObjects: true }).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <h3>{t('privacyPolicy.dataCollection.autoCollected.title')}</h3>
            <ul>
              {t('privacyPolicy.dataCollection.autoCollected.items', { returnObjects: true }).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <h3>{t('privacyPolicy.dataCollection.thirdParty.title')}</h3>
            <ul>
              {t('privacyPolicy.dataCollection.thirdParty.items', { returnObjects: true }).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <h2>{t('privacyPolicy.dataUsage.title')}</h2>
            <p>{t('privacyPolicy.dataUsage.content')}</p>
            <ul>
              {t('privacyPolicy.dataUsage.items', { returnObjects: true }).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <h2>{t('privacyPolicy.dataSharing.title')}</h2>
            <p>{t('privacyPolicy.dataSharing.content')}</p>
            <ul>
              {t('privacyPolicy.dataSharing.items', { returnObjects: true }).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <h2>{t('privacyPolicy.dataSecurity.title')}</h2>
            <p>{t('privacyPolicy.dataSecurity.content')}</p>

            <h2>{t('privacyPolicy.userRights.title')}</h2>
            <p>{t('privacyPolicy.userRights.content')}</p>
            <ul>
              {t('privacyPolicy.userRights.items', { returnObjects: true }).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <h2>{t('privacyPolicy.dataRetention.title')}</h2>
            <p>{t('privacyPolicy.dataRetention.content')}</p>

            <h2>{t('privacyPolicy.childrenPrivacy.title')}</h2>
            <p>{t('privacyPolicy.childrenPrivacy.content')}</p>

            <h2>{t('privacyPolicy.internationalTransfers.title')}</h2>
            <p>{t('privacyPolicy.internationalTransfers.content')}</p>

            <h2>{t('privacyPolicy.cookies.title')}</h2>
            <p>{t('privacyPolicy.cookies.content')}</p>

            <h2>{t('privacyPolicy.policyChanges.title')}</h2>
            <p>{t('privacyPolicy.policyChanges.content')}</p>

            <h2>{t('privacyPolicy.contact.title')}</h2>
            <p>{t('privacyPolicy.contact.content')}</p>
            <ul>
              {t('privacyPolicy.contact.items', { returnObjects: true }).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <div className="mt-8 text-center">
              <Link to="/">
                <Button variant="outline">{t('privacyPolicy.backToHome')}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;