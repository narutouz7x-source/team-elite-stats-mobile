import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize
} from '@capacitor-community/admob';

const APP_BANNER_AD_UNIT_ID = 'ca-app-pub-5805327525053497/6015603724';
// This is Google's anchored adaptive banner test unit. The fixed-size test unit
// can return a format that doesn't match ADAPTIVE_BANNER.
const GOOGLE_TEST_BANNER_AD_UNIT_ID = 'ca-app-pub-3940256099942544/9214589741';

let initialized = false;
let consentAllowsAds = false;
let preparingAds: Promise<boolean> | null = null;

async function prepareAdMob(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.info('[AdMob] Skipping banner: not running on a native platform.');
    return false;
  }

  if (initialized) return consentAllowsAds;
  if (preparingAds) return preparingAds;

  preparingAds = (async () => {
    try {
      console.info('[AdMob] Requesting consent information.');
      let consent = await AdMob.requestConsentInfo();
      console.info('[AdMob] Consent response:', {
        status: consent.status,
        formAvailable: consent.isConsentFormAvailable,
        canRequestAds: consent.canRequestAds
      });

      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
        console.info('[AdMob] Showing required consent form.');
        consent = await AdMob.showConsentForm();
        console.info('[AdMob] Consent form result:', {
          status: consent.status,
          canRequestAds: consent.canRequestAds
        });
      }

      consentAllowsAds = Boolean(consent.canRequestAds);
      if (!consentAllowsAds) {
        console.warn('[AdMob] Banner not requested because consent does not currently allow ad requests.');
        return false;
      }

      console.info('[AdMob] Initializing native SDK.');
      await AdMob.initialize();
      initialized = true;
      console.info('[AdMob] SDK initialized successfully.');
      return true;
    } catch (error) {
      console.error('[AdMob] Initialization/consent failed:', error);
      return false;
    } finally {
      preparingAds = null;
    }
  })();

  return preparingAds;
}

export async function showHomeBanner(): Promise<void> {
  if (!(await prepareAdMob())) return;

  const useLiveAds = import.meta.env.VITE_ADMOB_LIVE_ADS === 'true';
  const adId = useLiveAds ? APP_BANNER_AD_UNIT_ID : GOOGLE_TEST_BANNER_AD_UNIT_ID;

  try {
    console.info('[AdMob] Requesting home banner:', {
      mode: useLiveAds ? 'live' : 'Google test',
      adId,
      size: 'ADAPTIVE_BANNER',
      position: 'BOTTOM_CENTER',
      margin: 72
    });
    await AdMob.showBanner({
      adId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      // Keep the native banner above the app's bottom navigation.
      margin: 72,
      isTesting: !useLiveAds
    });
    console.info('[AdMob] showBanner call completed.');
  } catch (error) {
    console.error('[AdMob] Home banner could not be shown:', error);
  }
}

export async function hideHomeBanner(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !initialized) return;
  try {
    await AdMob.hideBanner();
    console.info('[AdMob] Home banner hidden.');
  } catch (error) {
    console.warn('[AdMob] Home banner could not be hidden:', error);
  }
}
