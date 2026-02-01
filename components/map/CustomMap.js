import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
  PanResponder,
} from 'react-native';
import {
  DEFAULT_MAP_TILE_SIZE,
  projectLatLngToPoint,
} from '../../utils/coordinates';

const DEFAULT_MARKER_SIZE = 40;
const ZOOM_STEP = 1.2;

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

const defaultBackground = require('../../assets/images/map-placeholder.png');

const getMarkerLabel = (marker) => {
  if (marker.label) {
    return marker.label;
  }
  if (marker.name) {
    return marker.name.charAt(0).toUpperCase();
  }
  return 'S';
};

export default function CustomMap({
  markers = [],
  backgroundSource = defaultBackground,
  tileSize = DEFAULT_MAP_TILE_SIZE,
  minScale = 1,
  maxScale = 3,
  markerSize = DEFAULT_MARKER_SIZE,
  bounds,
  backgroundComponent,
  onMarkerPress,
  renderMarker,
  renderCallout,
  style,
}) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [activeMarkerId, setActiveMarkerId] = useState(null);

  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const scaleValue = useRef(1);
  const translateValue = useRef({ x: 0, y: 0 });

  const handleLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== layout.width || height !== layout.height) {
      setLayout({ width, height });
      translateValue.current = { x: 0, y: 0 };
      translateX.setValue(0);
      translateY.setValue(0);
    }
  };

  const clampTranslation = useCallback(
    (x, y, currentScale = scaleValue.current) => {
      if (!layout.width || !layout.height) {
        return { x, y };
      }

      const scaledWidth = layout.width * currentScale;
      const scaledHeight = layout.height * currentScale;

      const maxOffsetX = Math.max(0, (scaledWidth - layout.width) / 2);
      const maxOffsetY = Math.max(0, (scaledHeight - layout.height) / 2);

      return {
        x: clamp(x, -maxOffsetX, maxOffsetX),
        y: clamp(y, -maxOffsetY, maxOffsetY),
      };
    },
    [layout.height, layout.width]
  );

  const setScale = useCallback(
    (nextScale) => {
      const clampedScale = clamp(nextScale, minScale, maxScale);
      scaleValue.current = clampedScale;
      scale.setValue(clampedScale);

      const adjustedTranslation = clampTranslation(
        translateValue.current.x,
        translateValue.current.y,
        clampedScale
      );

      translateValue.current = adjustedTranslation;
      translateX.setValue(adjustedTranslation.x);
      translateY.setValue(adjustedTranslation.y);
    },
    [clampTranslation, maxScale, minScale, scale, translateX, translateY]
  );

  const handleZoomIn = useCallback(() => {
    setScale(scaleValue.current * ZOOM_STEP);
  }, [setScale]);

  const handleZoomOut = useCallback(() => {
    setScale(scaleValue.current / ZOOM_STEP);
  }, [setScale]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
        onPanResponderMove: (_, gesture) => {
          if (!layout.width || !layout.height) {
            return;
          }
          const nextX = translateValue.current.x + gesture.dx;
          const nextY = translateValue.current.y + gesture.dy;
          const clamped = clampTranslation(nextX, nextY);
          translateX.setValue(clamped.x);
          translateY.setValue(clamped.y);
        },
        onPanResponderRelease: (_, gesture) => {
          const nextX = translateValue.current.x + gesture.dx;
          const nextY = translateValue.current.y + gesture.dy;
          const clamped = clampTranslation(nextX, nextY);
          translateValue.current = clamped;
          translateX.setValue(clamped.x);
          translateY.setValue(clamped.y);
        },
        onPanResponderTerminate: (_, gesture) => {
          const nextX = translateValue.current.x + gesture.dx;
          const nextY = translateValue.current.y + gesture.dy;
          const clamped = clampTranslation(nextX, nextY);
          translateValue.current = clamped;
          translateX.setValue(clamped.x);
          translateY.setValue(clamped.y);
        },
      }),
    [clampTranslation, layout.height, layout.width, translateX, translateY]
  );

  const projectedMarkers = useMemo(() => {
    if (!layout.width || !layout.height) {
      return [];
    }

    return markers
      .map((marker) => {
        const { latitude, longitude } = marker;
        const projected = projectLatLngToPoint(
          latitude,
          longitude,
          tileSize,
          bounds
        );
        if (!projected) {
          return null;
        }

        const x =
          (projected.x / tileSize) * layout.width - markerSize / 2;
        const y =
          (projected.y / tileSize) * layout.height - markerSize;

        return {
          ...marker,
          x,
          y,
          centerX: x + markerSize / 2,
          centerY: y + markerSize / 2,
        };
      })
      .filter(Boolean);
  }, [layout.height, layout.width, markerSize, markers, tileSize]);

  const activeMarker = useMemo(
    () => projectedMarkers.find((marker) => marker.id === activeMarkerId),
    [activeMarkerId, projectedMarkers]
  );

  const handleMarkerPress = (marker) => {
    setActiveMarkerId((prev) => (prev === marker.id ? null : marker.id));
    if (onMarkerPress) {
      onMarkerPress(marker);
    }
  };

  const renderDefaultMarker = (marker) => (
    <View style={styles.defaultMarker}>
      <Text style={styles.defaultMarkerLabel}>{getMarkerLabel(marker)}</Text>
    </View>
  );

  const renderDefaultCallout = (marker) => (
    <View style={styles.callout}>
      <Text style={styles.calloutTitle}>{marker.name || 'School'}</Text>
      {marker.city ? (
        <Text style={styles.calloutSubtitle}>{marker.city}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      {layout.width > 0 && layout.height > 0 ? (
        <>
          <Animated.View
            style={[
              styles.mapSurface,
              {
                width: layout.width,
                height: layout.height,
                transform: [
                  { translateX },
                  { translateY },
                  { scale },
                ],
              },
            ]}
            {...panResponder.panHandlers}
          >
            {backgroundComponent ? (
              <View style={StyleSheet.absoluteFill}>{backgroundComponent}</View>
            ) : (
              <ImageBackground
                source={backgroundSource}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            )}

            {projectedMarkers.map((marker) => (
              <Pressable
                key={marker.id}
                onPress={() => handleMarkerPress(marker)}
                style={[
                  styles.markerWrapper,
                  {
                    left: marker.x,
                    top: marker.y,
                    width: markerSize,
                    height: markerSize,
                  },
                ]}
              >
                {renderMarker
                  ? renderMarker(marker)
                  : renderDefaultMarker(marker)}
              </Pressable>
            ))}

            {activeMarker ? (
              <View
                style={[
                  styles.calloutWrapper,
                  {
                    left: activeMarker.centerX,
                    top: activeMarker.centerY - markerSize,
                  },
                ]}
              >
                {renderCallout
                  ? renderCallout(activeMarker)
                  : renderDefaultCallout(activeMarker)}
              </View>
            ) : null}
          </Animated.View>

          <View style={styles.zoomControls}>
            <Pressable
              style={styles.zoomButton}
              onPress={handleZoomIn}
              accessibilityRole="button"
              accessibilityLabel="Zoom in"
            >
              <Text style={styles.zoomButtonLabel}>+</Text>
            </Pressable>
            <Pressable
              style={styles.zoomButton}
              onPress={handleZoomOut}
              accessibilityRole="button"
              accessibilityLabel="Zoom out"
            >
              <Text style={styles.zoomButtonLabel}>-</Text>
            </Pressable>
          </View>
        </>
      ) : null}
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
    backgroundColor: '#F8FAFC',
  },
  mapSurface: {
    position: 'relative',
  },
  markerWrapper: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultMarker: {
    width: '100%',
    height: '100%',
    borderRadius: DEFAULT_MARKER_SIZE / 2,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  defaultMarkerLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'exoSemibold',
  },
  calloutWrapper: {
    position: 'absolute',
    transform: [{ translateX: -75 }, { translateY: -12 }],
  },
  callout: {
    minWidth: 140,
    maxWidth: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  calloutTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 15,
    color: '#0F172A',
  },
  calloutSubtitle: {
    marginTop: 2,
    fontFamily: 'exo',
    fontSize: 13,
    color: '#475569',
  },
  zoomControls: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  zoomButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonLabel: {
    fontSize: 24,
    color: '#1E293B',
    fontFamily: 'exoSemibold',
  },
});
