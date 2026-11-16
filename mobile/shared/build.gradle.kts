import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidMultiplatformLibrary)
    alias(libs.plugins.kotlinSerialization)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
}

kotlin {
    listOf(iosArm64() to "ios-arm64", iosSimulatorArm64() to "ios-arm64-simulator").forEach { (target, slice) ->
        target.binaries.framework {
            baseName = "NextermKit"
            isStatic = true
        }
        target.compilations.getByName("main").cinterops.create("nextermvt") {
            defFile(project.file("native/nextermvt.def"))
            includeDirs(project.file("native"), project.file("native/ghostty-vt.xcframework/$slice/Headers"))
            extraOpts("-libraryPath", project.file("native/ghostty-vt.xcframework/$slice").absolutePath)
        }
    }

    android {
        namespace = "dev.gnm.nexterm.shared"
        compileSdk = libs.versions.android.compileSdk.get().toInt()
        minSdk = libs.versions.android.minSdk.get().toInt()
        compilerOptions { jvmTarget = JvmTarget.JVM_17 }
        androidResources { enable = true }
    }

    compilerOptions {
        freeCompilerArgs.add("-Xexpect-actual-classes")
        optIn.add("kotlin.concurrent.atomics.ExperimentalAtomicApi")
        optIn.add("kotlin.time.ExperimentalTime")
    }

    sourceSets {
        commonMain.dependencies {
            api(libs.kotlinx.coroutines.core)
            api(libs.kotlinx.serialization.json)
            implementation(libs.ktor.client.core)
            implementation(libs.ktor.client.websockets)
            api(libs.multiplatform.settings)
            implementation(libs.multiplatform.settings.noarg)
            implementation(libs.compose.runtime)
            implementation(libs.compose.foundation)
            implementation(libs.compose.ui)
            implementation(libs.compose.components.resources)
        }
        androidMain.dependencies {
            implementation(libs.ktor.client.okhttp)
            implementation(libs.kotlinx.coroutines.android)
        }
        iosMain.dependencies {
            implementation(libs.ktor.client.darwin)
        }
    }
}

compose.resources {
    packageOfResClass = "dev.gnm.nexterm.resources"
}
