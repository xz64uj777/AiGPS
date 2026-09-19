import React, { useEffect, useRef } from "react";
import { LaneTrafficStatus, TrafficIncident } from "../types";

interface ForwardLaneCanvasProps {
  laneCount: number;
  currentLane: number | null; // 1-indexed
  exactClaim: boolean;
  confidence: number;
  targetLanes?: number[];
  speedMps?: number;
  disabled?: boolean;
  statusMessage?: string;
  className?: string;
  laneTraffic?: LaneTrafficStatus[];
  incidents?: TrafficIncident[];
  trafficDelaySeconds?: number;
}

export const ForwardLaneCanvas: React.FC<ForwardLaneCanvasProps> = ({
  laneCount = 4,
  currentLane = 2,
  exactClaim = false,
  confidence = 0.85,
  targetLanes = [2, 3],
  speedMps = 24.5,
  disabled = false,
  statusMessage,
  className = "w-full h-72 sm:h-80 md:h-96",
  laneTraffic,
  incidents = [],
  trafficDelaySeconds = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const dashOffsetRef = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Advance dash offset proportional to speed
      if (!disabled && speedMps > 0.5) {
        dashOffsetRef.current = (dashOffsetRef.current + speedMps * dt * 8) % 100;
      }

      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Background Sky/Horizon
      const horizonY = h * 0.18;
      const bottomY = h * 0.94;
      const horizonHalfWidth = w * 0.22;
      const bottomHalfWidth = w * 0.48;
      const centerX = w / 2;

      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, "#080c14");
      skyGrad.addColorStop(1, "#111724");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, horizonY);

      // Distant mountains / horizon glow
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(w * 0.2, horizonY - 14);
      ctx.lineTo(w * 0.45, horizonY - 4);
      ctx.lineTo(w * 0.7, horizonY - 18);
      ctx.lineTo(w, horizonY);
      ctx.lineTo(w, horizonY + 2);
      ctx.lineTo(0, horizonY + 2);
      ctx.closePath();
      ctx.fillStyle = "#161f30";
      ctx.fill();

      // Road Trapezoid
      ctx.beginPath();
      ctx.moveTo(centerX - horizonHalfWidth, horizonY);
      ctx.lineTo(centerX + horizonHalfWidth, horizonY);
      ctx.lineTo(centerX + bottomHalfWidth, bottomY);
      ctx.lineTo(centerX - bottomHalfWidth, bottomY);
      ctx.closePath();

      const roadGrad = ctx.createLinearGradient(0, horizonY, 0, bottomY);
      if (disabled) {
        roadGrad.addColorStop(0, "#121722");
        roadGrad.addColorStop(1, "#19202c");
      } else {
        roadGrad.addColorStop(0, "#192234");
        roadGrad.addColorStop(1, "#253147");
      }
      ctx.fillStyle = roadGrad;
      ctx.fill();

      const safeCount = Math.max(1, Math.min(8, laneCount));
      const activeIdx = currentLane !== null ? currentLane - 1 : -1;

      // 1. Draw Live Per-Lane Traffic Underlay Ribbons
      if (!disabled && laneTraffic && laneTraffic.length > 0) {
        for (let i = 0; i < safeCount; i++) {
          const laneInfo = laneTraffic.find((l) => l.laneNumber === i + 1);
          const leftT = i / safeCount;
          const rightT = (i + 1) / safeCount;

          const tlX = centerX - horizonHalfWidth + 2 * horizonHalfWidth * leftT;
          const trX = centerX - horizonHalfWidth + 2 * horizonHalfWidth * rightT;
          const blX = centerX - bottomHalfWidth + 2 * bottomHalfWidth * leftT;
          const brX = centerX - bottomHalfWidth + 2 * bottomHalfWidth * rightT;

          ctx.beginPath();
          ctx.moveTo(tlX, horizonY);
          ctx.lineTo(trX, horizonY);
          ctx.lineTo(brX, bottomY);
          ctx.lineTo(blX, bottomY);
          ctx.closePath();

          const trafGrad = ctx.createLinearGradient(0, horizonY, 0, bottomY);
          if (laneInfo?.congestion === "TRAFFIC_JAM") {
            trafGrad.addColorStop(0, "rgba(239, 68, 68, 0.05)");
            trafGrad.addColorStop(0.7, "rgba(239, 68, 68, 0.22)");
            trafGrad.addColorStop(1, "rgba(220, 38, 38, 0.38)");
          } else if (laneInfo?.congestion === "SLOW") {
            trafGrad.addColorStop(0, "rgba(245, 158, 11, 0.05)");
            trafGrad.addColorStop(0.7, "rgba(245, 158, 11, 0.18)");
            trafGrad.addColorStop(1, "rgba(217, 119, 6, 0.32)");
          } else if (laneInfo?.isHovOrExpress) {
            trafGrad.addColorStop(0, "rgba(168, 85, 247, 0.05)");
            trafGrad.addColorStop(0.7, "rgba(168, 85, 247, 0.16)");
            trafGrad.addColorStop(1, "rgba(147, 51, 234, 0.26)");
          } else {
            trafGrad.addColorStop(0, "rgba(16, 185, 129, 0.03)");
            trafGrad.addColorStop(0.7, "rgba(16, 185, 129, 0.10)");
            trafGrad.addColorStop(1, "rgba(16, 185, 129, 0.18)");
          }
          ctx.fillStyle = trafGrad;
          ctx.fill();
        }
      }

      // Draw highlighted current lane band
      if (!disabled && activeIdx >= 0 && activeIdx < safeCount) {
        const leftT = activeIdx / safeCount;
        const rightT = (activeIdx + 1) / safeCount;

        const tlX = centerX - horizonHalfWidth + 2 * horizonHalfWidth * leftT;
        const trX = centerX - horizonHalfWidth + 2 * horizonHalfWidth * rightT;
        const blX = centerX - bottomHalfWidth + 2 * bottomHalfWidth * leftT;
        const brX = centerX - bottomHalfWidth + 2 * bottomHalfWidth * rightT;

        ctx.beginPath();
        ctx.moveTo(tlX, horizonY);
        ctx.lineTo(trX, horizonY);
        ctx.lineTo(brX, bottomY);
        ctx.lineTo(blX, bottomY);
        ctx.closePath();

        const bandGrad = ctx.createLinearGradient(0, horizonY, 0, bottomY);
        if (exactClaim) {
          bandGrad.addColorStop(0, "rgba(52, 211, 153, 0.12)");
          bandGrad.addColorStop(0.7, "rgba(52, 211, 153, 0.32)");
          bandGrad.addColorStop(1, "rgba(16, 185, 129, 0.52)");
        } else if (confidence >= 0.7) {
          bandGrad.addColorStop(0, "rgba(56, 189, 248, 0.10)");
          bandGrad.addColorStop(0.7, "rgba(56, 189, 248, 0.28)");
          bandGrad.addColorStop(1, "rgba(14, 165, 233, 0.45)");
        } else {
          bandGrad.addColorStop(0, "rgba(251, 191, 36, 0.10)");
          bandGrad.addColorStop(0.7, "rgba(251, 191, 36, 0.25)");
          bandGrad.addColorStop(1, "rgba(245, 158, 11, 0.40)");
        }
        ctx.fillStyle = bandGrad;
        ctx.fill();

        // Vehicle Hood Indicator in current lane
        const vehCenterX = (blX + brX) / 2;
        const vehY = bottomY - 18;
        const vehW = (brX - blX) * 0.42;

        ctx.save();
        ctx.shadowColor = exactClaim ? "#10b981" : "#38bdf8";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(vehCenterX, vehY - 26);
        ctx.lineTo(vehCenterX + vehW / 2, vehY);
        ctx.lineTo(vehCenterX - vehW / 2, vehY);
        ctx.closePath();
        ctx.fillStyle = exactClaim ? "#34d399" : "#38bdf8";
        ctx.fill();
        ctx.restore();
      }

      // Draw Lane Divider Lines
      for (let i = 0; i <= safeCount; i++) {
        const t = i / safeCount;
        const topX = centerX - horizonHalfWidth + 2 * horizonHalfWidth * t;
        const botX = centerX - bottomHalfWidth + 2 * bottomHalfWidth * t;
        const isEdge = i === 0 || i === safeCount;

        ctx.beginPath();
        ctx.moveTo(topX, horizonY);
        ctx.lineTo(botX, bottomY);

        if (isEdge) {
          // Solid outer curb line
          ctx.strokeStyle = disabled ? "rgba(148, 163, 184, 0.25)" : "rgba(241, 245, 249, 0.8)";
          ctx.lineWidth = 4;
          ctx.setLineDash([]);
        } else {
          // Dashed lane divider
          ctx.strokeStyle = disabled ? "rgba(148, 163, 184, 0.2)" : "rgba(255, 255, 255, 0.7)";
          ctx.lineWidth = 2.5;
          ctx.lineDashOffset = -dashOffsetRef.current;
          ctx.setLineDash([14, 18]);
        }
        ctx.stroke();
      }

      // Draw Lane Movement Arrows, Traffic Speed Badges & Target badges
      for (let i = 0; i < safeCount; i++) {
        const laneNum = i + 1;
        const leftT = i / safeCount;
        const rightT = (i + 1) / safeCount;
        const midT = (leftT + rightT) / 2;

        // Position arrow about 45% down the perspective road
        const arrowT = 0.52;
        const arrowY = horizonY + (bottomY - horizonY) * arrowT;
        const arrowHalfWidth = horizonHalfWidth + (bottomHalfWidth - horizonHalfWidth) * arrowT;
        const arrowX = centerX - arrowHalfWidth + 2 * arrowHalfWidth * midT;

        const isTarget = targetLanes.includes(laneNum);
        const isCurrent = currentLane === laneNum;

        // Per-lane traffic status
        const laneInfo = laneTraffic?.find((l) => l.laneNumber === laneNum);
        const hasIncident = incidents.some((inc) => inc.affectedLanes.includes(laneNum));

        // Draw Lane Number label at the bottom of each lane
        const botMidX = centerX - bottomHalfWidth + 2 * bottomHalfWidth * midT;
        ctx.font = `600 ${Math.max(11, Math.floor(w * 0.02))}px 'Plus Jakarta Sans', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (isCurrent && !disabled) {
          ctx.fillStyle = exactClaim ? "#34d399" : "#38bdf8";
        } else if (isTarget && !disabled) {
          ctx.fillStyle = "#a5f3fc";
        } else {
          ctx.fillStyle = "#94a3b8";
        }
        ctx.fillText(`L${laneNum}`, botMidX, bottomY - 38);

        // Per-lane Speed Tag (Traffic-aware)
        if (laneInfo && !disabled) {
          ctx.font = `700 ${Math.max(10, Math.floor(w * 0.018))}px 'Plus Jakarta Sans', sans-serif`;
          if (laneInfo.congestion === "TRAFFIC_JAM") {
            ctx.fillStyle = "#f87171";
          } else if (laneInfo.congestion === "SLOW") {
            ctx.fillStyle = "#fbbf24";
          } else if (laneInfo.isHovOrExpress) {
            ctx.fillStyle = "#c084fc";
          } else {
            ctx.fillStyle = "#34d399";
          }
          ctx.fillText(`${laneInfo.speedMph} mph`, botMidX, bottomY - 54);
        }

        // Incident / Congestion Warning Tag above affected lanes
        if (hasIncident && !disabled) {
          ctx.save();
          const incidentY = horizonY + (bottomY - horizonY) * 0.32;
          const incidentW = horizonHalfWidth + (bottomHalfWidth - horizonHalfWidth) * 0.32;
          const incidentX = centerX - incidentW + 2 * incidentW * midT;

          ctx.font = `800 ${Math.max(9, Math.floor(w * 0.016))}px 'Plus Jakarta Sans', sans-serif`;
          ctx.fillStyle = "#ef4444";
          ctx.fillText("⚠ SLOW", incidentX, incidentY);
          ctx.restore();
        }

        // Arrow graphics
        if (!disabled) {
          ctx.save();
          ctx.translate(arrowX, arrowY);
          ctx.strokeStyle = isTarget ? "#38bdf8" : "rgba(203, 213, 225, 0.4)";
          ctx.fillStyle = isTarget ? "#38bdf8" : "rgba(203, 213, 225, 0.4)";
          ctx.lineWidth = 2.5;
          ctx.setLineDash([]);

          // Default straight arrow
          ctx.beginPath();
          ctx.moveTo(0, 10);
          ctx.lineTo(0, -10);
          ctx.lineTo(-5, -5);
          ctx.moveTo(0, -10);
          ctx.lineTo(5, -5);
          ctx.stroke();

          // If leftmost lane, add left wing
          if (laneNum === 1) {
            ctx.beginPath();
            ctx.moveTo(0, 2);
            ctx.lineTo(-7, 2);
            ctx.lineTo(-7, -4);
            ctx.lineTo(-10, -1);
            ctx.stroke();
          }
          // If rightmost lane, add right exit wing
          if (laneNum === safeCount) {
            ctx.beginPath();
            ctx.moveTo(0, 2);
            ctx.lineTo(7, 2);
            ctx.lineTo(7, -4);
            ctx.lineTo(10, -1);
            ctx.stroke();
          }

          ctx.restore();
        }
      }

      // Disabled / GPS Lost Overlay
      if (disabled) {
        ctx.fillStyle = "rgba(9, 13, 21, 0.75)";
        ctx.fillRect(0, 0, w, h);

        ctx.font = `700 ${Math.max(14, Math.floor(w * 0.032))}px 'Plus Jakarta Sans', sans-serif`;
        ctx.fillStyle = "#ef4444";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("GPS SIGNAL LOST", centerX, h * 0.46);

        ctx.font = `500 ${Math.max(11, Math.floor(w * 0.022))}px 'Plus Jakarta Sans', sans-serif`;
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(statusMessage || "Guidance paused until fresh location returns", centerX, h * 0.54);
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [laneCount, currentLane, exactClaim, confidence, targetLanes, speedMps, disabled, statusMessage, laneTraffic, incidents]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden rounded-2xl bg-[#0e1422] ${className}`}>
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};
