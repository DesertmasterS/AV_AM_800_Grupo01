package io.ionic.starter.sos;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.util.Base64;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** La firma del JWT se comprueba en el backend; aquí solo se valida consistencia y vencimiento. */
public final class SosSession {
    public final String token, endpoint;
    public final long expiresAt;
    private SosSession(String token, String endpoint, long expiresAt) {
        this.token = token; this.endpoint = endpoint; this.expiresAt = expiresAt;
    }
    public static SosSession read(Context context) throws Exception {
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String token = prefs.getString("jwt_token", "");
        String endpoint = prefs.getString("sos_endpoint", "");
        String[] parts = token.split("\\.");
        if (parts.length != 3) throw new IllegalStateException("Inicia sesión nuevamente.");
        JSONObject payload = new JSONObject(new String(Base64.decode(parts[1], Base64.URL_SAFE | Base64.NO_WRAP), StandardCharsets.UTF_8));
        long expiry = payload.getLong("exp") * 1000L;
        if (payload.getLong("sub") <= 0 || expiry <= System.currentTimeMillis() + 1000L) {
            throw new IllegalStateException("Tu sesión venció. Inicia sesión nuevamente.");
        }
        URI uri = new URI(endpoint);
        boolean debug = (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (!("https".equalsIgnoreCase(uri.getScheme()) || (debug && "http".equalsIgnoreCase(uri.getScheme())))
            || uri.getHost() == null || uri.getUserInfo() != null || uri.getFragment() != null || uri.getQuery() != null) {
            throw new IllegalStateException("La dirección del servicio SOS no es válida.");
        }
        return new SosSession(token, endpoint, expiry);
    }
}
