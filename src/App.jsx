import { useEffect, useMemo, useRef, useState } from 'react';
import { AttributionControl, Map as MapLibreMap, NavigationControl } from 'maplibre-gl';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  Braces,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Database,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  FolderOpen,
  Layers3,
  Map as MapIcon,
  MoreHorizontal,
  Moon,
  MousePointer2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Shapes,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

const sourcePrefix = 'mapfusion-source-';
const colors = ['#63a875', '#df8e68', '#6a91c7', '#c19a4b', '#a47bb5'];
const lightMapStyle = 'https://tiles.openfreemap.org/styles/liberty';
const darkMapStyle = 'https://tiles.openfreemap.org/styles/dark';

function getBounds(data) {
  const bounds = [[Infinity, Infinity], [-Infinity, -Infinity]];
  const visit = (coordinates) => {
    if (!Array.isArray(coordinates)) return;
    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      bounds[0][0] = Math.min(bounds[0][0], coordinates[0]);
      bounds[0][1] = Math.min(bounds[0][1], coordinates[1]);
      bounds[1][0] = Math.max(bounds[1][0], coordinates[0]);
      bounds[1][1] = Math.max(bounds[1][1], coordinates[1]);
      return;
    }
    coordinates.forEach(visit);
  };
  data.features.forEach((feature) => visit(feature.geometry?.coordinates));
  return Number.isFinite(bounds[0][0]) ? bounds : null;
}

function normalizeGeoJson(input) {
  const collection = input.type === 'FeatureCollection'
    ? input
    : input.type === 'Feature'
      ? { type: 'FeatureCollection', features: [input] }
      : { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: input }] };

  if (!Array.isArray(collection.features)) throw new Error('This GeoJSON does not contain a feature list.');
  const features = collection.features.map((feature, index) => {
    if (!feature || feature.type !== 'Feature' || !feature.geometry) {
      throw new Error(`Feature ${index + 1} is missing a valid geometry.`);
    }
    return {
      ...feature,
      id: feature.id ?? index + 1,
      properties: feature.properties && typeof feature.properties === 'object' ? feature.properties : {},
    };
  });
  return { type: 'FeatureCollection', features };
}

function App() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const mapLayerIdsRef = useRef([]);
  const fileInputRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [layers, setLayers] = useState([]);
  const [activeLayerId, setActiveLayerId] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [activeTab, setActiveTab] = useState('layers');
  const [toast, setToast] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [runOutput, setRunOutput] = useState('');
  const [showRunOutput, setShowRunOutput] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return window.localStorage.getItem('mapfusion-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const mapThemeRef = useRef(theme);
  const [mapStyleRevision, setMapStyleRevision] = useState(0);
  const [updateState, setUpdateState] = useState({
    status: 'idle',
    currentVersion: '',
    automaticUpdatesEnabled: true,
    progress: 0,
    message: 'Loading update settings...',
  });
  const [updateActionPending, setUpdateActionPending] = useState(false);
  const [preferencePending, setPreferencePending] = useState(false);
  const [filter, setFilter] = useState('');

  const activeLayer = layers.find((layer) => layer.id === activeLayerId) ?? null;
  const totalFeatures = layers.reduce((sum, layer) => sum + layer.count, 0);
  const selectedProperties = useMemo(() => {
    if (!selectedFeature) return null;
    const layer = layers.find((item) => item.id === selectedFeature.layerId);
    return layer?.data.features.find((feature) => feature.id === selectedFeature.featureId)?.properties ?? null;
  }, [layers, selectedFeature]);
  const visibleLayers = layers.filter((layer) => layer.name.toLowerCase().includes(filter.toLowerCase()));

  useEffect(() => {
    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: theme === 'dark' ? darkMapStyle : lightMapStyle,
      center: [12, 22],
      zoom: 2.1,
      minZoom: 1,
      maxZoom: 18,
      attributionControl: false,
    });
    map.addControl(new NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
    map.on('load', () => setMapReady(true));
    map.on('click', (event) => {
      const feature = map.queryRenderedFeatures(event.point).find((item) => item.source?.startsWith(sourcePrefix));
      if (!feature) return;
      const layerId = feature.source.slice(sourcePrefix.length);
      setActiveLayerId(layerId);
      setSelectedFeature({ layerId, featureId: feature.id });
      setActiveTab('inspect');
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapThemeRef.current === theme) return;
    mapThemeRef.current = theme;
    map.once('style.load', () => setMapStyleRevision((revision) => revision + 1));
    map.setStyle(theme === 'dark' ? darkMapStyle : lightMapStyle, { diff: false });
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    mapLayerIdsRef.current.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    mapLayerIdsRef.current = [];
    layers.forEach((layer) => {
      const sourceId = `${sourcePrefix}${layer.id}`;
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    });

    [...layers].reverse().forEach((layer) => {
      const sourceId = `${sourcePrefix}${layer.id}`;
      map.addSource(sourceId, { type: 'geojson', data: layer.data });
      const visibility = layer.visible ? 'visible' : 'none';
      const fillId = `${sourceId}-fill`;
      const lineId = `${sourceId}-line`;
      const pointId = `${sourceId}-point`;
      map.addLayer({
        id: fillId,
        type: 'fill',
        source: sourceId,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': layer.color, 'fill-opacity': 0.26 },
        layout: { visibility },
      });
      map.addLayer({
        id: lineId,
        type: 'line',
        source: sourceId,
        filter: ['match', ['geometry-type'], ['LineString', 'Polygon'], true, false],
        paint: { 'line-color': layer.color, 'line-width': 2.2 },
        layout: { visibility },
      });
      map.addLayer({
        id: pointId,
        type: 'circle',
        source: sourceId,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-color': layer.color, 'circle-radius': 5, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 },
        layout: { visibility },
      });
      mapLayerIdsRef.current.push(fillId, lineId, pointId);
    });
  }, [layers, mapReady, mapStyleRevision]);

  useEffect(() => {
    const api = window.appAPI;
    if (!api?.getUpdateState) return undefined;
    let subscribed = true;
    const applyState = (state) => {
      if (subscribed) setUpdateState((current) => ({ ...current, ...state }));
    };
    const unsubscribe = api.onUpdateState?.(applyState);
    api.getUpdateState().then(applyState).catch((error) => {
      applyState({ status: 'error', message: error.message || 'Could not load update settings.' });
    });
    return () => {
      subscribed = false;
      unsubscribe?.();
    };
  }, []);

  function notify(message) {
    setToast(message);
    window.clearTimeout(notify.timeout);
    notify.timeout = window.setTimeout(() => setToast(''), 3600);
  }

  function changeTheme(nextTheme) {
    setTheme(nextTheme);
    try {
      window.localStorage.setItem('mapfusion-theme', nextTheme);
    } catch {
      notify('Theme will reset when the app closes because local storage is unavailable.');
    }
  }

  async function checkForUpdates() {
    if (!window.appAPI?.checkForUpdates) {
      notify('Update checks are available in the installed desktop app.');
      return;
    }
    setUpdateActionPending(true);
    try {
      const state = await window.appAPI.checkForUpdates();
      if (state) setUpdateState((current) => ({ ...current, ...state }));
    } catch (error) {
      setUpdateState((current) => ({ ...current, status: 'error', message: error.message || 'Could not check for updates.' }));
    } finally {
      setUpdateActionPending(false);
    }
  }

  async function changeAutomaticUpdates(event) {
    const enabled = event.target.checked;
    setPreferencePending(true);
    try {
      const state = await window.appAPI.setAutomaticUpdatesEnabled(enabled);
      if (state) setUpdateState((current) => ({ ...current, ...state }));
    } catch (error) {
      notify(error.message || 'Could not save the update preference.');
    } finally {
      setPreferencePending(false);
    }
  }

  async function downloadUpdate() {
    setUpdateActionPending(true);
    try {
      const state = await window.appAPI.downloadUpdate();
      if (state) setUpdateState((current) => ({ ...current, ...state }));
    } catch (error) {
      setUpdateState((current) => ({ ...current, status: 'error', message: error.message || 'Could not download the update.' }));
    } finally {
      setUpdateActionPending(false);
    }
  }

  async function installUpdate() {
    setUpdateActionPending(true);
    try {
      await window.appAPI.installUpdate();
    } catch (error) {
      setUpdateActionPending(false);
      notify(error.message || 'Could not install the update.');
    }
  }

  const updateStatusLabels = {
    idle: 'Not checked',
    checking: 'Checking',
    available: 'Update available',
    downloading: 'Downloading',
    downloaded: 'Ready to install',
    'up-to-date': 'Up to date',
    error: 'Check failed',
  };
  const updateStatusLabel = updateStatusLabels[updateState.status] ?? 'Update status';

  useEffect(() => {
    if (['available', 'downloaded', 'error'].includes(updateState.status)) notify(updateState.message);
  }, [updateState.status, updateState.message]);

  function openImporter() {
    fileInputRef.current?.click();
  }

  async function importFiles(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    for (const file of files) {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!['geojson', 'json'].includes(extension)) {
        notify(`${file.name}: GDAL import for this format is not connected yet.`);
        continue;
      }
      try {
        const parsed = JSON.parse(await file.text());
        const data = normalizeGeoJson(parsed);
        const id = `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
        const properties = new Set(data.features.flatMap((feature) => Object.keys(feature.properties)));
        const geometryTypes = [...new Set(data.features.map((feature) => feature.geometry.type.replace('Multi', '')))].join(', ') || 'Unknown';
        const layer = {
          id,
          name: file.name.replace(/\.(geojson|json)$/i, ''),
          data,
          visible: true,
          color: colors[layers.length % colors.length],
          count: data.features.length,
          geometryTypes,
          fields: [...properties],
          fieldTypes: Object.fromEntries([...properties].map((key) => [key, typeof data.features.map((feature) => feature.properties[key]).find((value) => value !== undefined)])),
          crs: parsed.crs?.properties?.name ?? parsed.crs?.name ?? 'EPSG:4326',
          bounds: getBounds(data),
        };
        setLayers((current) => [...current, layer]);
        setActiveLayerId(id);
        setSelectedFeature(null);
        setActiveTab('layers');
        if (layer.bounds) {
          window.setTimeout(() => mapRef.current?.fitBounds(layer.bounds, { padding: 90, maxZoom: 12, duration: 700 }), 180);
        }
        notify(`Added ${file.name}`);
      } catch (error) {
        notify(`${file.name}: ${error.message || 'Could not read this GeoJSON.'}`);
      }
    }
  }

  function updateLayer(id, changes) {
    setLayers((current) => current.map((layer) => layer.id === id ? { ...layer, ...changes } : layer));
  }

  function moveLayer(id, offset) {
    setLayers((current) => {
      const index = current.findIndex((layer) => layer.id === id);
      const nextIndex = index + offset;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
      return reordered;
    });
  }

  function removeLayer(id) {
    setLayers((current) => current.filter((layer) => layer.id !== id));
    if (activeLayerId === id) setActiveLayerId(null);
    if (selectedFeature?.layerId === id) setSelectedFeature(null);
  }

  function fitLayer(layer) {
    if (layer?.bounds) mapRef.current?.fitBounds(layer.bounds, { padding: 90, maxZoom: 12, duration: 700 });
  }

  function exportLayer() {
    if (!activeLayer) return;
    const blob = new Blob([JSON.stringify(activeLayer.data, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${activeLayer.name}.geojson`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify(`Exported ${activeLayer.name}.geojson`);
  }

  function updateProperty(key, value) {
    if (!selectedFeature) return;
    setLayers((current) => current.map((layer) => {
      if (layer.id !== selectedFeature.layerId) return layer;
      return {
        ...layer,
        data: {
          ...layer.data,
          features: layer.data.features.map((feature) => feature.id === selectedFeature.featureId
            ? { ...feature, properties: { ...feature.properties, [key]: value } }
            : feature),
        },
      };
    }));
  }

  function deleteSelectedFeature() {
    if (!selectedFeature) return;
    setLayers((current) => current.map((layer) => layer.id === selectedFeature.layerId
      ? { ...layer, data: { ...layer.data, features: layer.data.features.filter((feature) => feature.id !== selectedFeature.featureId) }, count: Math.max(0, layer.count - 1) }
      : layer));
    setSelectedFeature(null);
    notify('Feature removed from the working layer');
  }

  async function runPipeline() {
    if (!window.appAPI?.runMergedProject) {
      notify('Open MapFusion in Electron to run local processing.');
      return;
    }
    setIsRunning(true);
    setShowRunOutput(true);
    setRunOutput('Starting the merged data and map pipeline...');
    try {
      const result = await window.appAPI.runMergedProject();
      setRunOutput(result);
    } catch (error) {
      setRunOutput(error.message || String(error));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className={`app-shell ${theme === 'dark' ? 'theme-dark' : ''}`}>
      <aside className="tool-rail" aria-label="Primary tools">
        <div className="brand-mark"><MapIcon size={20} strokeWidth={2.4} /></div>
        <button className={`rail-button ${showSettings ? '' : 'selected'}`} onClick={() => setShowSettings(false)} aria-label="Map workspace" title="Map workspace"><Layers3 size={19} /></button>
        <button className="rail-button" onClick={openImporter} aria-label="Add data" title="Add data"><FilePlus2 size={19} /></button>
        <div className="rail-spacer" />
        <button className={`rail-button ${showSettings ? 'selected' : ''}`} onClick={() => setShowSettings(true)} aria-label="Settings" title="Settings"><Settings2 size={19} /></button>
        <button className="rail-button" onClick={() => notify('Help is not available in this MVP.')} aria-label="Help" title="Help"><CircleHelp size={19} /></button>
        <div className="avatar">MF</div>
      </aside>

      <aside className="sidebar">
        <header className="workspace-heading">
          <div>
            <span className="eyebrow">WORKSPACE</span>
            <h1>Field atlas</h1>
          </div>
          <button className="icon-button subtle" title="Workspace options" aria-label="Workspace options" onClick={() => notify('Workspace options are not available yet.')}><MoreHorizontal size={19} /></button>
        </header>
        <div className="project-chip"><span className="project-dot" /><span>Untitled project</span><ChevronDown size={14} /></div>

        <div className="side-tabs" role="tablist" aria-label="Workspace panel">
          <button role="tab" aria-selected={activeTab === 'layers'} className={activeTab === 'layers' ? 'active' : ''} onClick={() => setActiveTab('layers')}>Layers <span>{layers.length}</span></button>
          <button role="tab" aria-selected={activeTab === 'inspect'} className={activeTab === 'inspect' ? 'active' : ''} onClick={() => setActiveTab('inspect')}>Inspect</button>
        </div>

        {activeTab === 'layers' ? (
          <section className="layer-panel">
            <div className="section-heading">
              <div><span className="eyebrow">DATA</span><h2>Layers</h2></div>
              <button className="icon-button" onClick={openImporter} title="Add layer" aria-label="Add layer"><Plus size={18} /></button>
            </div>
            <label className="search-field"><Search size={15} /><input aria-label="Filter layers" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter layers" /></label>
            {layers.length ? (
              <div className="layer-list">
                {visibleLayers.map((layer) => (
                  <article className={`layer-row ${activeLayerId === layer.id ? 'current' : ''}`} key={layer.id}>
                    <button className="layer-select" onClick={() => { setActiveLayerId(layer.id); setSelectedFeature(null); }}>
                      <span className="layer-swatch" style={{ '--swatch': layer.color }}><Shapes size={16} /></span>
                      <span className="layer-copy"><strong title={layer.name}>{layer.name}</strong><small>{layer.count.toLocaleString()} {layer.count === 1 ? 'feature' : 'features'} · {layer.geometryTypes}</small></span>
                    </button>
                    <div className="layer-actions">
                      <button className="tiny-icon" onClick={() => fitLayer(layer)} title="Zoom to layer" aria-label={`Zoom to ${layer.name}`}><MousePointer2 size={14} /></button>
                      <button className="tiny-icon" onClick={() => updateLayer(layer.id, { visible: !layer.visible })} title={layer.visible ? 'Hide layer' : 'Show layer'} aria-label={layer.visible ? 'Hide layer' : 'Show layer'}>{layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                      <button className="tiny-icon row-menu" onClick={() => removeLayer(layer.id)} title="Remove layer" aria-label={`Remove ${layer.name}`}><Trash2 size={14} /></button>
                    </div>
                    <div className="layer-tools">
                      <label className="color-control" title="Layer color"><input type="color" value={layer.color} onChange={(event) => updateLayer(layer.id, { color: event.target.value })} /><span>Style</span></label>
                      <button className="text-tool" onClick={() => moveLayer(layer.id, -1)} title="Move layer up" aria-label="Move layer up"><ArrowUp size={13} /></button>
                      <button className="text-tool" onClick={() => moveLayer(layer.id, 1)} title="Move layer down" aria-label="Move layer down"><ArrowDown size={13} /></button>
                      <button className="text-tool" onClick={() => { setActiveLayerId(layer.id); setActiveTab('inspect'); }}><Braces size={13} /> Inspect</button>
                    </div>
                  </article>
                ))}
                {!visibleLayers.length && <p className="quiet-empty">No layers match that filter.</p>}
              </div>
            ) : (
              <div className="empty-layers">
                <div className="empty-icon"><Database size={20} /></div>
                <strong>No layers yet</strong>
                <p>Add a GeoJSON dataset to start a map.</p>
                <button className="outline-button" onClick={openImporter}><Plus size={15} /> Add data</button>
              </div>
            )}
            <div className="formats-note"><span className="note-mark"><Check size={12} /></span><span><strong>GeoJSON ready</strong><small>GDAL formats are coming next</small></span></div>
          </section>
        ) : (
          <section className="inspector-panel">
            <div className="section-heading"><div><span className="eyebrow">DATA DETAILS</span><h2>Inspector</h2></div></div>
            {selectedProperties ? (
              <>
                <div className="inspector-title"><span className="inspector-pin"><MousePointer2 size={16} /></span><div><strong>Selected feature</strong><small>{activeLayer?.name ?? 'Layer'}</small></div></div>
                <div className="field-list">
                  {Object.entries(selectedProperties).map(([key, value]) => (
                    <label className="field-row" key={key}><span title={key}>{key}</span><input value={value == null ? '' : String(value)} onChange={(event) => updateProperty(key, event.target.value)} onBlur={(event) => {
                      const text = event.target.value;
                      const fieldType = activeLayer?.fieldTypes?.[key];
                      if (fieldType === 'number' && text.trim() !== '' && Number.isFinite(Number(text))) updateProperty(key, Number(text));
                      else if (fieldType === 'boolean' && ['true', 'false'].includes(text.toLowerCase())) updateProperty(key, text.toLowerCase() === 'true');
                      else if (fieldType === 'object') {
                        try { updateProperty(key, JSON.parse(text)); } catch { updateProperty(key, text); }
                      } else updateProperty(key, text);
                    }} /></label>
                  ))}
                  {!Object.keys(selectedProperties).length && <p className="quiet-empty">This feature has no attributes.</p>}
                </div>
                <button className="danger-button" onClick={deleteSelectedFeature}><Trash2 size={14} /> Delete feature</button>
              </>
            ) : activeLayer ? (
              <>
                <div className="inspector-title"><span className="inspector-pin"><Shapes size={16} /></span><div><strong>{activeLayer.name}</strong><small>Layer summary</small></div></div>
                <dl className="metadata-list">
                  <div><dt>Features</dt><dd>{activeLayer.count.toLocaleString()}</dd></div>
                  <div><dt>Geometry</dt><dd>{activeLayer.geometryTypes}</dd></div>
                  <div><dt>Coordinate system</dt><dd>{activeLayer.crs}</dd></div>
                  <div><dt>Fields</dt><dd>{activeLayer.fields.length}</dd></div>
                </dl>
                <h3 className="subsection-title">Attribute fields</h3>
                <div className="field-chips">{activeLayer.fields.map((field) => <span key={field}>{field}</span>)}</div>
                <p className="inspector-hint">Select a feature on the map to edit its attributes.</p>
              </>
            ) : <div className="empty-inspector"><Braces size={20} /><p>Select a layer or map feature to inspect its data.</p></div>}
          </section>
        )}
        <footer className="sidebar-footer"><span className="online-dot" /> Local workspace <span className="footer-version">MVP</span></footer>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Projects</span><span className="crumb-divider">/</span><strong>Untitled project</strong><span className="saved-state"><span /> Saved locally</span></div>
          <div className="top-actions">
            <button className="toolbar-button" onClick={runPipeline} disabled={isRunning}><RefreshCw size={15} className={isRunning ? 'spinning' : ''} /> {isRunning ? 'Running' : 'Run pipeline'}</button>
            <button className="toolbar-button" onClick={exportLayer} disabled={!activeLayer}><ArrowDownToLine size={15} /> Export</button>
            <button className="add-data-button" onClick={openImporter}><Upload size={15} /> Add data</button>
          </div>
        </header>

        <section className="map-stage" aria-label="Map workspace">
          <div className="map-canvas" ref={mapContainerRef} />
          <div className="map-title-card"><span className="map-title-icon"><MapIcon size={16} /></span><div><strong>Untitled project</strong><small>{layers.length ? `${layers.length} ${layers.length === 1 ? 'layer' : 'layers'} · ${totalFeatures.toLocaleString()} ${totalFeatures === 1 ? 'feature' : 'features'}` : 'Map canvas'}</small></div></div>
          {!layers.length && (
            <div className="map-empty-state">
              <span className="empty-map-icon"><FolderOpen size={22} /></span>
              <h2>Start with a dataset</h2>
              <p>Bring geographic data into this workspace to explore it on the map.</p>
              <button className="add-data-button" onClick={openImporter}><Upload size={15} /> Import GeoJSON</button>
            </div>
          )}
          <div className="map-footer"><span><span className="online-dot" /> {mapReady ? 'Map ready' : 'Loading map'}</span><span className="map-coordinate">WGS 84 · EPSG:4326</span></div>
        </section>
      </main>

      <input ref={fileInputRef} className="visually-hidden" type="file" multiple accept=".geojson,.json,.shp,.gpkg,.pbf,.pmtiles" onChange={importFiles} />
      {showSettings && (
        <div className="modal-backdrop settings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowSettings(false); }}>
          <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <header>
              <div><span className="eyebrow">APPLICATION</span><h2 id="settings-title">Settings</h2></div>
              <button className="icon-button" onClick={() => setShowSettings(false)} aria-label="Close settings"><X size={18} /></button>
            </header>
            <div className="settings-content">
              <section className="appearance-setting" aria-labelledby="appearance-title">
                <div className="settings-section-heading"><div><strong id="appearance-title">Appearance</strong><p>Choose the workspace color theme.</p></div></div>
                <div className="theme-segment" role="group" aria-label="Color theme">
                  <button type="button" className={theme === 'light' ? 'active' : ''} aria-pressed={theme === 'light'} onClick={() => changeTheme('light')}><Sun size={14} />Light</button>
                  <button type="button" className={theme === 'dark' ? 'active' : ''} aria-pressed={theme === 'dark'} onClick={() => changeTheme('dark')}><Moon size={14} />Dark</button>
                </div>
              </section>
              <div className="settings-divider" />
              <section className={`update-overview update-${updateState.status}`} aria-live="polite">
                <span className="update-state-icon">
                  {updateState.status === 'error' ? <CircleAlert size={19} /> : updateState.status === 'up-to-date' || updateState.status === 'downloaded' ? <CircleCheck size={19} /> : <RefreshCw size={18} className={updateState.status === 'checking' || updateState.status === 'downloading' ? 'spinning' : ''} />}
                </span>
                <div className="update-overview-copy">
                  <div className="update-title-row"><strong>Software updates</strong><span className="update-status-label">{updateStatusLabel}</span></div>
                  <p>{updateState.message}</p>
                </div>
              </section>

              <div className="version-row"><span>Installed version</span><strong>v{updateState.currentVersion || '...'}</strong></div>

              {updateState.availableVersion && updateState.status !== 'up-to-date' && (
                <div className="version-row"><span>Available version</span><strong>v{updateState.availableVersion}</strong></div>
              )}

              {updateState.status === 'downloading' && (
                <div className="update-progress-wrap">
                  <div className="update-progress-heading"><span>Download progress</span><strong>{updateState.progress}%</strong></div>
                  <div className="update-progress" role="progressbar" aria-label="Update download progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={updateState.progress}><span style={{ width: `${updateState.progress}%` }} /></div>
                </div>
              )}

              <div className="settings-divider" />
              <div className="settings-section-heading"><div><strong>Automatic updates</strong><p>Keep MapFusion current with less effort.</p></div></div>
              <label className="update-preference">
                <span className="update-preference-copy"><strong>Check and download automatically</strong><small>Checks when the app starts and downloads available updates. Restart the app to finish installation.</small></span>
                <input type="checkbox" role="switch" checked={updateState.automaticUpdatesEnabled} disabled={preferencePending} onChange={changeAutomaticUpdates} aria-label="Check and download updates automatically" />
                <span className="switch-track" aria-hidden="true"><span /></span>
              </label>
              {!updateState.automaticUpdatesEnabled && <p className="manual-update-note">Automatic checks are off. You can still check and install updates here.</p>}
            </div>
            <footer className="settings-footer">
              <button className="outline-button" onClick={checkForUpdates} disabled={updateActionPending || updateState.status === 'checking'}><RefreshCw size={14} className={updateState.status === 'checking' ? 'spinning' : ''} />Check for updates</button>
              {updateState.status === 'available' && !updateState.automaticUpdatesEnabled && <button className="add-data-button" onClick={downloadUpdate} disabled={updateActionPending}><Download size={14} />Download update</button>}
              {updateState.status === 'downloaded' && <button className="add-data-button" onClick={installUpdate} disabled={updateActionPending}><RefreshCw size={14} />Restart to install</button>}
            </footer>
          </section>
        </div>
      )}
      {toast && <div className="toast" role="status"><Check size={15} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={15} /></button></div>}
      {showRunOutput && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isRunning) setShowRunOutput(false); }}><section className="run-dialog" role="dialog" aria-modal="true" aria-labelledby="run-title"><header><div><span className="eyebrow">LOCAL PROCESSING</span><h2 id="run-title">Merged map pipeline</h2></div><button className="icon-button" onClick={() => !isRunning && setShowRunOutput(false)} aria-label="Close pipeline output" disabled={isRunning}><X size={18} /></button></header><div className={`run-status ${isRunning ? 'busy' : 'done'}`}><span className={isRunning ? 'pulse-dot' : 'online-dot'} />{isRunning ? 'Processing datasets' : 'Process finished'}</div><pre>{runOutput}</pre><footer><button className="outline-button" onClick={() => setShowRunOutput(false)} disabled={isRunning}>Close</button></footer></section></div>}
    </div>
  );
}

export default App;
