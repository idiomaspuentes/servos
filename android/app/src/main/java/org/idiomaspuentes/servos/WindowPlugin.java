package org.idiomaspuentes.servos;

import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The window around the page: the strips under the status bar and Android's buttons, which the page does not draw
 * (`vite.config.ts`, insideTheBars), take the page's own ground, so a dark theme has no light strips around it.
 *
 * Capacitor's SystemBars puts the window back to the theme's ground each time it sets the bars' style, which it also
 * does by itself when the phone turns: the page's ground is kept here and painted again after it.
 */
@CapacitorPlugin(name = "ServosWindow")
public class WindowPlugin extends Plugin {

    private Integer ground = null;

    /** Paints the window behind the bars in the page's ground colour (`#rrggbb`). */
    @PluginMethod
    public void setBackground(PluginCall call) {
        try {
            ground = Color.parseColor(call.getString("color", ""));
            getActivity().runOnUiThread(this::paint);
            call.resolve();
        } catch (IllegalArgumentException e) {
            call.reject("No colour");
        }
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        super.handleOnConfigurationChanged(newConfig);
        // After the other plugins have had the change: SystemBars paints the theme's ground as it does.
        getActivity().getWindow().getDecorView().post(this::paint);
    }

    private void paint() {
        if (ground == null) return;
        getActivity().getWindow().setBackgroundDrawable(new ColorDrawable(ground));
        getActivity().getWindow().getDecorView().setBackgroundColor(ground);
    }
}
