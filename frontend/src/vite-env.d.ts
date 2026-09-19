/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_DEMO_KEY_GOV?: string;
  readonly VITE_DEMO_KEY_UNI?: string;
  readonly VITE_DEMO_KEY_BANK?: string;
  readonly VITE_DEMO_KEY_EMP?: string;
  readonly VITE_DEMO_KEY_VERIFIER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
