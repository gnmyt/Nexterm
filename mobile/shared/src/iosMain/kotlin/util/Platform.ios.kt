package dev.gnm.nexterm.util

import platform.UIKit.UIDevice

actual object Platform {
    actual val osName: String = "ios"
    actual val osVersion: String = UIDevice.currentDevice.systemVersion
}
