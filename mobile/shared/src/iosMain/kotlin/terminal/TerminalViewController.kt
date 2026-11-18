package dev.gnm.nexterm.terminal

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.window.ComposeUIViewController
import platform.UIKit.UIViewController

fun TerminalViewController(controller: TerminalController, onTap: () -> Unit): UIViewController =
    ComposeUIViewController { TerminalCanvas(controller, Modifier.fillMaxSize(), onTap = onTap) }
