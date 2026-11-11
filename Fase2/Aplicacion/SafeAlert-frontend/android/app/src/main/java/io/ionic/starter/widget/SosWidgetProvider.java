package io.ionic.starter.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.content.res.Configuration;
import android.widget.RemoteViews;
import io.ionic.starter.MainActivity;
import io.ionic.starter.R;
import io.ionic.starter.sos.SosSession;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.text.DateFormat;
import java.util.Date;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import org.json.JSONObject;

/** El widget consulta el estado; nunca envía un SOS desde un BroadcastReceiver. */
public class SosWidgetProvider extends AppWidgetProvider {
    private static final String REFRESH = "io.ionic.starter.widget.REFRESH";
    private static final ExecutorService NETWORK = Executors.newSingleThreadExecutor();
    public static void refresh(Context context) {
        context.sendBroadcast(new Intent(context, SosWidgetProvider.class).setAction(REFRESH));
    }
    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (!REFRESH.equals(intent.getAction()) && !AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(intent.getAction())) return;
        if (AppWidgetManager.getInstance(context).getAppWidgetIds(new ComponentName(context, SosWidgetProvider.class)).length == 0) return;
        render(context, "Consultando estado…", "Conectando con SafeAlert");
        final PendingResult pending = goAsync();
        NETWORK.execute(() -> {
            try { load(context); } finally { pending.finish(); }
        });
    }
    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        // Redimensionar solo cambia la presentación: conserva el estado y no consulta la red.
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.sos_widget);
        configureSos(context, manager, id, views);
        manager.partiallyUpdateAppWidget(id, views);
    }
    private static void configureSos(Context context, AppWidgetManager manager, int id, RemoteViews views) {
        Bundle options = manager.getAppWidgetOptions(id);
        boolean landscape = context.getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
        int width = options.getInt(landscape ? AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH : AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int height = options.getInt(landscape ? AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT : AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        int layout;
        switch (SosWidgetSizing.diameter(width, height)) {
            case 144: layout = R.layout.sos_widget_button_144; break;
            case 120: layout = R.layout.sos_widget_button_120; break;
            case 96: layout = R.layout.sos_widget_button_96; break;
            case 76: layout = R.layout.sos_widget_button_76; break;
            default: layout = R.layout.sos_widget_button_60;
        }
        views.removeAllViews(R.id.widget_sos_container);
        views.addView(R.id.widget_sos_container, new RemoteViews(context.getPackageName(), layout));
        Intent open = new Intent(context, MainActivity.class).setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("safealert://widget/sos"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        views.setOnClickPendingIntent(R.id.widget_sos, PendingIntent.getActivity(context, id, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
    }
    private static void load(Context context) {
        SosSession session;
        try { session = SosSession.read(context); }
        catch (Exception ignored) { render(context, "Inicia sesión", "Abre SafeAlert para conectar tu cuenta"); return; }
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(session.endpoint.replaceAll("/$", "") + "/activa").openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(3000);
            connection.setReadTimeout(3000);
            connection.setRequestProperty("Authorization", "Bearer " + session.token);
            int status = connection.getResponseCode();
            if (!sameSession(context, session)) return;
            if (status == 401 || status == 403) { render(context, "Inicia sesión nuevamente", "No se pudo verificar tu cuenta"); return; }
            if (status != 200) throw new IllegalStateException();
            try (InputStream in = connection.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[1024]; int length;
                while ((length = in.read(buffer)) != -1) {
                    if (out.size() + length > 16384) throw new IllegalStateException();
                    out.write(buffer, 0, length);
                }
                JSONObject json = new JSONObject(out.toString("UTF-8"));
                if (!json.has("activa")) throw new IllegalStateException();
                JSONObject active = json.optJSONObject("activa");
                if (!json.isNull("activa") && (active == null || active.optLong("id", 0) <= 0)) throw new IllegalStateException();
                if (!sameSession(context, session)) return;
                render(context, active == null ? "Sin alerta activa" : "Alerta #" + active.getLong("id") + " activa",
                    "Consultado: " + DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date()));
            }
        } catch (Exception ignored) {
            if (sameSession(context, session)) render(context, "Estado sin confirmar", "Pulsa Actualizar o abre SafeAlert");
        } finally { if (connection != null) connection.disconnect(); }
    }
    private static boolean sameSession(Context context, SosSession session) {
        return session.token.equals(context.getSharedPreferences("CapacitorStorage", 0).getString("jwt_token", ""));
    }
    private static void render(Context context, String state, String detail) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, SosWidgetProvider.class));
        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.sos_widget);
            views.setTextViewText(R.id.widget_status, state);
            views.setTextViewText(R.id.widget_updated, detail);
            int indicatorColor = state.startsWith("Alerta #") ? 0xFFFF9CAA
                : "Sin alerta activa".equals(state) ? 0xFF8DD7B3 : 0xFFE8C78B;
            views.setTextColor(R.id.widget_indicator, indicatorColor);
            configureSos(context, manager, id, views);
            Intent refresh = new Intent(context, SosWidgetProvider.class).setAction(REFRESH);
            views.setOnClickPendingIntent(R.id.widget_refresh, PendingIntent.getBroadcast(context, id, refresh,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            manager.updateAppWidget(id, views);
        }
    }
}
