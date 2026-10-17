package io.ionic.starter.movimiento;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Looper;
import android.os.SystemClock;
import androidx.core.content.ContextCompat;

/** Captura acotada a la prealerta. Todas las llamadas se realizan en el hilo principal. */
final class MotionLocationCapture implements LocationListener {
    private final LocationManager manager;
    private Location best;
    private boolean listening;

    MotionLocationCapture(Context context) {
        manager = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
    }

    static boolean hasPermission(Context context) {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    void start() {
        stop();
        best = null;
        if (manager == null) return;
        for (String provider : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
            try {
                if (!manager.isProviderEnabled(provider)) continue;
                // Solo se acepta caché reciente; nunca una última posición de hace horas.
                onLocationChanged(manager.getLastKnownLocation(provider));
                manager.requestLocationUpdates(provider, 1000L, 0f, this, Looper.getMainLooper());
                listening = true;
            } catch (SecurityException | IllegalArgumentException ignored) {
                // Permiso aproximado, proveedor ausente o permiso revocado: probar el siguiente.
            }
        }
    }

    Location finish() {
        stop();
        Location result = acceptable(best) ? new Location(best) : null;
        best = null;
        return result;
    }

    void cancel() { stop(); best = null; }

    private void stop() {
        if (manager != null && listening) {
            try { manager.removeUpdates(this); } catch (SecurityException ignored) { }
        }
        listening = false;
    }

    private boolean acceptable(Location location) {
        if (location == null || !location.hasAccuracy()) return false;
        long age = (SystemClock.elapsedRealtimeNanos() - location.getElapsedRealtimeNanos()) / 1000000L;
        return MotionLocationPolicy.accepts(location.getLatitude(), location.getLongitude(), location.getAccuracy(), age);
    }

    @Override public void onLocationChanged(Location location) {
        if (acceptable(location) && (!acceptable(best) || location.getAccuracy() <= best.getAccuracy())) {
            best = new Location(location);
        }
    }
    @Override public void onProviderEnabled(String provider) { }
    @Override public void onProviderDisabled(String provider) { }
    @Override public void onStatusChanged(String provider, int status, Bundle extras) { }
}
