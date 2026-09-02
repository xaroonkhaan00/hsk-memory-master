# Android API stubs

Minimal stand-ins for the Android and Capacitor classes the native plugin uses.

There is no Android SDK in CI, so the plugin cannot be compiled against the real
framework here. Compiling against these stubs still catches the mistakes that
actually break a native plugin: a wrong method signature, an override that does
not match its supertype, a bad generic, or a call that no longer exists.

They are for type-checking only and are never packaged into the app.
