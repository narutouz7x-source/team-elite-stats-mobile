/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ADMOB_LIVE_ADS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
