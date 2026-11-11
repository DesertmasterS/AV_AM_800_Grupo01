package io.ionic.starter.widget;
import org.junit.Test;
import static org.junit.Assert.*;
public class SosWidgetSizingTest {
    @Test public void keepsCompactButtonAndFallsBackBeforeLauncherProvidesSize() {
        assertEquals(60, SosWidgetSizing.diameter(140, 110));
        assertEquals(60, SosWidgetSizing.diameter(0, 0));
    }
    @Test public void growsWhenBothDimensionsHaveRoom() {
        assertTrue(SosWidgetSizing.diameter(240, 160) > SosWidgetSizing.diameter(200, 110));
        assertTrue(SosWidgetSizing.diameter(400, 300) > SosWidgetSizing.diameter(240, 160));
    }
    @Test public void respectsShortWidgetsAndLeavesRoomForStatus() {
        assertEquals(60, SosWidgetSizing.diameter(400, 110));
        assertEquals(60, SosWidgetSizing.diameter(140, 400));
        for (int width = 140; width <= 600; width += 20) for (int height = 120; height <= 500; height += 20) {
            int diameter = SosWidgetSizing.diameter(width, height);
            assertTrue(diameter <= height - 52);
            assertTrue(diameter + 24 + Math.max(56, Math.round(width * 0.38f)) <= width);
        }
    }
}
