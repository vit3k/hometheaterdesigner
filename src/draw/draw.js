import {state, autosaveState} from "../state.js";
import { roomDepthInput, roomWidthInput, roomHeightInput, listenerXInput, listenerYInput, tvXInput, tvYInput, tvSizeInput, measureBtn } from "../elements";
import { drawAdjacentSpeakerAngles, drawAngles } from "./angles.js";
import { drawMeasurement } from './measurement.js';
import {distFrontSpan, distBackSpan} from '../elements.js';

const canvas = document.getElementById('room-canvas');
const ctx = canvas.getContext('2d');

// --- Drawing Constants ---

// --- Drawing Element Sizes (Increased Further) ---
const SPEAKER_RADIUS_PX = 8; // Increased speaker dot size
const LISTENER_RADIUS_PX = 9; // Increased listener dot size
const LISTENER_TRIANGLE_SIZE = 12; // Increased listener triangle size
const TV_LINE_WIDTH = 5; // Increased TV line width (used for rect height)



// --- Coordinate Conversion ---
// Convert room coordinates (meters) to canvas coordinates (pixels)
function metersToPixelsCoords(x_met, y_met) {
  // Maps room Y=0 (front/TV wall) to pixel Y=PADDING (top edge of drawing area)
  // Maps room Y=room.depth (back wall) to pixel Y=canvas.height-PADDING (bottom edge)
  const x_px = x_met * state.scale + state.PADDING;
  const y_px = y_met * state.scale + state.PADDING; // FIX: Front wall (Y=0) maps to top (PADDING)
  return { x: x_px, y: y_px };
}

// Convert canvas coordinates (pixels) back to room coordinates (meters)
function pixelsToMetersCoords(x_px, y_px) {
  if (state.scale === 0) return { x_met: 0, y_met: 0 }; // Avoid division by zero
  const x_met = (x_px - state.PADDING) / state.scale;
  const y_met = (y_px - state.PADDING) / state.scale; // FIX: Inverse of the above
  return { x_met, y_met }; // FIX: Use correct property names
}

function drawRoom() {
  ctx.strokeStyle = "black";
  ctx.lineWidth = 1;
  // Use the conversion function for clarity and consistency
  const topLeft = metersToPixelsCoords(0, 0);
  const topRight = metersToPixelsCoords(state.room.width, 0);
  const bottomRight = metersToPixelsCoords(state.room.width, state.room.depth);
  const bottomLeft = metersToPixelsCoords(0, state.room.depth);

  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.lineTo(topRight.x, topRight.y); // Top wall (Y=0)
  ctx.lineTo(bottomRight.x, bottomRight.y); // Right wall
  ctx.lineTo(bottomLeft.x, bottomLeft.y); // Bottom wall (Y=depth)
  ctx.lineTo(topLeft.x, topLeft.y); // Left wall
  ctx.stroke();
}

function drawTV() {
  if (
    !state.tv ||
    isNaN(state.tv.x) ||
    isNaN(state.tv.y) ||
    isNaN(state.tv.width)
  )
    return;
  const tvPos = metersToPixelsCoords(state.tv.x, state.tv.y); // tv.y is fixed at 0.1
  const tvWidthPx = state.tv.width * state.scale;
  // Use a small depth for visual representation instead of a line
  const tvDepthPx = Math.max(2, TV_LINE_WIDTH); // Ensure minimum thickness, use constant

  ctx.fillStyle = "darkred"; // Changed color for better visibility
  // Draw TV centered at tv.x, placed at tv.y (which maps near the top)
  ctx.fillRect(
    tvPos.x - tvWidthPx / 2,
    tvPos.y - tvDepthPx / 2,
    tvWidthPx,
    tvDepthPx,
  );
}

function drawListener() {
  if (!state.listener || isNaN(state.listener.x) || isNaN(state.listener.y))
    return;
  const listenerPos = metersToPixelsCoords(state.listener.x, state.listener.y);
  ctx.fillStyle = "blue";
  ctx.beginPath();
  ctx.arc(listenerPos.x, listenerPos.y, LISTENER_RADIUS_PX, 0, 2 * Math.PI); // Use constant
  ctx.fill();

  // Draw forward direction triangle (pointing towards +Y room direction / top of canvas)
  const triangleHalfBase = LISTENER_TRIANGLE_SIZE * 0.5;
  const triangleHeight = LISTENER_TRIANGLE_SIZE * 1.2; // Make it pointier
  ctx.beginPath();
  ctx.moveTo(listenerPos.x, listenerPos.y - triangleHeight * 0.6); // Point towards top
  ctx.lineTo(
    listenerPos.x - triangleHalfBase,
    listenerPos.y + triangleHeight * 0.4,
  );
  ctx.lineTo(
    listenerPos.x + triangleHalfBase,
    listenerPos.y + triangleHeight * 0.4,
  );
  ctx.closePath();
  ctx.fillStyle = "blue";
  ctx.fill();
}

function drawSpeakers() {
  state.speakers.forEach((speaker, index) => {
    const speakerPos = metersToPixelsCoords(speaker.x, speaker.y);
    const baseColor = speaker.type === "ceiling" ? "grey" : "green";

    // --- Visual Feedback for Snap (ONLY during drag) ---
    let fillColor = baseColor;
    let strokeColor = "black";
    let lineWidth = 1;

    // Apply snapped style only if THIS speaker is being dragged AND it's currently snapped
    if (
      state.isDraggingSpeaker &&
      index === state.draggedSpeakerIndex &&
      speaker.isSnapped
    ) {
      fillColor = "yellow"; // Highlight fill when snapped during drag
      strokeColor = "red"; // Highlight stroke
      lineWidth = 2; // Thicker stroke
    }

    ctx.beginPath();
    ctx.arc(speakerPos.x, speakerPos.y, SPEAKER_RADIUS_PX, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor; // Outline
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Optional: Text label (e.g., index or type) - keeping it simple for now
  });
}

function drawSnapLines() {
  // Only draw if dragging a speaker and snap details are available AND a snap occurred
  if (
    state.isDraggingSpeaker &&
    state.draggedSpeakerIndex !== -1 &&
    state.currentSnapDetails &&
    state.currentSnapDetails.snapped
  ) {
    const draggedSpeaker = state.speakers[state.draggedSpeakerIndex];
    const draggedPosPx = metersToPixelsCoords(
      draggedSpeaker.x,
      draggedSpeaker.y,
    );

    ctx.save(); // Save context state
    // --- Subtle Snap Line Style ---
    ctx.strokeStyle = "lightgray"; // Subtle color
    ctx.lineWidth = 1; // Standard thickness
    ctx.setLineDash([3, 3]); // Dashed line

    // Draw X snap line (vertical) if X was snapped
    if (state.currentSnapDetails.snappedXTo !== -1) {
      const snapTargetSpeaker = state.speakers[state.currentSnapDetails.snappedXTo];
      // Get the pixel coordinates of the target speaker
      const snapTargetSpeakerPx = metersToPixelsCoords(
        snapTargetSpeaker.x,
        snapTargetSpeaker.y,
      );

      ctx.beginPath();
      ctx.moveTo(draggedPosPx.x, draggedPosPx.y); // Start at dragged speaker center
      // Line goes vertically to the target speaker's Y level
      ctx.lineTo(draggedPosPx.x, snapTargetSpeakerPx.y);
      ctx.stroke();
    }

    // Draw Y snap line (horizontal) if Y was snapped
    if (state.currentSnapDetails.snappedYTo !== -1) {
      const snapTargetSpeaker = state.speakers[state.currentSnapDetails.snappedYTo];
      // Get the pixel coordinates of the target speaker
      const snapTargetSpeakerPx = metersToPixelsCoords(
        snapTargetSpeaker.x,
        snapTargetSpeaker.y,
      );

      ctx.beginPath();
      ctx.moveTo(draggedPosPx.x, draggedPosPx.y); // Start at dragged speaker center
      // Line goes horizontally to the target speaker's X level
      ctx.lineTo(snapTargetSpeakerPx.x, draggedPosPx.y);
      ctx.stroke();
    }

    ctx.restore(); // Restore context state (solid lines, default color)
  }
}

function redraw() {
  // Update state from inputs
  const prevRoomWidth = state.room.width;
  const prevRoomDepth = state.room.depth;

  state.room.width = parseFloat(roomWidthInput.value);
  state.room.depth = parseFloat(roomDepthInput.value);
  state.room.height = parseFloat(roomHeightInput.value);
  state.listener.x = parseFloat(listenerXInput.value);
  state.listener.y = parseFloat(listenerYInput.value);
  // state.tv.x = parseFloat(tvXInput.value); // No longer read from input
  // state.tv.y = parseFloat(tvYInput.value); // No longer read from input
  state.tv.width = parseFloat(tvSizeInput.value); // Only read TV width

  // --- TV Position Logic ---
  state.tv.x = state.listener.x; // TV X follows Listener X
  state.tv.y = 0.1; // TV Y is fixed near the front wall

  // Update disabled input values visually (optional, but good practice)
  tvXInput.value = state.tv.x.toFixed(1);
  tvYInput.value = state.tv.y.toFixed(1);

  // --- Rescale Speakers if room dimensions changed ---
  if (state.room.width !== prevRoomWidth || state.room.depth !== prevRoomDepth) {
    state.speakers.forEach((speaker) => {
      speaker.x = (speaker.x / prevRoomWidth) * state.room.width;
      speaker.y = (speaker.y / prevRoomDepth) * state.room.depth;
    });
  }

  calculateScaleAndResizeCanvas();

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Redraw elements
  drawRoom();
  drawTV();
  drawListener();
  drawSpeakers(); // Draw existing speakers
  drawSnapLines(); // Draw snap lines after speakers
  drawAngles(); // Draw angles after speakers
  drawAdjacentSpeakerAngles(); // Draw adjacent speaker angles
  drawMeasurement(); // Draw measurement line and text
  updateListenerPositionInfo(); // Call the new function here
  autosaveState(); // Autosave after every redraw
}

// --- Functions ---
function calculateScaleAndResizeCanvas() {
  const canvasContainer = document.querySelector(".canvas-container");
  // Get available dimensions of the container
  const containerWidth = canvasContainer.clientWidth;
  const containerHeight = canvasContainer.clientHeight; // Need container height too

  // Calculate available drawing area dimensions
  const drawingWidth = containerWidth - 2 * state.PADDING;
  const drawingHeight = containerHeight - 2 * state.PADDING; // Available height for drawing

  // Prevent errors if dimensions are too small or room size is zero
  if (
      drawingWidth <= 0 ||
      drawingHeight <= 0 ||
      state.room.width <= 0 ||
      state.room.depth <= 0
  ) {
      state.scale = 1; // Default scale
      canvas.width = Math.max(1, containerWidth); // Ensure minimum size
      canvas.height = Math.max(1, containerHeight);
      console.warn(
          "Cannot calculate scale properly due to zero/negative dimensions.",
      );
      return;
  }

  // Determine scale based on fitting BOTH width and depth
  const scaleX = drawingWidth / state.room.width;
  const scaleY = drawingHeight / state.room.depth;

  // Use the smaller scale factor to ensure the entire room fits
  state.scale = Math.min(scaleX, scaleY);

  // Calculate the *actual* canvas dimensions needed based on the chosen scale
  const requiredCanvasWidth = state.room.width * state.scale + 2 * state.PADDING;
  const requiredCanvasHeight = state.room.depth * state.scale + 2 * state.PADDING;

  // Set canvas dimensions - use the required size, not necessarily the full container size
  // This ensures the canvas itself has the correct aspect ratio for the room + padding
  canvas.width = requiredCanvasWidth;
  canvas.height = requiredCanvasHeight;

  // Optional: Center the canvas within the container if it doesn't fill it completely
  // (Handled by flexbox in canvas-container styles in style.css)

  // console.log(`Container: ${containerWidth}x${containerHeight}, Drawing: ${drawingWidth}x${drawingHeight}`);
  // console.log(`Room: ${room.width}x${room.depth}, ScaleX: ${scaleX}, ScaleY: ${scaleY}, Final Scale: ${scale}`);
  // console.log(`Canvas Size: ${canvas.width}x${canvas.height}`);
}

function updateListenerPositionInfo() {
  if (!distFrontSpan || !distBackSpan) {
      console.warn("Listener info spans not found.");
      return; // Ensure elements exist
  }
  const distFront = state.listener.y;
  const distBack = state.room.depth - state.listener.y;

  // Prevent negative distances if listener is outside room (shouldn't happen with clamping)
  const displayDistFront = Math.max(0, distFront);
  const displayDistBack = Math.max(0, distBack);

  distFrontSpan.textContent = displayDistFront.toFixed(2);
  distBackSpan.textContent = displayDistBack.toFixed(2);
}


export {
  canvas,
  ctx,
  redraw,
  calculateScaleAndResizeCanvas,
  metersToPixelsCoords,
  pixelsToMetersCoords,
  updateListenerPositionInfo,
  LISTENER_RADIUS_PX,
  SPEAKER_RADIUS_PX
}