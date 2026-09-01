/**
 * Thin bridge to the native shell. Everything here degrades to a no-op in a
 * plain browser, so the same build runs on the web and inside Capacitor.
 */
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function platformName(): string {
  try {
    return Capacitor.getPlatform();
  } catch {
    return 'web';
  }
}

/**
 * Screens that own an in-progress activity register a handler so the Android
 * back button leaves the activity instead of the app. The most recently
 * registered handler wins, which matches how the screens nest.
 */
type BackHandler = () => boolean;
const backHandlers: BackHandler[] = [];

export function pushBackHandler(fn: BackHandler): () => void {
  backHandlers.push(fn);
  return () => {
    const i = backHandlers.indexOf(fn);
    if (i >= 0) backHandlers.splice(i, 1);
  };
}

function runBackHandlers(): boolean {
  for (let i = backHandlers.length - 1; i >= 0; i -= 1) {
    if (backHandlers[i]!()) return true;
  }
  return false;
}

let wired = false;

/**
 * Wire the hardware back button. `onBack` is the app's own history-back; it is
 * only called when no screen claimed the press. At the very top of the stack we
 * hand control back to Android rather than trapping the user in the app.
 */
export function initNativeShell(onBack: () => void, atRoot: () => boolean): void {
  if (wired || !isNative()) return;
  wired = true;

  void StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  void StatusBar.setBackgroundColor({ color: '#0E1017' }).catch(() => {});
  void SplashScreen.hide().catch(() => {});

  void App.addListener('backButton', () => {
    if (runBackHandlers()) return;
    if (atRoot()) {
      void App.exitApp();
      return;
    }
    onBack();
  });
}

export function applyStatusBarTheme(dark: boolean): void {
  if (!isNative()) return;
  void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
  void StatusBar.setBackgroundColor({ color: dark ? '#0E1017' : '#F4F6FC' }).catch(() => {});
}
