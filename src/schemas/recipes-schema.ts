import type { CollectionSchema } from 'deepspace/schema'

export const recipesSchema: CollectionSchema = {
  name: 'recipes',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'ingredients', storage: 'text', interpretation: { kind: 'json' }, required: true },
    { name: 'steps', storage: 'text', interpretation: { kind: 'json' }, required: true },
    { name: 'remixNote', storage: 'text', interpretation: 'plain' },
    { name: 'parentRecipeId', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    '*': { read: false, create: false, update: false, delete: false },
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
