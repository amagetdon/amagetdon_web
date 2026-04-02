import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export function usePurchaseCheck(courseId?: number, ebookId?: number) {
  const { user } = useAuth()
  const [purchased, setPurchased] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || (!courseId && !ebookId)) {
      setPurchased(false)
      setLoading(false)
      return
    }

    const check = async () => {
      setLoading(true)
      try {
        let query = supabase
          .from('purchases')
          .select('id')
          .eq('user_id', user.id)

        if (courseId) {
          query = query.eq('course_id', courseId)
        }
        if (ebookId) {
          query = query.eq('ebook_id', ebookId)
        }

        const { data, error } = await query.limit(1)
        if (error) throw error
        setPurchased((data?.length ?? 0) > 0)
      } catch {
        setPurchased(false)
      } finally {
        setLoading(false)
      }
    }

    check()
  }, [user, courseId, ebookId])

  return { purchased, loading }
}
