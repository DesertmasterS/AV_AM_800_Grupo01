package io.ionic.starter.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SosWidget")
public class SosWidgetPlugin extends Plugin {
    @PluginMethod public void requestPin(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
            boolean supported = Build.VERSION.SDK_INT >= 26 && manager.isRequestPinAppWidgetSupported();
            boolean requested = supported && manager.requestPinAppWidget(new ComponentName(getContext(), SosWidgetProvider.class), null, null);
            JSObject result = new JSObject(); result.put("requested", requested);
            call.resolve(result);
        });
    }
    @PluginMethod public void refresh(PluginCall call) {
        SosWidgetProvider.refresh(getContext()); call.resolve();
    }
}
