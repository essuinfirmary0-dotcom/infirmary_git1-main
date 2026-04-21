# Kiosk Printer Bridge Guide

This guide keeps the current web system unchanged for normal users while adding a native printer path for the Android kiosk.

## Goal

- Keep the existing web kiosk URL and check-in flow.
- Keep browser printing as a fallback.
- Add a native Android printer bridge so the built-in thermal printer prints reliably after check-in.

## Current Web Behavior

The kiosk receipt print flow already exists in:

- `src/components/KioskCheckIn.jsx`
- `src/utils/kioskPrintReceipt.js`

The web app now does this:

1. Try a native bridge first:
   - `window.KioskPrinter.printReceipt(...)`
   - `window.AndroidPrinter.printReceipt(...)`
   - `window.Android.printReceipt(...)`
2. If no native bridge is available, fall back to browser printing with `window.print()`.

This means:

- normal browsers keep working as before
- the kiosk can become hardware-aware without changing the backend

## Recommended Architecture

Build a small Android app that:

1. Opens the kiosk URL inside a `WebView`
2. Exposes a JavaScript bridge named `KioskPrinter`
3. Receives the receipt JSON from the web app
4. Sends the formatted receipt to the vendor printer SDK

## Flow

1. User checks in on the kiosk page
2. Web app shows the receipt overlay
3. Web app calls `printKioskReceipt(kioskResult)`
4. `printKioskReceipt` tries the Android bridge
5. Android native code prints through the built-in printer
6. If the bridge is unavailable, the app falls back to browser print

## Receipt Payload Sent To Android

The web app sends a JSON string shaped like this:

```json
{
  "queueNumber": "Q-001",
  "checkInDateDisplay": "Apr 21, 2026, 1:05 PM",
  "hasAppointmentToday": true,
  "user": {
    "name": "Juan Dela Cruz",
    "userType": "student",
    "studentNumber": "NS-04658",
    "employeeNumber": "",
    "college": "College of Engineering",
    "program": "BS in Computer Engineering"
  },
  "appointment": {
    "code": "APT-00007",
    "time": "1:00 PM - 4:00 PM",
    "service": "Dental",
    "subcategory": "Consultation",
    "status": "Waiting"
  }
}
```

## Android App Structure

Suggested structure:

- `MainActivity`
- `KioskPrinterBridge`
- `PrinterManager`
- `ReceiptFormatter`

## Step 1: Extract The Vendor SDK

Your SDK archive is currently here:

- `SDK/AndroidSDK_210128(1) (1).rar`

Extract it and locate:

- the demo/sample Android project
- the printer `.jar` or `.aar`
- any required permissions or manifest entries

If the sample app prints successfully, copy the same printer initialization approach from that sample into your wrapper app.

## Step 2: Create The Android Wrapper App

Use Android Studio and create a simple app with:

- Minimum SDK compatible with the kiosk
- Java or Kotlin
- a full-screen `WebView`

### Main activity outline

```kotlin
class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var printerManager: PrinterManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        printerManager = PrinterManager(this)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = true
        webView.settings.mediaPlaybackRequiresUserGesture = false

        webView.addJavascriptInterface(
            KioskPrinterBridge(this, printerManager),
            "KioskPrinter"
        )

        webView.webViewClient = WebViewClient()
        webView.loadUrl("https://your-kiosk-url-here")
    }
}
```

## Step 3: Add The JavaScript Bridge

```kotlin
class KioskPrinterBridge(
    private val context: Context,
    private val printerManager: PrinterManager
) {
    @JavascriptInterface
    fun printReceipt(payloadJson: String): Boolean {
        return try {
            printerManager.printReceipt(payloadJson)
            true
        } catch (e: Exception) {
            false
        }
    }
}
```

## Step 4: Build The Printer Manager

This class should wrap the vendor SDK only once, so the rest of the app stays clean.

```kotlin
class PrinterManager(private val context: Context) {
    fun printReceipt(payloadJson: String) {
        val payload = JSONObject(payloadJson)

        val lines = ReceiptFormatter.format(payload)

        // Replace this block with the vendor SDK calls from the sample app.
        // Example only:
        // printer.open()
        // lines.forEach { printer.printText(it + "\\n") }
        // printer.feed(3)
        // printer.cutPaper()
    }
}
```

## Step 5: Format The Receipt Natively

```kotlin
object ReceiptFormatter {
    fun format(payload: JSONObject): List<String> {
        val user = payload.optJSONObject("user")
        val appointment = payload.optJSONObject("appointment")
        val lines = mutableListOf<String>()

        lines += "ESSU MAIN INFIRMARY BUILDING"
        lines += "KIOSK CHECK-IN RECEIPT"
        lines += " "
        lines += "QUEUE: ${payload.optString("queueNumber")}"
        lines += payload.optString("checkInDateDisplay")
        lines += " "
        lines += "NAME: ${user?.optString("name").orEmpty()}"

        val studentNumber = user?.optString("studentNumber").orEmpty()
        if (studentNumber.isNotBlank()) lines += "STUDENT NO: $studentNumber"

        val employeeNumber = user?.optString("employeeNumber").orEmpty()
        if (employeeNumber.isNotBlank()) lines += "EMPLOYEE NO: $employeeNumber"

        val userType = user?.optString("userType").orEmpty()
        if (userType.equals("guest", ignoreCase = true)) {
            val guestType = user?.optString("program").orEmpty()
            if (guestType.isNotBlank()) lines += "TYPE OF GUEST: $guestType"
        } else {
            val college = user?.optString("college").orEmpty()
            val program = user?.optString("program").orEmpty()
            if (college.isNotBlank()) lines += "COLLEGE: $college"
            if (program.isNotBlank()) lines += "PROGRAM: $program"
        }

        if (payload.optBoolean("hasAppointmentToday") && appointment != null) {
            lines += " "
            lines += "TODAY'S APPOINTMENT"
            lines += "TICKET: ${appointment.optString("code")}"
            lines += "TIME: ${appointment.optString("time")}"
            lines += "SERVICE: ${appointment.optString("service")} - ${appointment.optString("subcategory")}"
            lines += "STATUS: ${appointment.optString("status")}"
        }

        lines += " "
        lines += "PLEASE WAIT FOR YOUR QUEUE"
        lines += "NUMBER TO BE CALLED."
        return lines
    }
}
```

## Step 6: Use The Vendor Sample As The Source Of Truth

Do not guess the printer initialization.

Use the sample app to determine:

- which printer connection mode works on the kiosk
- which initialization method is required
- whether it needs `COMM`, `USB`, or another internal mode

Then copy only that known-working printer setup into `PrinterManager`.

## Step 7: Keep Scanner Behavior The Same

If the built-in scanner already behaves like keyboard input, your current kiosk page can keep working without backend changes.

The wrapper app only needs to improve printing.

## Step 8: Test In This Order

1. Native Android app prints a hardcoded test line
2. Native Android app prints a hardcoded sample receipt
3. WebView loads the kiosk URL
4. JavaScript bridge prints a hardcoded JSON receipt
5. Actual kiosk check-in prints the live receipt

## Why This Maintains The Existing System

- backend API stays the same
- appointment and kiosk logic stay the same
- existing browser print still exists as fallback
- only kiosk hardware printing becomes native

## Files Already Prepared In The Web App

- `src/utils/kioskPrintReceipt.js`

This file is now bridge-ready and will try native printing before browser printing.

## Next Practical Task

Build the Android wrapper app first, then connect the vendor SDK printer calls inside `PrinterManager`.

If you want, the next step is to scaffold a starter Android project folder in this repo with:

- `MainActivity`
- `KioskPrinterBridge`
- `PrinterManager`
- `ReceiptFormatter`

so you can open it directly in Android Studio.
