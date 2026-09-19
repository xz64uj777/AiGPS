import React, { useState, useEffect } from "react";
import { Map, Layers, GitFork, ArrowRight, CheckCircle, RefreshCw, Send } from "lucide-react";
import { CorridorResponse, LaneDto, LaneConnectionDto } from "../types";

export const CorridorExplorer: React.FC = () => {
  const [lat, setLat] = useState<number>(37.7749);
  const [lon, setLon] = useState<number>(-122.4194);
  const [radiusM, setRadiusM] = useState<number>(1200);
  const [corridor, setCorridor] = useState<CorridorResponse | null>(null);
  const [selectedLane, setSelectedLane] = useState<LaneDto | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const fetchCorridor = async () => {
    setLoading(true);
    setImportStatus(null);
    try {
      const res = await fetch(`/api/v1/corridor?lat=${lat}&lon=${lon}&radius_m=${radiusM}`);
      const data = await res.json();
      setCorridor(data);
      if (data.lanes && data.lanes.length > 0) {
        setSelectedLane(data.lanes[0]);
      }
    } catch (err) {
      console.warn("Failed to fetch corridor:", err);
    } finally {
      setLoading(false);
    }
  };

  const triggerDevImport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/dev/import-corridor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lon, radius_m: radiusM }),
      });
      const data = await res.json();
      setImportStatus(`Successfully ingested ${data.imported_lanes_count} lanes & ${data.imported_connections_count} connections.`);
      if (data.corridor) {
        setCorridor(data.corridor);
        if (data.corridor.lanes.length > 0) {
          setSelectedLane(data.corridor.lanes[0]);
        }
      }
    } catch (err: any) {
      setImportStatus(`Import failed: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCorridor();
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121927] border border-slate-800 rounded-2xl p-4 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <h1 className="text-xl font-extrabold text-white">OSM Corridor & Lane Graph Explorer</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Query and inspect OpenStreetMap-derived lane centerlines, turn allowances, and junction connectivity
          </p>
        </div>

        {/* Preset Location Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setLat(37.7749); setLon(-122.4194); }}
            className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium"
          >
            SF Highway 101
          </button>
          <button
            onClick={() => { setLat(37.4419); setLon(-122.143); }}
            className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium"
          >
            Palo Alto I-280
          </button>
          <button
            onClick={() => { setLat(40.7128); setLon(-74.006); }}
            className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium"
          >
            NYC Arterial
          </button>
        </div>
      </div>

      {/* Query Bar */}
      <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 shadow-md flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase">Latitude</label>
          <input
            type="number"
            step="0.0001"
            value={lat}
            onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
            className="mt-1 px-3 py-1.5 rounded-xl bg-[#0a0f1a] border border-slate-700 text-xs font-mono text-white w-32"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase">Longitude</label>
          <input
            type="number"
            step="0.0001"
            value={lon}
            onChange={(e) => setLon(parseFloat(e.target.value) || 0)}
            className="mt-1 px-3 py-1.5 rounded-xl bg-[#0a0f1a] border border-slate-700 text-xs font-mono text-white w-32"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase">Radius (m)</label>
          <input
            type="number"
            value={radiusM}
            onChange={(e) => setRadiusM(parseInt(e.target.value, 10) || 1200)}
            className="mt-1 px-3 py-1.5 rounded-xl bg-[#0a0f1a] border border-slate-700 text-xs font-mono text-white w-28"
          />
        </div>

        <button
          onClick={fetchCorridor}
          disabled={loading}
          className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Query Corridor
        </button>

        <button
          onClick={triggerDevImport}
          disabled={loading}
          className="px-4 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 font-bold text-xs flex items-center gap-1.5 transition-all"
        >
          <Send className="w-3.5 h-3.5" />
          Dev Import Endpoint
        </button>
      </div>

      {importStatus && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{importStatus}</span>
        </div>
      )}

      {/* Corridor Visuals & Lane List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Lanes List */}
        <div className="lg:col-span-4 bg-[#121927] border border-slate-800 rounded-2xl p-4 shadow-md">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Corridor Lanes ({corridor?.lanes.length || 0})</span>
            <span className="text-[10px] text-slate-500 font-mono">/v1/corridor</span>
          </h2>

          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {corridor?.lanes.map((lane) => {
              const isSelected = selectedLane?.id === lane.id;
              return (
                <div
                  key={lane.id}
                  onClick={() => setSelectedLane(lane)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-blue-600/20 border-blue-500/60 ring-1 ring-blue-400/40"
                      : "bg-[#0a0f1a] border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-white font-mono">{lane.id}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 font-semibold text-slate-300">
                      Lane {lane.lane_index + 1}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                    <span>Width: {lane.estimated_width_m}m</span>
                    <span>•</span>
                    <span>Conf: {Math.round(lane.source_confidence * 100)}%</span>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {lane.allowed_movements.map((m, idx) => (
                      <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Lane Details & Graph Connections */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {selectedLane && (
            <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 shadow-md space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-base font-extrabold text-white">Lane Detail: {selectedLane.id}</h2>
                  <p className="text-xs text-slate-400">Road Segment: {selectedLane.road_segment_id}</p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Allowed Changes</div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold">
                    <span className={selectedLane.change_left ? "text-emerald-400" : "text-slate-600"}>
                      Left: {selectedLane.change_left ? "YES" : "NO"}
                    </span>
                    <span>•</span>
                    <span className={selectedLane.change_right ? "text-emerald-400" : "text-slate-600"}>
                      Right: {selectedLane.change_right ? "YES" : "NO"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Centerline Waypoints */}
              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Centerline GeoJSON Coordinates ({selectedLane.centerline.length} waypoints)
                </h3>
                <div className="bg-[#0a0f1a] rounded-xl p-3 border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
                  {selectedLane.centerline.map((pt, i) => (
                    <div key={i} className="flex items-center justify-between py-0.5">
                      <span className="text-slate-500">Waypoint #{i + 1}</span>
                      <span className="text-cyan-400">[{pt.lat.toFixed(6)}, {pt.lon.toFixed(6)}]</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Connected Downstream Lanes */}
              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <GitFork className="w-3.5 h-3.5 text-blue-400" />
                  Downstream Lane Connections
                </h3>
                <div className="space-y-2">
                  {corridor?.connections
                    .filter((c) => c.from_lane_id === selectedLane.id)
                    .map((conn, idx) => (
                      <div
                        key={idx}
                        className="bg-[#0a0f1a] rounded-xl p-3 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-300">{conn.from_lane_id}</span>
                          <ArrowRight className="w-4 h-4 text-blue-400" />
                          <span className="font-mono text-emerald-400 font-bold">{conn.to_lane_id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold font-mono">
                            {conn.movement}
                          </span>
                          <span className="text-slate-400 font-mono">
                            Conf: {Math.round(conn.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
