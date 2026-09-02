package com.mfb.learnhsk3;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registered before the bridge starts, so the web layer can call the
        // Mandarin engine on its very first render.
        registerPlugin(MandarinTtsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
