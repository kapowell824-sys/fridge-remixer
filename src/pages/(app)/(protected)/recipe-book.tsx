import { useState, type FormEvent } from 'react'
import { getAuthToken, useMutations, useQuery } from 'deepspace'
import { Button, Input, Textarea, useToast } from '@/components/ui'

type Recipe = {
  title: string
  ingredients: string | string[]
  steps: string | string[]
  remixNote?: string
  parentRecipeId?: string
}

type MealIdea = {
  title: string
  ingredients: string[]
  steps: string[]
}

type ActionResponse<T> = {
  success: boolean
  data?: T
  error?: string
}

async function callAction<T>(name: string, body: Record<string, unknown>): Promise<ActionResponse<T>> {
  const token = await getAuthToken()
  if (!token) return { success: false, error: 'Please sign in before using the recipe generator.' }

  const response = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json() as ActionResponse<T>
  if (!response.ok || !payload.success) {
    return { success: false, error: payload.error || 'Something went wrong. Please try again.' }
  }
  return payload
}

function linesToValues(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function asLines(value: string | string[]): string[] {
  return Array.isArray(value) ? value : value ? [value] : []
}

export default function RecipeBookPage() {
  const { records, status, error } = useQuery<Recipe>('recipes', {
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const { createConfirmed, removeConfirmed, ready } = useMutations<Recipe>('recipes')
  const { success, error: toastError } = useToast()

  const [title, setTitle] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [steps, setSteps] = useState('')
  const [remixNote, setRemixNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [fridgeIngredients, setFridgeIngredients] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [mealIdeas, setMealIdeas] = useState<MealIdea[]>([])
  const [generating, setGenerating] = useState(false)
  const [aiError, setAiError] = useState('')
  const [remixingId, setRemixingId] = useState<string | null>(null)
  const [tweak, setTweak] = useState('')
  const [remixLoading, setRemixLoading] = useState(false)
  const [remixError, setRemixError] = useState('')
  const [remixResult, setRemixResult] = useState<(MealIdea & { parentRecipeId: string }) | null>(null)
  const [savingGenerated, setSavingGenerated] = useState<string | null>(null)

  const quickTags = ['Under 20 min', 'Vegetarian', 'High protein']

  async function addRecipe(event: FormEvent) {
    event.preventDefault()
    const ingredientLines = linesToValues(ingredients)
    const stepLines = linesToValues(steps)

    if (!title.trim() || ingredientLines.length === 0 || stepLines.length === 0) return

    setSaving(true)
    try {
      await createConfirmed({
        title: title.trim(),
        ingredients: ingredientLines,
        steps: stepLines,
        remixNote: remixNote.trim() || undefined,
      })
      setTitle('')
      setIngredients('')
      setSteps('')
      setRemixNote('')
      success('Recipe saved')
    } catch (writeError) {
      toastError('Could not save recipe', String(writeError))
    } finally {
      setSaving(false)
    }
  }

  async function deleteRecipe(recordId: string) {
    try {
      await removeConfirmed(recordId)
      success('Recipe deleted')
    } catch (writeError) {
      toastError('Could not delete recipe', String(writeError))
    }
  }

  async function generateMeals(event: FormEvent) {
      event.preventDefault()
      if (!fridgeIngredients.trim()) return

      setGenerating(true)
      setAiError('')
      setMealIdeas([])
      try {
        const result = await callAction<{ meals: MealIdea[] }>('generateFridgeMeals', {
          ingredients: fridgeIngredients.trim(),
          tags: selectedTags,
        })
        if (!result.success || !result.data) {
          setAiError(result.error || 'The chef could not create meal ideas. Please try again.')
        } else {
          setMealIdeas(result.data.meals)
        }
      } catch {
        setAiError('The chef could not create meal ideas. Please try again.')
      } finally {
        setGenerating(false)
      }
  }

  async function saveGeneratedMeal(meal: MealIdea) {
      setSavingGenerated(meal.title)
      try {
        await createConfirmed({
          title: meal.title,
          ingredients: meal.ingredients,
          steps: meal.steps,
        })
        success('Meal saved to Recipe Book')
      } catch (writeError) {
        toastError('Could not save meal', String(writeError))
      } finally {
        setSavingGenerated(null)
      }
  }

  function openRemix(recordId: string) {
      setRemixingId(recordId)
      setTweak('')
      setRemixError('')
      setRemixResult(null)
  }

  async function runRemix(original: Recipe & { recordId: string }) {
      if (!tweak.trim()) return

      setRemixLoading(true)
      setRemixError('')
      setRemixResult(null)
      try {
        const result = await callAction<MealIdea>('remixRecipe', {
          tweak: tweak.trim(),
          original: {
            title: original.title,
            ingredients: original.ingredients,
            steps: original.steps,
          },
        })
        if (!result.success || !result.data) {
          setRemixError(result.error || 'The remix could not be created. Please try again.')
        } else {
          setRemixResult({ ...result.data, parentRecipeId: original.recordId })
        }
      } catch {
        setRemixError('The remix could not be created. Please try again.')
      } finally {
        setRemixLoading(false)
      }
  }

  async function saveRemix() {
      if (!remixResult) return
      setSavingGenerated(`remix-${remixResult.parentRecipeId}`)
      try {
        await createConfirmed({
          title: remixResult.title,
          ingredients: remixResult.ingredients,
          steps: remixResult.steps,
          remixNote: tweak.trim(),
          parentRecipeId: remixResult.parentRecipeId,
        })
        success('Remix saved to Recipe Book')
        setRemixingId(null)
        setRemixResult(null)
      } catch (writeError) {
        toastError('Could not save remix', String(writeError))
      } finally {
        setSavingGenerated(null)
      }
    }

  return (
    <div className="min-h-full bg-[#f7f3ea] text-[#263327]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#71806f]">My kitchen</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">Recipe Book</h1>
        </header>

        <section className="mb-8 rounded-2xl border border-[#ded8ca] bg-white p-5 shadow-sm">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#71806f]">AI meal helper</p>
            <h2 className="mt-1 text-2xl font-semibold">What&apos;s in my fridge?</h2>
          </div>
          <form className="mt-5" onSubmit={generateMeals}>
            <Textarea
              value={fridgeIngredients}
              onChange={(event) => setFridgeIngredients(event.target.value)}
              placeholder={'eggs\nspinach\nchicken thighs\nleftover rice'}
              className="min-h-24"
              aria-label="Ingredients in my fridge"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {quickTags.map((tag) => {
                const selected = selectedTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setSelectedTags((current) =>
                        selected ? current.filter((item) => item !== tag) : [...current, tag],
                      )
                    }
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      selected
                        ? 'border-[#d95d39] bg-[#f8eee9] text-[#b44a32]'
                        : 'border-[#d9d2c3] text-[#64705f] hover:bg-[#f7f3ea]'
                    }`}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
            <Button
              type="submit"
              loading={generating}
              disabled={!ready || generating || !fridgeIngredients.trim()}
              className="mt-4 bg-[#d95d39] text-white hover:bg-[#c95231]"
            >
              Generate meal ideas
            </Button>
          </form>

          {aiError && (
            <div role="alert" className="mt-4 rounded-lg border border-[#e8b9aa] bg-[#fff7f3] px-4 py-3 text-sm text-[#9f402b]">
              {aiError}
            </div>
          )}

          {generating && (
            <div className="mt-5 grid gap-4 md:grid-cols-3" aria-label="Generating meal ideas">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-36 animate-pulse rounded-xl bg-[#f1ede4]" />
              ))}
            </div>
          )}

          {mealIdeas.length > 0 && (
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {mealIdeas.map((meal) => (
                <article key={meal.title} className="flex flex-col rounded-xl border border-[#ded8ca] p-4">
                  <h3 className="font-semibold">{meal.title}</h3>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#71806f]">Ingredients</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {meal.ingredients.map((ingredient, index) => <li key={`${ingredient}-${index}`}>{ingredient}</li>)}
                  </ul>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#71806f]">Steps</p>
                  <ol className="mt-2 flex-1 list-decimal space-y-1 pl-5 text-sm">
                    {meal.steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}
                  </ol>
                  <Button
                    type="button"
                    variant="outline"
                    loading={savingGenerated === meal.title}
                    disabled={!ready || savingGenerated !== null}
                    onClick={() => saveGeneratedMeal(meal)}
                    className="mt-4"
                  >
                    Save to Recipe Book
                  </Button>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="h-fit rounded-2xl border border-[#ded8ca] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Add a recipe</h2>
            <form className="mt-5 space-y-4" onSubmit={addRecipe}>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Title</span>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Lemon herb pasta"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Ingredients</span>
                <Textarea
                  value={ingredients}
                  onChange={(event) => setIngredients(event.target.value)}
                  placeholder={'Pasta\nLemon\nFresh herbs'}
                  className="min-h-28"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Steps</span>
                <Textarea
                  value={steps}
                  onChange={(event) => setSteps(event.target.value)}
                  placeholder={'Boil the pasta\nToss with lemon and herbs'}
                  className="min-h-28"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Remix note <span className="font-normal text-[#7a8177]">(optional)</span></span>
                <Textarea
                  value={remixNote}
                  onChange={(event) => setRemixNote(event.target.value)}
                  placeholder="Add leftover vegetables"
                  className="min-h-20"
                />
              </label>
              <Button
                type="submit"
                loading={saving}
                disabled={!ready || saving}
                className="w-full bg-[#d95d39] text-white hover:bg-[#c95231]"
              >
                Save recipe
              </Button>
            </form>
          </section>

          <section data-testid="saved-recipes">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Saved recipes</h2>
              <span className="text-sm text-[#7a8177]">{records.length} {records.length === 1 ? 'recipe' : 'recipes'}</span>
            </div>

            {status === 'loading' && <p className="text-[#7a8177]">Loading recipes...</p>}
            {status === 'error' && <p className="text-[#b44a32]">Could not load recipes: {String(error)}</p>}
            {status === 'ready' && records.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#cfc7b7] px-6 py-14 text-center">
                <p className="font-medium">Your recipe book is empty</p>
                <p className="mt-1 text-sm text-[#7a8177]">Add your first recipe to get started.</p>
              </div>
            )}

            <div className="grid gap-4">
              {records.map((recipe) => (
                <article
                  key={recipe.recordId}
                  data-testid="recipe-card"
                  className="rounded-2xl border border-[#ded8ca] bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-xl font-semibold">{recipe.data.title}</h3>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openRemix(recipe.recordId)}
                        className="text-[#64705f] hover:bg-[#f1ede4]"
                      >
                        Remix
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteRecipe(recipe.recordId)}
                        className="text-[#b44a32] hover:bg-[#f8eee9] hover:text-[#9f402b]"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  {recipe.data.remixNote && (
                    <p className="mt-2 rounded-lg bg-[#f7f3ea] px-3 py-2 text-sm text-[#64705f]">
                      <span className="font-semibold">Remix:</span> {recipe.data.remixNote}
                    </p>
                  )}
                  <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#71806f]">Ingredients</h4>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                        {asLines(recipe.data.ingredients).map((ingredient, index) => (
                          <li key={`${ingredient}-${index}`}>{ingredient}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#71806f]">Steps</h4>
                      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                        {asLines(recipe.data.steps).map((step, index) => (
                          <li key={`${step}-${index}`}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  {remixingId === recipe.recordId && (
                    <div className="mt-5 rounded-xl border border-[#d9d2c3] bg-[#fbfaf6] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-semibold">Remix this recipe</h4>
                        <button
                          type="button"
                          onClick={() => setRemixingId(null)}
                          className="text-sm text-[#71806f] hover:text-[#263327]"
                        >
                          Close
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {['Make it spicier', 'Fewer dishes', 'Swap an ingredient'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setTweak(preset)}
                            className={`rounded-full border px-3 py-1.5 text-sm ${
                              tweak === preset
                                ? 'border-[#d95d39] bg-[#f8eee9] text-[#b44a32]'
                                : 'border-[#d9d2c3] text-[#64705f]'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                      <Input
                        value={tweak}
                        onChange={(event) => setTweak(event.target.value)}
                        placeholder="Type a tweak..."
                        className="mt-3 bg-white"
                      />
                      <Button
                        loading={remixLoading}
                        disabled={!tweak.trim() || remixLoading}
                        onClick={() => runRemix({ ...recipe.data, recordId: recipe.recordId })}
                        className="mt-3 bg-[#d95d39] text-white hover:bg-[#c95231]"
                      >
                        Create remix
                      </Button>

                      {remixError && (
                        <div role="alert" className="mt-3 rounded-lg border border-[#e8b9aa] bg-[#fff7f3] px-3 py-2 text-sm text-[#9f402b]">
                          {remixError}
                        </div>
                      )}

                      {remixResult && (
                        <div className="mt-4 rounded-lg border border-[#ded8ca] bg-white p-4">
                          <h5 className="text-lg font-semibold">{remixResult.title}</h5>
                          <div className="mt-3 grid gap-4 sm:grid-cols-2">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#71806f]">Ingredients</p>
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                                {remixResult.ingredients.map((ingredient, index) => (
                                  <li key={`${ingredient}-${index}`}>{ingredient}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#71806f]">Steps</p>
                              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                                {remixResult.steps.map((step, index) => (
                                  <li key={`${step}-${index}`}>{step}</li>
                                ))}
                              </ol>
                            </div>
                          </div>
                          <Button
                            loading={savingGenerated === `remix-${recipe.recordId}`}
                            disabled={!ready || savingGenerated !== null}
                            onClick={saveRemix}
                            className="mt-4"
                            variant="outline"
                          >
                            Save remix to Recipe Book
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
