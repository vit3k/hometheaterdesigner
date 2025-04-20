import { addSpeakerBtn, addCeilingSpeakerBtn, measureBtn, clearSpeakersBtn, buttons } from "./elements";
import { state } from "./state";
import { canvas, redraw } from "./draw/draw";
import { clearSpeakers } from "./speakers";

// --- Helper function to manage tool activation states ---
const toolCursors = {
    bed: "crosshair",
    ceiling: "crosshair",
    measure: "crosshair",
};

function setActiveTool(buttonToActivate: HTMLButtonElement | null) {
    // Removed 'activate' parameter
    // Determine tool name early, handle null case
    const toolName = buttonToActivate ? buttonToActivate.dataset.tool : null;
    console.log(`setActiveTool called for: ${toolName || "null (deactivation)"}`);

    // 1. Reset ALL internal tool states first
    const wasMeasuring = state.isMeasuring; // Remember if we need to redraw for clearing lines
    state.isPlacingSpeaker = false;
    state.speakerTypeToPlace = null; // 'bed' or 'ceiling'
    state.isMeasuring = false;
    state.measureStart = null; // { x_met, y_met } in meters
    state.measureEnd = null; // { x_met, y_met } in meters
    state.currentMeasureEnd = null; // { x_met, y_met } temporary endpoint during mouse move
    state.isDraggingListener = false;
    state.isDraggingSpeaker = false; // Declare globally
    state.draggedSpeakerIndex = -1; // Declare globally
    state.isDragging = false;
    // Reset other tool states here if added later

    // 2. Update Visuals: Clear all buttons first
    buttons.forEach((btn) => {
        console.log(`Attempting to remove active-tool from: ${btn.id}`); // DEBUG
        btn.classList.remove("active-tool");
    });

    // 3. Activate the target tool's state and visuals (if activating)
    // if (activate) { // No longer use activate flag
    if (buttonToActivate) {
        // const toolName = buttonToActivate.dataset.tool; // Already determined above
        buttonToActivate.classList.add("active-tool");
        // Set cursor based on tool type, ensure toolName is valid key
        const cursorStyle = toolName && toolName in toolCursors
            ? toolCursors[toolName as keyof typeof toolCursors] // Assert toolName is a key
            : "default";
        canvas.style.cursor = cursorStyle;

        // Set internal state for the activated tool
        if (toolName === "bed" || toolName === "ceiling") {
            state.isPlacingSpeaker = true;
            state.speakerTypeToPlace = toolName;
        } else if (toolName === "measure") {
            // isMeasuring = true; // REMOVE: Let mousedown handle setting this on first click
        }
    } else {
        // Deactivating all tools (buttonToActivate is null)
        console.log("Deactivating all tools explicitly.");
        canvas.style.cursor = "default";
        // Internal states already reset in step 1
    }

    // 4. Redraw if measurement was active and is now cleared OR unconditionally
    if (wasMeasuring && !state.isMeasuring) {
        redraw();
    }
    redraw(); // Redraw unconditionally to reflect tool state changes
}

function setup() {
    // Add event listeners to buttons
    addSpeakerBtn?.addEventListener("click", () => {
        const isCurrentlyActive = addSpeakerBtn?.classList.contains("active-tool");
        setActiveTool(isCurrentlyActive ? null : addSpeakerBtn);
    });
    addCeilingSpeakerBtn?.addEventListener("click", () => {
        const isCurrentlyActive =
            addCeilingSpeakerBtn?.classList.contains("active-tool");
        setActiveTool(isCurrentlyActive ? null : addCeilingSpeakerBtn);
    });

    // Attach clearSpeakers event to button
    clearSpeakersBtn?.addEventListener("click", clearSpeakers);
    measureBtn?.addEventListener("click", () => {
        const isCurrentlyActive = measureBtn?.classList.contains("active-tool");
        setActiveTool(isCurrentlyActive ? null : measureBtn);
    });
}

export { setActiveTool, setup };