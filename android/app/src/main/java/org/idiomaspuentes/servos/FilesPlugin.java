package org.idiomaspuentes.servos;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.LabeledIntent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Files between Servos and the rest of the phone.
 *
 * A file that comes from outside, to be received (design, sections 7 and 11), as the app for computers does it
 * (`src-tauri/src/lib.rs`): a `.servos` opened with Servos from a file manager or a download («Abrir con»), or shared
 * to Servos from WhatsApp, Bluetooth or another app («Compartir»). Its name and its text wait here until the page takes
 * them ({@code opened}); the page is told when one comes ({@code archivos-abiertos}). A file that is not shared work is
 * not read: it arrives with no text, and «Recibir» says it is not one Servos can take.
 *
 * A file the app makes goes out by the phone's share sheet ({@code share}), with its own type (Capacitor's Share plugin
 * gives `*` for a type it does not know, and apps refuse it), or is kept on the phone, in a folder the person chooses.
 */
@CapacitorPlugin(name = "ServosFiles")
public class FilesPlugin extends Plugin {

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

    /**
     * Writes the file where the app keeps what it lets go of, and offers it to the phone's share sheet, with one more
     * place at its head: the phone itself («Guardar en el teléfono», its label from the page, in the app's language),
     * where the system asks for the folder (Descargas, a memory card). Many phones offer no other way to keep a file
     * of a type they do not know. Gives back the name it was saved under there, or nothing when it went elsewhere,
     * which Android does not say.
     */
    @PluginMethod
    public void share(PluginCall call) {
        String name = call.getString("name", "");
        String text = call.getString("text", "");
        String type = call.getString("type", "application/octet-stream");
        String keepHere = call.getString("keepHere", "");
        if (name.isEmpty() || name.contains("/")) {
            call.reject("No name");
            return;
        }
        try {
            File folder = new File(getContext().getCacheDir(), "compartir");
            if (!folder.isDirectory() && !folder.mkdirs()) throw new Exception("No folder");
            File file = new File(folder, name);
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(text.getBytes(StandardCharsets.UTF_8));
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(type);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_TITLE, name);
            send.setClipData(ClipData.newRawUri(name, uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, name);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (!keepHere.isEmpty()) {
                Intent create = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                create.addCategory(Intent.CATEGORY_OPENABLE);
                // The type its name says to Android: given another, the folder picker adds that type's extension
                // (`Jonás.servos.json`, `JON.usfm.txt`).
                create.setType(typeOfName(name));
                create.putExtra(Intent.EXTRA_TITLE, name);
                Intent here = new LabeledIntent(create, getContext().getPackageName(), keepHere, R.mipmap.ic_launcher);
                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[] { here });
            }
            startActivityForResult(call, chooser, "chosen");
        } catch (Exception e) {
            call.reject("Not shared", e);
        }
    }

    /** Where the sheet went: a file kept on the phone is written there now; anywhere else has the file already. */
    @ActivityCallback
    private void chosen(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        Uri place = data == null ? null : data.getData();
        JSObject answer = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || place == null) {
            call.resolve(answer);
            return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(place, "wt")) {
            if (out == null) throw new Exception("No place");
            out.write(call.getString("text", "").getBytes(StandardCharsets.UTF_8));
            answer.put("saved", nameOf(place));
            call.resolve(answer);
        } catch (Exception e) {
            call.reject("Not saved", e);
        }
    }

    private static String typeOfName(String name) {
        int dot = name.lastIndexOf('.');
        String known = dot < 0 ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substring(dot + 1).toLowerCase());
        return known == null ? "application/octet-stream" : known;
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
