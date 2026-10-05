package com.teamelite.stats.widget

import android.app.Application
import android.util.Log
import androidx.work.Configuration

class OgEliteApplication : Application(), Configuration.Provider {
    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setMinimumLoggingLevel(Log.INFO)
            .build()
}
