import { wpGetAll } from './wordpress-client';

export interface WpTerm { id: number; name: string; slug: string; description: string; parent?: number; count: number; link: string }
export interface WpUser { id: number; name: string; slug: string; description?: string; link?: string }

const termFields = 'id,name,slug,description,parent,count,link';

export async function fetchTaxonomies() {
  const [categories, tags, users] = await Promise.all([
    wpGetAll<WpTerm>('categories', { _fields: termFields }),
    wpGetAll<WpTerm>('tags', { _fields: termFields }),
    wpGetAll<WpUser>('users', { _fields: 'id,name,slug,description,link' }),
  ]);
  return { categories: categories.items, tags: tags.items, users: users.items };
}
