import { defineConfig } from 'astro/config';

// GitHub Pages: site = user pages root, base = ten repo.
// Doi base neu deploy o repo khac.
export default defineConfig({
  site: 'https://hsonvu1912.github.io',
  base: '/kgm-asia-web',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
