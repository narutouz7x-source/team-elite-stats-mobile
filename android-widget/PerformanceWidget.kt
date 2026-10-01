package com.teamelite.stats.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

private fun scheduleWidgetRefresh(context: Context) {
    WidgetRefreshWorker.enqueue(context)
    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        "og_elite_widget_periodic",
        ExistingPeriodicWorkPolicy.UPDATE,
        PeriodicWorkRequestBuilder<WidgetRefreshWorker>(15, TimeUnit.MINUTES).build()
    )
}

class TeamPerformanceWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        scheduleWidgetRefresh(context)
    }
}

class PlayerPerformanceWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        scheduleWidgetRefresh(context)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        val prefs = context.getSharedPreferences("og_elite_widgets", Context.MODE_PRIVATE)
        prefs.edit().apply { appWidgetIds.forEach { remove("player_$it") } }.apply()
    }
}
