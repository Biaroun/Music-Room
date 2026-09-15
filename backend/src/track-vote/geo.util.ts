// mean radius of the earth
const EARTH_RADIUS_METERS = 6_371_000;

// degrees to radians
function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

// distance en metres entre deux points en degres. suffisant pour un controle
// de rayon, pas besoin de postgis
export function haversineDistanceMeters(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
): number {
    const dLat = toRadians(b.latitude - a.latitude);
    const dLng = toRadians(b.longitude - a.longitude);
    const lat1 = toRadians(a.latitude);
    const lat2 = toRadians(b.latitude);

    // haversine formula (h then c = angle between the 2 points)
    const h =
        Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return EARTH_RADIUS_METERS * c;
}
