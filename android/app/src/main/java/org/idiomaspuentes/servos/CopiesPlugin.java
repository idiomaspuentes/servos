package org.idiomaspuentes.servos;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.storage.StorageManager;
import android.os.storage.StorageVolume;
import android.provider.DocumentsContract;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Copies of the work outside the phone (design, section 11; philosophy, principle 9): in a folder the person chooses
 * once, on a memory card or a USB stick. Android remembers the permission, and the copies stay there even if Servos is
 * uninstalled. Each copy is written whole under a name of its own before the oldest goes, so a copy cut short (the card
 * pulled out, the battery gone) never leaves the folder without a good one. What the copies say is the page's to
 * decide (`frame/copies.ts`): sealed with a password and named so they say nothing, or open.
 */
@CapacitorPlugin(name = "ServosCopies")
public class CopiesPlugin extends Plugin {

    /** A copy being written: it becomes a copy only once it is whole. */
    private static final String UNFINISHED = ".parcial";

    /** Whether there is a memory card or a USB stick in the phone now, and its name as the phone says it. */
    @PluginMethod
    public void card(PluginCall call) {
        JSObject answer = new JSObject();
        StorageVolume card = removable();
        answer.put("present", card != null);
        if (card != null) answer.put("label", card.getDescription(getContext()));
        call.resolve(answer);
    }

    /** Asks the person for the folder, opening on the card when there is one; the folder chosen, or nothing. */
    @PluginMethod
    public void choose(PluginCall call) {
        Intent pick = null;
        StorageVolume card = removable();
        if (card != null && Build.VERSION.SDK_INT >= 29) pick = card.createOpenDocumentTreeIntent();
        if (pick == null) pick = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        pick.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        );
        startActivityForResult(call, pick, "chosen");
    }

    @ActivityCallback
    private void chosen(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject answer = new JSObject();
        Uri tree = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || tree == null) {
            call.resolve(answer);
            return;
        }
        try {
            getContext()
                .getContentResolver()
                .takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            answer.put("folder", tree.toString());
            answer.put("label", labelOf(tree));
            call.resolve(answer);
        } catch (Exception e) {
            call.reject("No folder", e);
        }
    }

    /** Whether the folder can be written now: the card is in and the permission still held. */
    @PluginMethod
    public void ready(PluginCall call) {
        JSObject answer = new JSObject();
        answer.put("ready", folderOf(call.getString("folder", "")) != null);
        call.resolve(answer);
    }

    /**
     * Writes a copy: whole under a passing name, then under its own; then, of the copies whose names start alike, only
     * the newest `keep` stay (their names sort by when they were made).
     */
    @PluginMethod
    public void write(PluginCall call) {
        String name = call.getString("name", "");
        String prefix = call.getString("prefix", "");
        String text = call.getString("text", "");
        int keep = call.getInt("keep", 3);
        if (name.isEmpty() || prefix.isEmpty() || name.contains("/") || !name.startsWith(prefix)) {
            call.reject("No name");
            return;
        }
        // Away from the screen: a whole project with its recordings can take a moment on a card.
        new Thread(() -> {
            try {
                Uri folder = folderOf(call.getString("folder", ""));
                if (folder == null) {
                    call.reject("No folder", "missing");
                    return;
                }
                ContentResolver files = getContext().getContentResolver();
                Uri passing = DocumentsContract.createDocument(files, folder, "application/octet-stream", name + UNFINISHED);
                if (passing == null) throw new Exception("Not created");
                try (OutputStream out = files.openOutputStream(passing, "wt")) {
                    if (out == null) throw new Exception("Not opened");
                    out.write(text.getBytes(StandardCharsets.UTF_8));
                }
                // A copy of the same name made the same minute gives way to this one.
                for (String[] old : children(folder)) if (old[1].equals(name)) DocumentsContract.deleteDocument(files, Uri.parse(old[0]));
                Uri done = DocumentsContract.renameDocument(files, passing, name);
                if (done == null) throw new Exception("Not renamed");
                List<String[]> alike = new ArrayList<>();
                for (String[] child : children(folder)) {
                    if (!child[1].startsWith(prefix)) continue;
                    // A copy cut short before: it never became one.
                    if (child[1].endsWith(UNFINISHED)) {
                        if (!child[1].equals(name + UNFINISHED)) DocumentsContract.deleteDocument(files, Uri.parse(child[0]));
                        continue;
                    }
                    alike.add(child);
                }
                Collections.sort(alike, (a, b) -> b[1].compareTo(a[1]));
                for (int i = keep; i < alike.size(); i++) DocumentsContract.deleteDocument(files, Uri.parse(alike.get(i)[0]));
                call.resolve();
            } catch (Exception e) {
                call.reject("Not written", e);
            }
        }).start();
    }

    /** Deletes the copies the app made there: the files whose whole name is of the pattern its copies have, no other. */
    @PluginMethod
    public void erase(PluginCall call) {
        String pattern = call.getString("pattern", "");
        if (pattern.isEmpty()) {
            call.reject("No pattern");
            return;
        }
        try {
            Uri folder = folderOf(call.getString("folder", ""));
            int erased = 0;
            if (folder != null) {
                for (String[] child : children(folder)) {
                    if (!child[1].matches(pattern)) continue;
                    if (DocumentsContract.deleteDocument(getContext().getContentResolver(), Uri.parse(child[0]))) erased++;
                }
            }
            JSObject answer = new JSObject();
            answer.put("erased", erased);
            call.resolve(answer);
        } catch (Exception e) {
            call.reject("Not erased", e);
        }
    }

    /** Lets go of the folder: Android forgets the app may write there. */
    @PluginMethod
    public void forget(PluginCall call) {
        try {
            Uri tree = Uri.parse(call.getString("folder", ""));
            getContext()
                .getContentResolver()
                .releasePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        } catch (Exception e) {
            // Already forgotten.
        }
        call.resolve();
    }

    private StorageVolume removable() {
        StorageManager storage = (StorageManager) getContext().getSystemService(Context.STORAGE_SERVICE);
        for (StorageVolume volume : storage.getStorageVolumes()) {
            if (volume.isRemovable() && "mounted".equals(volume.getState())) return volume;
        }
        return null;
    }

    /** The folder's own document, when the permission is held and it is there; null when the card is out. */
    private Uri folderOf(String tree) {
        if (tree.isEmpty()) return null;
        try {
            Uri uri = Uri.parse(tree);
            boolean held = false;
            for (android.content.UriPermission p : getContext().getContentResolver().getPersistedUriPermissions()) {
                if (p.getUri().equals(uri) && p.isWritePermission()) held = true;
            }
            if (!held) return null;
            Uri folder = DocumentsContract.buildDocumentUriUsingTree(uri, DocumentsContract.getTreeDocumentId(uri));
            try (
                Cursor c = getContext()
                    .getContentResolver()
                    .query(folder, new String[] { DocumentsContract.Document.COLUMN_DOCUMENT_ID }, null, null, null)
            ) {
                return c != null && c.moveToFirst() ? folder : null;
            }
        } catch (Exception e) {
            return null;
        }
    }

    /** The files in a folder: each its address and its name. */
    private List<String[]> children(Uri folder) {
        List<String[]> found = new ArrayList<>();
        Uri list = DocumentsContract.buildChildDocumentsUriUsingTree(folder, DocumentsContract.getDocumentId(folder));
        String[] columns = { DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME };
        try (Cursor c = getContext().getContentResolver().query(list, columns, null, null, null)) {
            while (c != null && c.moveToNext()) {
                found.add(new String[] { DocumentsContract.buildDocumentUriUsingTree(folder, c.getString(0)).toString(), c.getString(1) });
            }
        }
        return found;
    }

    /** How the person would name the folder: the card's name and the folder's («Tarjeta SD › Servos»). */
    private String labelOf(Uri tree) {
        String id = DocumentsContract.getTreeDocumentId(tree);
        String path = id.contains(":") ? id.substring(id.indexOf(':') + 1) : "";
        String volume = id.contains(":") ? id.substring(0, id.indexOf(':')) : id;
        String where = volume;
        StorageManager storage = (StorageManager) getContext().getSystemService(Context.STORAGE_SERVICE);
        for (StorageVolume v : storage.getStorageVolumes()) {
            String uuid = v.getUuid();
            if ((uuid != null && uuid.equalsIgnoreCase(volume)) || (uuid == null && "primary".equals(volume))) where = v.getDescription(getContext());
        }
        return path.isEmpty() ? where : where + " › " + path.replace("/", " › ");
    }
}
