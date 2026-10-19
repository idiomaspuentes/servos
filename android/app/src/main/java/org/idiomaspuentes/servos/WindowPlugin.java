package org.idiomaspuentes.servos;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The window around the page: the strips under the status bar and Android's buttons, which the page does not draw
 * (`vite.config.ts`, insideTheBars), take the page's own ground, so a dark theme has no light strips around it.
 */
@CapacitorPlugin(name = "ServosWindow")
public class WindowPlugin extends Plugin {

    /** Paints the window behind the bars in the page's ground colour (`#rrggbb`). */
    @PluginMethod
    public void setBackground(PluginCall call) {
        String color = call.getString("color", "");
        try {
            int parsed = Color.parseColor(color);
            getActivity().runOnUiThread(() -> {
                getActivity().getWindow().setBackgroundDrawable(new ColorDrawable(parsed));
                getActivity().getWindow().getDecorView().setBackgroundColor(parsed);
            });
            call.resolve();
        } catch (IllegalArgumentException e) {
            call.reject("No colour");
        }
    }
}
