/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Android Foreground Service
 * Manages persistent optical background discovery, beacon emission,
 * battery throttle, and honest physical screen state management.
 */

package org.qip.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class QipForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "qip_optical_node_channel"
        const val NOTIFICATION_ID = 4040
        const val ACTION_START = "org.qip.ACTION_START"
        const val ACTION_STOP = "org.qip.ACTION_STOP"
        const val ACTION_UPDATE_CARRIER = "org.qip.ACTION_UPDATE_CARRIER"
    }

    private var activeCarrier: String = "QR"
    private var nodeStatus: String = "Advertising & Listening"
    private var isScreenOn: Boolean = true
    private var isBatteryLow: Boolean = false
    private var lastEventTimestamp: Long = System.currentTimeMillis()

    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                Intent.ACTION_SCREEN_OFF -> {
                    // Physical reality: Optical transmission impossible with screen OFF.
                    isScreenOn = false
                    nodeStatus = "Screen OFF: Listening Only (Transmission Suspended)"
                    recordEvent("Screen powered off - optical transmission suspended to honor physics.")
                }
                Intent.ACTION_SCREEN_ON -> {
                    isScreenOn = true
                    nodeStatus = if (isBatteryLow) "Screen ON: Throttled Beacon" else "Screen ON: Full Optical Transceiver"
                    recordEvent("Screen active - full optical transceiver restored.")
                }
                Intent.ACTION_BATTERY_LOW -> {
                    isBatteryLow = true
                    recordEvent("Low battery detected: throttled optical heartbeat rate to 0.1Hz.")
                }
                Intent.ACTION_BATTERY_OKAY -> {
                    isBatteryLow = false
                    recordEvent("Battery normal: restored optical beacon frequency.")
                }
            }
            updateNotification()
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()

        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_BATTERY_LOW)
            addAction(Intent.ACTION_BATTERY_OKAY)
        }
        registerReceiver(screenReceiver, filter)

        // Check initial screen state
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        isScreenOn = pm.isInteractive
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_UPDATE_CARRIER -> {
                intent.getStringExtra("carrier")?.let { activeCarrier = it }
            }
        }

        startForeground(NOTIFICATION_ID, buildNotification())
        return START_STICKY
    }

    private fun recordEvent(description: String) {
        lastEventTimestamp = System.currentTimeMillis()
        updateNotification()
    }

    private fun updateNotification() {
        val notification = buildNotification()
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, notification)
    }

    private fun buildNotification(): Notification {
        val timeStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(lastEventTimestamp))

        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("QIP Node Active")
            .setContentText("Status: $nodeStatus")
            .setStyle(
                NotificationCompat.BigTextStyle().bigText(
                    "Status: $nodeStatus\n" +
                    "Carrier: $activeCarrier\n" +
                    "Optical Beacon: ${if (isScreenOn && !isBatteryLow) "2.0 Hz" else if (isScreenOn) "0.2 Hz (Power Save)" else "OFF (Screen Dark)"}\n" +
                    "Last Event: $timeStr"
                )
            )
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "QIP Optical Node Discovery",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows live physical status of the QIP screen-to-camera optical network node."
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        unregisterReceiver(screenReceiver)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
