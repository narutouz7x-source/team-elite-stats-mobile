package com.teamelite.stats.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class PerformanceWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { id ->
            manager.updateAppWidget(id, loadingView(context))
        }
        WidgetRefreshWorker.enqueue(context, immediate = true)
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "og_elite_widget_periodic",
            ExistingPeriodicWorkPolicy.UPDATE,
            PeriodicWorkRequestBuilder<WidgetRefreshWorker>(15, TimeUnit.MINUTES).build()
        )
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        val prefs = context.getSharedPreferences("og_elite_widgets", Context.MODE_PRIVATE)
        prefs.edit().apply { appWidgetIds.forEach { remove("player_$it") } }.apply()
    }

    private fun loadingView(context: Context): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_performance)
        views.setTextViewText(R.id.widget_title, "OG ELITE STATS")
        views.setTextViewText(R.id.widget_subtitle, "Updating…")
        views.setTextViewText(R.id.widget_rank, "—")
        views.setTextViewText(R.id.widget_points, "—")
        views.setTextViewText(R.id.widget_kills, "—")
        views.setTextViewText(R.id.widget_matches, "—")
        return views
    }
}
