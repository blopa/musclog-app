package expo.modules.witmotionble

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.os.Handler
import android.os.Looper
import com.wit.witsdk.observer.interfaces.Observer
import com.wit.witsdk.sensor.modular.connector.modular.bluetooth.BluetoothBLE
import com.wit.witsdk.sensor.modular.connector.modular.bluetooth.CustomBluetoothBLE
import com.wit.witsdk.sensor.modular.connector.modular.bluetooth.BluetoothSPP
import com.wit.witsdk.sensor.modular.connector.modular.bluetooth.WitBluetoothManager
import com.wit.witsdk.sensor.modular.connector.modular.bluetooth.interfaces.IBluetoothFoundObserver
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.util.ArrayDeque

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
  private var witBluetoothManager: WitBluetoothManager? = null
  private var foundObserverRegistered = false
  private var connectedBle: CustomBluetoothBLE? = null
  private val incomingBuffer = ByteArrayOutputStream()
  private var pendingRateCommands: ArrayDeque<ByteArray>? = null
  private var pendingRateResolve: (() -> Unit)? = null
  private var pendingRateReject: ((String) -> Unit)? = null
  private var defaultRateHz: Int = 50
  private var connectionEstablished = false
  private var sawFirstPacket = false

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

    AsyncFunction("getBondedDevices") {
      ensureBluetoothReady("getBondedDevices")
      adapter().bondedDevices.map { device ->
        mapOf(
          "id" to device.address,
          "name" to device.name,
          "localName" to device.name,
          "rssi" to null
        )
      }
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

  private fun requireActivity() =
    requireNotNull(appContext.currentActivity) {
      "Bluetooth requires a foreground Activity"
    }

  private fun ensureWitManager(): WitBluetoothManager {
    val activity = requireActivity()
    if (!WitBluetoothManager.checkPermissions(activity)) {
      WitBluetoothManager.requestPermissions(activity)
      throw IllegalStateException("Bluetooth permissions were requested; please try again")
    }

    val current = witBluetoothManager
    if (current != null) {
      return current
    }

    WitBluetoothManager.initInstance(activity)
    return WitBluetoothManager.getInstance().also {
      witBluetoothManager = it
    }
  }

  private fun startScanInternal() {
    stopScanInternal()
    val manager = ensureWitManager()
    WitBluetoothManager.DeviceNameFilter = listOf("WT")
    if (!foundObserverRegistered) {
      manager.registerObserver(foundObserver)
      foundObserverRegistered = true
    }

    mainHandler.post {
      sendLog("Starting WitMotion discovery for WT devices", "info")
      manager.startDiscovery()
    }
  }

  private fun stopScanInternal() {
    val manager = witBluetoothManager ?: return
    mainHandler.post {
      try {
        manager.stopDiscovery()
        sendLog("Stopped BLE scan", "info")
      } catch (_: Throwable) {
      }
    }
  }

  private fun connectInternal(deviceId: String): Map<String, Any?> {
    try {
      disconnectInternal(emitState = false)

      val device = adapter().getRemoteDevice(deviceId)
      sendConnectionState("connecting", deviceId, device.name, "Connecting")
      connectionEstablished = false
      sawFirstPacket = false

      ensureWitManager()
      val ble =
        CustomBluetoothBLE(context, deviceId, device.name ?: device.address)
      ble.registerObserver(deviceObserver)
      ble.connect(deviceId)
      connectedBle = ble

      return mapOf(
        "id" to device.address,
        "name" to device.name,
        "localName" to device.name,
        "rssi" to null
      )
    } catch (error: Throwable) {
      disconnectInternal(emitState = false)
      sendError("Connection failed: ${error::class.java.simpleName}: ${error.message}")
      throw error
    }
  }

  private fun disconnectInternal(emitState: Boolean = true) {
    pendingRateCommands = null
    pendingRateResolve = null
    pendingRateReject = null

    val currentBle = connectedBle
    connectedBle = null
    incomingBuffer.reset()

    if (currentBle != null) {
      try {
        currentBle.removeObserver(deviceObserver)
        currentBle.disconnect()
      } catch (_: Throwable) {
      }
    }

    if (emitState) {
      sendConnectionState("disconnected", null, null, "Disconnected")
    }
  }

  private fun startPendingRateWrite(
    rateHz: Int,
    resolve: (() -> Unit)?,
    reject: ((String) -> Unit)?
  ) {
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
    if (connectedBle == null) {
      reject?.invoke("Not connected")
      return
    }
    sendLog("Setting output rate to ${rateHz}Hz", "info")
    startPendingRateWrite(rateHz, resolve, reject)
  }

  private fun writeNextPendingRateCommand() {
    val currentBle = connectedBle ?: return
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
    try {
      currentBle.write(next)
    } catch (error: Throwable) {
      pendingRateCommands = null
      pendingRateReject?.invoke("Failed to write rate command: ${error.message}")
      pendingRateResolve = null
      pendingRateReject = null
      return
    }

    mainHandler.postDelayed({
      writeNextPendingRateCommand()
    }, 80)
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
      if (!connectionEstablished) {
        connectionEstablished = true
        sendConnectionState("connected", connectedBle?.mac, connectedBle?.name, "Connected")
        sendLog("First packet received", "success")
      }
      sawFirstPacket = true
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

  private val foundObserver = object : IBluetoothFoundObserver {
    override fun onFoundBle(device: BluetoothBLE) {
      sendEvent(
        "onDeviceFound",
        mapOf(
          "id" to device.mac,
          "name" to device.name,
          "localName" to device.name,
          "rssi" to device.rssi
        )
      )
    }

    override fun onFoundSPP(device: BluetoothSPP) {
      sendEvent(
        "onDeviceFound",
        mapOf(
          "id" to device.mac,
          "name" to device.name,
          "localName" to device.name,
          "rssi" to device.rssi
        )
      )
    }

    override fun onFoundDual(device: BluetoothBLE) {
      onFoundBle(device)
    }
  }

  private val deviceObserver = Observer { bytes ->
    appendIncoming(bytes)
  }
}
