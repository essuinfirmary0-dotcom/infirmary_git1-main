package com.essu.infirmarykiosk

import android.app.Activity
import android.util.Log
import android.webkit.JavascriptInterface
import android.widget.Toast
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class KioskPrinterBridge(
    private val activity: Activity,
    private val printerManager: PrinterManager,
) {
    private val printExecutor = Executors.newSingleThreadExecutor()
    private val printInProgress = AtomicBoolean(false)

    @JavascriptInterface
    fun printReceipt(payloadJson: String): Boolean = print(payloadJson)

    @JavascriptInterface
    fun printKioskReceipt(payloadJson: String): Boolean = print(payloadJson)

    @JavascriptInterface
    fun print(payloadJson: String): Boolean {
        if (printInProgress.get()) {
            activity.runOnUiThread {
                Toast.makeText(activity, "Printer is still working...", Toast.LENGTH_SHORT).show()
            }
            return true
        }

        printInProgress.set(true)
        printExecutor.execute {
            try {
                printerManager.printReceipt(payloadJson)
            } catch (error: Exception) {
                Log.e("KioskPrinterBridge", "Printing failed", error)
                activity.runOnUiThread {
                    Toast.makeText(
                        activity,
                        error.message ?: "Printer error",
                        Toast.LENGTH_LONG,
                    ).show()
                }
            } finally {
                printInProgress.set(false)
            }
        }

        return true
    }
}
