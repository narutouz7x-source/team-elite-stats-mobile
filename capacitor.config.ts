/// <reference types="@capacitor-firebase/messaging" />
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.teamelite.stats',
  appName: 'OG ELITE STATS',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#1E2226',
      overlaysWebView: false
    },
    FirebaseMessaging: {
      presentationOptions: ['alert', 'badge', 'sound']
    }
  }
};

export default config;
