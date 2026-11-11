package io.ionic.starter;

import io.ionic.starter.sos.SosDevicePlugin;
import io.ionic.starter.widget.SosWidgetPlugin;
import android.view.KeyEvent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import io.ionic.starter.movimiento.MotionSosPlugin;
import io.ionic.starter.volumen.VolumeSosPlugin;
import io.ionic.starter.volumen.VolumeKeyRouter;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SosWidgetPlugin.class);
        registerPlugin(SosDevicePlugin.class);
        registerPlugin(MotionSosPlugin.class);
        registerPlugin(VolumeSosPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        VolumeKeyRouter.handle(this, event, true);
        return super.dispatchKeyEvent(event);
    }
}
