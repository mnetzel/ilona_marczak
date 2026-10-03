import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://mnetzel.github.io',
  base: '/ilona_marczak',
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: false }
});
