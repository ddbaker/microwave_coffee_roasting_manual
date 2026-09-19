import { defineConfig } from 'astro/config';
import { mkdir, copyFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { productionOrigin } from './src/lib/search.mjs';

// Copy only referenced images and explicitly allowed templates, never the repository.
export default defineConfig({
  site: productionOrigin,
  output: 'static',
  trailingSlash: 'always',
  integrations: [{
    name: 'manual-assets',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const { imageNames, templateNames } = await import('./src/lib/manual.mjs');
        await mkdir(new URL('docs/', dir), { recursive: true });
        for (const name of templateNames) {
          await copyFile(join('docs', name), new URL(`docs/${name}`, dir));
        }
        await mkdir(new URL('images/', dir), { recursive: true });
        for (const name of imageNames) {
          await copyFile(join('images', name), new URL(`images/${encodeURIComponent(name)}`, dir));
        }
        await copyFile('LICENSE', new URL('LICENSE.txt', dir));
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(async (req, res, next) => {
          const pathname = decodeURIComponent((req.url || '').split('?')[0]);
          const { imageNames, templateNames } = await import('./src/lib/manual.mjs');
          const name = pathname.slice('/images/'.length);
          const allowedImage = pathname.startsWith('/images/') && imageNames.includes(name);
          const template = pathname.slice('/docs/'.length);
          const allowedTemplate = pathname.startsWith('/docs/') && templateNames.includes(template);
          if (!allowedImage && !allowedTemplate && pathname !== '/LICENSE.txt') return next();
          try {
            const data = await readFile(allowedImage ? join('images', name) : allowedTemplate ? join('docs', template) : 'LICENSE');
            res.setHeader('Content-Type', allowedImage ? (name.endsWith('.png') ? 'image/png' : 'image/jpeg') : allowedTemplate ? (template.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.oasis.opendocument.spreadsheet') : 'text/plain; charset=utf-8');
            res.end(data);
          } catch (error) { next(error); }
        });
      }
    }
  }]
});
