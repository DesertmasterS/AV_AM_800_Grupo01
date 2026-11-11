package io.ionic.starter.sos;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SosDevice")
public class SosDevicePlugin extends Plugin {
    @PluginMethod
    public void getBattery(PluginCall call) {
        JSObject result = new JSObject();
        Integer percentage = SosBattery.read(getContext());
        if (percentage != null) result.put("bateriaPorcentaje", percentage);
        call.resolve(result);
    }
}
