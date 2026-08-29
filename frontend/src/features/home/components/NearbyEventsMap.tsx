import { useState } from 'react'
import { APIProvider, Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps'
import { mapsApiKey } from '../../../lib/maps'
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
  const located = items.filter((event): event is NearbyEvent & { location: NonNullable<NearbyEvent['location']> } => event.location !== null)
  const selected = located.find((event) => event.eventId === selectedEventId) ?? null

  return (
    <APIProvider apiKey={mapsApiKey!}>
      <Map
        defaultCenter={center}
        defaultZoom={12}
        mapId="binj-nearby-events"
        style={{ width: '100%', height: '240px', borderRadius: '14px' }}
      >
        <AdvancedMarker position={center} title="You" />
        {located.map((event) => (
          <AdvancedMarker
            key={event.eventId}
            position={{ lat: event.location.lat, lng: event.location.lng }}
            title={event.title ?? event.movieTitle ?? 'Watch party'}
            onClick={() => setSelectedEventId(event.eventId)}
          />
        ))}

        {selected && (
          <InfoWindow position={{ lat: selected.location.lat, lng: selected.location.lng }} onCloseClick={() => setSelectedEventId(null)}>
            <div className="map-info-window">
              <strong>{selected.title ?? selected.movieTitle ?? 'Watch party'}</strong>
              <p>{selected.distanceKm} km away</p>
              <button
                type="button"
                disabled={!!joinStatus[selected.eventId]}
                onClick={() => onJoin(selected.eventId)}
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
