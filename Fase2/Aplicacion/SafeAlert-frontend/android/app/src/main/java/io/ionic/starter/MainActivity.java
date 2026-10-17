package io.ionic.starter;

import android.view.KeyEvent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import io.ionic.starter.movimiento.MotionSosPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MotionSosPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN && event.getKeyCode() == KeyEvent.KEYCODE_VOLUME_DOWN) {
            getBridge().getWebView().evaluateJavascript(
                "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'VolumeDown', code: 'VolumeDown' }));",
                null
            );
        }
        return super.dispatchKeyEvent(event);
    }
}
