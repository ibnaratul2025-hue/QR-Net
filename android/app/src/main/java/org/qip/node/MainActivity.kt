/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Optical Node Android Main Activity
 * Implements camera permission flow, DefaultLifecycleObserver integration,
 * CameraX error listening, and real-time optical link feedback UI.
 */

package org.qip.node

import android.content.Intent
import android.os.Bundle
import android.util.Size
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.camera.core.ImageProxy
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.qip.camera.*
import org.qip.service.QipForegroundService
import org.qip.ui.QipOpticalIndicatorView

class MainActivity : ComponentActivity(), CameraPermissionCallback, QipCameraErrorListener {

    private lateinit var cameraManager: QipCameraManager
    private lateinit var permissionHandler: QipCameraPermissionHandler
    private lateinit var lifecycleObserver: QipNodeLifecycleObserver

    // Reactive Compose states
    private val frameMetricsState = mutableStateOf(
        OpticalFrameMetrics(
            resolutionWidth = 1920,
            resolutionHeight = 1080,
            rotationDegrees = 0,
            format = 35,
            fps = 0.0,
            decodeHealthScore = 0,
            opticalLinkState = "INITIALIZING",
            snrDb = 0.0,
            averageLuma = 0.0,
            contrastRatio = 0.0,
            frameDropRate = 0.0
        )
    )
    private val activeIssuesState = mutableStateListOf<CameraHardwareIssue>()
    private val permissionGrantedState = mutableStateOf(false)
    private val statusMessageState = mutableStateOf("Checking hardware permissions...")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        cameraManager = QipCameraManager(this)

        // 1. Setup CameraX Hardware Error Hub Listener
        QipCameraErrorHub.registerListener(this)

        // 2. Setup Lifecycle Observer for clean background suspension
        lifecycleObserver = QipNodeLifecycleObserver(
            cameraManager = cameraManager,
            onNodeStateChanged = { isSuspended, reason ->
                statusMessageState.value = reason
            }
        )
        lifecycle.addObserver(lifecycleObserver)

        // 3. Setup Permission Request Handler before optical transceiver initializes
        permissionHandler = QipCameraPermissionHandler(this, this)

        // Compose UI initialization
        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFF020617)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Header
                        Text(
                            text = "QIP OPTICAL NODE (ANDROID)",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = Color(0xFF38BDF8)
                        )

                        Text(
                            text = statusMessageState.value,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 12.sp,
                            color = Color(0xFF94A3B8)
                        )

                        // Permission Prompt Card if not granted
                        if (!permissionGrantedState.value) {
                            Card(
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text(
                                        text = "Camera Hardware Access Required",
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White
                                    )
                                    Text(
                                        text = "The QIP transceiver decodes line-of-sight optical frames from screens via the camera sensor.",
                                        fontSize = 12.sp,
                                        color = Color(0xFF94A3B8),
                                        modifier = Modifier.padding(top = 4.dp, bottom = 12.dp)
                                    )
                                    Button(
                                        onClick = { permissionHandler.checkAndRequestCameraPermission() },
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0284C7))
                                    ) {
                                        Text("Grant Camera Permission")
                                    }
                                }
                            }
                        }

                        // Real-time Visual Indicator: Frame Resolution, Decode Health, and Optical Link Quality
                        QipOpticalIndicatorView(
                            metrics = frameMetricsState.value,
                            activeHardwareIssues = activeIssuesState,
                            onTroubleshootClicked = { issue ->
                                statusMessageState.value = "Troubleshooting ${issue.errorCode}: ${issue.troubleshootingSteps.firstOrNull() ?: "Check sensor."}"
                            }
                        )
                    }
                }
            }
        }

        // Verify and request permissions before launching transceiver
        permissionHandler.checkAndRequestCameraPermission()
    }

    /**
     * CameraPermissionCallback: Called when CAMERA permission is granted
     */
    override fun onPermissionGranted() {
        permissionGrantedState.value = true
        statusMessageState.value = "Camera permission granted. Starting optical transceiver..."
        startOpticalTransceiver()
    }

    /**
     * CameraPermissionCallback: Called when CAMERA permission is denied
     */
    override fun onPermissionDenied(state: CameraPermissionState, message: String) {
        permissionGrantedState.value = false
        statusMessageState.value = message
    }

    private fun startOpticalTransceiver() {
        cameraManager.startOpticalCapture(
            lifecycleOwner = this,
            targetResolution = Size(1920, 1080),
            listener = object : QipCameraManager.OpticalFrameListener {
                override fun onFrameAvailable(imageProxy: ImageProxy, metrics: OpticalFrameMetrics) {
                    // Feed frame to optical carrier decoder
                }

                override fun onMetricsUpdated(metrics: OpticalFrameMetrics) {
                    runOnUiThread {
                        frameMetricsState.value = metrics
                    }
                }

                override fun onCameraError(exception: Exception) {
                    runOnUiThread {
                        statusMessageState.value = "Camera error: ${exception.localizedMessage}"
                    }
                }
            }
        )

        // Start background beacon service
        startForegroundService(Intent(this, QipForegroundService::class.java))
    }

    override fun onHardwareIssueCaptured(issue: CameraHardwareIssue) {
        runOnUiThread {
            if (!activeIssuesState.any { it.id == issue.id }) {
                activeIssuesState.add(issue)
            }
        }
    }

    override fun onHardwareIssueResolved(issueId: String) {
        runOnUiThread {
            activeIssuesState.removeAll { it.id == issueId }
        }
    }

    override fun onDestroy() {
        QipCameraErrorHub.unregisterListener(this)
        super.onDestroy()
    }
}
