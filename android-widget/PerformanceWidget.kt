package com.teamelite.stats.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context

private fun refresh(context: Context) {
    WidgetRefreshWorker.enqueue(context)
}

class TeamPerformanceWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        WidgetRefreshWorker.showLoading(context, manager, ids)
        refresh(context)
    }
    override fun onEnabled(context: Context) {
        WidgetRefreshWorker.schedulePeriodic(context)
        refresh(context)
    }
    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, newOptions: android.os.Bundle) {
        manager.updateAppWidget(id, WidgetRefreshWorker.loadingViews(context))
        refresh(context)
    }
}

class PlayerPerformanceWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        WidgetRefreshWorker.showLoading(context, manager, ids)
        refresh(context)
    }
    override fun onEnabled(context: Context) {
        WidgetRefreshWorker.schedulePeriodic(context)
        refresh(context)
    }
    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, newOptions: android.os.Bundle) {
        manager.updateAppWidget(id, WidgetRefreshWorker.loadingViews(context))
        refresh(context)
    }
    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        context.getSharedPreferences("og_elite_widgets", Context.MODE_PRIVATE)
            .edit().apply { appWidgetIds.forEach { remove("player_$it") } }.apply()
    }
}
