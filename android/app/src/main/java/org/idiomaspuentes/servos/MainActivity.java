package org.idiomaspuentes.servos;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * Servos on a phone: the web app inside a WebView (Capacitor), and what the WebView cannot do alone. A file opened with
 * Servos or shared to it goes to be received ({@link ArrivalsPlugin}); and the page is told when the phone has internet
 * and when not, which a WebView does not follow by itself: without it, the page would think it is always online, and
 * what waits for internet (design, 6.11) would try in airplane mode instead of waiting.
 */
public class MainActivity extends BridgeActivity {

    private ConnectivityManager connectivity;
    private final ConnectivityManager.NetworkCallback network = new ConnectivityManager.NetworkCallback() {
        @Override
        public void onAvailable(Network n) {
            tellOnline();
        }

        @Override
        public void onLost(Network n) {
            tellOnline();
        }

        @Override
        public void onCapabilitiesChanged(Network n, NetworkCapabilities capabilities) {
            tellOnline();
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ArrivalsPlugin.class);
        super.onCreate(savedInstanceState);
        connectivity = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        tellOnline();
        connectivity.registerDefaultNetworkCallback(network);
    }

    @Override
    public void onDestroy() {
        if (connectivity != null) connectivity.unregisterNetworkCallback(network);
        super.onDestroy();
    }

    /** Sets `navigator.onLine` (and fires `online` or `offline`) from the phone's own network. */
    private void tellOnline() {
        Network active = connectivity.getActiveNetwork();
        NetworkCapabilities capabilities = active == null ? null : connectivity.getNetworkCapabilities(active);
        boolean online = capabilities != null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        runOnUiThread(() -> {
            if (bridge != null && bridge.getWebView() != null) bridge.getWebView().setNetworkAvailable(online);
        });
    }
}
