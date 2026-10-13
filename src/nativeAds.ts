import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize
} from '@capacitor-community/admob';

const APP_BANNER_AD_UNIT_ID = 'ca-app-pub-5805327525053497/6015603724';
const GOOGLE_TEST_BANNER_AD_UNIT_ID = 'ca-app-pub-3940256099942544/6300978111';

let initialized = false;
let consentAllowsAds = false;

async function prepareAdMob(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    if (!initialized) {
      let consent = await AdMob.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
        consent = await AdMob.showConsentForm();
      }

      consentAllowsAds = consent.canRequestAds;
      if (!consentAllowsAds) return false;

      await AdMob.initialize();
      initialized = true;
    }

    return consentAllowsAds;
  } catch (error) {
    // Ads must never prevent the main app from loading or navigating.
    console.warn('[AdMob] Could not prepare ads:', error);
    return false;
  }
}

export async function showHomeBanner(): Promise<void> {
  if (!(await prepareAdMob())) return;

  const useLiveAds = import.meta.env.VITE_ADMOB_LIVE_ADS === 'true';
  try {
    await AdMob.showBanner({
      adId: useLiveAds ? APP_BANNER_AD_UNIT_ID : GOOGLE_TEST_BANNER_AD_UNIT_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      // Keep the native banner above the app's bottom navigation.
      margin: 72,
      isTesting: !useLiveAds
    });
  } catch (error) {
    console.warn('[AdMob] Home banner could not be shown:', error);
  }
}

export async function hideHomeBanner(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !initialized) return;
  try {
    await AdMob.hideBanner();
  } catch (error) {
    console.warn('[AdMob] Home banner could not be hidden:', error);
  }
}
