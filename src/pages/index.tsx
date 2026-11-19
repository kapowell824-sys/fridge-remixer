/**
 * Landing page — a STATIC page.
 *
 * It lives at the top level of src/pages/ (not under (app)/), so it renders
 * with no DeepSpace providers: no auth session fetch, no records WebSocket.
 * That makes it cheap to serve and safe for logged-out / crawler traffic.
 *
 * Need live data or auth here? Move this file to src/pages/(app)/index.tsx
 * and it becomes a dynamic page. Conversely, any page you want to keep static
 * (marketing, docs, legal) belongs at this top level.
 *
 * Top-level pages are also prerendered to static HTML at build
 * (prerender.ts, via vite.config.ts) so crawlers read real content.
 * Keep them renderable without a browser: no window/document during render,
 * prose in HTML text, reveal animations in CSS keyframes rather than JS-driven
 * initial states. `<Seo>` comes first and reads src/seo.ts.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { APP_NAME } from '../constants'
import { seo } from '../seo'

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="min-h-screen bg-[#f7f3ea] text-[#263327]">
        <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.24em] text-[#71806f]">
              {APP_NAME}
            </p>
            <h1 className="text-5xl font-bold leading-[0.98] tracking-tight sm:text-7xl">
              Turn what&apos;s left in the fridge into dinner.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#5f6a5d]">
              Save your family favorites and keep a personal collection of recipes ready for your next remix.
            </p>
            <Link
              to="/recipe-book"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#d95d39] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
            >
              Open Recipe Book
            </Link>
          </div>
        </main>
      </div>
    </>
  )
}
