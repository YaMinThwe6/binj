import { updateMe } from '../../../lib/api'
import { MultiSelectStep } from './MultiSelectStep'
import { GENRE_OPTIONS } from '../constants'

interface Props {
  onDone: (genres: string[]) => void
  onBack?: () => void
}

export function GenresStep({ onDone, onBack }: Props) {
  return (
    <MultiSelectStep
      step={2}
      title="What are you into?"
      subtitle="Select your favorite genres (optional)"
      desktopTitle="Taste in, noise out."
      desktopSubtitle="A few favorite genres help us skip the recommendations you'd never watch."
      options={GENRE_OPTIONS.map((g) => ({ value: g, label: g }))}
      onContinue={async (selected) => {
        await updateMe({ favoriteGenres: selected.length > 0 ? selected : null })
        onDone(selected)
      }}
      onSkip={() => onDone([])}
      onBack={onBack}
    />
  )
}
