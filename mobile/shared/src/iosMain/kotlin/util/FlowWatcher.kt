package dev.gnm.nexterm.util

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class Closeable internal constructor(private val job: Job) {
    fun close() = job.cancel()
}

private val mainScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

fun <T> Flow<T>.watch(onEach: (T) -> Unit): Closeable =
    Closeable(mainScope.launch { collect { onEach(it) } })

fun <T> StateFlow<T>.watchState(onEach: (T) -> Unit): Closeable {
    onEach(value)
    return Closeable(mainScope.launch { collect { onEach(it) } })
}
