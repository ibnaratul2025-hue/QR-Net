/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Android Camera Manager
 * Implements CameraX lifecycle management, optical frame analysis,
 * real-time resolution tracking, decode health telemetry, and hardware error handling.
 */

package org.qip.camera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.util.Log
import android.util.Size
import androidx.camera.core.Camera
import androidx.camera.core.CameraControl
import androidx.camera.core.CameraInfo
import androidx.camera.core.CameraSelector
import androidx.camera.core.CameraState
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

data class OpticalFrameMetrics(
    val resolutionWidth: Int,
    val resolutionHeight: Int,
    val rotationDegrees: Int,
    val format: Int,
    val fps: Double,
    val decodeHealthScore: Int,      // 0 - 100%
    val opticalLinkState: String,    // "LOCKED", "ACQUIRING", "DEGRADED", "NO_SIGNAL"
    val snrDb: Double,               // Signal-to-Noise Ratio (dB)
    val averageLuma: Double,         // 0 - 255
    val contrastRatio: Double,       // 0 - 100%
    val frameDropRate: Double        // 0 - 100%
)

class QipCameraManager(private val context: Context) {

    companion object {
        private const val TAG = "QipCameraManager"
    }

    private var cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private var cameraProvider: ProcessCameraProvider? = null
    private var activeCamera: Camera? = null

    private val isPaused = AtomicBoolean(false)
    private val frameCount = AtomicInteger(0)
    private val droppedFrameCount = AtomicInteger(0)
    private val lastFrameTime = AtomicLong(System.currentTimeMillis())
    private var currentFps = 0.0

    private val latestMetrics = AtomicReference(
        OpticalFrameMetrics(
            resolutionWidth = 0,
            resolutionHeight = 0,
            rotationDegrees = 0,
            format = ImageFormat.YUV_420_888,
            fps = 0.0,
            decodeHealthScore = 0,
            opticalLinkState = "NO_SIGNAL",
            snrDb = 0.0,
            averageLuma = 0.0,
            contrastRatio = 0.0,
            frameDropRate = 0.0
        )
    )

    interface OpticalFrameListener {
        fun onFrameAvailable(imageProxy: ImageProxy, metrics: OpticalFrameMetrics)
        fun onMetricsUpdated(metrics: OpticalFrameMetrics)
        fun onCameraError(exception: Exception)
    }

    fun hasCameraPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Initializes CameraX optical receiver pipeline with hardware error observer
     */
    fun startOpticalCapture(
        lifecycleOwner: LifecycleOwner,
        targetResolution: Size? = Size(1920, 1080),
        listener: OpticalFrameListener
    ) {
        if (!hasCameraPermission()) {
            val error = SecurityException("CAMERA permission not granted. Cannot initialize CameraX optical receiver.")
            QipCameraErrorHub.reportError(
                errorCode = "PERMISSION_REQUIRED",
                severity = CameraErrorSeverity.CRITICAL,
                component = "Permissions",
                message = "Camera access denied. Optical transceiver cannot operate without hardware camera access.",
                troubleshootingSteps = listOf(
                    "Request CAMERA runtime permission before starting transceiver.",
                    "Grant Camera permission in Android App Settings."
                )
            )
            listener.onCameraError(error)
            return
        }

        if (cameraExecutor.isShutdown) {
            cameraExecutor = Executors.newSingleThreadExecutor()
        }

        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            try {
                cameraProvider = cameraProviderFuture.get()

                // Configure optical stream analyzer with optimal resolution for screen detection
                val builder = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)

                if (targetResolution != null) {
                    builder.setTargetResolution(targetResolution)
                }

                val imageAnalysis = builder.build()

                imageAnalysis.setAnalyzer(cameraExecutor) { imageProxy ->
                    if (isPaused.get()) {
                        imageProxy.close()
                        return@setAnalyzer
                    }

                    try {
                        val metrics = analyzeFrameOptics(imageProxy)
                        latestMetrics.set(metrics)
                        listener.onFrameAvailable(imageProxy, metrics)
                        listener.onMetricsUpdated(metrics)
                    } catch (e: Exception) {
                        Log.e(TAG, "Frame analysis error", e)
                        QipCameraErrorHub.reportError(
                            errorCode = "FRAME_ANALYSIS_FAILED",
                            severity = CameraErrorSeverity.WARNING,
                            component = "ImageAnalysis",
                            message = "Image analysis threw an exception: ${e.localizedMessage}",
                            troubleshootingSteps = listOf(
                                "Check if device is experiencing heavy CPU/memory load.",
                                "Reduce target resolution if device thermal throttling occurs."
                            )
                        )
                    } finally {
                        imageProxy.close()
                    }
                }

                val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

                cameraProvider?.unbindAll()
                activeCamera = cameraProvider?.bindToLifecycle(
                    lifecycleOwner,
                    cameraSelector,
                    imageAnalysis
                )

                // Observe low-level CameraX hardware state transitions
                activeCamera?.cameraInfo?.cameraState?.observe(lifecycleOwner) { state ->
                    handleCameraStateChange(state)
                }

                Log.i(TAG, "CameraX optical transceiver bound successfully.")
            } catch (exc: Exception) {
                Log.e(TAG, "Failed to bind camera lifecycle", exc)
                QipCameraErrorHub.reportError(
                    errorCode = "CAMERAX_BIND_FAILED",
                    severity = CameraErrorSeverity.CRITICAL,
                    component = "CameraX",
                    message = "Could not bind camera to lifecycle: ${exc.localizedMessage}",
                    troubleshootingSteps = listOf(
                        "Ensure another application is not holding exclusive camera lock.",
                        "Verify device has an operational back camera sensor.",
                        "Restart the app or reboot device if the camera daemon is unresponsive."
                    )
                )
                listener.onCameraError(exc)
            }
        }, ContextCompat.getMainExecutor(context))
    }

    private fun handleCameraStateChange(state: CameraState) {
        when (state.type) {
            CameraState.Type.PENDING_OPEN -> {
                Log.d(TAG, "CameraState: PENDING_OPEN")
            }
            CameraState.Type.OPENING -> {
                Log.d(TAG, "CameraState: OPENING")
            }
            CameraState.Type.OPEN -> {
                Log.d(TAG, "CameraState: OPEN (Optical stream active)")
                QipCameraErrorHub.reportError(
                    errorCode = "CAMERA_HARDWARE_READY",
                    severity = CameraErrorSeverity.INFO,
                    component = "Sensor",
                    message = "Camera hardware open and capturing optical frames.",
                    troubleshootingSteps = emptyList()
                )
            }
            CameraState.Type.CLOSING -> {
                Log.d(TAG, "CameraState: CLOSING")
            }
            CameraState.Type.CLOSED -> {
                val error = state.error
                if (error != null) {
                    val errorMsg = when (error.code) {
                        CameraState.ERROR_CAMERA_IN_USE -> "Camera hardware is currently in use by another application."
                        CameraState.ERROR_MAX_CAMERAS_IN_USE -> "Maximum number of camera streams reached on this hardware."
                        CameraState.ERROR_OTHER_RECOVERABLE_ERROR -> "Recoverable camera hardware error occurred."
                        CameraState.ERROR_STREAM_CONFIG -> "Camera stream configuration failed. Unsupported resolution."
                        CameraState.ERROR_CAMERA_DISABLED -> "Camera device has been disabled by device policy."
                        CameraState.ERROR_CAMERA_FATAL_ERROR -> "Fatal camera hardware fault. Sensor unreachable."
                        CameraState.ERROR_DO_NOT_DISTURB_MODE_ENABLED -> "Camera blocked by Do Not Disturb policy."
                        else -> "Camera closed unexpectedly with error code: ${error.code}"
                    }
                    val severity = if (error.code == CameraState.ERROR_CAMERA_FATAL_ERROR) {
                        CameraErrorSeverity.CRITICAL
                    } else {
                        CameraErrorSeverity.WARNING
                    }
                    QipCameraErrorHub.reportError(
                        errorCode = "CAMERAX_ERR_${error.code}",
                        severity = severity,
                        component = "CameraX",
                        message = errorMsg,
                        troubleshootingSteps = listOf(
                            "Close any background camera apps (Instagram, Snapchat, Camera).",
                            "Verify Camera permissions in Android App Settings.",
                            "Check device temperature to ensure sensor is not thermally shut down."
                        )
                    )
                }
            }
        }
    }

    /**
     * Inspects Y-plane luma buffer to evaluate optical SNR, contrast, and link health
     */
    private fun analyzeFrameOptics(imageProxy: ImageProxy): OpticalFrameMetrics {
        val now = System.currentTimeMillis()
        val dt = (now - lastFrameTime.get()) / 1000.0
        if (dt > 0.05) {
            currentFps = 0.8 * currentFps + 0.2 * (1.0 / dt)
            lastFrameTime.set(now)
        }
        val frames = frameCount.incrementAndGet()

        val yPlane = imageProxy.planes[0].buffer
        val totalPixels = min(yPlane.remaining(), 4096) // sample fast representative block
        var sumLuma = 0.0
        var minLuma = 255
        var maxLuma = 0

        val step = max(1, yPlane.remaining() / totalPixels)
        var sampled = 0
        var i = 0
        while (i < yPlane.remaining() && sampled < totalPixels) {
            val luma = yPlane.get(i).toInt() and 0xFF
            sumLuma += luma
            if (luma < minLuma) minLuma = luma
            if (luma > maxLuma) maxLuma = luma
            sampled++
            i += step
        }

        val avgLuma = if (sampled > 0) sumLuma / sampled else 128.0
        val contrast = if (maxLuma + minLuma > 0) {
            ((maxLuma - minLuma).toDouble() / (maxLuma + minLuma).toDouble()) * 100.0
        } else 0.0

        // Detect lens occlusion or dark frame
        if (avgLuma < 8.0 && contrast < 10.0) {
            QipCameraErrorHub.reportError(
                errorCode = "SENSOR_OCCLUDED_OR_DARK",
                severity = CameraErrorSeverity.WARNING,
                component = "Sensor",
                message = "Optical camera sensor is receiving near-zero light (avg luma: ${avgLuma.toInt()}). Check for lens cover.",
                troubleshootingSteps = listOf(
                    "Ensure phone camera lens is not covered or obstructed.",
                    "Point camera directly at the transmitting screen.",
                    "Increase screen brightness on transmitting device."
                )
            )
        }

        // Estimate SNR in dB (higher contrast & balanced light = higher SNR)
        val snrDb = max(0.0, min(30.0, (contrast / 100.0) * 20.0 + (if (avgLuma in 40.0..220.0) 8.0 else 2.0)))

        // Calculate Decode Health Score (0 - 100%)
        val healthScore = min(100, max(0, ((snrDb / 25.0) * 50.0 + (contrast / 100.0) * 50.0).toInt()))

        val linkState = when {
            healthScore >= 80 -> "LOCKED"
            healthScore >= 50 -> "ACQUIRING"
            healthScore >= 20 -> "DEGRADED"
            else -> "NO_SIGNAL"
        }

        return OpticalFrameMetrics(
            resolutionWidth = imageProxy.width,
            resolutionHeight = imageProxy.height,
            rotationDegrees = imageProxy.imageInfo.rotationDegrees,
            format = imageProxy.format,
            fps = (currentFps * 10).toInt() / 10.0,
            decodeHealthScore = healthScore,
            opticalLinkState = linkState,
            snrDb = (snrDb * 10).toInt() / 10.0,
            averageLuma = avgLuma,
            contrastRatio = (contrast * 10).toInt() / 10.0,
            frameDropRate = 0.0
        )
    }

    fun pauseProcessing() {
        isPaused.set(true)
        Log.i(TAG, "Optical camera processing paused.")
    }

    fun resumeProcessing() {
        isPaused.set(false)
        Log.i(TAG, "Optical camera processing resumed.")
    }

    fun stopOpticalCapture() {
        cameraProvider?.unbindAll()
        activeCamera = null
        Log.i(TAG, "Optical camera capture stopped.")
    }

    fun release() {
        stopOpticalCapture()
        if (!cameraExecutor.isShutdown) {
            cameraExecutor.shutdown()
        }
    }

    fun getLatestMetrics(): OpticalFrameMetrics = latestMetrics.get()
}
