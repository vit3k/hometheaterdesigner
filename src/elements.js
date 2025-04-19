
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
const buttons = document.querySelectorAll('.tool-button'); //

export { roomWidthInput, roomDepthInput, roomHeightInput, listenerXInput, listenerYInput, tvXInput, tvYInput, tvSizeInput, addSpeakerBtn, addCeilingSpeakerBtn, clearSpeakersBtn, speakerListUl, saveDesignBtn, loadDesignBtn, loadFileInput, measureBtn, distFrontSpan, distBackSpan, buttons };
