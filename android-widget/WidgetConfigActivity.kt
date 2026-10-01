package com.teamelite.stats.widget

import android.app.Activity
import android.app.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.ListView
import android.widget.Toast
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class WidgetConfigActivity : Activity() {
    private var widgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        widgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID

        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        setResult(RESULT_CANCELED)

        val list = ListView(this)
        list.adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, arrayOf("Loading players…"))
        setContentView(list)

        thread(name = "og-elite-widget-player-loader") {
            try {
                val connection = URL("https://team-elite-stats.vercel.app/api/players")
                    .openConnection() as HttpURLConnection
                connection.connectTimeout = 8000
                connection.readTimeout = 10000
                connection.requestMethod = "GET"

                val code = connection.responseCode
                if (code !in 200..299) {
                    throw IllegalStateException("Players API returned HTTP $code")
                }

                val json = connection.inputStream.bufferedReader().use { it.readText() }
                connection.disconnect()

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

                            val result = Intent().putExtra(
                                AppWidgetManager.EXTRA_APPWIDGET_ID,
                                widgetId
                            )
                            setResult(RESULT_OK, result)
                            finish()
                        } catch (_: Exception) {
                            Toast.makeText(
                                this,
                                "Couldn't configure this widget. Try again.",
                                Toast.LENGTH_LONG
                            ).show()
                        }
                    }
                }
            } catch (_: Exception) {
                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    Toast.makeText(
                        this,
                        "Couldn't load players. Check your internet connection and try again.",
                        Toast.LENGTH_LONG
                    ).show()
                    finish()
                }
            }
        }
    }
}
