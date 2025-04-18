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
const distFrontSpan = document.getElementById('dist-front');
const distBackSpan = document.getElementById('dist-back');

// --- State ---
let room = {
    width: parseFloat(roomWidthInput.value),
    depth: parseFloat(roomDepthInput.value),
    height: parseFloat(roomHeightInput.value)
};
let listener = {
    x: 0, // Placeholder, will be calculated on load
    y: 0  // Placeholder, will be calculated on load
};
let tv = {
    x: 2.5, // Initial X will be overwritten by listener X in redraw
    y: 0.1, // Fixed Y
    width: 1.5, // Initial width
    depth: 0.05 // Small depth for visual representation
};
let speakers = []; // Array to hold speaker objects {x, y, z, type: 'bed' | 'ceiling'}
let isPlacingSpeaker = false; // State for speaker placement mode
let speakerTypeToPlace = 'bed'; // Type of speaker to place
let isDragging = false;         // State for general element dragging mode
let isDraggingListener = false; // State for listener dragging mode
let draggedSpeakerIndex = -1;   // Index of the speaker being dragged
let dragOffsetX = 0;            // Offset X for dragging (used for both)
let dragOffsetY = 0;            // Offset Y for dragging (used for both)

// --- Drawing Constants ---
const PADDING = 30; // Padding around the drawing area in pixels
let scale = 1; // Pixels per meter, calculated dynamically
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
const ADJACENT_ANGLE_COLOR_BED = 'rgba(0, 128, 0, 0.35)'; // More visible green for angle arcs/labels
const ADJACENT_ANGLE_COLOR_CEILING = 'rgba(128, 128, 128, 0.35)'; // More visible gray for angle arcs/labels
const ANGLE_TEXT_COLOR_BED = 'rgba(0, 128, 0, 0.7)'; // Stronger green for azimuth text
const ANGLE_TEXT_COLOR_CEILING = 'rgba(128, 128, 128, 0.7)'; // Stronger gray for azimuth text
const ADJACENT_ANGLE_FONT_SIZE_PX = 12;
const ADJACENT_ANGLE_ARC_WIDTH = 1.5;

// --- Coordinate Conversion ---
// Convert room coordinates (meters) to canvas coordinates (pixels)
function metersToPixelsCoords(x_met, y_met) {
    // Maps room Y=0 (front/TV wall) to pixel Y=PADDING (top edge of drawing area)
    // Maps room Y=room.depth (back wall) to pixel Y=canvas.height-PADDING (bottom edge)
    const x_px = x_met * scale + PADDING;
    const y_px = y_met * scale + PADDING; // Room Y=0 -> Pixel Y=PADDING
    return { x: x_px, y: y_px };
}

// Convert canvas coordinates (pixels) back to room coordinates (meters)
function pixelsToMetersCoords(x_px, y_px) {
    // Inverse mapping
    const x_met = (x_px - PADDING) / scale;
    const y_met = (y_px - PADDING) / scale; // Pixel Y=PADDING -> Room Y=0
    return { x: x_met, y: y_met };
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

        // --- Visual Feedback for Snap ---
        const fillColor = speaker.isSnapped ? 'yellow' : baseColor; // Highlight when snapped
        const strokeColor = speaker.isSnapped ? 'red' : 'black';
        const lineWidth = speaker.isSnapped ? 2 : 1;

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

    /* --- Hide Adjacent Speaker Angles (For Now) ---
    // // Sort speakers by azimuth for drawing adjacent lines
    // speakerAngles.sort((a, b) => a.azimuthRad - b.azimuthRad);

    // // --- Draw Lines Between Adjacent Speakers ---
    // if (speakerAngles.length > 1) {
    //     ctx.strokeStyle = 'rgba(200, 0, 0, 0.5)'; // Reddish color for adjacent angles
    //     ctx.lineWidth = ANGLE_LINE_WIDTH; // Use constant
    //     for (let i = 0; i < speakerAngles.length; i++) {
    //         const current = speakerAngles[i];
    //         const next = speakerAngles[(i + 1) % speakerAngles.length]; // Wrap around

    //         // Find corresponding speaker positions
    //         const currentSpeaker = speakers.find(s => s.id === current.id);
    //         const nextSpeaker = speakers.find(s => s.id === next.id);
    //         if (!currentSpeaker || !nextSpeaker) continue;

    //         const currentSpeakerPos = metersToPixelsCoords(currentSpeaker.x, currentSpeaker.y);
    //         const nextSpeakerPos = metersToPixelsCoords(nextSpeaker.x, nextSpeaker.y);

    //         // Calculate angle between adjacent speakers
    //         let adjacentAngleRad = next.azimuthRad - current.azimuthRad;

    //         // Handle wrap-around (e.g., from +170 deg to -170 deg)
    //         if (adjacentAngleRad > Math.PI) {
    //             adjacentAngleRad -= 2 * Math.PI;
    //         } else if (adjacentAngleRad < -Math.PI) {
    //             adjacentAngleRad += 2 * Math.PI;
    //         }
    //         let adjacentAngleDeg = radiansToDegrees(adjacentAngleRad);

    //         // Draw arc between speakers (centered at listener)
    //         const arcRadius = 35; // Radius for the arc
    //         ctx.beginPath();
    //         // atan2 uses angle from positive X-axis, need conversion for arc
    //         // Or, stick to our azimuth system: angle relative to -Y axis.
    //         // Start angle: current.azimuthRad. End angle: next.azimuthRad.
    //         // Canvas arc angles are relative to positive X-axis, clockwise.
    //         // Our azimuth is relative to negative Y-axis, counter-clockwise.
    //         // Angle conversion: canvas_angle = PI/2 - azimuth_rad
    //         const startAngleCanvas = Math.PI / 2 - current.azimuthRad;
    //         const endAngleCanvas = Math.PI / 2 - next.azimuthRad;

    //         // Handle arc direction correctly for wrap-around
    //         const counterClockwise = adjacentAngleRad < 0; // If angle is negative, arc goes CCW in our system -> CW in canvas
    //         ctx.arc(listenerPos.x, listenerPos.y, arcRadius, startAngleCanvas, endAngleCanvas, counterClockwise);
    //         ctx.stroke();

    //         // --- Draw Adjacent Angle Text ---
    //         // Calculate midpoint angle for text placement, adjusting for wrap-around
    //         let midAzimuthRad = current.azimuthRad + adjacentAngleRad / 2;

    //         // Adjust for angle system differences when placing text
    //         const textRadius = arcRadius + 10; // Place text just outside the arc
    //         const textPosX = listenerPos.x + textRadius * Math.sin(midAzimuthRad); // Use sin/cos with *our* azimuth
    //         const textPosY = listenerPos.y - textRadius * Math.cos(midAzimuthRad);

    //         ctx.font = `${ANGLE_FONT_SIZE - 2}px Arial`; // Slightly smaller font for adjacent
    //         ctx.fillStyle = 'darkred';
    //         ctx.textAlign = 'center';
    //         ctx.textBaseline = 'middle';
    //         ctx.fillText(`${adjacentAngleDeg.toFixed(1)}°`, textPosX, textPosY);
    //     }
    */
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
            const nextSpeaker = list[(i + 1) % list.length]; // Wrap around

            const angleBetween = angleDifference(currentSpeaker.azimuth, nextSpeaker.azimuth);

            // Convert *our* azimuth (clockwise from North) to canvas angle (anti-clockwise from East)
            // const canvasAngleRad = degreesToRadians(-midAzimuthDeg + 90);

            // --- Calculate Canvas Angles (for arc drawing) ---
            // atan2(y, x) gives angle relative to positive x-axis (East), counter-clockwise
            // We need y = speakerY_px - listenerY_px, x = speakerX_px - listenerX_px
            const pos1 = metersToPixelsCoords(currentSpeaker.x, currentSpeaker.y);
            const pos2 = metersToPixelsCoords(nextSpeaker.x, nextSpeaker.y);
            let angle1 = Math.atan2(pos1.y - listenerPos.y, pos1.x - listenerPos.x);
            let angle2 = Math.atan2(pos2.y - listenerPos.y, pos2.x - listenerPos.x);

            // Ensure angle2 is always 'ahead' of angle1 counter-clockwise for arc drawing
            // Add 2*PI until angle2 > angle1
            while (angle2 <= angle1) {
                angle2 += 2 * Math.PI;
            }
            // If the difference is > PI, we probably went the long way around
             if (angle2 - angle1 > Math.PI && list.length > 2) { // Check list.length > 2 avoids flipping for 2 speakers 180 apart
                 // Swap and adjust angle1 instead
                 [angle1, angle2] = [angle2, angle1]; // Swap
                 while (angle1 <= angle2) {
                    angle1 += 2 * Math.PI;
                 }
             }

            // --- Draw the Arc ---
            ctx.beginPath();
            ctx.arc(listenerPos.x, listenerPos.y, arcRadiusPx, angle1, angle2); // Use canvas angles
            ctx.strokeStyle = color; // Use selected color
            ctx.lineWidth = ADJACENT_ANGLE_ARC_WIDTH;
            ctx.stroke();

            // --- Calculate Midpoint Angle for Text (on canvas) ---
            let midCanvasAngleRad = (angle1 + angle2) / 2;
             // Adjust if the angle difference was large (meaning we went across the 0/2PI boundary)
             if (Math.abs(angle2 - angle1) > Math.PI) {
                 midCanvasAngleRad = (angle1 + angle2) / 2 + Math.PI; // Add PI to get the angle bisector on the shorter side
             }

            // --- Calculate Text Position ---
            const textX = listenerPos.x + textRadiusPx * Math.cos(midCanvasAngleRad);
            const textY = listenerPos.y + textRadiusPx * Math.sin(midCanvasAngleRad);

            // --- Draw Text ---
            ctx.fillStyle = color; // Use selected color
            ctx.font = `${ADJACENT_ANGLE_FONT_SIZE_PX}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`Sep: ${angleBetween.toFixed(1)}°`, textX, textY);
        }
    };

    drawAnglesForList(bedSpeakers, 'bed');
    drawAnglesForList(ceilingSpeakers, 'ceiling');
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
    drawAngles(); // Draw angles after speakers
    drawAdjacentSpeakerAngles(); // Draw adjacent speaker angles
    updateListenerPositionInfo(); // Call the new function here
    autosaveState(); // Autosave after every redraw
}

function addSpeaker(x, y, type = 'bed') {
    // Assign Z based on type and current room height OR listener height
    const z = (type === 'ceiling') ? room.height : LISTENER_EAR_HEIGHT; // Use listener height for bed level
    const newSpeaker = { x, y, z, type, isSnapped: false }; // Added z and isSnapped
    speakers.push(newSpeaker);
    updateSpeakerList();
    redraw();
}

function clearSpeakers() {
    speakers = [];
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
            if (loadedData && loadedData.room && loadedData.listener && loadedData.tv && Array.isArray(loadedData.speakers)) {
                // Update state
                room = loadedData.room;
                listener = loadedData.listener;
                tv = loadedData.tv; // Load the TV object (mainly for width)
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

addSpeakerBtn.addEventListener('click', () => {
    isPlacingSpeaker = true;
    speakerTypeToPlace = 'bed';
    canvas.style.cursor = 'crosshair'; // Indicate placement mode
    console.log("Placement mode activated for bed speaker. Click on the canvas.");
});

addCeilingSpeakerBtn.addEventListener('click', () => {
    isPlacingSpeaker = true;
    speakerTypeToPlace = 'ceiling'; // Set type to ceiling
    canvas.style.cursor = 'crosshair';
    console.log("Placement mode activated for CEILING speaker. Click on the canvas.");
});

clearSpeakersBtn.addEventListener('click', clearSpeakers);

canvas.addEventListener('mousedown', (event) => {
    if (isPlacingSpeaker) return; // Don't drag while placing

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const clickCoordsMet = pixelsToMetersCoords(mouseX, mouseY);

    // Check if clicking on the listener first
    const listenerPosPx = metersToPixelsCoords(listener.x, listener.y);
    const distToListener = Math.sqrt((mouseX - listenerPosPx.x)**2 + (mouseY - listenerPosPx.y)**2);

    if (distToListener <= LISTENER_RADIUS_PX + PADDING/4) { // Check click near listener (+ tolerance)
        isDragging = true;
        isDraggingListener = true;
        draggedSpeakerIndex = -1; // Ensure speaker isn't dragged
        // Offset is difference between listener's actual meter coords and clicked meter coords
        dragOffsetX = listener.x - clickCoordsMet.x;
        dragOffsetY = listener.y - clickCoordsMet.y;
        canvas.style.cursor = 'grabbing';
        // console.log("Dragging listener started");
        return; // Listener takes priority
    }

    // Check if clicking on a speaker (existing logic)
    draggedSpeakerIndex = speakers.findIndex(speaker => {
        const speakerPos = metersToPixelsCoords(speaker.x, speaker.y);
        const distance = Math.sqrt((mouseX - speakerPos.x)**2 + (mouseY - speakerPos.y)**2);
        return distance <= SPEAKER_RADIUS_PX + PADDING/4 ; // Check within radius + tolerance
    });

    if (draggedSpeakerIndex !== -1) {
        isDragging = true;
        isDraggingListener = false; // Ensure listener isn't dragged
        const speaker = speakers[draggedSpeakerIndex];
        // Calculate offset in meters
        dragOffsetX = speaker.x - clickCoordsMet.x;
        dragOffsetY = speaker.y - clickCoordsMet.y;
        canvas.style.cursor = 'grabbing';
        // console.log(`Dragging speaker ${draggedSpeakerIndex} started`);
    }
});

canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const currentCoords = pixelsToMetersCoords(mouseX, mouseY);

    if (isDraggingListener) {
        // Clamp listener position to room boundaries
        listener.x = Math.max(0, Math.min(room.width, currentCoords.x));
        listener.y = Math.max(0, Math.min(room.depth, currentCoords.y));
        // Update inputs visually during drag
        listenerXInput.value = listener.x.toFixed(2);
        listenerYInput.value = listener.y.toFixed(2);
        redraw(); // Redraw continuously while dragging listener
    } else if (isDragging && draggedSpeakerIndex !== -1) {
        const speaker = speakers[draggedSpeakerIndex];
        let targetX = currentCoords.x;
        let targetY = currentCoords.y;

        // --- Positional Snapping Logic ---
        let isSnapped = false;
        let snappedX = targetX; // Start with current mouse position
        let snappedY = targetY;

        for (let i = 0; i < speakers.length; i++) {
            if (i === draggedSpeakerIndex) continue; // Don't snap to self

            const otherSpeaker = speakers[i];

            // Only snap to speakers of the same type
            if (otherSpeaker.type === speaker.type) {
                // Check X snap
                if (Math.abs(targetX - otherSpeaker.x) < SNAP_THRESHOLD_POS_METERS) {
                    snappedX = otherSpeaker.x; // Snap X coordinate
                    isSnapped = true;
                }
                // Check Y snap (independent of X snap)
                if (Math.abs(targetY - otherSpeaker.y) < SNAP_THRESHOLD_POS_METERS) {
                    snappedY = otherSpeaker.y; // Snap Y coordinate
                    isSnapped = true;
                }
            }
        }
        // --- End Positional Snapping Logic ---

        // Use snapped coordinates if a snap occurred
        targetX = snappedX;
        targetY = snappedY;

        // Clamp final target coordinates to room boundaries
        speaker.x = Math.max(0, Math.min(room.width, targetX));
        speaker.y = Math.max(0, Math.min(room.depth, targetY));
        speaker.isSnapped = isSnapped; // Store snap state for visual feedback

        redraw(); // Redraw with updated position and snap state

    } else {
        // Hover logic (no dragging)
        const listenerPosPx = metersToPixelsCoords(listener.x, listener.y);
        const distToListener = Math.sqrt((mouseX - listenerPosPx.x)**2 + (mouseY - listenerPosPx.y)**2);
        let onSpeaker = speakers.some(speaker => {
            const speakerPos = metersToPixelsCoords(speaker.x, speaker.y);
            const distance = Math.sqrt((mouseX - speakerPos.x)**2 + (mouseY - speakerPos.y)**2);
            return distance <= SPEAKER_RADIUS_PX + PADDING/4;
        });

        if (distToListener <= LISTENER_RADIUS_PX + PADDING/4 || onSpeaker) {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = 'default';
        }
    }
});

canvas.addEventListener('mouseup', (event) => {
    if (isDraggingListener) {
        isDraggingListener = false;
    } else if (isDragging && draggedSpeakerIndex !== -1) {
        if (speakers[draggedSpeakerIndex]) {
            speakers[draggedSpeakerIndex].isSnapped = false; // Reset snap state
        }
        isDragging = false;
        draggedSpeakerIndex = -1;
        // Optional: Update speaker list or perform other actions on drop
    }
    // Force redraw AFTER resetting flags to remove snap highlight
    redraw();
    // Update cursor style
    canvas.style.cursor = 'grab';
});

canvas.addEventListener('mouseout', (event) => {
    if (isDraggingListener) {
        isDraggingListener = false;
        // Don't reset position on mouseout, keep last valid position
        redraw();
    } else if (isDragging && draggedSpeakerIndex !== -1) {
        if (speakers[draggedSpeakerIndex]) {
            speakers[draggedSpeakerIndex].isSnapped = false; // Reset snap state
        }
        isDragging = false;
        draggedSpeakerIndex = -1;
        // Don't reset position on mouseout
        redraw();
    }
    // Reset cursor if not over canvas anymore?
});

canvas.addEventListener('click', (event) => {
    // Only place speaker if NOT dragging and placement mode is active
    if (isDragging || !isPlacingSpeaker) {
        // If we just finished dragging, the mouseup already handled redraw.
        // If placement isn't active, do nothing.
        return;
    }

    // Existing placement logic... (check boundaries, add speaker)
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    // Check click is within padded area
    if (canvasX < PADDING || canvasX > canvas.width - PADDING || canvasY < PADDING || canvasY > canvas.height - PADDING) {
        console.log("Clicked outside drawable area (in padding).");
        // Deactivate placement mode even on bad click? Optional.
        // isPlacingSpeaker = false;
        // canvas.style.cursor = 'default';
        return; // Click is in the padding, not the room area
    }

    // Convert click to meters and clamp
    const coords_met = pixelsToMetersCoords(canvasX, canvasY);
    coords_met.x = Math.max(0, Math.min(room.width, coords_met.x));
    coords_met.y = Math.max(0, Math.min(room.depth, coords_met.y));

    addSpeaker(coords_met.x, coords_met.y, speakerTypeToPlace);

    // Exit placement mode
    isPlacingSpeaker = false;
    canvas.style.cursor = 'default'; // Reset cursor after placement
    console.log("Speaker placed. Placement mode deactivated.");
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
    const loaded = loadAutosavedState(); // Attempt to load saved state first

    if (!loaded) {
        // If nothing loaded, set up defaults
        room.width = parseFloat(roomWidthInput.value);
        room.depth = parseFloat(roomDepthInput.value);
        room.height = parseFloat(roomHeightInput.value);

        // Calculate and set default listener position only if not loaded
        let defaultListenerX = room.width / 2;
        let defaultListenerY = room.depth - 0.7;
        listener.x = Math.max(0, Math.min(room.width, defaultListenerX));
        listener.y = Math.max(0, Math.min(room.depth, defaultListenerY));
        listenerXInput.value = listener.x.toFixed(2);
        listenerYInput.value = listener.y.toFixed(2);

        tv.width = parseFloat(tvSizeInput.value); // Get initial TV width
        console.log("No valid autosave found. Using default values.");
    }

    // Initial setup (always needed, uses loaded or default state)
    calculateScaleAndResizeCanvas(); // Calculate scale based on current room dimensions
    redraw(); // Perform initial draw with loaded or default state (this also calls autosave)

    // Setup event listeners for input changes
    roomWidthInput.addEventListener('input', redraw);
});

// Redraw on window resize
window.addEventListener('resize', redraw);

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
