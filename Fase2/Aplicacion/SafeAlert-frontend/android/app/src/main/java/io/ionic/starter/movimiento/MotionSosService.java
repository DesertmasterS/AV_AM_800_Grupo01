package io.ionic.starter.movimiento;

import io.ionic.starter.sos.SosLocationPolicy;
import io.ionic.starter.sos.SosLocationCapture;
import io.ionic.starter.sos.SosAlertClient;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.hardware.*;
import android.location.Location;
import android.os.*;
import io.ionic.starter.MainActivity;
import io.ionic.starter.R;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Sesión explícita, como máximo dos horas. Nunca se reinicia desde boot ni START_STICKY. */
public class MotionSosService extends Service implements SensorEventListener {
    static final String CHANNEL = "safealert_motion";
    static final String PREFS = "SafeAlertMotion";
    static final String CANCEL = "io.ionic.starter.movimiento.CANCEL";
    private static final String STOP = "io.ionic.starter.movimiento.STOP";
    private static final int NOTIFICATION_ID = 4201;
    private static final long MAX_SESSION_MS = 2 * 60 * 60 * 1000L;
    private static final long RETRY_LIFETIME_MS = 5 * 60 * 1000L;
    static volatile boolean running;
    static volatile String phase = "inactive";
    static volatile long deadline;
    static volatile long sessionEndsAt;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private final MotionDetector detector = new MotionDetector();
    private final SosAlertClient client = new SosAlertClient("MOVIMIENTO");
    private final float[] gravity = new float[3];
    private boolean gravityReady;
    private boolean locationEnabled;
    private SosLocationCapture locationCapture;
    private Double eventLatitude, eventLongitude;
    private volatile boolean stopping;
    private String token, endpoint, owner;
    private volatile String eventId;
    private long eventCreatedAt;
    private long countdownEndElapsed;
    private int attempts;
    private SensorManager sensors;
    private Sensor sensor;
    private SharedPreferences storage, auth;
    private PowerManager.WakeLock wakeLock;
    private final SharedPreferences.OnSharedPreferenceChangeListener authListener = (prefs, key) -> {
        if ("jwt_token".equals(key) && !java.util.Objects.equals(token, prefs.getString("jwt_token", null))) {
            handler.post(() -> finish("La sesión cambió. Detección detenida."));
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        storage = getSharedPreferences(PREFS, MODE_PRIVATE);
        auth = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
        locationCapture = new SosLocationCapture(this);
        sensors = (SensorManager) getSystemService(SENSOR_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Detección por movimiento", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Monitoreo activado por ti y prealertas cancelables.");
            channel.setSound(null, null);
            channel.enableVibration(false);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        if (STOP.equals(intent.getAction())) { finish("Detección desactivada por ti."); return START_NOT_STICKY; }
        if (CANCEL.equals(intent.getAction())) {
            if ("countdown".equals(phase)) {
                handler.removeCallbacks(countdown);
                locationCapture.cancel();
                deadline = 0;
                detector.mute(SystemClock.elapsedRealtime());
                phase = "monitoring";
                message("Prealerta cancelada. El monitoreo sigue activo.");
                updateNotification();
            } else if (!running) stopSelf();
            return START_NOT_STICKY;
        }
        if (running) return START_NOT_STICKY;
        token = intent.getStringExtra("token");
        endpoint = intent.getStringExtra("endpoint");
        owner = intent.getStringExtra("owner");
        sessionEndsAt = Math.min(System.currentTimeMillis() + MAX_SESSION_MS, intent.getLongExtra("expiresAt", 0));
        if (token == null || endpoint == null || owner == null || sessionEndsAt <= System.currentTimeMillis()) {
            stopSelf(); return START_NOT_STICKY;
        }
        locationEnabled = intent.getBooleanExtra("locationEnabled", false) && SosLocationCapture.hasPermission(this);
        phase = "monitoring";
        try {
            Notification notification = notification();
            if (Build.VERSION.SDK_INT >= 29) {
                int types = Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
                if (locationEnabled) types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
                try {
                    startForeground(NOTIFICATION_ID, notification, types);
                } catch (SecurityException denied) {
                    if (!locationEnabled) throw denied;
                    // GPS desactivado o permiso revocado durante el inicio: mantener el SOS sin ubicación.
                    locationEnabled = false;
                    startForeground(NOTIFICATION_ID, notification,
                        Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0);
                }
            } else startForeground(NOTIFICATION_ID, notification);
            sensor = sensors.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION, true);
            if (sensor == null) sensor = sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER, true);
            if (sensor == null) sensor = sensors.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION);
            if (sensor == null) sensor = sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
            if (sensor == null || !sensors.registerListener(this, sensor, SensorManager.SENSOR_DELAY_GAME)) {
                finish("No se pudo iniciar el acelerómetro."); return START_NOT_STICKY;
            }
            PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
            wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SafeAlert:MotionSession");
            wakeLock.acquire(sessionEndsAt - System.currentTimeMillis() + 30000L);
            running = true;
            storage.edit().putBoolean("wasRunning", true).apply();
            auth.registerOnSharedPreferenceChangeListener(authListener);
            handler.postDelayed(() -> finish("La sesión de protección terminó. Puedes activarla de nuevo."), sessionEndsAt - System.currentTimeMillis());
            message("Detección activa. Sesión de hasta dos horas." + (locationEnabled ? " Se intentará ubicar cada SOS." : " Ubicación no habilitada para esta sesión: los SOS se enviarán sin coordenadas. Revisa permisos y GPS y vuelve a activar la detección para incluir ubicación."));
            restorePending();
            updateNotification();
        } catch (RuntimeException ignored) {
            finish("Android no permitió iniciar el monitoreo. Actívalo desde la app.");
        }
        return START_NOT_STICKY;
    }

    @Override public void onSensorChanged(SensorEvent event) {
        if (!running || stopping || !"monitoring".equals(phase)) return;
        double x = event.values[0], y = event.values[1], z = event.values[2];
        if (sensor.getType() == Sensor.TYPE_ACCELEROMETER) {
            if (!gravityReady) {
                System.arraycopy(event.values, 0, gravity, 0, 3);
                gravityReady = true;
                return;
            }
            for (int i = 0; i < 3; i++) gravity[i] = 0.8f * gravity[i] + 0.2f * event.values[i];
            x -= gravity[0]; y -= gravity[1]; z -= gravity[2];
        }
        if (detector.sample(x, y, z, SystemClock.elapsedRealtime())) {
            if (locationEnabled && SosLocationCapture.hasPermission(this)) locationCapture.start();
            phase = "countdown";
            deadline = System.currentTimeMillis() + 10000;
            countdownEndElapsed = SystemClock.elapsedRealtime() + 10000;
            message("Movimiento detectado. Puedes cancelar antes del envío.");
            Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0, 250, 150, 250}, -1));
                else vibrator.vibrate(new long[]{0, 250, 150, 250}, -1);
            }
            handler.post(countdown);
        }
    }

    private final Runnable countdown = new Runnable() {
        @Override public void run() {
            if (stopping || !"countdown".equals(phase)) return;
            if (SystemClock.elapsedRealtime() < countdownEndElapsed) {
                updateNotification();
                handler.postDelayed(this, 1000);
                return;
            }
            deadline = 0;
            Location location = locationCapture.finish();
            if (!SosLocationCapture.hasPermission(MotionSosService.this)) location = null;
            eventLatitude = location != null ? location.getLatitude() : null;
            eventLongitude = location != null ? location.getLongitude() : null;
            eventId = UUID.randomUUID().toString();
            eventCreatedAt = System.currentTimeMillis();
            attempts = 0;
            SharedPreferences.Editor pending = storage.edit().putString("eventId", eventId).putLong("eventCreatedAt", eventCreatedAt)
                .putString("eventOwner", owner).putString("eventEndpoint", endpoint)
                .remove("eventLatitude").remove("eventLongitude");
            if (eventLatitude != null && eventLongitude != null) {
                pending.putString("eventLatitude", eventLatitude.toString()).putString("eventLongitude", eventLongitude.toString());
            }
            pending.commit();
            sendPending();
        }
    };

    private void restorePending() {
        String saved = storage.getString("eventId", null);
        long created = storage.getLong("eventCreatedAt", 0);
        long age = System.currentTimeMillis() - created;
        if (saved != null && owner.equals(storage.getString("eventOwner", ""))
            && endpoint.equals(storage.getString("eventEndpoint", "")) && age >= 0 && age < RETRY_LIFETIME_MS) {
            eventId = saved; eventCreatedAt = created;
            try {
                double latitude = Double.parseDouble(storage.getString("eventLatitude", ""));
                double longitude = Double.parseDouble(storage.getString("eventLongitude", ""));
                if (SosLocationPolicy.accepts(latitude, longitude, 1, 0)) {
                    eventLatitude = latitude; eventLongitude = longitude;
                }
            } catch (NumberFormatException ignored) { eventLatitude = null; eventLongitude = null; }
            sendPending();
        } else clearPending();
    }

    private void sendPending() {
        if (stopping || eventId == null) return;
        if (!token.equals(auth.getString("jwt_token", null))) { finish("La sesión cambió. Detección detenida."); return; }
        if (System.currentTimeMillis() - eventCreatedAt >= RETRY_LIFETIME_MS || attempts >= 8) {
            clearPending(); phase = "monitoring";
            message("No se pudo confirmar el SOS tras varios intentos. Usa otra vía de ayuda.");
            updateNotification(); return;
        }
        phase = "sending";
        attempts++;
        updateNotification();
        String sendingId = eventId;
        Double sendingLatitude = eventLatitude, sendingLongitude = eventLongitude;
        network.execute(() -> {
            if (stopping || !sendingId.equals(eventId)) return;
            SosAlertClient.Result result = client.send(endpoint, token, sendingId, sendingLatitude, sendingLongitude);
            handler.post(() -> {
                if (stopping || !sendingId.equals(eventId)) return;
                if (result.confirmed()) {
                    clearPending(); phase = "monitoring";
                    detector.mute(SystemClock.elapsedRealtime());
                    message("Alerta #" + result.alertId + " registrada" + (sendingLatitude != null ? " con ubicación del dispositivo." : " sin ubicación disponible.") + " Monitoreo activo.");
                    updateNotification();
                } else if (result.status == 401 || result.status == 403) {
                    finish("La sesión venció. Inicia sesión para activar de nuevo la detección.");
                } else if (result.retryable()) {
                    phase = "retrying";
                    message("No se ha confirmado el SOS. Reintentando con el mismo evento.");
                    updateNotification();
                    handler.postDelayed(() -> sendPending(), Math.min(60000L, 5000L * (1L << Math.min(attempts - 1, 4))));
                } else {
                    clearPending(); phase = "monitoring";
                    message("El servidor rechazó el SOS. Revisa la integración antes de usar esta función.");
                    updateNotification();
                }
            });
        });
    }

    private void clearPending() {
        eventId = null;
        eventLatitude = null; eventLongitude = null;
        storage.edit().remove("eventId").remove("eventCreatedAt").remove("eventOwner").remove("eventEndpoint").remove("eventLatitude").remove("eventLongitude").apply();
    }
    private void message(String value) { storage.edit().putString("message", value).apply(); }
    private void finish(String text) {
        stopping = true;
        client.cancel();
        if (locationCapture != null) locationCapture.cancel();
        if (storage != null) { message(text); clearPending(); }
        stopSelf();
    }

    private PendingIntent action(String name, int code) {
        return PendingIntent.getService(this, code, new Intent(this, MotionSosService.class).setAction(name),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private Notification notification() {
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent content = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        String text = storage.getString("message", "Detección activada");
        if ("countdown".equals(phase)) text = "SOS en " + Math.max(1, (countdownEndElapsed - SystemClock.elapsedRealtime() + 999) / 1000) + " s. Puedes cancelarlo.";
        if ("sending".equals(phase)) text = "Enviando SOS por movimiento…";
        builder.setSmallIcon(R.drawable.ic_motion_sos).setContentTitle("SafeAlert · Detección por movimiento")
            .setContentText(text).setStyle(new Notification.BigTextStyle().bigText(text))
            .setContentIntent(content).setOngoing(true).setOnlyAlertOnce(true).setVisibility(Notification.VISIBILITY_PUBLIC);
        if ("countdown".equals(phase)) builder.addAction(0, "Cancelar SOS", action(CANCEL, 1));
        builder.addAction(0, "Desactivar detección", action(STOP, 2));
        return builder.build();
    }
    private void updateNotification() { if (!stopping) getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, notification()); }

    @Override public void onAccuracyChanged(Sensor sensor, int accuracy) {}
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public void onDestroy() {
        if (!stopping && storage != null) message("El monitoreo se detuvo. Puedes activarlo nuevamente desde SafeAlert.");
        stopping = true;
        if (storage != null) storage.edit().putBoolean("wasRunning", false).apply();
        client.cancel();
        running = false; phase = "inactive"; deadline = 0; sessionEndsAt = 0;
        handler.removeCallbacksAndMessages(null);
        if (sensors != null) sensors.unregisterListener(this);
        if (auth != null) auth.unregisterOnSharedPreferenceChangeListener(authListener);
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (locationCapture != null) locationCapture.cancel();
        network.shutdownNow();
        stopForeground(true);
        super.onDestroy();
    }
}
