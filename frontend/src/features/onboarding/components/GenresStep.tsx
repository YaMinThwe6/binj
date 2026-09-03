import { updateMe } from '../../../lib/api'
import { MultiSelectStep } from './MultiSelectStep'
import { GENRE_OPTIONS } from '../constants'

interface Props {
  initialSelected?: string[]
  onDone: (genres: string[]) => void
  onBack?: (genres: string[]) => void
}

export function GenresStep({ initialSelected, onDone, onBack }: Props) {
  return (
    <MultiSelectStep
      step={2}
      title="What are you into?"
      subtitle="Select your favorite genres (optional)"
      desktopTitle="Taste in, noise out."
      desktopSubtitle="A few favorite genres help us skip the recommendations you'd never watch."
      options={GENRE_OPTIONS.map((g) => ({ value: g, label: g }))}
      initialSelected={initialSelected}
      onContinue={async (selected) => {
        await updateMe({ favoriteGenres: selected.length > 0 ? selected : null })
        onDone(selected)
      }}
      onSkip={() => onDone([])}
      onBack={onBack}
    />
  )
}
