package dev.gnm.nexterm.util

import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.ln
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

    const val EMPTY = "–"

    private val BYTE_UNITS = listOf("B", "KB", "MB", "GB", "TB", "PB")
    private val RATE_UNITS = listOf("bit/s", "kbit/s", "Mbit/s", "Gbit/s")

    fun number(value: Double): String = if (value % 1.0 == 0.0) "${value.toLong()}" else fixed(value, 1)

    fun bytes(bytes: Long?): String {
        if (bytes == null || bytes <= 0L) return "0 B"
        val unit = (ln(bytes.toDouble()) / ln(1024.0)).toInt().coerceIn(0, BYTE_UNITS.lastIndex)
        val value = bytes / 1024.0.pow(unit)
        return "${if (unit == 0) "$bytes" else fixed(value, if (unit < 3) 1 else 2)} ${BYTE_UNITS[unit]}"
    }

    fun rate(bytesPerSecond: Double?): String {
        if (bytesPerSecond == null) return EMPTY
        val bits = bytesPerSecond * 8
        if (bits < 1000) return "${bits.toLong()} bit/s"
        val unit = (ln(bits) / ln(1000.0)).toInt().coerceIn(0, RATE_UNITS.lastIndex)
        val value = bits / 1000.0.pow(unit)
        return "${fixed(value, if (value >= 100) 0 else 1)} ${RATE_UNITS[unit]}"
    }

    fun linkSpeed(mbit: Double): String = if (mbit >= 1000) "${number(mbit / 1000)} Gbit/s" else "${mbit.toLong()} Mbit/s"

    fun compact(value: Double): String = when {
        value >= 1e9 -> "${number(floor(value / 1e8) / 10)}B"
        value >= 1e6 -> "${number(floor(value / 1e5) / 10)}M"
        value >= 1e3 -> "${number(floor(value / 1e2) / 10)}K"
        else -> "${value.toLong()}"
    }

    fun powerOn(hours: Double): String = when {
        hours >= 24 * 365 -> "${fixed(hours / (24 * 365), 1)} years"
        hours >= 48 -> "${(hours / 24 + 0.5).toLong()} days"
        else -> "${hours.toLong()} hours"
    }

    fun uptime(seconds: Long?): String = when {
        seconds == null || seconds <= 0 -> "Unknown"
        seconds >= 86400 -> "${seconds / 86400}d ${(seconds % 86400) / 3600}h"
        seconds >= 3600 -> "${seconds / 3600}h ${(seconds % 3600) / 60}m"
        else -> "${seconds / 60}m"
    }

    fun uptimeLong(seconds: Long?): String {
        if (seconds == null || seconds <= 0) return "Unknown"
        val days = seconds / 86400
        val hours = (seconds % 86400) / 3600
        val minutes = (seconds % 3600) / 60
        return when {
            days > 0 -> "$days days, $hours hours, $minutes minutes"
            hours > 0 -> "$hours hours, $minutes minutes"
            else -> "$minutes minutes"
        }
    }

    fun percent(value: Double): String = "${fixed(value, 1)}%"

    fun wholePercent(value: Double?): String = value?.let { "${(it + 0.5).toLong()}%" } ?: EMPTY

    fun fraction(percent: Double): Double = (percent / 100).coerceIn(0.0, 1.0)

    fun usageLevel(percent: Double): UsageLevel = when {
        percent >= 90 -> UsageLevel.CRITICAL
        percent >= 75 -> UsageLevel.WARNING
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
