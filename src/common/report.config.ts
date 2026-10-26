const num = (name: string, fallback: number) =>
  Number(process.env[name] ?? fallback);

export const CLUSTER_RADIUS_METERS = num('CLUSTER_RADIUS_METERS', 50);
export const CLUSTER_WINDOW_HOURS = num('CLUSTER_WINDOW_HOURS', 72);
export const CLOSURE_RADIUS_METERS = num('CLOSURE_RADIUS_METERS', 100);
export const DUMPING_SITE_RADIUS_METERS = num('DUMPING_SITE_RADIUS_METERS', 50);
export const HOTSPOT_MIN_REPORTS = num('HOTSPOT_MIN_REPORTS', 3);
export const HOTSPOT_WINDOW_DAYS = num('HOTSPOT_WINDOW_DAYS', 90);
export const BOX_DEGREES = 0.003;
