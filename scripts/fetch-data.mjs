// Keo toan bo data KGM Asia (public WP REST + WooCommerce Store API) -> data/*.json
// Chay: node scripts/fetch-data.mjs
// Khong can API key. Luu JSON de build khong phu thuoc kgmasia.com luc deploy.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = 'https://kgmasia.com';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; KGM-site-builder/1.0)' };
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'data');

async function getJSON(url, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
      return await r.json();
    } catch (e) {
      lastErr = e;
      await new Promise((s) => setTimeout(s, 700 * (i + 1)));
    }
  }
  throw lastErr;
}

// Lay tat ca trang cua 1 endpoint phan trang
async function getAll(path, perPage = 100) {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const url = `${BASE}/wp-json/${path}${path.includes('?') ? '&' : '?'}per_page=${perPage}&page=${page}`;
    let batch;
    try {
      batch = await getJSON(url);
    } catch (e) {
      if (String(e).includes('HTTP 400')) break;
      throw e;
    }
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < perPage) break;
  }
  return out;
}

const decode = (s = '') =>
  s
    // entity so & hex (vd &#038; -> &, &#8217; -> ')
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return ''; } })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; } })
    // named pho bien
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const stripTags = (html = '') =>
  decode(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();

// Bo hau to -WxH de lay anh goc
const toOriginal = (u) => u.replace(/-\d+x\d+(\.\w{2,5})(\?.*)?$/i, '$1$2');

function extractImages(html = '') {
  const urls = new Set();
  const re = /(?:src|data-src|data-lazy-src|data-orig-file|href)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    let u = m[1];
    if (!/\.(jpe?g|png|webp)(\?|$)/i.test(u)) continue;
    if (!/\/uploads\//i.test(u)) continue;
    if (u.startsWith('//')) u = 'https:' + u;
    else if (u.startsWith('/')) u = BASE + u;
    urls.add(toOriginal(u));
  }
  return [...urls];
}

function galleryFrom(html) {
  return extractImages(html).map((full) => ({ full, src: full }));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log('-> Keo data KGM Asia...');

  // 1) DU AN: Store API (gallery) + WP REST (taxonomy)
  console.log('  - Products (Store API)...');
  const store = await getJSON(`${BASE}/wp-json/wc/store/v1/products?per_page=100`);
  console.log(`    ${store.length} products`);

  console.log('  - Products taxonomy (WP REST _embed)...');
  const wpProducts = await getAll('wp/v2/product?_embed');
  const termsById = new Map();
  for (const p of wpProducts) {
    const terms = (p._embedded?.['wp:term'] || []).flat();
    termsById.set(p.id, terms);
  }

  const projects = store.map((p) => {
    const terms = termsById.get(p.id) || [];
    const byTax = (tax) =>
      terms.filter((t) => t.taxonomy === tax).map((t) => ({ name: decode(t.name), slug: t.slug }));
    const html = p.short_description || p.description || '';
    const gallery = galleryFrom(html);
    const featured = p.images?.[0]?.src ? toOriginal(p.images[0].src) : null;
    const type = byTax('mo_hinh_du_an')[0] || null;
    const province = byTax('tinh_thanh')[0] || null;
    const style = byTax('phong_cach')[0] || null;
    const scale = byTax('quy_mo_du_an')[0] || null;
    const cats = (p.categories || []).map((c) => decode(c.name));
    return {
      id: p.id,
      slug: p.slug,
      name: decode(p.name || '').trim(),
      permalink: p.permalink,
      type: type?.name || cats[0] || 'Cong trinh',
      typeSlug: type?.slug || 'cong-trinh-khac',
      province: province?.name || '',
      provinceSlug: province?.slug || '',
      style: style?.name || '',
      styleSlug: style?.slug || '',
      scale: scale?.name || '',
      scaleSlug: scale?.slug || '',
      cats,
      text: stripTags(html),
      images: gallery,
      cover: gallery[0]?.full || featured,
    };
  });
  const projectsClean = projects.filter((p) => p.cover);
  console.log(`    ${projectsClean.length} du an co anh (bo ${projects.length - projectsClean.length})`);

  // 2) TAXONOMY (facets)
  console.log('  - Taxonomies...');
  const taxonomies = {};
  for (const tax of ['mo_hinh_du_an', 'tinh_thanh', 'phong_cach', 'quy_mo_du_an', 'product_cat']) {
    try {
      const terms = await getAll(`wp/v2/${tax}`);
      taxonomies[tax] = terms
        .map((t) => ({ name: decode(t.name), slug: t.slug, count: t.count || 0 }))
        .filter((t) => t.count > 0)
        .sort((a, b) => b.count - a.count);
    } catch (e) {
      console.log(`    (bo qua ${tax}: ${e.message})`);
      taxonomies[tax] = [];
    }
  }

  // 3) PAGES
  console.log('  - Pages...');
  const wpPages = await getAll('wp/v2/pages?_embed');
  const pages = {};
  for (const pg of wpPages) {
    const html = pg.content?.rendered || '';
    pages[pg.slug] = {
      id: pg.id,
      slug: pg.slug,
      title: stripTags(pg.title?.rendered || ''),
      html,
      text: stripTags(html),
      images: extractImages(html),
    };
  }
  console.log(`    ${Object.keys(pages).length} pages`);

  // 4) POSTS (Tin tuc)
  console.log('  - Posts (Tin tuc)...');
  const wpPosts = await getAll('wp/v2/posts?_embed');
  const posts = wpPosts.map((po) => {
    const html = po.content?.rendered || '';
    const fm = po._embedded?.['wp:featuredmedia']?.[0]?.source_url || null;
    return {
      id: po.id,
      slug: po.slug,
      title: stripTags(po.title?.rendered || ''),
      date: po.date,
      excerpt: stripTags(po.excerpt?.rendered || '').slice(0, 300),
      html,
      text: stripTags(html),
      image: fm ? toOriginal(fm) : extractImages(html)[0] || null,
    };
  });
  console.log(`    ${posts.length} posts`);

  // 5) SITE (lien he / social)
  const site = {
    name: 'KGM Asia',
    legalName: 'CONG TY TNHH KHONG GIAN MOI',
    tagline: 'Architect · Interior · Landscape',
    phone: '+84 936 357 288',
    phoneRaw: '+84936357288',
    email: 'businessmanager@kgmasia.com',
    zalo: '0941896116',
    address: 'Tầng 3–4, Tòa nhà 156, Kim Mã, Ba Đình, Hà Nội',
    mapQuery: '156 Kim Ma, Ba Dinh, Ha Noi',
    social: {
      facebook: 'https://www.facebook.com/KGMAsia.interiordesigner',
      instagram: 'https://www.instagram.com/kgm_asia',
      youtube: 'https://www.youtube.com/@kgmasia',
    },
    sourceUrl: BASE,
  };

  const write = (name, data) => writeFile(join(OUT, name), JSON.stringify(data, null, 2), 'utf8');
  await write('projects.json', projectsClean);
  await write('taxonomies.json', taxonomies);
  await write('pages.json', pages);
  await write('posts.json', posts);
  await write('site.json', site);

  const totalImgs = projectsClean.reduce((s, p) => s + p.images.length, 0);
  console.log('\nXong:');
  console.log(`  projects: ${projectsClean.length} (~${totalImgs} anh gallery)`);
  console.log(`  taxonomies: ${Object.entries(taxonomies).map(([k, v]) => `${k}=${v.length}`).join(', ')}`);
  console.log(`  pages: ${Object.keys(pages).length} | posts: ${posts.length}`);
}

main().catch((e) => {
  console.error('LOI:', e);
  process.exit(1);
});
