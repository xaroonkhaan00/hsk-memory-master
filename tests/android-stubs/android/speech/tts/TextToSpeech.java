package android.speech.tts;
import android.content.Context;
import android.os.Bundle;
import java.util.HashMap;
import java.util.Locale;
import java.util.Set;
public class TextToSpeech {
  public static final int SUCCESS = 0, ERROR = -1, QUEUE_FLUSH = 0;
  public static final int LANG_MISSING_DATA = -2, LANG_NOT_SUPPORTED = -3;
  public static final int LANG_AVAILABLE = 0, LANG_COUNTRY_AVAILABLE = 1, LANG_COUNTRY_VAR_AVAILABLE = 2;
  public interface OnInitListener { void onInit(int status); }
  public static class Engine { public static final String KEY_PARAM_UTTERANCE_ID = "id"; }
  public TextToSpeech(Context c, OnInitListener l) {}
  public int setLanguage(Locale l) { return 0; }
  public void setOnUtteranceProgressListener(UtteranceProgressListener l) {}
  public Set<Voice> getVoices() { return null; }
  public void setVoice(Voice v) {}
  public void setSpeechRate(float r) {}
  public void setPitch(float p) {}
  public int speak(CharSequence t, int mode, Bundle p, String id) { return 0; }
  public int speak(String t, int mode, HashMap<String,String> p) { return 0; }
  public void stop() {}
  public void shutdown() {}
  public String getDefaultEngine() { return ""; }
}
