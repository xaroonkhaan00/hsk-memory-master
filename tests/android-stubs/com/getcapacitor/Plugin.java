package com.getcapacitor;
import android.content.Context;
public class Plugin {
  public void load() {}
  protected void handleOnPause() {}
  protected void handleOnDestroy() {}
  protected Context getContext() { return null; }
  protected void notifyListeners(String name, JSObject data) {}
}
