package dev.gnm.nexterm.guacamole

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.window.ComposeUIViewController
import platform.UIKit.UIViewController

fun GuacamoleViewController(viewport: GuacamoleViewport): UIViewController =
    ComposeUIViewController(configure = { enforceStrictPlistSanityCheck = false }) {
        GuacamoleCanvas(viewport = viewport, modifier = Modifier.fillMaxSize())
    }
