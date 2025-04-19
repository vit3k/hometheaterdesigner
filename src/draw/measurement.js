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
  // Reset snap info
  state.measureSnapAxes = []; // Array of {type: 'vertical'|'horizontal', px: number, meters: number, source: obj}

  // Check snap to listener (point)
  const listenerPosPx = metersToPixelsCoords(state.listener.x, state.listener.y);
  const distToListenerPx = Math.sqrt(
    (x_px - listenerPosPx.x) ** 2 + (y_px - listenerPosPx.y) ** 2,
  );
  if (distToListenerPx < SNAP_THRESHOLD_MEASURE_PX) {
    state.measureSnapAxes = [];
    return {
      meters: { x_met: state.listener.x, y_met: state.listener.y },
      pixels: listenerPosPx,
    };
  }

  // Check snap to speakers (point)
  for (const speaker of state.speakers) {
    const speakerPosPx = metersToPixelsCoords(speaker.x, speaker.y);
    const distToSpeakerPx = Math.sqrt(
      (x_px - speakerPosPx.x) ** 2 + (y_px - speakerPosPx.y) ** 2,
    );
    if (distToSpeakerPx < SNAP_THRESHOLD_MEASURE_PX) {
      state.measureSnapAxes = [];
      return {
        meters: { x_met: speaker.x, y_met: speaker.y },
        pixels: speakerPosPx,
      };
    }
  }

  // --- Snap to axes of listener and speakers ---
  // Gather all axis candidates (listener + speakers)
  const axisCandidates = [
    { x: state.listener.x, y: state.listener.y },
    ...state.speakers
  ];
  let bestSnap = null;
  let minDist = SNAP_THRESHOLD_MEASURE_PX;
  let snapAxes = [];
  let snapX = null, snapY = null;
  // Try snapping to vertical or horizontal axes
  for (const obj of axisCandidates) {
    const axisPx = metersToPixelsCoords(obj.x, obj.y);
    // Snap X axis (vertical line)
    const distToAxisX = Math.abs(x_px - axisPx.x);
    if (distToAxisX < SNAP_THRESHOLD_MEASURE_PX) {
      snapAxes.push({ type: 'vertical', px: axisPx.x, meters: obj.x, source: obj });
      snapX = { axisPx, obj };
    }
    // Snap Y axis (horizontal line)
    const distToAxisY = Math.abs(y_px - axisPx.y);
    if (distToAxisY < SNAP_THRESHOLD_MEASURE_PX) {
      snapAxes.push({ type: 'horizontal', px: axisPx.y, meters: obj.y, source: obj });
      snapY = { axisPx, obj };
    }
  }
  if (snapX && snapY) {
    // Snap to intersection if both
    const { x_met, y_met } = pixelsToMetersCoords(snapX.axisPx.x, snapY.axisPx.y);
    state.measureSnapAxes = snapAxes;
    return {
      meters: { x_met, y_met },
      pixels: { x: snapX.axisPx.x, y: snapY.axisPx.y }
    };
  } else if (snapX) {
    const { x_met, y_met } = pixelsToMetersCoords(snapX.axisPx.x, y_px);
    state.measureSnapAxes = snapAxes;
    return {
      meters: { x_met, y_met },
      pixels: { x: snapX.axisPx.x, y: y_px }
    };
  } else if (snapY) {
    const { x_met, y_met } = pixelsToMetersCoords(x_px, snapY.axisPx.y);
    state.measureSnapAxes = snapAxes;
    return {
      meters: { x_met, y_met },
      pixels: { x: x_px, y: snapY.axisPx.y }
    };
  }
  // No snap
  state.measureSnapAxes = [];
  const snappedMeters = pixelsToMetersCoords(x_px, y_px);
  const snappedPixels = { x: x_px, y: y_px };
  return { meters: snappedMeters, pixels: snappedPixels };
}

// --- Draw Measurement Function ---
function drawMeasurement() {
    // --- Draw Completed Measurement --- (if it exists)
    if (!state.isMeasuring && state.measureStart && state.measureEnd) {
        const startPx = metersToPixelsCoords(state.measureStart.x_met, state.measureStart.y_met);
        const endPx = metersToPixelsCoords(state.measureEnd.x_met, state.measureEnd.y_met);

        // Draw line
        ctx.beginPath();
        ctx.moveTo(startPx.x, startPx.y);
        ctx.lineTo(endPx.x, endPx.y);
        ctx.strokeStyle = MEASUREMENT_LINE_COLOR;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw fixed start point
        ctx.fillStyle = MEASUREMENT_POINT_COLOR;
        ctx.beginPath();
        ctx.arc(startPx.x, startPx.y, MEASUREMENT_POINT_RADIUS_PX, 0, 2 * Math.PI);
        ctx.fill();

        // Draw fixed end point
        ctx.fillStyle = MEASUREMENT_POINT_COLOR;
        ctx.beginPath();
        ctx.arc(endPx.x, endPx.y, MEASUREMENT_POINT_RADIUS_PX, 0, 2 * Math.PI);
        ctx.fill();

        // Calculate and display distance
        const dx = state.measureEnd.x_met - state.measureStart.x_met;
        const dy = state.measureEnd.y_met - state.measureStart.y_met;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const midX = (startPx.x + endPx.x) / 2;
        const midY = (startPx.y + endPx.y) / 2;
        ctx.fillStyle = MEASUREMENT_TEXT_COLOR;
        ctx.font = `${MEASUREMENT_FONT_SIZE_PX}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`${distance.toFixed(2)} m`, midX, midY - 5);
    }

    // --- Draw Active Measurement OR Preview for Next Measurement Start ---
    let currentEndPoint = null; // Point mouse is hovering over (snapped)
    if (state.currentMeasureEnd && state.currentMeasureEnd.x_met != null && state.currentMeasureEnd.y_met != null) {
         currentEndPoint = state.currentMeasureEnd;
    }

    if (state.isMeasuring && state.measureStart) { // Actively measuring
        const startPx = metersToPixelsCoords(state.measureStart.x_met, state.measureStart.y_met);

        // Draw fixed start point (only draw if actively measuring)
        ctx.fillStyle = MEASUREMENT_POINT_COLOR;
        ctx.beginPath();
        ctx.arc(startPx.x, startPx.y, MEASUREMENT_POINT_RADIUS_PX, 0, 2 * Math.PI);
        ctx.fill();

        if (currentEndPoint) {
            const previewEndPx = metersToPixelsCoords(currentEndPoint.x_met, currentEndPoint.y_met);

            // Draw line to current mouse position
            ctx.beginPath();
            ctx.moveTo(startPx.x, startPx.y);
            ctx.lineTo(previewEndPx.x, previewEndPx.y);
            ctx.strokeStyle = MEASUREMENT_LINE_COLOR;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw preview end point
            ctx.fillStyle = 'rgba(255,0,0,0.4)';
            ctx.beginPath();
            ctx.arc(previewEndPx.x, previewEndPx.y, MEASUREMENT_POINT_RADIUS_PX, 0, 2 * Math.PI);
            ctx.fill();

             // Calculate and display distance during measurement
            const dx = currentEndPoint.x_met - state.measureStart.x_met;
            const dy = currentEndPoint.y_met - state.measureStart.y_met;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const midX = (startPx.x + previewEndPx.x) / 2;
            const midY = (startPx.y + previewEndPx.y) / 2;
            ctx.fillStyle = MEASUREMENT_TEXT_COLOR;
            ctx.font = `${MEASUREMENT_FONT_SIZE_PX}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText(`${distance.toFixed(2)} m`, midX, midY - 5);
        }
    } else if (!state.isMeasuring && currentEndPoint) { // Previewing next measurement start
        // Draw preview circle at current mouse position
        const previewStartPx = metersToPixelsCoords(currentEndPoint.x_met, currentEndPoint.y_met);
        ctx.fillStyle = 'rgba(255,0,0,0.4)';
        ctx.beginPath();
        ctx.arc(previewStartPx.x, previewStartPx.y, MEASUREMENT_POINT_RADIUS_PX, 0, 2 * Math.PI);
        ctx.fill();
    }

    // --- Draw Snapping Lines --- (Always draw if axes data exists and tool is active)
    // Assuming mousemove handler only sets measureSnapAxes when tool is active
    if (state.measureSnapAxes && state.measureSnapAxes.length > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,0,0,0.5)'; // Red, semi-transparent
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      for (const axis of state.measureSnapAxes) {
        if (axis.type === 'vertical') {
          ctx.beginPath();
          ctx.moveTo(axis.px, 0);
          ctx.lineTo(axis.px, ctx.canvas.height);
          ctx.stroke();
        } else if (axis.type === 'horizontal') {
          ctx.beginPath();
          ctx.moveTo(0, axis.px);
          ctx.lineTo(ctx.canvas.width, axis.px);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
      ctx.restore();
    }
}
export { drawMeasurement, getSnappedMeasurementPoint };
