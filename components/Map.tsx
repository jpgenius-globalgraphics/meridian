'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  Layer,
  Source,
  type MapRef,
  type MapLayerMouseEvent,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { motion, AnimatePresence } from 'framer-motion';
import type { ScoredCounty } from '@/lib/data/types';

const COUNTY_GEOJSON_URL =
  'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json';

const MAP_STYLE = `https://api.maptiler.com/maps/darkmatter/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY ?? ''}`;

// Continental US bounds with small buffer (per spec)
const US_BOUNDS: [[number, number], [number, number]] = [
  [-130, 22],
  [-60, 52],
];

interface MapViewProps {
  scoredCounties: ScoredCounty[];
  onCountyClick: (county: ScoredCounty) => void;
  focusFips?: string | null;
}

interface HoverInfo {
  x: number;
  y: number;
  name: string;
  state: string;
  score: number;
  hasData: boolean;
}

export default function MapView({ scoredCounties, onCountyClick, focusFips }: MapViewProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [hoveredFips, setHoveredFips] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // fips → ScoredCounty lookup
  const scoreByFips = useMemo(() => {
    const m: Record<string, ScoredCounty> = {};
    for (const c of scoredCounties) m[c.fips] = c;
    return m;
  }, [scoredCounties]);

  // Lazy load the GeoJSON
  useEffect(() => {
    let cancelled = false;
    fetch(COUNTY_GEOJSON_URL)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setGeojson(data);
      })
      .catch(() => {
        if (!cancelled) setGeojson({ type: 'FeatureCollection', features: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Score → color is a smooth teal gradient. Counties with no data get the
  // neutral navy color. We do this by building a `match` from GEO_ID to score
  // (with −1 as the "no data" sentinel), then a `case` that routes the
  // sentinel to the no-data color and otherwise interpolates score → color.
  const fillPaint = useMemo<maplibregl.FillLayerSpecification['paint']>(() => {
    const NO_DATA = '#1a1a2e';
    const scoreLookup: unknown[] = ['match', ['get', 'GEO_ID']];
    for (const c of scoredCounties) {
      scoreLookup.push(`0500000US${c.fips}`, c.matchScore);
    }
    scoreLookup.push(-1); // default for unscored counties

    const teal = [
      'interpolate',
      ['linear'],
      scoreLookup,
      0, '#0a1a1f',
      20, '#0d2e35',
      40, '#0e4a56',
      55, '#0e6b7a',
      70, '#00a3bf',
      85, '#00d4ff',
      100, '#00d4ff',
    ];

    const fillColor =
      scoredCounties.length > 0
        ? (['case', ['==', scoreLookup, -1], NO_DATA, teal] as unknown as string)
        : NO_DATA;

    return {
      'fill-color': fillColor,
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.9,
        0.7,
      ],
    } as maplibregl.FillLayerSpecification['paint'];
  }, [scoredCounties]);

  const handleMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      const map = mapRef.current?.getMap();
      if (!map) return;

      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
      hoverTimeout.current = setTimeout(() => {
        if (!feature) {
          if (hoveredFips) {
            map.setFeatureState({ source: 'counties', id: hoveredFips }, { hover: false });
            setHoveredFips(null);
          }
          setHoverInfo(null);
          map.getCanvas().style.cursor = '';
          return;
        }
        const geoId = (feature.properties?.GEO_ID as string) ?? '';
        const fips = geoId.slice(-5);
        const scored = scoreByFips[fips];

        if (hoveredFips && hoveredFips !== fips) {
          map.setFeatureState({ source: 'counties', id: hoveredFips }, { hover: false });
        }
        if (feature.id !== undefined) {
          map.setFeatureState({ source: 'counties', id: feature.id }, { hover: true });
          setHoveredFips(String(feature.id));
        }

        const props = (feature.properties ?? {}) as Record<string, unknown>;
        const fallbackName = (props.NAME as string) || 'County';
        const fallbackState = (props.STATE as string) || '';

        setHoverInfo({
          x: e.point.x,
          y: e.point.y,
          name: scored?.name ?? fallbackName,
          state: scored?.state ?? fallbackState,
          score: scored?.matchScore ?? 0,
          hasData: !!scored,
        });
        map.getCanvas().style.cursor = 'pointer';
      }, 50);
    },
    [hoveredFips, scoreByFips]
  );

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    const map = mapRef.current?.getMap();
    if (map && hoveredFips) {
      map.setFeatureState({ source: 'counties', id: hoveredFips }, { hover: false });
    }
    setHoveredFips(null);
    setHoverInfo(null);
    if (map) map.getCanvas().style.cursor = '';
  }, [hoveredFips]);

  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const geoId = (feature.properties?.GEO_ID as string) ?? '';
      const fips = geoId.slice(-5);
      const scored = scoreByFips[fips];
      if (!scored) return; // Counties without data are non-interactive on click
      mapRef.current?.flyTo({
        center: [scored.lng, scored.lat],
        zoom: 8,
        duration: 1400,
        essential: true,
      });
      onCountyClick(scored);
    },
    [onCountyClick, scoreByFips]
  );

  useEffect(() => {
    if (!focusFips) return;
    const scored = scoreByFips[focusFips];
    if (scored) {
      mapRef.current?.flyTo({
        center: [scored.lng, scored.lat],
        zoom: 8,
        duration: 1400,
        essential: true,
      });
    }
  }, [focusFips, scoreByFips]);

  const handleZoomIn = () => mapRef.current?.zoomIn({ duration: 250 });
  const handleZoomOut = () => mapRef.current?.zoomOut({ duration: 250 });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: mapLoaded && geojson ? 1 : 0 }}
      transition={{ duration: 0.6 }}
      className="absolute inset-0"
    >
      {!geojson && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
            <div className="text-muted text-xs uppercase tracking-widest">Loading county data</div>
          </div>
        </div>
      )}
      <Map
        ref={mapRef}
        initialViewState={{ longitude: -98.5, latitude: 39.5, zoom: 4 }}
        mapStyle={MAP_STYLE}
        minZoom={3}
        maxZoom={12}
        maxBounds={US_BOUNDS}
        interactiveLayerIds={geojson ? ['county-fill'] : []}
        onLoad={() => setMapLoaded(true)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        {geojson && (
          <Source id="counties" type="geojson" data={geojson} generateId>
            <Layer id="county-fill" type="fill" paint={fillPaint} />
            <Layer
              id="county-line"
              type="line"
              paint={{
                'line-color': 'rgba(255,255,255,0.08)',
                'line-width': 0.4,
              }}
            />
          </Source>
        )}
      </Map>

      {/* Custom zoom controls — bottom right */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col rounded-md overflow-hidden border border-white/10 bg-bg/95">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={handleZoomIn}
          className="w-9 h-9 flex items-center justify-center text-text hover:bg-white/5 transition-colors border-b border-white/10 text-lg"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={handleZoomOut}
          className="w-9 h-9 flex items-center justify-center text-text hover:bg-white/5 transition-colors text-lg"
        >
          −
        </button>
      </div>

      <AnimatePresence>
        {hoverInfo && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute z-20 px-3 py-2 rounded-md border border-white/10 bg-bg/95"
            style={{
              left: hoverInfo.x + 12,
              top: hoverInfo.y + 12,
            }}
          >
            <div className="text-text text-sm font-semibold">
              {hoverInfo.name}
              {hoverInfo.state ? `, ${hoverInfo.state}` : ''}
            </div>
            {hoverInfo.hasData ? (
              <div className="text-primary text-xs mt-0.5">Score {hoverInfo.score}</div>
            ) : (
              <div className="text-muted text-xs mt-0.5">Limited data available</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
