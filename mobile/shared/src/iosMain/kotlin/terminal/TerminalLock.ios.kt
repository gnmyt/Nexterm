package dev.gnm.nexterm.terminal

import platform.Foundation.NSRecursiveLock

internal actual class TerminalLock {
    private val lock = NSRecursiveLock()
    actual fun lock() = lock.lock()
    actual fun unlock() = lock.unlock()
}
