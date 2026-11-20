package dev.gnm.nexterm.app

import android.graphics.Color.TRANSPARENT
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.LocalActivity
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.core.graphics.ColorUtils
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.materialkolor.rememberDynamicColorScheme
import dev.gnm.nexterm.state.ThemeMode
import dev.gnm.nexterm.state.ThemeSettings
import androidx.compose.runtime.getValue

val supportsDynamicColor = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

@Immutable
class NxColors(
    val isDark: Boolean, val accent: Color, val onAccent: Color, val accentText: Color, val fill: Color, val border: Color, val borderStrong: Color, val subtext: Color,
) {
    val accentFill = accent.copy(alpha = if (isDark) 0.25f else 0.15f)
    val success = Color(if (isDark) 0xFF30C77A else 0xFF29C16A)
    val warning = Color(if (isDark) 0xFFF0962A else 0xFFDC5600)
    val error = Color(if (isDark) 0xFFE5484D else 0xFFD85959)
    val violet = Color(if (isDark) 0xFFA78BFA else 0xFF7C3AED)
    val pink = Color(if (isDark) 0xFFF472B6 else 0xFFDB2777)
    val proxmox = Color(0xFFDC5600)
    val terminal = Color(0xFF13181C)
}

val LocalNxColors = staticCompositionLocalOf { brandColors(true, Color(ThemeSettings.FALLBACK_SEED_COLOR)) }

val nxc: NxColors @Composable @ReadOnlyComposable get() = LocalNxColors.current

private fun accentForText(accent: Color): Color {
    if (accent.toArgb() == ThemeSettings.FALLBACK_SEED_COLOR.toInt()) return Color(0xFF4F6AED)
    val hsl = FloatArray(3)
    ColorUtils.colorToHSL(accent.toArgb(), hsl)
    hsl[2] = (hsl[2] + 0.11f).coerceIn(0.58f, 0.8f)
    return Color(ColorUtils.HSLToColor(hsl))
}

private fun brandColors(dark: Boolean, accent: Color): NxColors {
    val base = if (dark) Color.White else Color(0xFF101620)
    return NxColors(
        dark, accent, Color.White, if (dark) accentForText(accent) else accent, base.copy(alpha = if (dark) 0.06f else 0.05f),
        base.copy(alpha = if (dark) 0.07f else 0.10f), base.copy(alpha = if (dark) 0.11f else 0.16f), Color(if (dark) 0xFF9AA4B5 else 0xFF5B6472),
    )
}

private fun ColorScheme.branded(t: NxColors): ColorScheme {
    val background = Color(if (t.isDark) 0xFF0A0D12 else 0xFFF6F7F9)
    val surface = Color(if (t.isDark) 0xFF10151C else 0xFFFFFFFF)
    val high = Color(if (t.isDark) 0xFF1B222C else 0xFFE6E8EC)
    val text = Color(if (t.isDark) 0xFFF2F4F8 else 0xFF0B0E13)
    return copy(
        primary = t.accentText, onPrimary = Color.White, primaryContainer = t.accent, onPrimaryContainer = t.onAccent, surfaceTint = t.accentText,
        secondaryContainer = t.accentFill.compositeOver(surface), onSecondaryContainer = text,
        background = background, onBackground = text, surface = background, onSurface = text, surfaceVariant = high, onSurfaceVariant = t.subtext,
        surfaceDim = background, surfaceBright = high, surfaceContainerLowest = background, surfaceContainerLow = surface, surfaceContainer = surface,
        surfaceContainerHigh = high, surfaceContainerHighest = high, outlineVariant = t.border,
        error = t.error, onError = Color.White, errorContainer = t.error.copy(alpha = 0.18f).compositeOver(background), onErrorContainer = text,
    )
}

@Composable
fun NextermTheme(content: @Composable () -> Unit) {
    val ts = nx.themeSettings
    val mode by ts.themeMode.collectAsStateWithLifecycle()
    val accent by ts.accentColor.collectAsStateWithLifecycle()
    val useDynamic by ts.useDynamicColor.collectAsStateWithLifecycle()
    val dark = when (mode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    val context = LocalContext.current
    val seeded = rememberDynamicColorScheme(Color(accent), dark)
    val brand = brandColors(dark, Color(accent))
    val (scheme, tokens) = when {
        useDynamic && supportsDynamicColor -> (if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)).let {
            it to NxColors(dark, it.primary, it.onPrimary, it.primary, it.onSurface.copy(alpha = 0.06f), it.outlineVariant, it.outline.copy(alpha = 0.5f), it.onSurfaceVariant)
        }
        else -> seeded.branded(brand) to brand
    }
    val activity = LocalActivity.current as? ComponentActivity
    LaunchedEffect(dark) {
        activity?.enableEdgeToEdge(SystemBarStyle.auto(TRANSPARENT, TRANSPARENT) { dark }, SystemBarStyle.auto(TRANSPARENT, TRANSPARENT) { dark })
    }
    CompositionLocalProvider(LocalNxColors provides tokens) {
        MaterialTheme(colorScheme = scheme) { CompositionLocalProvider(LocalContentColor provides scheme.onSurface, content = content) }
    }
}
