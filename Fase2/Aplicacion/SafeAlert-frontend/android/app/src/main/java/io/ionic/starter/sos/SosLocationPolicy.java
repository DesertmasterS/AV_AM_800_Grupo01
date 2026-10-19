package io.ionic.starter.sos;

/** Admite ubicación aproximada y rechaza posiciones antiguas o inválidas. */
public final class SosLocationPolicy {
    public static boolean accepts(double latitude, double longitude, float accuracy, long ageMillis) {
        return Double.isFinite(latitude) && latitude >= -90 && latitude <= 90
            && Double.isFinite(longitude) && longitude >= -180 && longitude <= 180
            && Float.isFinite(accuracy) && accuracy > 0 && accuracy <= 5000
            && ageMillis >= 0 && ageMillis <= 30000;
    }
}
