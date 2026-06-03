import Constants from 'expo-constants';

const DEFAULT_STYLE_URL = 'https://demotiles.maplibre.org/style.json';
// 2GIS raster tiles — best coverage for Kazakhstan, Russian labels, no WebView needed
const DEFAULT_TILE_URL_TEMPLATE = 'https://tile0.maps.2gis.com/tiles?x={x}&y={y}&z={z}';
const DEFAULT_CENTER = [71.44598, 51.169392]; // Astana approximate
const DEFAULT_ZOOM = 11;
const DEFAULT_TILE_MAX_ZOOM = 18;

const resolveExtraValue = (value) => {
  if (!value) {
    return undefined;
  }

  // Ignore unresolved template strings like ${VAR}
  if (value.startsWith('${') && value.endsWith('}')) {
    return undefined;
  }

  return value;
};

const extra =
  Constants?.expoConfig?.extra ??
  Constants?.manifest?.extra ??
  Constants?.manifest2?.extraParameters?.expoClient?.extra ??
  {};

export const MAP_STYLE_URL =
  resolveExtraValue(extra.mapStyleUrl) || DEFAULT_STYLE_URL;

const resolveTileTemplate = () => {
  const explicitTileUrl = resolveExtraValue(extra.mapTileUrl);
  if (explicitTileUrl) {
    return explicitTileUrl;
  }

  try {
    const styleUrl = new URL(MAP_STYLE_URL);
    const { origin, pathname, searchParams } = styleUrl;

    const mapTilerKey = searchParams.get('key');
    if (origin.includes('maptiler.com') && mapTilerKey) {
      const stylePath = pathname.split('/').filter(Boolean);
      // path: maps/{styleId}/style.json
      const styleId = stylePath.length >= 2 ? stylePath[1] : 'darkmatter';
      return `${origin}/maps/${styleId}/{z}/{x}/{y}.png?key=${mapTilerKey}`;
    }
  } catch {
    // ignore parsing errors, fall back to default tiles
  }

  return DEFAULT_TILE_URL_TEMPLATE;
};

export const MAP_DEFAULT_CENTER = DEFAULT_CENTER;
export const MAP_DEFAULT_ZOOM = DEFAULT_ZOOM;
export const MAP_TILE_URL_TEMPLATE = resolveTileTemplate();
export const MAP_TILE_MAX_ZOOM =
  typeof extra.mapTileMaxZoom === 'number' ? extra.mapTileMaxZoom : DEFAULT_TILE_MAX_ZOOM;
