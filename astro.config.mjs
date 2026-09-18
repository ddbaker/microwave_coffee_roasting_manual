import { defineConfig } from 'astro/config';
import { mkdir, copyFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { productionOrigin } from './src/lib/search.mjs';

// Copy only images referenced by the published manuscripts, never the repository.
export default defineConfig({
  site: productionOrigin,
  output: 'static',
  trailingSlash: 'always',
  integrations: [{
    name: 'manual-assets',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const { imageNames } = await import('./src/lib/manual.mjs');
        await mkdir(new URL('images/', dir), { recursive: true });
        for (const name of imageNames) {
          await copyFile(join('images', name), new URL(`images/${encodeURIComponent(name)}`, dir));
        }
        await copyFile('LICENSE', new URL('LICENSE.txt', dir));
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(async (req, res, next) => {
          const pathname = decodeURIComponent((req.url || '').split('?')[0]);
          const { imageNames } = await import('./src/lib/manual.mjs');
          const name = pathname.slice('/images/'.length);
          const allowedImage = pathname.startsWith('/images/') && imageNames.includes(name);
          if (!allowedImage && pathname !== '/LICENSE.txt') return next();
          try {
            const data = await readFile(allowedImage ? join('images', name) : 'LICENSE');
            res.setHeader('Content-Type', allowedImage ? (name.endsWith('.png') ? 'image/png' : 'image/jpeg') : 'text/plain; charset=utf-8');
            res.end(data);
          } catch (error) { next(error); }
        });
      }
    }
  }]
});
