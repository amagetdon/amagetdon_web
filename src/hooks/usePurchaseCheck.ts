import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export function usePurchaseCheck(courseId?: number, ebookId?: number) {
  const { user } = useAuth()
  const q = useQuery<boolean>({
    queryKey: ['purchase-check', user?.id ?? null, courseId ?? null, ebookId ?? null],
    queryFn: async () => {
      if (!user || (!courseId && !ebookId)) return false
      let query = supabase.from('purchases').select('id').eq('user_id', user.id)
      if (courseId) query = query.eq('course_id', courseId)
      if (ebookId) query = query.eq('ebook_id', ebookId)
      const { data, error } = await query.limit(1)
      if (error) return false
      return (data?.length ?? 0) > 0
    },
    enabled: !!user && (!!courseId || !!ebookId),
  })
  return { purchased: q.data ?? false, loading: q.isLoading }
}
