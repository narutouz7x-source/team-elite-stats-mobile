package com.teamelite.stats.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.graphics.BitmapFactory
import android.widget.RemoteViews
import androidx.work.*
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

class WidgetRefreshWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    companion object {
        private const val API = "https://team-elite-stats.vercel.app"
        private const val REFRESH = "og_elite_widget_refresh"
        private const val PERIODIC = "og_elite_widget_periodic"

        fun enqueue(context: Context) {
            val request = OneTimeWorkRequestBuilder<WidgetRefreshWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(REFRESH, ExistingWorkPolicy.REPLACE, request)
        }

        fun schedulePeriodic(context: Context) {
            val request = PeriodicWorkRequestBuilder<WidgetRefreshWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.UPDATE, request)
        }

        fun loadingViews(context: Context) = RemoteViews(context.packageName, R.layout.widget_loading).apply {
            setTextViewText(R.id.widget_title, "OG ELITE")
            setTextViewText(R.id.widget_status, "SYNCING STATS…")
        }

        fun showLoading(context: Context, manager: AppWidgetManager, ids: IntArray) {
            ids.forEach { manager.updateAppWidget(it, loadingViews(context)) }
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val tournaments = JSONArray(get("/api/tournaments"))
            val matches = JSONArray(get("/api/matches"))
            val players = JSONArray(get("/api/players"))
            val settings = JSONObject(get("/api/settings"))

            val tournamentId = latestTournamentId(tournaments, matches)
            val tournament = find(tournaments, tournamentId)
            val tournamentMatches = (0 until matches.length()).map { matches.getJSONObject(it) }
                .filter { it.optString("tournamentId") == tournamentId }
                .sortedByDescending { it.optLong("timestamp", 0L) }

            val manager = AppWidgetManager.getInstance(applicationContext)
            val teamIds = manager.getAppWidgetIds(ComponentName(applicationContext, TeamPerformanceWidget::class.java))
            val playerIds = manager.getAppWidgetIds(ComponentName(applicationContext, PlayerPerformanceWidget::class.java))
            val prefs = applicationContext.getSharedPreferences("og_elite_widgets", Context.MODE_PRIVATE)

            teamIds.forEach { renderTeam(manager, it, settings, tournament, tournamentMatches) }
            playerIds.forEach {
                val playerId = prefs.getString("player_" + it, null) ?: players.optJSONObject(0)?.optString("id")
                renderPlayer(manager, it, players, playerId, tournament, tournamentMatches)
            }
            Result.success()
        } catch (e: Exception) {
            showError(e.message ?: "Unable to sync")
            Result.retry()
        }
    }

    private fun renderTeam(manager: AppWidgetManager, id: Int, settings: JSONObject, tournament: JSONObject?, matches: List<JSONObject>) {
        val views = layout(manager, id)
        val points = matches.sumOf { it.optDouble("totalPoints", 0.0) }
        val rank = tournament?.optInt("currentRank", 0) ?: 0
        val last = matches.firstOrNull()?.optInt("matchNumber", 0) ?: 0
        views.setTextViewText(R.id.widget_title, settings.optString("teamName", "OG ELITE"))
        views.setTextViewText(R.id.widget_subtitle, tournament?.optString("name", "Latest Tournament") ?: "Latest Tournament")
        views.setTextViewText(R.id.widget_stat1, if (rank > 0) "#" + rank else "—")
        views.setTextViewText(R.id.widget_stat2, format(points))
        views.setTextViewText(R.id.widget_stat3, matches.size.toString())
        views.setTextViewText(R.id.widget_stat4, if (last > 0) "M" + last else "—")
        views.setTextViewText(R.id.widget_label1, "RANK")
        views.setTextViewText(R.id.widget_label2, "POINTS")
        views.setTextViewText(R.id.widget_label3, "MATCHES")
        views.setTextViewText(R.id.widget_label4, "LAST")
        views.setImageViewResource(R.id.widget_image, R.drawable.og_elite_widget_logo)
        attach(manager, id, views)
        manager.updateAppWidget(id, views)
    }

    private fun renderPlayer(manager: AppWidgetManager, id: Int, players: JSONArray, playerId: String?, tournament: JSONObject?, matches: List<JSONObject>) {
        val views = layout(manager, id)
        val player = find(players, playerId)
        val actualId = player?.optString("id", "") ?: ""
        var kills = 0
        var played = 0
        matches.forEach { match ->
            val stats = match.optJSONArray("playerStats") ?: return@forEach
            for (i in 0 until stats.length()) {
                val stat = stats.getJSONObject(i)
                if (stat.optString("playerId") == actualId) {
                    kills += stat.optInt("kills", 0)
                    played++
                }
            }
        }
        val avg = if (played == 0) "0.0" else String.format(Locale.US, "%.1f", kills.toDouble() / played)
        views.setTextViewText(R.id.widget_title, player?.optString("name", "PLAYER") ?: "PLAYER")
        views.setTextViewText(R.id.widget_subtitle, tournament?.optString("name", "Latest Tournament") ?: "Latest Tournament")
        views.setTextViewText(R.id.widget_stat1, kills.toString())
        views.setTextViewText(R.id.widget_stat2, played.toString())
        views.setTextViewText(R.id.widget_stat3, avg)
        views.setTextViewText(R.id.widget_stat4, "LIVE")
        views.setTextViewText(R.id.widget_label1, "KILLS")
        views.setTextViewText(R.id.widget_label2, "MATCHES")
        views.setTextViewText(R.id.widget_label3, "AVG")
        views.setTextViewText(R.id.widget_label4, "STATUS")
        val image = player?.optString("imageUrl", "") ?: ""
        val bitmap = download(image)
        if (bitmap != null) views.setImageViewBitmap(R.id.widget_image, bitmap)
        else views.setImageViewResource(R.id.widget_image, R.drawable.og_elite_widget_logo)
        attach(manager, id, views)
        manager.updateAppWidget(id, views)
    }

    private fun layout(manager: AppWidgetManager, id: Int): RemoteViews {
        val o = manager.getAppWidgetOptions(id)
        val w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 180)
        val h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 100)
        return if (h <= 90 || w >= h * 3) RemoteViews(applicationContext.packageName, R.layout.widget_strip)
        else RemoteViews(applicationContext.packageName, R.layout.widget_stats)
    }

    private fun attach(manager: AppWidgetManager, id: Int, views: RemoteViews) {
        val intent = applicationContext.packageManager.getLaunchIntentForPackage(applicationContext.packageName) ?: return
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(applicationContext, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    }

    private fun showError(message: String) {
        val manager = AppWidgetManager.getInstance(applicationContext)
        val ids = manager.getAppWidgetIds(ComponentName(applicationContext, TeamPerformanceWidget::class.java)) +
            manager.getAppWidgetIds(ComponentName(applicationContext, PlayerPerformanceWidget::class.java))
        val views = RemoteViews(applicationContext.packageName, R.layout.widget_loading)
        views.setTextViewText(R.id.widget_title, "OG ELITE")
        views.setTextViewText(R.id.widget_status, "SYNC ERROR")
        views.setTextViewText(R.id.widget_error, message.replace("\n", " ").take(80))
        ids.forEach { manager.updateAppWidget(it, views) }
    }

    private fun get(path: String): String {
        val c = URL(API + path).openConnection() as HttpURLConnection
        c.connectTimeout = 10000
        c.readTimeout = 15000
        c.requestMethod = "GET"
        c.instanceFollowRedirects = true
        c.setRequestProperty("User-Agent", "OG-ELITE-STATS-Widget/2")
        return try {
            val code = c.responseCode
            val stream = if (code in 200..299) c.inputStream else c.errorStream
            val bodyText = stream?.bufferedReader()?.use { it.readText() } ?: ""
            if (code !in 200..299) error("HTTP " + code + ": " + bodyText.take(100))
            bodyText
        } finally { c.disconnect() }
    }

    private fun download(url: String) = try {
        if (url.isBlank()) return null
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 6000
        c.readTimeout = 8000
        c.instanceFollowRedirects = true
        if (c.responseCode !in 200..299) { c.disconnect(); return null }
        c.inputStream.use { BitmapFactory.decodeStream(it) }.also { c.disconnect() }
    } catch (_: Exception) { null }

    private fun latestTournamentId(t: JSONArray, m: JSONArray): String? {
        var id: String? = null
        var newest = Long.MIN_VALUE
        for (i in 0 until m.length()) {
            val item = m.getJSONObject(i)
            val ts = item.optLong("timestamp", 0)
            if (ts > newest) { newest = ts; id = item.optString("tournamentId", null) }
        }
        if (!id.isNullOrBlank()) return id
        for (i in 0 until t.length()) if (t.getJSONObject(i).optBoolean("active")) return t.getJSONObject(i).optString("id", null)
        return t.optJSONObject(0)?.optString("id")
    }

    private fun find(a: JSONArray, id: String?): JSONObject? {
        if (id.isNullOrBlank()) return null
        for (i in 0 until a.length()) if (a.getJSONObject(i).optString("id") == id) return a.getJSONObject(i)
        return null
    }

    private fun format(v: Double) = if (v % 1.0 == 0.0) v.toInt().toString() else String.format(Locale.US, "%.1f", v)
}
