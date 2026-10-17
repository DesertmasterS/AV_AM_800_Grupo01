package io.ionic.starter.movimiento;

import org.junit.Test;
import static org.junit.Assert.*;

public class MotionLocationPolicyTest {
    @Test public void acceptsRecentPreciseAndApproximateLocations() {
        assertTrue(MotionLocationPolicy.accepts(-33.45, -70.66, 12, 1000));
        assertTrue(MotionLocationPolicy.accepts(-33.45, -70.66, 4000, 30000));
        assertTrue(MotionLocationPolicy.accepts(0, 0, 10, 0));
    }
    @Test public void rejectsStaleFutureAndUnreliableLocations() {
        assertFalse(MotionLocationPolicy.accepts(-33.45, -70.66, 12, 30001));
        assertFalse(MotionLocationPolicy.accepts(-33.45, -70.66, 12, -1));
        assertFalse(MotionLocationPolicy.accepts(-33.45, -70.66, 5001, 1000));
        assertFalse(MotionLocationPolicy.accepts(-33.45, -70.66, 0, 1000));
    }
    @Test public void rejectsInvalidCoordinates() {
        assertFalse(MotionLocationPolicy.accepts(Double.NaN, -70.66, 10, 1000));
        assertFalse(MotionLocationPolicy.accepts(-91, -70.66, 10, 1000));
        assertFalse(MotionLocationPolicy.accepts(-33.45, 181, 10, 1000));
        assertFalse(MotionLocationPolicy.accepts(-33.45, -70.66, Float.NaN, 1000));
    }
}
