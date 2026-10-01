package com.teamelite.stats.widget

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class WidgetRefreshService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        WidgetRefreshWorker.enqueue(applicationContext, immediate = true)
    }
}
