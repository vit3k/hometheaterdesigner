import { state, LISTENER_EAR_HEIGHT } from "~/state";
import { speakerListUl } from "~/elements";
import { redraw } from "~/draw/draw";

const SNAP_THRESHOLD_POS_METERS = 0.05; // Meters within which to snap coordinates (REDUCED)

// --- Speaker Placement Snap Function (Meters) ---
// Takes the potential x, y coordinates, the z level, and optionally the index of the speaker being dragged
function getSnappedSpeakerPosition(x: number, y: number, z: number, draggedIndex = -1) {
  let snappedX = x;
  let snappedY = y;
  let didSnap = false;
  let snappedXTo = -1; // Index of speaker causing X snap
  let snappedYTo = -1; // Index of speaker causing Y snap

  // Snap X or Y independently to other speakers on the SAME level
  for (let i = 0; i < state.speakers.length; i++) {
    // Skip comparing the speaker to itself if it's being dragged
    if (i === draggedIndex) {
      continue;
    }

    const speaker = state.speakers[i];
    if (speaker?.z === z) {
      // Check X snap - only update if not already snapped X or closer
      if (Math.abs(x - speaker.x) < SNAP_THRESHOLD_POS_METERS) {
        // Prioritize the closer snap if multiple are within threshold (optional complexity)
        // For simplicity now, just take the first one found
        if (snappedXTo === -1) {
          // Or add logic to find the minimum distance
          snappedX = speaker.x;
          didSnap = true;
          snappedXTo = i;
        }
      }
      // Check Y snap - only update if not already snapped Y or closer
      if (Math.abs(y - speaker.y) < SNAP_THRESHOLD_POS_METERS) {
        if (snappedYTo === -1) {
          // Or add logic to find the minimum distance
          snappedY = speaker.y;
          didSnap = true;
          snappedYTo = i;
        }
      }
    }
  }
  // Return detailed snap info
  return {
    x: snappedX,
    y: snappedY,
    snapped: didSnap,
    snappedXTo: snappedXTo,
    snappedYTo: snappedYTo,
  };
}

function addSpeaker(x: number, y: number, type: 'bed' | 'ceiling' = "bed") {
  // Calculate z first
  const z = type === "ceiling" ? state.room.height : LISTENER_EAR_HEIGHT;
  // Pass z to the snapping function
  const snapResult = getSnappedSpeakerPosition(x, y, z);
  const newSpeaker = {
    x: snapResult.x,
    y: snapResult.y,
    z, // Use the calculated z
    type,
    isSnapped: snapResult.snapped,
  };
  state.speakers.push(newSpeaker);
  updateSpeakerList();
  redraw(); // Trigger full redraw
}

function clearSpeakers() {
  state.speakers = [];
  state.isPlacingSpeaker = false; // Ensure placement modes are off
  updateSpeakerList();
  redraw();
}

function removeSpeaker(index: number) {
  if (index >= 0 && index < state.speakers.length) {
    state.speakers.splice(index, 1); // Remove the speaker at the given index
    updateSpeakerList(); // Refresh the list in the UI
    redraw(); // Update the canvas
    console.log(`Removed speaker at index ${index}`);
  } else {
    console.error(`Invalid index for speaker removal: ${index}`);
  }
}

function updateSpeakerList() {
  // Add null check for the element
  if (!speakerListUl) {
    console.error("Speaker list UL element not found!");
    return; // Exit if the element doesn't exist
  }

  console.log(`updateSpeakerList called. Speakers count: ${state.speakers.length}`); // Add this line
  speakerListUl.innerHTML = ""; // Clear existing list
  const listenerZ = LISTENER_EAR_HEIGHT; // Need listener height here too

  state.speakers.forEach((speaker, index) => {
    const li = document.createElement("li");

    // Calculate distance for list display
    const dx_met = speaker.x - state.listener.x;
    const dy_met = speaker.y - state.listener.y;
    const dz_met = (speaker.z ?? 0) - listenerZ;
    const distance = Math.sqrt(
      dx_met * dx_met + dy_met * dy_met + dz_met * dz_met,
    );

    // Added Z coordinate and distance display
    li.textContent = `Speaker ${index + 1} (${speaker.type.toUpperCase()}): X=${speaker.x.toFixed(2)}, Y=${speaker.y.toFixed(2)}, Z=${(speaker.z ?? 0).toFixed(2)} (Dist: ${distance.toFixed(2)}m) `; // Add space before button

    // Create Remove Button
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.dataset.index = index.toString(); // Store index on the button
    removeBtn.style.marginLeft = "10px"; // Add some spacing
    removeBtn.addEventListener("click", (event) => {
      // Get the index from the button that was clicked
      const indexStr = (event.target as HTMLButtonElement).dataset.index;
      // Ensure the index string exists before parsing
      if (indexStr !== undefined) {
        const indexToRemove = parseInt(indexStr, 10);
        removeSpeaker(indexToRemove);
      } else {
        console.error("Could not find index on remove button.");
      }
    });

    li.appendChild(removeBtn); // Add button to the list item
    speakerListUl?.appendChild(li);
  });
}

export { updateSpeakerList, removeSpeaker, addSpeaker, clearSpeakers, getSnappedSpeakerPosition};
