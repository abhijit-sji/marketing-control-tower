import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface BlogGenerationInput {
  primary_keyword: string
  primary_reference: string
  secondary_keyword?: string
  third_keyword?: string
  additional_notes?: string
  brand_name: string
  brand_id: string
  tone?: string
  audience?: string
  model?: string
}

export interface BlogGenerationResult {
  success: boolean
  blog_id: string
  title: string
  paragraphs: string[]
  validation: {
    valid: boolean
    errors: string[]
    warnings: string[]
    stats: any
  }
  meta: {
    attempts: number
    total_tokens: number
    cost_usd: number
    generation_time_ms: number
  }
}

/**
 * Hook to generate SEO blog content
 */
export function useSEOBlogGenerator() {
  return useMutation({
    mutationFn: async (input: BlogGenerationInput): Promise<BlogGenerationResult> => {
      const { data, error } = await supabase.functions.invoke('generate-seo-blog', {
        body: input,
      })

      if (error) throw error
      if (!data.success) throw new Error(data.error || 'Generation failed')

      return data
    },
  })
}

/**
 * Hook to fetch blog generation history for a brand
 */
export function useSEOBlogHistory(brandId?: string) {
  return useQuery({
    queryKey: ['seo-blogs', brandId],
    enabled: !!brandId,
    queryFn: async () => {
      const query = supabase
        .from('seo_blog_content')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (brandId) {
        query.eq('brand_id', brandId)
      }

      const { data, error } = await query

      if (error) throw error
      return data
    },
  })
}

/**
 * Hook to fetch details of a specific blog
 */
export function useSEOBlogDetails(blogId: string) {
  return useQuery({
    queryKey: ['seo-blog', blogId],
    enabled: !!blogId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seo_blog_content')
        .select('*')
        .eq('id', blogId)
        .single()

      if (error) throw error
      return data
    },
  })
}

/**
 * Hook to fetch generation logs for a blog
 */
export function useSEOBlogLogs(blogId: string) {
  return useQuery({
    queryKey: ['seo-blog-logs', blogId],
    enabled: !!blogId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seo_blog_generation_logs')
        .select('*')
        .eq('blog_id', blogId)
        .order('attempt_number', { ascending: true })

      if (error) throw error
      return data
    },
  })
}

/**
 * Hook to update blog status
 */
export function useUpdateBlogStatus() {
  return useMutation({
    mutationFn: async ({ blogId, status }: { blogId: string; status: string }) => {
      const { data, error } = await supabase
        .from('seo_blog_content')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', blogId)
        .select()
        .single()

      if (error) throw error
      return data
    },
  })
}

/**
 * Hook to delete a blog
 */
export function useDeleteBlog() {
  return useMutation({
    mutationFn: async (blogId: string) => {
      const { error } = await supabase
        .from('seo_blog_content')
        .delete()
        .eq('id', blogId)

      if (error) throw error
    },
  })
}
