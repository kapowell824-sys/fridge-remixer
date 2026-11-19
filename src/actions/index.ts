import { generateObject } from 'ai'
import { z } from 'zod'
import { createDeepSpaceAI } from 'deepspace/worker'
import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'

const mealSchema = z.object({
  meals: z.array(z.object({
    title: z.string().min(1),
    ingredients: z.array(z.string().min(1)).min(1),
    steps: z.array(z.string().min(1)).min(1),
  })).min(2).max(3),
})

export const actions: Record<string, ActionHandler<Env>> = {
  generateFridgeMeals: async ({ params, env, callerJwt }) => {
    const ingredients = typeof params.ingredients === 'string' ? params.ingredients.trim() : ''
    const tags = Array.isArray(params.tags)
      ? params.tags.filter((tag): tag is string => typeof tag === 'string')
      : []

    if (!ingredients) return { success: false, error: 'Add at least one ingredient first.' }

    try {
      const ai = createDeepSpaceAI(env, 'anthropic', { authToken: callerJwt })
      const result = await generateObject({
        model: ai('claude-sonnet-5-5'),
        schema: mealSchema,
        prompt: [
          'Create 2 to 3 practical meal ideas using mostly the ingredients available.',
          `Available ingredients: ${ingredients}`,
          tags.length ? `Preferences: ${tags.join(', ')}` : 'Preferences: None',
          'Keep ingredients and steps concise. Use numbered, actionable steps.',
          'Return only meals that are plausible and easy to cook.',
        ].join('\n'),
      })
      return { success: true, data: result.object }
    } catch {
      return { success: false, error: 'The chef could not think of meals right now. Please try again.' }
    }
  },

  remixRecipe: async ({ params, env, callerJwt }) => {
    const tweak = typeof params.tweak === 'string' ? params.tweak.trim() : ''
    const original = params.original

    if (!tweak) return { success: false, error: 'Choose or type a tweak first.' }
    if (!original || typeof original !== 'object') {
      return { success: false, error: 'The original recipe was not available. Please try again.' }
    }

    const originalRecipe = original as { title?: unknown; ingredients?: unknown; steps?: unknown }
    if (
      typeof originalRecipe.title !== 'string'
      || (!Array.isArray(originalRecipe.ingredients) && typeof originalRecipe.ingredients !== 'string')
      || (!Array.isArray(originalRecipe.steps) && typeof originalRecipe.steps !== 'string')
    ) {
      return { success: false, error: 'The original recipe was not available. Please try again.' }
    }

    try {
      const ai = createDeepSpaceAI(env, 'anthropic', { authToken: callerJwt })
      const result = await generateObject({
        model: ai('claude-sonnet-5-5'),
        schema: z.object({
          title: z.string().min(1),
          ingredients: z.array(z.string().min(1)).min(1),
          steps: z.array(z.string().min(1)).min(1),
        }),
        prompt: [
          'Remix this existing recipe using the requested tweak.',
          `Original title: ${originalRecipe.title}`,
          `Original ingredients: ${JSON.stringify(originalRecipe.ingredients)}`,
          `Original steps: ${JSON.stringify(originalRecipe.steps)}`,
          `Tweak: ${tweak}`,
          'Preserve the spirit of the original recipe while applying the tweak clearly.',
        ].join('\n'),
      })
      return { success: true, data: result.object }
    } catch {
      return { success: false, error: 'The remix could not be created right now. Please try again.' }
    }
  },
}
