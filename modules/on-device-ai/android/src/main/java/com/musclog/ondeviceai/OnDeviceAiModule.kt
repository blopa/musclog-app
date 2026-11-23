package com.musclog.ondeviceai

import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * File helpers for downloaded on-device models. The Apple Intelligence functions exist so the JS
 * surface is identical on both platforms; they always report "not available" here.
 */
class OnDeviceAiModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OnDeviceAi")

    Function("appleAvailability") { "unsupportedOs" }

    Function("appleSupportsLocale") { _: String -> false }

    // `noBackupFilesDir` is never copied by Auto Backup. The app's document directory is, and a
    // model larger than Auto Backup's 25 MB limit would make the whole app's backup fail.
    Function("storageDirectory") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      "file://" + File(context.noBackupFilesDir, "local-ai").absolutePath
    }

    // Own dispatcher: Expo's default queue is one thread shared by every module function.
    AsyncFunction("sha256File") Coroutine { path: String ->
      withContext(Dispatchers.IO) {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(File(plainPath(path))).use { input ->
          val buffer = ByteArray(1 shl 20)
          while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            digest.update(buffer, 0, read)
          }
        }
        digest.digest().joinToString("") { "%02x".format(it) }
      }
    }

    // iOS flags files for iCloud exclusion; Android keeps models in `noBackupFilesDir` already.
    AsyncFunction("setExcludedFromBackup") { _: String -> false }
  }

  private fun plainPath(path: String): String =
    if (path.startsWith("file://")) Uri.parse(path).path ?: path else path
}
