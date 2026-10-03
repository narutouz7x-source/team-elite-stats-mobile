package com.teamelite.stats.widget

import android.app.Activity
import android.app.AppWidgetManager
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.widget.ArrayAdapter
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.TextView
import android.widget.Toast
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class WidgetConfigActivity : Activity() {
    private var widgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        widgetId = intent?.getIntExtra(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID

        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        setResult(RESULT_CANCELED)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 24, 28, 18)
            setBackgroundColor(Color.rgb(16, 18, 24))
        }

        val title = TextView(this).apply {
            text = "OG ELITE • SELECT PLAYER"
            textSize = 18f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, 16)
        }
        root.addView(title, LinearLayout.LayoutParams(-1, -2))

        val list = ListView(this)
        root.addView(list, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)

        list.adapter = ArrayAdapter(
            this,
            android.R.layout.simple_list_item_1,
            arrayOf("Loading players…")
        )

        thread(name = "og-elite-widget-player-loader") {
            try {
                val connection = URL("https://team-elite-stats.vercel.app/api/players")
                    .openConnection() as HttpURLConnection
                connection.connectTimeout = 8000
                connection.readTimeout = 10000
                connection.requestMethod = "GET"
                connection.instanceFollowRedirects = true
                connection.setRequestProperty("User-Agent", "OG-ELITE-STATS-Android-Widget")

                val json = try {
                    val code = connection.responseCode
                    if (code !in 200..299) throw IllegalStateException("HTTP $code")
                    connection.inputStream.bufferedReader().use { it.readText() }
                } finally {
                    connection.disconnect()
                }

                val players = JSONArray(json)
                val names = Array(players.length()) { i ->
                    players.getJSONObject(i).optString("name", "Player")
                }

                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    list.adapter = ArrayAdapter(
                        this,
                        android.R.layout.simple_list_item_1,
                        names
                    )
                    list.setOnItemClickListener { _, _, position, _ ->
                        try {
                            val id = players.getJSONObject(position).optString("id")
                            if (id.isBlank()) throw IllegalStateException("Player has no ID")

                            getSharedPreferences("og_elite_widgets", MODE_PRIVATE)
                                .edit()
                                .putString("player_$widgetId", id)
                                .apply()

                            WidgetRefreshWorker.enqueue(this, immediate = true)

                            setResult(
                                RESULT_OK,
                                Intent().putExtra(
                                    AppWidgetManager.EXTRA_APPWIDGET_ID,
                                    widgetId
                                )
                            )
                            finish()
                        } catch (error: Exception) {
                            Toast.makeText(
                                this,
                                error.message ?: "Couldn't configure this widget.",
                                Toast.LENGTH_LONG
                            ).show()
                        }
                    }
                }
            } catch (error: Exception) {
                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    Toast.makeText(
                        this,
                        "Couldn't load players. Check your internet connection and try again.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }
}