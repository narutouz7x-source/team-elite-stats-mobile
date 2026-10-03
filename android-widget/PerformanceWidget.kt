package com.teamelite.stats.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

private fun showSafePlaceholder(
    context: Context,
    manager: AppWidgetManager,
    ids: IntArray
) {
    ids.forEach { id ->
        try {
            val views = RemoteViews(context.packageName, R.layout.widget_initial)
            views.setTextViewText(R.id.widget_title, "OG ELITE")
            views.setTextViewText(R.id.widget_subtitle, "LOADING STATS…")
            manager.updateAppWidget(id, views)
        } catch (_: Throwable) {
        }
    }
}

private fun scheduleWidgetRefresh(context: Context) {
    try { WidgetRefreshWorker.enqueue(context, immediate = true) } catch (_: Throwable) {}
    try { WidgetRefreshWorker.schedulePeriodic(context) } catch (_: Throwable) {}
}

private fun resetToSafeLayout(context: Context, manager: AppWidgetManager, id: Int) {
    try {
        manager.updateAppWidget(id, RemoteViews(context.packageName, R.layout.widget_initial))
    } catch (_: Throwable) {}
}

class TeamPerformanceWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        showSafePlaceholder(context, manager, ids)
        scheduleWidgetRefresh(context)
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: android.os.Bundle
    ) {
        resetToSafeLayout(context, appWidgetManager, appWidgetId)
        scheduleWidgetRefresh(context)
    }
}

class PlayerPerformanceWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        showSafePlaceholder(context, manager, ids)
        scheduleWidgetRefresh(context)
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: android.os.Bundle
    ) {
        resetToSafeLayout(context, appWidgetManager, appWidgetId)
        scheduleWidgetRefresh(context)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        val prefs = context.getSharedPreferences("og_elite_widgets", Context.MODE_PRIVATE)
        prefs.edit().apply { appWidgetIds.forEach { remove("player_$it") } }.apply()
    }
}