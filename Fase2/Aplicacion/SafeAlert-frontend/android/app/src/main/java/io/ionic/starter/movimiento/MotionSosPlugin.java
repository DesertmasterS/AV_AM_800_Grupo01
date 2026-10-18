package io.ionic.starter.movimiento;

import io.ionic.starter.sos.SosLocationCapture;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.os.Build;
import android.util.Base64;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import android.content.pm.ApplicationInfo;
import org.json.JSONObject;
import java.net.URI;

@CapacitorPlugin(name = "MotionSos", permissions = {
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }),
    @Permission(alias = "location", strings = { Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION })
})
public class MotionSosPlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationsResult");
            return;
        }
        requestLocation(call);
    }

    @PermissionCallback
    private void notificationsResult(PluginCall call) {
        if (getPermissionState("notifications") == PermissionState.GRANTED) requestLocation(call);
        else call.reject("Debes permitir las notificaciones para poder cancelar una prealerta.");
    }

    private void requestLocation(PluginCall call) {
        if (!SosLocationCapture.hasPermission(getContext()) && getPermissionState("location") != PermissionState.DENIED) {
            requestPermissionForAlias("location", call, "locationResult");
            return;
        }
        launch(call);
    }

    @PermissionCallback
    private void locationResult(PluginCall call) {
        // Rechazar ubicación no impide proteger con el acelerómetro.
        launch(call);
    }

    private void launch(PluginCall call) {
        try {
            if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
                call.reject("Activa las notificaciones de SafeAlert en los ajustes de Android.");
                return;
            }
            NotificationManager manager = getContext().getSystemService(NotificationManager.class);
            if (Build.VERSION.SDK_INT >= 26 && manager.getNotificationChannel(MotionSosService.CHANNEL) != null
                && manager.getNotificationChannel(MotionSosService.CHANNEL).getImportance() == NotificationManager.IMPORTANCE_NONE) {
                call.reject("El canal de detección por movimiento está bloqueado en Android.");
                return;
            }
            SensorManager sensors = (SensorManager) getContext().getSystemService(android.content.Context.SENSOR_SERVICE);
            if (sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) == null) {
                call.reject("Este dispositivo no tiene acelerómetro disponible.");
                return;
            }
            String token = call.getString("token", "");
            String endpoint = call.getString("endpoint", "");
            String owner = call.getString("usuarioId", "");
            URI uri = new URI(endpoint);
            boolean secure = "https".equalsIgnoreCase(uri.getScheme());
            boolean debug = (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
            if ((!secure && !(debug && "http".equalsIgnoreCase(uri.getScheme())))
                || uri.getHost() == null || uri.getUserInfo() != null || uri.getFragment() != null || uri.getQuery() != null) {
                call.reject("Configura una URL absoluta HTTPS para el backend.");
                return;
            }
            String[] parts = token.split("\\.");
            if (parts.length != 3) throw new IllegalArgumentException();
            JSONObject payload = new JSONObject(new String(Base64.decode(parts[1], Base64.URL_SAFE | Base64.NO_WRAP), java.nio.charset.StandardCharsets.UTF_8));
            long expiresAt = payload.getLong("exp") * 1000L;
            if (!owner.equals(String.valueOf(payload.get("sub"))) || expiresAt < System.currentTimeMillis() + 30000L) {
                call.reject("Inicia sesión de nuevo antes de activar la detección.");
                return;
            }
            // Comprobación local de consistencia; la firma y autorización las valida el backend.
            SharedPreferences auth = getContext().getSharedPreferences("CapacitorStorage", 0);
            if (!token.equals(auth.getString("jwt_token", null))) {
                call.reject("La sesión nativa todavía no está sincronizada. Vuelve a intentarlo.");
                return;
            }
            if (getActivity() == null || !getActivity().getLifecycle().getCurrentState().isAtLeast(androidx.lifecycle.Lifecycle.State.STARTED)) {
                call.reject("Activa la detección desde SafeAlert visible en pantalla.");
                return;
            }
            Intent intent = new Intent(getContext(), MotionSosService.class);
            intent.putExtra("locationEnabled", SosLocationCapture.hasPermission(getContext()));
            intent.putExtra("token", token);
            intent.putExtra("endpoint", endpoint);
            intent.putExtra("owner", owner);
            intent.putExtra("expiresAt", expiresAt);
            ContextCompat.startForegroundService(getContext(), intent);
            call.resolve();
        } catch (Exception ignored) {
            call.reject("No se pudo activar la detección. Abre SafeAlert y comprueba tu sesión.");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), MotionSosService.class));
        getContext().getSharedPreferences(MotionSosService.PREFS, 0).edit()
            .remove("eventId").remove("eventCreatedAt").remove("eventOwner").remove("eventEndpoint").remove("eventLatitude").remove("eventLongitude")
            .putString("message", "Detección desactivada.").apply();
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        if (MotionSosService.running) {
            Intent intent = new Intent(getContext(), MotionSosService.class).setAction(MotionSosService.CANCEL);
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject status = new JSObject();
        status.put("active", MotionSosService.running);
        status.put("phase", MotionSosService.running ? MotionSosService.phase : "inactive");
        status.put("deadline", MotionSosService.deadline);
        status.put("sessionEndsAt", MotionSosService.sessionEndsAt);
        SharedPreferences state = getContext().getSharedPreferences(MotionSosService.PREFS, 0);
        status.put("message", !MotionSosService.running && state.getBoolean("wasRunning", false)
            ? "El monitoreo se interrumpió. Activa nuevamente la detección desde SafeAlert."
            : state.getString("message", ""));
        call.resolve(status);
    }
}
