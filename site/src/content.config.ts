import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    locale: z.enum(['en', 'fr']).default('en'),
    articleKey: z.string().optional(),
    alternateSlug: z.string().optional(),
    title: z.string(),
    description: z.string(),
    date: z.string(),
    author: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
})

export const collections = { blog }
