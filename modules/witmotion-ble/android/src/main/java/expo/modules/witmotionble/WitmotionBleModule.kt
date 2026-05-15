package expo.modules.witmotionble

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import com.wit.witsdk.observer.interfaces.Observer
import com.wit.witsdk.sensor.modular.connector.modular.bluetooth.BluetoothBLE
import com.wit.witsdk.sensor.modular.connector.modular.bluetooth.BluetoothSPP
import com.wit.witsdk.sensor.modular.connector.modular.bluetooth.WitBluetoothManager
import com.wit.witsdk.sensor.modular.connector.modular.bluetooth.interfaces.IBluetoothFoundObserver
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.util.ArrayDeque
import java.util.UUID

private data class ParsedPacket(
  val type: String,
  val x: Double,
  val y: Double,
  val z: Double,
  val timestamp: Long
)

private class DirectWitBleConnection(
  private val context: Context,
  val mac: String,
  val name: String,
  private val onByteArray: (ByteArray) -> Unit,
  private val onWriteComplete: (Boolean, String?) -> Unit,
  private val onDisconnected: () -> Unit,
  private val onLog: (String) -> Unit,
  private val onError: (String) -> Unit
) {
  private val observers = mutableSetOf<Observer>()
  private var bluetoothGatt: BluetoothGatt? = null
  private var writeCharacteristic: BluetoothGattCharacteristic? = null
  private var notifyCharacteristic: BluetoothGattCharacteristic? = null
  private var openedAt = 0L
  private var opened = false
  private var notificationSubscribed = false
  private var awaitingRateAck = false

  companion object {
    private val SERVICE_UUID = UUID.fromString("49535343-fe7d-4ae5-8fa9-9fafd205e455")
    private val WRITE_UUID = UUID.fromString("49535343-8841-43f4-a8d4-ecbe34729bb3")
    private val NOTIFY_UUID = UUID.fromString("49535343-1e4d-4bd9-ba61-23c647249616")
    private val CCCD_UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
  }

  private val callback = object : BluetoothGattCallback() {
    override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
      if (newState == BluetoothProfile.STATE_CONNECTED) {
        onLog("GATT connected, discovering services")
        try {
          gatt.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_HIGH)
        } catch (_: Throwable) {
        }
        try {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            gatt.requestMtu(517)
          }
        } catch (_: Throwable) {
        }
        gatt.discoverServices()
        return
      }

      if (newState == BluetoothProfile.STATE_DISCONNECTED) {
        opened = false
        notificationSubscribed = false
        writeCharacteristic = null
        notifyCharacteristic = null
        onLog("GATT disconnected")
        closeGatt()
        onDisconnected()
      }
    }

    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
      if (status != BluetoothGatt.GATT_SUCCESS) {
        onError("Service discovery failed: $status")
        return
      }

      var foundWrite = false
      var foundNotify = false
      onLog("Discovered ${gatt.services.size} GATT service(s)")
      for (service in gatt.services) {
        onLog("Service: ${service.uuid}")
        for (characteristic in service.characteristics) {
          onLog("Characteristic: ${characteristic.uuid} props=${characteristic.properties}")
          when {
            !foundWrite &&
              (
                characteristic.uuid == WRITE_UUID ||
                  characteristic.properties and BluetoothGattCharacteristic.PROPERTY_WRITE != 0 ||
                  characteristic.properties and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0
              ) -> {
              writeCharacteristic = characteristic
              foundWrite = true
              onLog("Selected write characteristic: ${characteristic.uuid}")
            }
            !foundNotify &&
              (
                characteristic.uuid == NOTIFY_UUID ||
                  characteristic.properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0 ||
                  characteristic.properties and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0
              ) -> {
              notifyCharacteristic = characteristic
              foundNotify = true
              onLog("Selected notify characteristic: ${characteristic.uuid}")
              enableNotification(gatt, characteristic)
            }
          }
        }
      }

      if (!foundWrite || !foundNotify) {
        onError("WitMotion characteristics not found in service discovery")
        return
      }

      onLog("WitMotion GATT session ready; waiting for notification subscription")
    }

    override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
      val bytes = characteristic.value ?: return
      notifyObservers(bytes)
      onByteArray(bytes)
    }

    override fun onCharacteristicWrite(
      gatt: BluetoothGatt,
      characteristic: BluetoothGattCharacteristic,
      status: Int
    ) {
      if (characteristic.uuid != writeCharacteristic?.uuid) {
        return
      }

      if (status != BluetoothGatt.GATT_SUCCESS) {
        onWriteComplete(false, "Rate command write failed: $status")
        return
      }

      onWriteComplete(true, null)
    }

    override fun onDescriptorWrite(
      gatt: BluetoothGatt,
      descriptor: BluetoothGattDescriptor,
      status: Int
    ) {
      if (descriptor.uuid != CCCD_UUID) {
        return
      }

      if (status != BluetoothGatt.GATT_SUCCESS) {
        onError("Notification descriptor write failed: $status")
        return
      }

      notificationSubscribed = true
      opened = true
      openedAt = System.currentTimeMillis()
      onLog("Notification subscription enabled")
    }

    private fun enableNotification(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
      gatt.setCharacteristicNotification(characteristic, true)
      for (descriptor in characteristic.descriptors) {
        if (descriptor.uuid == CCCD_UUID) {
          descriptor.value =
            if ((characteristic.properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0) {
              BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            } else {
              BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
            }
          gatt.writeDescriptor(descriptor)
        }
      }
    }
  }

  fun connect() {
    val device = BluetoothAdapter.getDefaultAdapter().getRemoteDevice(mac)
    onLog("Connecting to ${device.address}")
    bluetoothGatt =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
      } else {
        @Suppress("DEPRECATION")
        device.connectGatt(context, false, callback)
      }
  }

  fun disconnect() {
    opened = false
    notificationSubscribed = false
    awaitingRateAck = false
    writeCharacteristic = null
    notifyCharacteristic = null
    closeGatt()
  }

  fun registerObserver(observer: Observer) {
    observers.add(observer)
  }

  fun removeObserver(observer: Observer) {
    observers.remove(observer)
  }

  fun write(bytes: ByteArray) {
    val gatt = bluetoothGatt ?: return
    val characteristic = writeCharacteristic ?: return
    if (!opened) {
      return
    }
    if (System.currentTimeMillis() - openedAt < 1000) {
      return
    }
    characteristic.value = bytes
    @Suppress("DEPRECATION")
    gatt.writeCharacteristic(characteristic)
  }

  private fun closeGatt() {
    try {
      bluetoothGatt?.disconnect()
    } catch (_: Throwable) {
    }
    try {
      bluetoothGatt?.close()
    } catch (_: Throwable) {
    }
    bluetoothGatt = null
  }

  private fun notifyObservers(bytes: ByteArray) {
    observers.forEach { observer ->
      observer.update(bytes)
    }
  }
}

class WitmotionBleModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var bluetoothAdapter: BluetoothAdapter? = null
  private var witBluetoothManager: WitBluetoothManager? = null
  private var foundObserverRegistered = false
  private var connectedBle: DirectWitBleConnection? = null
  private val incomingBuffer = ByteArrayOutputStream()
  private var pendingRateCommands: ArrayDeque<ByteArray>? = null
  private var pendingRateResolve: (() -> Unit)? = null
  private var pendingRateReject: ((String) -> Unit)? = null
  private var awaitingRateAck = false
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
    disconnectInternal(emitState = false)

    val device = adapter().getRemoteDevice(deviceId)
    sendConnectionState("connecting", deviceId, device.name, "Connecting")
    connectionEstablished = false
    sawFirstPacket = false

    ensureWitManager()
    val ble =
      DirectWitBleConnection(
        context = context,
        mac = deviceId,
        name = device.name ?: device.address,
        onByteArray = { bytes -> appendIncoming(bytes) },
        onWriteComplete = { success, message -> handleRateWriteComplete(success, message) },
        onDisconnected = {
          connectionEstablished = false
          sawFirstPacket = false
          sendConnectionState("disconnected", null, null, "Disconnected")
        },
        onLog = { message -> sendLog(message, "info") },
        onError = { message -> sendError(message) }
      )
    ble.registerObserver(deviceObserver)
    ble.connect()
    connectedBle = ble

    return mapOf(
      "id" to device.address,
      "name" to device.name,
      "localName" to device.name,
      "rssi" to null
    )
  }

  private fun disconnectInternal(emitState: Boolean = true) {
    pendingRateCommands = null
    pendingRateResolve = null
    pendingRateReject = null
    connectionEstablished = false
    sawFirstPacket = false

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

    if (awaitingRateAck) {
      return
    }

    val next = queue.removeFirst()
    try {
      currentBle.write(next)
      awaitingRateAck = true
    } catch (error: Throwable) {
      awaitingRateAck = false
      pendingRateCommands = null
      pendingRateReject?.invoke("Failed to write rate command: ${error.message}")
      pendingRateResolve = null
      pendingRateReject = null
      return
    }
  }

  private fun handleRateWriteComplete(success: Boolean, message: String?) {
    if (!success) {
      awaitingRateAck = false
      pendingRateCommands = null
      pendingRateReject?.invoke(message ?: "Rate command write failed")
      pendingRateResolve = null
      pendingRateReject = null
      return
    }

    awaitingRateAck = false
    writeNextPendingRateCommand()
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
