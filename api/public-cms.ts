import { adminDb } from './_firebaseAdmin.js';

type VercelRequest = {
  method?: string;
};

type VercelResponse = {
  setHeader?: (name: string, value: string) => void;
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

function serializable(data: Record<string, unknown> | undefined, id: string) {
  return {
    id,
    ...(data || {}),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader?.('Cache-Control', 'no-store, max-age=0, must-revalidate');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = adminDb();
    const [pagesSnap, sectionsSnap, settingsSnap] = await Promise.all([
      db.collection('pages').where('status', '==', 'published').get(),
      db.collection('pageSections').where('visible', '==', true).get(),
      db.doc('siteSettings/main').get(),
    ]);

    const pages = pagesSnap.docs.map((doc) => serializable(doc.data(), doc.id));
    const publishedPageIds = new Set(pages.map((page) => String(page.id)));
    const sections = sectionsSnap.docs
      .map((doc) => serializable(doc.data(), doc.id))
      .filter((section) => publishedPageIds.has(String(section.pageId)))
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

    return res.status(200).json({
      pages,
      sections,
      settings: settingsSnap.exists ? settingsSnap.data() : null,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[PublicCMS] Snapshot read failed:', error);
    return res.status(500).json({ error: 'Cannot load public CMS data' });
  }
}
