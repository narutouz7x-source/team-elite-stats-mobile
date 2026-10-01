package com.teamelite.stats.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.widget.RemoteViews
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class WidgetRefreshWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    companion object {
        private const val API = "https://team-elite-stats.vercel.app"
        fun enqueue(context: Context, immediate: Boolean = false) {
            val request = if (immediate) {
                androidx.work.OneTimeWorkRequestBuilder<WidgetRefreshWorker>().build()
            } else {
                androidx.work.OneTimeWorkRequestBuilder<WidgetRefreshWorker>().build()
            }
            androidx.work.WorkManager.getInstance(context).enqueue(request)
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val tournaments = JSONArray(get("/api/tournaments"))
            val matches = JSONArray(get("/api/matches"))
            val players = JSONArray(get("/api/players"))
            val settings = JSONObject(get("/api/settings"))

            var latestTournamentId: String? = null
            var latestTimestamp = Long.MIN_VALUE
            for (i in 0 until matches.length()) {
                val m = matches.getJSONObject(i)
                val ts = m.optLong("timestamp", 0L)
                if (ts > latestTimestamp) {
                    latestTimestamp = ts
                    latestTournamentId = m.optString("tournamentId", null)
                }
            }
            if (latestTournamentId == null) {
                for (i in 0 until tournaments.length()) {
                    val t = tournaments.getJSONObject(i)
                    if (t.optBoolean("active", false)) {
                        latestTournamentId = t.optString("id", null)
                        break
                    }
                }
            }

            val tournament = findById(tournaments, latestTournamentId)
            val tournamentMatches = mutableListOf<JSONObject>()
            for (i in 0 until matches.length()) {
                val m = matches.getJSONObject(i)
                if (m.optString("tournamentId") == latestTournamentId) tournamentMatches.add(m)
            }
            tournamentMatches.sortByDescending { it.optLong("timestamp", 0L) }

            val teamPoints = tournamentMatches.sumOf { it.optDouble("totalPoints", 0.0) }
            val lastMatch = tournamentMatches.firstOrNull()
            val matchNumber = lastMatch?.optInt("matchNumber", 0) ?: 0
            val teamRank = tournament?.optInt("currentRank", 0) ?: 0
            val tournamentName = tournament?.optString("name", "Latest Tournament") ?: "Latest Tournament"

            val manager = AppWidgetManager.getInstance(applicationContext)
            val teamComponent = android.content.ComponentName(applicationContext, TeamPerformanceWidget::class.java)
            val playerComponent = android.content.ComponentName(applicationContext, PlayerPerformanceWidget::class.java)
            val ids = (manager.getAppWidgetIds(teamComponent).toList() + manager.getAppWidgetIds(playerComponent).toList()).distinct()
            val prefs = applicationContext.getSharedPreferences("og_elite_widgets", Context.MODE_PRIVATE)

            ids.forEach { widgetId ->
                val playerId = prefs.getString("player_$widgetId", null)
                val views = RemoteViews(applicationContext.packageName, R.layout.widget_performance)
                if (playerId == null) {
                    renderTeam(views, settings, tournamentName, teamRank, teamPoints, tournamentMatches.size, matchNumber)
                } else {
                    val player = findById(players, playerId)
                    renderPlayer(views, player, tournamentName, tournamentMatches)
                }
                val launch = applicationContext.packageManager.getLaunchIntentForPackage(applicationContext.packageName)
                if (launch != null) {
                    views.setOnClickPendingIntent(widgetId, PendingIntent.getActivity(
                        applicationContext, widgetId, launch,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    ))
                }
                manager.updateAppWidget(widgetId, views)
            }
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    private fun renderTeam(v: RemoteViews, settings: JSONObject, tournament: String, rank: Int, points: Double, matches: Int, lastMatch: Int) {
        v.setTextViewText(R.id.widget_title, settings.optString("teamName", "OG ELITE"))
        v.setTextViewText(R.id.widget_subtitle, tournament)
        v.setTextViewText(R.id.widget_rank, if (rank > 0) "#$rank" else "—")
        v.setTextViewText(R.id.widget_points, format(points))
        v.setTextViewText(R.id.widget_kills, "TEAM")
        v.setTextViewText(R.id.widget_matches, if (lastMatch > 0) "M$lastMatch" else "$matches MATCHES")
        v.setTextViewText(R.id.widget_label_rank, "RANK")
        v.setTextViewText(R.id.widget_label_points, "POINTS")
        v.setTextViewText(R.id.widget_label_kills, "TYPE")
        v.setTextViewText(R.id.widget_label_matches, "LAST")
        v.setImageViewResource(R.id.widget_image, R.drawable.og_elite_widget_logo)
    }

    private fun renderPlayer(v: RemoteViews, player: JSONObject?, tournament: String, matches: List<JSONObject>) {
        val name = player?.optString("name", "PLAYER") ?: "PLAYER"
        val id = player?.optString("id", "") ?: ""
        var kills = 0
        var played = 0
        matches.forEach { m ->
            val stats = m.optJSONArray("playerStats") ?: return@forEach
            for (i in 0 until stats.length()) {
                val s = stats.getJSONObject(i)
                if (s.optString("playerId") == id) {
                    kills += s.optInt("kills", 0)
                    played++
                }
            }
        }
        v.setTextViewText(R.id.widget_title, name)
        v.setTextViewText(R.id.widget_subtitle, tournament)
        v.setTextViewText(R.id.widget_rank, "—")
        v.setTextViewText(R.id.widget_points, "$kills")
        v.setTextViewText(R.id.widget_kills, "$kills")
        v.setTextViewText(R.id.widget_matches, "$played")
        v.setTextViewText(R.id.widget_label_rank, "RANK")
        v.setTextViewText(R.id.widget_label_points, "KILLS")
        v.setTextViewText(R.id.widget_label_kills, "KILLS")
        v.setTextViewText(R.id.widget_label_matches, "MATCHES")
        val imageUrl = player?.optString("imageUrl", "") ?: ""
        val bitmap = downloadBitmap(imageUrl)
        if (bitmap != null) v.setImageViewBitmap(R.id.widget_image, bitmap)
        else v.setImageViewResource(R.id.widget_image, R.drawable.og_elite_widget_logo)
    }

    private fun get(path: String): String {
        val c = URL(API + path).openConnection() as HttpURLConnection
        c.connectTimeout = 8000
        c.readTimeout = 10000
        c.requestMethod = "GET"
        return c.inputStream.bufferedReader().use { it.readText() }.also { c.disconnect() }
    }

    private fun downloadBitmap(url: String): Bitmap? = try {
        if (url.isBlank()) return null
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 8000
        connection.readTimeout = 10000
        connection.instanceFollowRedirects = true
        connection.requestProperty("User-Agent", "OG-ELITE-STATS-Android-Widget")
        if (connection.responseCode !in 200..299) {
            connection.disconnect()
            return null
        }
        connection.inputStream.use { BitmapFactory.decodeStream(it) }.also { connection.disconnect() }
    } catch (_: Exception) { null }

    private fun findById(array: JSONArray, id: String?): JSONObject? {
        if (id == null) return null
        for (i in 0 until array.length()) {
            val o = array.getJSONObject(i)
            if (o.optString("id") == id) return o
        }
        return null
    }

    private fun format(value: Double): String =
        if (value % 1.0 == 0.0) value.toInt().toString() else String.format("%.1f", value)
}
