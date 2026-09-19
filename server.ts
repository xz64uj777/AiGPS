import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini AI Client
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    try {
      aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      console.warn("Failed to initialize GoogleGenAI:", e);
      aiClient = null;
    }
  }
  return aiClient;
}

// Types matching backend/app/models.py
export type Movement =
  | "STRAIGHT"
  | "LEFT"
  | "RIGHT"
  | "SLIGHT_LEFT"
  | "SLIGHT_RIGHT"
  | "MERGE"
  | "EXIT"
  | "UTURN"
  | "UNKNOWN";

export interface LatLng {
  lat: number;
  lon: number;
}

export interface LaneDto {
  id: string;
  road_segment_id: string;
  lane_index: number;
  centerline: LatLng[];
  estimated_width_m: number;
  allowed_movements: Movement[];
  change_left: boolean;
  change_right: boolean;
  source_confidence: number;
}

export interface LaneConnectionDto {
  from_lane_id: string;
  to_lane_id: string;
  movement: Movement;
  legal: boolean;
  confidence: number;
}

export interface CorridorResponse {
  lanes: LaneDto[];
  connections: LaneConnectionDto[];
}

// Generate realistic OSM-style corridor for any coordinates
function generateCorridor(centerLat: number, centerLon: number, radiusM: number = 1200): CorridorResponse {
  const laneCount = 4;
  const laneWidthM = 3.65;
  const segmentLengthM = 600;
  // Convert meters to approximate degrees
  const latPerM = 1 / 111139;
  const lonPerM = 1 / (111139 * Math.cos((centerLat * Math.PI) / 180));

  const lanes: LaneDto[] = [];
  const connections: LaneConnectionDto[] = [];

  // Create two consecutive road segments (Segment A leading into Segment B / Junction)
  const segments = [
    { id: "seg_approach", offsetStart: -segmentLengthM / 2, offsetEnd: 0 },
    { id: "seg_junction", offsetStart: 0, offsetEnd: segmentLengthM / 2 },
  ];

  segments.forEach((seg, sIdx) => {
    for (let i = 0; i < laneCount; i++) {
      const laneId = `${seg.id}_l${i + 1}`;
      const lateralOffsetM = (i - (laneCount - 1) / 2) * laneWidthM;

      const p1: LatLng = {
        lat: centerLat + seg.offsetStart * latPerM,
        lon: centerLon + lateralOffsetM * lonPerM,
      };
      const p2: LatLng = {
        lat: centerLat + ((seg.offsetStart + seg.offsetEnd) / 2) * latPerM,
        lon: centerLon + (lateralOffsetM + (sIdx === 1 && i === 0 ? -1.5 : 0)) * lonPerM,
      };
      const p3: LatLng = {
        lat: centerLat + seg.offsetEnd * latPerM,
        lon: centerLon + (lateralOffsetM + (sIdx === 1 && i === 0 ? -3.5 : 0)) * lonPerM,
      };

      // Movements based on lane position
      let allowed: Movement[] = ["STRAIGHT"];
      if (i === 0) allowed = ["LEFT", "SLIGHT_LEFT"];
      else if (i === 1) allowed = ["STRAIGHT", "LEFT"];
      else if (i === laneCount - 1) allowed = ["RIGHT", "EXIT"];
      else allowed = ["STRAIGHT"];

      lanes.push({
        id: laneId,
        road_segment_id: seg.id,
        lane_index: i,
        centerline: [p1, p2, p3],
        estimated_width_m: laneWidthM,
        allowed_movements: allowed,
        change_left: i > 0,
        change_right: i < laneCount - 1,
        source_confidence: 0.92,
      });

      // Connect to downstream segment
      if (sIdx === 0) {
        const nextLaneId = `seg_junction_l${i + 1}`;
        connections.push({
          from_lane_id: laneId,
          to_lane_id: nextLaneId,
          movement: i === 0 ? "SLIGHT_LEFT" : "STRAIGHT",
          legal: true,
          confidence: 0.96,
        });

        // Lane change opportunities
        if (i > 0) {
          connections.push({
            from_lane_id: laneId,
            to_lane_id: `seg_junction_l${i}`,
            movement: "LEFT",
            legal: true,
            confidence: 0.88,
          });
        }
        if (i < laneCount - 1) {
          connections.push({
            from_lane_id: laneId,
            to_lane_id: `seg_junction_l${i + 2}`,
            movement: "RIGHT",
            legal: true,
            confidence: 0.88,
          });
        }
      }
    }
  });

  return { lanes, connections };
}

// Built-in Sample Drive Replay Data
const SAMPLE_DRIVE_RECORDS = [
  { timestamp: 1, predicted_lane: "L3", confidence: 0.91, actual_lane: "L3", lat: 37.7749, lon: -122.4194, speed_mph: 62.4, heading_deg: 342, fix_quality: "LANE_GRADE_DGPS" },
  { timestamp: 2, predicted_lane: "L3", confidence: 0.90, actual_lane: "L3", lat: 37.7753, lon: -122.4196, speed_mph: 63.1, heading_deg: 342, fix_quality: "LANE_GRADE_DGPS" },
  { timestamp: 3, predicted_lane: "L3", confidence: 0.76, actual_lane: "L3", lat: 37.7757, lon: -122.4198, speed_mph: 61.8, heading_deg: 341, fix_quality: "HIGH_ACCURACY" },
  { timestamp: 4, predicted_lane: "L2", confidence: 0.86, actual_lane: "L2", lat: 37.7761, lon: -122.4201, speed_mph: 59.5, heading_deg: 338, fix_quality: "LANE_GRADE_DGPS" },
  { timestamp: 5, predicted_lane: "L2", confidence: 0.93, actual_lane: "L2", lat: 37.7765, lon: -122.4203, speed_mph: 58.2, heading_deg: 335, fix_quality: "LANE_GRADE_DGPS" },
  { timestamp: 6, predicted_lane: "L2", confidence: 0.95, actual_lane: "L2", lat: 37.7769, lon: -122.4205, speed_mph: 57.0, heading_deg: 335, fix_quality: "LANE_GRADE_DGPS" },
  { timestamp: 7, predicted_lane: "L2", confidence: 0.82, actual_lane: "L2", lat: 37.7773, lon: -122.4208, speed_mph: 55.4, heading_deg: 336, fix_quality: "HIGH_ACCURACY" },
  { timestamp: 8, predicted_lane: "L1", confidence: 0.89, actual_lane: "L1", lat: 37.7777, lon: -122.4211, speed_mph: 52.0, heading_deg: 330, fix_quality: "LANE_GRADE_DGPS" },
  { timestamp: 9, predicted_lane: "L1", confidence: 0.94, actual_lane: "L1", lat: 37.7781, lon: -122.4214, speed_mph: 48.5, heading_deg: 328, fix_quality: "LANE_GRADE_DGPS" },
  { timestamp: 10, predicted_lane: "L1", confidence: 0.97, actual_lane: "L1", lat: 37.7785, lon: -122.4217, speed_mph: 45.0, heading_deg: 325, fix_quality: "LANE_GRADE_DGPS" },
  { timestamp: 11, predicted_lane: "L1", confidence: 0.96, actual_lane: "L1", lat: 37.7789, lon: -122.4220, speed_mph: 42.1, heading_deg: 325, fix_quality: "LANE_GRADE_DGPS" },
  { timestamp: 12, predicted_lane: "L1", confidence: 0.92, actual_lane: "L1", lat: 37.7793, lon: -122.4223, speed_mph: 39.8, heading_deg: 322, fix_quality: "LANE_GRADE_DGPS" },
];

// Replay Evaluation Algorithm matching tools/drive-replay/replay.py
function evaluateReplayRecords(records: Array<{ predicted_lane?: string; actual_lane?: string; confidence?: number }>) {
  let total = 0;
  let correct = 0;
  let hcTotal = 0;
  let hcCorrect = 0;
  let falseChanges = 0;
  const bins: Record<number, [number, number]> = {};
  for (let i = 0; i < 10; i++) bins[i] = [0, 0];

  let prevPred: string | undefined = undefined;
  let prevTruth: string | undefined = undefined;

  for (const r of records) {
    const truth = r.actual_lane;
    const pred = r.predicted_lane;
    const conf = Number(r.confidence || 0);

    if (!truth) continue;

    total += 1;
    const hit = pred === truth;
    if (hit) correct += 1;

    if (conf >= 0.85) {
      hcTotal += 1;
      if (hit) hcCorrect += 1;
    }

    const bucket = Math.min(9, Math.max(0, Math.floor(conf * 10)));
    bins[bucket][0] += 1;
    if (hit) bins[bucket][1] += 1;

    if (prevPred !== undefined && pred !== prevPred && truth === prevTruth) {
      falseChanges += 1;
    }

    prevPred = pred;
    prevTruth = truth;
  }

  const pct = (a: number, b: number) => (b === 0 ? 0.0 : Math.round((100 * a) / b * 100) / 100);

  const calibration: Record<string, { samples: number; actual_accuracy_pct: number }> = {};
  for (let i = 0; i < 10; i++) {
    const [n, h] = bins[i];
    calibration[`${i * 10}-${(i + 1) * 10}%`] = {
      samples: n,
      actual_accuracy_pct: pct(h, n),
    };
  }

  return {
    samples_with_truth: total,
    overall_accuracy_pct: pct(correct, total),
    high_confidence_samples: hcTotal,
    high_confidence_accuracy_pct: pct(hcCorrect, hcTotal),
    false_lane_change_events: falseChanges,
    calibration,
  };
}

// ------------------- API ROUTES -------------------

// Health check (matching Python FastAPI @app.get("/health"))
app.get(["/health", "/api/health"], (req, res) => {
  res.json({ ok: true, runtime: "node", service: "lane-level-gps-api" });
});

// Corridor endpoint (matching Python FastAPI @app.get("/v1/corridor"))
app.get(["/v1/corridor", "/api/v1/corridor"], (req, res) => {
  const lat = parseFloat(req.query.lat as string) || 37.7749;
  const lon = parseFloat(req.query.lon as string) || -122.4194;
  const radiusM = parseInt(req.query.radius_m as string) || 1200;

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(422).json({ error: "Invalid coordinates range" });
  }

  const corridor = generateCorridor(lat, lon, radiusM);
  res.json(corridor);
});

// Dev corridor import (matching Python FastAPI @app.post("/v1/dev/import-corridor"))
app.post(["/v1/dev/import-corridor", "/api/v1/dev/import-corridor"], (req, res) => {
  const lat = parseFloat(req.query.lat as string || req.body?.lat) || 37.7749;
  const lon = parseFloat(req.query.lon as string || req.body?.lon) || -122.4194;
  const radiusM = parseInt(req.query.radius_m as string || req.body?.radius_m) || 1200;

  const corridor = generateCorridor(lat, lon, radiusM);
  res.json({
    status: "imported",
    center: { lat, lon },
    radius_meters: radiusM,
    imported_lanes_count: corridor.lanes.length,
    imported_connections_count: corridor.connections.length,
    corridor,
  });
});

// Replay sample endpoint
app.get("/api/v1/replay/sample", (req, res) => {
  res.json({
    count: SAMPLE_DRIVE_RECORDS.length,
    records: SAMPLE_DRIVE_RECORDS,
    evaluation: evaluateReplayRecords(SAMPLE_DRIVE_RECORDS),
  });
});

// Replay evaluate endpoint
app.post("/api/v1/replay/evaluate", (req, res) => {
  const records = req.body?.records || [];
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: "Provide a 'records' array with drive replay samples" });
  }
  const result = evaluateReplayRecords(records);
  res.json(result);
});

// AI lane guidance voice prompt generation (server-side Gemini)
app.post("/api/v1/ai/guidance", async (req, res) => {
  const { currentLane, totalLanes, targetLanes, maneuver, distanceMeters, confidence } = req.body || {};
  const ai = getGemini();

  if (!ai) {
    // Graceful rule-based fallback when Gemini API key is not configured
    let guidance = `Stay in lane ${currentLane} of ${totalLanes}.`;
    if (targetLanes && targetLanes.length > 0 && !targetLanes.includes(currentLane)) {
      const dir = targetLanes[0] < currentLane ? "left" : "right";
      const count = Math.abs(targetLanes[0] - currentLane);
      guidance = `In ${Math.round(distanceMeters)} meters, move ${count === 1 ? "one lane" : `${count} lanes`} ${dir} to prepare for ${maneuver || "your turn"}.`;
    } else if (maneuver) {
      guidance = `In ${Math.round(distanceMeters)} meters, ${maneuver}. You are currently in the correct lane.`;
    }
    return res.json({ prompt: guidance, source: "rule-engine" });
  }

  try {
    const prompt = `You are a concise, ultra-clear in-car navigation voice assistant providing real-time lane guidance.
Current situation:
- Driver is currently in Lane ${currentLane} of ${totalLanes} (1 is leftmost).
- Recommended target lanes for next exit/turn: ${JSON.stringify(targetLanes)}.
- Next maneuver: "${maneuver}" in ${Math.round(distanceMeters)} meters.
- Current lane estimation confidence: ${Math.round((confidence || 0.9) * 100)}%.

Generate a natural, clear spoken guidance prompt (maximum 15 words) for the driver. Do not include markdown or filler words.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text?.trim() || `In ${Math.round(distanceMeters)} meters, ${maneuver}.`;
    res.json({ prompt: text, source: "gemini" });
  } catch (err: any) {
    console.warn("Gemini generation failed, falling back to rule prompt:", err?.message);
    res.json({
      prompt: `In ${Math.round(distanceMeters)} meters, ${maneuver}. Stay alert.`,
      source: "fallback",
    });
  }
});

// ------------------- SERVER BOOTSTRAP -------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Lane-Level GPS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
