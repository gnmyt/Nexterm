package dev.gnm.nexterm.state

import com.russhwolf.settings.Settings

enum class ThemeMode(val storageValue: String) {
    SYSTEM("system"), LIGHT("light"), DARK("dark");

    companion object {
        fun parse(value: String?): ThemeMode = entries.firstOrNull { it.storageValue == value } ?: SYSTEM
    }
}

class ThemeSettings(settings: Settings) {
    private val mode = Pref(settings, "themeMode", ThemeMode.parse(settings.getStringOrNull("themeMode"))) { k, v -> putString(k, v.storageValue) }
    private val accent = Pref(settings, "accentColor", settings.getLongOrNull("accentColor") ?: FALLBACK_SEED_COLOR) { k, v -> putLong(k, v) }
    private val dynamic = settings.bool("useDynamicColor", true)

    val themeMode = mode.flow
    val accentColor = accent.flow
    val useDynamicColor = dynamic.flow

    fun setThemeMode(mode: ThemeMode) = this.mode.set(mode)
    fun setAccentColor(argb: Long) = accent.set(argb)
    fun setUseDynamicColor(value: Boolean) = dynamic.set(value)

    companion object {
        const val FALLBACK_SEED_COLOR = 0xFF673AB7L
        val ACCENT_COLOR_OPTIONS: List<Long> = listOf(
            0xFF673AB7L, 0xFF2196F3L, 0xFF009688L, 0xFF4CAF50L, 0xFFFFC107L,
            0xFFFF9800L, 0xFFF44336L, 0xFFE91E63L, 0xFF3F51B5L, 0xFF00BCD4L,
        )
    }
}
