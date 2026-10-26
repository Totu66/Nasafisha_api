const num = (name: string, fallback: number) => Number(process.env[name] ?? fallback);

export const STALE_MINUTES = num('STALE_MINUTES', 15);
export const MOVING_SPEED_KMH = 5;
export const SERVICING_RADIUS_METERS = 100;
export const POSITION_RETENTION_DAYS = 90;
export const MAX_BATCH = 500;
