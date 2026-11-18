package dev.gnm.nexterm.util

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull

internal val NextermJson = Json { ignoreUnknownKeys = true; isLenient = true; explicitNulls = false; coerceInputValues = true }

internal object FlexBool : KSerializer<Boolean> {
    override val descriptor = PrimitiveSerialDescriptor("FlexBool", PrimitiveKind.BOOLEAN)
    override fun serialize(encoder: Encoder, value: Boolean) = encoder.encodeBoolean(value)
    override fun deserialize(decoder: Decoder): Boolean {
        val p = (decoder as JsonDecoder).decodeJsonElement() as? JsonPrimitive ?: return false
        return p.booleanOrNull ?: (p.doubleOrNull == 1.0)
    }
}

internal typealias Flag = @Serializable(FlexBool::class) Boolean

internal fun parseJsonOrNull(text: String): JsonElement? =
    runCatching { NextermJson.parseToJsonElement(text) }.getOrNull()

internal fun JsonElement?.asObject(): JsonObject? = this as? JsonObject
internal fun JsonElement?.asArray(): JsonArray? = this as? JsonArray

private fun JsonElement?.prim(): JsonPrimitive? = (this as? JsonPrimitive)?.takeUnless { it is JsonNull }

internal fun JsonObject.str(key: String): String? = this[key].prim()?.content
internal fun JsonObject.stringOnly(key: String): String? = this[key].prim()?.takeIf { it.isString }?.content
internal fun JsonObject.int(key: String): Int? = this[key].prim()?.takeUnless { it.isString }?.let { it.longOrNull ?: it.doubleOrNull?.toLong() }?.toInt()
internal fun JsonObject.boolOrNull(key: String): Boolean? = this[key].prim()?.takeUnless { it.isString }?.booleanOrNull
internal fun JsonObject.arr(key: String): JsonArray? = this[key] as? JsonArray

internal fun jsonOf(vararg pairs: Pair<String, Any?>): JsonObject =
    JsonObject(pairs.filter { it.second != null }.associate { (k, v) -> k to toJsonElement(v) })

internal fun toJsonElement(v: Any?): JsonElement = when (v) {
    null -> JsonNull
    is JsonElement -> v
    is String -> JsonPrimitive(v)
    is Number -> JsonPrimitive(v)
    is Boolean -> JsonPrimitive(v)
    is Map<*, *> -> JsonObject(v.entries.associate { it.key.toString() to toJsonElement(it.value) })
    is Iterable<*> -> JsonArray(v.map { toJsonElement(it) })
    else -> JsonPrimitive(v.toString())
}
