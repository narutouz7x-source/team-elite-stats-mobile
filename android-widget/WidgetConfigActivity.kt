package com.teamelite.stats.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.ListView
import android.widget.Toast
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL

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

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val connection = URL("https://team-elite-stats.vercel.app/api/players").openConnection() as HttpURLConnection
                connection.connectTimeout = 8000
                connection.readTimeout = 10000
                val json = connection.inputStream.bufferedReader().use { it.readText() }
                connection.disconnect()
                val players = JSONArray(json)
                val names = Array(players.length()) { i -> players.getJSONObject(i).optString("name", "Player") }
                runOnUiThread {
                    list.adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, names)
                    list.setOnItemClickListener { _, _, position, _ ->
                        val id = players.getJSONObject(position).optString("id")
                        getSharedPreferences("og_elite_widgets", MODE_PRIVATE)
                            .edit().putString("player_$widgetId", id).apply()
                        val manager = AppWidgetManager.getInstance(this)
                        manager.updateAppWidget(widgetId, null)
                        WidgetRefreshWorker.enqueue(this, immediate = true)
                        val result = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
                        setResult(RESULT_OK, result)
                        finish()
                    }
                }
            } catch (_: Exception) {
                runOnUiThread {
                    Toast.makeText(this, "Couldn't load players. Try again.", Toast.LENGTH_LONG).show()
                    finish()
                }
            }
        }
    }
}
