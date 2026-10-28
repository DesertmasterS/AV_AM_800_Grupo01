package io.ionic.starter.volumen;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.*;
import android.widget.Toast;
import androidx.core.content.ContextCompat;
import io.ionic.starter.MainActivity;
import io.ionic.starter.R;
import io.ionic.starter.sos.SosAlertClient;
import io.ionic.starter.sos.SosLocationCapture;
import io.ionic.starter.sos.SosSession;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Sesión iniciada desde Ajustes o envío puntual desde una actividad visible. Sin reinicio automático. */
public class VolumeProtectionService extends Service {
    public static final String PREFS = "SafeAlertVolume";
    public static final String CHANNEL = "safealert_volume";
    public static final String START = "io.ionic.starter.volumen.START";
    private static final String SINGLE = "io.ionic.starter.volumen.SINGLE";
    private static final String STOP = "io.ionic.starter.volumen.STOP";
    private static final String STOP_ACTIVE_ALERT = "io.ionic.starter.volumen.STOP_ACTIVE_ALERT";
    private static final int NOTICE = 4202;
    private static volatile VolumeProtectionService instance;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private final SosAlertClient client = new SosAlertClient("VOLUMEN");
    private SosLocationCapture capture;
    private SosSession session;
    private SharedPreferences auth;
    private PowerManager.WakeLock wakeLock;
    private volatile boolean persistent, busy, stopping, locationEnabled;
    private volatile long endsAt;
    private volatile long activeAlertId = -1;
    private volatile String phase = "inactive";
    private final SharedPreferences.OnSharedPreferenceChangeListener authListener = (prefs, key) -> {
        if ("jwt_token".equals(key) && session != null && !session.token.equals(prefs.getString(key, null))) {
            handler.post(() -> finish("La sesión cambió. Protección por volumen detenida."));
        }
    };

    public static boolean isSessionActive() { return instance != null && instance.persistent && !instance.stopping && instance.endsAt > System.currentTimeMillis(); }
    public static boolean isBusy() { return instance != null && instance.busy; }
    public static String phase() { return instance == null ? "inactive" : instance.phase; }
    public static long endsAt() { return instance == null ? 0 : instance.endsAt; }
    public static boolean locationEnabled() { return instance != null && instance.locationEnabled; }

    public static void stop(Context context) {
        VolumeProtectionService current = instance;
        if (current != null) {
            current.persistent = false;
            current.stopping = true;
            current.client.cancel();
            current.handler.post(() -> current.finish("Protección por volumen desactivada."));
        } else context.stopService(new Intent(context, VolumeProtectionService.class));
        context.getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("message", "Protección por volumen desactivada.").apply();
    }

    public static void dispatch(Context context, boolean foreground) {
        if (isSessionActive()) { instance.trigger(); return; }
        if (!foreground) return;
        try {
            ContextCompat.startForegroundService(context, new Intent(context, VolumeProtectionService.class).setAction(SINGLE));
        } catch (RuntimeException denied) {
            Toast.makeText(context, "Android no permitió iniciar el SOS. Abre SafeAlert y revisa tus permisos.", Toast.LENGTH_LONG).show();
        }
    }

    @Override public void onCreate() {
        super.onCreate();
        instance = this;
        auth = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
        capture = new SosLocationCapture(this);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Protección por volumen", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Sesión de protección y resultado de SOS por botones de volumen.");
            channel.setSound(null, null);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || STOP.equals(intent.getAction())) {
            finish("Protección por volumen desactivada."); return START_NOT_STICKY;
        }
        if (STOP_ACTIVE_ALERT.equals(intent.getAction())) {
            stopActiveAlertOnServer(); return START_NOT_STICKY;
        }
        if (session != null) return START_NOT_STICKY;
        try {
            session = SosSession.read(this);
            persistent = START.equals(intent.getAction());
            if (persistent && !VolumeAccessibilityService.connected) {
                finish("Habilita primero el servicio de accesibilidad de SafeAlert."); return START_NOT_STICKY;
            }
            endsAt = Math.min(session.expiresAt, System.currentTimeMillis() + (persistent ? 2 * 60 * 60 * 1000L : 60000L));
            locationEnabled = SosLocationCapture.hasPermission(this);
            phase = "monitoring";
            Notification notification = notification("Protección por volumen iniciada.");
            if (Build.VERSION.SDK_INT >= 29) {
                int baseType = Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
                try {
                    startForeground(NOTICE, notification, baseType | (locationEnabled ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION : 0));
                } catch (SecurityException denied) {
                    if (!locationEnabled) throw denied;
                    locationEnabled = false;
                    startForeground(NOTICE, notification, baseType);
                }
            } else startForeground(NOTICE, notification);
            auth.registerOnSharedPreferenceChangeListener(authListener);
            handler.postDelayed(() -> finish("Terminó la sesión por volumen. Actívala nuevamente desde Ajustes."), endsAt - System.currentTimeMillis());
            message("Protección por volumen activa hasta 2 horas." + (locationEnabled ? " Se intentará ubicar cada SOS." : " Esta sesión enviará SOS sin ubicación. Revisa los permisos y vuelve a activarla para incluir ubicación."));
            if (!persistent) trigger();
        } catch (Exception ignored) {
            finish("No se pudo iniciar la protección por volumen. Revisa tu sesión y los permisos desde SafeAlert.");
        }
        return START_NOT_STICKY;
    }

    private void trigger() {
        if (stopping || busy || session == null) return;
        if (!session.token.equals(auth.getString("jwt_token", null))) { finish("Tu sesión cambió. Inicia sesión nuevamente."); return; }
        busy = true;
        PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SafeAlert:VolumeSOS");
        wakeLock.acquire(45000L);
        Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (vibrator != null && vibrator.hasVibrator()) {
            if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createOneShot(200, VibrationEffect.DEFAULT_AMPLITUDE));
            else vibrator.vibrate(200);
        }
        phase = "locating";
        message("SOS por volumen activado. Buscando ubicación durante un máximo de 5 segundos…");
        if (locationEnabled && SosLocationCapture.hasPermission(this)) {
            capture.start();
            handler.postDelayed(() -> send(capture.finish()), 5000L);
        } else send(null);
    }

    private void send(Location position) {
        if (stopping) return;
        if (!session.token.equals(auth.getString("jwt_token", null))) { finish("Tu sesión cambió. No se inició el envío."); return; }
        if (!SosLocationCapture.hasPermission(this)) position = null;
        final Double latitude = position == null ? null : position.getLatitude();
        final Double longitude = position == null ? null : position.getLongitude();
        final String eventId = UUID.randomUUID().toString();
        phase = "sending";
        message(latitude == null ? "Enviando SOS sin ubicación disponible…" : "Enviando SOS con ubicación del dispositivo…");
        network.execute(() -> {
            if (stopping) return;
            SosAlertClient.Result result = client.send(session.endpoint, session.token, eventId, latitude, longitude);
            handler.post(() -> {
                if (stopping) return;
                busy = false;
                if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
                String text;
                if (result.confirmed()) {
                    activeAlertId = result.alertId;
                    if (result.alreadyActive) {
                        text = "Ya tienes la Alerta #" + result.alertId + " activa. ¿Deseas detenerla? Usa el botón 'Detener alerta' en la notificación o en la app.";
                    } else {
                        text = "Alerta #" + result.alertId + " registrada" + (latitude == null ? " sin ubicación disponible." : " con ubicación del dispositivo.");
                    }
                } else if (result.status == 401 || result.status == 403) {
                    finish("Tu sesión no es válida. Inicia sesión nuevamente.");
                    return;
                } else {
                    text = "No se pudo confirmar el registro del SOS. Revisa tu conexión y el servicio antes de reintentar.";
                }
                phase = persistent ? "monitoring" : "inactive";
                message(text);
                Toast.makeText(this, text, Toast.LENGTH_LONG).show();
                if (!persistent && !result.confirmed()) { stopForeground(false); stopSelf(); }
            });
        });
    }

    private void stopActiveAlertOnServer() {
        final long idToStop = activeAlertId;
        if (idToStop <= 0 || session == null) return;
        message("Deteniendo alerta #" + idToStop + "…");
        network.execute(() -> {
            boolean ok = client.stopAlert(session.endpoint, session.token, idToStop);
            handler.post(() -> {
                if (ok) {
                    activeAlertId = -1;
                    String msg = "Alerta #" + idToStop + " detenida y finalizada correctamente.";
                    message(msg);
                    Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
                    if (!persistent) { stopForeground(false); stopSelf(); }
                } else {
                    Toast.makeText(this, "No se pudo detener la alerta #" + idToStop, Toast.LENGTH_LONG).show();
                }
            });
        });
    }

    private Notification notification(String text) {
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this, 3, new Intent(this, VolumeProtectionService.class).setAction(STOP), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        builder.setSmallIcon(R.drawable.ic_motion_sos).setContentTitle("SafeAlert · Botones de volumen")
            .setContentText(text).setStyle(new Notification.BigTextStyle().bigText(text)).setContentIntent(open)
            .setOngoing(persistent).setOnlyAlertOnce(true);
        if (activeAlertId > 0) {
            PendingIntent stopAlertIntent = PendingIntent.getService(this, 4,
                new Intent(this, VolumeProtectionService.class).setAction(STOP_ACTIVE_ALERT),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            builder.addAction(0, "Detener alerta #" + activeAlertId, stopAlertIntent);
        }
        builder.addAction(0, "Desactivar protección", stop);
        return builder.build();
    }

    private void message(String text) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("message", text).apply();
        if (!stopping) getSystemService(NotificationManager.class).notify(NOTICE, notification(text));
    }

    private void finish(String text) {
        stopping = true; persistent = false; busy = false; activeAlertId = -1;
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("message", text).apply();
        capture.cancel(); client.cancel(); stopSelf();
        Toast.makeText(this, text, Toast.LENGTH_LONG).show();
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override public void onDestroy() {
        stopping = true;
        handler.removeCallbacksAndMessages(null);
        capture.cancel(); client.cancel(); network.shutdownNow();
        auth.unregisterOnSharedPreferenceChangeListener(authListener);
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (instance == this) instance = null;
        if (persistent) getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("message", "La sesión por volumen se interrumpió. Actívala nuevamente desde Ajustes.").apply();
        stopForeground(true);
        super.onDestroy();
    }
}