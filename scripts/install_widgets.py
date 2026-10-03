from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT / "android"
SRC = ROOT / "android-widget"
JAVA = ANDROID / "app/src/main/java/com/teamelite/stats/widget"
LAYOUT = ANDROID / "app/src/main/res/layout"
XML = ANDROID / "app/src/main/res/xml"
DRAWABLE = ANDROID / "app/src/main/res/drawable"
JAVA.mkdir(parents=True, exist_ok=True)
LAYOUT.mkdir(parents=True, exist_ok=True)
XML.mkdir(parents=True, exist_ok=True)
DRAWABLE.mkdir(parents=True, exist_ok=True)

for name in ["PerformanceWidget.kt", "WidgetRefreshWorker.kt", "WidgetRefreshService.kt", "WidgetConfigActivity.kt"]:
    (JAVA / name).write_text((SRC / name).read_text())

for name in ["widget_team.xml", "widget_player.xml"]:
    (LAYOUT / name).write_text((SRC / name).read_text())

for name in ["widget_bg.xml", "widget_badge_bg.xml"]:
    (DRAWABLE / name).write_text((SRC / name).read_text())

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

        <activity
            android:name="com.teamelite.stats.widget.WidgetConfigActivity"
            android:exported="true"
            android:theme="@android:style/Theme.Material.Light.Dialog">
        </activity>

        <service
            android:name="com.teamelite.stats.widget.WidgetRefreshService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
'''
if "com.teamelite.stats.widget.TeamPerformanceWidget" not in m:
    marker = "</application>"
    if marker not in m:
        raise SystemExit("AndroidManifest.xml has no application close tag")
    m = m.replace(marker, receivers + "\n    " + marker, 1)
    manifest.write_text(m)

print("OG ELITE widgets installed into generated Android project")
