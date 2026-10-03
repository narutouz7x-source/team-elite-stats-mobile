package com.teamelite.stats.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.widget.RemoteViews
import androidx.work.CoroutineWorker
import androidx.work.WorkManager
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.ExistingWorkPolicy
import androidx.work.BackoffPolicy
import android.util.Log
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

class WidgetRefreshWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    companion object {
        private const val API = "https://team-elite-stats.vercel.app"

        fun enqueue(context: Context, immediate: Boolean = false) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<WidgetRefreshWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    15,
                    java.util.concurrent.TimeUnit.SECONDS
                )
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                "og_elite_widget_refresh",
                ExistingWorkPolicy.REPLACE,
                request
            )
        }

        fun schedulePeriodic(context: Context) {
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "og_elite_widget_periodic",
                androidx.work.ExistingPeriodicWorkPolicy.UPDATE,
                androidx.work.PeriodicWorkRequestBuilder<WidgetRefreshWorker>(
                    15,
                    java.util.concurrent.TimeUnit.MINUTES
                )
                    .setConstraints(
                        Constraints.Builder()
                            .setRequiredNetworkType(NetworkType.CONNECTED)
                            .build()
                    )
                    .build()
            )
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            Log.d("OG_ELITE_WIDGET", "Starting widget data refresh")
            val tournaments = JSONArray(get("/api/tournaments"))
            Log.d("OG_ELITE_WIDGET", "Loaded tournaments: ${tournaments.length()}")
            val matches = JSONArray(get("/api/matches"))
            Log.d("OG_ELITE_WIDGET", "Loaded matches: ${matches.length()}")
            val players = JSONArray(get("/api/players"))
            Log.d("OG_ELITE_WIDGET", "Loaded players: ${players.length()}")
            val settings = JSONObject(get("/api/settings"))
            Log.d("OG_ELITE_WIDGET", "Loaded settings")

            var latestTournamentId: String? = null
            var latestTimestamp = Long.MIN_VALUE
            for (i in 0 until matches.length()) {
                val match = matches.getJSONObject(i)
                val timestamp = match.optLong("timestamp", 0L)
                if (timestamp > latestTimestamp) {
                    latestTimestamp = timestamp
                    latestTournamentId = match.optString("tournamentId", null)
                }
            }

            if (latestTournamentId.isNullOrBlank()) {
                for (i in 0 until tournaments.length()) {
                    val tournament = tournaments.getJSONObject(i)
                    if (tournament.optBoolean("active", false)) {
                        latestTournamentId = tournament.optString("id", null)
                        break
                    }
                }
            }

            val tournament = findById(tournaments, latestTournamentId)
            val tournamentMatches = mutableListOf<JSONObject>()
            for (i in 0 until matches.length()) {
                val match = matches.getJSONObject(i)
                if (match.optString("tournamentId") == latestTournamentId) tournamentMatches.add(match)
            }
            tournamentMatches.sortByDescending { it.optLong("timestamp", 0L) }

            val teamPoints = tournamentMatches.sumOf { it.optDouble("totalPoints", 0.0) }
            val lastMatch = tournamentMatches.firstOrNull()
            val matchNumber = lastMatch?.optInt("matchNumber", 0) ?: 0
            val teamRank = tournament?.optInt("currentRank", 0) ?: 0
            val tournamentName = tournament?.optString("name", "Latest Tournament") ?: "Latest Tournament"

            val manager = AppWidgetManager.getInstance(applicationContext)
            val teamComponent = ComponentName(applicationContext, TeamPerformanceWidget::class.java)
            val playerComponent = ComponentName(applicationContext, PlayerPerformanceWidget::class.java)
            val teamIds = manager.getAppWidgetIds(teamComponent).toSet()
            val playerIds = manager.getAppWidgetIds(playerComponent).toSet()
            val allIds = (teamIds + playerIds).distinct()
            val prefs = applicationContext.getSharedPreferences("og_elite_widgets", Context.MODE_PRIVATE)

            allIds.forEach { widgetId ->
                val isPlayerWidget = playerIds.contains(widgetId)
                val playerId = prefs.getString("player_$widgetId", null)
                val effectivePlayerId = playerId ?: players.optJSONObject(0)?.optString("id", null)
                val options = manager.getAppWidgetOptions(widgetId)
                val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250)
                val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 150)
                val isStrip = minHeight <= 100 || minWidth >= minHeight * 3
                val layout = when {
                    isPlayerWidget && isStrip -> R.layout.widget_player_strip
                    isPlayerWidget -> R.layout.widget_player
                    isStrip -> R.layout.widget_team_strip
                    else -> R.layout.widget_team
                }
                val views = RemoteViews(applicationContext.packageName, layout)

                if (isPlayerWidget) {
                    if (effectivePlayerId.isNullOrBlank()) {
                        renderPlayerPlaceholder(views, tournamentName, isStrip)
                    } else {
                        val player = findById(players, effectivePlayerId)
                        renderPlayer(views, player, tournamentName, tournamentMatches, isStrip)
                    }
                } else {
                    renderTeam(views, settings, tournamentName, teamRank, teamPoints, tournamentMatches.size, matchNumber, isStrip)
                }

                val launch = applicationContext.packageManager.getLaunchIntentForPackage(applicationContext.packageName)
                if (launch != null) {
                    views.setOnClickPendingIntent(
                        widgetId,
                        PendingIntent.getActivity(
                            applicationContext,
                            widgetId,
                            launch,
                            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                        )
                    )
                }
                manager.updateAppWidget(widgetId, views)
            }

            Log.d("OG_ELITE_WIDGET", "Widget data refresh completed")
            Result.success()
        } catch (error: Exception) {
            Log.e("OG_ELITE_WIDGET", "Widget refresh failed", error)
            Result.retry()
        }
    }

    private fun renderTeam(
        views: RemoteViews,
        settings: JSONObject,
        tournament: String,
        rank: Int,
        points: Double,
        matches: Int,
        lastMatch: Int,
        strip: Boolean
    ) {
        views.setTextViewText(R.id.widget_title, settings.optString("teamName", "OG ELITE"))
        views.setTextViewText(R.id.widget_subtitle, tournament)
        views.setTextViewText(R.id.widget_rank, if (rank > 0) "#$rank" else "—")
        views.setTextViewText(R.id.widget_points, format(points))
        if (!strip) {
            views.setTextViewText(R.id.widget_kills, matches.toString())
            views.setTextViewText(R.id.widget_matches, if (lastMatch > 0) "M$lastMatch" else "—")
            views.setTextViewText(R.id.widget_label_rank, "RANK")
            views.setTextViewText(R.id.widget_label_points, "POINTS")
            views.setTextViewText(R.id.widget_label_kills, "MATCHES")
            views.setTextViewText(R.id.widget_label_matches, "LAST")
        }
        views.setImageViewResource(R.id.widget_image, R.drawable.og_elite_widget_logo)
    }

    private fun renderPlayerPlaceholder(views: RemoteViews, tournament: String, strip: Boolean) {
        views.setTextViewText(R.id.widget_title, "SELECT PLAYER")
        views.setTextViewText(R.id.widget_subtitle, tournament)
        views.setTextViewText(R.id.widget_rank, "—")
        views.setTextViewText(R.id.widget_points, "—")
        if (!strip) {
            views.setTextViewText(R.id.widget_kills, "—")
            views.setTextViewText(R.id.widget_matches, "SETUP")
            views.setTextViewText(R.id.widget_label_rank, "KILLS")
            views.setTextViewText(R.id.widget_label_points, "MATCHES")
            views.setTextViewText(R.id.widget_label_kills, "AVG")
            views.setTextViewText(R.id.widget_label_matches, "STATUS")
        }
        views.setImageViewResource(R.id.widget_image, R.drawable.og_elite_widget_logo)
    }

    private fun renderPlayer(
        views: RemoteViews,
        player: JSONObject?,
        tournament: String,
        matches: List<JSONObject>,
        strip: Boolean
    ) {
        val name = player?.optString("name", "PLAYER") ?: "PLAYER"
        val id = player?.optString("id", "") ?: ""
        var kills = 0
        var played = 0

        matches.forEach { match ->
            val stats = match.optJSONArray("playerStats") ?: return@forEach
            for (i in 0 until stats.length()) {
                val stat = stats.getJSONObject(i)
                if (stat.optString("playerId") == id) {
                    kills += stat.optInt("kills", 0)
                    played++
                }
            }
        }

        val avg = if (played > 0) String.format(Locale.US, "%.1f", kills.toDouble() / played) else "0.0"

        views.setTextViewText(R.id.widget_title, name)
        views.setTextViewText(R.id.widget_subtitle, tournament)
        views.setTextViewText(R.id.widget_rank, kills.toString())
        views.setTextViewText(R.id.widget_points, played.toString())
        if (!strip) {
            views.setTextViewText(R.id.widget_kills, avg)
            views.setTextViewText(R.id.widget_matches, "LIVE")
            views.setTextViewText(R.id.widget_label_rank, "KILLS")
            views.setTextViewText(R.id.widget_label_points, "MATCHES")
            views.setTextViewText(R.id.widget_label_kills, "AVG")
            views.setTextViewText(R.id.widget_label_matches, "STATUS")
        }

        val imageUrl = player?.optString("imageUrl", "") ?: ""
        val bitmap = downloadBitmap(imageUrl)
        if (bitmap != null) {
            views.setImageViewBitmap(R.id.widget_image, bitmap)
        } else {
            views.setImageViewResource(R.id.widget_image, R.drawable.og_elite_widget_logo)
        }
    }

    private fun get(path: String): String {
        val connection = URL(API + path).openConnection() as HttpURLConnection
        connection.connectTimeout = 12000
        connection.readTimeout = 15000
        connection.requestMethod = "GET"
        connection.instanceFollowRedirects = true
        connection.setRequestProperty("User-Agent", "OG-ELITE-STATS-Android-Widget")
        return try {
            val code = connection.responseCode
            if (code !in 200..299) throw IllegalStateException("HTTP $code")
            connection.inputStream.bufferedReader().use { it.readText() }
        } finally {
            connection.disconnect()
        }
    }

    private fun downloadBitmap(url: String): Bitmap? = try {
        if (url.isBlank()) return null
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 8000
        connection.readTimeout = 10000
        connection.instanceFollowRedirects = true
        connection.setRequestProperty("User-Agent", "OG-ELITE-STATS-Android-Widget")
        if (connection.responseCode !in 200..299) {
            connection.disconnect()
            return null
        }

        connection.inputStream.use { stream ->
            val bytes = stream.readBytes()
            if (bytes.isEmpty()) return@use null

            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return@use null

            val options = BitmapFactory.Options().apply {
                inSampleSize = calculateSampleSize(bounds.outWidth, bounds.outHeight, 512, 512)
                inPreferredConfig = Bitmap.Config.ARGB_8888
            }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
        }.also { connection.disconnect() }
    } catch (_: Exception) {
        null
    }

    private fun calculateSampleSize(width: Int, height: Int, maxWidth: Int, maxHeight: Int): Int {
        var sample = 1
        while (width / (sample * 2) >= maxWidth && height / (sample * 2) >= maxHeight) {
            sample *= 2
        }
        return sample
    }

    private fun findById(array: JSONArray, id: String?): JSONObject? {
        if (id.isNullOrBlank()) return null
        for (i in 0 until array.length()) {
            val obj = array.getJSONObject(i)
            if (obj.optString("id") == id) return obj
        }
        return null
    }

    private fun format(value: Double): String =
        if (value % 1.0 == 0.0) value.toInt().toString() else String.format(Locale.US, "%.1f", value)
}