package io.ionic.starter.movimiento;

import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Transporte independiente de la WebView. No sigue redirecciones ni registra credenciales. */
final class MotionAlertClient {
    private volatile boolean cancelled;
    private volatile HttpURLConnection active;

    void cancel() {
        cancelled = true;
        HttpURLConnection connection = active;
        if (connection != null) connection.disconnect();
    }
    static final class Result {
        final int status;
        final long alertId;
        Result(int status, long alertId) { this.status = status; this.alertId = alertId; }
        boolean confirmed() { return status >= 200 && status < 300 && alertId > 0; }
        boolean retryable() { return status == 0 || status == 408 || status == 429 || status >= 500 || (status >= 200 && status < 300 && alertId <= 0); }
    }

    Result send(String endpoint, String token, String eventId, Double latitude, Double longitude) {
        HttpURLConnection connection = null;
        try {
            if (cancelled || Thread.currentThread().isInterrupted()) return new Result(0, -1);
            connection = (HttpURLConnection) new URL(endpoint).openConnection();
            active = connection;
            if (cancelled) return new Result(0, -1);
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setDoOutput(true);
            JSONObject body = new JSONObject();
            body.put("origen", "MOVIMIENTO");
            body.put("eventoId", eventId);
            body.put("notificarPolicia", false);
            if (latitude != null && longitude != null) {
                body.put("latitud", latitude);
                body.put("longitud", longitude);
            }
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (java.io.OutputStream out = connection.getOutputStream()) { out.write(bytes); }
            int status = connection.getResponseCode();
            long id = -1;
            if (status >= 200 && status < 300) {
                try (InputStream in = connection.getInputStream(); ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                    byte[] part = new byte[1024];
                    int size;
                    while ((size = in.read(part)) != -1) {
                        if (buffer.size() + size > 8192) return new Result(status, -1);
                        buffer.write(part, 0, size);
                    }
                    id = new JSONObject(buffer.toString("UTF-8")).optLong("id", -1);
                }
            }
            return new Result(status, id);
        } catch (Exception ignored) {
            return new Result(0, -1);
        } finally {
            if (connection != null) connection.disconnect();
            active = null;
        }
    }
}
