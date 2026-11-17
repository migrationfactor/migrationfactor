import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { query } from '../src/lib/seo-system/db';

async function run() {
  try {
    const mediaCols = await query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'seo_media' ORDER BY ordinal_position"
    );
    console.log('seo_media cols:', mediaCols.map((c) => c.column_name));

    const catCols = await query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'seo_categories' ORDER BY ordinal_position"
    );
    console.log('seo_categories cols:', catCols.map((c) => c.column_name));

    const tagCols = await query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'seo_tags' ORDER BY ordinal_position"
    );
    console.log('seo_tags cols:', tagCols.map((c) => c.column_name));

    const authorCols = await query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'seo_authors' ORDER BY ordinal_position"
    );
    console.log('seo_authors cols:', authorCols.map((c) => c.column_name));

    const postCols = await query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'seo_posts' ORDER BY ordinal_position"
    );
    console.log('seo_posts cols:', postCols.map((c) => c.column_name));

    const analysisCols = await query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'seo_analysis' ORDER BY ordinal_position"
    );
    console.log('seo_analysis cols:', analysisCols.map((c) => c.column_name));

    process.exit(0);
  } catch (err) {
    console.error('Inspection error:', err);
    process.exit(1);
  }
}

run();
