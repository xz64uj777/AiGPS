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

export interface GnssTelemetry {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  speedMps: number;
  bearingDegrees: number;
  satellitesVisible: number;
  satellitesUsedInFix: number;
  averageUsedCn0DbHz: number;
  qualityScore: number;
  qualityLabel: "EXCELLENT" | "LANE_GRADE_DGPS" | "HIGH_ACCURACY" | "NOMINAL" | "DEGRADED" | "WAITING";
  provider: "gps" | "network" | "fused" | "simulation";
  fixReceived: boolean;
  fixAgeMs: number;
}

export interface MotionSensors {
  sensorHeadingDegrees: number;
  fusedHeadingDegrees: number;
  lateralAccelerationMps2: number;
  yawRateDegS: number;
  motionHint: string;
  sensorFrameCalibrated: boolean;
  sensorLaneReady: boolean;
}

export interface LaneState {
  laneCount: number;
  likelyLaneNumberFromLeft: number | null; // 1-indexed
  laneConfidence: number; // 0.0 - 1.0
  laneExactClaim: boolean;
  targetLanes: number[]; // e.g. [1, 2] for upcoming exit
  laneProbabilities: number[]; // e.g. [0.1, 0.8, 0.1, 0.0]
  laneDataStatus: "LOADED" | "SEARCHING" | "NOT_LOADED" | "CACHE_HIT";
}

export interface ManeuverInstruction {
  id: string;
  maneuver: string;
  nextRoad: string;
  distanceMeters: number;
  turnType: "straight" | "left" | "right" | "slight_left" | "slight_right" | "merge" | "exit";
  recommendedLanes: number[];
}

export interface ReplayRecord {
  timestamp: number;
  predicted_lane: string;
  confidence: number;
  actual_lane: string;
  lat?: number;
  lon?: number;
  speed_mph?: number;
  heading_deg?: number;
  fix_quality?: string;
}

export interface CalibrationBucket {
  samples: number;
  actual_accuracy_pct: number;
}

export interface ReplayEvaluation {
  samples_with_truth: number;
  overall_accuracy_pct: number;
  high_confidence_samples: number;
  high_confidence_accuracy_pct: number;
  false_lane_change_events: number;
  calibration: Record<string, CalibrationBucket>;
}
