// --- DOM Elements ---
const roomWidthInput = document.getElementById('room-width') as HTMLInputElement;
const roomDepthInput = document.getElementById('room-depth') as HTMLInputElement;
const roomHeightInput = document.getElementById('room-height') as HTMLInputElement;
const listenerXInput = document.getElementById('listener-x') as HTMLInputElement;
const listenerYInput = document.getElementById('listener-y') as HTMLInputElement;
const tvXInput = document.getElementById('tv-x') as HTMLInputElement;
const tvYInput = document.getElementById('tv-y') as HTMLInputElement;
const tvSizeInput = document.getElementById('tv-size') as HTMLInputElement;
const addSpeakerBtn = document.getElementById('add-speaker-btn') as HTMLButtonElement | null;
const addCeilingSpeakerBtn = document.getElementById('add-ceiling-speaker-btn') as HTMLButtonElement | null;
const clearSpeakersBtn = document.getElementById('clear-speakers-btn');
const speakerListUl = document.getElementById('speaker-list');
const saveDesignBtn = document.getElementById('save-design-btn');
const loadDesignBtn = document.getElementById('load-design-btn');
const loadFileInput = document.getElementById('load-file-input') as HTMLInputElement;
const measureBtn = document.getElementById('measure-btn') as HTMLButtonElement | null;
const distFrontSpan = document.getElementById('dist-front');
const distBackSpan = document.getElementById('dist-back');
// --- Group Tool Buttons ---
const buttons = document.querySelectorAll('.tool-button'); //

export { roomWidthInput, roomDepthInput, roomHeightInput, listenerXInput, listenerYInput, tvXInput, tvYInput, tvSizeInput, addSpeakerBtn, addCeilingSpeakerBtn, clearSpeakersBtn, speakerListUl, saveDesignBtn, loadDesignBtn, loadFileInput, measureBtn, distFrontSpan, distBackSpan, buttons };
