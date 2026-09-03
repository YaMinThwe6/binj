import { updateMe } from '../../../lib/api'
import { MultiSelectStep } from './MultiSelectStep'
import { LANGUAGE_OPTIONS } from '../constants'

interface Props {
  onDone: (languages: string[]) => void
  onBack?: () => void
}

export function LanguageStep({ onDone, onBack }: Props) {
  return (
    <MultiSelectStep
      step={3}
      title="What do you watch?"
      subtitle="Select the languages/regions of cinema you watch (optional) — not a dubbing preference"
      desktopTitle="Cinema without borders."
      desktopSubtitle="Tell us which languages and regions of film you watch — not a dubbing preference."
      options={LANGUAGE_OPTIONS.map((l) => ({ value: l.code, label: l.label }))}
      onContinue={async (selected) => {
        await updateMe({ preferredLanguages: selected.length > 0 ? selected : null })
        onDone(selected)
      }}
      onSkip={() => onDone([])}
      onBack={onBack}
    />
  )
}
