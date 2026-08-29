// Minimal, self-contained geohash + distance helpers for hld.md paragraph 9's
// location-based discovery. Deliberately not a dependency (e.g. GeoFirestore)
// -- geohash encoding is ~30 lines of well-known bit-interleaving, and pulling
// in a library (plus its own Firestore-binding assumptions) isn't worth it
// for the handful of operations actually needed here.

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

// Standard geohash encode (base32, bit-interleaved lng/lat). Reference vector
// used in tests: (42.6, -5.6) -> "ezs42", the canonical example from the
// original geohash.org write-up.
export function encodeGeohash(lat: number, lng: number, precision = 9): string {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let isEvenBit = true;
  let bit = 0;
  let charIndex = 0;
  let geohash = "";

  while (geohash.length < precision) {
    if (isEvenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        charIndex = (charIndex << 1) | 1;
        lngMin = mid;
      } else {
        charIndex = charIndex << 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        charIndex = (charIndex << 1) | 1;
        latMin = mid;
      } else {
        charIndex = charIndex << 1;
        latMax = mid;
      }
    }
    isEvenBit = !isEvenBit;

    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32[charIndex];
      bit = 0;
      charIndex = 0;
    }
  }

  return geohash;
}

// Approximate cell width (km) at the equator, index 0 = precision 1.
// Only used to pick a "good enough" precision for a given search radius --
// the resulting query is an approximation of a bounding box, not an exact
// radius match; results are still distance-filtered afterward.
const CELL_WIDTH_KM = [5000, 1250, 156, 39, 4.9, 1.2, 0.153, 0.038, 0.0095];

export function geohashPrecisionForRadiusKm(radiusKm: number): number {
  const minCellKm = radiusKm * 2; // cell should comfortably contain the search diameter
  let precision = 1;
  for (let p = CELL_WIDTH_KM.length; p >= 1; p--) {
    if (CELL_WIDTH_KM[p - 1] >= minCellKm) {
      precision = p;
      break;
    }
  }
  return precision;
}

const PREFIX_RANGE_SUFFIX = String.fromCharCode(0xf8ff); // high private-use codepoint

// Firestore has no native "starts with" query -- the standard prefix-range
// trick, appending a very high codepoint so `end` sorts after every
// realistic geohash character. `where("geohash", ">=", start).where("geohash", "<", end)`
// then matches exactly the docs whose geohash starts with `prefix`.
export function geohashPrefixRange(prefix: string): { start: string; end: string } {
  return { start: prefix, end: prefix + PREFIX_RANGE_SUFFIX };
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Haversine great-circle distance, in km. Used to post-filter/sort the
// geohash-range query's results down to an actual radius, since the geohash
// cell itself is only an approximate bounding box.
export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const EARTH_RADIUS_KM = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}
