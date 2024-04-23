import { defineConfig } from 'astro/config';
import actions from '@astrojs/actions';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import db from "@astrojs/db";
import react from "@astrojs/react";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  site: 'https://example.com',
  integrations: [mdx(), sitemap(), actions(), db(), react()],
  output: "hybrid",
  adapter: node({
    mode: "standalone"
  })
});