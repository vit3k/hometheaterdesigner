
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

export {
    radiansToDegrees,
    degreesToRadians,
    angleDifference
}