package io.ionic.starter.volumen;

import android.content.Context;
import android.view.KeyEvent;

/** Un único contador para MainActivity y el servicio de accesibilidad dentro del mismo proceso. */
public final class VolumeKeyRouter {
    private static final VolumeKeyDetector detector = new VolumeKeyDetector();
    public static void handle(Context context, KeyEvent event, boolean foreground) {
        if (event.getAction() != KeyEvent.ACTION_DOWN || VolumeProtectionService.isBusy()) return;
        if (!foreground && !VolumeProtectionService.isSessionActive()) return;
        if (detector.sample(event.getEventTime(), event.getKeyCode(), event.getRepeatCount())) {
            VolumeProtectionService.dispatch(context, foreground);
        }
    }
}
