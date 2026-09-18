import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.teamelite.stats',
  appName: 'Team Elite Stats',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      style: 'DARK',
      overlaysWebView: false
    }
  }
};

export default config;
