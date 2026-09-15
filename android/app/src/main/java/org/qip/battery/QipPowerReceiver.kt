/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Android Power Receiver
 * Listens for system battery and screen broadcast events to dynamically throttle
 * or suspend optical transmission.
 */

package org.qip.battery

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class QipPowerReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "QipPowerReceiver"
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        val action = intent?.action ?: return
        Log.i(TAG, "QIP Power State Changed: $action")
    }
}
