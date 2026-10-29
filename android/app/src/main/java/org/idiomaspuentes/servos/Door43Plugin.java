package org.idiomaspuentes.servos;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.net.ssl.SSLException;

/**
 * Door43 over a network that may be watched (philosophy, principle 9).
 *
 * The page's requests to Door43 come here instead of going through the WebView (`src/app/frame/door43Pins.ts`), and are
 * made by Android itself, which checks Door43's certificate against the keys the app carries
 * ({@code res/xml/network_security_config.xml}): the WebView would take any certificate the phone trusts, one a network
 * puts in the middle too. When the certificate is not one of Door43's, nothing is sent and the page is told
 * ({@code NOT_DOOR43}), to say so. It also tells the page whether the phone is on Wi-Fi or on mobile data, for the copy
 * that goes only on Wi-Fi unless the person chose otherwise.
 */
@CapacitorPlugin(name = "ServosDoor43")
public class Door43Plugin extends Plugin {

    /** Several at once (an upload and a copy), and never on the thread the other plugins answer on. */
    private final ExecutorService requests = Executors.newFixedThreadPool(3);

    @PluginMethod
    public void request(PluginCall call) {
        requests.execute(() -> send(call));
    }

    private void send(PluginCall call) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(call.getString("url", ""));
            if (!"https".equals(url.getProtocol())) {
                call.reject("Only https", "NOT_HTTPS");
                return;
            }
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod(call.getString("method", "GET"));
            connection.setConnectTimeout(20_000);
            connection.setReadTimeout(120_000);
            JSObject headers = call.getObject("headers", new JSObject());
            for (Iterator<String> keys = headers.keys(); keys.hasNext(); ) {
                String key = keys.next();
                connection.setRequestProperty(key, headers.getString(key));
            }
            String body = call.getString("body");
            if (body != null) {
                byte[] bytes = Base64.decode(body, Base64.DEFAULT);
                connection.setDoOutput(true);
                connection.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream out = connection.getOutputStream()) {
                    out.write(bytes);
                }
            }
            int status = connection.getResponseCode();
            JSObject answerHeaders = new JSObject();
            for (Map.Entry<String, List<String>> header : connection.getHeaderFields().entrySet()) {
                if (header.getKey() != null && !header.getValue().isEmpty()) answerHeaders.put(header.getKey().toLowerCase(), header.getValue().get(0));
            }
            JSObject answer = new JSObject();
            answer.put("status", status);
            answer.put("headers", answerHeaders);
            answer.put("body", Base64.encodeToString(read(status >= 400 ? connection.getErrorStream() : connection.getInputStream()), Base64.NO_WRAP));
            call.resolve(answer);
        } catch (SSLException e) {
            // Not one of Door43's certificates (a pin that does not match, or one the phone does not trust): nothing
            // was sent, not even the key in the headers, which goes only after the certificate is checked.
            call.reject("The certificate was not Door43's", "NOT_DOOR43", e);
        } catch (IOException e) {
            call.reject("Door43 could not be reached", "OFFLINE", e);
        } catch (Exception e) {
            call.reject("Not sent", "OTHER", e);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static byte[] read(InputStream in) throws IOException {
        if (in == null) return new byte[0];
        try (InputStream from = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[64 * 1024];
            for (int n; (n = from.read(buffer)) > 0; ) out.write(buffer, 0, n);
            return out.toByteArray();
        }
    }

    /** The network the phone is on: Wi-Fi (any not paid by use), mobile data, or none. */
    @PluginMethod
    public void network(PluginCall call) {
        ConnectivityManager connectivity = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        Network active = connectivity == null ? null : connectivity.getActiveNetwork();
        NetworkCapabilities capabilities = active == null ? null : connectivity.getNetworkCapabilities(active);
        JSObject answer = new JSObject();
        if (capabilities == null || !capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) answer.put("kind", "ninguna");
        else answer.put("kind", capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED) ? "wifi" : "datos");
        call.resolve(answer);
    }

    @Override
    protected void handleOnDestroy() {
        requests.shutdown();
    }
}
