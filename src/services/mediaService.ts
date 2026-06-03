import { storage, isFirebaseConfigured } from '@/lib/firebase';
import { delay, store } from '@/services/store';
import type { MediaItem } from '@/types/cms';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

async function uploadToCloudinary(file: File): Promise<string | null> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) return null;
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', uploadPreset);
  form.append('folder', 'metta-media');
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form });
    const data = await res.json();
    if (data.secure_url) return data.secure_url as string;
    console.warn('[Media] Cloudinary upload failed:', data);
    return null;
  } catch (e) {
    console.warn('[Media] Cloudinary upload error:', e);
    return null;
  }
}

export const mediaService = {
  getMedia: () => delay(store.media),
  upload: async (file: File, uploadedBy = 'Admin') => {
    // Try Cloudinary first
    let fileUrl = await uploadToCloudinary(file);

    // Fallback to Firebase Storage
    if (!fileUrl && isFirebaseConfigured && storage) {
      try {
        const storageRef = ref(storage, `media/${Date.now()}-${file.name}`);
        await uploadBytes(storageRef, file);
        fileUrl = await getDownloadURL(storageRef);
      } catch (e) {
        console.warn('[Media] Firebase Storage upload failed:', e);
      }
    }

    // Last fallback: local blob URL
    if (!fileUrl) fileUrl = URL.createObjectURL(file);

    const item: MediaItem = { id: `media-${Date.now()}`, name: file.name, fileUrl, fileType: file.type, fileSize: file.size, uploadedBy, createdAt: new Date().toISOString() };
    store.media.unshift(item);
    return delay(item);
  },
  delete: (id: string) => {
    store.media = store.media.filter((m) => m.id !== id);
    return delay(true);
  }
};
