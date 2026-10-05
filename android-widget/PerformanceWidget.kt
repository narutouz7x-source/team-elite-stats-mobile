package com.teamelite.stats.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context

private fun refresh(context: Context) = WidgetRefreshWorker.enqueue(context)

class TeamPerformanceWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        WidgetRefreshWorker.showLoading(context, manager, ids)
        refresh(context)
    }
    override fun onEnabled(context: Context) {
        WidgetRefreshWorker.schedulePeriodic(context)
        refresh(context)
    }
}

class PlayerPerformanceWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        // Configuration activity owns the first render. This refreshes already-configured widgets.
        ids.forEach { id ->
            val playerId = context.getSharedPreferences("og_elite_widgets", Context.MODE_PRIVATE)
                .getString("player_$id", null)
            if (playerId != null) WidgetRefreshWorker.showLoading(context, manager, intArrayOf(id))
        }
        refresh(context)
    }
    override fun onEnabled(context: Context) {
        WidgetRefreshWorker.schedulePeriodic(context)
    }
    override fun onDeleted(context: Context, ids: IntArray) {
        context.getSharedPreferences("og_elite_widgets", Context.MODE_PRIVATE).edit().apply {
            ids.forEach { remove("player_$it") }
        }.apply()
    }
}