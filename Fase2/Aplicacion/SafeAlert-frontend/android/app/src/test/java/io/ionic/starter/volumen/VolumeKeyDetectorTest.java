package io.ionic.starter.volumen;

import org.junit.Test;
import static org.junit.Assert.*;

public class VolumeKeyDetectorTest {
    @Test public void detectsThreePressesOfEitherButton() {
        for (int key : new int[]{24, 25}) {
            VolumeKeyDetector detector = new VolumeKeyDetector();
            assertFalse(detector.sample(100, key, 0));
            assertFalse(detector.sample(400, key, 0));
            assertTrue(detector.sample(700, key, 0));
        }
    }
    @Test public void countsTheSamePhysicalEventOnlyOnce() {
        VolumeKeyDetector detector = new VolumeKeyDetector();
        assertFalse(detector.sample(100, 25, 0));
        assertFalse(detector.sample(100, 25, 0));
        assertFalse(detector.sample(400, 25, 0));
        assertFalse(detector.sample(400, 25, 0));
        assertTrue(detector.sample(700, 25, 0));
        assertFalse(detector.sample(700, 25, 0));
    }
    @Test public void ignoresLongPressAutoRepeatAndOtherKeys() {
        VolumeKeyDetector detector = new VolumeKeyDetector();
        assertFalse(detector.sample(100, 25, 0));
        assertFalse(detector.sample(400, 25, 1));
        assertFalse(detector.sample(700, 25, 2));
        assertFalse(detector.sample(800, 26, 0));
        assertFalse(detector.sample(900, 25, 0));
        assertTrue(detector.sample(1000, 25, 0));
    }
    @Test public void resetsAfterWindowOrButtonChange() {
        VolumeKeyDetector detector = new VolumeKeyDetector();
        assertFalse(detector.sample(100, 25, 0));
        assertFalse(detector.sample(400, 25, 0));
        assertFalse(detector.sample(2300, 25, 0));
        assertFalse(detector.sample(2400, 24, 0));
        assertFalse(detector.sample(2500, 24, 0));
        assertTrue(detector.sample(2600, 24, 0));
    }
    @Test public void preventsAnotherAlertForThirtySeconds() {
        VolumeKeyDetector detector = new VolumeKeyDetector();
        detector.sample(100, 25, 0); detector.sample(400, 25, 0);
        assertTrue(detector.sample(700, 25, 0));
        assertFalse(detector.sample(800, 25, 0));
        assertFalse(detector.sample(900, 25, 0));
        assertFalse(detector.sample(1000, 25, 0));
        assertFalse(detector.sample(31000, 25, 0));
        assertFalse(detector.sample(31300, 25, 0));
        assertTrue(detector.sample(31600, 25, 0));
    }
}
