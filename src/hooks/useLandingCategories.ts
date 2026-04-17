import { useEffect, useState } from 'react'
import { landingCategoryService } from '../services/landingCategoryService'
import type { LandingCategory } from '../types'

export function usePublishedLandingCategories() {
  const [categories, setCategories] = useState<LandingCategory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    landingCategoryService
      .getPublished()
      .then((data) => { if (!cancelled) setCategories(data) })
      .catch(() => { if (!cancelled) setCategories([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { categories, loading }
}
