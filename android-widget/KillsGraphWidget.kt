package com.teamelite.stats.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context

class KillsGraphWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        KillsGraphRefreshWorker.showLoading(context, manager, ids)
        KillsGraphRefreshWorker.enqueue(context)
    }

    override fun onEnabled(context: Context) {
        KillsGraphRefreshWorker.schedulePeriodic(context)
        KillsGraphRefreshWorker.enqueue(context)
    }
}
