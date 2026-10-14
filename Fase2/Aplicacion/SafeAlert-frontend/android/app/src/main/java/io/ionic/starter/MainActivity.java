package io.ionic.starter;

import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int action = event.getAction();
        int keyCode = event.getKeyCode();

        // 1. Detectar si la tecla pulsada es Bajar Volumen
        if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            // 2. Solo procesar el evento al presionar
            if (action == KeyEvent.ACTION_DOWN) {
                // 3. Inyectar el evento directamente al WebView de Angular
                this.getBridge().getWebView().post(new Runnable() {
                    @Override
                    public void run() {
                        bridge.getWebView().evaluateJavascript(
                            "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'VolumeDown', code: 'VolumeDown' }));",
                            null
                        );
                    }
                });
            }
            // 
            return true;
        }

        return super.dispatchKeyEvent(event);
    }
}