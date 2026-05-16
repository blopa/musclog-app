package com.musclog.witmotionble

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

private const val SERVICE_UUID = "0000ffe5-0000-1000-8000-00805f9a34fb"
private const val READ_UUID = "0000ffe4-0000-1000-8000-00805f9a34fb"
private const val WRITE_UUID = "0000ffe9-0000-1000-8000-00805f9a34fb"
private const val NOTIFY_DESCRIPTOR_UUID = "00002902-0000-1000-8000-00805f9b34fb"
private const val DEVICE_PREFIX = "WT"
private const val DEFAULT_SCAN_TIMEOUT_MS = 10_000L
private const val DEFAULT_POLL_INTERVAL_MS = 500L

private data class WitDeviceInfo(
  val id: String,
  val name: String,
  val localName: String? = null,
  val rssi: Int? = null
)

private data class Vector3(
  val x: Double,
  val y: Double,
  val z: Double
)

private data class LiveData(
  val accel: Vector3? = null,
  val gyro: Vector3? = null,
  val angle: Vector3? = null,
  val magnetic: Vector3? = null,
  val batteryVoltage: Double? = null,
  val batteryPercent: Double? = null,
  val updatedAt: Long? = null
)

private data class WitState(
  val status: String = "idle",
  val bleState: String = "unknown",
  val isScanning: Boolean = false,
  val isConnected: Boolean = false,
  val connectedDevice: WitDeviceInfo? = null,
  val discoveredDevices: List<WitDeviceInfo> = emptyList(),
  val liveData: LiveData = LiveData(),
  val packetCount: Int = 0,
  val error: String? = null
)

private data class ParsedPacket(
  val liveData: LiveData,
  val packetCount: Int = 1
)

private fun WitDeviceInfo.toMap(): Map<String, Any?> = mapOf(
  "id" to id,
  "name" to name,
  "localName" to localName,
  "rssi" to rssi
)

private fun Vector3.toMap(): Map<String, Any?> = mapOf("x" to x, "y" to y, "z" to z)

private fun LiveData.toMap(): Map<String, Any?> = mapOf(
  "accel" to accel?.toMap(),
  "gyro" to gyro?.toMap(),
  "angle" to angle?.toMap(),
  "magnetic" to magnetic?.toMap(),
  "batteryVoltage" to batteryVoltage,
  "batteryPercent" to batteryPercent,
  "updatedAt" to updatedAt
)

private fun WitState.toMap(): Map<String, Any?> = mapOf(
  "status" to status,
  "bleState" to bleState,
  "isScanning" to isScanning,
  "isConnected" to isConnected,
  "connectedDevice" to connectedDevice?.toMap(),
  "discoveredDevices" to discoveredDevices.map { it.toMap() },
  "liveData" to liveData.toMap(),
  "packetCount" to packetCount,
  "error" to error
)

private fun ByteArray.readShortLE(offset: Int): Short {
  val low = this[offset].toInt() and 0xff
  val high = this[offset + 1].toInt() and 0xff
  return ((high shl 8) or low).toShort()
}

private fun Short.toSignedDouble(scale: Double): Double = toInt() / 32768.0 * scale

private fun batteryPercentFromVoltage(v: Double): Double {
  return when {
    v > 3.96 -> 100.0
    v > 3.93 -> 90.0
    v > 3.87 -> 75.0
    v > 3.82 -> 60.0
    v > 3.79 -> 50.0
    v > 3.77 -> 40.0
    v > 3.73 -> 30.0
    v > 3.70 -> 20.0
    v > 3.68 -> 15.0
    v > 3.50 -> 10.0
    v > 3.40 -> 5.0
    else -> 0.0
  }
}

private fun formatDisplayData(data: LiveData): String {
  fun fmt(value: Double?, digits: Int): String {
    if (value == null) {
      return "0"
    }
    return "%.${digits}f".format(value)
  }

  return buildString {
    append("AccX: ").append(fmt(data.accel?.x, 3)).append('\n')
    append("AccY: ").append(fmt(data.accel?.y, 3)).append('\n')
    append("AccZ: ").append(fmt(data.accel?.z, 3)).append('\n')
    append("AsX: ").append(fmt(data.gyro?.x, 3)).append('\n')
    append("AsY: ").append(fmt(data.gyro?.y, 3)).append('\n')
    append("AsZ: ").append(fmt(data.gyro?.z, 3)).append('\n')
    append("AngleX: ").append(fmt(data.angle?.x, 2)).append('\n')
    append("AngleY: ").append(fmt(data.angle?.y, 2)).append('\n')
    append("AngleZ: ").append(fmt(data.angle?.z, 2)).append('\n')
    append("HX: ").append(data.magnetic?.x ?: 0.0).append('\n')
    append("HY: ").append(data.magnetic?.y ?: 0.0).append('\n')
    append("HZ: ").append(data.magnetic?.z ?: 0.0).append('\n')
    append("Electricity: ").append(data.batteryPercent ?: 0.0)
  }
}

private fun parsePacket(bytes: ByteArray): ParsedPacket? {
  if (bytes.size < 20 || bytes[0] != 0x55.toByte()) {
    return null
  }

  return when (bytes[1]) {
    0x61.toByte() -> {
      val accel = Vector3(
        bytes.readShortLE(2).toSignedDouble(16.0),
        bytes.readShortLE(4).toSignedDouble(16.0),
        bytes.readShortLE(6).toSignedDouble(16.0)
      )
      val gyro = Vector3(
        bytes.readShortLE(8).toSignedDouble(2000.0),
        bytes.readShortLE(10).toSignedDouble(2000.0),
        bytes.readShortLE(12).toSignedDouble(2000.0)
      )
      val angle = Vector3(
        bytes.readShortLE(14).toSignedDouble(180.0),
        bytes.readShortLE(16).toSignedDouble(180.0),
        bytes.readShortLE(18).toSignedDouble(180.0)
      )
      ParsedPacket(LiveData(accel = accel, gyro = gyro, angle = angle, updatedAt = System.currentTimeMillis()))
    }

    0x71.toByte() -> {
      when (bytes[2].toInt() and 0xff) {
        58 -> {
          val magnetic = Vector3(
            bytes.readShortLE(4).toInt() / 120.0,
            bytes.readShortLE(6).toInt() / 120.0,
            bytes.readShortLE(8).toInt() / 120.0
          )
          ParsedPacket(LiveData(magnetic = magnetic, updatedAt = System.currentTimeMillis()))
        }

        100 -> {
          val voltage = bytes.readShortLE(4).toInt() / 100.0
          ParsedPacket(
            LiveData(
              batteryVoltage = voltage,
              batteryPercent = batteryPercentFromVoltage(voltage),
              updatedAt = System.currentTimeMillis()
            )
          )
        }

        else -> null
      }
    }

    else -> null
  }
}

class WitMotionBleModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val deviceMap = ConcurrentHashMap<String, BluetoothDevice>()
  private val stateLock = Any()
  @Volatile private var state = WitState()

  private var bluetoothAdapter: BluetoothAdapter? = null
  private var bluetoothLeScanner: BluetoothLeScanner? = null
  private var scanCallback: ScanCallback? = null
  private var scanStopRunnable: Runnable? = null
  private var activeSession: DeviceSession? = null

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context is not available")

  override fun definition() = ModuleDefinition {
    Name("WitMotionBle")

    Events("onStateChanged", "onDeviceFound", "onError")

    OnDestroy {
      stopScan()
      disconnectInternal()
      bluetoothLeScanner = null
      bluetoothAdapter = null
    }

    Function("requestPermissions") {
      checkPermissions()
    }

    AsyncFunction("startScan") { options: Map<String, Any?>? ->
      startScanInternal(options)
    }

    Function("stopScan") {
      stopScan()
    }

    AsyncFunction("connect") { deviceId: String ->
      connectInternal(deviceId)
    }

    AsyncFunction("disconnect") {
      disconnectInternal()
    }

    Function("reset") {
      sendCommand(byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x00, 0x01, 0x00), false)
    }

    Function("setOutputRate") { value: Int ->
      val code = when (value) {
        1 -> 3
        5 -> 5
        10 -> 6
        50 -> 8
        100 -> 9
        200 -> 11
        else -> return@Function
      }
      sendCommand(byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x03, code.toByte(), 0x00), true)
    }

    Function("setBandwidth") { value: Int ->
      val code = when (value) {
        5 -> 7
        10 -> 6
        20 -> 5
        42 -> 4
        98 -> 3
        188 -> 2
        else -> return@Function
      }
      sendCommand(byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x1f, code.toByte(), 0x00), true)
    }

    Function("setAngleZero") {
      sendCommand(byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x01, 0x08, 0x00), false)
    }

    Function("startMagCalibration") {
      sendCommand(byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x01, 0x07, 0x00), false)
    }

    Function("stopMagCalibration") {
      sendCommand(byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x01, 0x00, 0x00), true)
    }

    Function("requestMagneticField") {
      sendCommand(byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x27, 0x3a, 0x00), false)
    }

    Function("requestBattery") {
      sendCommand(byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x27, 0x64, 0x00), false)
    }

    AsyncFunction<Map<String, Any?>>("getState") {
      snapshot().toMap()
    }
  }

  private fun snapshot(): WitState = synchronized(stateLock) { state }

  private fun updateState(mutator: (WitState) -> WitState) {
    val next = synchronized(stateLock) {
      state = mutator(state)
      state
    }
    postState(next)
  }

  private fun postState(next: WitState) {
    mainHandler.post {
      sendEvent("onStateChanged", next.toMap())
    }
  }

  private fun postError(message: String) {
    updateState { it.copy(status = "error", error = message) }
    mainHandler.post { sendEvent("onError", mapOf("message" to message)) }
  }

  private fun ensureBluetoothAdapter(): BluetoothAdapter? {
    val adapter = BluetoothAdapter.getDefaultAdapter()
    bluetoothAdapter = adapter
    bluetoothLeScanner = adapter?.bluetoothLeScanner
    val bleState = when {
      adapter == null -> "unsupported"
      adapter.isEnabled -> "poweredOn"
      else -> "poweredOff"
    }
    updateState { it.copy(bleState = bleState) }
    return adapter
  }

  private fun checkPermissions(): Boolean {
    val ctx = appContext.reactContext ?: return false

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val scanGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_SCAN) ==
        android.content.pm.PackageManager.PERMISSION_GRANTED
      val connectGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT) ==
        android.content.pm.PackageManager.PERMISSION_GRANTED
      return scanGranted && connectGranted
    }

    return ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) ==
      android.content.pm.PackageManager.PERMISSION_GRANTED
  }

  @SuppressLint("MissingPermission")
  private fun startScanInternal(options: Map<String, Any?>?): Boolean {
    val adapter = ensureBluetoothAdapter() ?: run {
      postError("Bluetooth is not supported on this device")
      return false
    }

    if (!adapter.isEnabled) {
      postError("Bluetooth is turned off")
      return false
    }

    if (!checkPermissions()) {
      postError("Bluetooth permissions were denied")
      return false
    }

    val scanner = bluetoothLeScanner ?: adapter.bluetoothLeScanner ?: run {
      postError("Bluetooth LE scanner is not available")
      return false
    }

    val autoConnect = options?.get("autoConnect") as? Boolean ?: true
    val namePrefix = options?.get("namePrefix") as? String ?: DEVICE_PREFIX
    val timeoutMs = when (val value = options?.get("timeoutMs")) {
      is Number -> value.toLong()
      else -> DEFAULT_SCAN_TIMEOUT_MS
    }

    stopScan()
    disconnectInternal()
    deviceMap.clear()
    updateState {
      it.copy(
        status = "scanning",
        isScanning = true,
        error = null,
        connectedDevice = null,
        discoveredDevices = emptyList(),
        liveData = LiveData(),
        packetCount = 0
      )
    }

    scanCallback = object : ScanCallback() {
      override fun onScanResult(callbackType: Int, result: ScanResult) {
        val device = result.device ?: return
        val deviceName = device.name ?: device.address
        if (!deviceName.startsWith(namePrefix)) {
          return
        }

        deviceMap[device.address] = device
        val summary = device.toSummary(result.rssi)
        updateState { current ->
          val found = current.discoveredDevices.any { it.id == summary.id }
          if (found) {
            current
          } else {
            current.copy(discoveredDevices = current.discoveredDevices + summary)
          }
        }
        mainHandler.post { sendEvent("onDeviceFound", summary.toMap()) }

        if (autoConnect && snapshot().status == "scanning") {
          connectInternal(device.address)
        }
      }

      override fun onScanFailed(errorCode: Int) {
        updateState {
          it.copy(status = "error", isScanning = false, error = "Bluetooth scan failed with error code $errorCode")
        }
        mainHandler.post { sendEvent("onError", mapOf("message" to "Bluetooth scan failed with error code $errorCode")) }
      }
    }

    val settings = ScanSettings.Builder()
      .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
      .setReportDelay(0)
      .build()

    scanner.startScan(null, settings, scanCallback)
    scanStopRunnable = Runnable { stopScan() }
    mainHandler.postDelayed(scanStopRunnable!!, timeoutMs)
    return true
  }

  @SuppressLint("MissingPermission")
  private fun stopScan() {
    val scanner = bluetoothLeScanner ?: bluetoothAdapter?.bluetoothLeScanner
    val callback = scanCallback
    if (scanner != null && callback != null) {
      scanner.stopScan(callback)
    }
    scanCallback = null
    scanStopRunnable?.let { mainHandler.removeCallbacks(it) }
    scanStopRunnable = null
    updateState { current ->
      current.copy(
        status = if (current.isConnected) "connected" else "idle",
        isScanning = false
      )
    }
  }

  @SuppressLint("MissingPermission")
  private fun connectInternal(deviceId: String): WitDeviceInfo {
    val adapter = ensureBluetoothAdapter() ?: throw IllegalStateException("Bluetooth is not supported")
    if (!adapter.isEnabled) {
      throw IllegalStateException("Bluetooth is turned off")
    }
    if (!checkPermissions()) {
      throw IllegalStateException("Bluetooth permissions were denied")
    }

    val device = deviceMap[deviceId] ?: adapter.getRemoteDevice(deviceId)
    val current = snapshot()
    if (current.connectedDevice?.id == device.address && current.isConnected) {
      return device.toSummary()
    }

    stopScan()
    disconnectInternal()

    val summary = device.toSummary()
    val session = DeviceSession(device, summary)
    activeSession = session
    updateState { it.copy(status = "connecting", error = null, connectedDevice = summary) }
    session.connect()
    return summary
  }

  @SuppressLint("MissingPermission")
  private fun disconnectInternal(): Boolean {
    val session = activeSession ?: run {
      updateState {
        it.copy(
          status = "idle",
          isConnected = false,
          connectedDevice = null,
          liveData = LiveData(),
          packetCount = 0
        )
      }
      return true
    }

    session.close()
    activeSession = null
    updateState {
      it.copy(
        status = "idle",
        isConnected = false,
        connectedDevice = null,
        liveData = LiveData(),
        packetCount = 0,
        error = null
      )
    }
    return true
  }

  @SuppressLint("MissingPermission")
  private fun sendCommand(data: ByteArray, save: Boolean) {
    val session = activeSession ?: return
    session.sendData(data, save)
  }

  private fun BluetoothDevice.toSummary(rssi: Int? = null): WitDeviceInfo {
    val name = name ?: address
    return WitDeviceInfo(id = address, name = name, localName = name, rssi = rssi)
  }

  private inner class DeviceSession(
    private val device: BluetoothDevice,
    private val summary: WitDeviceInfo
  ) {
    @Volatile private var gatt: BluetoothGatt? = null
    @Volatile private var readCharacteristic: BluetoothGattCharacteristic? = null
    @Volatile private var writeCharacteristic: BluetoothGattCharacteristic? = null
    @Volatile private var running = true
    private var pollingThread: Thread? = null

    private val gattCallback = object : BluetoothGattCallback() {
      @SuppressLint("MissingPermission")
      override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
        super.onConnectionStateChange(gatt, status, newState)
        if (!running) {
          return
        }
        when (newState) {
          BluetoothProfile.STATE_CONNECTED -> {
            gatt.discoverServices()
            updateState {
              it.copy(
                status = "connected",
                isConnected = true,
                connectedDevice = summary,
                error = null
              )
            }
          }

          BluetoothProfile.STATE_DISCONNECTED -> {
            readCharacteristic = null
            writeCharacteristic = null
            this@DeviceSession.gatt = null
            gatt.close()
            if (activeSession === this@DeviceSession) {
              activeSession = null
            }
            running = false
            updateState {
              it.copy(
                status = "idle",
                isConnected = false,
                connectedDevice = null,
                liveData = LiveData(),
                packetCount = 0
              )
            }
          }
        }
      }

      override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
        if (status != BluetoothGatt.GATT_SUCCESS) {
          postError("onServicesDiscovered received: $status")
          return
        }

        val services: List<BluetoothGattService> = gatt.services
        val targetService = services.firstOrNull {
          it.uuid.toString().equals(SERVICE_UUID, ignoreCase = true)
        } ?: run {
          postError("WIT service was not found on the device")
          return
        }

        targetService.characteristics.forEach { characteristic ->
          when (characteristic.uuid.toString().lowercase()) {
            READ_UUID -> {
              readCharacteristic = characteristic
              gatt.setCharacteristicNotification(characteristic, true)
              val descriptor = characteristic.getDescriptor(UUID.fromString(NOTIFY_DESCRIPTOR_UUID))
              if (descriptor != null) {
                descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                gatt.writeDescriptor(descriptor)
              }
            }

            WRITE_UUID -> {
              writeCharacteristic = characteristic
              this@DeviceSession.gatt = gatt
            }
          }
        }

        startPolling()
      }

      override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
        if (!running) {
          return
        }
        if (!characteristic.uuid.toString().equals(READ_UUID, ignoreCase = true)) {
          return
        }

        handleIncomingBytes(characteristic.value)
      }
    }

    @SuppressLint("MissingPermission")
    fun connect() {
      gatt = device.connectGatt(context, false, gattCallback)
    }

    @SuppressLint("MissingPermission")
    fun close() {
      running = false
      pollingThread?.interrupt()
      pollingThread = null
      disableNotifications()
      try {
        gatt?.disconnect()
      } finally {
        gatt?.close()
        gatt = null
        readCharacteristic = null
        writeCharacteristic = null
      }
    }

    @SuppressLint("MissingPermission")
    private fun disableNotifications() {
      val gattRef = gatt ?: return
      val readRef = readCharacteristic ?: return

      try {
        gattRef.setCharacteristicNotification(readRef, false)
        val descriptor = readRef.getDescriptor(UUID.fromString(NOTIFY_DESCRIPTOR_UUID))
        if (descriptor != null) {
          descriptor.value = BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE
          gattRef.writeDescriptor(descriptor)
        }
      } catch (_: Throwable) {
        // Best-effort shutdown; the connection teardown below still stops the session.
      }
    }

    private fun startPolling() {
      if (pollingThread != null) {
        return
      }

      pollingThread = Thread {
        while (running) {
          try {
            val gattRef = gatt
            val writeRef = writeCharacteristic
            if (gattRef != null && writeRef != null) {
              sendData(byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x27, 0x3a, 0x00), false)
              Thread.sleep(DEFAULT_POLL_INTERVAL_MS)
              if (!running) break
              sendData(byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x27, 0x64, 0x00), false)
            }
            Thread.sleep(DEFAULT_POLL_INTERVAL_MS)
          } catch (_: InterruptedException) {
            break
          } catch (error: Throwable) {
            postError(error.message ?: "Sending data error")
            Thread.sleep(DEFAULT_POLL_INTERVAL_MS)
          }
        }
      }.apply { start() }
    }

    @SuppressLint("MissingPermission")
    fun sendData(data: ByteArray, save: Boolean) {
      if (!running) {
        return
      }

      Thread {
        try {
          if (!running) {
            return@Thread
          }
          val gattRef = gatt ?: return@Thread
          val writeRef = writeCharacteristic ?: return@Thread
          writeRef.value = data
          gattRef.writeCharacteristic(writeRef)
          if (save) {
            Thread.sleep(100)
            writeRef.value = byteArrayOf(0xff.toByte(), 0xaa.toByte(), 0x00, 0x00, 0x00)
            gattRef.writeCharacteristic(writeRef)
          }
        } catch (error: Throwable) {
          postError(error.message ?: "Sending data error")
        }
      }.start()
    }

    private fun handleIncomingBytes(value: ByteArray) {
      var offset = 0
      var packetCountDelta = 0
      var nextLiveData = snapshot().liveData

      while (offset + 20 <= value.size) {
        if (value[offset] != 0x55.toByte()) {
          offset += 1
          continue
        }

        val chunk = value.copyOfRange(offset, offset + 20)
        val parsed = parsePacket(chunk)
        if (parsed != null) {
          nextLiveData = mergeLiveData(nextLiveData, parsed.liveData)
          packetCountDelta += parsed.packetCount
        }
        offset += 20
      }

      if (packetCountDelta > 0) {
        updateState { current ->
          current.copy(
            liveData = nextLiveData,
            packetCount = current.packetCount + packetCountDelta,
            error = null
          )
        }
      }
    }

    private fun mergeLiveData(current: LiveData, update: LiveData): LiveData {
      return LiveData(
        accel = update.accel ?: current.accel,
        gyro = update.gyro ?: current.gyro,
        angle = update.angle ?: current.angle,
        magnetic = update.magnetic ?: current.magnetic,
        batteryVoltage = update.batteryVoltage ?: current.batteryVoltage,
        batteryPercent = update.batteryPercent ?: current.batteryPercent,
        updatedAt = update.updatedAt ?: current.updatedAt
      )
    }
  }
}
