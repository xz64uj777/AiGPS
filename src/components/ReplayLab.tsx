import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Upload,
  CheckCircle2,
  XCircle,
  BarChart2,
  FileText,
  Clock,
  Gauge,
  Compass,
} from "lucide-react";
import { ForwardLaneCanvas } from "./ForwardLaneCanvas";
import { ReplayRecord, ReplayEvaluation } from "../types";

export const ReplayLab: React.FC = () => {
  const [records, setRecords] = useState<ReplayRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [evaluation, setEvaluation] = useState<ReplayEvaluation | null>(null);
  const [fileName, setFileName] = useState<string>("sample-drive.jsonl");
  const [loading, setLoading] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load sample drive on mount
  useEffect(() => {
    fetchSampleDrive();
  }, []);

  const fetchSampleDrive = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/replay/sample");
      const data = await res.json();
      if (data.records) {
        setRecords(data.records);
        setEvaluation(data.evaluation);
        setCurrentIndex(0);
        setFileName("sample-drive.jsonl (Built-in Highway Drive)");
      }
    } catch (err) {
      console.warn("Failed to load sample drive:", err);
    } finally {
      setLoading(false);
    }
  };

  // Playback timer
  useEffect(() => {
    if (!isPlaying || records.length === 0) return;

    const intervalMs = Math.max(100, 1000 / playbackSpeed);
    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= records.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, records.length]);

  // Handle custom CSV / JSONL file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsPlaying(false);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const parsedRecords: ReplayRecord[] = [];

      if (file.name.endsWith(".jsonl") || text.trim().startsWith("{")) {
        // Parse JSONL
        const lines = text.split("\n");
        lines.forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          try {
            const obj = JSON.parse(trimmed);
            parsedRecords.push({
              timestamp: obj.timestamp ?? parsedRecords.length + 1,
              predicted_lane: obj.predicted_lane || "L2",
              confidence: parseFloat(obj.confidence) || 0.8,
              actual_lane: obj.actual_lane || obj.ground_truth_lane || "L2",
              lat: obj.lat ?? 37.7749,
              lon: obj.lon ?? -122.4194,
              speed_mph: obj.speed_mph ?? 60,
              heading_deg: obj.heading_deg ?? 340,
            });
          } catch (e) {
            // ignore bad line
          }
        });
      } else {
        // Parse CSV
        const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length > 1) {
          const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
          const predIdx = headers.indexOf("predicted_lane") !== -1 ? headers.indexOf("predicted_lane") : headers.indexOf("pred");
          const truthIdx = headers.indexOf("actual_lane") !== -1 ? headers.indexOf("actual_lane") : headers.indexOf("truth");
          const confIdx = headers.indexOf("confidence") !== -1 ? headers.indexOf("confidence") : headers.indexOf("conf");
          const latIdx = headers.indexOf("lat");
          const lonIdx = headers.indexOf("lon");
          const speedIdx = headers.indexOf("speed_mph");

          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(",").map((c) => c.trim());
            parsedRecords.push({
              timestamp: i,
              predicted_lane: predIdx !== -1 ? cols[predIdx] : "L2",
              actual_lane: truthIdx !== -1 ? cols[truthIdx] : "L2",
              confidence: confIdx !== -1 ? parseFloat(cols[confIdx]) || 0.8 : 0.8,
              lat: latIdx !== -1 ? parseFloat(cols[latIdx]) || 37.7749 : 37.7749,
              lon: lonIdx !== -1 ? parseFloat(cols[lonIdx]) || -122.4194 : -122.4194,
              speed_mph: speedIdx !== -1 ? parseFloat(cols[speedIdx]) || 60 : 60,
            });
          }
        }
      }

      if (parsedRecords.length > 0) {
        setRecords(parsedRecords);
        setCurrentIndex(0);

        // Evaluate with backend
        try {
          const res = await fetch("/api/v1/replay/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ records: parsedRecords }),
          });
          const evalData = await res.json();
          setEvaluation(evalData);
        } catch (e) {
          console.warn("Evaluation failed:", e);
        }
      }
    };
    reader.readAsText(file);
  };

  const currentRecord = records[currentIndex] || {
    timestamp: 0,
    predicted_lane: "L2",
    confidence: 0.85,
    actual_lane: "L2",
    speed_mph: 60,
  };

  // Convert string like "L2" or "2" to integer
  const extractLaneNum = (laneStr?: string): number => {
    if (!laneStr) return 2;
    const match = laneStr.match(/\d+/);
    return match ? parseInt(match[0], 10) : 2;
  };

  const predLaneNum = extractLaneNum(currentRecord.predicted_lane);
  const actualLaneNum = extractLaneNum(currentRecord.actual_lane);
  const isCorrect = currentRecord.predicted_lane === currentRecord.actual_lane;

  return (
    <div className="space-y-4">
      {/* Header & File Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121927] border border-slate-800 rounded-2xl p-4 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-400" />
            <h1 className="text-xl font-extrabold text-white">Trip Lab & Drive Replay</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Evaluate lane prediction model accuracy, false lane-change rates, and confidence calibration
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".jsonl,.csv,.txt"
            className="hidden"
          />
          <button
            id="upload-replay-file-btn"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            Upload Drive Log (.jsonl / .csv)
          </button>
          <button
            id="reload-sample-drive-btn"
            onClick={fetchSampleDrive}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-xs font-bold text-blue-200 flex items-center gap-1.5 transition-all"
          >
            <FileText className="w-3.5 h-3.5 text-blue-300" />
            Load Sample Drive
          </button>
        </div>
      </div>

      {/* Main Content: Left Visualizer + Right Replay Controls & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Replay Visualizer */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 shadow-xl">
            {/* Record Snapshot Banner */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isCorrect
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-red-500/20 text-red-400 border border-red-500/40"
                  }`}
                >
                  {isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-mono">
                    Frame {currentIndex + 1} of {records.length} (T = {currentRecord.timestamp}s)
                  </div>
                  <div className="text-base font-extrabold text-white flex items-center gap-2">
                    <span>Predicted: <span className="text-blue-400">{currentRecord.predicted_lane}</span></span>
                    <span className="text-slate-600">•</span>
                    <span>Actual: <span className="text-emerald-400">{currentRecord.actual_lane}</span></span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400">Confidence</div>
                <div className="text-lg font-black font-mono text-emerald-400">
                  {Math.round(currentRecord.confidence * 100)}%
                </div>
              </div>
            </div>

            {/* 3D Forward Lane View Canvas */}
            <ForwardLaneCanvas
              laneCount={4}
              currentLane={predLaneNum}
              exactClaim={currentRecord.confidence >= 0.85}
              confidence={currentRecord.confidence}
              targetLanes={[actualLaneNum]}
              speedMps={((currentRecord.speed_mph || 55) / 2.23694)}
              className="w-full h-72 sm:h-80"
            />

            {/* Replay Controls & Scrubber */}
            <div className="mt-4 pt-3 border-t border-slate-800 space-y-3">
              {/* Timeline Slider */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-400 w-10 text-right">{currentIndex + 1}</span>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, records.length - 1)}
                  value={currentIndex}
                  onChange={(e) => setCurrentIndex(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
                <span className="text-xs font-mono text-slate-400 w-10">{records.length}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    id="replay-rewind-btn"
                    onClick={() => setCurrentIndex(0)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                    title="Restart"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    id="replay-prev-frame-btn"
                    onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                    title="Previous Sample"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    id="replay-play-pause-btn"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                  <button
                    id="replay-next-frame-btn"
                    onClick={() => setCurrentIndex((prev) => Math.min(records.length - 1, prev + 1))}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                    title="Next Sample"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                {/* Playback Speed Toggles */}
                <div className="flex items-center gap-1 bg-[#0a0f1a] p-1 rounded-xl border border-slate-800">
                  {[1, 2, 5].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                        playbackSpeed === speed
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Evaluation Stats & Calibration Matrix */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {evaluation && (
            <>
              {/* Performance Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#121927] border border-slate-800 rounded-2xl p-3.5 shadow-md">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Accuracy</div>
                  <div className="text-2xl font-black text-white mt-0.5">
                    {evaluation.overall_accuracy_pct}%
                  </div>
                  <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                    {evaluation.samples_with_truth} Ground Truth Samples
                  </div>
                </div>

                <div className="bg-[#121927] border border-slate-800 rounded-2xl p-3.5 shadow-md">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">High Conf. (&ge;85%)</div>
                  <div className="text-2xl font-black text-emerald-400 mt-0.5">
                    {evaluation.high_confidence_accuracy_pct}%
                  </div>
                  <div className="text-[11px] text-slate-400 font-semibold mt-0.5">
                    {evaluation.high_confidence_samples} samples
                  </div>
                </div>
              </div>

              {/* False Lane Changes Card */}
              <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 shadow-md">
                <div className="flex justify-between items-center mb-1">
                  <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">False Lane-Change Events</h2>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold font-mono ${
                      evaluation.false_lane_change_events === 0
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {evaluation.false_lane_change_events} Events
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Number of times prediction switched lanes while ground truth remained steady in the same lane.
                </p>
              </div>

              {/* Confidence Calibration Matrix */}
              <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 shadow-md">
                <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Confidence Calibration Matrix
                </h2>
                <div className="space-y-1.5 text-xs">
                  {Object.entries(evaluation.calibration)
                    .filter(([_, data]) => data.samples > 0)
                    .map(([bracket, data]) => (
                      <div key={bracket} className="flex items-center justify-between py-1 border-b border-slate-800/40">
                        <span className="text-slate-400 font-mono w-20">{bracket}</span>
                        <div className="flex-1 mx-3 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full"
                            style={{ width: `${data.actual_accuracy_pct}%` }}
                          />
                        </div>
                        <span className="text-white font-mono font-bold w-16 text-right">
                          {data.actual_accuracy_pct}% ({data.samples})
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}

          {/* Records Table Preview */}
          <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 shadow-md flex-1 max-h-56 overflow-y-auto">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Sample Log Timeline</h2>
            <div className="space-y-1 text-xs font-mono">
              {records.slice(0, 15).map((rec, i) => (
                <div
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`p-1.5 rounded-lg flex items-center justify-between cursor-pointer transition-all ${
                    currentIndex === i
                      ? "bg-blue-600/30 border border-blue-500/50 text-white font-bold"
                      : "text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  <span>T={rec.timestamp}s</span>
                  <span>Pred: {rec.predicted_lane} ({Math.round(rec.confidence * 100)}%)</span>
                  <span className={rec.predicted_lane === rec.actual_lane ? "text-emerald-400" : "text-red-400"}>
                    Truth: {rec.actual_lane}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
