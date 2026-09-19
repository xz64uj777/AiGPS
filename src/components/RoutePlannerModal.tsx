import React, { useState } from "react";
import { X, Search, MapPin, Navigation, Clock, Compass } from "lucide-react";
import { ManeuverInstruction } from "../types";

interface RoutePlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyRoute: (destination: string, distanceMeters: number, maneuvers: ManeuverInstruction[]) => void;
}

const PRESET_ROUTES = [
  {
    name: "I-280 South → Exit 41B Foothill Expressway",
    destination: "Foothill Expressway, Cupertino",
    distanceMeters: 14200,
    durationMin: 12,
    maneuvers: [
      {
        id: "m1",
        maneuver: "Keep left onto I-280 South",
        nextRoad: "Junipero Serra Freeway",
        distanceMeters: 450,
        turnType: "straight" as const,
        recommendedLanes: [1, 2],
      },
      {
        id: "m2",
        maneuver: "Prepare to merge right in 2 km",
        nextRoad: "I-280 South",
        distanceMeters: 2100,
        turnType: "slight_right" as const,
        recommendedLanes: [3, 4],
      },
      {
        id: "m3",
        maneuver: "Take Exit 41B toward Foothill Blvd",
        nextRoad: "Exit 41B Ramp",
        distanceMeters: 800,
        turnType: "exit" as const,
        recommendedLanes: [4],
      },
    ],
  },
  {
    name: "US-101 North → San Francisco Downtown (4th St Exit)",
    destination: "4th St & King St, San Francisco",
    distanceMeters: 9800,
    durationMin: 10,
    maneuvers: [
      {
        id: "m1",
        maneuver: "Stay in right 2 lanes for 4th St Exit",
        nextRoad: "US-101 North",
        distanceMeters: 620,
        turnType: "exit" as const,
        recommendedLanes: [3, 4],
      },
      {
        id: "m2",
        maneuver: "Turn left onto 4th Street",
        nextRoad: "4th St",
        distanceMeters: 250,
        turnType: "left" as const,
        recommendedLanes: [1, 2],
      },
    ],
  },
];

export const RoutePlannerModal: React.FC<RoutePlannerModalProps> = ({ isOpen, onClose, onApplyRoute }) => {
  const [query, setQuery] = useState("");

  if (!isOpen) return null;

  const handleCustomPlan = () => {
    if (!query.trim()) return;
    onApplyRoute(query.trim(), 8500, [
      {
        id: "m_custom",
        maneuver: `Proceed toward ${query.trim()}`,
        nextRoad: "Main Highway Corridor",
        distanceMeters: 650,
        turnType: "straight",
        recommendedLanes: [2, 3],
      },
    ]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#121927] border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-extrabold text-white">Plan Destination Route</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Custom Input */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase">Search Destination</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomPlan()}
                placeholder="Address, exit, landmark, or intersection..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0a0f1a] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleCustomPlan}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all"
            >
              Plan
            </button>
          </div>
        </div>

        {/* Preset Curated Corridors */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase">Or Choose Tested Highway Corridor</div>
          <div className="space-y-2">
            {PRESET_ROUTES.map((route, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onApplyRoute(route.destination, route.distanceMeters, route.maneuvers);
                  onClose();
                }}
                className="p-3.5 rounded-2xl bg-[#0a0f1a] border border-slate-800 hover:border-blue-500/60 cursor-pointer transition-all hover:bg-blue-950/20"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-white">{route.name}</span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">
                    {(route.distanceMeters / 1609.34).toFixed(1)} mi
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-400" />
                    {route.durationMin} mins
                  </span>
                  <span>•</span>
                  <span>{route.maneuvers.length} lane guidance maneuvers</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
