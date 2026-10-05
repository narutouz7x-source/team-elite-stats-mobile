from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT / "android"
SRC = ROOT / "android-widget"

JAVA = ANDROID / "app/src/main/java/com/teamelite/stats/widget"
LAYOUT = ANDROID / "app/src/main/res/layout"
XML = ANDROID / "app/src/main/res/xml"
DRAWABLE = ANDROID / "app/src/main/res/drawable"

for folder in (JAVA, LAYOUT, XML, DRAWABLE):
    folder.mkdir(parents=True, exist_ok=True)

# Clean widget sources from the generated Android project before installing
# the current implementation.
for path in JAVA.glob("*.kt"):
    path.unlink()
for path in LAYOUT.glob("widget_*.xml"):
    path.unlink()
for path in XML.glob("widget_info_*.xml"):
    path.unlink()

for name in ["OgEliteApplication.kt", "PerformanceWidget.kt", "WidgetRefreshWorker.kt"]:
    (JAVA / name).write_text((SRC / name).read_text())

for name in ["widget_loading.xml", "widget_stats.xml", "widget_strip.xml"]:
    (LAYOUT / name).write_text((SRC / name).read_text())

for name in ["widget_info_team.xml", "widget_info_player.xml"]:
    (XML / name).write_text((SRC / name).read_text())

logo = ROOT / "assets/og-elite-icon.png"
if logo.exists():
    (DRAWABLE / "og_elite_widget_logo.png").write_bytes(logo.read_bytes())

gradle = ANDROID / "app/build.gradle"
g = gradle.read_text()
if "androidx.work:work-runtime-ktx" not in g:
    marker = "dependencies {"
    if marker not in g:
        raise SystemExit("android/app/build.gradle has no dependencies block")
    g = g.replace(marker, marker + '\n    implementation "androidx.work:work-runtime-ktx:2.10.1"', 1)
    gradle.write_text(g)

manifest = ANDROID / "app/src/main/AndroidManifest.xml"
m = manifest.read_text()

if 'android:name="com.teamelite.stats.widget.OgEliteApplication"' not in m:
    m = m.replace(
        "<application ",
        '<application android:name="com.teamelite.stats.widget.OgEliteApplication" ',
        1
    )

permission_block = '''    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
'''
if "android.permission.INTERNET" not in m:
    start = m.find("<manifest ")
    end = m.find(">", start)
    if start == -1 or end == -1:
        raise SystemExit("AndroidManifest.xml has no manifest tag")
    m = m[:end + 1] + permission_block + m[end + 1:]

receivers = '''
        <receiver
            android:name="com.teamelite.stats.widget.TeamPerformanceWidget"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/widget_info_team" />
        </receiver>

        <receiver
            android:name="com.teamelite.stats.widget.PlayerPerformanceWidget"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/widget_info_player" />
        </receiver>
'''
if "com.teamelite.stats.widget.TeamPerformanceWidget" not in m:
    marker = "</application>"
    if marker not in m:
        raise SystemExit("AndroidManifest.xml has no application close tag")
    m = m.replace(marker, receivers + "\n    " + marker, 1)

# WorkManager uses OgEliteApplication as its Configuration.Provider.
# Remove the default AndroidX Startup initializer from the final manifest.
m = m.replace('    </application>', '        <provider android:name="androidx.startup.InitializationProvider" android:authorities="\${applicationId}.androidx-startup" android:exported="false" tools:node="remove" />\n    </application>', 1)
m = m.replace('xmlns:android="http://schemas.android.com/apk/res/android"', 'xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools"', 1)
manifest.write_text(m)
print("Installed clean OG ELITE widget implementation")
