package com.essu.infirmarykiosk

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Log
import com.csnprintersdk.csnio.CSNPOS
import com.csnprintersdk.csnio.CSNUSBPrinting
import com.csnprintersdk.csnio.csnbase.CSNCOMIO
import org.json.JSONObject

class PrinterManager(private val context: Context) {
    private val pos = CSNPOS()
    private val comPort = CSNCOMIO()
    private val usbPort = CSNUSBPrinting()

    init {
        pos.Set(comPort)
    }

    fun printReceipt(payloadJson: String) {
        val payload = JSONObject(payloadJson)
        ensurePrinterOpen()

        pos.POS_Reset()
        ReceiptFormatter.format(payload).forEach { line ->
            pos.POS_TextOut("$line\r\n", 0, 0, 0, 0, 0, 0)
        }
        repeat(FEED_LINES_BEFORE_CUT) {
            pos.POS_FeedLine()
        }
        Thread.sleep(CUTTER_SETTLE_DELAY_MS)
        try {
            pos.POS_FullCutPaper()
            Log.i(TAG, "Full cut command sent")
        } catch (error: Exception) {
            Log.w(TAG, "Full cut failed, trying half cut", error)
            try {
                pos.POS_HalfCutPaper()
                Log.i(TAG, "Half cut command sent")
            } catch (halfCutError: Exception) {
                Log.e(TAG, "Cut command failed", halfCutError)
            }
        }
        pos.POS_Beep(1, 2)
    }

    private fun ensurePrinterOpen() {
        if (pos.GetIO().IsOpened()) {
            return
        }

        if (tryUsbPrinter()) {
            return
        }

        val ports = CSNCOMIO.enumPorts()?.toList().orEmpty()
        if (ports.isEmpty()) {
            throw IllegalStateException(
                "No serial printer ports found, and no usable USB printer was available.",
            )
        }

        val sortedPorts = ports.sortedWith(
            compareBy<String> {
                when {
                    it.contains("ttyS", ignoreCase = true) -> 0
                    it.contains("ttyUSB", ignoreCase = true) -> 1
                    it.contains("ttyACM", ignoreCase = true) -> 2
                    it.contains("tty", ignoreCase = true) -> 3
                    else -> 4
                }
            }.thenBy { it },
        )

        Log.i(TAG, "Available printer COM ports: ${sortedPorts.joinToString()}")

        val attempts = mutableListOf<String>()
        for (port in sortedPorts) {
            for (baudRate in COMMON_BAUD_RATES) {
                attempts += "$port@$baudRate"
                try {
                    comPort.Close()
                } catch (_: Exception) {
                    // Ignore close errors before re-opening a different candidate.
                }

                Log.i(TAG, "Trying printer port $port at $baudRate baud")
                comPort.Open(port, baudRate, 1, 8, 0, 0, 0)
                Thread.sleep(OPEN_WAIT_MS)

                if (pos.GetIO().IsOpened()) {
                    Log.i(TAG, "Printer opened on $port at $baudRate baud")
                    return
                }
            }
        }

        throw IllegalStateException(
            "Printer did not open. Tried ${attempts.joinToString()}",
        )
    }

    private fun tryUsbPrinter(): Boolean {
        val usbManager = context.getSystemService(Context.USB_SERVICE) as? UsbManager ?: return false
        val devices = usbManager.deviceList.values.toList()
        if (devices.isEmpty()) {
            return false
        }

        Log.i(
            TAG,
            "USB devices seen by kiosk: ${devices.joinToString { describeUsbDevice(it) }}",
        )

        val printerDevice = devices.firstOrNull(::looksLikePrinterDevice) ?: return false
        Log.i(TAG, "Trying USB printer ${describeUsbDevice(printerDevice)}")

        if (!usbManager.hasPermission(printerDevice)) {
            requestUsbPermission(usbManager, printerDevice)
            throw IllegalStateException(
                "Allow the USB printer permission popup on the kiosk, then tap Print again.",
            )
        }

        try {
            usbPort.Close()
        } catch (_: Exception) {
            // Ignore stale close errors before re-opening.
        }

        pos.Set(usbPort)
        val opened = usbPort.Open(usbManager, printerDevice, context)
        Thread.sleep(OPEN_WAIT_MS)

        if (opened && pos.GetIO().IsOpened()) {
            Log.i(TAG, "USB printer opened successfully")
            return true
        }

        Log.w(TAG, "USB printer open attempt failed")
        pos.Set(comPort)
        return false
    }

    private fun requestUsbPermission(usbManager: UsbManager, device: UsbDevice) {
        val intent = Intent("${context.packageName}.USB_PERMISSION")
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val permissionIntent = PendingIntent.getBroadcast(context, 0, intent, flags)
        usbManager.requestPermission(device, permissionIntent)
    }

    private fun looksLikePrinterDevice(device: UsbDevice): Boolean {
        val manufacturer = device.manufacturerName.orEmpty()
        val product = device.productName.orEmpty()

        if (manufacturer.contains("gprinter", ignoreCase = true)) return true
        if (product.contains("gprinter", ignoreCase = true)) return true
        if (product.contains("gp-", ignoreCase = true)) return true
        if (device.deviceClass == UsbConstants.USB_CLASS_PRINTER) return true

        for (index in 0 until device.interfaceCount) {
            if (device.getInterface(index).interfaceClass == UsbConstants.USB_CLASS_PRINTER) {
                return true
            }
        }

        return false
    }

    private fun describeUsbDevice(device: UsbDevice): String {
        return buildString {
            append(device.deviceName)
            append(" vid=")
            append(device.vendorId)
            append(" pid=")
            append(device.productId)
            device.manufacturerName?.takeIf { it.isNotBlank() }?.let {
                append(" mfg=")
                append(it)
            }
            device.productName?.takeIf { it.isNotBlank() }?.let {
                append(" product=")
                append(it)
            }
        }
    }

    companion object {
        private const val TAG = "PrinterManager"
        private val COMMON_BAUD_RATES = listOf(9600, 19200, 38400, 57600, 115200)
        private const val OPEN_WAIT_MS = 350L
        private const val FEED_LINES_BEFORE_CUT = 5
        private const val CUTTER_SETTLE_DELAY_MS = 180L
    }
}
