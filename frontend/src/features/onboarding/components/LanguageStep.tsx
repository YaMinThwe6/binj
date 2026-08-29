import { updateMe } from '../../../lib/api'
import { MultiSelectStep } from './MultiSelectStep'
import { LANGUAGE_OPTIONS } from '../constants'

interface Props {
  onDone: (languages: string[]) => void
}

export function LanguageStep({ onDone }: Props) {
  return (
    <MultiSelectStep
      title="What do you watch?"
      subtitle="Select the languages/regions of cinema you watch (optional) — not a dubbing preference"
      options={LANGUAGE_OPTIONS.map((l) => ({ value: l.code, label: l.label }))}
      onContinue={async (selected) => {
        await updateMe({ preferredLanguages: selected.length > 0 ? selected : null })
        onDone(selected)
      }}
      onSkip={() => onDone([])}
    />
  )
}
