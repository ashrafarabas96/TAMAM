'use client';

import type { Feature, Polygon, Position } from 'geojson';
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import { MousePointer2, Pencil, Trash2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { tokens } from '@tamam/ui-tokens';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils/cn';

import { maplibregl, useMapLibre } from '../map/use-maplibre';

export interface PolygonEditorProps {
  value: Polygon | null;
  onChange: (polygon: Polygon | null) => void;
  className?: string;
  readOnly?: boolean;
}

type Mode = 'view' | 'draw';

const SRC = 'draft-polygon';
const ringOf = (polygon: Polygon | null): Position[] => {
  const ring = polygon?.coordinates[0] ?? [];
  return ring.length > 3 ? ring.slice(0, -1) : [];
};

/**
 * Minimal GeoJSON polygon draw/edit surface built on MapLibre: click to append a vertex, drag a
 * vertex to move it, undo the last point, clear. The ring is closed automatically so the value
 * always satisfies `geoJsonPolygonSchema` (first point equals last, ≥ 4 positions).
 */
export function PolygonEditor({ value, onChange, className, readOnly = false }: PolygonEditorProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, loaded } = useMapLibre(containerRef);
  const [mode, setMode] = useState<Mode>('view');
  const pointsRef = useRef<Position[]>(ringOf(value));
  const dragIndex = useRef<number | null>(null);
  const [, forceRender] = useState(0);

  const emit = useCallback(
    (points: Position[]) => {
      pointsRef.current = points;
      forceRender((n) => n + 1);
      if (points.length < 3) {
        onChange(null);
        return;
      }
      const first = points[0] as Position;
      onChange({ type: 'Polygon', coordinates: [[...points, [first[0] as number, first[1] as number]]] });
    },
    [onChange],
  );

  useEffect(() => {
    pointsRef.current = ringOf(value);
    forceRender((n) => n + 1);
  }, [value]);

  const render = useCallback(() => {
    if (!map || !loaded) return;
    const points = pointsRef.current;
    const features: Feature[] = points.map((p, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { index: i } }));
    if (points.length >= 2) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [...points, points[0] as Position] }, properties: {} });
    if (points.length >= 3) features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...points, points[0] as Position]] }, properties: {} });
    (map.getSource(SRC) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
  }, [map, loaded]);

  useEffect(() => {
    if (!map || !loaded) return;
    if (!map.getSource(SRC)) {
      map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'draft-fill', type: 'fill', source: SRC, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': tokens.color.brand.purple[500], 'fill-opacity': 0.12 } });
      map.addLayer({ id: 'draft-line', type: 'line', source: SRC, filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': tokens.color.brand.purple[500], 'line-width': 2 } });
      map.addLayer({ id: 'draft-points', type: 'circle', source: SRC, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 6, 'circle-color': tokens.color.brand.yellow[500], 'circle-stroke-color': tokens.color.brand.purple[700], 'circle-stroke-width': 2 } });
    }
    render();
  }, [map, loaded, render]);

  useEffect(() => {
    render();
  });

  useEffect(() => {
    if (!map || !loaded || readOnly) return;
    const onClick = (e: MapMouseEvent) => {
      if (mode !== 'draw') return;
      emit([...pointsRef.current, [e.lngLat.lng, e.lngLat.lat]]);
    };
    const onDown = (e: MapMouseEvent & { features?: Feature[] }) => {
      const feature = map.queryRenderedFeatures(e.point, { layers: ['draft-points'] })[0];
      const index = feature?.properties?.index;
      if (typeof index === 'number') {
        dragIndex.current = index;
        map.dragPan.disable();
      }
    };
    const onMove = (e: MapMouseEvent) => {
      if (dragIndex.current === null) return;
      const next = [...pointsRef.current];
      next[dragIndex.current] = [e.lngLat.lng, e.lngLat.lat];
      emit(next);
    };
    const onUp = () => {
      if (dragIndex.current !== null) {
        dragIndex.current = null;
        map.dragPan.enable();
      }
    };
    map.on('click', onClick);
    map.on('mousedown', onDown);
    map.on('mousemove', onMove);
    map.on('mouseup', onUp);
    return () => {
      map.off('click', onClick);
      map.off('mousedown', onDown);
      map.off('mousemove', onMove);
      map.off('mouseup', onUp);
    };
  }, [map, loaded, mode, emit, readOnly]);

  useEffect(() => {
    if (!map || !loaded) return;
    const points = pointsRef.current;
    if (points.length < 3) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const p of points) bounds.extend([p[0] as number, p[1] as number]);
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, duration: 0 });
    // Fit once when the map becomes ready with an existing polygon.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, loaded]);

  const count = pointsRef.current.length;
  return (
    <div className={cn('relative overflow-hidden rounded-lg border border-border', className)}>
      <div ref={containerRef} className="h-full w-full" role="application" aria-label={t('zones.polygonEditor')} />
      {!readOnly ? (
        <div className="absolute end-3 top-3 z-10 flex flex-col gap-2 rounded-md bg-surface/95 p-2 shadow-raised">
          <Button size="sm" variant={mode === 'draw' ? 'primary' : 'outline'} onClick={() => setMode(mode === 'draw' ? 'view' : 'draw')}>
            {mode === 'draw' ? <Pencil className="h-4 w-4" aria-hidden /> : <MousePointer2 className="h-4 w-4" aria-hidden />}
            {mode === 'draw' ? t('zones.drawing') : t('zones.draw')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => emit(pointsRef.current.slice(0, -1))} disabled={count === 0}>
            <Undo2 className="h-4 w-4" aria-hidden /> {t('zones.undoPoint')}
          </Button>
          <Button size="sm" variant="danger-soft" onClick={() => emit([])} disabled={count === 0}>
            <Trash2 className="h-4 w-4" aria-hidden /> {t('common.clear')}
          </Button>
          <p className="text-center text-[11px] text-text-secondary">{t('zones.vertices', { count })}</p>
        </div>
      ) : null}
      {mode === 'draw' && !readOnly ? <p className="absolute bottom-3 start-3 z-10 rounded-sm bg-surface/95 px-2 py-1 text-[11px] text-text-secondary shadow-card">{t('zones.drawHint')}</p> : null}
    </div>
  );
}
