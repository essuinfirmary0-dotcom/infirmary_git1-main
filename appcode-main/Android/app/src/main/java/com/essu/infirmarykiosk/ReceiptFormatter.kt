package com.essu.infirmarykiosk

import org.json.JSONObject

object ReceiptFormatter {
    fun format(payload: JSONObject): List<String> {
        val user = payload.optJSONObject("user")
        val appointment = payload.optJSONObject("appointment")
        val lines = mutableListOf<String>()

        lines += "ESSU INFIRMARY"
        lines += "KIOSK CHECK-IN RECEIPT"
        lines += ""
        lines += "QUEUE: ${payload.optString("queueNumber")}"
        payload.optString("checkInDateDisplay").takeIf { it.isNotBlank() }?.let(lines::add)
        lines += ""
        lines += "NAME: ${user?.optString("name").orEmpty().ifBlank { "Guest" }}"

        user?.optString("studentNumber").orEmpty()
            .takeIf { it.isNotBlank() }
            ?.let { lines += "STUDENT NO: $it" }

        user?.optString("employeeNumber").orEmpty()
            .takeIf { it.isNotBlank() }
            ?.let { lines += "EMPLOYEE NO: $it" }

        val isGuest = user?.optString("userType").orEmpty().equals("guest", ignoreCase = true)
        if (isGuest) {
            user?.optString("program").orEmpty()
                .takeIf { it.isNotBlank() }
                ?.let { lines += "TYPE OF GUEST: $it" }
        } else {
            user?.optString("college").orEmpty()
                .takeIf { it.isNotBlank() }
                ?.let { lines += "COLLEGE: $it" }
            user?.optString("program").orEmpty()
                .takeIf { it.isNotBlank() }
                ?.let { lines += "PROGRAM: $it" }
        }

        if (payload.optBoolean("hasAppointmentToday") && appointment != null) {
            lines += ""
            lines += "TODAY'S APPOINTMENT"
            lines += "TICKET: ${appointment.optString("code")}"
            lines += "TIME: ${appointment.optString("time")}"
            lines += buildString {
                append("SERVICE: ")
                append(appointment.optString("service"))
                appointment.optString("subcategory")
                    .takeIf { it.isNotBlank() }
                    ?.let { append(" - ").append(it) }
            }
            lines += "STATUS: ${appointment.optString("status")}"
        }

        lines += ""
        lines += "PLEASE WAIT FOR YOUR"
        lines += "QUEUE NUMBER TO BE CALLED."
        return lines
    }
}
