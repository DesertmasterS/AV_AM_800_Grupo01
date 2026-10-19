package io.ionic.starter.volumen;

import android.Manifest;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.accessibility.AccessibilityManager;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.location.LocationManagerCompat;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import io.ionic.starter.sos.SosLocationCapture;
import io.ionic.starter.sos.SosSession;

@CapacitorPlugin(name = "VolumeSos", permissions = {
    @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS}),
    @Permission(alias = "location", strings = {Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION})
})
public class VolumeSosPlugin extends Plugin {
    private boolean accessibilityEnabled() {
        AccessibilityManager manager = (AccessibilityManager) getContext().getSystemService(android.content.Context.ACCESSIBILITY_SERVICE);
        for (AccessibilityServiceInfo info : manager.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)) {
            android.content.pm.ServiceInfo service = info.getResolveInfo().serviceInfo;
            if (getContext().getPackageName().equals(service.packageName) && "io.ionic.starter.VolumeSosService".equals(service.name)) return true;
        }
        return false;
    }
    private boolean notificationsEnabled() {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) return false;
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        return Build.VERSION.SDK_INT < 26 || manager.getNotificationChannel(VolumeProtectionService.CHANNEL) == null
            || manager.getNotificationChannel(VolumeProtectionService.CHANNEL).getImportance() != NotificationManager.IMPORTANCE_NONE;
    }
    @PluginMethod public void getStatus(PluginCall call) {
        JSObject status = new JSObject();
        status.put("active", VolumeProtectionService.isSessionActive());
        status.put("phase", VolumeProtectionService.phase());
        status.put("sessionEndsAt", VolumeProtectionService.endsAt());
        status.put("accessibilityEnabled", accessibilityEnabled());
        status.put("accessibilityConnected", VolumeAccessibilityService.connected);
        status.put("locationGranted", SosLocationCapture.hasPermission(getContext()));
        status.put("locationEnabled", VolumeProtectionService.locationEnabled());
        status.put("notificationsGranted", notificationsEnabled());
        LocationManager locations = (LocationManager) getContext().getSystemService(android.content.Context.LOCATION_SERVICE);
        status.put("gpsEnabled", locations != null && LocationManagerCompat.isLocationEnabled(locations));
        status.put("message", getContext().getSharedPreferences(VolumeProtectionService.PREFS, 0).getString("message", ""));
        call.resolve(status);
    }
    @PluginMethod public void configurePermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED && getPermissionState("notifications") != PermissionState.DENIED) {
            requestPermissionForAlias("notifications", call, "notificationResult"); return;
        }
        requestLocation(call);
    }
    @PermissionCallback private void notificationResult(PluginCall call) { requestLocation(call); }
    private void requestLocation(PluginCall call) {
        if (!SosLocationCapture.hasPermission(getContext()) && getPermissionState("location") != PermissionState.DENIED) {
            requestPermissionForAlias("location", call, "locationResult"); return;
        }
        call.resolve();
    }
    @PermissionCallback private void locationResult(PluginCall call) { call.resolve(); }
    @PluginMethod public void openAccessibilitySettings(PluginCall call) {
        try { getActivity().startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)); call.resolve(); }
        catch (RuntimeException ignored) { call.reject("No se pudo abrir Accesibilidad. Busca SafeAlert en los ajustes de Android."); }
    }
    @PluginMethod public void openAppSettings(PluginCall call) {
        try { getActivity().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()))); call.resolve(); }
        catch (RuntimeException ignored) { call.reject("No se pudieron abrir los permisos de SafeAlert."); }
    }
    @PluginMethod public void start(PluginCall call) {
        try {
            if (getActivity() == null || !getActivity().getLifecycle().getCurrentState().isAtLeast(androidx.lifecycle.Lifecycle.State.STARTED)) {
                call.reject("Activa la protección desde SafeAlert visible en pantalla."); return;
            }
            SosSession.read(getContext());
            if (!notificationsEnabled()) { call.reject("Permite las notificaciones de SafeAlert antes de activar la sesión."); return; }
            if (!accessibilityEnabled() || !VolumeAccessibilityService.connected) {
                call.reject("Habilita el servicio SafeAlert en Accesibilidad y vuelve a la app."); return;
            }
            ContextCompat.startForegroundService(getContext(), new Intent(getContext(), VolumeProtectionService.class).setAction(VolumeProtectionService.START));
            call.resolve();
        } catch (Exception ignored) { call.reject("No se pudo activar la protección por volumen. Comprueba tu sesión y vuelve a intentarlo."); }
    }
    @PluginMethod public void stop(PluginCall call) {
        VolumeProtectionService.stop(getContext());
        call.resolve();
    }
}
