import { state, LISTENER_EAR_HEIGHT } from "../state.js";
import { ctx, metersToPixelsCoords } from "./draw.js";
import { radiansToDegrees, angleDifference } from "../math.js";

const ADJACENT_ANGLE_ARC_RADIUS_PX_BED = 100; // Arc radius for bed speakers (Increased)
const ADJACENT_ANGLE_ARC_RADIUS_PX_CEILING = 60; // Arc radius for ceiling speakers (Increased)
const ADJACENT_ANGLE_TEXT_OFFSET_PX = 10; // Extra offset for text from arc
const ADJACENT_ANGLE_COLOR_BED = "rgba(0, 128, 0, 0.18)"; // More visible green for angle arcs/labels
const ADJACENT_ANGLE_COLOR_CEILING = "rgba(128, 128, 128, 0.35)"; // More visible gray for angle arcs/labels
const ANGLE_TEXT_COLOR_BED = "rgba(0, 128, 0, 0.7)"; // Stronger green for azimuth text
const ANGLE_TEXT_COLOR_CEILING = "rgba(128, 128, 128, 0.7)"; // Stronger gray for azimuth text
const ADJACENT_ANGLE_FONT_SIZE_PX = 12;
const ADJACENT_ANGLE_ARC_WIDTH = 1.5;
const ANGLE_FONT_SIZE = 14; // Increased font size for angles
const ANGLE_FONT_SIZE_PX = 14; // Increased font size for angles
const ANGLE_LINE_WIDTH = 2; // Thicker angle lines

function drawAngles() {
  const listenerPos = metersToPixelsCoords(state.listener.x, state.listener.y);
  const listenerZ = LISTENER_EAR_HEIGHT; // Use constant for listener height

  // Clear previous angles data if needed (or handle updates appropriately)
  // const speakerAngles = []; // This might not be needed anymore if not drawing adjacent

  // --- Draw Line and Angle from Listener to Each Speaker ---
  state.speakers.forEach((speaker) => {
    const speakerPos = metersToPixelsCoords(speaker.x, speaker.y);
    const speakerZ = speaker.z; // Use speaker's actual height

    // Calculate vector from listener to speaker in meters
    const dx_met = speaker.x - state.listener.x;
    const dy_met = speaker.y - state.listener.y; // Y increases towards the back wall
    const dz_met = speakerZ - listenerZ;

    // Calculate horizontal distance in meters
    const d_horiz_met = Math.sqrt(dx_met * dx_met + dy_met * dy_met);

    // Calculate Azimuth Angle (relative to straight ahead - negative Y direction)
    // atan2(x, y) measures angle from positive Y axis.
    // We want angle from negative Y axis (listener looking towards TV wall).
    // So we use atan2(deltaX, -deltaY).
    const azimuthRad = Math.atan2(dx_met, -dy_met); // Corrected azimuth calculation
    let azimuthDeg = radiansToDegrees(azimuthRad);

    // --- Elevation Calculation (Angle from Forward Horizontal Line in Side Plane) ---
    // Use atan2(vertical_diff, -forward_backward_diff)
    let elevationRad = Math.atan2(dz_met, -dy_met); // Note the -dy_met
    let elevationDeg = radiansToDegrees(elevationRad);

    // Handle edge case: If speaker is directly overhead OR below (dy_met is 0)
    if (Math.abs(dy_met) < 0.001) {
      if (dz_met > 0.001)
        elevationDeg = 90.0; // Directly overhead
      else if (dz_met < -0.001)
        elevationDeg = -90.0; // Directly below (unlikely)
      else elevationDeg = 0.0; // Exactly at listener level AND Y-position
      elevationRad = degreesToRadians(elevationDeg);
    }
    // Note: Bed speakers (dz_met = 0) will naturally result in elevationDeg = 0 here.

    // --- Draw Line from Listener to Speaker (Restored, Dimmer) ---
    ctx.beginPath();
    ctx.moveTo(listenerPos.x, listenerPos.y);
    ctx.lineTo(speakerPos.x, speakerPos.y);
    ctx.strokeStyle =
      speaker.type === "ceiling"
        ? ADJACENT_ANGLE_COLOR_CEILING
        : ADJACENT_ANGLE_COLOR_BED;
    ctx.lineWidth = 1;
    ctx.stroke();

    // --- Calculate Fixed Text Offset (Conditional Y) ---
    const fixedOffsetX = -15; // Pixels to the left (remains the same)
    // Use a larger negative offset for ceiling speakers to move text higher
    const fixedOffsetY = speaker.type === "ceiling" ? -25 : -15;

    const textX = speakerPos.x + fixedOffsetX;
    const textY = speakerPos.y + fixedOffsetY;

    // --- Draw Angle Text ---
    ctx.fillStyle =
      speaker.type === "ceiling"
        ? ANGLE_TEXT_COLOR_CEILING
        : ANGLE_TEXT_COLOR_BED;
    ctx.font = `${ANGLE_FONT_SIZE}px Arial`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";

    // Format angle text with labels
    const angleTextAz = `Az: ${azimuthDeg.toFixed(1)}°`;

    // Display angle text
    ctx.fillText(angleTextAz, textX, textY);

    if (speaker.type !== "bed") {
      const elevationText = `El: (${Math.round(elevationDeg)}°)`;
      ctx.font = `${ANGLE_FONT_SIZE_PX * 0.8}px Arial`;
      const elevationTextY = textY + ANGLE_FONT_SIZE_PX * 0.9 + 2;
      ctx.fillStyle = ANGLE_TEXT_COLOR_CEILING;
      ctx.fillText(elevationText, textX, elevationTextY);
    }

    // Optional: Store angles if needed for other purposes
    // speakerAngles.push({ id: speaker.id, azimuthRad, azimuthDeg, elevationRad, elevationDeg });
  });
}

function drawAdjacentSpeakerAngles() {
  const listenerPos = metersToPixelsCoords(state.listener.x, state.listener.y);

  const calculateAzimuth = (spk) => {
    const dx_met = spk.x - state.listener.x;
    const dy_met = spk.y - state.listener.y;
    return radiansToDegrees(Math.atan2(dx_met, -dy_met)); // Clockwise from North
  }; 

  const speakersWithAzimuth = state.speakers.map((spk) => ({
    ...spk,
    azimuth: calculateAzimuth(spk),
    dist: Math.sqrt((spk.x - state.listener.x) ** 2 + (spk.y - state.listener.y) ** 2),
  }));

  const bedSpeakers = speakersWithAzimuth
    .filter((spk) => spk.type === "bed")
    .sort((a, b) => a.azimuth - b.azimuth);
  const ceilingSpeakers = speakersWithAzimuth
    .filter((spk) => spk.type === "ceiling")
    .sort((a, b) => a.azimuth - b.azimuth);

  const drawAnglesForList = (list, type) => {
    if (list.length < 2) return;

    const arcRadiusPx =
      type === "ceiling"
        ? ADJACENT_ANGLE_ARC_RADIUS_PX_CEILING
        : ADJACENT_ANGLE_ARC_RADIUS_PX_BED;
    const textRadiusPx = arcRadiusPx + ADJACENT_ANGLE_TEXT_OFFSET_PX; // Text goes slightly outside arc
    const color =
      type === "ceiling"
        ? ADJACENT_ANGLE_COLOR_CEILING
        : ADJACENT_ANGLE_COLOR_BED; // Select faint color for arc/text

    for (let i = 0; i < list.length; i++) {
      const currentSpeaker = list[i];
      const nextSpeaker = list[(i + 1) % list.length]; // Use modulo to wrap around

      const angleBetween = angleDifference(
        currentSpeaker.azimuth,
        nextSpeaker.azimuth,
      );

      // Convert *our* azimuth (clockwise from North) to canvas angle (anti-clockwise from East)
      // atan2(y, x) gives angle relative to positive x-axis (East), counter-clockwise
      // We need y = speakerY_px - listenerY_px, x = speakerX_px - listenerX_px
      const pos1 = metersToPixelsCoords(currentSpeaker.x, currentSpeaker.y);
      const pos2 = metersToPixelsCoords(nextSpeaker.x, nextSpeaker.y);
      let angle1 = Math.atan2(pos1.y - listenerPos.y, pos1.x - listenerPos.x);
      let angle2 = Math.atan2(pos2.y - listenerPos.y, pos2.x - listenerPos.x);

      // Ensure angle2 is always numerically greater than angle1 for CCW arc drawing
      while (angle2 <= angle1) {
        angle2 += 2 * Math.PI;
      }

      // --- Draw the Arc (always counter-clockwise from angle1 to angle2) ---
      ctx.beginPath();
      ctx.arc(listenerPos.x, listenerPos.y, arcRadiusPx, angle1, angle2); // Default CCW
      ctx.strokeStyle = color; // Use selected color
      ctx.lineWidth = ADJACENT_ANGLE_ARC_WIDTH;
      ctx.stroke();

      // --- Calculate Midpoint Angle for Text (simple average) ---
      const midCanvasAngleRad = (angle1 + angle2) / 2;

      // --- Calculate Text Position --- //
      const textX = listenerPos.x + textRadiusPx * Math.cos(midCanvasAngleRad);
      const textY = listenerPos.y + textRadiusPx * Math.sin(midCanvasAngleRad);

      // --- Draw Text ---
      ctx.fillStyle = color; // Use same faint color as arc
      ctx.font = `${ADJACENT_ANGLE_FONT_SIZE_PX}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Position text along the midpoint angle
      ctx.fillText(`${angleBetween.toFixed(1)}°`, textX, textY);
    }
  };

  console.log("Bed speakers count:", bedSpeakers.length, bedSpeakers);
  if (bedSpeakers.length < 2) {
    console.warn("Not enough bed speakers to draw arcs!");
  }
  drawAnglesForList(bedSpeakers, "bed");
  drawAnglesForList(ceilingSpeakers, "ceiling");
}

export { drawAngles, drawAdjacentSpeakerAngles };
