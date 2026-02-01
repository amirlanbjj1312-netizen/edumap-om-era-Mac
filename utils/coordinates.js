export const DEFAULT_MAP_TILE_SIZE = 1024;

export const parseCoordinate = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const hasValidCoordinates = (latitude, longitude) => {
  return Number.isFinite(latitude) && Number.isFinite(longitude);
};

export const splitToList = (value) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length);

export const projectLatLngToPoint = (
  latitude,
  longitude,
  tileSize = DEFAULT_MAP_TILE_SIZE,
  bounds
) => {
  if (!hasValidCoordinates(latitude, longitude)) {
    return null;
  }

  if (bounds) {
    const { west, east, south, north } = bounds;
    if (
      !Number.isFinite(west) ||
      !Number.isFinite(east) ||
      !Number.isFinite(south) ||
      !Number.isFinite(north) ||
      east === west ||
      north === south
    ) {
      return null;
    }

    const clampedLon = clamp(longitude, west, east);
    const clampedLat = clamp(latitude, south, north);

    const x = ((clampedLon - west) / (east - west)) * tileSize;
    const y = ((north - clampedLat) / (north - south)) * tileSize;

    return { x, y };
  }

  const x = ((longitude + 180) / 360) * tileSize;
  const y = ((90 - latitude) / 180) * tileSize;

  return { x, y };
};

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
