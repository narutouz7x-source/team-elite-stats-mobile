package com.teamelite.stats.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
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

class KillsGraphRefreshWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    companion object {
        private const val API = "https://team-elite-stats.vercel.app/api/mobile-widget"
        private const val ONCE = "og_elite_kills_graph_once"
        private const val PERIODIC = "og_elite_kills_graph_periodic"

        fun enqueue(context: Context) {
            val request = OneTimeWorkRequestBuilder<KillsGraphRefreshWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(ONCE, ExistingWorkPolicy.REPLACE, request)
        }

        fun schedulePeriodic(context: Context) {
            val request = PeriodicWorkRequestBuilder<KillsGraphRefreshWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.UPDATE, request)
        }

        fun showLoading(context: Context, manager: AppWidgetManager, ids: IntArray) {
            val views = RemoteViews(context.packageName, R.layout.widget_loading).apply {
                setTextViewText(R.id.widget_title, "OG ELITE")
                setTextViewText(R.id.widget_status, "SYNCING KILLS GRAPH…")
                setTextViewText(R.id.widget_error, "")
            }
            ids.forEach { manager.updateAppWidget(it, views) }
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val data = JSONObject(fetch())
            val matches = data.optJSONArray("matches") ?: JSONArray()
            val tournament = data.optJSONObject("tournament")
            val settings = data.optJSONObject("settings") ?: JSONObject()
            val ids = AppWidgetManager.getInstance(applicationContext)
                .getAppWidgetIds(ComponentName(applicationContext, KillsGraphWidget::class.java))
            val manager = AppWidgetManager.getInstance(applicationContext)
            ids.forEach { render(manager, it, settings, tournament, matches) }
            Result.success()
        } catch (e: Exception) {
            val manager = AppWidgetManager.getInstance(applicationContext)
            val ids = manager.getAppWidgetIds(ComponentName(applicationContext, KillsGraphWidget::class.java))
            val views = RemoteViews(applicationContext.packageName, R.layout.widget_loading).apply {
                setTextViewText(R.id.widget_title, "OG ELITE")
                setTextViewText(R.id.widget_status, "GRAPH SYNC FAILED")
                setTextViewText(R.id.widget_error, (e.message ?: "Try again").replace("\n", " ").take(90))
            }
            ids.forEach { manager.updateAppWidget(it, views) }
            Result.retry()
        }
    }

    private fun render(manager: AppWidgetManager, id: Int, settings: JSONObject, tournament: JSONObject?, rawMatches: JSONArray) {
        val matches = (0 until rawMatches.length()).mapNotNull { rawMatches.optJSONObject(it) }
            .sortedBy { it.optLong("timestamp", 0L) }
        val perMatch = matches.map { match ->
            val stats = match.optJSONArray("playerStats") ?: JSONArray()
            var kills = 0
            for (i in 0 until stats.length()) kills += stats.optJSONObject(i)?.optInt("kills", 0) ?: 0
            Pair(match.optInt("matchNumber", 0), kills)
        }
        val total = perMatch.sumOf { it.second }
        val count = perMatch.size
        val average = if (count == 0) 0.0 else total.toDouble() / count
        val peak = perMatch.maxByOrNull { it.second }?.second ?: 0
        val title = settings.optString("teamName", "OG ELITE")

        val views = RemoteViews(applicationContext.packageName, R.layout.widget_graph).apply {
            setTextViewText(R.id.graph_title, "KILLS PROGRESSION")
            setTextViewText(R.id.graph_subtitle, tournament?.optString("name", "Latest Tournament") ?: "Latest Tournament")
            setTextViewText(R.id.graph_total, total.toString())
            setTextViewText(R.id.graph_avg, "AVG " + String.format(Locale.US, "%.1f", average))
            setTextViewText(R.id.graph_peak, "PEAK $peak")
            setTextViewText(R.id.graph_updated, "UPDATED NOW")
            setImageViewBitmap(R.id.graph_chart, drawGraph(perMatch.map { it.second }))
            val launch = applicationContext.packageManager.getLaunchIntentForPackage(applicationContext.packageName)
            if (launch != null) setOnClickPendingIntent(
                R.id.graph_widget_root,
                PendingIntent.getActivity(applicationContext, id + 7000, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            )
        }
        manager.updateAppWidget(id, views)
    }

    private fun drawGraph(values: List<Int>): Bitmap {
        val width = 640
        val height = 210
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val left = 18f
        val right = width - 18f
        val top = 18f
        val bottom = height - 24f
        val grid = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0x28FFFFFF
            strokeWidth = 1.5f
        }
        for (i in 0..2) {
            val y = top + (bottom - top) * i / 2f
            canvas.drawLine(left, y, right, y, grid)
        }
        if (values.isEmpty()) {
            val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = 0xFF9298A3.toInt()
                textSize = 25f
                typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            }
            canvas.drawText("Waiting for match data", left, height / 2f, p)
            return bitmap
        }

        val maxValue = maxOf(1, values.maxOrNull() ?: 1)
        val xStep = if (values.size == 1) 0f else (right - left) / (values.size - 1)
        val points = values.mapIndexed { index, value ->
            val x = if (values.size == 1) (left + right) / 2f else left + index * xStep
            val y = bottom - (value.toFloat() / maxValue) * (bottom - top - 8f)
            Pair(x, y)
        }

        val area = Path().apply {
            moveTo(points.first().first, bottom)
            points.forEach { lineTo(it.first, it.second) }
            lineTo(points.last().first, bottom)
            close()
        }
        val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = android.graphics.LinearGradient(0f, top, 0f, bottom, 0x66FF8A00, 0x00FF8A00, android.graphics.Shader.TileMode.CLAMP)
        }
        canvas.drawPath(area, fill)

        val line = Path().apply {
            moveTo(points.first().first, points.first().second)
            points.drop(1).forEach { lineTo(it.first, it.second) }
        }
        val glow = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0x66FF8500
            style = Paint.Style.STROKE
            strokeWidth = 12f
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }
        canvas.drawPath(line, glow)
        val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0xFFFF9D00.toInt()
            style = Paint.Style.STROKE
            strokeWidth = 5f
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }
        canvas.drawPath(line, stroke)

        val marker = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF171717.toInt() }
        val outline = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0xFFFFA52B.toInt()
            style = Paint.Style.STROKE
            strokeWidth = 4f
        }
        points.forEach { (x, y) ->
            canvas.drawCircle(x, y, 7f, marker)
            canvas.drawCircle(x, y, 7f, outline)
        }
        val label = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0xFF9BA1AC.toInt()
            textSize = 17f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        }
        canvas.drawText("M1", left, height - 3f, label)
        if (values.size > 1) canvas.drawText("M${values.size}", right - 35f, height - 3f, label)
        return bitmap
    }

    private fun fetch(): String {
        val connection = URL(API).openConnection() as HttpURLConnection
        connection.connectTimeout = 8000
        connection.readTimeout = 12000
        connection.requestMethod = "GET"
        connection.setRequestProperty("Accept", "application/json")
        connection.setRequestProperty("User-Agent", "OG-ELITE-Kills-Graph-Widget/1")
        return try {
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            if (code !in 200..299) error("HTTP $code: ${body.take(100)}")
            body
        } finally {
            connection.disconnect()
        }
    }
}
