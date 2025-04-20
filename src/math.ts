
// --- Helper Functions ---
function radiansToDegrees(radians: number): number {
    return radians * (180 / Math.PI);
}

function degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}

function angleDifference(angle1Deg: number, angle2Deg: number): number {
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