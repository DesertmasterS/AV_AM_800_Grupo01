package io.ionic.starter.volumen;

import android.accessibilityservice.AccessibilityService;
import android.view.KeyEvent;
import android.view.accessibility.AccessibilityEvent;

/** Solo observa botones: no obtiene texto, nodos ni contenido de otras pantallas. */
public class VolumeAccessibilityService extends AccessibilityService {
    public static volatile boolean connected;
    @Override protected void onServiceConnected() { connected = true; }
    @Override protected boolean onKeyEvent(KeyEvent event) {
        VolumeKeyRouter.handle(this, event, false);
        return false;
    }
    @Override public void onAccessibilityEvent(AccessibilityEvent event) { }
    @Override public void onInterrupt() { }
    @Override public void onDestroy() {
        connected = false;
        if (VolumeProtectionService.isSessionActive()) VolumeProtectionService.stop(this);
        super.onDestroy();
    }
}
