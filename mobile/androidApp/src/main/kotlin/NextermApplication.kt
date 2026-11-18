package dev.gnm.nexterm.app

import android.app.Application
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.ProcessLifecycleOwner
import dev.gnm.nexterm.Nexterm

class NextermApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Nexterm.start(packageManager.getPackageInfo(packageName, 0).versionName ?: "")
        ProcessLifecycleOwner.get().lifecycle.addObserver(LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_START) Nexterm.shared.onResume()
        })
    }
}
