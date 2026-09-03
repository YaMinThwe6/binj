import { useNavigate } from 'react-router-dom'

// Guest-only right-rail teaser for the "People you might vibe with" feature
// (Home's own PeopleYouMightVibeWith, signed-in only). Deliberately NOT
// fabricated names/match percentages — there's no real matching without an
// account to match against, so showing sample data here would read as fake
// social proof to a visitor. A loading-style skeleton plus one honest CTA
// instead of a per-row claim.
export function DiscoverPeopleTeaser() {
  const navigate = useNavigate()

  return (
    <section>
      <h2 className="mb-3.5 text-[13.5px] font-bold text-text">People you might vibe with</h2>
      <ul className="flex flex-col gap-3.5">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-2.5">
            <div className="h-9.5 w-9.5 flex-none animate-pulse rounded-full bg-surface-alt" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-surface-alt" />
              <div className="h-2 w-2/5 animate-pulse rounded-full bg-surface-alt" />
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => navigate('/get-started')}
        className="mt-4 w-full rounded-[10px] border border-accent py-2.5 text-[12px] font-bold text-accent"
      >
        Sign up / sign in to view
      </button>
    </section>
  )
}
