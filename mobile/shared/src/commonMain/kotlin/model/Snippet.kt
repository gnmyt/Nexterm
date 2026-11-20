package dev.gnm.nexterm.model

import kotlinx.serialization.Serializable

@Serializable
data class Snippet(val id: Int = 0, val name: String = "", val command: String = "", val description: String? = null) {
    fun matches(query: String): Boolean = query.trim().let { q ->
        name.contains(q, true) || command.contains(q, true) || description?.contains(q, true) == true
    }
}
