import { supabase } from '../lib/supabase'

export const storageService = {
  async uploadFile(bucket: string, path: string, file: File) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      })
    if (error) throw error
    return data.path
  },

  getPublicUrl(bucket: string, path: string) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  },

  async deleteFile(bucket: string, path: string) {
    const { error } = await supabase.storage.from(bucket).remove([path])
    if (error) throw error
  },

  async uploadImage(bucket: string, path: string, file: File): Promise<string> {
    const uploadPath = await this.uploadFile(bucket, path, file)
    return this.getPublicUrl(bucket, uploadPath)
  },
}
