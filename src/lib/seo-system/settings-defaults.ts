/** Global SEO settings (FR-SEO-000). Pure module: shared by server code, the admin UI and tests. */

export const TITLE_SEPARATORS: Record<string, string> = {
  hyphen: '-',
  pipe: '|',
  colon: ':',
  dot: '·',
  emdash: '—',
};

export interface SeoSettings {
  siteName: string;
  alternateName: string;
  titleSeparator: keyof typeof TITLE_SEPARATORS;
  titleTemplate: string;
  descriptionTemplate: string;
  organization: {
    name: string;
    legalName: string;
    logoUrl: string;
    description: string;
    sameAs: string[];
    phone: string;
    email: string;
    address: string;
  };
  defaultSocialImage: string;
  twitterSite: string;
  requireFeaturedImage: boolean;
  /** Insert a table of contents automatically when a post has at least this many H2s (0 = off). */
  autoTocMinH2: number;
  /** Days a trashed post is kept before the daily job deletes it permanently (7-365). */
  trashRetentionDays: number;
  /** Posts under this many words are flagged as thin content (B10, FR-QLT-005). */
  minWords: number;
  /** Domains treated as trusted sources by the GEO checks (G2) and external-link quality (A4). */
  trustedDomains: string[];
  /** Brand name variants that should be written one consistent way (G8). */
  brandAliases: string[];
}

export const DEFAULT_SETTINGS: SeoSettings = {
  siteName: 'Migration Factor',
  alternateName: '',
  titleSeparator: 'pipe',
  titleTemplate: '%title% %sep% %sitename%',
  descriptionTemplate: '',
  organization: { name: 'Migration Factor', legalName: '', logoUrl: '', description: '', sameAs: [], phone: '', email: '', address: '' },
  defaultSocialImage: '',
  twitterSite: '',
  requireFeaturedImage: true,
  autoTocMinH2: 0,
  trashRetentionDays: 30,
  minWords: 300,
  trustedDomains: ['homeaffairs.gov.au', 'immi.homeaffairs.gov.au', 'legislation.gov.au', 'abs.gov.au'],
  brandAliases: [],
};

/** Replaces %title%, %sep%, %sitename% in a template. Manual SEO titles are never passed through this. */
export function applyTitleTemplate(template: string, vars: { title: string; siteName: string; separator: keyof typeof TITLE_SEPARATORS }): string {
  return template
    .replace(/%title%/g, vars.title)
    .replace(/%sep%/g, TITLE_SEPARATORS[vars.separator] || '|')
    .replace(/%sitename%/g, vars.siteName)
    .replace(/\s+/g, ' ')
    .trim();
}

const str = (v: unknown, max: number, fallback = '') => (typeof v === 'string' ? v.trim().slice(0, max) : fallback);

const list = (v: unknown, max: number): string[] => (Array.isArray(v) ? v : String(v ?? '').split('\n')).map((x) => String(x).trim().toLowerCase()).filter(Boolean).slice(0, max);

function url(v: unknown, label: string, allowRelative = false): string {
  const s = str(v, 2048);
  if (!s) return '';
  if (allowRelative && s.startsWith('/')) return s;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
    return u.toString();
  } catch {
    throw Object.assign(new Error(`${label} must be a full http(s) URL.`), { status: 422 });
  }
}

/** Validates and normalises a settings patch. Throws a 422-style error with a plain-language message. */
export function normalizeSettings(input: any, base: SeoSettings = DEFAULT_SETTINGS): SeoSettings {
  const o = input?.organization || {};
  const sep = String(input?.titleSeparator ?? base.titleSeparator);
  if (!(sep in TITLE_SEPARATORS)) throw Object.assign(new Error('Choose a valid title separator.'), { status: 422 });
  const titleTemplate = str(input?.titleTemplate ?? base.titleTemplate, 200, base.titleTemplate);
  if (!titleTemplate.includes('%title%')) throw Object.assign(new Error('The title template must contain %title%.'), { status: 422 });
  const handle = str(input?.twitterSite ?? base.twitterSite, 40);
  if (handle && !/^@\w{1,15}$/.test(handle)) throw Object.assign(new Error('X handle must look like @yourbrand.'), { status: 422 });
  const sameAsRaw: unknown[] = Array.isArray(o.sameAs) ? o.sameAs : base.organization.sameAs;
  const toc = Number(input?.autoTocMinH2 ?? base.autoTocMinH2);
  if (!Number.isInteger(toc) || toc < 0 || toc > 20) throw Object.assign(new Error('Automatic TOC threshold must be a whole number from 0 to 20.'), { status: 422 });
  const siteName = str(input?.siteName ?? base.siteName, 80);
  if (!siteName) throw Object.assign(new Error('Site name is required.'), { status: 422 });
  const email = str(o.email ?? base.organization.email, 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Organization email is not valid.'), { status: 422 });

  return {
    siteName,
    alternateName: str(input?.alternateName ?? base.alternateName, 80),
    titleSeparator: sep as keyof typeof TITLE_SEPARATORS,
    titleTemplate,
    descriptionTemplate: str(input?.descriptionTemplate ?? base.descriptionTemplate, 400),
    organization: {
      name: str(o.name ?? base.organization.name, 120) || siteName,
      legalName: str(o.legalName ?? base.organization.legalName, 160),
      logoUrl: url(o.logoUrl ?? base.organization.logoUrl, 'Logo URL', true),
      description: str(o.description ?? base.organization.description, 500),
      sameAs: sameAsRaw.map((u) => url(u, 'Profile link')).filter(Boolean).slice(0, 15),
      phone: str(o.phone ?? base.organization.phone, 40),
      email,
      address: str(o.address ?? base.organization.address, 300),
    },
    defaultSocialImage: url(input?.defaultSocialImage ?? base.defaultSocialImage, 'Default social image', true),
    twitterSite: handle,
    requireFeaturedImage: Boolean(input?.requireFeaturedImage ?? base.requireFeaturedImage),
    autoTocMinH2: toc,
    trashRetentionDays: (() => {
      const d = Number(input?.trashRetentionDays ?? base.trashRetentionDays);
      if (!Number.isInteger(d) || d < 7 || d > 365) throw Object.assign(new Error('Trash retention must be 7 to 365 days.'), { status: 422 });
      return d;
    })(),
    minWords: (() => {
      const d = Number(input?.minWords ?? base.minWords);
      if (!Number.isInteger(d) || d < 50 || d > 5000) throw Object.assign(new Error('Minimum words must be 50 to 5000.'), { status: 422 });
      return d;
    })(),
    trustedDomains: list(input?.trustedDomains ?? base.trustedDomains, 50),
    brandAliases: list(input?.brandAliases ?? base.brandAliases, 20),
  };
}
