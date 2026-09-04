# R8 rules for release builds.
#
# `build.gradle` has always pointed `proguardFiles` at this file, but it did not
# exist, so every release build failed at configuration time with
# "Supplied proguard configuration does not exist". Flutter and most plugins
# ship their own consumer rules; what is left here is the handful R8 cannot
# work out on its own.

# Flutter's embedding is reached reflectively by the generated registrant.
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Deferred components are a Play Store feature this app does not use. Without
# this, R8 stops on the missing Play Core classes Flutter's embedding refers to.
-dontwarn com.google.android.play.core.**

# Plugins that register services, receivers or callbacks by name in the
# manifest: the class must survive shrinking or the system cannot construct it.
-keep class id.flutter.flutter_background_service.** { *; }
-keep class com.dexterous.flutterlocalnotifications.** { *; }

# Annotations R8 warns about but that nothing here needs at runtime.
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
