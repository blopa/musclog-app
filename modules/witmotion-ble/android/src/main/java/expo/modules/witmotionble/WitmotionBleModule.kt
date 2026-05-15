package expo.modules.witmotionble

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.util.ArrayDeque
import java.util.UUID

private const val SERVICE_UUID = "0000ffe5-0000-1000-8000-00805f9b34fb"
private const val NOTIFY_UUID = "0000ffe4-0000-1000-8000-00805f9b34fb"
private const val WRITE_UUID = "0000ffe9-0000-1000-8000-00805f9b34fb"
private const val CCCD_UUID = "00002902-0000-1000-8000-00805f9b34fb"

private val SERVICE_UUID_OBJECT = UUID.fromString(SERVICE_UUID)
private val NOTIFY_UUID_OBJECT = UUID.fromString(NOTIFY_UUID)
private val WRITE_UUID_OBJECT = UUID.fromString(WRITE_UUID)
private val CCCD_UUID_OBJECT = UUID.fromString(CCCD_UUID)

private data class ParsedPacket(
  val type: String,
  val x: Double,
  val y: Double,
  val z: Double,
  val timestamp: Long
)

class WitmotionBleModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var bluetoothAdapter: BluetoothAdapter? = null
  private var scannerCallback: ScanCallback? = null
  private var gatt: BluetoothGatt? = null
  private var notifyCharacteristic: BluetoothGattCharacteristic? = null
  private var writeCharacteristic: BluetoothGattCharacteristic? = null
  private val incomingBuffer = ByteArrayOutputStream()
  private var pendingRateCommands: ArrayDeque<ByteArray>? = null
  private var pendingRateResolve: (() -> Unit)? = null
  private var pendingRateReject: ((String) -> Unit)? = null
  private var defaultRateHz: Int = 50
  private var initialRateScheduled = false

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is null" }

  override fun definition() = ModuleDefinition {
    Name("WitmotionBle")

    Events(
      "onDeviceFound",
      "onConnectionState",
      "onPacket",
      "onError",
      "onLog"
    )

    OnDestroy {
      stopScanInternal()
      disconnectInternal()
    }

    AsyncFunction("startScan") {
      ensureBluetoothReady("startScan")
      startScanInternal()
    }

    AsyncFunction("stopScan") {
      stopScanInternal()
    }

    AsyncFunction("connect") { deviceId: String, outputRateHz: Int? ->
      ensureBluetoothReady("connect")
      defaultRateHz = outputRateHz ?: 50
      connectInternal(deviceId)
    }

    AsyncFunction("disconnect") {
      disconnectInternal()
    }

    AsyncFunction("setOutputRate") { hz: Int ->
      ensureBluetoothReady("setOutputRate")
      setOutputRateInternal(hz, null, null)
    }
  }

  private fun bluetoothManager(): BluetoothManager {
    val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    return manager ?: error("BluetoothManager not available")
  }

  private fun adapter(): BluetoothAdapter {
    val adapter = bluetoothManager().adapter
    return adapter ?: error("Bluetooth adapter not available")
  }

  private fun ensureBluetoothReady(action: String) {
    bluetoothAdapter = adapter()
    if (bluetoothAdapter?.isEnabled != true) {
      throw IllegalStateException("Bluetooth is disabled; cannot $action")
    }
  }

  private fun startScanInternal() {
    stopScanInternal()
    val scanner = adapter().bluetoothLeScanner ?: error("BLE scanner not available")
    val settings = ScanSettings.Builder()
      .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
      .build()

    val seen = mutableSetOf<String>()
    scannerCallback = object : ScanCallback() {
      override fun onScanResult(callbackType: Int, result: ScanResult) {
        val device = result.device ?: return
        if (!seen.add(device.address)) {
          return
        }

        sendEvent("onDeviceFound", mapOf(
          "id" to device.address,
          "name" to device.name,
          "localName" to result.scanRecord?.deviceName,
          "rssi" to result.rssi
        ))
      }

      override fun onScanFailed(errorCode: Int) {
        sendError("Scan failed with code $errorCode")
      }
    }

    mainHandler.post {
      sendLog("Starting BLE scan", "info")
      scanner.startScan(null, settings, scannerCallback)
    }
  }

  private fun stopScanInternal() {
    val scanner = bluetoothAdapter?.bluetoothLeScanner ?: return
    scannerCallback?.let { callback ->
      mainHandler.post {
        try {
          scanner.stopScan(callback)
          sendLog("Stopped BLE scan", "info")
        } catch (_: Throwable) {
        }
      }
    }
    scannerCallback = null
  }

  private fun connectInternal(deviceId: String): Map<String, Any?> {
    disconnectInternal()

    val device = adapter().getRemoteDevice(deviceId)
    sendConnectionState("connecting", deviceId, device.name, "Connecting")

    gatt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
    } else {
      @Suppress("DEPRECATION")
      device.connectGatt(context, false, gattCallback)
    }

    return mapOf(
      "id" to device.address,
      "name" to device.name,
      "localName" to device.name,
      "rssi" to null
    )
  }

  private fun disconnectInternal() {
    pendingRateCommands = null
    pendingRateResolve = null
    pendingRateReject = null
    initialRateScheduled = false

    val currentGatt = gatt
    gatt = null
    notifyCharacteristic = null
    writeCharacteristic = null
    incomingBuffer.reset()

    if (currentGatt != null) {
      try {
        sendConnectionState("disconnecting", null, null, "Disconnecting")
        currentGatt.disconnect()
      } catch (_: Throwable) {
      }
      try {
        currentGatt.close()
      } catch (_: Throwable) {
      }
    }

    sendConnectionState("disconnected", null, null, "Disconnected")
  }

  private fun onConnected(gatt: BluetoothGatt) {
    try {
      gatt.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_HIGH)
      sendLog("Requested high connection priority", "data")
    } catch (error: Throwable) {
      sendLog("Connection priority request failed: ${error.message}", "error")
    }

    try {
      gatt.requestMtu(517)
      sendLog("Requested MTU 517", "data")
    } catch (error: Throwable) {
      sendLog("MTU request failed: ${error.message}", "error")
    }

    gatt.discoverServices()
  }

  private fun onServicesReady(gatt: BluetoothGatt) {
    val service = gatt.getService(SERVICE_UUID_OBJECT)
    if (service == null) {
      sendError("WitMotion service $SERVICE_UUID not found")
      return
    }

    notifyCharacteristic = service.getCharacteristic(NOTIFY_UUID_OBJECT)
    writeCharacteristic = service.getCharacteristic(WRITE_UUID_OBJECT)

    if (notifyCharacteristic == null) {
      sendError("Notify characteristic $NOTIFY_UUID not found")
      return
    }

    val ok = gatt.setCharacteristicNotification(notifyCharacteristic, true)
    if (!ok) {
      sendError("Failed to enable characteristic notifications")
      return
    }

    val descriptor = notifyCharacteristic?.getDescriptor(CCCD_UUID_OBJECT)
    if (descriptor == null) {
      sendError("Notification descriptor not found")
      return
    }

    @Suppress("DEPRECATION")
    descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE

    val written = gatt.writeDescriptor(descriptor)
    if (!written) {
      sendError("Failed to write notification descriptor")
      return
    }

    sendConnectionState("connected", gatt.device?.address, gatt.device?.name, "Connected")
  }

  private fun startPendingRateWrite(rateHz: Int, resolve: (() -> Unit)?, reject: ((String) -> Unit)?) {
    val commands = when (rateHz) {
      20 -> listOf(
        byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x69, 0x88.toByte(), 0xb5.toByte()),
        byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x03, 0x07, 0x00),
        byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x00, 0x00, 0x00)
      )
      50 -> listOf(
        byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x69, 0x88.toByte(), 0xb5.toByte()),
        byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x03, 0x08, 0x00),
        byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x00, 0x00, 0x00)
      )
      100 -> listOf(
        byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x69, 0x88.toByte(), 0xb5.toByte()),
        byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x03, 0x09, 0x00),
        byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x00, 0x00, 0x00)
      )
      else -> throw IllegalArgumentException("Unsupported output rate: $rateHz")
    }

    pendingRateCommands = ArrayDeque(commands)
    pendingRateResolve = resolve
    pendingRateReject = reject
    writeNextPendingRateCommand()
  }

  private fun setOutputRateInternal(rateHz: Int, resolve: (() -> Unit)?, reject: ((String) -> Unit)?) {
    val currentGatt = gatt ?: run {
      reject?.invoke("Not connected")
      return
    }
    if (writeCharacteristic == null) {
      reject?.invoke("Write characteristic unavailable")
      return
    }
    sendLog("Setting output rate to ${rateHz}Hz", "info")
    startPendingRateWrite(rateHz, resolve, reject)
  }

  private fun writeNextPendingRateCommand() {
    val currentGatt = gatt ?: return
    val characteristic = writeCharacteristic ?: return
    val queue = pendingRateCommands ?: return
    if (queue.isEmpty()) {
      pendingRateCommands = null
      pendingRateResolve?.invoke()
      pendingRateResolve = null
      pendingRateReject = null
      sendLog("Output rate configured", "success")
      return
    }
    val next = queue.removeFirst()

    @Suppress("DEPRECATION")
    characteristic.value = next
    characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
    val ok = currentGatt.writeCharacteristic(characteristic)
    if (!ok) {
      pendingRateCommands = null
      pendingRateReject?.invoke("Failed to write rate command")
      pendingRateResolve = null
      pendingRateReject = null
    }
  }

  private fun appendIncoming(bytes: ByteArray) {
    synchronized(incomingBuffer) {
      incomingBuffer.write(bytes)
      parseIncomingBuffer()
    }
  }

  private fun parseIncomingBuffer() {
    while (true) {
      val data = incomingBuffer.toByteArray()
      if (data.isEmpty()) {
        return
      }

      var start = -1
      for (i in data.indices) {
        if (data[i] == 0x55.toByte()) {
          start = i
          break
        }
      }
      if (start < 0) {
        incomingBuffer.reset()
        return
      }
      if (start > 0) {
        incomingBuffer.reset()
        incomingBuffer.write(data, start, data.size - start)
        continue
      }
      if (data.size < 2) {
        return
      }

      val type = data[1].toInt() and 0xff
      val packetLength = when (type) {
        0x61 -> 20
        0x51, 0x52, 0x53, 0x54 -> 11
        else -> 1
      }

      if (data.size < packetLength) {
        return
      }

      when (type) {
        0x61 -> {
          emitParsedPackets(
            parseAcceleration(data, 2),
            parseGyro(data, 2),
            parseAngle(data, 2)
          )
          removeBytes(packetLength)
        }
        0x51 -> {
          emitParsedPackets(parseAcceleration(data, 2))
          removeBytes(packetLength)
        }
        0x52 -> {
          emitParsedPackets(parseGyro(data, 2))
          removeBytes(packetLength)
        }
        0x53 -> {
          emitParsedPackets(parseAngle(data, 2))
          removeBytes(packetLength)
        }
        0x54 -> {
          emitParsedPackets(parseMag(data, 2))
          removeBytes(packetLength)
        }
        else -> {
          removeBytes(1)
        }
      }
    }
  }

  private fun removeBytes(count: Int) {
    val data = incomingBuffer.toByteArray()
    incomingBuffer.reset()
    if (count < data.size) {
      incomingBuffer.write(data, count, data.size - count)
    }
  }

  private fun parseAcceleration(data: ByteArray, offset: Int): ParsedPacket {
    val now = System.currentTimeMillis()
    return ParsedPacket(
      type = "accel",
      x = (readInt16(data, offset) / 32768.0) * 16.0,
      y = (readInt16(data, offset + 2) / 32768.0) * 16.0,
      z = (readInt16(data, offset + 4) / 32768.0) * 16.0,
      timestamp = now
    )
  }

  private fun parseGyro(data: ByteArray, offset: Int): ParsedPacket {
    val now = System.currentTimeMillis()
    return ParsedPacket(
      type = "gyro",
      x = (readInt16(data, offset + 6) / 32768.0) * 2000.0,
      y = (readInt16(data, offset + 8) / 32768.0) * 2000.0,
      z = (readInt16(data, offset + 10) / 32768.0) * 2000.0,
      timestamp = now
    )
  }

  private fun parseAngle(data: ByteArray, offset: Int): ParsedPacket {
    val now = System.currentTimeMillis()
    return ParsedPacket(
      type = "angle",
      x = (readInt16(data, offset + 12) / 32768.0) * 180.0,
      y = (readInt16(data, offset + 14) / 32768.0) * 180.0,
      z = (readInt16(data, offset + 16) / 32768.0) * 180.0,
      timestamp = now
    )
  }

  private fun parseMag(data: ByteArray, offset: Int): ParsedPacket {
    val now = System.currentTimeMillis()
    return ParsedPacket(
      type = "mag",
      x = readInt16(data, offset).toDouble(),
      y = readInt16(data, offset + 2).toDouble(),
      z = readInt16(data, offset + 4).toDouble(),
      timestamp = now
    )
  }

  private fun emitParsedPackets(vararg packets: ParsedPacket) {
    packets.forEach { packet ->
      if (packet.type == "accel") {
        // no-op, stream consumers handle derived metrics in JS
      }
      sendEvent(
        "onPacket",
        mapOf(
          "packet" to mapOf(
            "type" to packet.type,
            "x" to packet.x,
            "y" to packet.y,
            "z" to packet.z,
            "timestamp" to packet.timestamp
          )
        )
      )
    }
  }

  private fun readInt16(data: ByteArray, offset: Int): Int {
    val lo = data.getOrNull(offset)?.toInt()?.and(0xff) ?: 0
    val hi = data.getOrNull(offset + 1)?.toInt()?.and(0xff) ?: 0
    val value = (hi shl 8) or lo
    return if (value and 0x8000 != 0) value or -0x10000 else value
  }

  private fun sendConnectionState(state: String, deviceId: String?, deviceName: String?, message: String?) {
    sendEvent(
      "onConnectionState",
      mapOf(
        "state" to state,
        "deviceId" to deviceId,
        "deviceName" to deviceName,
        "message" to message
      )
    )
  }

  private fun sendError(message: String) {
    sendEvent("onError", mapOf("message" to message))
    sendLog(message, "error")
  }

  private fun sendLog(message: String, level: String) {
    sendEvent("onLog", mapOf("message" to message, "level" to level))
  }

  private val gattCallback = object : BluetoothGattCallback() {
    override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
      if (status != BluetoothGatt.GATT_SUCCESS) {
        sendError("GATT connection error: $status")
        disconnectInternal()
        return
      }

      when (newState) {
        BluetoothProfile.STATE_CONNECTED -> onConnected(gatt)
        BluetoothProfile.STATE_DISCONNECTED -> disconnectInternal()
      }
    }

    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
      if (status != BluetoothGatt.GATT_SUCCESS) {
        sendError("Service discovery failed: $status")
        return
      }
      onServicesReady(gatt)
    }

    override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
      val value = characteristic.value ?: return
      appendIncoming(value)
    }

    override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
      if (status != BluetoothGatt.GATT_SUCCESS) {
        sendError("Descriptor write failed: $status")
        return
      }

      if (!initialRateScheduled) {
        initialRateScheduled = true
        mainHandler.postDelayed({
          setOutputRateInternal(defaultRateHz, null, { error -> sendError(error) })
        }, 50)
      }
    }

    override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
      if (status != BluetoothGatt.GATT_SUCCESS) {
        pendingRateCommands = null
        pendingRateReject?.invoke("Rate command write failed: $status")
        pendingRateResolve = null
        pendingRateReject = null
        return
      }
      writeNextPendingRateCommand()
    }

    override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
      if (status == BluetoothGatt.GATT_SUCCESS) {
        sendLog("Negotiated MTU $mtu", "data")
      }
    }
  }
}
