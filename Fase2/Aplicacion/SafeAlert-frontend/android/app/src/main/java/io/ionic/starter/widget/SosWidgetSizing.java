package io.ionic.starter.widget;

/** Reserva espacio para el estado y usa siempre el mismo ancho y alto para el SOS. */
public final class SosWidgetSizing {
    private SosWidgetSizing() {}
    public static int diameter(int width, int height) {
        if (width <= 0 || height <= 0) return 60;
        int available = Math.min(width - 24 - Math.max(56, Math.round(width * 0.38f)), height - 52);
        for (int size : new int[]{144, 120, 96, 76}) if (available >= size) return size;
        return 60;
    }
}
