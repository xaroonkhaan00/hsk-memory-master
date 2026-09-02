package android.speech.tts;
public abstract class UtteranceProgressListener {
  public abstract void onStart(String utteranceId);
  public abstract void onDone(String utteranceId);
  public void onStop(String utteranceId, boolean interrupted) {}
  @Deprecated public abstract void onError(String utteranceId);
  public void onError(String utteranceId, int errorCode) {}
}
