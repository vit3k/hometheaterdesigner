import { calculateScaleAndResizeCanvas, canvas, LISTENER_RADIUS_PX, metersToPixelsCoords, pixelsToMetersCoords, redraw, SPEAKER_RADIUS_PX, updateListenerPositionInfo, ctx } from "~/draw/draw";
import { listenerXInput, listenerYInput, loadDesignBtn, loadFileInput, measureBtn, roomDepthInput, roomHeightInput, roomWidthInput, saveDesignBtn, tvSizeInput, tvXInput } from "~/elements";
import { getSnappedSpeakerPosition, updateSpeakerList, addSpeaker } from "~/speakers";
import { loadAutosavedState, loadDesign, saveDesign, state } from "~/state";
import { getSnappedMeasurementPoint} from "~/draw/measurement";
import * as tools from "~/tools";

// Function to update input fields from the current state
function updateInputsFromState() {
  roomWidthInput.value = state.room.width.toFixed(1);
  roomDepthInput.value = state.room.depth.toFixed(1);
  roomHeightInput.value = state.room.height.toFixed(1);
  listenerXInput.value = state.listener.x.toFixed(2);
  listenerYInput.value = state.listener.y.toFixed(2);
  tvSizeInput.value = state.tv.width.toFixed(2);
  // Note: tvXInput is usually derived/hidden, might not need direct update here
  // tvXInput.value = state.tv.x.toFixed(1);
}

function setup() {

    // Initial setup
    document.addEventListener("DOMContentLoaded", () => {
        // 1. Attempt to load autosaved state FIRST
        const loaded = loadAutosavedState();

        // 2. If loading failed, set up default values from HTML inputs
        if (!loaded) {
            console.log("No valid autosave found. Using default HTML values.");
            // Ensure state reflects default values from HTML inputs
            state.room.width = parseFloat(roomWidthInput.value);
            state.room.depth = parseFloat(roomDepthInput.value);
            state.room.height = parseFloat(roomHeightInput.value);

            // Calculate and set default listener position IN STATE
            state.listener.x = state.room.width / 2;
            state.listener.y = Math.max(0, state.room.depth - 0.7); // 0.7m from back wall
            state.listener.x = Math.max(0, Math.min(state.room.width, state.listener.x));
            state.listener.y = Math.max(0, Math.min(state.room.depth, state.listener.y));

            state.tv.width = parseFloat(tvSizeInput.value); // Get initial TV width from input
            // speakers array is already empty by default in state.js
        }

        // 3. Sync Input fields to match final state (loaded or default)
        updateInputsFromState(); // <--- ADDED CALL HERE

        // 4. Perform initial UI setup and redraw AFTER state is determined and inputs synced
        if (ctx) {
          calculateScaleAndResizeCanvas(ctx);
        }
        updateListenerPositionInfo();
        updateCanvasCursor(); // Initial cursor state based on final initial state
        updateSpeakerList(); // Ensure speaker list UI is updated if state was loaded
        redraw(); // Perform initial draw

        // 5. Setup event listeners for subsequent changes
        roomWidthInput.addEventListener("input", () => {
            state.room.width = parseFloat(roomWidthInput.value) || 0;
            redraw();
        });
        roomDepthInput.addEventListener("input", () => {
            state.room.depth = parseFloat(roomDepthInput.value) || 0;
            redraw();
        });
        roomHeightInput.addEventListener("input", () => {
            state.room.height = parseFloat(roomHeightInput.value) || 0;
            redraw();
        });
        // Redraw on window resize
        window.addEventListener("resize", () => {
          if (ctx) {
            calculateScaleAndResizeCanvas(ctx); // Recalculate scale first
          }
          redraw();
        });

        // --- Event Listeners ---
        listenerXInput.addEventListener("input", () => {
            state.listener.x = parseFloat(listenerXInput.value);
            if (isNaN(state.listener.x)) state.listener.x = state.room.width / 2;
            // Update derived TV position (assuming it's always centered horizontally with listener)
            state.tv.x = state.listener.x;
            tvXInput.value = state.tv.x.toFixed(1); // Update the hidden input value
            redraw(); // Trigger full redraw
        });
        listenerYInput.addEventListener("input", () => {
            state.listener.y = parseFloat(listenerYInput.value);
            if (isNaN(state.listener.y)) state.listener.y = state.room.depth - 0.7;
            redraw();
        });
        tvSizeInput.addEventListener("input", () => {
            state.tv.width = parseFloat(tvSizeInput.value);
            if (isNaN(state.tv.width)) state.tv.width = 1.6; // Default fallback
            redraw();
        });

        canvas.addEventListener("mousedown", (event) => {
            console.log(
                `Mousedown Start: isPlacingSpeaker=${state.isPlacingSpeaker}, isMeasuring=${state.isMeasuring}`,
            );

            // Calculate mouse coordinates relative to canvas ONCE at the beginning
            const rect = canvas.getBoundingClientRect();
            const x_px = event.clientX - rect.left;
            const y_px = event.clientY - rect.top;

            // If placing a speaker, add it and keep placement mode active
            if (state.isPlacingSpeaker) {
                console.log(`Attempting to place speaker type: ${state.speakerTypeToPlace}`); // DEBUG
                const { x_met, y_met } = pixelsToMetersCoords(x_px, y_px); // Restore destructuring

                // Basic boundary check before adding
                if (
                    x_met !== undefined &&
                    y_met !== undefined && // Ensure values exist
                    x_met >= 0 &&
                    x_met <= state.room.width &&
                    y_met >= 0 &&
                    y_met <= state.room.depth
                ) {
                    addSpeaker(x_met, y_met, state.speakerTypeToPlace ?? undefined); // Handle null type by passing undefined (uses default)
                } else {
                    // console.log("Clicked outside room bounds during placement or invalid coords."); // Optional log
                }
                return; // Prevent starting drag actions while placing
            }

            // --- Measurement Logic --- Detect if tool button is active first
            // else if (isMeasuring) { // OLD CHECK
            else if (measureBtn?.classList.contains("active-tool")) {
                // Check if the tool button is active
                // Get the *snapped* point based on the raw click coordinates
                const snappedPoint = getSnappedMeasurementPoint(x_px, y_px);
                const currentClickMeters = snappedPoint.meters; // Use snapped meter coordinates

                if (!state.isMeasuring) {
                    // Only start a new measurement if there is no completed measurement visible
                    if (state.measureStart && state.measureEnd) {
                        // There is a completed measurement, so clear it first
                        state.measureStart = null;
                        state.measureEnd = null;
                        state.currentMeasureEnd = null;
                        state.measureSnapAxes = [];
                        // Start new measurement immediately after clearing
                    }
                    // No completed measurement: start a new measurement
                    state.measureStart = currentClickMeters; // Use snapped coords
                    state.isMeasuring = true; // Start measuring phase
                    // --- Set measureSnapAxes for snapping lines on the first click ---
                    if (state.measureSnapAxes && state.measureSnapAxes.length > 0) {
                        // Already set by getSnappedMeasurementPoint
                    } else {
                        state.measureSnapAxes = [];
                    }
                    console.log(
                        "Measure start point set / New measurement started:",
                        state.measureStart,
                    );
                } else {
                    // If already measuring (isMeasuring is true), this click ENDS the measurement.
                    state.measureEnd = currentClickMeters; // Use snapped coords
                    state.currentMeasureEnd = null; // Clear dynamic endpoint
                    state.isMeasuring = false; // End measuring phase
                    console.log("Measure end point set:", state.measureEnd);

                    // --- Do not clear previous measurement here ---
                    // The previous measurement will remain until the user starts a new one
                    // (state.measureStart and state.measureEnd will be cleared on the next measurement start)

                }
                redraw();
                return; // Prevent starting drag actions while measuring
            }

            // Clicked on empty space, start dragging background or listener?
            const listenerPosPx = metersToPixelsCoords(state.listener.x, state.listener.y);
            const distToListenerPx = Math.sqrt(
                (x_px - listenerPosPx.x) ** 2 + (y_px - listenerPosPx.y) ** 2,
            );

            if (distToListenerPx <= LISTENER_RADIUS_PX + state.PADDING / 4) {
                state.isDraggingListener = true;
                state.isDragging = true;
                state.dragOffsetX = x_px - listenerPosPx.x;
                state.dragOffsetY = y_px - listenerPosPx.y;
                canvas.style.cursor = "grabbing"; // Set cursor immediately
            } else {
                // --- Speaker Dragging ---
                // Check if mouse is near any speaker
                let foundSpeaker = false;
                for (let i = 0; i < state.speakers.length; i++) {
                    const spk = state.speakers[i];
                    const spkPosPx = metersToPixelsCoords(spk?.x ?? 0, spk?.y ?? 0);
                    const distToSpeakerPx = Math.sqrt(
                        (x_px - spkPosPx.x) ** 2 + (y_px - spkPosPx.y) ** 2,
                    );
                    if (distToSpeakerPx <= SPEAKER_RADIUS_PX + 6) {
                        // 6px padding for easier grabbing
                        state.isDraggingSpeaker = true;
                        state.isDragging = true;
                        state.draggedSpeakerIndex = i;
                        state.dragOffsetX = x_px - spkPosPx.x;
                        state.dragOffsetY = y_px - spkPosPx.y;
                        canvas.style.cursor = "grabbing"; // Set cursor immediately
                        foundSpeaker = true;
                        break;
                    }
                }
                if (!foundSpeaker) {
                    // Potential future background drag or other interactions
                }
            }
        });

        canvas.addEventListener("mousemove", (event) => {
            const rect = canvas.getBoundingClientRect();
            const x_px = event.clientX - rect.left;
            const y_px = event.clientY - rect.top;

            // --- Measurement Update ---
            if (state.isMeasuring && state.measureStart) {
                // Normal measurement update (dragging out endpoint)
                const endPointPx = { x: x_px, y: y_px };
                const snappedEnd = getSnappedMeasurementPoint(endPointPx.x, endPointPx.y);
                state.currentMeasureEnd = snappedEnd.meters; // Update the temporary end point { x_met, y_met }
                redraw();
            } else if (measureBtn?.classList.contains("active-tool") && !state.isMeasuring) {
                // Measurement tool is active, but not currently measuring (either before first measurement or after previous measurement ended)
                // Always show preview for potential next measurement start, regardless of state.measureStart
                const snappedStart = getSnappedMeasurementPoint(x_px, y_px);
                // getSnappedMeasurementPoint already updates state.measureSnapAxes
                state.currentMeasureEnd = snappedStart.meters; // Use this as a preview point
                redraw();
            }

            // --- Dragging Update ---
            if (state.isDraggingListener) {
                canvas.style.cursor = "grabbing";
                // Clamp listener position to room boundaries
                state.listener.x = Math.max(
                    0,
                    Math.min(state.room.width, pixelsToMetersCoords(x_px, y_px).x_met),
                );
                state.listener.y = Math.max(
                    0,
                    Math.min(state.room.depth, pixelsToMetersCoords(x_px, y_px).y_met),
                );
                // Update inputs visually during drag
                listenerXInput.value = state.listener.x.toFixed(2);
                listenerYInput.value = state.listener.y.toFixed(2);
                redraw(); // Redraw continuously while dragging listener
            } else if (state.isDraggingSpeaker && state.draggedSpeakerIndex !== -1) {
                canvas.style.cursor = "grabbing";
                // Retrieve the speaker first
                const draggedSpeaker = state.speakers[state.draggedSpeakerIndex];

                // Check if the speaker exists
                if (!draggedSpeaker) {
                    console.error("Error: Trying to drag a non-existent speaker at index", state.draggedSpeakerIndex);
                    // Optionally reset dragging state
                    state.isDraggingSpeaker = false;
                    state.draggedSpeakerIndex = -1;
                    canvas.style.cursor = "default";
                    return; // Stop further processing
                }

                // Dragging a speaker
                // Clamp speaker position to room boundaries (pre-snap)
                const { x_met, y_met } = pixelsToMetersCoords(
                    x_px - state.dragOffsetX,
                    y_px - state.dragOffsetY,
                );
                let clampedX = Math.max(0, Math.min(state.room.width, x_met));
                let clampedY = Math.max(0, Math.min(state.room.depth, y_met));
                // Snap to other speakers at the same Z-level, passing the index to avoid self-snapping
                const snapResult = getSnappedSpeakerPosition(
                    clampedX,
                    clampedY,
                    draggedSpeaker.z ?? 0, // Use the variable, handle undefined z
                    state.draggedSpeakerIndex,
                );
                //console.log("MouseMove Snap Result:", JSON.stringify(snapResult)); // <<< Log snap details

                // Update speaker position using the variable
                draggedSpeaker.x = snapResult.x;
                draggedSpeaker.y = snapResult.y;
                // Update visual snap flag for highlighting the speaker itself
                draggedSpeaker.isSnapped = snapResult.snapped;
                // Store detailed snap info for drawing lines
                state.currentSnapDetails = snapResult;
                //console.log("Stored currentSnapDetails:", JSON.stringify(currentSnapDetails)); // <<< Log stored details

                redraw(); // Redraw continuously while dragging speaker
            } else {
                // Only update cursor if NOT dragging anything
                // PRIORITIZE measurement cursor
                if (measureBtn?.classList.contains("active-tool")) {
                    canvas.style.cursor = "crosshair";
                } else {
                    // Check if over listener
                    const listenerPosPx = metersToPixelsCoords(state.listener.x, state.listener.y);
                    const distToListenerPx = Math.sqrt(
                        (x_px - listenerPosPx.x) ** 2 + (y_px - listenerPosPx.y) ** 2,
                    );
                    let overObject = distToListenerPx <= LISTENER_RADIUS_PX + state.PADDING / 4;

                    // Check if over any speaker
                    if (!overObject) {
                        for (let i = 0; i < state.speakers.length; i++) {
                            const spk = state.speakers[i];
                            const spkPosPx = metersToPixelsCoords(spk?.x ?? 0, spk?.y ?? 0);
                            const distToSpeakerPx = Math.sqrt(
                                (x_px - spkPosPx.x) ** 2 + (y_px - spkPosPx.y) ** 2,
                            );
                            if (distToSpeakerPx <= SPEAKER_RADIUS_PX + 6) {
                                overObject = true;
                                break;
                            }
                        }
                    }

                    if (overObject) {
                        canvas.style.cursor = "grab"; // Use 'grab' for hover, changes to 'grabbing' on mousedown
                    } else if (state.isPlacingSpeaker) {
                        canvas.style.cursor = "crosshair";
                    } else {
                        canvas.style.cursor = "default";
                    }
                }
            }
        });

        canvas.addEventListener("mouseup", () => {
            // Always reset all drag flags
            let wasDragging = state.isDragging || state.isDraggingListener || state.isDraggingSpeaker;
            state.isDraggingListener = false;
            state.isDraggingSpeaker = false;
            state.draggedSpeakerIndex = -1;
            state.isDragging = false;
            state.currentSnapDetails = null; // Clear snap details on mouse up

            // Reset cursor based on mode or hover
            if (state.isPlacingSpeaker) {
                canvas.style.cursor = "crosshair";
            } else if (wasDragging) {
                // If dragging stopped, update cursor based on current tool/hover
                updateCanvasCursor(); // Call helper function
                // Reset temporary measurement points for drawing
                // state.measureStart = null; // Keep for display until next measure starts
                // state.currentMeasureEnd = null; // Keep for display
            } else {
                // If just clicked (no drag), update cursor based on current tool/hover
                updateCanvasCursor(); // Call helper function instead of setting to default
                // Potentially call cursor update function here if it exists
            }

            updateSpeakerList(); // Update list if a speaker was potentially moved
            if (wasDragging) {
                // Redraw if dragging
                redraw(); // Final redraw to remove drag effects
            }

            // No autosave here, rely on redraw's autosave
        });

        canvas.addEventListener("mouseout", (event) => {
            // Always reset all drag flags
            state.isDraggingListener = false;
            state.isDraggingSpeaker = false;
            state.draggedSpeakerIndex = -1;
            state.isDragging = false;
            redraw();
            // Reset cursor if not over canvas anymore
            canvas.style.cursor = "default";
        });

        // Save/Load Button Listeners
        saveDesignBtn?.addEventListener("click", saveDesign);
        loadDesignBtn?.addEventListener("click", () => loadFileInput.click()); // Trigger hidden input
        loadFileInput.addEventListener("change", loadDesign);
        tools.setup();
    });
}
function updateCanvasCursor() {
    if (state.isDraggingListener || state.isDraggingSpeaker) { // Updated to include speaker drag
        canvas.style.cursor = "grabbing";
    } else if (state.isMeasuring || state.isPlacingSpeaker || measureBtn?.classList.contains("active-tool")) { // Added check for active measure tool
        canvas.style.cursor = "crosshair";
    } else {
        // Inactive tool state - could potentially check hover here too for 'grab',
        // but mousemove handles hover states more dynamically.
        canvas.style.cursor = "default";
    }
}

export { setup };
