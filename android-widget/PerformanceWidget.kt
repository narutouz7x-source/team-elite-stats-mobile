package com.teamelite.stats.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

private fun showSafePlaceholder(
    context: Context,
    manager: AppWidgetManager,
    ids: IntArray,
    layout: Int
) {
    ids.forEach { id ->
        try {
            val views = RemoteViews(context.packageName, layout)
            views.setTextViewText(R.id.widget_title, "OG ELITE")
            views.setTextViewText(R.id.widget_subtitle, "LOADING STATS…")
            views.setTextViewText(R.id.widget_rank, "—")
            views.setTextViewText(R.id.widget_points, "—")
            views.setImageViewResource(R.id.widget_image, R.drawable.og_elite_widget_logo)
            manager.updateAppWidget(id, views)
        } catch (_: Exception) {
            // Never let a widget refresh failure abort widget installation.
        }
    }
}

private fun scheduleWidgetRefresh(context: Context) {
    try {
        WidgetRefreshWorker.enqueue(context, immediate = true)
    } catch (_: Exception) {
        // WorkManager may not be ready during launcher installation.
    }

    try {
        WidgetRefreshWorker.schedulePeriodic(context)
    } catch (_: Exception) {
        // Periodic refresh is best-effort; the widget itself must remain addable.
    }
}

class TeamPerformanceWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        showSafePlaceholder(context, manager, ids, R.layout.widget_team)
        scheduleWidgetRefresh(context)
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: android.os.Bundle
    ) {
        appWidgetManager.updateAppWidget(
            appWidgetId,
            RemoteViews(context.packageName, R.layout.widget_team)
        )
        scheduleWidgetRefresh(context)
    }
}

class PlayerPerformanceWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        showSafePlaceholder(context, manager, ids, R.layout.widget_player)
        scheduleWidgetRefresh(context)
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: android.os.Bundle
    ) {
        appWidgetManager.updateAppWidget(
            appWidgetId,
            RemoteViews(context.packageName, R.layout.widget_player)
        )
        scheduleWidgetRefresh(context)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        val prefs = context.getSharedPreferences("og_elite_widgets", Context.MODE_PRIVATE)
        prefs.edit().apply { appWidgetIds.forEach { remove("player_$it") } }.apply()
    }
}
