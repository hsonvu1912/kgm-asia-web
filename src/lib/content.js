// Lop noi dung dung chung cho ca 2 theme (MQ + BDA).
// Import data JSON (Astro ho tro JSON import) + helper chuan hoa / dieu huong.
import projectsRaw from '../../data/projects.json';
import taxonomies from '../../data/taxonomies.json';
import pages from '../../data/pages.json';
import postsRaw from '../../data/posts.json';
import site from '../../data/site.json';

export { taxonomies, pages, site };

// ---- helpers chung ----
// CHUAN HOA: BASE_URL co the thieu '/' cuoi (vd '/kgm-asia-web') -> ep luon co '/'
const RAW_BASE = import.meta.env.BASE_URL || '/';
export const BASE = RAW_BASE.endsWith('/') ? RAW_BASE : RAW_BASE + '/';

// noi base-path cho link noi bo (slash-safe)
export const href = (p = '') => BASE + String(p).replace(/^\/+/, '');

// bo dau tieng Viet -> key on dinh de gom nhom
export const slugKey = (s = '') =>
  s
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// tao slug ASCII sach + chong trung (tranh loi unicode slug cua WP)
function uniqueSlugifier() {
  const seen = new Set();
  return (raw, fallback) => {
    let s = slugKey(raw) || slugKey(fallback) || 'item';
    let out = s;
    let n = 2;
    while (seen.has(out)) out = `${s}-${n++}`;
    seen.add(out);
    return out;
  };
}

// Title Case tieng Viet (cho BDA hien thi nhe nhang)
export const titleVi = (s = '') =>
  s
    .toLowerCase()
    .replace(/\bf&b\b/gi, 'F&B')
    .replace(/(^|[\s/(-])([a-zà-ỹ])/g, (_, p, c) => p + c.toUpperCase());

// ---- chuan hoa loai hinh du an (gom hoa/thuong) ----
const typeFacetRaw = taxonomies.mo_hinh_du_an || [];
// canonical theo taxonomy, key bang accent-stripped name
const typeCanon = new Map(); // key -> {name, slug, count}
for (const t of typeFacetRaw) {
  const k = slugKey(t.name);
  if (!typeCanon.has(k)) typeCanon.set(k, { name: t.name, slug: t.slug || k, count: 0 });
}

const slugFromPermalink = (u = '') => {
  const m = String(u).match(/\/product\/([^/]+)\/?$/);
  return m ? m[1] : '';
};
const projSlugger = uniqueSlugifier();
export const projects = projectsRaw.map((p) => {
  const k = slugKey(p.type);
  const canon = typeCanon.get(k);
  return {
    ...p,
    slug: projSlugger(p.slug || slugFromPermalink(p.permalink), 'du-an-' + p.id),
    typeKey: k,
    type: canon?.name || p.type,
    typeSlug: canon?.slug || p.typeSlug || k,
    // dia diem hien thi: tinh thanh, neu rong thi suy tu ten
    place: p.province || '',
  };
});

// danh sach loai hinh (facet) kem so dem thuc te tu projects
export const projectTypes = (() => {
  const counts = new Map();
  for (const p of projects) {
    const cur = counts.get(p.typeKey) || { name: p.type, slug: p.typeSlug, key: p.typeKey, count: 0 };
    cur.count++;
    counts.set(p.typeKey, cur);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
})();

export const provinces = (taxonomies.tinh_thanh || []).map((t) => ({ ...t, key: slugKey(t.name) }));
export const styles = (taxonomies.phong_cach || []).map((t) => ({ ...t, key: slugKey(t.name) }));
export const scales = taxonomies.quy_mo_du_an || [];

export const getProject = (slug) => projects.find((p) => p.slug === slug);
export const projectsByType = (key) => (key && key !== 'all' ? projects.filter((p) => p.typeKey === key) : projects);

// du an tieu bieu cho trang chu (uu tien nhieu anh)
export const featured = [...projects].sort((a, b) => b.images.length - a.images.length).slice(0, 9);

// anh dung lam slideshow trang chu (cover cua cac du an tieu bieu)
export const heroSlides = featured
  .map((p) => ({ img: p.cover, name: p.name, type: p.type, place: p.place, slug: p.slug }))
  .filter((s) => s.img);

// ---- posts (tin tuc) ----
const postSlugger = uniqueSlugifier();
export const posts = [...postsRaw]
  .sort((a, b) => (a.date < b.date ? 1 : -1))
  .map((p) => ({ ...p, slug: postSlugger(p.slug, 'tin-' + p.id) }));
export const getPost = (slug) => posts.find((p) => p.slug === slug);
export const recentPosts = (n = 6) => posts.slice(0, n);

// ---- pages ----
export const page = (slug) => pages[slug] || null;
export const aboutPage = pages['xay-nha-tron-goi'] || null;
export const companyPage = null; // ho-so-cong-ty bi nhiem data KimHome -> BO
export const servicesPage = pages['dich-vu'] || null;
export const servicesDetail = pages['thiet-ke-cong-trinh'] || null;
export const recruitPage = pages['tuyen-dung-3'] || null; // tuyen-dung (cu) nhiem KimHome -> dung ban sach
export const contactPage = pages['lien-he'] || null;

// ---- nav chinh: 3 muc giong ref (Dich vu/Tin tuc/Tuyen dung gop vao Ve chung toi) ----
export const navItems = [
  { label: 'Công trình', path: 'cong-trinh' },
  { label: 'Về chúng tôi', path: 've-chung-toi' },
  { label: 'Liên hệ', path: 'lien-he' },
];
export const navFor = (theme) =>
  navItems.map((n) => ({ label: n.label, url: href(`${theme}/${n.path}`), path: n.path }));

// ---- sub-nav cua "Ve chung toi" (sidebar MQ) ----
export const aboutSub = [
  { label: 'Giới thiệu', path: 've-chung-toi' },
  { label: 'Dịch vụ', path: 'dich-vu' },
  { label: 'Tin tức', path: 'tin-tuc' },
  { label: 'Tuyển dụng', path: 'tuyen-dung' },
];
export const aboutNavFor = (theme) =>
  aboutSub.map((n) => ({ label: n.label, url: href(`${theme}/${n.path}`), path: n.path }));

// ---- lam sach HTML WP (bo style Flatsome, giu cau truc co ban) ----
export function cleanHtml(html = '') {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?(div|section|figure|figcaption|span|header|footer|article|aside)[^>]*>/gi, '')
    .replace(/<img([^>]*?)>/gi, (m, a) => {
      let src = (a.match(/src=["']([^"']+)["']/) || [])[1];
      if (!src) src = (a.match(/data-src=["']([^"']+)["']/) || [])[1];
      if (!src) return '';
      src = src.replace(/-\d+x\d+(\.\w{2,5})(\?.*)?$/i, '$1$2');
      if (src.startsWith('//')) src = 'https:' + src;
      return `<img src="${src}" loading="lazy" alt="">`;
    })
    .replace(/\s(class|style|id|width|height|sizes|srcset|loading|decoding|data-[\w-]+|role|aria-[\w-]+)=["'][^"']*["']/gi, '')
    // SCRUB: xoa moi khoi van ban con chua 'kimhome' (data lan tu site khac), roi xoa token con sot
    .replace(/<(p|li|h[1-6]|td|tr|blockquote)[^>]*>(?:(?!<\/\1>)[\s\S])*?kim\s*home(?:(?!<\/\1>)[\s\S])*?<\/\1>/gi, '')
    .replace(/kim\s*home/gi, '')
    .replace(/<(p|h2|h3|h4|li)>\s*(&nbsp;|\s)*<\/\1>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(site.mapQuery)}&output=embed`;

// ---- TEXT SACH: lay paragraph thuan tu trang WP (bo anh/style/the), chan brand la ----
const BAD_BRANDS = /kim\s*home|kim\s*s[oơ]n|hitach/i;

function decodeEntities(s = '') {
  return s
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return ''; } })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; } })
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&hellip;/g, '…').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
}

// Lay cac doan van sach (chi chu) tu <p>/<li> cua 1 trang; bo doan rac/brand la; chong trung.
export function cleanParagraphs(slug, { max = 99, minLen = 30 } = {}) {
  const html = pages[slug]?.html || '';
  const seen = new Set();
  const out = [];
  for (const m of html.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = decodeEntities(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (t.length < minLen) continue;
    if (/[{}]|@media|^#[\w-]+\b|:\s*-?\d+px|rgb\(/i.test(t)) continue; // bo CSS Flatsome nhung trong <p>
    if (BAD_BRANDS.test(t)) continue;
    const key = t.slice(0, 40).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

// kiem tra 1 chuoi co dinh brand la khong (de guard)
export const hasBadBrand = (s = '') => BAD_BRANDS.test(s);
