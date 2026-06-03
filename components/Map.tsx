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
}

export default function MapView({ scoredCounties, onCountyClick, focusFips }: MapViewProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [hoveredFips, setHoveredFips] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build a fips → ScoredCounty lookup
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

  // Build a "match expression" coloring counties by score, with non-scored counties dim grey.
  const fillColorExpression = useMemo<unknown[]>(() => {
    const expr: unknown[] = ['match', ['get', 'GEO_ID']];
    // The plotly geojson uses GEO_ID like "0500000US06037" — last 5 chars are the fips.
    // We'll build a "match" over fips via a slice using a downcase comparison helper.
    // MapLibre expressions can't easily slice, so we instead use a "case" with "==" comparisons
    // generated from substring concat. Simpler: provide a fallback dim color and use
    // a fips→color mapping computed via a "concat" key. Easiest: use a "case" expression.
    return expr;
  }, []);

  // Build a case expression: for each scored county, color by its score; default = #1f2937.
  const fillPaint = useMemo<maplibregl.FillLayerSpecification['paint']>(() => {
    const cases: unknown[] = [];
    for (const c of scoredCounties) {
      // GEO_ID format in plotly file: "0500000US" + 5-digit FIPS
      const geoId = `0500000US${c.fips}`;
      cases.push(['==', ['get', 'GEO_ID'], geoId]);
      const score = c.matchScore;
      const color = score >= 70 ? '#00d4ff' : score >= 40 ? '#fbbf24' : '#ef4444';
      cases.push(color);
    }
    return {
      'fill-color': cases.length > 0 ? (['case', ...cases, '#1f2937'] as unknown as string) : '#1f2937',
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.85,
        0.55,
      ],
    } as maplibregl.FillLayerSpecification['paint'];
  }, [scoredCounties]);

  // Hover handling (debounced 50ms)
  const handleMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      const map = mapRef.current?.getMap();
      if (!map) return;

      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
      hoverTimeout.current = setTimeout(() => {
        if (!feature) {
          if (hoveredFips) {
            map.setFeatureState(
              { source: 'counties', id: hoveredFips },
              { hover: false }
            );
            setHoveredFips(null);
          }
          setHoverInfo(null);
          map.getCanvas().style.cursor = '';
          return;
        }
        const geoId = (feature.properties?.GEO_ID as string) ?? '';
        const fips = geoId.slice(-5);
        const scored = scoreByFips[fips];

        // Clear previous hover
        if (hoveredFips && hoveredFips !== fips) {
          map.setFeatureState({ source: 'counties', id: hoveredFips }, { hover: false });
        }
        if (feature.id !== undefined) {
          map.setFeatureState({ source: 'counties', id: feature.id }, { hover: true });
          setHoveredFips(String(feature.id));
        }

        if (scored) {
          setHoverInfo({
            x: e.point.x,
            y: e.point.y,
            name: scored.name,
            state: scored.state,
            score: scored.matchScore,
          });
          map.getCanvas().style.cursor = 'pointer';
        } else {
          setHoverInfo(null);
          map.getCanvas().style.cursor = '';
        }
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
      if (scored) {
        mapRef.current?.flyTo({
          center: [scored.lng, scored.lat],
          zoom: 8,
          duration: 1400,
          essential: true,
        });
        onCountyClick(scored);
      }
    },
    [onCountyClick, scoreByFips]
  );

  // Fly to focused county when externally set
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: mapLoaded && geojson ? 1 : 0 }}
      transition={{ duration: 0.8 }}
      className="absolute inset-0"
    >
      {!geojson && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
            <div className="text-muted text-sm tracking-wide">Loading county data…</div>
          </div>
        </div>
      )}
      <Map
        ref={mapRef}
        initialViewState={{ longitude: -98.5, latitude: 39.5, zoom: 4 }}
        mapStyle={MAP_STYLE}
        interactiveLayerIds={geojson ? ['county-fill'] : []}
        onLoad={() => setMapLoaded(true)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{ width: '100%', height: '100%' }}
      >
        {geojson && (
          <Source id="counties" type="geojson" data={geojson} generateId>
            <Layer
              id="county-fill"
              type="fill"
              paint={fillPaint}
            />
            <Layer
              id="county-line"
              type="line"
              paint={{
                'line-color': 'rgba(255,255,255,0.1)',
                'line-width': 0.5,
              }}
            />
          </Source>
        )}
      </Map>

      <AnimatePresence>
        {hoverInfo && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute z-20 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.05] backdrop-blur-md shadow-glow"
            style={{
              left: hoverInfo.x + 12,
              top: hoverInfo.y + 12,
            }}
          >
            <div className="text-text text-sm font-semibold">
              {hoverInfo.name}, {hoverInfo.state}
            </div>
            <div className="text-primary text-xs mt-0.5">Score {hoverInfo.score}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
