/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Android Camera Lifecycle Observer
 * Connects CameraX and optical processing workers directly to Android LifecycleOwner
 * via DefaultLifecycleObserver. Suspends camera capture on ON_PAUSE / ON_STOP to
 * preserve battery, prevent background leaks, and protect thermal thresholds.
 */

package org.qip.camera

import android.util.Log
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner

class QipCameraLifecycleObserver(
    private val cameraManager: QipCameraManager,
    private val onStateChanged: ((isSuspended: Boolean) -> Unit)? = null
) : DefaultLifecycleObserver {

    companion object {
        private const val TAG = "QipLifecycleObserver"
    }

    override fun onResume(owner: LifecycleOwner) {
        super.onResume(owner)
        Log.i(TAG, "Lifecycle ON_RESUME: Resuming CameraX optical stream analyzer.")
        cameraManager.resumeProcessing()
        onStateChanged?.invoke(false)
        QipCameraErrorHub.reportError(
            errorCode = "LIFECYCLE_RESUMED",
            severity = CameraErrorSeverity.INFO,
            component = "Lifecycle",
            message = "Optical camera pipeline resumed in foreground.",
            troubleshootingSteps = emptyList()
        )
    }

    override fun onPause(owner: LifecycleOwner) {
        super.onPause(owner)
        Log.i(TAG, "Lifecycle ON_PAUSE: Suspending CameraX optical stream to preserve battery/thermals.")
        cameraManager.pauseProcessing()
        onStateChanged?.invoke(true)
        QipCameraErrorHub.reportError(
            errorCode = "LIFECYCLE_SUSPENDED",
            severity = CameraErrorSeverity.INFO,
            component = "Lifecycle",
            message = "DefaultLifecycleObserver triggered ON_PAUSE: Optical sensors suspended.",
            troubleshootingSteps = listOf(
                "Bring app to foreground to resume optical reception."
            )
        )
    }

    override fun onDestroy(owner: LifecycleOwner) {
        super.onDestroy(owner)
        Log.i(TAG, "Lifecycle ON_DESTROY: Releasing CameraX and background executor threads.")
        cameraManager.release()
    }
}
