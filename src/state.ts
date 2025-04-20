import { roomWidthInput, roomDepthInput, roomHeightInput, listenerXInput, listenerYInput, tvSizeInput } from './elements';
import { updateSpeakerList } from './speakers'; 
import { redraw } from '~/draw/draw'; 

// Define the structure for a speaker
export interface Speaker {
  x: number;
  y: number;
  z?: number; // Height coordinate, optional for bed speakers
  type: 'bed' | 'ceiling';
  isSnapped?: boolean; // Optional flag used during placement/drawing
}

// Define structure for coordinate points in meters
export interface PointMeters {
  x_met: number;
  y_met: number;
}

// Define structure for snapping details
interface SnapDetails {
  snapped: boolean;        // Was any snap occurred?
  snappedXTo: number;      // Index of speaker snapped to on X-axis (-1 if none)
  snappedYTo: number;      // Index of speaker snapped to on Y-axis (-1 if none)
  x: number;               // The resulting snapped X coordinate (meters)
  y: number;               // The resulting snapped Y coordinate (meters)
}

// --- Interfaces ---
export interface SnapAxisInfo {
  type: 'vertical' | 'horizontal';
  px: number;
  meters: number;
  source: { x: number; y: number } | Speaker;
}

export interface SnappedPoint {
  meters: PointMeters;
  pixels: { x: number; y: number };
}

const LISTENER_EAR_HEIGHT = 1.2; // Assumed listener ear height in meters

// --- State ---
const state = {
  room: {
    width: 0,
    depth: 0,
    height: 0,
  },
  listener: {
    x: 1.5, // Default position (meters)
    y: 0.7, // Default position (meters)
  },
  tv: {
    x: 1.5, // Default TV position
    y: 0, // Default TV position
    width: 1.6, // Default TV width
    height: 0.9, // Default TV height
  },
  speakers: [] as Speaker[], // Array to hold speaker objects
  isDraggingListener: false,
  isDraggingSpeaker: false,
  draggedSpeakerIndex: -1,
  offsetX: 0, // Initialize offsetX
  offsetY: 0, // Initialize offsetY
  isPlacingSpeaker: false,
  speakerTypeToPlace: null as 'bed' | 'ceiling' | null, // Explicitly type this
  isMeasuring: false,
  measureStart: null as PointMeters | null, // { x_met, y_met } in meters
  measureEnd: null as PointMeters | null, // { x_met, y_met } in meters
  currentMeasureEnd: null as PointMeters | null, // { x_met, y_met } temporary endpoint during mouse move
  measureSnapAxes: [] as SnapAxisInfo[], // Axes the measurement start/end point snapped to ('x' or 'y')
  currentSnapDetails: null as SnapDetails | null, // Holds details about the last speaker snap event
  isDragging: false, // General dragging flag (could be listener or future elements)
  dragOffsetX: 0,
  dragOffsetY: 0,
  scale: 1,
  PADDING: 20, // Initial padding
};

// --- Save/Load Functions ---

function saveDesign() {
  const designData = {
    version: 1, // Add a version number for future compatibility
    room: state.room,
    listener: state.listener,
    tv: state.tv,
    speakers: state.speakers,
  };

  const jsonString = JSON.stringify(designData, null, 2); // Pretty print JSON
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "hometheater_design.json";
  document.body.appendChild(a); // Required for Firefox
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log("Design saved.");
}

function loadDesign(event: Event) {
  // Assert target is an HTMLInputElement and check it exists
  const inputElement = event.target as HTMLInputElement;
  if (!inputElement || !inputElement.files || inputElement.files.length === 0) {
    console.error("Load design event target is not a file input or has no files.");
    return;
  }

  const file = inputElement.files[0]; // Use the asserted element
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const loadedData = JSON.parse(e.target?.result as string);

      // Basic validation
      if (
        loadedData &&
        loadedData.room &&
        loadedData.listener &&
        loadedData.tv &&
        loadedData.speakers
      ) {
        // Update state
        state.room = loadedData.room;
        state.listener = loadedData.listener;
        state.tv.width = loadedData.tv.width; // Restore TV width
        state.speakers = loadedData.speakers;

        // Update input controls (excluding tv.x and tv.y inputs)
        roomWidthInput.value = state.room.width.toString();
        roomDepthInput.value = state.room.depth.toString();
        roomHeightInput.value = state.room.height.toString();
        listenerXInput.value = state.listener.x.toString();
        listenerYInput.value = state.listener.y.toString();
        // tvXInput.value = tv.x; // Don't set directly, redraw will handle
        // tvYInput.value = tv.y; // Don't set directly, redraw will handle
        tvSizeInput.value = state.tv.width.toString();

        // Refresh UI
        updateSpeakerList();
        redraw(); // redraw() might cause runtime error if not defined globally or elsewhere
        console.log("Design loaded successfully.");
      } else {
        alert("Invalid design file format.");
      }
    } catch (error) {
      console.error("Error parsing design file:", error);
      alert("Error reading or parsing design file.");
    }
  };
  reader.onerror = function () {
    alert("Error reading file.");
  };
  reader.readAsText(file);

  // Reset file input value so the same file can trigger 'change' again
  inputElement.value = ""; // Reset with empty string, use asserted element
}

// Add the constant definition
const AUTOSAVE_KEY = "homeTheaterDesignAutosave";

// --- Need to handle input dependencies ---
// The initial values for room dimensions depend on DOM elements:
// roomWidthInput, roomDepthInput, roomHeightInput.
// These elements might not be defined when this module loads.
// Consider initializing these later or passing the elements/values in.
// For now, assuming they exist globally for the initial setup, which is not ideal.
// A better approach would be an init function:

function initState(roomWidth: string, roomDepth: string, roomHeight: string) {
  state.room.width = parseFloat(roomWidth);
  state.room.depth = parseFloat(roomDepth);
  state.room.height = parseFloat(roomHeight);
}

// --- Autosave Functions ---
function autosaveState() {
  // Create a serializable version of the state
  const stateToSave = {
    room: { ...state.room },
    listener: { ...state.listener },
    tv: { width: state.tv.width }, // Only save necessary parts
    speakers: [...state.speakers],
  };
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(stateToSave));
    // console.log("Autosave successful.");
  } catch (e) {
    console.error("Autosave failed:", e);
  }
}

function loadAutosavedState() {
  try {
    const savedStateString = localStorage.getItem(AUTOSAVE_KEY);
    console.log("Attempting to load autosave...");
    if (savedStateString) {
      console.log("Found saved state string:", savedStateString);
      const savedState = JSON.parse(savedStateString);
      console.log("Parsed saved state:", savedState);

      if (
        savedState &&
        savedState.room &&
        savedState.listener &&
        savedState.tv &&
        savedState.speakers
      ) {
        // Restore state variables by updating the properties of the existing state object
        state.room = savedState.room;
        state.listener = savedState.listener;
        state.tv = savedState.tv; // Assign the validated tv object from saved state
        state.speakers = savedState.speakers;

        // --- Removed UI Update Logic ---
        // The calling code (e.g., in main.js) should handle updating
        // input fields and the speaker list after this function returns true.
        // Example:
        // if (loadAutosavedState()) {
        //    updateUIFromState(); // A new function you'd create in main.js/ui.js
        // }

        console.log("Autosaved state loaded successfully into state object.");
        return true; // Indicate success
      } else {
        console.warn("Autosaved data is incomplete or invalid.");
        localStorage.removeItem(AUTOSAVE_KEY);
      }
    } else {
      console.log("No autosaved state found in localStorage.");
    }
  } catch (e) {
    console.error("Failed to load or parse autosaved state:", e);
    localStorage.removeItem(AUTOSAVE_KEY);
  }
  return false; // Indicate failure or no data found
}

export { state, saveDesign, loadDesign, loadAutosavedState, autosaveState, LISTENER_EAR_HEIGHT };
