import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useState } from 'react';
import MapView, { Callout, Marker, UrlTile } from 'react-native-maps';
import {
  MAP_DEFAULT_CENTER,
  MAP_TILE_URL_TEMPLATE,
  MAP_TILE_MAX_ZOOM,
} from '../../config/mapConfig';

const FALLBACK_REGION = {
  latitude: MAP_DEFAULT_CENTER[1],
  longitude: MAP_DEFAULT_CENTER[0],
  latitudeDelta: 0.6,
  longitudeDelta: 1,
};

const clampToKazakhstan = ({ latitude, longitude, latitudeDelta, longitudeDelta }) => {
  const minLat = 40;
  const maxLat = 56;
  const minLon = 46;
  const maxLon = 90;
  if (
    latitude < minLat ||
    latitude > maxLat ||
    longitude < minLon ||
    longitude > maxLon
  ) {
    return { ...FALLBACK_REGION };
  }
  return {
    latitude,
    longitude,
    latitudeDelta: Math.max(Math.min(latitudeDelta, 1.8), 0.05),
    longitudeDelta: Math.max(Math.min(longitudeDelta, 2.2), 0.05),
  };
};

const getMarkerLabel = (marker) => {
  if (marker.label) {
    return marker.label;
  }
  if (marker.name) {
    return marker.name.charAt(0).toUpperCase();
  }
  return 'S';
};

const computeInitialRegion = (markers) => {
  if (!markers?.length) {
    return FALLBACK_REGION;
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  markers.forEach((marker) => {
    if (
      Number.isFinite(marker.latitude) &&
      Number.isFinite(marker.longitude)
    ) {
      minLat = Math.min(minLat, marker.latitude);
      maxLat = Math.max(maxLat, marker.latitude);
      minLon = Math.min(minLon, marker.longitude);
      maxLon = Math.max(maxLon, marker.longitude);
    }
  });

  if (!Number.isFinite(minLat)) {
    return FALLBACK_REGION;
  }

  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLon + maxLon) / 2;
  const latitudeDelta = Math.min(Math.max((maxLat - minLat) * 1.4, 0.05), 1.5);
  const longitudeDelta = Math.min(Math.max((maxLon - minLon) * 1.4, 0.05), 1.8);

  return clampToKazakhstan({
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta,
  });
};

export default function TiledMapView({
  markers = [],
  style,
  tileUrlTemplate = MAP_TILE_URL_TEMPLATE,
  maxZoom = MAP_TILE_MAX_ZOOM,
  onMarkerPress,
  onCalloutPress,
  renderMarker,
  renderCallout,
  focusPoint,
  highlightMarkerId,
}) {
  const mapRef = useRef(null);

  const validMarkers = useMemo(() => {
    return markers.filter(
      (marker) =>
        Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude)
    );
  }, [markers]);

  const initialRegion = useMemo(() => computeInitialRegion(validMarkers), [validMarkers]);
  const [region, setRegion] = useState(clampToKazakhstan(initialRegion));

  useEffect(() => {
    if (!mapRef.current || !initialRegion) return;
    const targetRaw =
      validMarkers.length === 1
        ? {
            latitude: validMarkers[0].latitude,
            longitude: validMarkers[0].longitude,
            latitudeDelta: 0.35,
            longitudeDelta: 0.45,
          }
        : initialRegion;
    const target = clampToKazakhstan(targetRaw);
    setRegion(target);
    mapRef.current.animateToRegion(target, 300);
  }, [validMarkers, initialRegion]);

  useEffect(() => {
    if (
      focusPoint &&
      mapRef.current &&
      Number.isFinite(focusPoint.latitude) &&
      Number.isFinite(focusPoint.longitude)
    ) {
      mapRef.current.animateToRegion(
        {
          latitude: focusPoint.latitude,
          longitude: focusPoint.longitude,
          latitudeDelta: 0.045,
          longitudeDelta: 0.045,
        },
        350
      );
    }
  }, [focusPoint]);

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        region={region}
        mapType="none"
        legalLabelInsets={{ top: -100, left: -100, bottom: -100, right: -100 }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        loadingEnabled
        rotateEnabled={false}
      >
        <UrlTile
          urlTemplate={tileUrlTemplate}
          maximumZ={maxZoom}
          tileSize={512}
          zIndex={0}
        />

        {validMarkers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{
              latitude: marker.latitude,
              longitude: marker.longitude,
            }}
            onPress={() => {
              if (onMarkerPress) {
                onMarkerPress(marker);
              }
            }}
            onCalloutPress={() => {
              if (onCalloutPress) {
                onCalloutPress(marker);
              }
            }}
          >
            {renderMarker ? (
              renderMarker(marker)
            ) : (
              <View style={styles.markerWrapper}>
                <View
                  style={[
                    styles.markerBubble,
                    highlightMarkerId === marker.id && styles.markerBubbleActive,
                  ]}
                >
                  <Text style={styles.markerLabel} numberOfLines={2}>
                    {marker.name || getMarkerLabel(marker)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.markerPointer,
                    highlightMarkerId === marker.id && styles.markerPointerActive,
                  ]}
                />
              </View>
            )}
            <Callout tooltip>
              <View style={styles.calloutContainer}>
                {renderCallout ? (
                  renderCallout(marker)
                ) : (
                  <View style={styles.defaultCallout}>
                    <Text style={styles.defaultCalloutTitle}>
                      {marker.name || 'School'}
                    </Text>
                    {marker.address ? (
                      <Text style={styles.defaultCalloutSubtitle}>
                        {marker.address}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.25)',
    backgroundColor: '#0F172A',
  },
  markerWrapper: {
    alignItems: 'center',
  },
  markerBubble: {
    minWidth: 60,
    minHeight: 44,
    borderRadius: 24,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  markerBubbleActive: {
    backgroundColor: '#FB923C',
    shadowColor: '#7c2d12',
  },
  markerLabel: {
    color: '#FFFFFF',
    fontFamily: 'exoSemibold',
    fontSize: 12,
    textAlign: 'center',
  },
  markerPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#4F46E5',
    marginTop: 2,
  },
  markerPointerActive: {
    borderTopColor: '#FB923C',
  },
  calloutContainer: {
    padding: 8,
  },
  defaultCallout: {
    minWidth: 160,
    maxWidth: 220,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  defaultCalloutTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 16,
    color: '#F8FAFC',
  },
  defaultCalloutSubtitle: {
    marginTop: 4,
    fontFamily: 'exo',
    fontSize: 13,
    color: '#CBD5F5',
  },
});
