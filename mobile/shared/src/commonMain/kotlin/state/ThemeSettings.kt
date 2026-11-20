package dev.gnm.nexterm.state

import com.russhwolf.settings.Settings

enum class ThemeMode(val storageValue: String) {
    SYSTEM("system"), LIGHT("light"), DARK("dark");

    companion object {
        fun parse(value: String?): ThemeMode = entries.firstOrNull { it.storageValue == value } ?: SYSTEM
    }
}

class AccentOption(val argb: Long, val name: String)

class ThemeSettings(settings: Settings) {
    private val mode = Pref(settings, "themeMode", ThemeMode.parse(settings.getStringOrNull("themeMode"))) { k, v -> putString(k, v.storageValue) }
    private val accent = Pref(settings, "accentColor", settings.getLongOrNull("accentColor") ?: FALLBACK_SEED_COLOR) { k, v -> putLong(k, v) }
    private val dynamic = settings.bool("useDynamicColor", false)

    val themeMode = mode.flow
    val accentColor = accent.flow
    val useDynamicColor = dynamic.flow

    fun setThemeMode(mode: ThemeMode) = this.mode.set(mode)
    fun setAccentColor(argb: Long) = accent.set(argb)
    fun setUseDynamicColor(value: Boolean) = dynamic.set(value)

    companion object {
        const val FALLBACK_SEED_COLOR = 0xFF314BD3L
        val ACCENTS: List<AccentOption> = listOf(
            AccentOption(0xFF314BD3L, "Nexterm Blue"), AccentOption(0xFF7C3AEDL, "Purple"), AccentOption(0xFFDB2777L, "Pink"),
            AccentOption(0xFFDC2626L, "Red"), AccentOption(0xFFEA580CL, "Orange"), AccentOption(0xFF16A34AL, "Green"),
            AccentOption(0xFF0D9488L, "Teal"), AccentOption(0xFF0891B2L, "Cyan"),
        )
    }
}
