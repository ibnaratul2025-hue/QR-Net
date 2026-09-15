/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Node Android Lifecycle Observer
 * Implements DefaultLifecycleObserver to guarantee that camera sensors,
 * background optical frame decoders, and thread executors are cleanly
 * suspended when the app moves to the background, and resumed upon foregrounding.
 */

package org.qip.node

import android.util.Log
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import org.qip.camera.CameraErrorSeverity
import org.qip.camera.QipCameraErrorHub
import org.qip.camera.QipCameraManager
import java.util.concurrent.atomic.AtomicBoolean

class QipNodeLifecycleObserver(
    private val cameraManager: QipCameraManager,
    private val onNodeStateChanged: ((isSuspended: Boolean, reason: String) -> Unit)? = null
) : DefaultLifecycleObserver {

    companion object {
        private const val TAG = "QipNodeLifecycle"
    }

    private val isAppForegrounded = AtomicBoolean(false)
    private val isOpticalSuspended = AtomicBoolean(false)

    override fun onStart(owner: LifecycleOwner) {
        super.onStart(owner)
        Log.i(TAG, "Lifecycle: ON_START - Application entering foreground.")
        isAppForegrounded.set(true)
    }

    override fun onResume(owner: LifecycleOwner) {
        super.onResume(owner)
        Log.i(TAG, "Lifecycle: ON_RESUME - Resuming optical transceiver and camera sensors.")
        
        if (isOpticalSuspended.getAndSet(false)) {
            // Wake optical threads & notify node
            cameraManager.resumeProcessing()
            onNodeStateChanged?.invoke(false, "App returned to foreground: optical processing active")
            
            QipCameraErrorHub.reportError(
                errorCode = "LIFECYCLE_RESUMED",
                severity = CameraErrorSeverity.INFO,
                component = "Lifecycle",
                message = "Optical processing pipeline and CameraX frame analyzer resumed.",
                troubleshootingSteps = emptyList()
            )
        }
    }

    override fun onPause(owner: LifecycleOwner) {
        super.onPause(owner)
        Log.i(TAG, "Lifecycle: ON_PAUSE - Suspending optical camera capture and processing.")
        
        // Strictly honor physical reality: optical communication requires camera sensor & screen line-of-sight
        isOpticalSuspended.set(true)
        cameraManager.pauseProcessing()
        onNodeStateChanged?.invoke(true, "App in background: optical camera suspended")

        QipCameraErrorHub.reportError(
            errorCode = "LIFECYCLE_SUSPENDED",
            severity = CameraErrorSeverity.INFO,
            component = "Lifecycle",
            message = "Optical transceiver suspended while application is paused or in background.",
            troubleshootingSteps = listOf(
                "Return app to foreground to resume optical communication.",
                "Ensure device screen is awake and facing the target optical transmitter."
            )
        )
    }

    override fun onStop(owner: LifecycleOwner) {
        super.onStop(owner)
        Log.i(TAG, "Lifecycle: ON_STOP - Application obscured. Unbinding CameraX use cases.")
        isAppForegrounded.set(false)
        cameraManager.stopOpticalCapture()
    }

    override fun onDestroy(owner: LifecycleOwner) {
        super.onDestroy(owner)
        Log.i(TAG, "Lifecycle: ON_DESTROY - Tearing down optical workers and thread pools.")
        cameraManager.release()
        owner.lifecycle.removeObserver(this)
    }

    fun isForegrounded(): Boolean = isAppForegrounded.get()
    fun isSuspended(): Boolean = isOpticalSuspended.get()
}
