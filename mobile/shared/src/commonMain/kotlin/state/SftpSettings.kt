package dev.gnm.nexterm.state

import com.russhwolf.settings.Settings

class SftpSettings(settings: Settings) {
    private val hidden = settings.bool("sftp_showHiddenFiles", false)
    private val confirm = settings.bool("sftp_confirmBeforeDelete", true)
    private val foldersFirst = settings.bool("sftp_sortFoldersFirst", true)

    val showHiddenFiles = hidden.flow
    val confirmBeforeDelete = confirm.flow
    val sortFoldersFirst = foldersFirst.flow

    fun setShowHiddenFiles(value: Boolean) = hidden.set(value)
    fun setConfirmBeforeDelete(value: Boolean) = confirm.set(value)
    fun setSortFoldersFirst(value: Boolean) = foldersFirst.set(value)
}
