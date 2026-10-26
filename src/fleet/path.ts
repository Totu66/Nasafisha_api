export type LatLng = [number, number];

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function haversine(a: LatLng, b: LatLng): number {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function pathLength(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += haversine(path[i - 1], path[i]);
  return total;
}

export function distanceToPath(p: LatLng, path: LatLng[]): number {
  if (path.length === 0) return Infinity;
  if (path.length === 1) return haversine(p, path[0]);

  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    best = Math.min(best, distanceToSegment(p, path[i], path[i + 1]));
  }
  return best;
}

function distanceToSegment(p: LatLng, a: LatLng, b: LatLng): number {
  const k = Math.cos(rad(p[0]));
  const ax = (a[1] - p[1]) * k;
  const ay = a[0] - p[0];
  const bx = (b[1] - p[1]) * k;
  const by = b[0] - p[0];

  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;

  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));

  return Math.hypot(ax + t * dx, ay + t * dy) * (Math.PI / 180) * EARTH_RADIUS_M;
}
