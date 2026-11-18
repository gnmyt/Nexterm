package dev.gnm.nexterm.model

import dev.gnm.nexterm.util.Formatters

enum class HealthStatus(val label: String) { PASSED("Healthy"), WARNING("Warning"), FAILED("Failing"), DENIED("SMART needs root") }

data class FilesystemRow(
    val mountPoint: String,
    val tags: List<String>,
    val percent: Double,
    val usedText: String,
    val freeText: String,
    val source: String,
    val inodesPercent: Double?,
    val inodesText: String?,
)

data class DiskSegment(val name: String, val usage: String, val sizeText: String, val weight: Double, val shade: Int) {
    val isFree: Boolean get() = shade < 0
}

data class DiskRow(
    val name: String,
    val kind: String?,
    val model: String?,
    val sizeText: String,
    val health: HealthStatus?,
    val segments: List<DiskSegment>,
    val facts: List<InfoRow>,
)

class StorageOverview private constructor(
    val percent: Double?,
    val usedText: String,
    val freeText: String,
    val filesystems: List<FilesystemRow>,
    val disks: List<DiskRow>,
    val failing: String?,
) {
    internal companion object {
        private const val SHADES = 3
        private val LAYER_LABELS = mapOf("crypt" to "LUKS", "lvm" to "LVM")

        fun from(disks: List<Disk>): StorageOverview? {
            if (disks.isEmpty()) return null
            val volumes = disks.flatMap { it.partitions }.filter { it.isMounted }.distinctBy { it.mountPoint }.sortedByDescending { it.usagePercent }
            val total = volumes.sumOf { it.size }
            val used = volumes.sumOf { it.used }
            val failing = disks.filter { it.health?.status == "failed" }.map { "/dev/${it.name}" }
            return StorageOverview(
                percent = if (total > 0) used / total * 100 else null,
                usedText = "${bytes(used)} of ${bytes(total)} used",
                freeText = "${bytes(volumes.sumOf { it.available })} free",
                filesystems = volumes.map(::filesystem),
                disks = disks.map(::disk),
                failing = failing.takeIf { it.isNotEmpty() }
                    ?.let { "${it.joinToString(", ")} failed its SMART self-assessment. Back up the data and replace the disk." },
            )
        }

        private fun bytes(value: Double) = Formatters.bytes(value.toLong())

        private fun layerLabel(layer: String) = LAYER_LABELS[layer] ?: "RAID".takeIf { layer.startsWith("raid") }

        private fun filesystem(volume: Volume) = FilesystemRow(
            mountPoint = volume.mountPoint.orEmpty(),
            tags = (listOfNotNull(volume.type) + volume.layers.mapNotNull(::layerLabel)).distinct(),
            percent = volume.usagePercent,
            usedText = "${bytes(volume.used)} of ${bytes(volume.size)} used",
            freeText = "${bytes(volume.available)} free",
            source = if (volume.partitionName != volume.name) "${volume.name} on ${volume.partitionName}" else volume.name,
            inodesPercent = volume.inodesPercent,
            inodesText = volume.inodesPercent?.let {
                "${it.toLong()}% · ${Formatters.compact(volume.inodesUsed ?: 0.0)} of ${Formatters.compact(volume.inodesTotal ?: 0.0)}"
            },
        )

        private fun describe(volumes: List<Volume>): String {
            val mounts = volumes.filter { it.isMounted }.mapNotNull { it.mountPoint }
            return when {
                mounts.isNotEmpty() -> mounts.joinToString(", ")
                volumes.any { it.isSwap } -> "Swap"
                else -> "Not mounted"
            }
        }

        private fun disk(disk: Disk): DiskRow {
            val segments = disk.partitions.groupBy { it.partitionName }.entries.mapIndexed { i, (name, volumes) ->
                val size = volumes.first().partitionBytes
                DiskSegment(name, describe(volumes), bytes(size), size.coerceAtLeast(1.0), i % SHADES)
            }
            val unallocated = (disk.size - segments.sumOf { it.weight }).coerceAtLeast(0.0)
            val free = if (disk.size > 0 && unallocated / disk.size > 0.01) listOf(DiskSegment("Unallocated", "", bytes(unallocated), unallocated, -1)) else emptyList()
            val (health, facts) = health(disk.health)
            return DiskRow(
                name = "/dev/${disk.name}",
                kind = disk.rotational?.let { if (it) "HDD" else "SSD" },
                model = disk.model,
                sizeText = bytes(disk.size),
                health = health,
                segments = segments + free,
                facts = facts,
            )
        }

        private fun health(health: DiskHealth?): Pair<HealthStatus?, List<InfoRow>> {
            val reported = HealthStatus.entries.firstOrNull { it.name.lowercase() == health?.status }
            if (health == null || reported == null) return null to emptyList()
            val problems = listOf(
                "Reallocated sectors" to health.reallocatedSectors, "Pending sectors" to health.pendingSectors, "Media errors" to health.mediaErrors,
            ).filter { (it.second ?: 0.0) > 0 }
            val worn = (health.wearPercent ?: 0.0) >= 90
            val status = if (reported == HealthStatus.PASSED && (problems.isNotEmpty() || worn)) HealthStatus.WARNING else reported
            val facts = listOfNotNull(
                health.temperature?.let { InfoRow("Temperature", "${it.toLong()} °C") },
                health.powerOnHours?.let { InfoRow("Power-on time", Formatters.powerOn(it)) },
                health.wearPercent?.let { InfoRow("Wear", "${it.toLong()}%", alert = worn) },
            ) + problems.map { InfoRow(it.first, "${count(it.second)}", alert = true) }
            return status to facts
        }
    }
}

data class AddressRow(val text: String, val muted: Boolean) {
    val value: String get() = text.substringBefore('/')
}

data class InterfaceRow(
    val name: String,
    val isUp: Boolean,
    val stateLabel: String?,
    val isDefault: Boolean,
    val kind: String?,
    val addresses: List<AddressRow>,
    val primaryAddress: String?,
    val download: String,
    val upload: String,
    val downloadTotal: String,
    val uploadTotal: String,
    val meta: List<String>,
    val problems: List<InfoRow>,
)

data class NetworkSummary(val download: String, val upload: String, val facts: List<InfoRow>)

class NetworkOverview private constructor(val summary: NetworkSummary?, val interfaces: List<InterfaceRow>, val virtualInterfaces: List<InterfaceRow>) {
    internal companion object {
        fun from(network: List<NetworkInterface>): NetworkOverview? {
            if (network.isEmpty()) return null
            val sorted = network.sortedWith(
                compareByDescending<NetworkInterface> { it.isDefault }.thenByDescending { it.isUp }
                    .thenByDescending { (it.rxRate ?: 0.0) + (it.txRate ?: 0.0) }.thenBy { it.name },
            )
            val (virtual, main) = sorted.partition { it.isVirtual }
            val primary = sorted.firstOrNull { it.isDefault } ?: main.firstOrNull { it.isUp }
            return NetworkOverview(primary?.let(::summary), main.map(::row), virtual.map(::row))
        }

        private fun isLinkLocal(address: String) = address.lowercase().startsWith("fe80:")

        private fun primaryAddress(iface: NetworkInterface) = (iface.ipv4.firstOrNull() ?: iface.ipv6.firstOrNull { !isLinkLocal(it) })?.substringBefore('/')

        private fun speed(iface: NetworkInterface) = iface.speed?.takeIf { it > 0 }?.let(Formatters::linkSpeed)

        private fun summary(iface: NetworkInterface) = NetworkSummary(
            Formatters.rate(iface.rxRate), Formatters.rate(iface.txRate),
            listOfNotNull(
                InfoRow("Interface", iface.name),
                primaryAddress(iface)?.let { InfoRow("Address", it) },
                iface.gateway?.let { InfoRow("Gateway", it) },
                speed(iface)?.let { InfoRow("Speed", it) },
            ),
        )

        private fun problem(label: String, total: Double, recent: Double) = InfoRow(
            label, "${total.toLong()} $label" + if (recent > 0) " (+${recent.toLong()})" else "", alert = recent > 0,
        ).takeIf { total > 0 }

        private fun row(iface: NetworkInterface) = InterfaceRow(
            name = iface.name,
            isUp = iface.isUp,
            stateLabel = iface.state?.let { if (iface.isUp) "Up" else "Down" },
            isDefault = iface.isDefault,
            kind = iface.kind?.takeIf { it != "physical" },
            addresses = (iface.ipv4 + iface.ipv6).map { AddressRow(it, isLinkLocal(it)) }.sortedBy { it.muted },
            primaryAddress = primaryAddress(iface),
            download = Formatters.rate(iface.rxRate),
            upload = Formatters.rate(iface.txRate),
            downloadTotal = "${Formatters.bytes(iface.rxBytes.toLong())} total",
            uploadTotal = "${Formatters.bytes(iface.txBytes.toLong())} total",
            meta = listOfNotNull(
                speed(iface).takeIf { iface.kind == "physical" },
                iface.mtu?.let { "MTU ${it.toLong()}" },
                iface.mac?.takeIf { it != "00:00:00:00:00:00" },
            ),
            problems = listOfNotNull(problem("errors", iface.errors, iface.recentErrors), problem("dropped", iface.dropped, iface.recentDropped)),
        )
    }
}
