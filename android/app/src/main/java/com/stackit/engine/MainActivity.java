package com.stackit.engine;

import android.os.Bundle;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Editör ~1180px genişlik ister. Sayfa küçük ekranlarda viewport genişliğini 1180 yapar;
        // WebView'in bunu dikkate alıp ekrana sığdırması için geniş görünüm açılır.
        WebSettings s = getBridge().getWebView().getSettings();
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
    }
}
