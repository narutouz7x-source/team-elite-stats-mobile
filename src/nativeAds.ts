import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize
} from '@capacitor-community/admob';

const APP_BANNER_AD_UNIT_ID = 'ca-app-pub-5805327525053497/6015603724';
const GOOGLE_TEST_BANNER_AD_UNIT_ID = 'ca-app-pub-3940256099942544/9214589741';

let initialized = false;
let consentAllowsAds = false;
let preparingAds: Promise<boolean> | null = null;
let showingBanner: Promise<void> | null = null;

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
        console.warn('[AdMob] Consent currently does not allow ad requests.');
        return false;
      }

      console.info('[AdMob] Initializing native SDK.');
      await AdMob.initialize();
      initialized = true;
      console.info('[AdMob] SDK initialized successfully.');
      return true;
    } catch (error) {
      console.error('[AdMob] Consent/initialization failed:', error);
      // Do not cache failure: a later Home visit can retry.
      initialized = false;
      consentAllowsAds = false;
      return false;
    } finally {
      preparingAds = null;
    }
  })();

  return preparingAds;
}

export async function showHomeBanner(): Promise<void> {
  if (showingBanner) return showingBanner;

  showingBanner = (async () => {
    if (!(await prepareAdMob())) return;

    const useLiveAds = import.meta.env.VITE_ADMOB_LIVE_ADS === 'true';
    const adId = useLiveAds ? APP_BANNER_AD_UNIT_ID : GOOGLE_TEST_BANNER_AD_UNIT_ID;

    try {
      console.info('[AdMob] Requesting Home banner:', {
        mode: useLiveAds ? 'live' : 'Google test',
        adId,
        size: 'ADAPTIVE_BANNER',
        position: 'BOTTOM_CENTER'
      });
      await AdMob.showBanner({
        adId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        // The native banner overlays the WebView. Keep it above the app navigation.
        margin: 72,
        isTesting: !useLiveAds
      });
      console.info('[AdMob] showBanner call completed.');
    } catch (error) {
      console.error('[AdMob] Home banner request failed:', error);
      // Allow a later Home visit to retry instead of getting stuck.
    }
  })();

  try {
    await showingBanner;
  } finally {
    showingBanner = null;
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
