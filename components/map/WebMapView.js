import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { MAP_DEFAULT_CENTER } from '../../config/mapConfig';

const MAP_HTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body, #map { margin:0; padding:0; width:100%; height:100%; background:#0F172A; }
      .marker {
        width: 36px;
        height: 36px;
        border-radius: 18px;
        background: #2563EB;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Inter', sans-serif;
        font-weight: 600;
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.45);
      }
    </style>
    <link href="https://api.maptiler.com/maps/streets-v2/style.css?key=OgpGCgtItasOMvAnoObf" rel="stylesheet" />
    <script src="https://cdn.maptiler.com/maplibre-gl-js/v3.2.1/maplibre-gl.js"></script>
  </head>
  <body>
    <div id="map"></div>
    <script>
      const MAPTILER_KEY = 'OgpGCgtItasOMvAnoObf';
      const STYLE_URL = 'https://api.maptiler.com/maps/streets-v2/style.json?key=' + MAPTILER_KEY;

      window.onerror = function(message, source, lineno, colno, error) {
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type: 'error',
          payload: { message, source, lineno, colno }
        }));
      };

      window.addEventListener('unhandledrejection', function(event) {
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type: 'error',
          payload: { message: event.reason?.message || 'Unhandled promise rejection' }
        }));
      });

      const map = new maplibregl.Map({
        container: 'map',
        style: STYLE_URL,
        center: ${JSON.stringify([MAP_DEFAULT_CENTER[0], MAP_DEFAULT_CENTER[1]])},
        zoom: 11,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

      map.on('load', () => {
        window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'mapReady' }));
      });

      window.renderMarkers = function(markers) {
        if (!Array.isArray(markers)) return;
        if (window._markerRefs) {
          window._markerRefs.forEach(ref => ref.remove());
        }
        window._markerRefs = [];

        markers.forEach(marker => {
          const el = document.createElement('div');
          el.className = 'marker';
          el.innerText = marker.label || (marker.name ? marker.name[0]?.toUpperCase() : 'S');

          el.addEventListener('click', () => {
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'markerPress',
              payload: marker,
            }));
          });

          const mapMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([marker.longitude, marker.latitude])
            .addTo(map);

          window._markerRefs.push(mapMarker);
        });
      };
    </script>
  </body>
</html>
`;

const sanitizeScriptPayload = (payload) =>
  JSON.stringify(payload).replace(/\\/g, '\\\\').replace(/`/g, '\\`');

export default function WebMapView({ markers = [], onMarkerPress, style }) {
  const webRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  const markerPayload = useMemo(
    () =>
      markers
        .filter(
          (marker) =>
            Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude)
        )
        .map((marker) => ({
          id: marker.id,
          name: marker.name,
          label: marker.name?.[0]?.toUpperCase() || 'S',
          latitude: marker.latitude,
          longitude: marker.longitude,
        })),
    [markers]
  );

  const injectMarkers = useCallback(() => {
    if (!webRef.current || !mapReady) {
      return;
    }
    const script = `
      if (window.renderMarkers) {
        window.renderMarkers(${sanitizeScriptPayload(markerPayload)});
      }
      true;
    `;
    webRef.current.injectJavaScript(script);
  }, [mapReady, markerPayload]);

  const handleMessage = useCallback(
    (event) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);
        if (message.type === 'mapReady') {
          setMapReady(true);
          requestAnimationFrame(() => injectMarkers());
        } else if (message.type === 'error') {
          console.warn('[WebMapView]', message.payload);
        } else if (message.type === 'markerPress' && onMarkerPress) {
          onMarkerPress(message.payload);
        }
      } catch (error) {
        console.warn('Failed to parse map message', error);
      }
    },
    [injectMarkers, onMarkerPress]
  );

  React.useEffect(() => {
    injectMarkers();
  }, [injectMarkers]);

  return (
    <WebView
      ref={webRef}
      originWhitelist={['*']}
      source={{ html: MAP_HTML, baseUrl: 'https://api.maptiler.com/' }}
      onMessage={handleMessage}
      style={[styles.webview, style]}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
});
