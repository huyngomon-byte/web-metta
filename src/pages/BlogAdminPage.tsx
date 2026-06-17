import { ArrowLeft, Eye, EyeOff, ImagePlus, PenLine, Plus, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { blogService } from '@/services/blogService';
import type { BlogPost } from '@/types/cms';

const CATEGORIES = ['Tin tức', 'Sự kiện', 'Thành tích', 'Chia sẻ', 'Khuyến mãi'];

export default function BlogAdminPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setPosts(await blogService.getPosts());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function newPost() {
    setEditing({
      id: '',
      title: '',
      slug: '',
      category: 'Tin tức',
      author: '',
      excerpt: '',
      metaTitle: '',
      metaDescription: '',
      content: '',
      coverImage: '',
      status: 'draft',
      publishedAt: new Date().toISOString().slice(0, 16),
      createdAt: '',
      updatedAt: '',
    });
  }

  async function handleSave(post: BlogPost) {
    await blogService.save(post);
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Xóa bài viết này?')) return;
    await blogService.delete(id);
    load();
  }

  if (editing) {
    return <BlogEditor post={editing} onSave={handleSave} onCancel={() => setEditing(null)} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Blog / Tin tức</h1>
          <p className="text-sm text-slate-500 mt-0.5">Quản lý bài viết tin tức & sự kiện</p>
        </div>
        <Button onClick={newPost}><Plus /> Tạo bài viết</Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Đang tải...</p>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <PenLine size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Chưa có bài viết nào</p>
            <Button className="mt-4" onClick={newPost}><Plus /> Tạo bài viết đầu tiên</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {posts.map((post) => (
            <Card key={post.id} className="hover:shadow-md transition">
              <CardContent className="p-4 flex items-center gap-4">
                {post.coverImage ? (
                  <img src={post.coverImage} alt="" className="w-20 h-14 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-20 h-14 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <ImagePlus size={18} className="text-slate-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 truncate">{post.title || '(Chưa có tiêu đề)'}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${post.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {post.status === 'published' ? 'Đã đăng' : 'Nháp'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {post.category} • {post.author || 'Chưa rõ'} • {new Date(post.publishedAt).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => setEditing(post)}>
                    <PenLine size={14} /> Sửa
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(post.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Rich text blog editor ──────────────────────────────────────────── */

function BlogEditor({ post, onSave, onCancel }: {
  post: BlogPost;
  onSave: (post: BlogPost) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<BlogPost>({ ...post });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const set = (key: keyof BlogPost, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  // Sync contentEditable → draft
  function syncContent() {
    if (editorRef.current) {
      setDraft((d) => ({ ...d, content: editorRef.current!.innerHTML }));
    }
  }

  // Toolbar commands
  function exec(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    syncContent();
  }

  function insertImage() {
    const url = prompt('URL hình ảnh:');
    if (url) {
      exec('insertHTML', `<img src="${url}" alt="" style="max-width:100%;border-radius:8px;margin:12px 0" />`);
    }
  }

  async function uploadImage(file: File) {
    // Try Cloudinary first
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    if (cloudName && uploadPreset) {
      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', uploadPreset);
      form.append('folder', 'metta-blog');
      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form });
        const data = await res.json();
        if (data.secure_url) return data.secure_url as string;
      } catch {}
    }
    // Fallback: data URL
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  async function handleImageUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = await uploadImage(file);
      exec('insertHTML', `<img src="${url}" alt="" style="max-width:100%;border-radius:8px;margin:12px 0" />`);
    };
    input.click();
  }

  async function handleCoverUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = await uploadImage(file);
      set('coverImage', url);
    };
    input.click();
  }

  async function save() {
    syncContent();
    setSaving(true);
    const final = { ...draft, content: editorRef.current?.innerHTML || draft.content };
    // Auto-generate slug if empty
    if (!final.slug && final.title) {
      final.slug = final.title
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    }
    await onSave(final);
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onCancel}><ArrowLeft size={16} /> Quay lại</Button>
        <h1 className="text-xl font-extrabold text-slate-900 flex-1">{post.id ? 'Sửa bài viết' : 'Tạo bài viết mới'}</h1>
        <Button variant="outline" size="sm" onClick={() => setPreview(!preview)}>
          {preview ? <><EyeOff size={14} /> Editor</> : <><Eye size={14} /> Xem trước</>}
        </Button>
        <Button onClick={save} disabled={saving}>
          <Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu bài viết'}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        {/* Main content */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="p-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Tiêu đề</label>
                <Input
                  className="text-lg font-bold"
                  placeholder="Nhập tiêu đề bài viết..."
                  value={draft.title}
                  onChange={(e) => set('title', e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Mô tả ngắn</label>
                <Textarea
                  rows={2}
                  placeholder="Mô tả ngắn hiển thị ở trang tin tức..."
                  value={draft.excerpt}
                  onChange={(e) => set('excerpt', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-700">SEO bài viết</CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">SEO title</label>
                <Input
                  maxLength={90}
                  placeholder="Nếu để trống sẽ dùng tiêu đề bài viết"
                  value={draft.metaTitle || ''}
                  onChange={(e) => set('metaTitle', e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">SEO description</label>
                <Textarea
                  rows={2}
                  maxLength={180}
                  placeholder="Nếu để trống sẽ dùng mô tả ngắn"
                  value={draft.metaDescription || ''}
                  onChange={(e) => set('metaDescription', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-700">Nội dung bài viết</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {preview ? (
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: editorRef.current?.innerHTML || draft.content }} />
              ) : (
                <>
                  {/* Toolbar */}
                  <div className="flex flex-wrap gap-1 mb-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <ToolBtn onClick={() => exec('bold')} title="Bold"><b>B</b></ToolBtn>
                    <ToolBtn onClick={() => exec('italic')} title="Italic"><i>I</i></ToolBtn>
                    <ToolBtn onClick={() => exec('underline')} title="Underline"><u>U</u></ToolBtn>
                    <ToolBtn onClick={() => exec('strikethrough')} title="Strikethrough"><s>S</s></ToolBtn>
                    <span className="w-px h-6 bg-slate-300 mx-1" />
                    <ToolBtn onClick={() => exec('formatBlock', 'h2')} title="Heading 2">H2</ToolBtn>
                    <ToolBtn onClick={() => exec('formatBlock', 'h3')} title="Heading 3">H3</ToolBtn>
                    <ToolBtn onClick={() => exec('formatBlock', 'p')} title="Paragraph">P</ToolBtn>
                    <span className="w-px h-6 bg-slate-300 mx-1" />
                    <ToolBtn onClick={() => exec('insertUnorderedList')} title="Bullet list">•</ToolBtn>
                    <ToolBtn onClick={() => exec('insertOrderedList')} title="Numbered list">1.</ToolBtn>
                    <ToolBtn onClick={() => { const url = prompt('URL:'); if (url) exec('createLink', url); }} title="Link">🔗</ToolBtn>
                    <span className="w-px h-6 bg-slate-300 mx-1" />
                    <ToolBtn onClick={insertImage} title="Chèn ảnh (URL)">🖼️ URL</ToolBtn>
                    <ToolBtn onClick={handleImageUpload} title="Upload ảnh"><ImagePlus size={14} /></ToolBtn>
                    <span className="w-px h-6 bg-slate-300 mx-1" />
                    <ToolBtn onClick={() => exec('removeFormat')} title="Xóa format">✕</ToolBtn>
                  </div>
                  {/* Editor area */}
                  <div
                    ref={editorRef}
                    contentEditable
                    className="min-h-[400px] max-h-[600px] overflow-y-auto rounded-lg border border-slate-200 p-4 text-sm leading-7 text-slate-800 outline-none focus:border-[#003B7A] prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: draft.content }}
                    onBlur={syncContent}
                    onPaste={(e) => {
                      // Handle pasted images
                      const items = e.clipboardData.items;
                      for (const item of items) {
                        if (item.type.startsWith('image/')) {
                          e.preventDefault();
                          const file = item.getAsFile();
                          if (file) uploadImage(file).then((url) => {
                            exec('insertHTML', `<img src="${url}" alt="" style="max-width:100%;border-radius:8px;margin:12px 0" />`);
                          });
                          return;
                        }
                      }
                    }}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-slate-700">Trạng thái</CardTitle></CardHeader>
            <CardContent className="p-4 flex flex-col gap-3">
              <Select value={draft.status} onChange={(e) => set('status', e.target.value as 'published' | 'draft')}>
                <option value="draft">Nháp</option>
                <option value="published">Đã đăng</option>
              </Select>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Ngày đăng</label>
                <Input
                  type="datetime-local"
                  value={draft.publishedAt.slice(0, 16)}
                  onChange={(e) => set('publishedAt', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-700 flex items-center justify-between gap-2">
                <span>Hình đại diện</span>
                <span className="text-[11px] font-mono font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded">📐 1200 × 800 px (3:2)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {draft.coverImage ? (
                <div className="relative">
                  <img src={draft.coverImage} alt="" className="w-full aspect-[3/2] object-cover rounded-lg" />
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={handleCoverUpload} className="text-xs font-bold text-[#003B7A] hover:underline">Đổi ảnh</button>
                    <button type="button" onClick={() => set('coverImage', '')} className="text-xs font-bold text-red-500 hover:underline">Xóa ảnh</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleCoverUpload}
                  className="w-full aspect-[3/2] rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-[#003B7A] hover:text-[#003B7A] transition"
                >
                  <ImagePlus size={24} />
                  <span className="text-xs font-bold">Upload hình đại diện</span>
                  <span className="text-[10px] font-mono">1200 × 800 px</span>
                </button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-slate-700">Phân loại</CardTitle></CardHeader>
            <CardContent className="p-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Danh mục</label>
                <Select value={draft.category} onChange={(e) => set('category', e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Người viết</label>
                <Input
                  placeholder="Tên tác giả..."
                  value={draft.author}
                  onChange={(e) => set('author', e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Slug URL</label>
                <Input
                  placeholder="tu-dong-tao-tu-tieu-de"
                  value={draft.slug}
                  onChange={(e) => set('slug', e.target.value)}
                />
                <p className="text-[10px] text-slate-400 mt-1">/tin-tuc/{draft.slug || 'slug-tu-dong'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded text-xs font-bold text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition"
    >
      {children}
    </button>
  );
}
