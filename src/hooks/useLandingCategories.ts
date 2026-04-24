import { useQuery } from '@tanstack/react-query'
import { landingCategoryService } from '../services/landingCategoryService'
import type { LandingCategory } from '../types'

export function usePublishedLandingCategories() {
  const q = useQuery<LandingCategory[]>({
    queryKey: ['landing-categories', 'published'],
    queryFn: () => landingCategoryService.getPublished(),
  })
  return { categories: q.data ?? [], loading: q.isLoading }
}
