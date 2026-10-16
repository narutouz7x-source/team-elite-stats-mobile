import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize
} from '@capacitor-community/admob';

const APP_BANNER_AD_UNIT_ID = 'ca-app-pub-5805327525053497/6015603724';
const GOOGLE_TEST_BANNER_AD_UNIT_ID = 'ca-app-pub-3940256099942544/9214589741';
const APP_INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-5805327525053497/2893213990';
const GOOGLE_TEST_INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-3940256099942544/1033173712';

let initialized = false;
let consentAllowsAds = false;
let preparingAds: Promise<boolean> | null = null;
let showingBanner: Promise<void> | null = null;
let interstitialPrepared = false;
let preparingInterstitial: Promise<boolean> | null = null;
let interstitialShowing = false;

async function prepareAdMob(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.info('[AdMob] Skipping banner: not running on a native platform.');
    return false;
  }

  if (initialized) return consentAllowsAds;
  if (preparingAds) return preparingAds;

  preparingAds = (async () => {
    const useLiveAds = import.meta.env.VITE_ADMOB_LIVE_ADS === 'true';

    try {
      console.info('[AdMob] Requesting consent information.');
      let consent = await AdMob.requestConsentInfo();
      console.info('[AdMob] Consent response:', {
        status: consent.status,
        formAvailable: consent.isConsentFormAvailable,
        canRequestAds: consent.canRequestAds,
        mode: useLiveAds ? 'live' : 'Google test'
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
      if (!consentAllowsAds && useLiveAds) {
        console.warn('[AdMob] Live ads blocked because consent does not currently allow ad requests.');
        preparingAds = null;
        return false;
      }

      if (!consentAllowsAds && !useLiveAds) {
        console.warn('[AdMob] Consent did not allow requests; continuing with Google test ads only.');
      }
    } catch (error) {
      if (useLiveAds) {
        console.error('[AdMob] Consent failed; live ads will remain blocked:', error);
        initialized = false;
        consentAllowsAds = false;
        preparingAds = null;
        return false;
      }
      console.warn('[AdMob] Consent check failed; continuing with Google test ads only:', error);
    }

    try {
      console.info('[AdMob] Initializing native SDK.');
      await AdMob.initialize();
      initialized = true;
      consentAllowsAds = !useLiveAds || consentAllowsAds;
      console.info('[AdMob] SDK initialized successfully.');
      return consentAllowsAds;
    } catch (error) {
      console.error('[AdMob] Native SDK initialization failed:', error);
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
        margin: 0,
        isTesting: !useLiveAds
      });
      console.info('[AdMob] showBanner call completed.');
    } catch (error) {
      console.error('[AdMob] Home banner request failed:', error);
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


/**
 * Preload an interstitial at a suitable point before it may be shown.
 * Test builds always use Google's official test unit. Live ads require the
 * existing explicit live-ads flag and a positive consent result.
 */
export async function prepareHomeInterstitial(): Promise<boolean> {
  if (!(await prepareAdMob())) return false;
  if (interstitialPrepared) return true;
  if (preparingInterstitial) return preparingInterstitial;

  preparingInterstitial = (async () => {
    const useLiveAds = import.meta.env.VITE_ADMOB_LIVE_ADS === 'true';
    const adId = useLiveAds ? APP_INTERSTITIAL_AD_UNIT_ID : GOOGLE_TEST_INTERSTITIAL_AD_UNIT_ID;
    try {
      console.info('[AdMob] Preparing interstitial:', {
        mode: useLiveAds ? 'live' : 'Google test',
        adId
      });
      await AdMob.prepareInterstitial({ adId, isTesting: !useLiveAds });
      interstitialPrepared = true;
      console.info('[AdMob] Interstitial prepared.');
      return true;
    } catch (error) {
      interstitialPrepared = false;
      console.error('[AdMob] Interstitial preparation failed:', error);
      return false;
    } finally {
      preparingInterstitial = null;
    }
  })();

  return preparingInterstitial;
}

/**
 * Show only from a deliberate, natural transition chosen by the app.
 * This function does not automatically interrupt app startup or gameplay.
 */
export async function showHomeInterstitial(): Promise<boolean> {
  if (interstitialShowing) return false;
  if (!interstitialPrepared && !(await prepareHomeInterstitial())) return false;
  try {
    interstitialShowing = true;
    await AdMob.showInterstitial();
    console.info('[AdMob] Interstitial show requested.');
    interstitialPrepared = false;
    return true;
  } catch (error) {
    console.error('[AdMob] Interstitial failed to show:', error);
    interstitialPrepared = false;
    return false;
  } finally {
    interstitialShowing = false;
  }
}


const APP_REWARDED_AD_UNIT_ID = 'ca-app-pub-5805327525053497/4600213185';
const GOOGLE_TEST_REWARDED_AD_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917';

let rewardedPrepared = false;
let preparingRewarded: Promise<boolean> | null = null;
let rewardedShowing = false;

export async function prepareRewardedTestAd(): Promise<boolean> {
  if (!(await prepareAdMob())) return false;
  if (rewardedPrepared) return true;
  if (preparingRewarded) return preparingRewarded;

  preparingRewarded = (async () => {
    const useLiveAds = import.meta.env.VITE_ADMOB_LIVE_ADS === 'true';
    const adId = useLiveAds ? APP_REWARDED_AD_UNIT_ID : GOOGLE_TEST_REWARDED_AD_UNIT_ID;
    try {
      console.info('[AdMob] Preparing rewarded ad:', { mode: useLiveAds ? 'live' : 'Google test', adId });
      await AdMob.prepareRewardVideoAd({ adId, isTesting: !useLiveAds });
      rewardedPrepared = true;
      console.info('[AdMob] Rewarded ad prepared.');
      return true;
    } catch (error) {
      rewardedPrepared = false;
      console.error('[AdMob] Rewarded ad preparation failed:', error);
      return false;
    } finally {
      preparingRewarded = null;
    }
  })();
  return preparingRewarded;
}

export async function showRewardedTestAd(): Promise<boolean> {
  if (rewardedShowing) return false;
  if (!rewardedPrepared && !(await prepareRewardedTestAd())) return false;
  try {
    rewardedShowing = true;
    await AdMob.showRewardVideoAd();
    rewardedPrepared = false;
    console.info('[AdMob] Rewarded ad closed/show requested; no in-app reward is granted.');
    return true;
  } catch (error) {
    rewardedPrepared = false;
    console.error('[AdMob] Rewarded ad failed to show:', error);
    return false;
  } finally {
    rewardedShowing = false;
  }
}
