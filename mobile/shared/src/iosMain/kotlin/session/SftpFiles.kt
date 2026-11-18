@file:OptIn(ExperimentalForeignApi::class)

package dev.gnm.nexterm.session

import dev.gnm.nexterm.api.NextermException
import dev.gnm.nexterm.model.SftpEntry
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.usePinned
import platform.Foundation.NSData
import platform.Foundation.NSFileHandle
import platform.Foundation.NSFileManager
import platform.Foundation.NSFileSize
import platform.Foundation.NSNumber
import platform.Foundation.closeFile
import platform.Foundation.create
import platform.Foundation.fileHandleForReadingAtPath
import platform.Foundation.fileHandleForWritingAtPath
import platform.Foundation.readDataOfLength
import platform.Foundation.writeData
import platform.posix.memcpy

fun uploadSource(path: String, name: String): UploadSource? {
    val size = (NSFileManager.defaultManager.attributesOfItemAtPath(path, null)?.get(NSFileSize) as? NSNumber)?.longLongValue ?: return null
    val handle = NSFileHandle.fileHandleForReadingAtPath(path) ?: return null
    return UploadSource(name, size) { max ->
        val data = handle.readDataOfLength(max.toULong())
        if (data.length == 0UL) null.also { handle.closeFile() } else data.toByteArray()
    }
}

@Throws(Exception::class)
suspend fun SftpBrowser.downloadToFile(entry: SftpEntry, path: String): Long {
    NSFileManager.defaultManager.createFileAtPath(path, null, null)
    val handle = NSFileHandle.fileHandleForWritingAtPath(path) ?: throw NextermException("Cannot write $path")
    try {
        return downloadTo(entry) { chunk -> handle.writeData(chunk.toNSData()) }
    } finally {
        handle.closeFile()
    }
}

private fun NSData.toByteArray(): ByteArray =
    ByteArray(length.toInt()).also { out -> out.usePinned { memcpy(it.addressOf(0), bytes, length) } }

private fun ByteArray.toNSData(): NSData =
    if (isEmpty()) NSData() else usePinned { NSData.create(bytes = it.addressOf(0), length = size.toULong()) }
