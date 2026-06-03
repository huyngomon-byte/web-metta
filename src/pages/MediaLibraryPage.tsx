import { Copy, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { mediaService } from '@/services/mediaService';
import type { MediaItem } from '@/types/cms';
import { formatDate } from '@/lib/utils';

export default function MediaLibraryPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [search, setSearch] = useState('');
  const refresh = () => mediaService.getMedia().then(setItems);
  useEffect(() => { refresh(); }, []);
  const filtered = useMemo(() => items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())), [items, search]);
  async function upload(file?: File) {
    if (!file) return;
    await mediaService.upload(file);
    refresh();
  }
  async function remove(id: string) {
    await mediaService.delete(id);
    refresh();
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div><h1 className="text-3xl font-extrabold text-slate-950">Media Library</h1><p className="text-slate-500">Upload, search, copy URL và xóa ảnh.</p></div>
        <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#F45A0A] px-4 text-sm font-semibold text-white hover:bg-orange-600"><Upload /> Upload<input type="file" className="hidden" accept="image/*" onChange={(e) => upload(e.target.files?.[0])} /></label>
      </div>
      <Input placeholder="Search ảnh..." value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        {filtered.map((item) => (
          <Card key={item.id}>
            <img src={item.fileUrl} alt={item.name} className="h-40 w-full rounded-t-xl object-cover" />
            <CardHeader><CardTitle className="truncate text-base">{item.name}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs text-slate-500">{item.fileType} · {Math.round(item.fileSize / 1024)}KB · {formatDate(item.createdAt)}</p>
              <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(item.fileUrl)}><Copy /> Copy URL</Button><Button variant="destructive" size="sm" onClick={() => remove(item.id)}><Trash2 /></Button></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
