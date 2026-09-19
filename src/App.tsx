import React, { useState, useEffect, useRef } from "react";
import {
  Navigation,
  BarChart2,
  Layers,
  MapPin,
  Search,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { DriverCockpit } from "./components/DriverCockpit";
import { ReplayLab } from "./components/ReplayLab";
import { CorridorExplorer } from "./components/CorridorExplorer";
import { RoutePlannerModal } from "./components/RoutePlannerModal";
import { GnssTelemetry, MotionSensors, LaneState, ManeuverInstruction } from "./types";

export function App() {
  const [activeTab, setActiveTab] = useState<"cockpit" | "replay" | "corridor">("cockpit");
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [usingBrowserGps, setUsingBrowserGps] = useState<boolean>(false);
  const [showRouteModal, setShowRouteModal] = useState<boolean>(false);

  // Active navigation route summary
  const [destination, setDestination] = useState<string>("Foothill Expressway, Cupertino");
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number>(14200);

  // Core Maneuvers
  const [maneuvers, setManeuvers] = useState<ManeuverInstruction[]>([
    {
      id: "m1",
      maneuver: "Keep left onto I-280 South",
      nextRoad: "Junipero Serra Freeway",
      distanceMeters: 450,
      turnType: "straight",
      recommendedLanes: [1, 2],
    },
    {
      id: "m2",
      maneuver: "Prepare to merge right in 2 km",
      nextRoad: "I-280 South",
      distanceMeters: 2100,
      turnType: "slight_right",
      recommendedLanes: [3, 4],
    },
  ]);
  const [currentManeuverIndex, setCurrentManeuverIndex] = useState<number>(0);

  // GNSS Telemetry State
  const [telemetry, setTelemetry] = useState<GnssTelemetry>({
    latitude: 37.7749,
    longitude: -122.4194,
    accuracyMeters: 1.8,
    speedMps: 27.2, // ~61 mph
    bearingDegrees: 342,
    satellitesVisible: 32,
    satellitesUsedInFix: 24,
    averageUsedCn0DbHz: 38.5,
    qualityScore: 94,
    qualityLabel: "LANE_GRADE_DGPS",
    provider: "simulation",
    fixReceived: true,
    fixAgeMs: 250,
  });

  // Motion Sensors
  const [sensors, setSensors] = useState<MotionSensors>({
    sensorHeadingDegrees: 342.4,
    fusedHeadingDegrees: 342.1,
    lateralAccelerationMps2: 0.12,
    yawRateDegS: 0.4,
    motionHint: "CRUISING STEADY",
    sensorFrameCalibrated: true,
    sensorLaneReady: true,
  });

  // Lane Matcher State
  const [laneState, setLaneState] = useState<LaneState>({
    laneCount: 4,
    likelyLaneNumberFromLeft: 2,
    laneConfidence: 0.88,
    laneExactClaim: true,
    targetLanes: [1, 2],
    laneProbabilities: [0.08, 0.88, 0.04, 0.0],
    laneDataStatus: "LOADED",
  });

  const geoWatchIdRef = useRef<number | null>(null);

  // Handle Real Device / Browser Geolocation
  const toggleBrowserGps = () => {
    if (usingBrowserGps) {
      if (geoWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
        geoWatchIdRef.current = null;
      }
      setUsingBrowserGps(false);
      return;
    }

    if (!("geolocation" in navigator)) {
      alert("Browser geolocation is not available on this device.");
      return;
    }

    setUsingBrowserGps(true);
    setIsSimulating(false);

    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const speedMps = pos.coords.speed !== null && !isNaN(pos.coords.speed) ? pos.coords.speed : 24;
        const heading = pos.coords.heading !== null && !isNaN(pos.coords.heading) ? pos.coords.heading : 340;
        const accuracy = pos.coords.accuracy || 4.5;

        setTelemetry((prev) => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: accuracy,
          speedMps,
          bearingDegrees: heading,
          fixReceived: true,
          fixAgeMs: 100,
          provider: "gps",
          qualityLabel: accuracy <= 3 ? "LANE_GRADE_DGPS" : accuracy <= 8 ? "HIGH_ACCURACY" : "NOMINAL",
          qualityScore: Math.round(Math.max(50, 100 - accuracy * 5)),
        }));
      },
      (err) => {
        console.warn("Geolocation watch error:", err);
      },
      { enableHighAccuracy: true, maximumAge: 1000 }
    );
  };

  // Simulation Tick Loop
  useEffect(() => {
    if (!isSimulating) return;

    const timer = setInterval(() => {
      setTelemetry((prev) => {
        // Increment coordinates slightly along bearing
        const latDelta = 0.00008;
        const lonDelta = -0.00004;
        const speedNoise = (Math.random() - 0.5) * 0.4;
        const newSpeed = Math.max(18, Math.min(32, prev.speedMps + speedNoise));

        return {
          ...prev,
          latitude: prev.latitude + latDelta,
          longitude: prev.longitude + lonDelta,
          speedMps: newSpeed,
          fixAgeMs: 150 + Math.floor(Math.random() * 80),
        };
      });

      // Update sensors
      setSensors((prev) => ({
        ...prev,
        lateralAccelerationMps2: (Math.random() - 0.5) * 0.25,
        yawRateDegS: (Math.random() - 0.5) * 0.6,
      }));

      // Decrement maneuver distance
      setManeuvers((prev) => {
        const current = prev[currentManeuverIndex];
        if (!current) return prev;
        const updatedDist = Math.max(20, current.distanceMeters - 12);
        return prev.map((m, idx) => (idx === currentManeuverIndex ? { ...m, distanceMeters: updatedDist } : m));
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isSimulating, currentManeuverIndex]);

  // Clean up geolocation on unmount
  useEffect(() => {
    return () => {
      if (geoWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
      }
    };
  }, []);

  const handleSelectLane = (laneNum: number) => {
    setLaneState((prev) => {
      const probs = Array(prev.laneCount).fill(0.02);
      probs[laneNum - 1] = 0.88;
      return {
        ...prev,
        likelyLaneNumberFromLeft: laneNum,
        laneConfidence: 0.88,
        laneExactClaim: true,
        laneProbabilities: probs,
      };
    });
  };

  const handleApplyRoute = (newDest: string, newDist: number, newManeuvers: ManeuverInstruction[]) => {
    setDestination(newDest);
    setRouteDistanceMeters(newDist);
    setManeuvers(newManeuvers);
    setCurrentManeuverIndex(0);
    if (newManeuvers.length > 0) {
      setLaneState((prev) => ({
        ...prev,
        targetLanes: newManeuvers[0].recommendedLanes,
      }));
    }
  };

  const activeManeuver = maneuvers[currentManeuverIndex] || {
    id: "m_def",
    maneuver: "Continue on current road",
    nextRoad: "High-Speed Highway Corridor",
    distanceMeters: 450,
    turnType: "straight",
    recommendedLanes: [2, 3],
  };

  return (
    <div className="min-h-screen bg-[#090d15] text-slate-100 flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#0c121e]/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-[#0c121e] rounded-[10px] flex items-center justify-center text-cyan-400">
                <Navigation className="w-5 h-5 fill-cyan-400/20" />
              </div>
            </div>
            <div>
              <div className="font-extrabold text-white text-base tracking-tight leading-none flex items-center gap-1.5">
                LaneGPS
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                  Precision Nav
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-none mt-1">Open-Source Lane-Level Navigation</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-[#121927] p-1 rounded-2xl border border-slate-800">
            <button
              id="nav-cockpit-tab"
              onClick={() => setActiveTab("cockpit")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === "cockpit"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              Driver View
            </button>
            <button
              id="nav-replay-tab"
              onClick={() => setActiveTab("replay")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === "replay"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Trip Lab & Replay
            </button>
            <button
              id="nav-corridor-tab"
              onClick={() => setActiveTab("corridor")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === "corridor"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              OSM Corridor API
            </button>
          </nav>

          {/* Route Destination Trigger */}
          <div className="hidden md:flex items-center gap-2">
            <button
              id="open-route-modal-btn"
              onClick={() => setShowRouteModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 flex items-center gap-2 transition-all"
            >
              <Search className="w-3.5 h-3.5 text-blue-400" />
              <span className="truncate max-w-[140px]">{destination}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === "cockpit" && (
          <DriverCockpit
            telemetry={telemetry}
            sensors={sensors}
            laneState={laneState}
            maneuver={activeManeuver}
            sessionActive={sessionActive}
            onToggleSession={() => setSessionActive(!sessionActive)}
            onSimulateDrive={(sim) => setIsSimulating(sim)}
            isSimulating={isSimulating}
            onUseBrowserLocation={toggleBrowserGps}
            usingBrowserGps={usingBrowserGps}
            onSelectLane={handleSelectLane}
          />
        )}

        {activeTab === "replay" && <ReplayLab />}

        {activeTab === "corridor" && <CorridorExplorer />}
      </main>

      {/* Route Planner Modal */}
      <RoutePlannerModal
        isOpen={showRouteModal}
        onClose={() => setShowRouteModal(false)}
        onApplyRoute={handleApplyRoute}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0c121e]/50 py-3 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>Lane-Level GPS MVP • Self-Hosted OpenStreetMap Lane Graph & Probabilistic Matcher</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-400/80">
              <ShieldCheck className="w-3.5 h-3.5" /> Dual-State Uncertainty Mode Active
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
