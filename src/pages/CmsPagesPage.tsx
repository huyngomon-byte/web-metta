import { DatabaseBackup, Eye, FilePenLine, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { cmsService } from '@/services/cmsService';
import { usePages } from '@/hooks/useCms';
import { formatDate, slugify } from '@/lib/utils';

export default function CmsPagesPage() {
  const { pages, refresh } = usePages();
  const [draft, setDraft] = useState<{ title: string; slug: string; status: 'draft' | 'published' }>({ title: '', slug: '', status: 'draft' });
  async function addPage() {
    if (!draft.title) return;
    await cmsService.savePage({ ...draft, slug: draft.slug || slugify(draft.title), metaTitle: draft.title, metaDescription: '' });
    setDraft({ title: '', slug: '', status: 'draft' });
    refresh();
  }
  async function remove(id: string) {
    await cmsService.deletePage(id);
    refresh();
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><h1 className="text-3xl font-extrabold text-slate-950">Website CMS</h1><p className="text-slate-500">Quản lý page, landing page, preview và publish.</p></div>
        <Button variant="outline" onClick={() => cmsService.resetToSeed()}><DatabaseBackup /> Khôi phục dữ liệu mẫu CMS</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Tạo page mới</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_180px_120px]">
          <Input placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value, slug: slugify(e.target.value) })} />
          <Input placeholder="Slug" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
          <Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as 'draft' | 'published' })}><option value="draft">Draft</option><option value="published">Published</option></Select>
          <Button onClick={addPage}><Plus /> Tạo</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Title</TH><TH>Slug</TH><TH>Status</TH><TH>Updated</TH><TH>Action</TH></TR></THead>
            <TBody>
              {pages.map((page) => (
                <TR key={page.id}>
                  <TD className="font-semibold">{page.title}</TD>
                  <TD>
                    <a href={`/p/${page.slug}`} target="_blank" rel="noreferrer"
                      className="text-blue-600 hover:underline font-mono text-xs">
                      /p/{page.slug}
                    </a>
                  </TD>
                  <TD><Badge tone={page.status === 'published' ? 'green' : 'amber'}>{page.status}</Badge></TD>
                  <TD>{formatDate(page.updatedAt, true)}</TD>
                  <TD>
                    <div className="flex gap-2">
                      <Link to={`/cms/pages/${page.id}`}><Button variant="outline" size="sm"><FilePenLine /> Edit</Button></Link>
                      <a href={`/p/${page.slug}`} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm"><Eye /> Preview</Button>
                      </a>
                      <Button variant="destructive" size="sm" onClick={() => remove(page.id)}><Trash2 /></Button>
                    </div>
                  </TD>
                </TR>
              ))}
              {/* Hàng cố định: Header Menu */}
              <TR>
                <TD className="font-semibold">Header Menu</TD>
                <TD className="text-slate-400 italic">—</TD>
                <TD><Badge tone="blue">system</Badge></TD>
                <TD className="text-slate-400">—</TD>
                <TD>
                  <div className="flex gap-2">
                    <Link to="/cms/header-menu"><Button variant="outline" size="sm"><FilePenLine /> Edit</Button></Link>
                  </div>
                </TD>
              </TR>
              {/* Hàng cố định: Footer */}
              <TR>
                <TD className="font-semibold">Footer</TD>
                <TD className="text-slate-400 italic">—</TD>
                <TD><Badge tone="blue">system</Badge></TD>
                <TD className="text-slate-400">—</TD>
                <TD>
                  <div className="flex gap-2">
                    <Link to="/cms/footer"><Button variant="outline" size="sm"><FilePenLine /> Edit</Button></Link>
                  </div>
                </TD>
              </TR>
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
