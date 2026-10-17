package io.ionic.starter; 

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import android.view.KeyEvent;
import android.view.accessibility.AccessibilityEvent;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class VolumeSosService extends AccessibilityService {

    private static final String TAG = "SafeAlertSOS";
    private static final int REQUIRED_PRESSES = 3;
    private static final long TIME_WINDOW_MS = 1800; // 1.8 segundos para las 3 pulsaciones

    private int pressCount = 0;
    private long firstPressTime = 0;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // No necesitamos leer la pantalla, solo los botones físicos
    }

    @Override
    public void onInterrupt() {
    }

    @Override
    protected boolean onKeyEvent(KeyEvent event) {
        int action = event.getAction();
        int keyCode = event.getKeyCode();

        // Detectar cuando se presiona Volumen Abajo o Volumen Arriba
        if (action == KeyEvent.ACTION_DOWN && 
           (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_UP)) {
            
            long now = System.currentTimeMillis();

            if (now - firstPressTime > TIME_WINDOW_MS) {
                pressCount = 1;
                firstPressTime = now;
            } else {
                pressCount++;
            }

            Log.d(TAG, "Pulsación de volumen detectada: " + pressCount);

            if (pressCount >= REQUIRED_PRESSES) {
                pressCount = 0;
                firstPressTime = 0;
                vibrateConfirmation();
                triggerSosRequest();
            }
        }
        // Retornamos false para que el volumen del teléfono siga subiendo/bajando normalmente y sea discreto
        return false;
    }

    private void vibrateConfirmation() {
        Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (v != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createOneShot(400, VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                v.vibrate(400);
            }
        }
    }

private void triggerSosRequest() {
        new Thread(() -> {
            try {
                SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                String token = prefs.getString("jwt_token", null);
                String apiUrl = prefs.getString("sos_endpoint", null);

                if (token == null || apiUrl == null) {
                    Log.e(TAG, "No hay token o URL configurada en CapacitorStorage");
                    return;
                }

                URL url = new URL(apiUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                
                // Enviamos el token tanto en la cookie 'safealert_session' como en Authorization Bearer
                conn.setRequestProperty("Cookie", "safealert_session=" + token);
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setDoOutput(true);

                // Cuerpo JSON que cumple exactamente con CrearAlertaDto
                String jsonInputString = "{\"notificarPolicia\": false}";

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = jsonInputString.getBytes("utf-8");
                    os.write(input, 0, input.length);
                }

                int responseCode = conn.getResponseCode();
                Log.d(TAG, "Respuesta del backend SOS (esperado 201): " + responseCode);
                conn.disconnect();

            } catch (Exception e) {
                Log.e(TAG, "Error enviando SOS al backend", e);
            }
        }).start();
    }
}