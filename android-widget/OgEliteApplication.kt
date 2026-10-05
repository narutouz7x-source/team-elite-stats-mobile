package com.teamelite.stats.widget

import android.app.Application
import android.util.Log
import androidx.work.Configuration
import androidx.work.WorkManager

class OgEliteApplication : Application(), Configuration.Provider {
    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setMinimumLoggingLevel(Log.INFO)
            .build()

    override fun onCreate() {
        super.onCreate()
        // install_widgets.py removes AndroidX Startup's WorkManager initializer
        // to avoid the manifest merger conflict. Initialize WorkManager here instead.
        WorkManager.initialize(this, workManagerConfiguration)
    }
}
