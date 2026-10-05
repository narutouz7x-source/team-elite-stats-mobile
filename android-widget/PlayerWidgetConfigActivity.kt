package com.teamelite.stats.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.ListView
import android.widget.TextView
import android.graphics.Color
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class PlayerWidgetConfigActivity : Activity() {
    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private val api = "https://team-elite-stats.vercel.app/api/mobile-widget"

    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        appWidgetId = intent?.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            ?: AppWidgetManager.INVALID_APPWIDGET_ID
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return }

        val title = TextView(this).apply {
            text = "Choose player"
            textSize = 22f
            setTextColor(Color.WHITE)
            setPadding(28, 28, 28, 18)
        }
        val list = ListView(this)
        val root = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(18,18,22))
            addView(title)
            addView(list, android.widget.LinearLayout.LayoutParams(-1, 0, 1f))
        }
        setContentView(root)

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val players = withContext(Dispatchers.IO) { loadPlayers() }
                val names = ArrayList<String>()
                val ids = ArrayList<String>()
                for (i in 0 until players.length()) {
                    val p = players.getJSONObject(i)
                    names.add(p.optString("name", "PLAYER"))
                    ids.add(p.optString("id"))
                }
                list.adapter = ArrayAdapter(this@PlayerWidgetConfigActivity, android.R.layout.simple_list_item_1, names)
                list.setOnItemClickListener { _, _, position, _ ->
                    getSharedPreferences("og_elite_widgets", Context.MODE_PRIVATE).edit()
                        .putString("player_$appWidgetId", ids[position]).apply()
                    val manager = AppWidgetManager.getInstance(this@PlayerWidgetConfigActivity)
                    WidgetRefreshWorker.showLoading(this@PlayerWidgetConfigActivity, manager, intArrayOf(appWidgetId))
                    WidgetRefreshWorker.enqueue(this@PlayerWidgetConfigActivity)
                    setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId))
                    finish()
                }
            } catch (e: Exception) {
                title.text = "Couldn't load players\n" + (e.message ?: "Try again")
            }
        }
    }

    private fun loadPlayers(): JSONArray {
        val c = URL(api).openConnection() as HttpURLConnection
        c.connectTimeout = 8000
        c.readTimeout = 12000
        c.setRequestProperty("Accept", "application/json")
        return try {
            if (c.responseCode !in 200..299) error("HTTP " + c.responseCode)
            JSONArray(JSONObject(c.inputStream.bufferedReader().use { it.readText() }).getJSONArray("players").toString())
        } finally { c.disconnect() }
    }
}