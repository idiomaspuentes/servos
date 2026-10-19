package org.idiomaspuentes.servos;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * Servos on a phone: the web app inside a WebView (Capacitor), and what the WebView cannot do alone. A file opened with
 * Servos or shared to it goes to be received, and one the app makes goes out by the share sheet ({@link FilesPlugin});
 * and the page is told when the phone has internet and when not, which a WebView does not follow by itself: without
 * it, the page would think it is always online, and what waits for internet (design, 6.11) would try in airplane mode
 * instead of waiting.
 */
public class MainActivity extends BridgeActivity {

    private ConnectivityManager connectivity;
    /** The networks that reach out by themselves (Wi-Fi, mobile data): a VPN is up in airplane mode too. */
    private final Set<Network> ways = Collections.synchronizedSet(new HashSet<>());
    private final ConnectivityManager.NetworkCallback network = new ConnectivityManager.NetworkCallback() {
        @Override
        public void onAvailable(Network n) {
            ways.add(n);
            tellOnline();
        }

        @Override
        public void onLost(Network n) {
            ways.remove(n);
            tellOnline();
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FilesPlugin.class);
        registerPlugin(CopiesPlugin.class);
        super.onCreate(savedInstanceState);
        // The recent apps show an empty card for Servos, not the verse being translated (philosophy, principle 9).
        // Screenshots still work; Android 12 and older have no such switch.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) setRecentsScreenshotEnabled(false);
        connectivity = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkRequest outward = new NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)
            .build();
        // The networks there are now, and then each that comes or goes.
        for (Network n : connectivity.getAllNetworks()) {
            NetworkCapabilities capabilities = connectivity.getNetworkCapabilities(n);
            if (capabilities != null && outward.canBeSatisfiedBy(capabilities)) ways.add(n);
        }
        tellOnline();
        connectivity.registerNetworkCallback(outward, network);
        // Told before the page is there, the WebView forgets it: told again once it is.
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                tellOnline();
            }
        });
    }

    @Override
    public void onDestroy() {
        if (connectivity != null) connectivity.unregisterNetworkCallback(network);
        super.onDestroy();
    }

    /** Sets `navigator.onLine` (and fires `online` or `offline`) from the phone's own networks. */
    private void tellOnline() {
        boolean online = !ways.isEmpty();
        runOnUiThread(() -> {
            if (bridge != null && bridge.getWebView() != null) bridge.getWebView().setNetworkAvailable(online);
        });
    }
}
