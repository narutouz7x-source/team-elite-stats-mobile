import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.teamelite.stats',
  appName: 'Team Elite Stats',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    StatusBar: {
      style: 'DARK',
      overlaysWebView: false
    }
  }
};

export default config;
