package dev.gnm.nexterm.app

import android.graphics.Color.TRANSPARENT
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.LocalActivity
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.materialkolor.rememberDynamicColorScheme
import dev.gnm.nexterm.state.ThemeMode
import androidx.compose.runtime.getValue

val supportsDynamicColor = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

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
    val scheme = when {
        useDynamic && supportsDynamicColor -> if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        else -> seeded
    }
    val activity = LocalActivity.current as? ComponentActivity
    LaunchedEffect(dark) {
        activity?.enableEdgeToEdge(SystemBarStyle.auto(TRANSPARENT, TRANSPARENT) { dark }, SystemBarStyle.auto(TRANSPARENT, TRANSPARENT) { dark })
    }
    MaterialTheme(colorScheme = scheme, content = content)
}
