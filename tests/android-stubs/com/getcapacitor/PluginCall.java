package com.getcapacitor;
public class PluginCall {
  public String getString(String k, String d) { return d; }
  public Float getFloat(String k, Float d) { return d; }
  public void resolve() {}
  public void resolve(JSObject o) {}
  public void reject(String msg) {}
  public void setKeepAlive(Boolean b) {}
}
