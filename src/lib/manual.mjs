import { readFileSync } from 'node:fs';
import { Marked } from 'marked';

export const chapters = [
  { key: 'equipment', file: 'items_to_prepare', en: 'Equipment & materials', ja: '準備する器具・材料', description: ['What you need before you begin.', '始める前に揃える器具と材料。'] },
  { key: 'washing', file: 'wash_green_beans', en: 'Washing & hydration', ja: '生豆の洗浄と吸水', description: ['Preparing green beans for the roast.', '焙煎に向けた生豆の下準備。'] },
  { key: 'principles', file: 'microwave_roasting_principles', en: 'Roasting principles', ja: '焙煎の基本原則', description: ['Heating, agitation, and observing the beans.', '加熱・攪拌と豆の変化を観察するために。'] },
  { key: 'practice', file: 'microwave_roasting_practice', en: 'Standard process', ja: '標準プロセス', description: ['The complete sequence, from preparation to cooling.', '準備から冷却までの一連の手順。'] },
  { key: 'ethiopia', file: 'microwave_roasting_practice_ethiopia_natural_medium', en: 'Ethiopia · natural', ja: 'エチオピア・ナチュラル', description: ['A medium-light roast case study.', '中浅煎りの実践記録。'] },
  { key: 'venezuela', file: 'microwave_roasting_practice_venezuela_washed_city', en: 'Venezuela · washed', ja: 'ベネズエラ・ウォッシュド', description: ['A medium-dark City roast case study.', '中深煎り・シティローストの実践記録。'] }
];
export const home = lang => lang === 'ja' ? '/ja/' : '/';
export const route = (lang, key) => `/${lang}/${key}/`;
export const sourcePath = (lang, chapter) => `${lang === 'ja' ? 'ja_JP' : 'us_EN'}/${chapter.file}_${lang}.md`;
export const templateNames = ['en', 'ja'].flatMap(lang =>
  ['ods', 'pdf'].map(extension => `coffee_microvave_roasting_template_v4_${lang}.${extension}`));
const imageDescriptions = {
  'geen_beans-144g.png': ['144 g of green coffee beans on a scale', '秤に載せた144gの生豆'],
  'glass-cylinder.png': ['Heat-resistant glass roasting cylinder', '焙煎に使用する耐熱ガラス容器'],
  'place_on_the_disposable_chopsticks.jpg': ['Glass cylinder supported on wooden chopsticks', '木製の割り箸の上に置いたガラス容器'],
  'burn safety.jpg': ['Protective gloves and towel for handling the hot container', '熱い容器を扱うための手袋とタオル'],
  'quick-wash-start.jpg': ['Initial washing of the green beans', '生豆の最初の洗浄'],
  'defected-beans-before-roasting.png': ['Defective beans removed before roasting', '焙煎前に取り除いた欠点豆'],
  'wash-greenbeans-50cel.jpg': ['Washing green beans in warm water', '温水で生豆を洗う様子'],
  'honey_fructose.png': ['Honey-fructose solution used in bean preparation', '生豆の下準備に使う蜂蜜・果糖液'],
  'soaking_30min.jpg': ['Green beans during the 30-minute soak', '30分間の吸水中の生豆'],
  'soaking_50cel.jpg': ['Warm-water soaking setup', '温水での吸水処理の様子'],
  'green_beans-cylinder.jpg': ['Prepared green beans in the glass cylinder', '下準備を終えた生豆を入れたガラス容器'],
  'chaf.jpg': ['Coffee chaff from bean preparation', '生豆の下準備で出たチャフ'],
  'chaf2.jpg': ['Chaff separated from the beans', '豆から分離したチャフ'],
  'chaf3.png': ['Detail of removed coffee chaff', '取り除いたチャフの詳細'],
  'roasting-done-beans.jpg': ['Coffee beans after roasting', '焙煎を終えたコーヒー豆'],
  'ethiopia-shidama.jpg': ['Ethiopian coffee in the case study', '実践事例のエチオピア産コーヒー'],
  'venezuela-muccay-dark_roast.png': ['Roasted Venezuelan coffee in the case study', '実践事例で焙煎したベネズエラ産コーヒー'],
  'sample_ethiopia_gesha_village_coffee_roast_26Jul25.png': ['Ethiopia Gesha Village roast profile chart, 25 July 2026', 'エチオピア・ゲシャビレッジの焙煎グラフ（2026年7月25日）'],
  'sample_ethiopia_shidama_baturo_coffee_roast_26Aug22.png': ['Ethiopia Shidama Baturo roast profile chart, 22 August 2026', 'エチオピア・シダマ・バトゥロの焙煎グラフ（2026年8月22日）'],
  'sample_venezuela_muculay_coffee_roast_26Aug18.png': ['Venezuela roast profile chart, 18 August 2026', 'ベネズエラの焙煎グラフ（2026年8月18日）']
};
export const imageNames = [...new Set(['en', 'ja'].flatMap(lang => chapters.flatMap(chapter =>
  [...readFileSync(sourcePath(lang, chapter), 'utf8').matchAll(/src="\.\.\/images\/([^"]+)"/g)].map(match => match[1])
)))];
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export function renderChapter(lang, chapter) {
  let source = readFileSync(sourcePath(lang, chapter), 'utf8');
  const title = source.match(/^# (.+)$/m)?.[1];
  if (!title) throw new Error(`Missing title: ${sourcePath(lang, chapter)}`);
  source = source.replace(/^# .+\r?\n/, '');
  source = source.replace(/\]\(\.\.\/docs\/([^)]+)\)/g, (_, name) => {
    if (!templateNames.includes(name)) throw new Error(`Unknown template link: ${name}`);
    return `](/docs/${name})`;
  });
  source = source.replace(/\]\(\.\/([^)#]+)\.md(#[^)]+)?\)/g, (_, file, anchor = '') => {
    const destination = chapters.find(entry => `${entry.file}_${lang}` === file);
    if (!destination) throw new Error(`Unknown manuscript link: ${file}`);
    return `](${route(lang, destination.key)}${anchor})`;
  });
  source = source.replace(/<img\s+src="\.\.\/images\/([^"]+)"\s+width="([^"]+)"\s*>/g, (_, name) => {
    const alt = imageDescriptions[name]?.[lang === 'ja' ? 1 : 0];
    if (!alt) throw new Error(`Missing image description: ${name}`);
    const chart = name.startsWith('sample_');
    return `<figure class="${chart ? 'chart' : 'photo'}"><a href="/images/${encodeURIComponent(name)}" aria-label="${escape(lang === 'ja' ? `${alt}：原寸の画像を開く` : `${alt}: open full-size image`)}"><img src="/images/${encodeURIComponent(name)}" alt="${escape(alt)}" loading="lazy" decoding="async"></a><figcaption>${escape(alt)}</figcaption></figure>`;
  });
  const headings = [];
  const parser = new Marked({ gfm: true, renderer: {
    heading({ tokens, depth }) {
      const html = this.parser.parseInline(tokens);
      const text = html.replace(/<[^>]*>/g, '');
      const id = `section-${headings.length + 1}`;
      headings.push({ text, id, depth });
      return `<h${depth} id="${id}">${html}</h${depth}>\n`;
    }
  }});
  const html = parser.parse(source).replace(/<table>/g, '<div class="table-scroll" tabindex="0" role="region" aria-label="' + (lang === 'ja' ? 'データ表' : 'Data table') + '"><table>').replace(/<\/table>/g, '</table></div>');
  return { title, html, headings: headings.filter(heading => heading.depth === 2) };
}
