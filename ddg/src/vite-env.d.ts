/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set in `.env.production` when deploying to a subpath (e.g. GitHub Pages). Must match Vite `base`. */
  readonly VITE_BASE_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
