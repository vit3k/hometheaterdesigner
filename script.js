const canvas = document.getElementById('room-canvas');
const ctx = canvas.getContext('2d');

// --- DOM Elements ---
const roomWidthInput = document.getElementById('room-width');
const roomDepthInput = document.getElementById('room-depth');
const roomHeightInput = document.getElementById('room-height');
const listenerXInput = document.getElementById('listener-x');
const listenerYInput = document.getElementById('listener-y');
const tvXInput = document.getElementById('tv-x');
const tvYInput = document.getElementById('tv-y');
const tvSizeInput = document.getElementById('tv-size');
const addSpeakerBtn = document.getElementById('add-speaker-btn');
const addCeilingSpeakerBtn = document.getElementById('add-ceiling-speaker-btn');
const clearSpeakersBtn = document.getElementById('clear-speakers-btn');
const speakerListUl = document.getElementById('speaker-list');
const saveDesignBtn = document.getElementById('save-design-btn');
const loadDesignBtn = document.getElementById('load-design-btn');
const loadFileInput = document.getElementById('load-file-input');
const measureBtn = document.getElementById('measure-btn');
const distFrontSpan = document.getElementById('dist-front');
const distBackSpan = document.getElementById('dist-back');

// --- Group Tool Buttons ---
const buttons = document.querySelectorAll('.tool-button'); // Query for all tool buttons

// --- State ---
let room = {
    width: parseFloat(roomWidthInput.value),
    depth: parseFloat(roomDepthInput.value),
    height: parseFloat(roomHeightInput.value)
};
let listener = {
    x: 1.5, // Default position (meters)
    y: 0.7  // Default position (meters)
};
let tv = {
    x: 1.5, // Default TV position
    y: 0,   // Default TV position
    width: 1.6, // Default TV width
    height: 0.9 // Default TV height
};
let speakers = []; // Array to hold speaker objects {x, y, type: 'bed'/'ceiling'}
let isDraggingListener = false;
let isDraggingSpeaker = false; // Declare globally
let draggedSpeakerIndex = -1;  // Declare globally
let offsetX, offsetY; // For dragging listener
let isPlacingSpeaker = false;
let speakerTypeToPlace = null; // 'bed' or 'ceiling'
let isMeasuring = false;
let measureStart = null; // { x_met, y_met } in meters
let measureEnd = null; // { x_met, y_met } in meters
let currentMeasureEnd = null; // { x_met, y_met } temporary endpoint during mouse move
let isDragging = false; // General dragging flag (could be listener or future elements)
let dragOffsetX = 0;
let dragOffsetY = 0;
let scale = 1;
let PADDING = 50; // Initial padding
let currentSnapDetails = null; // Stores {x, y, snapped, snappedXTo, snappedYTo} during drag

// --- Drawing Constants ---
const LISTENER_EAR_HEIGHT = 1.2; // Assumed listener ear height in meters
const AUTOSAVE_KEY = 'homeTheaterDesignAutosave';

// --- Drawing Element Sizes (Increased Further) ---
const SPEAKER_RADIUS_PX = 8;        // Increased speaker dot size
const LISTENER_RADIUS_PX = 9;       // Increased listener dot size
const LISTENER_TRIANGLE_SIZE = 12;   // Increased listener triangle size
const TV_LINE_WIDTH = 5;            // Increased TV line width (used for rect height)
const ANGLE_FONT_SIZE = 14;         // Increased font size for angles
const ANGLE_FONT_SIZE_PX = 14;      // Increased font size for angles
const ANGLE_LINE_WIDTH = 2;         // Thicker angle lines
const SNAP_THRESHOLD_POS_METERS = 0.05; // Meters within which to snap coordinates (REDUCED)

const ADJACENT_ANGLE_ARC_RADIUS_PX_BED = 100;    // Arc radius for bed speakers (Increased)
const ADJACENT_ANGLE_ARC_RADIUS_PX_CEILING = 60; // Arc radius for ceiling speakers (Increased)
const ADJACENT_ANGLE_TEXT_OFFSET_PX = 10;       // Extra offset for text from arc
const ADJACENT_ANGLE_COLOR_BED = 'rgba(0, 128, 0, 0.18)'; // More visible green for angle arcs/labels
const ADJACENT_ANGLE_COLOR_CEILING = 'rgba(128, 128, 128, 0.35)'; // More visible gray for angle arcs/labels
const ANGLE_TEXT_COLOR_BED = 'rgba(0, 128, 0, 0.7)'; // Stronger green for azimuth text
const ANGLE_TEXT_COLOR_CEILING = 'rgba(128, 128, 128, 0.7)'; // Stronger gray for azimuth text
const ADJACENT_ANGLE_FONT_SIZE_PX = 12;
const ADJACENT_ANGLE_ARC_WIDTH = 1.5;

// --- Measurement Constants ---
const SNAP_THRESHOLD_MEASURE_PX = 15; // Pixel distance to snap measurement point
const MEASUREMENT_LINE_COLOR = 'rgba(255, 0, 0, 0.8)';
const MEASUREMENT_POINT_COLOR = 'red';
const MEASUREMENT_POINT_RADIUS_PX = 5;
const MEASUREMENT_TEXT_COLOR = 'red';
const MEASUREMENT_FONT_SIZE_PX = 14;

// --- Coordinate Conversion ---
// Convert room coordinates (meters) to canvas coordinates (pixels)
function metersToPixelsCoords(x_met, y_met) {
    // Maps room Y=0 (front/TV wall) to pixel Y=PADDING (top edge of drawing area)
    // Maps room Y=room.depth (back wall) to pixel Y=canvas.height-PADDING (bottom edge)
    const x_px = x_met * scale + PADDING;
    const y_px = y_met * scale + PADDING; // FIX: Front wall (Y=0) maps to top (PADDING)
    return { x: x_px, y: y_px };
}

// Convert canvas coordinates (pixels) back to room coordinates (meters)
function pixelsToMetersCoords(x_px, y_px) {
    if (scale === 0) return { x_met: 0, y_met: 0 }; // Avoid division by zero
    const x_met = (x_px - PADDING) / scale;
    const y_met = (y_px - PADDING) / scale; // FIX: Inverse of the above
    return { x_met, y_met }; // FIX: Use correct property names
}

// --- Helper Functions ---
function radiansToDegrees(radians) {
    return radians * (180 / Math.PI);
}

function degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
}

function angleDifference(angle1Deg, angle2Deg) {
    let diff = angle1Deg - angle2Deg;
    while (diff <= -180) diff += 360;
    while (diff > 180) diff -= 360;
    return Math.abs(diff);
}

// --- Measurement Snap Function ---
function getSnappedMeasurementPoint(x_px, y_px) {
    // Check snap to listener
    const listenerPosPx = metersToPixelsCoords(listener.x, listener.y);
    const distToListenerPx = Math.sqrt((x_px - listenerPosPx.x)**2 + (y_px - listenerPosPx.y)**2);
    if (distToListenerPx < SNAP_THRESHOLD_MEASURE_PX) {
        return { meters: { x_met: listener.x, y_met: listener.y }, pixels: listenerPosPx }; // FIX: Return consistent structure
    }

    // Check snap to speakers
    for (const speaker of speakers) {
        const speakerPosPx = metersToPixelsCoords(speaker.x, speaker.y);
        const distToSpeakerPx = Math.sqrt((x_px - speakerPosPx.x)**2 + (y_px - speakerPosPx.y)**2);
        if (distToSpeakerPx < SNAP_THRESHOLD_MEASURE_PX) {
            return { meters: { x_met: speaker.x, y_met: speaker.y }, pixels: speakerPosPx }; // FIX: Return consistent structure
        }
    }

    // No snap, return original click converted to meters
    const snappedMeters = pixelsToMetersCoords(x_px, y_px);
    const snappedPixels = { x: x_px, y: y_px };
    return { meters: snappedMeters, pixels: snappedPixels };
}

// --- Functions ---
function calculateScaleAndResizeCanvas() {
    const canvasContainer = document.querySelector('.canvas-container');
    // Get available dimensions of the container
    const containerWidth = canvasContainer.clientWidth;
    const containerHeight = canvasContainer.clientHeight; // Need container height too

    // Calculate available drawing area dimensions
    const drawingWidth = containerWidth - 2 * PADDING;
    const drawingHeight = containerHeight - 2 * PADDING; // Available height for drawing

    // Prevent errors if dimensions are too small or room size is zero
    if (drawingWidth <= 0 || drawingHeight <= 0 || room.width <= 0 || room.depth <= 0) {
        scale = 1; // Default scale
        canvas.width = Math.max(1, containerWidth); // Ensure minimum size
        canvas.height = Math.max(1, containerHeight);
        console.warn("Cannot calculate scale properly due to zero/negative dimensions.");
        return;
    }

    // Determine scale based on fitting BOTH width and depth
    const scaleX = drawingWidth / room.width;
    const scaleY = drawingHeight / room.depth;

    // Use the smaller scale factor to ensure the entire room fits
    scale = Math.min(scaleX, scaleY);

    // Calculate the *actual* canvas dimensions needed based on the chosen scale
    const requiredCanvasWidth = room.width * scale + 2 * PADDING;
    const requiredCanvasHeight = room.depth * scale + 2 * PADDING;

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

function metersToPixels(meters) {
    return meters * scale;
}

function drawRoom() {
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    // Use the conversion function for clarity and consistency
    const topLeft = metersToPixelsCoords(0, 0);
    const topRight = metersToPixelsCoords(room.width, 0);
    const bottomRight = metersToPixelsCoords(room.width, room.depth);
    const bottomLeft = metersToPixelsCoords(0, room.depth);

    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);       // Top wall (Y=0)
    ctx.lineTo(bottomRight.x, bottomRight.y); // Right wall
    ctx.lineTo(bottomLeft.x, bottomLeft.y);   // Bottom wall (Y=depth)
    ctx.lineTo(topLeft.x, topLeft.y);         // Left wall
    ctx.stroke();
}

function drawTV() {
    if (!tv || isNaN(tv.x) || isNaN(tv.y) || isNaN(tv.width)) return;
    const tvPos = metersToPixelsCoords(tv.x, tv.y); // tv.y is fixed at 0.1
    const tvWidthPx = tv.width * scale;
    // Use a small depth for visual representation instead of a line
    const tvDepthPx = Math.max(2, TV_LINE_WIDTH); // Ensure minimum thickness, use constant

    ctx.fillStyle = 'darkred'; // Changed color for better visibility
    // Draw TV centered at tv.x, placed at tv.y (which maps near the top)
    ctx.fillRect(tvPos.x - tvWidthPx / 2, tvPos.y - tvDepthPx / 2, tvWidthPx, tvDepthPx);
}

function drawListener() {
    if (!listener || isNaN(listener.x) || isNaN(listener.y)) return;
    const listenerPos = metersToPixelsCoords(listener.x, listener.y);
    ctx.fillStyle = 'blue';
    ctx.beginPath();
    ctx.arc(listenerPos.x, listenerPos.y, LISTENER_RADIUS_PX, 0, 2 * Math.PI); // Use constant
    ctx.fill();

    // Draw forward direction triangle (pointing towards +Y room direction / top of canvas)
    const triangleHalfBase = LISTENER_TRIANGLE_SIZE * 0.5;
    const triangleHeight = LISTENER_TRIANGLE_SIZE * 1.2; // Make it pointier
    ctx.beginPath();
    ctx.moveTo(listenerPos.x, listenerPos.y - triangleHeight * 0.6); // Point towards top
    ctx.lineTo(listenerPos.x - triangleHalfBase, listenerPos.y + triangleHeight * 0.4);
    ctx.lineTo(listenerPos.x + triangleHalfBase, listenerPos.y + triangleHeight * 0.4);
    ctx.closePath();
    ctx.fillStyle = 'blue';
    ctx.fill();
}

function drawSpeakers() {
    speakers.forEach((speaker, index) => {
        const speakerPos = metersToPixelsCoords(speaker.x, speaker.y);
        const baseColor = speaker.type === 'ceiling' ? 'grey' : 'green';

        // --- Visual Feedback for Snap (ONLY during drag) ---
        let fillColor = baseColor;
        let strokeColor = 'black';
        let lineWidth = 1;

        // Apply snapped style only if THIS speaker is being dragged AND it's currently snapped
        if (isDraggingSpeaker && index === draggedSpeakerIndex && speaker.isSnapped) {
            fillColor = 'yellow'; // Highlight fill when snapped during drag
            strokeColor = 'red';   // Highlight stroke
            lineWidth = 2;         // Thicker stroke
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
    if (isDraggingSpeaker && draggedSpeakerIndex !== -1 && currentSnapDetails && currentSnapDetails.snapped) {
        const draggedSpeaker = speakers[draggedSpeakerIndex];
        const draggedPosPx = metersToPixelsCoords(draggedSpeaker.x, draggedSpeaker.y);

        ctx.save(); // Save context state
        // --- Subtle Snap Line Style ---
        ctx.strokeStyle = 'lightgray'; // Subtle color
        ctx.lineWidth = 1;           // Standard thickness
        ctx.setLineDash([3, 3]);     // Dashed line

        // Draw X snap line (vertical) if X was snapped
        if (currentSnapDetails.snappedXTo !== -1) {
            const snapTargetSpeaker = speakers[currentSnapDetails.snappedXTo];
            // Get the pixel coordinates of the target speaker
            const snapTargetSpeakerPx = metersToPixelsCoords(snapTargetSpeaker.x, snapTargetSpeaker.y);

            ctx.beginPath();
            ctx.moveTo(draggedPosPx.x, draggedPosPx.y); // Start at dragged speaker center
            // Line goes vertically to the target speaker's Y level
            ctx.lineTo(draggedPosPx.x, snapTargetSpeakerPx.y);
            ctx.stroke();
        }

        // Draw Y snap line (horizontal) if Y was snapped
        if (currentSnapDetails.snappedYTo !== -1) {
            const snapTargetSpeaker = speakers[currentSnapDetails.snappedYTo];
            // Get the pixel coordinates of the target speaker
            const snapTargetSpeakerPx = metersToPixelsCoords(snapTargetSpeaker.x, snapTargetSpeaker.y);

            ctx.beginPath();
            ctx.moveTo(draggedPosPx.x, draggedPosPx.y); // Start at dragged speaker center
            // Line goes horizontally to the target speaker's X level
            ctx.lineTo(snapTargetSpeakerPx.x, draggedPosPx.y);
            ctx.stroke();
        }

        ctx.restore(); // Restore context state (solid lines, default color)
    }
}

function drawAngles() {
    const listenerPos = metersToPixelsCoords(listener.x, listener.y);
    const listenerZ = LISTENER_EAR_HEIGHT; // Use constant for listener height

    // Clear previous angles data if needed (or handle updates appropriately)
    // const speakerAngles = []; // This might not be needed anymore if not drawing adjacent

    // --- Draw Line and Angle from Listener to Each Speaker ---
    speakers.forEach((speaker, index) => {
        const speakerPos = metersToPixelsCoords(speaker.x, speaker.y);
        const speakerZ = speaker.z; // Use speaker's actual height

        // Calculate vector from listener to speaker in meters
        const dx_met = speaker.x - listener.x;
        const dy_met = speaker.y - listener.y; // Y increases towards the back wall
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
            if (dz_met > 0.001) elevationDeg = 90.0;    // Directly overhead
            else if (dz_met < -0.001) elevationDeg = -90.0; // Directly below (unlikely)
            else elevationDeg = 0.0;                      // Exactly at listener level AND Y-position
            elevationRad = degreesToRadians(elevationDeg);
        }
        // Note: Bed speakers (dz_met = 0) will naturally result in elevationDeg = 0 here.

        // --- Draw Line from Listener to Speaker (Restored, Dimmer) ---
        ctx.beginPath();
        ctx.moveTo(listenerPos.x, listenerPos.y);
        ctx.lineTo(speakerPos.x, speakerPos.y);
        ctx.strokeStyle = (speaker.type === 'ceiling') ? ADJACENT_ANGLE_COLOR_CEILING : ADJACENT_ANGLE_COLOR_BED;
        ctx.lineWidth = 1;
        ctx.stroke();

        // --- Calculate Fixed Text Offset (Conditional Y) ---
        const fixedOffsetX = -15; // Pixels to the left (remains the same)
        // Use a larger negative offset for ceiling speakers to move text higher
        const fixedOffsetY = (speaker.type === 'ceiling') ? -25 : -15;

        const textX = speakerPos.x + fixedOffsetX;
        const textY = speakerPos.y + fixedOffsetY;

        // --- Draw Angle Text ---
        ctx.fillStyle = (speaker.type === 'ceiling') ? ANGLE_TEXT_COLOR_CEILING : ANGLE_TEXT_COLOR_BED;
        ctx.font = `${ANGLE_FONT_SIZE}px Arial`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';

        // Format angle text with labels
        const angleTextAz = `Az: ${azimuthDeg.toFixed(1)}°`;

        // Display angle text
        ctx.fillText(angleTextAz, textX, textY);

        if (speaker.type !== 'bed') {
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
    const listenerPos = metersToPixelsCoords(listener.x, listener.y);

    const calculateAzimuth = (spk) => {
        const dx_met = spk.x - listener.x;
        const dy_met = spk.y - listener.y;
        return radiansToDegrees(Math.atan2(dx_met, -dy_met)); // Clockwise from North
    };

    const speakersWithAzimuth = speakers.map(spk => ({
        ...spk,
        azimuth: calculateAzimuth(spk),
        dist: Math.sqrt((spk.x - listener.x)**2 + (spk.y - listener.y)**2)
    }));

    const bedSpeakers = speakersWithAzimuth.filter(spk => spk.type === 'bed').sort((a, b) => a.azimuth - b.azimuth);
    const ceilingSpeakers = speakersWithAzimuth.filter(spk => spk.type === 'ceiling').sort((a, b) => a.azimuth - b.azimuth);

    const drawAnglesForList = (list, type) => {
        if (list.length < 2) return;

        const arcRadiusPx = (type === 'ceiling') ? ADJACENT_ANGLE_ARC_RADIUS_PX_CEILING : ADJACENT_ANGLE_ARC_RADIUS_PX_BED;
        const textRadiusPx = arcRadiusPx + ADJACENT_ANGLE_TEXT_OFFSET_PX; // Text goes slightly outside arc
        const color = (type === 'ceiling') ? ADJACENT_ANGLE_COLOR_CEILING : ADJACENT_ANGLE_COLOR_BED; // Select faint color for arc/text

        for (let i = 0; i < list.length; i++) {
            const currentSpeaker = list[i];
            const nextSpeaker = list[(i + 1) % list.length]; // Use modulo to wrap around

            const angleBetween = angleDifference(currentSpeaker.azimuth, nextSpeaker.azimuth);

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
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Position text along the midpoint angle
            ctx.fillText(`${angleBetween.toFixed(1)}°`, textX, textY);
        }
    };

    console.log('Bed speakers count:', bedSpeakers.length, bedSpeakers);
    if (bedSpeakers.length < 2) {
        console.warn('Not enough bed speakers to draw arcs!');
    }
    drawAnglesForList(bedSpeakers, 'bed');
    drawAnglesForList(ceilingSpeakers, 'ceiling');
}

// --- Draw Measurement Function ---
function drawMeasurement() {
    if (!isMeasuring && !measureEnd) return; // Don't draw if not measuring and no final measurement exists

    // Determine the end point to draw to (either fixed or current mouse pos)
    const endPointToDraw = measureEnd ? measureEnd : currentMeasureEnd;

    //console.log(`drawMeasurement state: isMeasuring=${isMeasuring}, start=${!!measureStart}, end=${!!measureEnd}, currentEnd=${!!currentMeasureEnd}, endPointToDraw=${!!endPointToDraw}`); // DEBUG

    // Draw start point
    const startPx = metersToPixelsCoords(measureStart.x_met, measureStart.y_met); // FIX: Use x_met, y_met
    ctx.fillStyle = MEASUREMENT_POINT_COLOR;
    ctx.beginPath();
    ctx.arc(startPx.x, startPx.y, MEASUREMENT_POINT_RADIUS_PX, 0, 2 * Math.PI);
    ctx.fill();

    // Draw end point and line if an end point exists (fixed or current)
    if (endPointToDraw) {
        const endPx = metersToPixelsCoords(endPointToDraw.x_met, endPointToDraw.y_met);

        // Draw line
        ctx.beginPath();
        ctx.moveTo(startPx.x, startPx.y);
        ctx.lineTo(endPx.x, endPx.y);
        ctx.strokeStyle = MEASUREMENT_LINE_COLOR;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw end point (only draw the solid end point if it's fixed)
        if (measureEnd) {
            ctx.fillStyle = MEASUREMENT_POINT_COLOR;
            ctx.beginPath();
            ctx.arc(endPx.x, endPx.y, MEASUREMENT_POINT_RADIUS_PX, 0, 2 * Math.PI);
            ctx.fill();
        }

        // Calculate and display distance
        const dx = endPointToDraw.x_met - measureStart.x_met; // FIX: Use x_met, y_met
        const dy = endPointToDraw.y_met - measureStart.y_met; // FIX: Use x_met, y_met
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Position text near the middle of the line
        const midX = (startPx.x + endPx.x) / 2;
        const midY = (startPx.y + endPx.y) / 2;
        ctx.fillStyle = MEASUREMENT_TEXT_COLOR;
        ctx.font = `${MEASUREMENT_FONT_SIZE_PX}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom'; // Position text slightly above the line midpoint
        ctx.fillText(`${distance.toFixed(2)} m`, midX, midY - 5); // Offset text slightly
    }
}

function redraw() {
    // Update state from inputs
    const prevRoomWidth = room.width;
    const prevRoomDepth = room.depth;

    room.width = parseFloat(roomWidthInput.value);
    room.depth = parseFloat(roomDepthInput.value);
    room.height = parseFloat(roomHeightInput.value);
    listener.x = parseFloat(listenerXInput.value);
    listener.y = parseFloat(listenerYInput.value);
    // tv.x = parseFloat(tvXInput.value); // No longer read from input
    // tv.y = parseFloat(tvYInput.value); // No longer read from input
    tv.width = parseFloat(tvSizeInput.value); // Only read TV width

    // --- TV Position Logic ---
    tv.x = listener.x; // TV X follows Listener X
    tv.y = 0.1;       // TV Y is fixed near the front wall

    // Update disabled input values visually (optional, but good practice)
    tvXInput.value = tv.x.toFixed(1);
    tvYInput.value = tv.y.toFixed(1);

    // --- Rescale Speakers if room dimensions changed ---
    if (room.width !== prevRoomWidth || room.depth !== prevRoomDepth) {
        speakers.forEach(speaker => {
            speaker.x = speaker.x / prevRoomWidth * room.width;
            speaker.y = speaker.y / prevRoomDepth * room.depth;
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
    console.log("Redraw: About to call drawMeasurement()"); // Add log
    drawMeasurement(); // Draw measurement line and text
    updateListenerPositionInfo(); // Call the new function here
    autosaveState(); // Autosave after every redraw
}

// --- Speaker Placement Snap Function (Meters) ---
// Takes the potential x, y coordinates, the z level, and optionally the index of the speaker being dragged
function getSnappedSpeakerPosition(x, y, z, draggedIndex = -1) {
    let snappedX = x;
    let snappedY = y;
    let didSnap = false;
    let snappedXTo = -1; // Index of speaker causing X snap
    let snappedYTo = -1; // Index of speaker causing Y snap

    // Snap X or Y independently to other speakers on the SAME level
    for (let i = 0; i < speakers.length; i++) {
        // Skip comparing the speaker to itself if it's being dragged
        if (i === draggedIndex) {
            continue;
        }

        const speaker = speakers[i];
        if (speaker.z === z) {
            // Check X snap - only update if not already snapped X or closer
            if (Math.abs(x - speaker.x) < SNAP_THRESHOLD_POS_METERS) {
                 // Prioritize the closer snap if multiple are within threshold (optional complexity)
                 // For simplicity now, just take the first one found
                 if (snappedXTo === -1) { // Or add logic to find the minimum distance
                    snappedX = speaker.x;
                    didSnap = true;
                    snappedXTo = i;
                 }
            }
            // Check Y snap - only update if not already snapped Y or closer
            if (Math.abs(y - speaker.y) < SNAP_THRESHOLD_POS_METERS) {
                 if (snappedYTo === -1) { // Or add logic to find the minimum distance
                    snappedY = speaker.y;
                    didSnap = true;
                    snappedYTo = i;
                 }
            }
        }
    }
    // Return detailed snap info
    return { x: snappedX, y: snappedY, snapped: didSnap, snappedXTo: snappedXTo, snappedYTo: snappedYTo };
}

function addSpeaker(x, y, type = 'bed') {
    // Calculate z first
    const z = (type === 'ceiling') ? room.height : LISTENER_EAR_HEIGHT;
    // Pass z to the snapping function
    const snapResult = getSnappedSpeakerPosition(x, y, z);
    const newSpeaker = {
        x: snapResult.x,
        y: snapResult.y,
        z, // Use the calculated z
        type,
        isSnapped: snapResult.snapped
    };
    speakers.push(newSpeaker);
    updateSpeakerList();
    redraw(); // Trigger full redraw
}

function clearSpeakers() {
    speakers = [];
    isPlacingSpeaker = false; // Ensure placement modes are off
    updateSpeakerList();
    redraw();
}

function removeSpeaker(index) {
    if (index >= 0 && index < speakers.length) {
        speakers.splice(index, 1); // Remove the speaker at the given index
        updateSpeakerList(); // Refresh the list in the UI
        redraw(); // Update the canvas
        console.log(`Removed speaker at index ${index}`);
    } else {
        console.error(`Invalid index for speaker removal: ${index}`);
    }
}

function updateSpeakerList() {
    console.log(`updateSpeakerList called. Speakers count: ${speakers.length}`); // Add this line
    speakerListUl.innerHTML = ''; // Clear existing list
    const listenerZ = LISTENER_EAR_HEIGHT; // Need listener height here too

    speakers.forEach((speaker, index) => {
        const li = document.createElement('li');

        // Calculate distance for list display
        const dx_met = speaker.x - listener.x;
        const dy_met = speaker.y - listener.y;
        const dz_met = speaker.z - listenerZ;
        const distance = Math.sqrt(dx_met * dx_met + dy_met * dy_met + dz_met * dz_met);

        // Added Z coordinate and distance display
        li.textContent = `Speaker ${index + 1} (${speaker.type.toUpperCase()}): X=${speaker.x.toFixed(2)}, Y=${speaker.y.toFixed(2)}, Z=${speaker.z.toFixed(2)} (Dist: ${distance.toFixed(2)}m) `; // Add space before button

        // Create Remove Button
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.dataset.index = index; // Store index on the button
        removeBtn.style.marginLeft = '10px'; // Add some spacing
        removeBtn.addEventListener('click', (event) => {
            // Get the index from the button that was clicked
            const indexToRemove = parseInt(event.target.dataset.index, 10);
            removeSpeaker(indexToRemove);
        });

        li.appendChild(removeBtn); // Add button to the list item
        speakerListUl.appendChild(li);
    });
}

// --- Save/Load Functions ---

function saveDesign() {
    const designData = {
        version: 1, // Add a version number for future compatibility
        room: room,
        listener: listener,
        tv: tv,
        speakers: speakers
    };

    const jsonString = JSON.stringify(designData, null, 2); // Pretty print JSON
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'hometheater_design.json';
    document.body.appendChild(a); // Required for Firefox
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("Design saved.");
}

function loadDesign(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const loadedData = JSON.parse(e.target.result);

            // Basic validation
            if (loadedData && loadedData.room && loadedData.listener && loadedData.tv && loadedData.speakers) {
                // Update state
                room = loadedData.room;
                listener = loadedData.listener;
                tv.width = loadedData.tv.width; // Restore TV width
                speakers = loadedData.speakers;

                // Update input controls (excluding tv.x and tv.y inputs)
                roomWidthInput.value = room.width;
                roomDepthInput.value = room.depth;
                roomHeightInput.value = room.height;
                listenerXInput.value = listener.x;
                listenerYInput.value = listener.y;
                // tvXInput.value = tv.x; // Don't set directly, redraw will handle
                // tvYInput.value = tv.y; // Don't set directly, redraw will handle
                tvSizeInput.value = tv.width;

                // Refresh UI
                updateSpeakerList();
                redraw(); // redraw() will correctly set tv.x and tv.y based on loaded listener.x
                console.log("Design loaded successfully.");
            } else {
                alert("Invalid design file format.");
            }
        } catch (error) {
            console.error("Error parsing design file:", error);
            alert("Error reading or parsing design file.");
        }
    };
    reader.onerror = function() {
        alert("Error reading file.");
    };
    reader.readAsText(file);

    // Reset file input value so the same file can trigger 'change' again
    event.target.value = null;
}

// --- Event Listeners ---
listenerXInput.addEventListener('input', () => {
    tv.x = parseFloat(listenerXInput.value); // Update state
    if (isNaN(tv.x)) tv.x = room.width / 2; // Basic fallback
    tvXInput.value = tv.x.toFixed(1); // Update the hidden input value
    redraw(); // Trigger full redraw
});

[roomWidthInput, roomDepthInput, roomHeightInput, listenerYInput, tvSizeInput].forEach(input => {
    input.addEventListener('input', redraw);
});

// --- Helper function to manage tool activation states ---
const toolCursors = {
    'bed': 'crosshair',
    'ceiling': 'crosshair',
    'measure': 'crosshair',
};

function setActiveTool(buttonToActivate) { // Removed 'activate' parameter
    // Determine tool name early, handle null case
    const toolName = buttonToActivate ? buttonToActivate.dataset.tool : null;
    console.log(`setActiveTool called for: ${toolName || 'null (deactivation)'}`);

    // 1. Reset ALL internal tool states first
    const wasMeasuring = isMeasuring; // Remember if we need to redraw for clearing lines
    isPlacingSpeaker = false;
    speakerTypeToPlace = null; // 'bed' or 'ceiling'
    isMeasuring = false;
    measureStart = null; // { x_met, y_met } in meters
    measureEnd = null; // { x_met, y_met } in meters
    currentMeasureEnd = null; // { x_met, y_met } temporary endpoint during mouse move
    isDraggingListener = false;
    isDraggingSpeaker = false; // Declare globally
    draggedSpeakerIndex = -1;  // Declare globally
    isDragging = false;
    // Reset other tool states here if added later

    // 2. Update Visuals: Clear all buttons first
    buttons.forEach(btn => {
        console.log(`Attempting to remove active-tool from: ${btn.id}`); // DEBUG
        btn.classList.remove('active-tool');
    });

    // 3. Activate the target tool's state and visuals (if activating)
    // if (activate) { // No longer use activate flag
    if (buttonToActivate) {
        // const toolName = buttonToActivate.dataset.tool; // Already determined above
        buttonToActivate.classList.add('active-tool');
        canvas.style.cursor = toolCursors[toolName] || 'default';

        // Set internal state for the activated tool
        if (toolName === 'bed' || toolName === 'ceiling') {
            isPlacingSpeaker = true;
            speakerTypeToPlace = toolName;
        } else if (toolName === 'measure') {
            // isMeasuring = true; // REMOVE: Let mousedown handle setting this on first click
        }
    } else {
        // Deactivating all tools (buttonToActivate is null)
        console.log("Deactivating all tools explicitly.");
        canvas.style.cursor = 'default';
        // Internal states already reset in step 1
    }

    // 4. Redraw if measurement was active and is now cleared OR unconditionally
    if (wasMeasuring && !isMeasuring) {
        redraw();
    }
    redraw(); // Redraw unconditionally to reflect tool state changes
}

// Add event listeners to buttons
addSpeakerBtn.addEventListener('click', () => {
    const isCurrentlyActive = addSpeakerBtn.classList.contains('active-tool');
    setActiveTool(isCurrentlyActive ? null : addSpeakerBtn);
});
addCeilingSpeakerBtn.addEventListener('click', () => {
    const isCurrentlyActive = addCeilingSpeakerBtn.classList.contains('active-tool');
    setActiveTool(isCurrentlyActive ? null : addCeilingSpeakerBtn);
});

// Attach clearSpeakers event to button
clearSpeakersBtn.addEventListener('click', clearSpeakers);
measureBtn.addEventListener('click', () => {
    const isCurrentlyActive = measureBtn.classList.contains('active-tool');
    setActiveTool(isCurrentlyActive ? null : measureBtn);
});

canvas.addEventListener('mousedown', (event) => {
    console.log(`Mousedown Start: isPlacingSpeaker=${isPlacingSpeaker}, isMeasuring=${isMeasuring}`);

    // Calculate mouse coordinates relative to canvas ONCE at the beginning
    const rect = canvas.getBoundingClientRect();
    const x_px = event.clientX - rect.left;
    const y_px = event.clientY - rect.top;

    // If placing a speaker, add it and keep placement mode active
    if (isPlacingSpeaker) {
        console.log(`Attempting to place speaker type: ${speakerTypeToPlace}`); // DEBUG
        const { x_met, y_met } = pixelsToMetersCoords(x_px, y_px); // Restore destructuring

        // Basic boundary check before adding
        if (x_met !== undefined && y_met !== undefined && // Ensure values exist
            x_met >= 0 && x_met <= room.width &&
            y_met >= 0 && y_met <= room.depth) {
            addSpeaker(x_met, y_met, speakerTypeToPlace); // addSpeaker now handles snapping
        } else {
            // console.log("Clicked outside room bounds during placement or invalid coords."); // Optional log
        }
        return; // Prevent starting drag actions while placing
    }

    // --- Measurement Logic --- Detect if tool button is active first
    // else if (isMeasuring) { // OLD CHECK
    else if (measureBtn.classList.contains('active-tool')) { // Check if the tool button is active
        const { x_met, y_met } = pixelsToMetersCoords(x_px, y_px);
        const currentClickMeters = { x_met, y_met };

        if (!isMeasuring) {
            // If not currently measuring, this click STARTS a new measurement.
            // This covers the very first click AND the third click (starting anew).
            measureStart = currentClickMeters;
            measureEnd = null;
            currentMeasureEnd = null;
            isMeasuring = true; // Start measuring phase
            console.log("Measure start point set / New measurement started:", measureStart);
        } else {
            // If already measuring (isMeasuring is true), this click ENDS the measurement.
            measureEnd = currentClickMeters;
            currentMeasureEnd = null; // Clear dynamic endpoint
            isMeasuring = false; // End measuring phase
            console.log("Measure end point set:", measureEnd);
        }
        redraw();
        return; // Prevent starting drag actions while measuring
    }

    // Clicked on empty space, start dragging background or listener?
    const listenerPosPx = metersToPixelsCoords(listener.x, listener.y);
    const distToListenerPx = Math.sqrt((x_px - listenerPosPx.x) ** 2 + (y_px - listenerPosPx.y) ** 2);

    if (distToListenerPx <= LISTENER_RADIUS_PX + PADDING/4 ) {
        isDraggingListener = true;
        isDragging = true;
        dragOffsetX = x_px - listenerPosPx.x;
        dragOffsetY = y_px - listenerPosPx.y;
        canvas.style.cursor = 'grabbing'; // Set cursor immediately
    } else {
        // --- Speaker Dragging ---
        // Check if mouse is near any speaker
        let foundSpeaker = false;
        for (let i = 0; i < speakers.length; i++) {
            const spk = speakers[i];
            const spkPosPx = metersToPixelsCoords(spk.x, spk.y);
            const distToSpeakerPx = Math.sqrt((x_px - spkPosPx.x) ** 2 + (y_px - spkPosPx.y) ** 2);
            if (distToSpeakerPx <= SPEAKER_RADIUS_PX + 6) { // 6px padding for easier grabbing
                isDraggingSpeaker = true;
                isDragging = true;
                draggedSpeakerIndex = i;
                dragOffsetX = x_px - spkPosPx.x;
                dragOffsetY = y_px - spkPosPx.y;
                canvas.style.cursor = 'grabbing'; // Set cursor immediately
                foundSpeaker = true;
                break;
            }
        }
        if (!foundSpeaker) {
            // Potential future background drag or other interactions
        }
    }
});

canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x_px = event.clientX - rect.left;
    const y_px = event.clientY - rect.top;

    // --- Measurement Update ---
    if (isMeasuring && measureStart) {
        const endPointPx = { x: x_px, y: y_px };
        const snappedEnd = getSnappedMeasurementPoint(endPointPx.x, endPointPx.y);
        currentMeasureEnd = snappedEnd.meters; // Update the temporary end point { x_met, y_met }
        //console.log("mousemove updated currentMeasureEnd:", currentMeasureEnd); // DEBUG
        redraw();
    }

    // --- Dragging Update ---
    if (isDraggingListener) {
        canvas.style.cursor = 'grabbing';
        // Clamp listener position to room boundaries
        listener.x = Math.max(0, Math.min(room.width, pixelsToMetersCoords(x_px, y_px).x_met));
        listener.y = Math.max(0, Math.min(room.depth, pixelsToMetersCoords(x_px, y_px).y_met));
        // Update inputs visually during drag
        listenerXInput.value = listener.x.toFixed(2);
        listenerYInput.value = listener.y.toFixed(2);
        redraw(); // Redraw continuously while dragging listener
    } else if (isDraggingSpeaker && draggedSpeakerIndex !== -1) {
        canvas.style.cursor = 'grabbing';
        // Dragging a speaker
        // Clamp speaker position to room boundaries (pre-snap)
        const { x_met, y_met } = pixelsToMetersCoords(x_px - dragOffsetX, y_px - dragOffsetY);
        let clampedX = Math.max(0, Math.min(room.width, x_met));
        let clampedY = Math.max(0, Math.min(room.depth, y_met));
        // Snap to other speakers at the same Z-level, passing the index to avoid self-snapping
        const snapResult = getSnappedSpeakerPosition(clampedX, clampedY, speakers[draggedSpeakerIndex].z, draggedSpeakerIndex);
        //console.log("MouseMove Snap Result:", JSON.stringify(snapResult)); // <<< Log snap details

        // Update speaker position
        speakers[draggedSpeakerIndex].x = snapResult.x;
        speakers[draggedSpeakerIndex].y = snapResult.y;
        // Update visual snap flag for highlighting the speaker itself
        speakers[draggedSpeakerIndex].isSnapped = snapResult.snapped;
        // Store detailed snap info for drawing lines
        currentSnapDetails = snapResult;
        //console.log("Stored currentSnapDetails:", JSON.stringify(currentSnapDetails)); // <<< Log stored details

        redraw(); // Redraw continuously while dragging speaker
    } else {
        // Only update cursor if NOT dragging anything
        // Check if over listener
        const listenerPosPx = metersToPixelsCoords(listener.x, listener.y);
        const distToListenerPx = Math.sqrt((x_px - listenerPosPx.x) ** 2 + (y_px - listenerPosPx.y) ** 2);
        let overObject = distToListenerPx <= LISTENER_RADIUS_PX + PADDING/4;

        // Check if over any speaker
        if (!overObject) {
            for (let i = 0; i < speakers.length; i++) {
                const spk = speakers[i];
                const spkPosPx = metersToPixelsCoords(spk.x, spk.y);
                const distToSpeakerPx = Math.sqrt((x_px - spkPosPx.x) ** 2 + (y_px - spkPosPx.y) ** 2);
                if (distToSpeakerPx <= SPEAKER_RADIUS_PX + 6) {
                    overObject = true;
                    break;
                }
            }
        }

        if (overObject) {
             canvas.style.cursor = 'grab'; // Use 'grab' for hover, changes to 'grabbing' on mousedown
        } else if (isPlacingSpeaker) {
            canvas.style.cursor = 'crosshair';
        } else if (isMeasuring) {
            canvas.style.cursor = 'crosshair'; // Or specific measurement cursor
        } else {
            canvas.style.cursor = 'default';
        }
    }
});

canvas.addEventListener('mouseup', (event) => {
    // Always reset all drag flags
    let wasDragging = isDragging || isDraggingListener || isDraggingSpeaker;
    isDraggingListener = false;
    isDraggingSpeaker = false;
    draggedSpeakerIndex = -1;
    isDragging = false;
    currentSnapDetails = null; // Clear snap details on mouse up

    // Reset cursor based on mode or hover
    if (isPlacingSpeaker) {
        canvas.style.cursor = 'crosshair';
    } else if (wasDragging) {
        canvas.style.cursor = 'default'; // Or check hover state again
         // Reset temporary measurement points for drawing
         // measureStart = null; // Keep for display until next measure starts
         // currentMeasureEnd = null; // Keep for display
    } else {
        canvas.style.cursor = 'default'; // Or update based on hover
        // Potentially call cursor update function here if it exists
    }

    updateSpeakerList(); // Update list if a speaker was potentially moved
    if (wasDragging) { // Redraw if dragging
        redraw(); // Final redraw to remove drag effects
    }

    // No autosave here, rely on redraw's autosave
});

canvas.addEventListener('mouseout', (event) => {
    // Always reset all drag flags
    isDraggingListener = false;
    isDraggingSpeaker = false;
    draggedSpeakerIndex = -1;
    isDragging = false;
    redraw();
    // Reset cursor if not over canvas anymore
    canvas.style.cursor = 'default';
});

// Save/Load Button Listeners
saveDesignBtn.addEventListener('click', saveDesign);
loadDesignBtn.addEventListener('click', () => loadFileInput.click()); // Trigger hidden input
loadFileInput.addEventListener('change', loadDesign);

// --- Autosave Functions ---
function autosaveState() {
    const state = {
        room: { ...room }, // Shallow copy
        listener: { ...listener }, // Shallow copy
        tv: { width: tv.width }, // Only need width, as position is derived
        speakers: [...speakers] // Shallow copy of speaker array
    };
    try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state));
        // console.log("Autosave successful."); // Optional: for debugging
    } catch (e) {
        console.error("Autosave failed:", e);
    }
}

function loadAutosavedState() {
    try {
        const savedStateString = localStorage.getItem(AUTOSAVE_KEY);
        if (savedStateString) {
            const savedState = JSON.parse(savedStateString);

            // Validate loaded data (basic check)
            if (savedState && savedState.room && savedState.listener && savedState.tv && savedState.speakers) {
                // Restore state variables
                room = savedState.room;
                listener = savedState.listener;
                tv.width = savedState.tv.width; // Restore TV width
                speakers = savedState.speakers;

                // Update input fields to match loaded state
                roomWidthInput.value = room.width.toFixed(1);
                roomDepthInput.value = room.depth.toFixed(1);
                roomHeightInput.value = room.height.toFixed(1);
                listenerXInput.value = listener.x.toFixed(2);
                listenerYInput.value = listener.y.toFixed(2);
                tvSizeInput.value = tv.width.toFixed(2);

                updateSpeakerList(); // Update the speaker list UI here

                console.log("Autosaved state loaded successfully.");
                return true; // Indicate success
            } else {
                console.warn("Autosaved data is incomplete or invalid.");
                localStorage.removeItem(AUTOSAVE_KEY); // Clear invalid data
            }
        }
    } catch (e) {
        console.error("Failed to load or parse autosaved state:", e);
        // Optionally clear potentially corrupted data
        localStorage.removeItem(AUTOSAVE_KEY);
    }
    return false; // Indicate failure or no data found
}

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
    // 1. Attempt to load autosaved state FIRST
    const loaded = loadAutosavedState();

    // 2. If loading failed, set up default values
    if (!loaded) {
        console.log("No valid autosave found. Using default values.");
        // Ensure default values from HTML inputs are reflected in state
        room.width = parseFloat(roomWidthInput.value);
        room.depth = parseFloat(roomDepthInput.value);
        room.height = parseFloat(roomHeightInput.value);

        // Calculate and set default listener position
        listener.x = room.width / 2;
        listener.y = Math.max(0, room.depth - 0.7); // 0.7m from back wall, ensure not negative
        // Clamp within room boundaries (though Y should be fine)
        listener.x = Math.max(0, Math.min(room.width, listener.x));
        listener.y = Math.max(0, Math.min(room.depth, listener.y));

        listenerXInput.value = listener.x.toFixed(2);
        listenerYInput.value = listener.y.toFixed(2);

        tv.width = parseFloat(tvSizeInput.value); // Get initial TV width
        // speakers array is already empty by default
    }

    // 3. Perform initial setup and redraw AFTER state is determined (loaded or default)
    calculateScaleAndResizeCanvas();
    updateListenerPositionInfo();
    updateCanvasCursor(); // Initial cursor state based on final initial state
    updateSpeakerList(); // Ensure speaker list UI is updated if state was loaded
    redraw(); // Perform initial draw (this will also trigger the first autosave of the correct state)

    // 4. Setup event listeners for subsequent changes
    roomWidthInput.addEventListener('input', redraw);
    roomDepthInput.addEventListener('input', redraw);
    // Redraw on window resize
    window.addEventListener('resize', redraw);
});

function updateListenerPositionInfo() {
    if (!distFrontSpan || !distBackSpan) {
        console.warn("Listener info spans not found.");
        return; // Ensure elements exist
    }
    const distFront = listener.y;
    const distBack = room.depth - listener.y;

    // Prevent negative distances if listener is outside room (shouldn't happen with clamping)
    const displayDistFront = Math.max(0, distFront);
    const displayDistBack = Math.max(0, distBack);

    distFrontSpan.textContent = displayDistFront.toFixed(2);
    distBackSpan.textContent = displayDistBack.toFixed(2);
}

function updateCanvasCursor() {
    if (isDraggingListener) {
        canvas.style.cursor = 'grabbing';
    } else if (isMeasuring || isPlacingSpeaker) {
        canvas.style.cursor = 'crosshair';
    } else {
        canvas.style.cursor = 'default';
    }
}
