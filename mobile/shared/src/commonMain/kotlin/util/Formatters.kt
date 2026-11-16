package dev.gnm.nexterm.util

import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.pow
import kotlin.time.Clock
import kotlin.time.Instant

object Formatters {
    fun fixed(value: Double, digits: Int): String {
        val factor = 10.0.pow(digits)
        val rounded = floor(abs(value) * factor + 0.5).toLong()
        val intPart = rounded / factor.toLong()
        val frac = (rounded % factor.toLong()).toString().padStart(digits, '0')
        val sign = if (value < 0 && rounded != 0L) "-" else ""
        return if (digits == 0) "$sign$intPart" else "$sign$intPart.$frac"
    }

    fun bytes(bytes: Long?): String = when {
        bytes == null || bytes == 0L -> "0 B"
        bytes < 1024 -> "$bytes B"
        bytes < 1048576 -> "${fixed(bytes / 1024.0, 1)} KB"
        bytes < 1073741824 -> "${fixed(bytes / 1048576.0, 1)} MB"
        else -> "${fixed(bytes / 1073741824.0, 2)} GB"
    }

    fun uptime(seconds: Long?): String = when {
        seconds == null -> "Unknown"
        seconds >= 86400 -> "${seconds / 86400}d ${(seconds % 86400) / 3600}h"
        seconds >= 3600 -> "${seconds / 3600}h ${(seconds % 3600) / 60}m"
        else -> "${seconds / 60}m"
    }

    fun percent(value: Double): String = "${fixed(value, 1)}%"

    fun fraction(percent: Double): Double = (percent / 100).coerceIn(0.0, 1.0)

    fun usageLevel(percent: Double): UsageLevel = when {
        percent > 80 -> UsageLevel.CRITICAL
        percent > 60 -> UsageLevel.WARNING
        else -> UsageLevel.NORMAL
    }

    fun relativeTime(epochMillis: Long?): String =
        if (epochMillis == null) "Unknown" else relativeTime(epochMillis, nowMillis())

    fun relativeTime(epochMillis: Long, nowMillis: Long): String {
        val diff = nowMillis - epochMillis
        val minutes = diff / 60_000
        val hours = diff / 3_600_000
        val days = diff / 86_400_000
        return when {
            minutes < 1 -> "Just now"
            hours < 1 -> "${minutes}m ago"
            days < 1 -> "${hours}h ago"
            days < 7 -> "${days}d ago"
            else -> Instant.fromEpochMilliseconds(epochMillis).toString().take(10)
        }
    }

    fun nowMillis(): Long = Clock.System.now().toEpochMilliseconds()

    fun parseHexColor(color: String?): Long? {
        if (color == null || !color.startsWith("#")) return null
        return "FF${color.substring(1)}".toLongOrNull(16)?.takeIf { it <= 0xFFFFFFFFL }
    }
}

enum class UsageLevel { NORMAL, WARNING, CRITICAL }
