package org.idiomaspuentes.servos;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * A file that comes from outside, to be received (design, sections 7 and 11), as the app for computers does it
 * (`src-tauri/src/lib.rs`): a `.servos` opened with Servos from a file manager or a download («Abrir con»), or shared
 * to Servos from WhatsApp, Bluetooth or another app («Compartir»). Its name and its text wait here until the page takes
 * them ({@code opened}); the page is told when one comes ({@code archivos-abiertos}). A file that is not shared work is
 * not read: it arrives with no text, and «Recibir» says it is not one Servos can take.
 */
@CapacitorPlugin(name = "ServosArrivals")
public class ArrivalsPlugin extends Plugin {

    /** The page's word that files were opened (`src/app/frame/phone.ts`). */
    private static final String OPENED = "archivos-abiertos";
    /** Shared work, or JSON or text that might be (`isShared` and `readable` in `frame/arriving.ts`). */
    private static final Pattern READABLE = Pattern.compile("(?i).*[.](servos|servos[.]json|json|txt)$");
    /** More than a whole Bible with its recordings is not a file Servos made. */
    private static final long MOST = 512L * 1024 * 1024;

    private final List<JSObject> waiting = new ArrayList<>();

    @Override
    public void load() {
        take(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        take(intent);
    }

    /** The files opened that the page has not taken yet; each is given once. */
    @PluginMethod
    public void opened(PluginCall call) {
        JSArray files = new JSArray();
        synchronized (waiting) {
            for (JSObject file : waiting) files.put(file);
            waiting.clear();
        }
        JSObject result = new JSObject();
        result.put("files", files);
        call.resolve(result);
    }

    private void take(Intent intent) {
        Uri uri = uriOf(intent);
        if (uri == null) return;
        // Taken once: the activity made again (the phone turned, say) does not receive it twice.
        intent.setAction(Intent.ACTION_MAIN);
        intent.setData(null);
        intent.removeExtra(Intent.EXTRA_STREAM);
        // Read away from the screen: a file from a memory card can take a moment.
        new Thread(() -> {
            JSObject file = read(uri);
            synchronized (waiting) {
                waiting.add(file);
            }
            notifyListeners(OPENED, new JSObject());
        }).start();
    }

    @SuppressWarnings("deprecation")
    private static Uri uriOf(Intent intent) {
        if (intent == null) return null;
        String action = intent.getAction();
        if (Intent.ACTION_VIEW.equals(action)) return intent.getData();
        if (Intent.ACTION_SEND.equals(action)) {
            if (Build.VERSION.SDK_INT >= 33) return intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
            return intent.getParcelableExtra(Intent.EXTRA_STREAM);
        }
        return null;
    }

    private JSObject read(Uri uri) {
        String name = nameOf(uri);
        String text = "";
        if (READABLE.matcher(name).matches()) {
            try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
                if (in != null) text = readAll(in);
            } catch (Exception | OutOfMemoryError e) {
                text = "";
            }
        }
        JSObject file = new JSObject();
        file.put("name", name);
        file.put("text", text);
        return file;
    }

    /** The name the file has where it is kept; the end of its address when the app that gave it says none. */
    private String nameOf(Uri uri) {
        if ("content".equals(uri.getScheme())) {
            try (Cursor cursor = getContext().getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    String name = cursor.getString(0);
                    if (name != null && !name.isEmpty()) return name;
                }
            } catch (Exception e) {
                // The address's own end is the name, below.
            }
        }
        String last = uri.getLastPathSegment();
        return last == null ? "" : last.substring(last.lastIndexOf('/') + 1);
    }

    private static String readAll(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[64 * 1024];
        long total = 0;
        int n;
        while ((n = in.read(buffer)) != -1) {
            total += n;
            if (total > MOST) return "";
            out.write(buffer, 0, n);
        }
        return out.toString(StandardCharsets.UTF_8.name());
    }
}
