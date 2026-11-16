package com.adiuniversity.portal;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

/**
 * First screen of the app. It shows the pages packed inside the app (programmes, fees, contacts), which need
 * neither internet nor the server. Links to the portal open the live portal full screen (LauncherActivity);
 * phone, e-mail, WhatsApp and other links open in their own apps.
 */
public class HomeActivity extends Activity {
    private static final String HOME = "file:///android_asset/offline/index.html";
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        int navy = Color.parseColor("#0B2559");
        getWindow().setStatusBarColor(navy);
        getWindow().setNavigationBarColor(navy);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#F2F4F9"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);   // only the app's own packed page runs here; every web address opens outside this view
        s.setDomStorageEnabled(true);   // remembers the chosen language
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return route(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return route(Uri.parse(url));
            }
        });
        setContentView(web);
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) web.loadUrl(HOME);
    }

    private boolean route(Uri uri) {
        if (uri == null) return true;
        String scheme = uri.getScheme();
        if ("file".equals(scheme)) return !String.valueOf(uri).startsWith("file:///android_asset/");
        try {
            if ("https".equals(scheme) && getString(R.string.hostName).equalsIgnoreCase(uri.getHost())) {
                startActivity(new Intent(this, LauncherActivity.class).setData(uri));
            } else {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            }
        } catch (Exception e) {
            Toast.makeText(this, R.string.cannotOpen, Toast.LENGTH_LONG).show();
        }
        return true;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}
