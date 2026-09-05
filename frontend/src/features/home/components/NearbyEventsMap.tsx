import { useState } from 'react'
import { APIProvider, Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps'
import { mapsApiKey, mapsMapId } from '../../../lib/maps'
import type { NearbyEvent } from '../services/homeApi'

interface Props {
  center: { lat: number; lng: number }
  items: NearbyEvent[]
  joinStatus: Record<string, 'joined' | 'pending'>
  onJoin: (eventId: string) => void
}

function joinLabel(status: 'joined' | 'pending' | undefined): string {
  if (status === 'joined') return 'Joined'
  if (status === 'pending') return 'Requested'
  return 'Join'
}

// hld.md §9 — only ever rendered by NearbyEvents when lib/maps.ts's
// mapsConfigured is true; NearbyEvents itself owns that check so this
// component can assume mapsApiKey is present. Pins double as the entry point
// into the same join flow the list below offers — an InfoWindow positioned
// at the marker's own coordinates (not `anchor`, which needs a marker ref
// per pin) rather than a separate detail view.
export function NearbyEventsMap({ center, items, joinStatus, onJoin }: Props) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  // preciseLocation (not location, which is now just area/city) carries the
  // exact coordinates a pin needs — always populated here since
  // /events/nearby stays exempt from the pre-join area/city-only rule
  // (events.service.ts's listNearbyEvents).
  const located = items.filter(
    (event): event is NearbyEvent & { preciseLocation: NonNullable<NearbyEvent['preciseLocation']> } => event.preciseLocation !== null
  )
  const selected = located.find((event) => event.eventId === selectedEventId) ?? null

  return (
    <APIProvider apiKey={mapsApiKey!}>
      <Map
        defaultCenter={center}
        defaultZoom={12}
        mapId={mapsMapId}
        style={{ width: '100%', height: '240px', borderRadius: '14px' }}
      >
        <AdvancedMarker position={center} title="You" />
        {located.map((event) => (
          <AdvancedMarker
            key={event.eventId}
            position={{ lat: event.preciseLocation.lat, lng: event.preciseLocation.lng }}
            title={event.title ?? event.movieTitle ?? 'Watch party'}
            onClick={() => setSelectedEventId(event.eventId)}
          />
        ))}

        {selected && (
          // Google's InfoWindow chrome is always a light bubble regardless of
          // page theme, so this content stays dark-on-light rather than
          // using the app's usual light-on-dark palette — matching the
          // white background it actually renders on, not fighting it.
          <InfoWindow position={{ lat: selected.preciseLocation.lat, lng: selected.preciseLocation.lng }} onCloseClick={() => setSelectedEventId(null)}>
            <div className="min-w-[160px] p-1 font-sans">
              <strong className="block text-[13px] font-bold text-[#161419]">{selected.title ?? selected.movieTitle ?? 'Watch party'}</strong>
              <p className="mt-1 mb-2.5 text-[11.5px] text-[#5A5766]">{selected.distanceKm} km away</p>
              <button
                type="button"
                disabled={!!joinStatus[selected.eventId]}
                onClick={() => onJoin(selected.eventId)}
                className="w-full rounded-lg bg-accent py-1.5 text-[12px] font-bold text-bg disabled:opacity-60"
              >
                {joinLabel(joinStatus[selected.eventId])}
              </button>
            </div>
          </InfoWindow>
        )}
      </Map>
    </APIProvider>
  )
}
