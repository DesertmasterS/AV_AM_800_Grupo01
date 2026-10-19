package io.ionic.starter.volumen;

/** Tres pulsaciones del mismo botón, sin autorrepeticiones ni eventos duplicados de accesibilidad. */
public final class VolumeKeyDetector {
    private long firstPress = -1, lastEvent = -1, mutedUntil;
    private int count, button = -1, lastButton = -1;
    public boolean sample(long time, int key, int repeats) {
        if (repeats != 0 || (key != 24 && key != 25) || time < mutedUntil) return false;
        if (time == lastEvent && key == lastButton) return false;
        lastEvent = time; lastButton = key;
        if (firstPress < 0 || key != button || time < firstPress || time - firstPress > 2000) {
            firstPress = time; count = 0; button = key;
        }
        if (++count < 3) return false;
        firstPress = -1; count = 0; mutedUntil = time + 30000;
        return true;
    }
}
