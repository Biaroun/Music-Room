const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

// Distance en metres entre deux points (lat/lng en degres). Suffisant pour un
// controle "suis-je dans un rayon de X metres" : pas besoin de PostGIS pour ca.
export function haversineDistanceMeters(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
): number {
    const dLat = toRadians(b.latitude - a.latitude);
    const dLng = toRadians(b.longitude - a.longitude);
    const lat1 = toRadians(a.latitude);
    const lat2 = toRadians(b.latitude);

    const h =
        Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return EARTH_RADIUS_METERS * c;
}
