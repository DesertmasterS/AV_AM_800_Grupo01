package io.ionic.starter.movimiento;

import org.junit.Test;
import static org.junit.Assert.*;

public class MotionDetectorTest {
    @Test public void threeSeparatedPeaksTriggerOneEvent() {
        MotionDetector detector = new MotionDetector();
        assertFalse(detector.sample(20, 0, 0, 1000));
        detector.sample(0, 0, 0, 1100);
        assertFalse(detector.sample(-20, 0, 0, 1400));
        detector.sample(0, 0, 0, 1500);
        assertTrue(detector.sample(20, 0, 0, 1800));
        detector.sample(0, 0, 0, 1900);
        assertFalse(detector.sample(20, 0, 0, 2200));
    }
    @Test public void sustainedAccelerationIsNotThreePeaks() {
        MotionDetector detector = new MotionDetector();
        for (long time = 1000; time < 5000; time += 50) assertFalse(detector.sample(20, 0, 0, time));
    }
    @Test public void slowOrWeakMovementDoesNotTrigger() {
        MotionDetector detector = new MotionDetector();
        for (long time = 1000; time < 6000; time += 50) assertFalse(detector.sample(2, 3, 4, time));
        assertFalse(detector.sample(20, 0, 0, 6000));
        detector.sample(0, 0, 0, 6100);
        assertFalse(detector.sample(20, 0, 0, 9000));
        detector.sample(0, 0, 0, 9100);
        assertFalse(detector.sample(20, 0, 0, 12000));
        assertFalse(detector.sample(Double.NaN, 0, 0, 13000));
    }
}
