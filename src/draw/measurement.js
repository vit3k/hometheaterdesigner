import { state } from "../state.js";
import { metersToPixelsCoords, ctx } from "./draw.js";
import {pixelsToMetersCoords} from './draw.js';

// --- Measurement Constants ---
const SNAP_THRESHOLD_MEASURE_PX = 15; // Pixel distance to snap measurement point
const MEASUREMENT_LINE_COLOR = "rgba(255, 0, 0, 0.8)";
const MEASUREMENT_POINT_COLOR = "red";
const MEASUREMENT_POINT_RADIUS_PX = 5;
const MEASUREMENT_TEXT_COLOR = "red";
const MEASUREMENT_FONT_SIZE_PX = 14;

// --- Measurement Snap Function ---
function getSnappedMeasurementPoint(x_px, y_px) {
  // Check snap to listener
  const listenerPosPx = metersToPixelsCoords(state.listener.x, state.listener.y);
  const distToListenerPx = Math.sqrt(
    (x_px - listenerPosPx.x) ** 2 + (y_px - listenerPosPx.y) ** 2,
  );
  if (distToListenerPx < SNAP_THRESHOLD_MEASURE_PX) {
    return {
      meters: { x_met: state.listener.x, y_met: state.listener.y },
      pixels: listenerPosPx,
    }; // FIX: Return consistent structure
  }

  // Check snap to speakers
  for (const speaker of state.speakers) {
    const speakerPosPx = metersToPixelsCoords(speaker.x, speaker.y);
    const distToSpeakerPx = Math.sqrt(
      (x_px - speakerPosPx.x) ** 2 + (y_px - speakerPosPx.y) ** 2,
    );
    if (distToSpeakerPx < SNAP_THRESHOLD_MEASURE_PX) {
      return {
        meters: { x_met: speaker.x, y_met: speaker.y },
        pixels: speakerPosPx,
      }; // FIX: Return consistent structure
    }
  }

  // No snap, return original click converted to meters
  const snappedMeters = pixelsToMetersCoords(x_px, y_px);
  const snappedPixels = { x: x_px, y: y_px };
  return { meters: snappedMeters, pixels: snappedPixels };
}

// --- Draw Measurement Function ---
function drawMeasurement() {
  if (!state.isMeasuring && !state.measureEnd) return; // Don't draw if not measuring and no final measurement exists

  // Determine the end point to draw to (either fixed or current mouse pos)
  const endPointToDraw = state.measureEnd ? state.measureEnd : state.currentMeasureEnd;

  //console.log(`drawMeasurement state: isMeasuring=${isMeasuring}, start=${!!measureStart}, end=${!!measureEnd}, currentEnd=${!!currentMeasureEnd}, endPointToDraw=${!!endPointToDraw}`); // DEBUG

  // Draw start point
  const startPx = metersToPixelsCoords(state.measureStart.x_met, state.measureStart.y_met); // FIX: Use x_met, y_met
  ctx.fillStyle = MEASUREMENT_POINT_COLOR;
  ctx.beginPath();
  ctx.arc(startPx.x, startPx.y, MEASUREMENT_POINT_RADIUS_PX, 0, 2 * Math.PI);
  ctx.fill();

  // Draw end point and line if an end point exists (fixed or current)
  if (endPointToDraw) {
    const endPx = metersToPixelsCoords(
      endPointToDraw.x_met,
      endPointToDraw.y_met,
    );

    // Draw line
    ctx.beginPath();
    ctx.moveTo(startPx.x, startPx.y);
    ctx.lineTo(endPx.x, endPx.y);
    ctx.strokeStyle = MEASUREMENT_LINE_COLOR;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw end point (only draw the solid end point if it's fixed)
    if (state.measureEnd) {
      ctx.fillStyle = MEASUREMENT_POINT_COLOR;
      ctx.beginPath();
      ctx.arc(endPx.x, endPx.y, MEASUREMENT_POINT_RADIUS_PX, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Calculate and display distance
    const dx = endPointToDraw.x_met - state.measureStart.x_met; // FIX: Use x_met, y_met
    const dy = endPointToDraw.y_met - state.measureStart.y_met; // FIX: Use x_met, y_met
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Position text near the middle of the line
    const midX = (startPx.x + endPx.x) / 2;
    const midY = (startPx.y + endPx.y) / 2;
    ctx.fillStyle = MEASUREMENT_TEXT_COLOR;
    ctx.font = `${MEASUREMENT_FONT_SIZE_PX}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom"; // Position text slightly above the line midpoint
    ctx.fillText(`${distance.toFixed(2)} m`, midX, midY - 5); // Offset text slightly
  }
}
export { drawMeasurement, getSnappedMeasurementPoint };
