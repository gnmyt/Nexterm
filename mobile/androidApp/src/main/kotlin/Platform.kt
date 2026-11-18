package dev.gnm.nexterm.app

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import androidx.core.net.toUri
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import java.io.File
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

suspend fun scanQrCode(context: Context): String? = suspendCancellableCoroutine { cont ->
    val options = GmsBarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build()
    GmsBarcodeScanning.getClient(context, options).startScan()
        .addOnSuccessListener { cont.resume(it.rawValue) }
        .addOnFailureListener { cont.resume(null) }
        .addOnCanceledListener { cont.resume(null) }
}

fun Context.openUrl(url: String) = runCatching { startActivity(Intent(Intent.ACTION_VIEW, url.toUri())) }.isSuccess

private fun Context.uriFor(file: File): Uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)

private fun mimeOf(file: File) = MimeTypeMap.getSingleton().getMimeTypeFromExtension(file.extension.lowercase()) ?: "application/octet-stream"

fun Context.openFile(file: File) {
    val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uriFor(file), mimeOf(file)).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    runCatching { startActivity(Intent.createChooser(intent, file.name)) }
}

fun Context.shareFiles(files: List<File>) {
    if (files.isEmpty()) return
    val uris = files.map(::uriFor)
    val intent = if (uris.size == 1) Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris[0]).setType(mimeOf(files[0]))
    else Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris)).setType("*/*")
    intent.clipData = ClipData.newRawUri(null, uris[0]).apply { uris.drop(1).forEach { addItem(ClipData.Item(it)) } }
    startActivity(Intent.createChooser(intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION), null))
}

fun Context.queryFile(uri: Uri): Pair<String, Long> {
    contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
        if (c.moveToFirst()) return (c.getString(0) ?: "file") to (if (c.isNull(1)) -1L else c.getLong(1))
    }
    return (uri.lastPathSegment ?: "file") to -1L
}
