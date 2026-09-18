import { chapters, home, route } from '../lib/manual.mjs';
import { absoluteUrl } from '../lib/search.mjs';

export function GET() {
  const pairs = [
    { en: home('en'), ja: home('ja') },
    ...chapters.map(ch => ({ en: route('en', ch.key), ja: route('ja', ch.key) })),
    { en: '/roasting/', ja: '/ja/roasting/' },
  ];
  const urls = pairs.flatMap(pair => ['en', 'ja'].map(lang =>
    `  <url><loc>${absoluteUrl(pair[lang])}</loc>` +
    ['en', 'ja', 'x-default'].map(alternate =>
      `<xhtml:link rel="alternate" hreflang="${alternate}" href="${absoluteUrl(pair[alternate === 'x-default' ? 'en' : alternate])}"/>`
    ).join('') + '</url>'
  ));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
