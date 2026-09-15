/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Android CameraX Hardware Error Listener
 * Captures low-level camera hardware faults, buffer starvations,
 * sensor occlusions, and disconnections, forwarding them to the
 * QIP Diagnostics Panel for troubleshooting.
 */

package org.qip.camera

import android.util.Log
import java.util.concurrent.CopyOnWriteArrayList

enum class CameraErrorSeverity {
    CRITICAL,
    WARNING,
    INFO
}

data class CameraHardwareIssue(
    val id: String,
    val timestamp: Long,
    val errorCode: String,
    val severity: CameraErrorSeverity,
    val component: String,
    val message: String,
    val troubleshootingSteps: List<String>,
    var resolved: Boolean = false
)

interface QipCameraErrorListener {
    fun onHardwareIssueCaptured(issue: CameraHardwareIssue)
    fun onHardwareIssueResolved(issueId: String)
}

object QipCameraErrorHub {
    private const val TAG = "QipCameraErrorHub"
    private val listeners = CopyOnWriteArrayList<QipCameraErrorListener>()
    private val issuesHistory = CopyOnWriteArrayList<CameraHardwareIssue>()

    fun registerListener(listener: QipCameraErrorListener) {
        listeners.add(listener)
        // Replay active unresolved issues to new listener
        issuesHistory.filter { !it.resolved }.forEach { listener.onHardwareIssueCaptured(it) }
    }

    fun unregisterListener(listener: QipCameraErrorListener) {
        listeners.remove(listener)
    }

    fun reportError(
        errorCode: String,
        severity: CameraErrorSeverity,
        component: String,
        message: String,
        troubleshootingSteps: List<String>
    ): CameraHardwareIssue {
        val issue = CameraHardwareIssue(
            id = "cam-err-${System.currentTimeMillis()}-${(1000..9999).random()}",
            timestamp = System.currentTimeMillis(),
            errorCode = errorCode,
            severity = severity,
            component = component,
            message = message,
            troubleshootingSteps = troubleshootingSteps,
            resolved = false
        )
        issuesHistory.add(issue)
        Log.e(TAG, "[$errorCode] [$severity] $component: $message")
        listeners.forEach {
            try {
                it.onHardwareIssueCaptured(issue)
            } catch (e: Exception) {
                Log.w(TAG, "Listener failed to handle issue", e)
            }
        }
        return issue
    }

    fun resolveError(issueId: String) {
        issuesHistory.find { it.id == issueId }?.let {
            it.resolved = true
            listeners.forEach { l -> l.onHardwareIssueResolved(issueId) }
        }
    }

    fun getActiveIssues(): List<CameraHardwareIssue> {
        return issuesHistory.filter { !it.resolved }
    }

    fun getAllIssues(): List<CameraHardwareIssue> {
        return issuesHistory.toList()
    }

    fun clearHistory() {
        issuesHistory.clear()
    }
}
