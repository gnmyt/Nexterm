package dev.gnm.nexterm.util

actual object Platform {
    actual val osName: String = "android"
    actual val osVersion: String = android.os.Build.VERSION.RELEASE ?: ""
}
