import { useState } from 'react'
import { UsernameStep } from './UsernameStep'
import { GenresStep } from './GenresStep'
import { LanguageStep } from './LanguageStep'
import { WatchedStep } from './WatchedStep'
import { CelebritiesStep } from './CelebritiesStep'
import { SuccessStep } from './SuccessStep'
import { buildFirstGreeting } from '../greeting'
import type { MovieCandidate } from '../services/onboardingApi'

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
  const [watched, setWatched] = useState<MovieCandidate[]>([])
  const [followedIds, setFollowedIds] = useState<string[]>([])
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
          initialSelected={genres}
          onDone={(selected) => {
            setGenres(selected)
            setStep('language')
          }}
          onBack={(selected) => {
            setGenres(selected)
            setStep('username')
          }}
        />
      )
    case 'language':
      return (
        <LanguageStep
          initialSelected={languages}
          onDone={(selected) => {
            setLanguages(selected)
            setStep('watched')
          }}
          onBack={(selected) => {
            setLanguages(selected)
            setStep('genres')
          }}
        />
      )
    case 'watched':
      return (
        <WatchedStep
          genres={genres}
          languages={languages}
          initialWatched={watched}
          onContinue={(items) => {
            setWatched(items)
            setGreeting(buildFirstGreeting(items))
            setStep('celebrities')
          }}
          onSkip={(items) => {
            setWatched(items)
            setStep('celebrities')
          }}
          onBack={(items) => {
            setWatched(items)
            setStep('language')
          }}
        />
      )
    case 'celebrities':
      return (
        <CelebritiesStep
          initialFollowedIds={followedIds}
          onContinue={(ids) => {
            setFollowedIds(ids)
            setStep('success')
          }}
          onSkip={(ids) => {
            setFollowedIds(ids)
            setStep('success')
          }}
          onBack={(ids) => {
            setFollowedIds(ids)
            setStep('watched')
          }}
        />
      )
    case 'success':
      return <SuccessStep greeting={greeting} displayName={displayName} onComplete={onComplete} />
  }
}
