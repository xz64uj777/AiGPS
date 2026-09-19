import React, { useState, useEffect } from "react";
import {
  Navigation,
  Compass,
  Radio,
  Gauge,
  Volume2,
  AlertTriangle,
  Play,
  Square,
  Sparkles,
  ChevronDown,
  ChevronUp,
  MapPin,
  RefreshCw,
  Sliders,
  Clock,
  Zap,
  TrendingDown,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { ForwardLaneCanvas } from "./ForwardLaneCanvas";
import {
  GnssTelemetry,
  MotionSensors,
  LaneState,
  ManeuverInstruction,
  LiveTrafficSummary,
} from "../types";

interface DriverCockpitProps {
  telemetry: GnssTelemetry;
  sensors: MotionSensors;
  laneState: LaneState;
  maneuver: ManeuverInstruction;
  sessionActive: boolean;
  onToggleSession: () => void;
  onSimulateDrive: (active: boolean) => void;
  isSimulating: boolean;
  onUseBrowserLocation: () => void;
  usingBrowserGps: boolean;
  onSelectLane: (laneNumber: number) => void;
  liveTraffic?: LiveTrafficSummary | null;
  trafficLoading?: boolean;
  onRefreshTraffic?: () => void;
  onOpenRoutePlanner?: () => void;
  destinationName?: string;
}

export const DriverCockpit: React.FC<DriverCockpitProps> = ({
  telemetry,
  sensors,
  laneState,
  maneuver,
  sessionActive,
  onToggleSession,
  onSimulateDrive,
  isSimulating,
  onUseBrowserLocation,
  usingBrowserGps,
  onSelectLane,
  liveTraffic,
  trafficLoading = false,
  onRefreshTraffic,
  onOpenRoutePlanner,
  destinationName = "Foothill Expressway, Cupertino",
}) => {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [aiVoicePrompt, setAiVoicePrompt] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [voiceSpoken, setVoiceSpoken] = useState(false);

  const speedMph = (telemetry.speedMps * 2.23694).toFixed(0);
  const isGpsStale = telemetry.fixAgeMs > 4000;
  const confidencePct = Math.round(laneState.laneConfidence * 100);

  // Compute live duration & delay strings
  const liveMinutes = liveTraffic
    ? Math.max(1, Math.round(liveTraffic.liveDurationSeconds / 60))
    : 14;
  const delayMinutes = liveTraffic
    ? Math.round(liveTraffic.delaySeconds / 60)
    : 0;

  // Request voice guidance prompt
  const requestVoicePrompt = async () => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/v1/ai/guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentLane: laneState.likelyLaneNumberFromLeft || 2,
          totalLanes: laneState.laneCount,
          targetLanes: laneState.targetLanes,
          maneuver: maneuver.maneuver,
          distanceMeters: maneuver.distanceMeters,
          confidence: laneState.laneConfidence,
          trafficDelayMinutes: delayMinutes,
          trafficCondition: liveTraffic?.overallCongestion || "NORMAL",
        }),
      });
      const data = await res.json();
      setAiVoicePrompt(data.prompt);

      // Speak using Web Speech API if supported
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(data.prompt);
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
        setVoiceSpoken(true);
      }
    } catch (e) {
      console.warn("Guidance request failed:", e);
      setAiVoicePrompt(`In ${Math.round(maneuver.distanceMeters)}m, ${maneuver.maneuver}.`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Driver Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121927] border border-slate-800/80 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-white">LaneGPS</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Google Maps Traffic
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Probabilistic Lane Navigation with Real-Time Congestion & ETA
            </p>
          </div>
        </div>

        {/* Status Pills & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh Traffic Button */}
          {onRefreshTraffic && (
            <button
              onClick={onRefreshTraffic}
              disabled={trafficLoading}
              title="Refresh live Google Maps traffic flow"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${trafficLoading ? "animate-spin" : ""}`} />
              <span>{trafficLoading ? "Syncing..." : "Live Traffic"}</span>
            </button>
          )}

          {/* Status Indicator */}
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
              isGpsStale
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : sessionActive
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isGpsStale
                  ? "bg-red-400 animate-ping"
                  : sessionActive
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-blue-400"
              }`}
            />
            {isGpsStale ? "GPS LOST" : sessionActive ? "RECORDING DRIVE" : "ONLINE"}
          </div>

          {/* Session Record Button */}
          <button
            id="toggle-drive-session-btn"
            onClick={onToggleSession}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              sessionActive
                ? "bg-red-600 hover:bg-red-500 text-white"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            }`}
          >
            {sessionActive ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" /> Stop & Save
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" /> Start Drive
              </>
            )}
          </button>

          {/* Browser Location Button */}
          <button
            id="toggle-browser-gps-btn"
            onClick={onUseBrowserLocation}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              usingBrowserGps
                ? "bg-emerald-950 text-emerald-300 border-emerald-500/50"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
            }`}
            title="Use real smartphone / browser GPS"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            {usingBrowserGps ? "Real GPS Active" : "Use Real GPS"}
          </button>
        </div>
      </div>

      {/* Live Traffic Aware ETA & Highway Corridor Banner */}
      <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Destination & Real ETA */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Live Traffic-Aware ETA
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    delayMinutes > 5
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : delayMinutes > 1
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {delayMinutes > 0 ? `+${delayMinutes} MIN DELAY` : "CLEAR FLOW"}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-white">{liveMinutes} min</span>
                <span className="text-xs text-slate-400">
                  ({((liveTraffic?.distanceMeters || 14200) / 1609.34).toFixed(1)} mi via {destinationName})
                </span>
              </div>
            </div>
          </div>

          {/* Quick Route Switcher / Congestion Level */}
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] uppercase font-bold text-slate-400">Corridor Flow</div>
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1 justify-end">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                {liveTraffic?.overallCongestion === "TRAFFIC_JAM"
                  ? "HEAVY TRAFFIC JAM"
                  : liveTraffic?.overallCongestion === "SLOW"
                  ? "MODERATE SLOWDOWN"
                  : "FREE FLOW (OPTIMAL)"}
              </div>
            </div>
            {onOpenRoutePlanner && (
              <button
                onClick={onOpenRoutePlanner}
                className="px-3 py-2 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 text-xs font-bold transition-all"
              >
                Change Destination
              </button>
            )}
          </div>
        </div>

        {/* Live Per-Lane Congestion Distribution Bar */}
        {liveTraffic?.laneSpeeds && liveTraffic.laneSpeeds.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-blue-400" />
                Live Per-Lane Speeds (Google Maps Routes Feed)
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Updated {liveTraffic.lastUpdated ? new Date(liveTraffic.lastUpdated).toLocaleTimeString() : "Just now"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {liveTraffic.laneSpeeds.map((lane) => {
                const isCurrent = laneState.likelyLaneNumberFromLeft === lane.laneNumber;
                return (
                  <div
                    key={lane.laneNumber}
                    onClick={() => onSelectLane(lane.laneNumber)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-400/40"
                        : "bg-[#0a0f1a] border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200 flex items-center gap-1">
                        Lane {lane.laneNumber}
                        {lane.isHovOrExpress && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/30 text-purple-300">
                            HOV
                          </span>
                        )}
                      </span>
                      <span
                        className={`font-black font-mono text-sm ${
                          lane.congestion === "TRAFFIC_JAM"
                            ? "text-red-400"
                            : lane.congestion === "SLOW"
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {lane.speedMph} mph
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                      <span>{lane.label}</span>
                      <span
                        className={
                          lane.congestion === "TRAFFIC_JAM"
                            ? "text-red-400 font-bold"
                            : lane.congestion === "SLOW"
                            ? "text-amber-400 font-semibold"
                            : "text-emerald-400"
                        }
                      >
                        {lane.congestion}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Live Traffic Hazard Advisory */}
        {liveTraffic?.incidents && liveTraffic.incidents.length > 0 && (
          <div className="mt-3 bg-amber-950/40 border border-amber-500/40 rounded-xl p-2.5 flex items-center gap-2.5 text-xs text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex-1">
              <span className="font-bold">Live Traffic Advisory: </span>
              <span>{liveTraffic.incidents[0].description}</span>
            </div>
          </div>
        )}
      </div>

      {/* GPS Stale Warning Banner */}
      {isGpsStale && (
        <div className="bg-red-950/60 border border-red-500/40 rounded-xl p-3 flex items-start gap-3 text-red-200">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-bold text-red-300">GPS Signal Degraded or Stale</h2>
            <p className="text-xs text-red-200/80 mt-0.5">
              Last location fix was received {(telemetry.fixAgeMs / 1000).toFixed(1)}s ago. Forward lane guidance
              will remain locked/paused until fresh GNSS measurements arrive.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Left Perspective View + Right Navigation Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: 3D Forward Lane View Card */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xl">
            {/* Maneuver Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                  <Navigation className="w-6 h-6 rotate-45" />
                </div>
                <div>
                  <div className="text-xs font-bold text-blue-400 tracking-wide uppercase">
                    {Math.round(maneuver.distanceMeters)}m Ahead
                  </div>
                  <div className="text-lg font-extrabold text-white">{maneuver.maneuver}</div>
                  <div className="text-xs text-slate-400">{maneuver.nextRoad}</div>
                </div>
              </div>

              {/* Target Lane Pills */}
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400">Target Lanes</div>
                <div className="flex items-center gap-1 mt-1 justify-end">
                  {Array.from({ length: laneState.laneCount }, (_, i) => i + 1).map((laneNum) => {
                    const isTarget = laneState.targetLanes.includes(laneNum);
                    const isCurrent = laneState.likelyLaneNumberFromLeft === laneNum;
                    return (
                      <button
                        key={laneNum}
                        onClick={() => onSelectLane(laneNum)}
                        title={`Click to switch vehicle position to Lane ${laneNum}`}
                        className={`w-7 h-7 rounded-lg text-xs font-extrabold transition-all ${
                          isCurrent
                            ? "bg-emerald-500 text-slate-950 ring-2 ring-emerald-300 shadow-md scale-110"
                            : isTarget
                            ? "bg-blue-500/30 text-blue-300 border border-blue-400/50 hover:bg-blue-500/40"
                            : "bg-slate-800/80 text-slate-500 hover:bg-slate-700"
                        }`}
                      >
                        {laneNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Perspective Canvas with Live Traffic Ribbons */}
            <div className="relative">
              <ForwardLaneCanvas
                laneCount={laneState.laneCount}
                currentLane={laneState.likelyLaneNumberFromLeft}
                exactClaim={laneState.laneExactClaim}
                confidence={laneState.laneConfidence}
                targetLanes={laneState.targetLanes}
                speedMps={telemetry.speedMps}
                disabled={isGpsStale}
                statusMessage={telemetry.fixAgeMs > 4000 ? "Waiting for fresh GNSS fix" : undefined}
                className="w-full h-72 sm:h-80 md:h-[340px]"
                laneTraffic={liveTraffic?.laneSpeeds}
                incidents={liveTraffic?.incidents}
                trafficDelaySeconds={liveTraffic?.delaySeconds}
              />

              {/* Floating Guidance Badge */}
              <div className="absolute top-3 left-3 bg-[#0d1320]/80 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-1.5 flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    laneState.laneExactClaim
                      ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                      : laneState.laneConfidence >= 0.75
                      ? "bg-amber-400 shadow-[0_0_8px_#fbbf24]"
                      : "bg-blue-400"
                  }`}
                />
                <span className="text-xs font-bold text-white">
                  {laneState.laneExactClaim
                    ? `LANE ${laneState.likelyLaneNumberFromLeft} OF ${laneState.laneCount} (LOCKED)`
                    : `PROBABLE LANE ${laneState.likelyLaneNumberFromLeft} (${confidencePct}%)`}
                </span>
              </div>

              {/* Floating Live Traffic Badge */}
              {liveTraffic && (
                <div className="absolute top-3 right-3 bg-[#0d1320]/85 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-white">Google Maps Routes API</span>
                </div>
              )}
            </div>

            {/* Voice Guidance Trigger */}
            <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Volume2 className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="italic">
                  {aiVoicePrompt || "Tap Voice Guidance to hear real-time spoken lane & traffic advice"}
                </span>
              </div>
              <button
                id="generate-voice-prompt-btn"
                onClick={requestVoicePrompt}
                disabled={aiLoading}
                className="px-3 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                {aiLoading ? "Synthesizing..." : "Voice Guidance"}
              </button>
            </div>
          </div>

          {/* Probabilistic Lane Distribution Card */}
          <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                Lane Matcher Probability Distribution
              </h2>
              <span className="text-xs font-mono text-emerald-400 font-bold">{confidencePct}% Confidence</span>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-3">
              {Array.from({ length: laneState.laneCount }, (_, i) => {
                const laneIdx = i;
                const prob = laneState.laneProbabilities[laneIdx] || 0;
                const pct = Math.round(prob * 100);
                const isCurrent = laneState.likelyLaneNumberFromLeft === laneIdx + 1;
                const isTarget = laneState.targetLanes.includes(laneIdx + 1);

                return (
                  <div
                    key={i}
                    onClick={() => onSelectLane(laneIdx + 1)}
                    className={`cursor-pointer rounded-xl p-2.5 border transition-all ${
                      isCurrent
                        ? "bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30"
                        : isTarget
                        ? "bg-blue-950/30 border-blue-500/40"
                        : "bg-[#0a0f1a] border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-slate-200">Lane {laneIdx + 1}</span>
                      <span className="font-mono text-[11px] text-slate-400">{pct}%</span>
                    </div>
                    {/* Mini progress bar */}
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          isCurrent ? "bg-emerald-400" : isTarget ? "bg-blue-400" : "bg-slate-600"
                        }`}
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                    <div className="text-[10px] mt-1.5 text-slate-400 flex items-center justify-between">
                      <span>{isCurrent ? "Active" : isTarget ? "Target" : "Available"}</span>
                      <span>{laneIdx === 0 ? "Left/HOV" : laneIdx === 3 ? "Exit" : "Thru"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: GPS / GNSS Sensor Metrics & Diagnostics */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Key Metrics Strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#121927] border border-slate-800 rounded-2xl p-3 text-center shadow-md">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Speed</div>
              <div className="text-2xl font-black text-white mt-0.5">{speedMph}</div>
              <div className="text-[11px] font-mono text-blue-400 font-semibold">MPH</div>
            </div>

            <div className="bg-[#121927] border border-slate-800 rounded-2xl p-3 text-center shadow-md">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Accuracy</div>
              <div className="text-2xl font-black text-white mt-0.5">{telemetry.accuracyMeters.toFixed(1)}</div>
              <div className="text-[11px] font-mono text-emerald-400 font-semibold">meters</div>
            </div>

            <div className="bg-[#121927] border border-slate-800 rounded-2xl p-3 text-center shadow-md">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quality</div>
              <div className="text-2xl font-black text-white mt-0.5">{telemetry.qualityScore}</div>
              <div className="text-[11px] font-mono text-cyan-400 font-semibold">/ 100 PTS</div>
            </div>
          </div>

          {/* GNSS & Satellite Constellation Card */}
          <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-blue-400" />
                GNSS Receiver Telemetry
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold">
                {telemetry.qualityLabel}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Position</span>
                <span className="font-mono text-white font-medium">
                  {telemetry.latitude.toFixed(6)}°, {telemetry.longitude.toFixed(6)}°
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Satellites in Fix / Visible</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {telemetry.satellitesUsedInFix} / {telemetry.satellitesVisible} SVs
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Avg Carrier-to-Noise (C/N0)</span>
                <span className="font-mono text-cyan-400 font-bold">{telemetry.averageUsedCn0DbHz.toFixed(1)} dB-Hz</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Heading / Course over Ground</span>
                <span className="font-mono text-white font-bold flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-blue-400" />
                  {Math.round(telemetry.bearingDegrees)}°
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Provider & Freshness</span>
                <span className="font-mono text-slate-300">
                  {telemetry.provider.toUpperCase()} ({(telemetry.fixAgeMs / 1000).toFixed(1)}s)
                </span>
              </div>
            </div>
          </div>

          {/* Inertial & Motion Sensor Fusion Card */}
          <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-blue-400" />
                Motion Sensor Fusion (IMU)
              </h2>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  sensors.sensorLaneReady
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {sensors.sensorLaneReady ? "CALIBRATED" : "CALIBRATING"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-3">
              <div className="bg-[#0a0f1a] rounded-xl p-2.5 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-medium">Lateral Accel</div>
                <div className="text-base font-bold font-mono text-white mt-0.5">
                  {sensors.lateralAccelerationMps2 >= 0 ? "+" : ""}
                  {sensors.lateralAccelerationMps2.toFixed(2)} m/s²
                </div>
                <div className="text-[10px] text-slate-500">Lane-change detector</div>
              </div>

              <div className="bg-[#0a0f1a] rounded-xl p-2.5 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-medium">Yaw Rate (Gyro)</div>
                <div className="text-base font-bold font-mono text-white mt-0.5">
                  {sensors.yawRateDegS >= 0 ? "+" : ""}
                  {sensors.yawRateDegS.toFixed(1)}°/s
                </div>
                <div className="text-[10px] text-slate-500">Curvature tracking</div>
              </div>
            </div>

            <div className="text-xs flex justify-between items-center text-slate-400 pt-1">
              <span>Motion State:</span>
              <span className="font-semibold text-blue-300">{sensors.motionHint}</span>
            </div>
          </div>

          {/* Collapsible Deep Diagnostics Button */}
          <button
            id="toggle-deep-diagnostics-btn"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 text-xs font-bold text-slate-300 flex items-center justify-center gap-1.5 transition-all"
          >
            {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showDiagnostics ? "Hide Developer Diagnostics" : "Show Developer Diagnostics"}
          </button>

          {/* Deep Diagnostics Details */}
          {showDiagnostics && (
            <div className="bg-[#0b101c] border border-slate-800 rounded-2xl p-4 text-xs space-y-2 font-mono text-slate-300 animate-fadeIn">
              <div className="text-blue-400 font-bold border-b border-slate-800 pb-1 font-sans">
                Corridor & Matcher Internals
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lane Graph Status:</span>
                <span className="text-emerald-400">{laneState.laneDataStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Exact Claim Asserted:</span>
                <span>{laneState.laneExactClaim ? "YES (HIGH CONFIDENCE)" : "NO (PROBABILISTIC)"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Google Maps Live Feed:</span>
                <span className="text-emerald-400">Routes API v2 TRAFFIC_AWARE_OPTIMAL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fused Heading:</span>
                <span>{sensors.fusedHeadingDegrees.toFixed(1)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Target Route Maneuver:</span>
                <span>{maneuver.turnType.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Corridor Endpoint:</span>
                <span className="text-blue-400">/api/v1/corridor</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
