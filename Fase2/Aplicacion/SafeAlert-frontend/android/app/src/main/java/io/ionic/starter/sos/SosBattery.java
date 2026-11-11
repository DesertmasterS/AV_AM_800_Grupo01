package io.ionic.starter.sos;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;

/** Batería del teléfono emisor. No requiere permisos y admite 0% como lectura válida. */
public final class SosBattery {
    private SosBattery() {}

    public static Integer read(Context context) {
        try {
            Intent battery = context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (battery == null) return null;
            int level = battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
            if (level < 0 || scale <= 0 || level > scale) return null;
            return Math.round(100f * level / scale);
        } catch (RuntimeException ignored) {
            return null; // Nunca impedir el SOS por una lectura de batería fallida.
        }
    }
}
