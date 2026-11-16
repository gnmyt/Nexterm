package dev.gnm.nexterm.app

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.DriveFileMove
import androidx.compose.material.icons.automirrored.outlined.InsertDriveFile
import androidx.compose.material.icons.outlined.*
import androidx.compose.ui.graphics.vector.ImageVector

fun iconFor(key: String): ImageVector = when (key) {
    "cube-outline" -> Icons.Outlined.ViewInAr
    "monitor" -> Icons.Outlined.Monitor
    "console", "console-line" -> Icons.Outlined.Terminal
    "microsoft-windows" -> Icons.Outlined.Window
    "remote-desktop", "monitor-small" -> Icons.Outlined.DesktopWindows
    "raspberry-pi" -> Icons.Outlined.DeveloperBoard
    "docker" -> Icons.Outlined.ViewInAr
    "folder" -> Icons.Outlined.Folder
    "folder-outline" -> Icons.Outlined.FolderOpen
    "folder-open" -> Icons.Outlined.FolderOpen
    "folder-plus-outline" -> Icons.Outlined.CreateNewFolder
    "domain" -> Icons.Outlined.Domain
    "domain-off" -> Icons.Outlined.DomainDisabled
    "server-network" -> Icons.Outlined.Lan
    "link-variant" -> Icons.Outlined.Link
    "file-document-outline" -> Icons.Outlined.Description
    "file-pdf-box" -> Icons.Outlined.PictureAsPdf
    "file-image-outline" -> Icons.Outlined.Image
    "file-video-outline" -> Icons.Outlined.VideoFile
    "file-music-outline" -> Icons.Outlined.AudioFile
    "zip-box-outline" -> Icons.Outlined.FolderZip
    "code-json" -> Icons.Outlined.DataObject
    "file-code-outline" -> Icons.Outlined.Code
    "file-cog-outline" -> Icons.Outlined.SettingsApplications
    "database-outline" -> Icons.Outlined.Storage
    "file-outline" -> Icons.AutoMirrored.Outlined.InsertDriveFile
    "file-edit-outline" -> Icons.Outlined.EditNote
    "information-outline" -> Icons.Outlined.Info
    "trash-can-outline" -> Icons.Outlined.Delete
    "file-move-outline" -> Icons.AutoMirrored.Outlined.DriveFileMove
    "lock-outline" -> Icons.Outlined.Lock
    "magnify" -> Icons.Outlined.Search
    "devices" -> Icons.Outlined.Devices
    "application" -> Icons.Outlined.Apps
    "cellphone-link" -> Icons.Outlined.PhonelinkSetup
    "cellphone" -> Icons.Outlined.Smartphone
    "tablet" -> Icons.Outlined.Tablet
    "laptop" -> Icons.Outlined.Laptop
    else -> Icons.Outlined.Dns
}
