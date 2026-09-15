/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Android Camera Permission Handler
 * Lifecycle-aware permission orchestrator that ensures CameraX and the QIP
 * optical transceiver never initialize until CAMERA hardware permissions
 * are explicitly checked, requested, and granted.
 */

package org.qip.camera

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

enum class CameraPermissionState {
    NOT_DETERMINED,
    GRANTED,
    DENIED,
    RATIONALE_NEEDED,
    PERMANENTLY_DENIED
}

interface CameraPermissionCallback {
    fun onPermissionGranted()
    fun onPermissionDenied(state: CameraPermissionState, message: String)
}

class QipCameraPermissionHandler(
    private val activity: ComponentActivity,
    private val callback: CameraPermissionCallback
) {
    companion object {
        private const val TAG = "QipCamPermission"
        const val CAMERA_PERMISSION = Manifest.permission.CAMERA
    }

    private var permissionLauncher: ActivityResultLauncher<String>? = null
    private var currentState: CameraPermissionState = CameraPermissionState.NOT_DETERMINED

    init {
        // Register early in Activity lifecycle before ON_START
        registerLauncher()
    }

    private fun registerLauncher() {
        permissionLauncher = activity.registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { isGranted: Boolean ->
            if (isGranted) {
                currentState = CameraPermissionState.GRANTED
                Log.i(TAG, "Camera permission granted by user. Authorizing optical transceiver.")
                callback.onPermissionGranted()
            } else {
                val shouldShowRationale = ActivityCompat.shouldShowRequestPermissionRationale(
                    activity,
                    CAMERA_PERMISSION
                )
                currentState = if (shouldShowRationale) {
                    CameraPermissionState.RATIONALE_NEEDED
                } else {
                    CameraPermissionState.PERMANENTLY_DENIED
                }

                val failureMessage = if (currentState == CameraPermissionState.PERMANENTLY_DENIED) {
                    "Camera permission was permanently denied. Optical reception requires camera access. Please enable in App Settings."
                } else {
                    "Camera permission was denied. The QIP optical transceiver cannot receive optical frames without sensor access."
                }

                Log.w(TAG, "Camera permission denied: $currentState")
                
                // Report to CameraX Error Hub for Diagnostics Panel visibility
                QipCameraErrorHub.reportError(
                    errorCode = "PERMISSION_DENIED",
                    severity = CameraErrorSeverity.CRITICAL,
                    component = "Permissions",
                    message = failureMessage,
                    troubleshootingSteps = listOf(
                        "Tap 'Grant Camera Permission' when prompted.",
                        "If permanently denied, open Android Settings > Apps > QIP Optical Node > Permissions > Camera, and select 'Allow only while using the app'.",
                        "Ensure no enterprise or MDM policy has disabled camera hardware on this device."
                    )
                )

                callback.onPermissionDenied(currentState, failureMessage)
            }
        }
    }

    /**
     * Inspects permission status and requests it if not yet granted.
     * Returns true if already granted, false if request was initiated or blocked.
     */
    fun checkAndRequestCameraPermission(): Boolean {
        val permissionCheck = ContextCompat.checkSelfPermission(
            activity,
            CAMERA_PERMISSION
        )

        if (permissionCheck == PackageManager.PERMISSION_GRANTED) {
            currentState = CameraPermissionState.GRANTED
            callback.onPermissionGranted()
            return true
        }

        if (ActivityCompat.shouldShowRequestPermissionRationale(activity, CAMERA_PERMISSION)) {
            currentState = CameraPermissionState.RATIONALE_NEEDED
            Log.d(TAG, "Showing camera permission rationale to user.")
            permissionLauncher?.launch(CAMERA_PERMISSION)
        } else {
            Log.d(TAG, "Launching camera permission prompt directly.")
            permissionLauncher?.launch(CAMERA_PERMISSION)
        }

        return false
    }

    /**
     * Helper to open system application settings if permission was permanently denied
     */
    fun openAppSettings() {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", activity.packageName, null)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        activity.startActivity(intent)
    }

    fun hasPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            activity,
            CAMERA_PERMISSION
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun getState(): CameraPermissionState = currentState
}
