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
export const companyPage = pages['ho-so-cong-ty'] || null;
export const servicesPage = pages['dich-vu'] || null;
export const servicesDetail = pages['thiet-ke-cong-trinh'] || null;
export const recruitPage = pages['tuyen-dung'] || pages['tuyen-dung-3'] || null;
export const contactPage = pages['lien-he'] || null;

// ---- nav (tieng Viet, map sang 2 site mau) ----
export const navItems = [
  { label: 'Công trình', path: 'cong-trinh' },
  { label: 'Dịch vụ', path: 'dich-vu' },
  { label: 'Về chúng tôi', path: 've-chung-toi' },
  { label: 'Tin tức', path: 'tin-tuc' },
  { label: 'Tuyển dụng', path: 'tuyen-dung' },
  { label: 'Liên hệ', path: 'lien-he' },
];

// link nav cho 1 theme ('mq' | 'bda')
export const navFor = (theme) =>
  navItems.map((n) => ({ label: n.label, url: href(`${theme}/${n.path}`), path: n.path }));

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
    .replace(/<(p|h2|h3|h4|li)>\s*(&nbsp;|\s)*<\/\1>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(site.mapQuery)}&output=embed`;
