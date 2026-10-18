package io.ionic.starter.sos;

import org.junit.Test;
import static org.junit.Assert.*;

public class SosLocationPolicyTest {
    @Test public void acceptsRecentPreciseAndApproximateLocations() {
        assertTrue(SosLocationPolicy.accepts(-33.45, -70.66, 12, 1000));
        assertTrue(SosLocationPolicy.accepts(-33.45, -70.66, 4000, 30000));
        assertTrue(SosLocationPolicy.accepts(0, 0, 10, 0));
    }
    @Test public void rejectsStaleFutureAndUnreliableLocations() {
        assertFalse(SosLocationPolicy.accepts(-33.45, -70.66, 12, 30001));
        assertFalse(SosLocationPolicy.accepts(-33.45, -70.66, 12, -1));
        assertFalse(SosLocationPolicy.accepts(-33.45, -70.66, 5001, 1000));
        assertFalse(SosLocationPolicy.accepts(-33.45, -70.66, 0, 1000));
    }
    @Test public void rejectsInvalidCoordinates() {
        assertFalse(SosLocationPolicy.accepts(Double.NaN, -70.66, 10, 1000));
        assertFalse(SosLocationPolicy.accepts(-91, -70.66, 10, 1000));
        assertFalse(SosLocationPolicy.accepts(-33.45, 181, 10, 1000));
        assertFalse(SosLocationPolicy.accepts(-33.45, -70.66, Float.NaN, 1000));
    }
}
