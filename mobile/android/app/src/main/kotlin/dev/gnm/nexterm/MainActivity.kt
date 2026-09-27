package dev.gnm.nexterm

import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "nexterm/downloads"
        ).setMethodCallHandler { call, result ->
            if (call.method == "showSavedDocument") {
                try {
                    val value = call.argument<String>("value").orEmpty()
                    openSavedLocation(value)
                } catch (e: Exception) {
                }
                result.success(true)
            } else {
                result.notImplemented()
            }
        }
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "nexterm/edit"
        ).setMethodCallHandler { call, result ->
            if (call.method == "open") {
                try {
                    val path = call.argument<String>("path").orEmpty()
                    result.success(openLocalFile(path))
                } catch (e: IllegalArgumentException) {
                    result.error("BAD_PATH", e.message, null)
                } catch (e: Exception) {
                    result.error("OPEN_FAILED", e.message, null)
                }
            } else {
                result.notImplemented()
            }
        }
    }

    private fun mimeTypeFor(name: String): String {
        val dot = name.lastIndexOf('.')
        val ext = if (dot >= 0) name.substring(dot + 1).lowercase() else ""
        if (ext.isEmpty()) return "*/*"
        MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext)?.let { return it }
        return when (ext) {
            "md", "log", "yaml", "yml", "toml", "conf", "cfg", "ini", "env", "sh" -> "text/plain"
            else -> "*/*"
        }
    }

    private fun openLocalFile(path: String): Boolean {
        if (path.isEmpty()) return false
        val file = File(path)
        if (!file.exists() || !file.isFile) return false
        val uri: Uri = FileProvider.getUriForFile(
            this,
            "${applicationContext.packageName}.fileprovider",
            file
        )
        val type = mimeTypeFor(file.name)
        val view = Intent(Intent.ACTION_VIEW)
        view.setDataAndType(uri, type)
        view.clipData = ClipData.newUri(contentResolver, file.name, uri)
        view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        view.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val chooser = Intent.createChooser(view, null)
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        chooser.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        try {
            startActivity(chooser)
        } catch (e: ActivityNotFoundException) {
            return false
        }
        return true
    }

    private fun openSavedLocation(value: String) {
        if (tryOpenParent(value)) return
        openDownloads()
    }

    private fun tryOpenParent(value: String): Boolean {
        val docId = extractDocumentId(value) ?: return false
        val slash = docId.lastIndexOf('/')
        if (slash <= 0) return false
        val parentId = docId.substring(0, slash)
        val authorities = arrayOf(
            "com.android.externalstorage.documents",
            "com.android.providers.downloads.documents"
        )
        for (authority in authorities) {
            try {
                val parentUri = DocumentsContract.buildDocumentUri(authority, parentId)
                val view = Intent(Intent.ACTION_VIEW)
                view.setDataAndType(parentUri, DocumentsContract.Document.MIME_TYPE_DIR)
                view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                startActivity(view)
                return true
            } catch (e: Exception) {
                continue
            }
        }
        return false
    }

    private fun extractDocumentId(value: String): String? {
        try {
            if (value.isEmpty()) return null
            if (value.startsWith("content:")) {
                try {
                    val uri = Uri.parse(value)
                    if (DocumentsContract.isDocumentUri(this, uri)) {
                        return DocumentsContract.getDocumentId(uri)
                    }
                } catch (e: Exception) {
                }
                val path = Uri.parse(value).path.orEmpty()
                val marker = "/document/"
                val index = path.indexOf(marker)
                if (index >= 0) return path.substring(index + marker.length)
                return null
            }
            val marker = "/document/"
            val index = value.indexOf(marker)
            if (index >= 0) return value.substring(index + marker.length)
            val treeMarker = "/tree/"
            val treeIndex = value.indexOf(treeMarker)
            if (treeIndex >= 0) return value.substring(treeIndex + treeMarker.length)
            return null
        } catch (e: Exception) {
            return null
        }
    }

    private fun openDownloads() {
        try {
            val view = Intent(DownloadManager.ACTION_VIEW_DOWNLOADS)
            view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(view)
        } catch (e: Exception) {
        }
    }
}
