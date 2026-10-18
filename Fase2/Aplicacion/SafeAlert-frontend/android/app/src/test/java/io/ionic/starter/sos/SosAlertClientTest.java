package io.ionic.starter.sos;

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import static org.junit.Assert.*;

/** Servidor efímero local: no se crean alertas en Cloud Run ni se usan credenciales reales. */
public class SosAlertClientTest {
    private MockWebServer server;
    private String endpoint;
    private static final String EVENT = "d10f34b5-1678-41cd-9a14-36b686a62745";
    @Before public void start() throws Exception {
        server = new MockWebServer();
        server.start();
        endpoint = server.url("/alerta").toString();
    }
    @After public void stop() throws Exception { server.shutdown(); }
    private void success() { server.enqueue(new MockResponse().setResponseCode(201).setBody("{\"id\":15}")); }
    @Test public void sendsActualCoordinatesWithVolumeOriginAndEvent() throws Exception {
        success();
        SosAlertClient.Result result = new SosAlertClient("VOLUMEN").send(endpoint, "test-token", EVENT, -33.45, -70.66);
        assertTrue(result.confirmed());
        assertEquals(15, result.alertId);
        RecordedRequest request = server.takeRequest();
        JSONObject body = new JSONObject(request.getBody().readUtf8());
        assertEquals("Bearer test-token", request.getHeader("Authorization"));
        assertEquals("VOLUMEN", body.getString("origen"));
        assertEquals(EVENT, body.getString("eventoId"));
        assertEquals(-33.45, body.getDouble("latitud"), 0.000001);
        assertEquals(-70.66, body.getDouble("longitud"), 0.000001);
        assertFalse(body.getBoolean("notificarPolicia"));
    }
    @Test public void omitsBothCoordinatesWhenLocationIsUnavailable() throws Exception {
        success();
        assertTrue(new SosAlertClient("VOLUMEN").send(endpoint, "test-token", EVENT, null, null).confirmed());
        JSONObject body = new JSONObject(server.takeRequest().getBody().readUtf8());
        assertFalse(body.has("latitud"));
        assertFalse(body.has("longitud"));
    }
    @Test public void preservesMotionContractAfterSharingTransport() throws Exception {
        success();
        assertTrue(new SosAlertClient("MOVIMIENTO").send(endpoint, "test-token", EVENT, 0.0, 0.0).confirmed());
        JSONObject body = new JSONObject(server.takeRequest().getBody().readUtf8());
        assertEquals("MOVIMIENTO", body.getString("origen"));
        assertEquals(0, body.getDouble("latitud"), 0);
    }
    @Test public void neverConfirmsAnErrorOrSuccessWithoutAnId() {
        server.enqueue(new MockResponse().setResponseCode(500).setBody("{}"));
        assertFalse(new SosAlertClient("VOLUMEN").send(endpoint, "test-token", EVENT, null, null).confirmed());
        server.enqueue(new MockResponse().setResponseCode(200).setBody("{}"));
        SosAlertClient.Result missingId = new SosAlertClient("VOLUMEN").send(endpoint, "test-token", EVENT, null, null);
        assertFalse(missingId.confirmed());
        assertTrue(missingId.retryable());
    }
    @Test public void cancellationBeforeSendDoesNotMakeARequest() {
        SosAlertClient client = new SosAlertClient("VOLUMEN");
        client.cancel();
        assertFalse(client.send(endpoint, "test-token", EVENT, null, null).confirmed());
        assertEquals(0, server.getRequestCount());
    }
}
