import { useState } from 'react'
import { UsernameStep } from './UsernameStep'
import { GenresStep } from './GenresStep'
import { LanguageStep } from './LanguageStep'
import { WatchedStep } from './WatchedStep'
import { CelebritiesStep } from './CelebritiesStep'
import { SuccessStep } from './SuccessStep'
import { buildFirstGreeting } from '../greeting'

type Step = 'username' | 'genres' | 'language' | 'watched' | 'celebrities' | 'success'

interface Props {
  initialDisplayName: string
  email: string
  onComplete: () => void
}

export function OnboardingWizard({ initialDisplayName, email, onComplete }: Props) {
  const [step, setStep] = useState<Step>('username')
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [username, setUsername] = useState('')
  const [genres, setGenres] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [greeting, setGreeting] = useState<string | null>(null)

  switch (step) {
    case 'username':
      return (
        <UsernameStep
          initialDisplayName={initialDisplayName}
          initialUsername={username}
          email={email}
          onDone={(name, savedUsername) => {
            setDisplayName(name)
            setUsername(savedUsername)
            setStep('genres')
          }}
        />
      )
    case 'genres':
      return (
        <GenresStep
          onDone={(selected) => {
            setGenres(selected)
            setStep('language')
          }}
          onBack={() => setStep('username')}
        />
      )
    case 'language':
      return (
        <LanguageStep
          onDone={(selected) => {
            setLanguages(selected)
            setStep('watched')
          }}
          onBack={() => setStep('genres')}
        />
      )
    case 'watched':
      return (
        <WatchedStep
          genres={genres}
          languages={languages}
          onContinue={(watched) => {
            setGreeting(buildFirstGreeting(watched))
            setStep('celebrities')
          }}
          onSkip={() => setStep('celebrities')}
          onBack={() => setStep('language')}
        />
      )
    case 'celebrities':
      return (
        <CelebritiesStep
          onContinue={() => setStep('success')}
          onSkip={() => setStep('success')}
          onBack={() => setStep('watched')}
        />
      )
    case 'success':
      return <SuccessStep greeting={greeting} displayName={displayName} onComplete={onComplete} />
  }
}
