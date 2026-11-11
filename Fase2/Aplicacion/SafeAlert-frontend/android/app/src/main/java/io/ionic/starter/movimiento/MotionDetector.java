package io.ionic.starter.movimiento;

/** Detector puro: recibe aceleración SIN gravedad en m/s² y tiempo monotónico. */
public final class MotionDetector {
    private final double threshold;
    private final int requiredPeaks;
    private final long windowMs;
    private final long separationMs;
    private int peaks;
    private long firstPeak = -1;
    private long lastPeak = -10000;
    private boolean aboveThreshold;

    public MotionDetector() { this(15.0, 3, 2000, 250); }

    public MotionDetector(double threshold, int requiredPeaks, long windowMs, long separationMs) {
        this.threshold = threshold;
        this.requiredPeaks = requiredPeaks;
        this.windowMs = windowMs;
        this.separationMs = separationMs;
    }

    public boolean sample(double x, double y, double z, long nowMs) {
        if (!Double.isFinite(x) || !Double.isFinite(y) || !Double.isFinite(z)) return false;
        double magnitude = Math.sqrt(x * x + y * y + z * z);
        if (magnitude < threshold * 0.5) aboveThreshold = false;
        if (magnitude < threshold || aboveThreshold) return false;
        aboveThreshold = true;
        if (nowMs - lastPeak < separationMs) return false;
        if (firstPeak < 0 || nowMs - firstPeak > windowMs) {
            peaks = 0;
            firstPeak = nowMs;
        }
        lastPeak = nowMs;
        if (++peaks < requiredPeaks) return false;
        reset();
        aboveThreshold = true;
        return true;
    }

    public void reset() {
        peaks = 0;
        firstPeak = -1;
        aboveThreshold = false;
        lastPeak = -10000;
    }
}
