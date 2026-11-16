package com.adiuniversity.portal.staff;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * ADI staff app: the portal's Transcript Office, working with no internet and no server.
 *
 * The page is a copy of the portal packed in the app (assets/site). Every address the page asks for is answered
 * from that copy; anything else gets "not found", so nothing is ever fetched from, or sent to, the network.
 * Files the page produces (transcripts, the export of records) are written to the phone's Download/ADI folder.
 */
public class StaffActivity extends Activity {
    private static final String HOST = "adi-portal.onrender.com";   // the page keeps the portal's own address; it is never contacted
    private static final String START = "https://" + HOST + "/";
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        int navy = Color.parseColor("#0B2559");
        getWindow().setStatusBarColor(navy);
        getWindow().setNavigationBarColor(navy);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // records and the PIN check are kept in the app's own storage
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(false);
        web.setWebChromeClient(new WebChromeClient());   // shows the page's own confirmation dialogs
        web.addJavascriptInterface(new Bridge(), "AdiStaff");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return serve(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return leave(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return leave(Uri.parse(url));
            }
        });
        setContentView(web);
        web.loadUrl(START);
    }

    /** Answers a request of the page from the packed copy; never from the network. */
    private WebResourceResponse serve(Uri uri) {
        String scheme = uri == null ? null : uri.getScheme();
        if (!"https".equals(scheme) && !"http".equals(scheme)) return null;   // data: and blob: are handled by the page itself
        if (HOST.equalsIgnoreCase(uri.getHost())) {
            String path = uri.getPath();
            if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
            if (!path.contains("..")) {
                try {
                    InputStream in = getAssets().open("site" + path);
                    String mime = mimeOf(path);
                    boolean text = mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json");
                    Map<String, String> h = new HashMap<>();
                    h.put("Cache-Control", "no-store");
                    return new WebResourceResponse(mime, text ? "utf-8" : null, 200, "OK", h, in);
                } catch (Exception e) {
                    // not in the packed copy: answered below
                }
            }
        }
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
    }

    private static String mimeOf(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    /** Links that leave the packed copy (e-mail, telephone, other websites) open in their own apps. */
    private boolean leave(Uri uri) {
        if (uri == null) return true;
        String scheme = uri.getScheme();
        if (("https".equals(scheme) || "http".equals(scheme)) && HOST.equalsIgnoreCase(uri.getHost())) return false;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception e) {
            Toast.makeText(this, R.string.staffCannotOpen, Toast.LENGTH_LONG).show();
        }
        return true;
    }

    /** Called by the page to save a file it has produced. Returns where the file was written. */
    private class Bridge {
        @JavascriptInterface
        public String saveFile(String name, String base64, String mime) throws Exception {
            final String clean = (name == null || name.trim().isEmpty() ? "ADI-document" : name).replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]+", "_");
            final String type = mime == null || mime.isEmpty() ? "application/octet-stream" : mime;
            byte[] data = Base64.decode(base64, Base64.DEFAULT);
            final Uri uri;
            String where;
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, clean);
                v.put(MediaStore.MediaColumns.MIME_TYPE, type);
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/ADI");
                uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new Exception("storage unavailable");
                try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                    if (out == null) throw new Exception("storage unavailable");
                    out.write(data);
                }
                where = "Download/ADI/" + clean;
            } else {
                File dir = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "ADI");
                if (!dir.isDirectory() && !dir.mkdirs()) throw new Exception("storage unavailable");
                File f = new File(dir, clean);
                try (FileOutputStream out = new FileOutputStream(f)) {
                    out.write(data);
                }
                uri = FileProvider.getUriForFile(StaffActivity.this, getPackageName() + ".files", f);
                where = f.getAbsolutePath();
            }
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    offer(uri, type, clean);
                }
            });
            return where;
        }
    }

    /** A transcript opens in the phone's PDF viewer (to print or share); other files are offered to share. */
    private void offer(Uri uri, String type, String name) {
        try {
            Intent i;
            if ("application/pdf".equals(type)) {
                i = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, type);
            } else {
                i = new Intent(Intent.ACTION_SEND).setType(type).putExtra(Intent.EXTRA_STREAM, uri);
            }
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(i, name));
        } catch (Exception e) {
            Toast.makeText(this, R.string.staffSaved, Toast.LENGTH_LONG).show();
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}
