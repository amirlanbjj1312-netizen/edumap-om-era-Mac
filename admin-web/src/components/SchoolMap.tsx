'use client';

import { useEffect, useRef, useState } from 'react';

const TWOGIS_API_KEY = process.env.NEXT_PUBLIC_2GIS_API_KEY || '48dde3c2-b611-48eb-9d76-3a67b78a849e';

type School = {
  id: string | number;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  city?: string;
  address?: string;
  type?: string;
};

type Props = {
  schools: School[];
  onSchoolClick?: (school: School) => void;
  height?: string;
};

declare global {
  interface Window {
    mapgl: any;
  }
}

export default function SchoolMap({ schools, onSchoolClick, height = '520px' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const popupRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState('');

  // Load 2GIS MapGL script once
  useEffect(() => {
    if (window.mapgl) {
      setIsLoaded(true);
      return;
    }
    const existing = document.getElementById('mapgl-script');
    if (existing) {
      existing.addEventListener('load', () => setIsLoaded(true));
      return;
    }
    const script = document.createElement('script');
    script.id = 'mapgl-script';
    script.src = 'https://mapgl.2gis.com/api/js/v1';
    script.async = true;
    script.onload = () => setIsLoaded(true);
    script.onerror = () => setError('Не удалось загрузить карту 2GIS');
    document.head.appendChild(script);
  }, []);

  // Init map after script loads
  useEffect(() => {
    if (!isLoaded || !containerRef.current || mapRef.current) return;
    try {
      mapRef.current = new window.mapgl.Map(containerRef.current, {
        center: [71.4459, 51.1694],
        zoom: 10,
        key: TWOGIS_API_KEY,
        lang: 'ru',
      });
    } catch (e) {
      setError('Ошибка инициализации карты');
    }
    return () => {
      if (mapRef.current) {
        try { mapRef.current.destroy(); } catch (_) {}
        mapRef.current = null;
      }
    };
  }, [isLoaded]);

  // Update markers when schools change
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    // Clear previous markers and popup
    markersRef.current.forEach((m) => { try { m.destroy(); } catch (_) {} });
    markersRef.current = [];
    if (popupRef.current) { try { popupRef.current.destroy(); } catch (_) {} popupRef.current = null; }

    const valid = schools.filter(
      (s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude)
    );

    valid.forEach((school) => {
      const marker = new window.mapgl.Marker(mapRef.current, {
        coordinates: [school.longitude!, school.latitude!],
      });

      marker.on('click', () => {
        // Close previous popup
        if (popupRef.current) { try { popupRef.current.destroy(); } catch (_) {} }

        popupRef.current = new window.mapgl.Popup(mapRef.current, {
          coordinates: [school.longitude!, school.latitude!],
          html: buildPopupHtml(school),
          offset: [0, -40],
          disableClose: false,
        });

        // Click on "Открыть" button inside popup
        setTimeout(() => {
          const btn = document.getElementById(`map-popup-btn-${school.id}`);
          if (btn && onSchoolClick) {
            btn.onclick = () => onSchoolClick(school);
          }
        }, 50);
      });

      markersRef.current.push(marker);
    });

    // Auto-fit bounds if multiple schools
    if (valid.length > 1 && mapRef.current) {
      const lats = valid.map((s) => s.latitude!);
      const lons = valid.map((s) => s.longitude!);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      try {
        mapRef.current.fitBounds(
          { southWest: [minLon, minLat], northEast: [maxLon, maxLat] },
          { padding: 60 }
        );
      } catch (_) {}
    } else if (valid.length === 1 && mapRef.current) {
      mapRef.current.setCenter([valid[0].longitude!, valid[0].latitude!], { animate: false });
      mapRef.current.setZoom(13, { animate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schools, isLoaded]);

  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: 16, overflow: 'hidden', background: '#1a2035' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {!isLoaded && !error && (
        <div style={overlayStyle}>
          <div style={spinnerStyle} />
          <p style={{ color: '#94A3B8', fontFamily: 'sans-serif', fontSize: 14, marginTop: 12 }}>
            Загрузка карты 2GIS...
          </p>
        </div>
      )}
      {error && (
        <div style={overlayStyle}>
          <p style={{ color: '#F87171', fontFamily: 'sans-serif', fontSize: 14 }}>{error}</p>
        </div>
      )}
      <div style={badgeStyle}>
        <span style={{ fontSize: 11, color: '#64748B', fontFamily: 'sans-serif' }}>
          {schools.filter((s) => Number.isFinite(s.latitude)).length} школ на карте
        </span>
      </div>
    </div>
  );
}

function buildPopupHtml(school: School): string {
  return `
    <div style="font-family:sans-serif;padding:4px 2px;min-width:160px;max-width:220px">
      <div style="font-weight:700;font-size:14px;color:#0F172A;margin-bottom:4px;line-height:1.3">
        ${escHtml(school.name)}
      </div>
      ${school.city ? `<div style="font-size:12px;color:#6B7280;margin-bottom:2px">${escHtml(school.city)}</div>` : ''}
      ${school.address ? `<div style="font-size:12px;color:#9CA3AF;margin-bottom:6px">${escHtml(school.address)}</div>` : ''}
      ${school.type ? `<div style="display:inline-block;font-size:11px;color:#2563EB;background:#DBEAFE;border-radius:6px;padding:2px 8px;margin-bottom:6px">${escHtml(school.type)}</div>` : ''}
      <button id="map-popup-btn-${school.id}" style="
        width:100%;padding:6px 0;border-radius:8px;border:none;
        background:#2563EB;color:#fff;font-size:12px;font-weight:600;
        cursor:pointer;margin-top:4px
      ">Открыть профиль</button>
    </div>
  `;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0,
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  background: '#0F172A',
};

const spinnerStyle: React.CSSProperties = {
  width: 36, height: 36,
  border: '3px solid rgba(255,255,255,0.15)',
  borderTopColor: '#2563EB',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

const badgeStyle: React.CSSProperties = {
  position: 'absolute', bottom: 12, left: 12,
  background: 'rgba(255,255,255,0.92)',
  borderRadius: 8, padding: '4px 10px',
  backdropFilter: 'blur(4px)',
};
