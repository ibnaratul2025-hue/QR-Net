/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Android Optical Link Visual Indicator
 * Jetpack Compose visual component displaying real-time camera frame
 * resolution, optical decode health score, link state, and SNR metrics.
 */

package org.qip.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.qip.camera.CameraHardwareIssue
import org.qip.camera.OpticalFrameMetrics

@Composable
fun QipOpticalIndicatorView(
    metrics: OpticalFrameMetrics,
    activeHardwareIssues: List<CameraHardwareIssue>,
    onTroubleshootClicked: (CameraHardwareIssue) -> Unit,
    modifier: Modifier = Modifier
) {
    // Dynamic color coding for optical link health
    val healthColor by animateColorAsState(
        targetValue = when {
            metrics.decodeHealthScore >= 80 -> Color(0xFF10B981) // Emerald
            metrics.decodeHealthScore >= 50 -> Color(0xFF06B6D4) // Cyan
            metrics.decodeHealthScore >= 20 -> Color(0xFFF59E0B) // Amber
            else -> Color(0xFFEF4444)                            // Rose
        },
        label = "healthColor"
    )

    val animatedHealthPercent by animateFloatAsState(
        targetValue = metrics.decodeHealthScore / 100f,
        label = "animatedHealth"
    )

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xFF0F172A))
            .border(1.dp, Color(0xFF1E293B), RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Top Header: Resolution & Link Status Badge
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Pulsing optical lock indicator
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(healthColor)
                )

                Text(
                    text = "OPTICAL LINK STATUS",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF94A3B8),
                    letterSpacing = 1.sp
                )
            }

            // Resolution Badge (Real-time camera feed dimensions)
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = Color(0xFF1E293B),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155))
            ) {
                Text(
                    text = if (metrics.resolutionWidth > 0) {
                        "${metrics.resolutionWidth}×${metrics.resolutionHeight} @ ${metrics.fps} FPS"
                    } else {
                        "INITIALIZING..."
                    },
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF38BDF8),
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
        }

        // Decode Health Progress Bar & Numeric Indicator
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Decode Health: ${metrics.decodeHealthScore}% (${metrics.opticalLinkState})",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = healthColor
                )

                Text(
                    text = "SNR: ${metrics.snrDb} dB",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    color = Color(0xFF94A3B8)
                )
            }

            LinearProgressIndicator(
                progress = { animatedHealthPercent },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
                color = healthColor,
                trackColor = Color(0xFF1E293B)
            )
        }

        // Secondary Telemetry Strip
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0xFF020617))
                .padding(horizontal = 10.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Contrast: ${metrics.contrastRatio}%",
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                color = Color(0xFF64748B)
            )
            Text(
                text = "Luma: ${metrics.averageLuma.toInt()} / 255",
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                color = Color(0xFF64748B)
            )
            Text(
                text = "Rotation: ${metrics.rotationDegrees}°",
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                color = Color(0xFF64748B)
            )
        }

        // Active Hardware Fault Alert Banner (if CameraX error captured)
        if (activeHardwareIssues.isNotEmpty()) {
            val primaryIssue = activeHardwareIssues.first()
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = Color(0xFF450A0A),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF991B1B)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(10.dp)) {
                    Text(
                        text = "⚠ HARDWARE ALERT: [${primaryIssue.errorCode}]",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFF87171)
                    )
                    Text(
                        text = primaryIssue.message,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        color = Color(0xFFFCA5A5),
                        modifier = Modifier.padding(top = 2.dp)
                    )
                    Button(
                        onClick = { onTroubleshootClicked(primaryIssue) },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7F1D1D)),
                        modifier = Modifier
                            .padding(top = 6.dp)
                            .height(30.dp),
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "Troubleshoot in Diagnostics",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            color = Color(0xFFFEF2F2)
                        )
                    }
                }
            }
        }
    }
}
