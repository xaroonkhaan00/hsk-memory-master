package com.mfb.learnhsk3;

import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Mandarin speech through Android's own TextToSpeech engine.
 *
 * The WebView's speechSynthesis is not usable here: on Android 11 and later the
 * package-visibility rules hide the TTS service unless the manifest asks for it,
 * and even when voices are visible the WebView's `onend` event is unreliable —
 * which is fatal for a story or a dialogue that has to advance when a line
 * actually finishes. This plugin talks to the platform engine directly and
 * resolves each speak() call from a real UtteranceProgressListener callback.
 */
@CapacitorPlugin(name = "MandarinTts")
public class MandarinTtsPlugin extends Plugin {

    private TextToSpeech tts;
    private volatile boolean initialized = false;
    private volatile boolean initFailed = false;
    private volatile int languageStatus = TextToSpeech.LANG_NOT_SUPPORTED;
    private volatile String lastError = "";
    private volatile String engineName = "";

    /** Calls waiting for the engine to finish starting up. */
    private final List<PluginCall> awaitingInit = new ArrayList<>();
    /** Utterances in flight, so each speak() resolves on its own completion. */
    private final Map<String, PluginCall> pending = new ConcurrentHashMap<>();
    private final AtomicInteger sequence = new AtomicInteger(0);

    @Override
    public void load() {
        startEngine();
    }

    private synchronized void startEngine() {
        if (tts != null) return;
        try {
            tts = new TextToSpeech(getContext(), status -> {
                if (status == TextToSpeech.SUCCESS) {
                    applyLanguage();
                    initialized = true;
                    initFailed = false;
                    try {
                        engineName = tts.getDefaultEngine() == null ? "" : tts.getDefaultEngine();
                    } catch (Exception ignored) {
                        engineName = "";
                    }
                } else {
                    initialized = false;
                    initFailed = true;
                    lastError = "TextToSpeech init failed with status " + status;
                }
                flushAwaitingInit();
            });
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {
                    JSObject event = new JSObject();
                    event.put("id", utteranceId);
                    notifyListeners("ttsStart", event);
                }

                @Override
                public void onDone(String utteranceId) {
                    finish(utteranceId, true, null);
                }

                @Override
                public void onStop(String utteranceId, boolean interrupted) {
                    finish(utteranceId, false, "cancelled");
                }

                @Override
                @Deprecated
                public void onError(String utteranceId) {
                    finish(utteranceId, false, "engine error");
                }

                @Override
                public void onError(String utteranceId, int errorCode) {
                    finish(utteranceId, false, "engine error " + errorCode);
                }
            });
        } catch (Exception e) {
            initFailed = true;
            lastError = "Could not create TextToSpeech: " + e.getMessage();
            flushAwaitingInit();
        }
    }

    /** zh-CN if the engine has it, otherwise any Chinese the engine does have. */
    private void applyLanguage() {
        int status = tts.setLanguage(Locale.SIMPLIFIED_CHINESE);
        if (status == TextToSpeech.LANG_MISSING_DATA || status == TextToSpeech.LANG_NOT_SUPPORTED) {
            int fallback = tts.setLanguage(Locale.CHINESE);
            if (fallback != TextToSpeech.LANG_MISSING_DATA && fallback != TextToSpeech.LANG_NOT_SUPPORTED) {
                status = fallback;
            } else {
                lastError = status == TextToSpeech.LANG_MISSING_DATA
                    ? "Chinese voice data is not installed on this device"
                    : "This device's speech engine does not support Chinese";
            }
        }
        languageStatus = status;
    }

    private synchronized void flushAwaitingInit() {
        for (PluginCall call : awaitingInit) {
            call.resolve(statusObject());
        }
        awaitingInit.clear();
    }

    private void finish(String utteranceId, boolean ok, String error) {
        PluginCall call = pending.remove(utteranceId);
        JSObject event = new JSObject();
        event.put("id", utteranceId);
        event.put("ok", ok);
        if (error != null) event.put("error", error);
        notifyListeners(ok ? "ttsDone" : "ttsError", event);
        if (call == null) return;
        if (ok) {
            JSObject result = new JSObject();
            result.put("completed", true);
            call.resolve(result);
        } else if ("cancelled".equals(error)) {
            // Stopping playback is a normal thing to do, not a failure.
            JSObject result = new JSObject();
            result.put("completed", false);
            result.put("cancelled", true);
            call.resolve(result);
        } else {
            lastError = error == null ? "unknown error" : error;
            call.reject(lastError);
        }
    }

    private boolean languageOk() {
        return languageStatus == TextToSpeech.LANG_AVAILABLE
            || languageStatus == TextToSpeech.LANG_COUNTRY_AVAILABLE
            || languageStatus == TextToSpeech.LANG_COUNTRY_VAR_AVAILABLE;
    }

    private JSObject statusObject() {
        JSObject out = new JSObject();
        out.put("available", tts != null && !initFailed);
        out.put("initialized", initialized);
        out.put("languageAvailable", languageOk());
        out.put("languageStatus", languageStatus);
        out.put("engine", engineName);
        out.put("locale", "zh-CN");
        out.put("error", lastError);
        out.put("voices", voiceArray());
        return out;
    }

    /**
     * Voice gender is reported only when the engine's own voice name carries it
     * (Google's Chinese voices are named like "zh-CN-language#male_1-local").
     * Android has no gender field, so anything else is honestly unknown.
     */
    private static String genderOf(String name) {
        String lower = name.toLowerCase(Locale.US);
        if (lower.contains("female") || lower.contains("#f") || lower.contains("-f-")) return "female";
        if (lower.contains("male") || lower.contains("#m") || lower.contains("-m-")) return "male";
        return "";
    }

    private JSArray voiceArray() {
        JSArray arr = new JSArray();
        if (tts == null || !initialized) return arr;
        try {
            Set<Voice> voices = tts.getVoices();
            if (voices == null) return arr;
            for (Voice v : voices) {
                Locale locale = v.getLocale();
                if (locale == null) continue;
                String lang = locale.getLanguage();
                if (!"zh".equalsIgnoreCase(lang) && !"cmn".equalsIgnoreCase(lang)) continue;
                JSObject item = new JSObject();
                item.put("id", v.getName());
                item.put("name", v.getName());
                item.put("lang", locale.toLanguageTag());
                item.put("quality", v.getQuality());
                item.put("networkRequired", v.isNetworkConnectionRequired());
                item.put("gender", genderOf(v.getName()));
                String country = locale.getCountry();
                item.put("mainland", "CN".equalsIgnoreCase(country) || country == null || country.isEmpty());
                arr.put(item);
            }
        } catch (Exception e) {
            lastError = "Could not list voices: " + e.getMessage();
        }
        return arr;
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        startEngine();
        if (initialized || initFailed) {
            call.resolve(statusObject());
            return;
        }
        synchronized (this) {
            awaitingInit.add(call);
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(statusObject());
    }

    @PluginMethod
    public void voices(PluginCall call) {
        JSObject out = new JSObject();
        out.put("voices", voiceArray());
        call.resolve(out);
    }

    private void selectVoice(String voiceId) {
        if (voiceId == null || voiceId.isEmpty() || tts == null) return;
        try {
            Set<Voice> voices = tts.getVoices();
            if (voices == null) return;
            for (Voice v : voices) {
                if (voiceId.equals(v.getName())) {
                    tts.setVoice(v);
                    return;
                }
            }
        } catch (Exception ignored) {
            // An engine that refuses voice selection still speaks in zh-CN.
        }
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        if (text == null || text.trim().isEmpty()) {
            call.reject("No text to speak");
            return;
        }
        startEngine();
        if (initFailed) {
            call.reject(lastError.isEmpty() ? "Speech engine unavailable" : lastError);
            return;
        }
        if (!initialized) {
            call.reject("Speech engine is still starting");
            return;
        }
        if (!languageOk()) {
            call.reject(lastError.isEmpty() ? "Chinese is not available on this device" : lastError);
            return;
        }

        applyLanguage();
        selectVoice(call.getString("voiceId", ""));

        float rate = call.getFloat("rate", 0.85f);
        float pitch = call.getFloat("pitch", 1.0f);
        tts.setSpeechRate(Math.max(0.4f, Math.min(2.0f, rate)));
        tts.setPitch(Math.max(0.5f, Math.min(2.0f, pitch)));

        String id = "u" + sequence.incrementAndGet();
        pending.put(id, call);
        call.setKeepAlive(true);

        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Bundle params = new Bundle();
            params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, id);
            result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, id);
        } else {
            HashMap<String, String> params = new HashMap<>();
            params.put(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, id);
            result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, params);
        }

        if (result != TextToSpeech.SUCCESS) {
            pending.remove(id);
            lastError = "The speech engine refused the request";
            call.reject(lastError);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (tts != null) {
            try {
                tts.stop();
            } catch (Exception ignored) {
            }
        }
        // Resolve rather than reject: a deliberate stop is not an error.
        for (Map.Entry<String, PluginCall> entry : pending.entrySet()) {
            JSObject result = new JSObject();
            result.put("completed", false);
            result.put("cancelled", true);
            entry.getValue().resolve(result);
        }
        pending.clear();
        call.resolve();
    }

    @Override
    protected void handleOnPause() {
        if (tts != null) {
            try {
                tts.stop();
            } catch (Exception ignored) {
            }
        }
        for (Map.Entry<String, PluginCall> entry : pending.entrySet()) {
            JSObject result = new JSObject();
            result.put("completed", false);
            result.put("cancelled", true);
            entry.getValue().resolve(result);
        }
        pending.clear();
        super.handleOnPause();
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception ignored) {
            }
            tts = null;
            initialized = false;
        }
        super.handleOnDestroy();
    }
}
