import { updateMe } from '../../../lib/api'
import { MultiSelectStep } from './MultiSelectStep'
import { GENRE_OPTIONS } from '../constants'

interface Props {
  onDone: (genres: string[]) => void
}

export function GenresStep({ onDone }: Props) {
  return (
    <MultiSelectStep
      title="What are you into?"
      subtitle="Select your favorite genres (optional)"
      options={GENRE_OPTIONS.map((g) => ({ value: g, label: g }))}
      onContinue={async (selected) => {
        await updateMe({ favoriteGenres: selected.length > 0 ? selected : null })
        onDone(selected)
      }}
      onSkip={() => onDone([])}
    />
  )
}
