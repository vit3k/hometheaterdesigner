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
  speakers: [], // Array to hold speaker objects {x, y, type: 'bed'/'ceiling'}
  isDraggingListener: false,
  isDraggingSpeaker: false,
  draggedSpeakerIndex: -1,
  offsetX: 0, // Initialize offsetX
  offsetY: 0, // Initialize offsetY
  isPlacingSpeaker: false,
  speakerTypeToPlace: null, // 'bed' or 'ceiling'
  isMeasuring: false,
  measureStart: null, // { x_met, y_met } in meters
  measureEnd: null, // { x_met, y_met } in meters
  currentMeasureEnd: null, // { x_met, y_met } temporary endpoint during mouse move
  isDragging: false, // General dragging flag (could be listener or future elements)
  dragOffsetX: 0,
  dragOffsetY: 0,
  scale: 1,
  PADDING: 50, // Initial padding
  currentSnapDetails: null, // Stores {x, y, snapped, snappedXTo, snappedYTo} during drag
};

// --- Save/Load Functions ---

function saveDesign() {
  const designData = {
    version: 1, // Add a version number for future compatibility
    room: room,
    listener: listener,
    tv: tv,
    speakers: speakers,
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

function loadDesign(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const loadedData = JSON.parse(e.target.result);

      // Basic validation
      if (
        loadedData &&
        loadedData.room &&
        loadedData.listener &&
        loadedData.tv &&
        loadedData.speakers
      ) {
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
  reader.onerror = function () {
    alert("Error reading file.");
  };
  reader.readAsText(file);

  // Reset file input value so the same file can trigger 'change' again
  event.target.value = null;
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

function initState(roomWidth, roomDepth, roomHeight) {
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
        // Ensure tv object exists before assigning width
        if (!state.tv) state.tv = {};
        state.tv.width = savedState.tv.width;
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
