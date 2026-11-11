package io.ionic.starter.volumen;

import android.accessibilityservice.AccessibilityService;
import android.view.KeyEvent;
import android.view.accessibility.AccessibilityEvent;

/** Solo observa botones: no obtiene texto, nodos ni contenido de otras pantallas. */
public class VolumeAccessibilityService extends AccessibilityService {
    public static volatile boolean connected;
    @Override protected void onServiceConnected() { connected = true; }
    @Override protected boolean onKeyEvent(KeyEvent event) {
        if (((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) && event.getRepeatCount() == 0
            && (event.getKeyCode() == KeyEvent.KEYCODE_VOLUME_UP || event.getKeyCode() == KeyEvent.KEYCODE_VOLUME_DOWN)) {
            android.os.PowerManager power = (android.os.PowerManager) getSystemService(POWER_SERVICE);
            android.util.Log.d("SafeAlertDiagnostics", "volume key=" + event.getKeyCode()
                + " action=" + event.getAction() + " interactive=" + power.isInteractive());
        }
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
