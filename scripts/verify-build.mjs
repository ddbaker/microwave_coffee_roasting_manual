import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { chapters, home, route, imageNames } from '../src/lib/manual.mjs';
import { productionOrigin, googleVerification } from '../src/lib/search.mjs';

const root = path.resolve('dist');
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : path.join(dir, entry.name)))).flat();
}
const files = await walk(root);
const htmlFiles = files.filter(file => file.endsWith('.html'));
assert.equal(htmlFiles.length, 17, 'Expected 12 chapters, 2 home pages, 2 dashboards, and 404');
const expectedPages = new Set(['index.html', 'ja/index.html', '404.html', 'roasting/index.html', 'ja/roasting/index.html', ...['en', 'ja'].flatMap(lang => chapters.map(ch => `${lang}/${ch.key}/index.html`))]);
for (const file of files) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  assert(expectedPages.has(relative) || ['LICENSE.txt', '_routes.json', '_headers', 'robots.txt', 'sitemap.xml'].includes(relative) || /^_astro\/[\w.-]+\.(css|js)$/.test(relative) || imageNames.some(name => relative === `images/${name}`), `Unexpected published file: ${relative}`);
  assert((await stat(file)).size < 25 * 1024 * 1024, `Asset exceeds Pages limit: ${relative}`);
}
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const isDashboard = /[\\/]roasting[\\/]index\.html$/.test(file);
  assert(isDashboard || !/<script\b/i.test(html), `Client JavaScript in a manual page: ${file}`);
  assert.equal([...html.matchAll(/<h1(?:\s|>)/g)].length, 1, `Expected one h1: ${file}`);
  assert(!html.includes('\uFFFD'), `Replacement character in ${file}`);
  for (const tag of html.matchAll(/<img\b[^>]*>/g)) assert(/alt="[^"]+"/.test(tag[0]), `Missing alt: ${file}`);
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = new URL(match[1].replaceAll('&amp;', '&'), 'https://manual.invalid/' + path.relative(root, file).replaceAll('\\', '/'));
    if (!['https://manual.invalid', productionOrigin].includes(url.origin)) continue;
    let destination = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (url.pathname.endsWith('/')) destination = path.join(destination, 'index.html');
    assert(destination.startsWith(root + path.sep), `Link escaped dist: ${url}`);
    assert((await stat(destination)).isFile(), `Broken link: ${match[1]} in ${file}`);
    if (url.hash) {
      const target = await readFile(destination, 'utf8');
      assert(target.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `Broken anchor: ${match[1]}`);
    }
  }
}
const sitemap = await readFile(path.join(root,'sitemap.xml'),'utf8');
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const expectedLocations = [...expectedPages].filter(p => p !== '404.html').map(p => productionOrigin + '/' + p.replace(/index\.html$/, ''));
assert.deepEqual(locations.toSorted(), expectedLocations.toSorted(), 'Sitemap must include each public page exactly once');
assert((await readFile(path.join(root,'robots.txt'),'utf8')).includes(`Sitemap: ${productionOrigin}/sitemap.xml`));
for (const relative of expectedPages) {
  const html = await readFile(path.join(root,relative),'utf8');
  assert(html.includes(`name="google-site-verification" content="${googleVerification}"`), 'Missing Google ownership tag');
  if (relative === '404.html') { assert(html.includes('name="robots" content="noindex"')); continue; }
  assert(html.includes(`rel="canonical" href="${productionOrigin}/${relative.replace(/index\.html$/, '')}"`), `Incorrect canonical: ${relative}`);
  assert(!/name="robots"[^>]*noindex/.test(html), `Public page is noindex: ${relative}`);
  assert(html.includes(`hreflang="en" href="${productionOrigin}/`), 'Language metadata must use absolute production URLs');
}
for (const lang of ['en', 'ja']) {
  const other = lang === 'ja' ? 'en' : 'ja';
  for (const chapter of [null, ...chapters]) {
    const url = chapter ? route(lang, chapter.key) : home(lang);
    const html = await readFile(path.join(root, url, 'index.html'), 'utf8');
    assert(html.includes(`<html lang="${lang}">`), `Incorrect language: ${url}`);
    const alternate = chapter ? route(other, chapter.key) : home(other);
    assert(html.includes(`href="${alternate}" lang="${other}" hreflang="${other}"`), `Missing matching language link: ${url}`);
  }
}
assert.equal((await readdir(path.join(root, 'images'))).length, imageNames.length);
for (const [page, alternate, lang] of [['roasting','/ja/roasting/','ja'],['ja/roasting','/roasting/','en']]) {
  const html = await readFile(path.join(root,page,'index.html'),'utf8');
  assert(html.includes(`href="${alternate}" lang="${lang}" hreflang="${lang}"`));
  assert(/<script\b[^>]+src=/.test(html), 'Dashboard needs its client script');
}
console.log(`Verified: ${htmlFiles.length} HTML pages, ${imageNames.length} images, all links and language links, JavaScript limited to dashboards, publication allowlist and file limits.`);
