import ExpoModulesCore
import CoreBluetooth

// MARK: - Constants

private let kServiceUUID  = "0000FFE5-0000-1000-8000-00805F9A34FB"
private let kReadUUID     = "0000FFE4-0000-1000-8000-00805F9A34FB"
private let kWriteUUID    = "0000FFE9-0000-1000-8000-00805F9A34FB"
private let kDevicePrefix  = "WT"
private let kScanTimeoutMs: Double  = 10_000
private let kPollIntervalSec: TimeInterval = 0.5
private let kBatchIntervalSec: TimeInterval = 0.25

// MARK: - Data models

private struct DeviceInfo {
  let id: String
  let name: String
  let localName: String?
  let rssi: Int?

  func toDict() -> [String: Any?] {
    ["id": id, "name": name, "localName": localName, "rssi": rssi]
  }
}

private struct Vec3 {
  let x: Double
  let y: Double
  let z: Double

  func toDict() -> [String: Any] {
    ["x": x, "y": y, "z": z]
  }
}

private struct LiveData {
  var accel: Vec3?
  var gyro: Vec3?
  var angle: Vec3?
  var magnetic: Vec3?
  var batteryVoltage: Double?
  var batteryPercent: Double?
  var updatedAt: Int64?

  func toDict() -> [String: Any?] {
    [
      "accel": accel?.toDict(),
      "gyro": gyro?.toDict(),
      "angle": angle?.toDict(),
      "magnetic": magnetic?.toDict(),
      "batteryVoltage": batteryVoltage,
      "batteryPercent": batteryPercent,
      "updatedAt": updatedAt,
    ]
  }
}

private struct BleState {
  var status: String = "idle"
  var bleState: String = "unknown"
  var isScanning: Bool = false
  var isConnected: Bool = false
  var connectedDevice: DeviceInfo?
  var discoveredDevices: [DeviceInfo] = []
  var liveData: LiveData = LiveData()
  var packetCount: Int = 0
  var error: String?

  func toDict() -> [String: Any?] {
    [
      "status": status,
      "bleState": bleState,
      "isScanning": isScanning,
      "isConnected": isConnected,
      "connectedDevice": connectedDevice?.toDict(),
      "discoveredDevices": discoveredDevices.map { $0.toDict() },
      "liveData": liveData.toDict(),
      "packetCount": packetCount,
      "error": error,
    ]
  }
}

private enum WitPacket {
  case motion(ts: Int64, accel: Vec3, gyro: Vec3, angle: Vec3)
  case magnetic(ts: Int64, magnetic: Vec3)
  case battery(ts: Int64, voltage: Double, percent: Double)

  func toDict() -> [String: Any?] {
    switch self {
    case let .motion(ts, a, g, ang):
      return ["kind": "motion", "timestamp": ts,
              "accel": a.toDict(), "gyro": g.toDict(), "angle": ang.toDict()]
    case let .magnetic(ts, m):
      return ["kind": "magnetic", "timestamp": ts, "magnetic": m.toDict()]
    case let .battery(ts, v, p):
      return ["kind": "battery", "timestamp": ts, "voltage": v, "percent": p]
    }
  }
}

// MARK: - Packet parsing

private func readInt16LE(_ bytes: [UInt8], at offset: Int) -> Int16 {
  let lo = UInt16(bytes[offset])
  let hi = UInt16(bytes[offset + 1])
  return Int16(bitPattern: (hi << 8) | lo)
}

private func scaled(_ v: Int16, by factor: Double) -> Double {
  Double(v) / 32768.0 * factor
}

private func batteryPct(fromVoltage v: Double) -> Double {
  if v > 3.96 { return 100 }
  if v > 3.93 { return 90 }
  if v > 3.87 { return 75 }
  if v > 3.82 { return 60 }
  if v > 3.79 { return 50 }
  if v > 3.77 { return 40 }
  if v > 3.73 { return 30 }
  if v > 3.70 { return 20 }
  if v > 3.68 { return 15 }
  if v > 3.50 { return 10 }
  if v > 3.40 { return 5 }
  return 0
}

private func parsePacket(_ bytes: [UInt8], ts: Int64) -> WitPacket? {
  guard bytes.count >= 20, bytes[0] == 0x55 else { return nil }
  switch bytes[1] {
  case 0x61:
    return .motion(
      ts: ts,
      accel: Vec3(x: scaled(readInt16LE(bytes, at: 2),  by: 16),
                  y: scaled(readInt16LE(bytes, at: 4),  by: 16),
                  z: scaled(readInt16LE(bytes, at: 6),  by: 16)),
      gyro:  Vec3(x: scaled(readInt16LE(bytes, at: 8),  by: 2000),
                  y: scaled(readInt16LE(bytes, at: 10), by: 2000),
                  z: scaled(readInt16LE(bytes, at: 12), by: 2000)),
      angle: Vec3(x: scaled(readInt16LE(bytes, at: 14), by: 180),
                  y: scaled(readInt16LE(bytes, at: 16), by: 180),
                  z: scaled(readInt16LE(bytes, at: 18), by: 180))
    )
  case 0x71:
    switch Int(bytes[2]) {
    case 58: // 0x3A — magnetic field
      return .magnetic(ts: ts, magnetic: Vec3(
        x: Double(readInt16LE(bytes, at: 4)) / 120.0,
        y: Double(readInt16LE(bytes, at: 6)) / 120.0,
        z: Double(readInt16LE(bytes, at: 8)) / 120.0
      ))
    case 100: // 0x64 — battery
      let voltage = Double(readInt16LE(bytes, at: 4)) / 100.0
      return .battery(ts: ts, voltage: voltage, percent: batteryPct(fromVoltage: voltage))
    default:
      return nil
    }
  default:
    return nil
  }
}

private func nowMs() -> Int64 {
  Int64(Date().timeIntervalSince1970 * 1000)
}

// MARK: - BLE manager

final class WitMotionBleManager: NSObject {

  // Callbacks into the Expo module
  var onStateChanged: (([String: Any?]) -> Void)?
  var onDataBatch:    (([String: Any?]) -> Void)?
  var onDeviceFound:  (([String: Any?]) -> Void)?
  var onError:        (([String: Any?]) -> Void)?

  // CoreBluetooth
  private var central: CBCentralManager?
  private var peripheral: CBPeripheral?
  private var writeChar: CBCharacteristic?
  private var readChar: CBCharacteristic?
  private var discoveredMap: [String: CBPeripheral] = [:]

  // Serial queue that drives all BLE work and timer callbacks
  private let q = DispatchQueue(label: "com.musclog.witmotionble", qos: .userInitiated)

  // State guarded by stateLock; written only on q or while holding lock
  private let stateLock = NSLock()
  private var state = BleState()

  // Batch buffering
  private let batchLock = NSLock()
  private var pendingPackets: [WitPacket] = []
  private var batchTimer: DispatchSourceTimer?

  // Timers
  private var scanTimer: DispatchSourceTimer?
  private var pollTimer: DispatchSourceTimer?
  private var pollTick = 0

  // Scan options held between startScan and the first didDiscover call
  private var autoConnect = true
  private var namePrefix  = kDevicePrefix

  // MARK: State helpers

  func getStateDict() -> [String: Any?] {
    stateLock.lock(); defer { stateLock.unlock() }
    return state.toDict()
  }

  private func snapshot() -> BleState {
    stateLock.lock(); defer { stateLock.unlock() }
    return state
  }

  private func mutate(emit: Bool = true, _ block: (inout BleState) -> Void) {
    stateLock.lock()
    block(&state)
    let next = state
    stateLock.unlock()
    if emit { onStateChanged?(next.toDict()) }
  }

  private func emitError(_ msg: String) {
    mutate { s in s.status = "error"; s.error = msg }
    onError?(["message": msg])
  }

  // MARK: Batch

  private func clearBatch() {
    batchLock.lock()
    batchTimer?.cancel()
    batchTimer = nil
    pendingPackets.removeAll()
    batchLock.unlock()
  }

  private func enqueue(_ packets: [WitPacket]) {
    guard !packets.isEmpty else { return }
    var needsSchedule = false
    batchLock.lock()
    pendingPackets.append(contentsOf: packets)
    if batchTimer == nil { needsSchedule = true }
    batchLock.unlock()
    if needsSchedule { scheduleBatchFlush() }
  }

  private func scheduleBatchFlush() {
    let t = DispatchSource.makeTimerSource(queue: q)
    t.schedule(deadline: .now() + kBatchIntervalSec)
    t.setEventHandler { [weak self] in self?.flushBatch() }
    batchLock.lock()
    batchTimer = t
    batchLock.unlock()
    t.resume()
  }

  private func flushBatch() {
    batchLock.lock()
    guard !pendingPackets.isEmpty else { batchTimer = nil; batchLock.unlock(); return }
    let batch = pendingPackets
    pendingPackets.removeAll()
    batchTimer = nil
    batchLock.unlock()

    let merged = mergeLiveData(batch)
    stateLock.lock()
    state.liveData = merged
    state.packetCount += batch.count
    state.error = nil
    let total = state.packetCount
    stateLock.unlock()

    onDataBatch?([
      "packets": batch.map { $0.toDict() },
      "packetCountDelta": batch.count,
      "packetCountTotal": total,
      "liveData": merged.toDict(),
      "receivedAt": nowMs(),
    ])

    batchLock.lock()
    let hasMore = !pendingPackets.isEmpty && batchTimer == nil
    batchLock.unlock()
    if hasMore { scheduleBatchFlush() }
  }

  private func mergeLiveData(_ packets: [WitPacket]) -> LiveData {
    var live = snapshot().liveData
    for p in packets {
      switch p {
      case let .motion(ts, a, g, ang):
        live.accel = a; live.gyro = g; live.angle = ang; live.updatedAt = ts
      case let .magnetic(ts, m):
        live.magnetic = m; live.updatedAt = ts
      case let .battery(ts, v, pct):
        live.batteryVoltage = v; live.batteryPercent = pct; live.updatedAt = ts
      }
    }
    return live
  }

  // MARK: Scan

  func startScan(options: [String: Any?]?) -> Bool {
    autoConnect = options?["autoConnect"] as? Bool ?? true
    namePrefix  = options?["namePrefix"]  as? String ?? kDevicePrefix
    let timeoutMs = options?["timeoutMs"] as? Double ?? kScanTimeoutMs

    stopScan()
    doDisconnect()
    discoveredMap.removeAll()
    mutate { s in
      s.status = "scanning"; s.isScanning = true; s.error = nil
      s.connectedDevice = nil; s.discoveredDevices = []
      s.liveData = LiveData(); s.packetCount = 0
    }

    if central == nil {
      // Initialising CBCentralManager triggers the system BLE permission prompt.
      // The delegate method centralManagerDidUpdateState fires when BLE is ready
      // and starts the actual scan if isScanning is still true at that point.
      central = CBCentralManager(delegate: self, queue: q)
    } else if central?.state == .poweredOn {
      central?.scanForPeripherals(withServices: nil,
                                  options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
    }

    let t = DispatchSource.makeTimerSource(queue: q)
    t.schedule(deadline: .now() + timeoutMs / 1000)
    t.setEventHandler { [weak self] in self?.stopScan() }
    scanTimer = t
    t.resume()
    return true
  }

  func stopScan() {
    scanTimer?.cancel(); scanTimer = nil
    central?.stopScan()
    mutate { s in
      s.status = s.isConnected ? "connected" : "idle"
      s.isScanning = false
    }
  }

  // MARK: Connect / Disconnect

  func connect(deviceId: String) throws -> [String: Any?] {
    // 1. Check in-memory cache (device discovered in this app session)
    if discoveredMap[deviceId] == nil {
      // 2. Ensure CBCentralManager is initialised so we can query CoreBluetooth's cache
      if central == nil {
        central = CBCentralManager(delegate: self, queue: q)
      }
      // 3. Ask CoreBluetooth for a peripheral it already knows (survives app restarts —
      //    iOS peripheral UUIDs are stable per-app per-device)
      if let uuid = UUID(uuidString: deviceId),
         let known = central?.retrievePeripherals(withIdentifiers: [uuid]).first {
        discoveredMap[deviceId] = known
      }
    }

    guard let p = discoveredMap[deviceId] else {
      throw NSError(
        domain: "WitMotionBle", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Device not found: \(deviceId)"]
      )
    }
    let cur = snapshot()
    if cur.connectedDevice?.id == deviceId && cur.isConnected {
      return cur.connectedDevice!.toDict()
    }
    stopScan()
    doDisconnect()

    let info = DeviceInfo(
      id: p.identifier.uuidString,
      name: p.name ?? p.identifier.uuidString,
      localName: p.name,
      rssi: nil
    )
    peripheral = p
    p.delegate = self
    mutate { s in s.status = "connecting"; s.error = nil; s.connectedDevice = info }
    central?.connect(p, options: nil)
    return info.toDict()
  }

  func disconnect() {
    doDisconnect()
  }

  private func doDisconnect() {
    clearBatch()
    stopPoll()
    if let p = peripheral { central?.cancelPeripheralConnection(p) }
    peripheral = nil; writeChar = nil; readChar = nil
    mutate { s in
      s.status = "idle"; s.isConnected = false; s.connectedDevice = nil
      s.liveData = LiveData(); s.packetCount = 0; s.error = nil
    }
  }

  // MARK: Poll timer
  // Alternates between magnetic-field and battery register reads every 500 ms,
  // matching the Android thread that does the same two requests in sequence.

  private func startPoll() {
    stopPoll()
    pollTick = 0
    let t = DispatchSource.makeTimerSource(queue: q)
    t.schedule(deadline: .now() + kPollIntervalSec, repeating: kPollIntervalSec)
    t.setEventHandler { [weak self] in
      guard let self = self else { return }
      let bytes: [UInt8] = self.pollTick % 2 == 0
        ? [0xFF, 0xAA, 0x27, 0x3A, 0x00]  // magnetic field
        : [0xFF, 0xAA, 0x27, 0x64, 0x00]  // battery
      self.write(bytes: bytes)
      self.pollTick += 1
    }
    pollTimer = t
    t.resume()
  }

  private func stopPoll() {
    pollTimer?.cancel(); pollTimer = nil
  }

  // MARK: Commands

  func sendCommand(bytes: [UInt8], save: Bool) {
    write(bytes: bytes)
    if save {
      q.asyncAfter(deadline: .now() + 0.1) { [weak self] in
        self?.write(bytes: [0xFF, 0xAA, 0x00, 0x00, 0x00])
      }
    }
  }

  private func write(bytes: [UInt8]) {
    guard let p = peripheral, let c = writeChar, p.state == .connected else { return }
    p.writeValue(Data(bytes), for: c, type: .withoutResponse)
  }

  // MARK: Incoming data

  private func handleData(_ data: Data) {
    let bytes = [UInt8](data)
    let arrivalMs = nowMs()
    var chunks: [[UInt8]] = []
    var offset = 0
    while offset + 20 <= bytes.count {
      if bytes[offset] == 0x55 {
        chunks.append(Array(bytes[offset ..< offset + 20]))
        offset += 20
      } else {
        offset += 1
      }
    }
    let n = chunks.count
    var parsed: [WitPacket] = []
    for (i, chunk) in chunks.enumerated() {
      // Spread timestamps backwards so every chunk in one notification gets
      // a distinct monotonically-increasing timestamp (10 ms apart at 100 Hz).
      let ts = arrivalMs - Int64(n - 1 - i) * 10
      if let pkt = parsePacket(chunk, ts: ts) { parsed.append(pkt) }
    }
    enqueue(parsed)
  }

  // MARK: Destroy

  func destroy() {
    stopScan()
    doDisconnect()
  }
}

// MARK: - CBCentralManagerDelegate

extension WitMotionBleManager: CBCentralManagerDelegate {
  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    let s: String
    switch central.state {
    case .poweredOn:    s = "poweredOn"
    case .poweredOff:   s = "poweredOff"
    case .unauthorized: s = "unauthorized"
    case .unsupported:  s = "unsupported"
    case .resetting:    s = "resetting"
    default:            s = "unknown"
    }
    mutate { $0.bleState = s }

    // If startScan was called before BLE was ready, begin scanning now.
    if central.state == .poweredOn && snapshot().isScanning {
      central.scanForPeripherals(withServices: nil,
                                 options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
    }
  }

  func centralManager(
    _ central: CBCentralManager,
    didDiscover peripheral: CBPeripheral,
    advertisementData: [String: Any],
    rssi RSSI: NSNumber
  ) {
    let name  = peripheral.name ?? ""
    let local = advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? name
    guard name.hasPrefix(namePrefix) || local.hasPrefix(namePrefix) else { return }

    let id = peripheral.identifier.uuidString
    discoveredMap[id] = peripheral

    let info = DeviceInfo(
      id: id,
      name: name.isEmpty ? id : name,
      localName: local.isEmpty ? nil : local,
      rssi: RSSI.intValue
    )
    mutate { s in
      if !s.discoveredDevices.contains(where: { $0.id == id }) {
        s.discoveredDevices.append(info)
      }
    }
    onDeviceFound?(info.toDict())

    if autoConnect && snapshot().status == "scanning" {
      _ = try? connect(deviceId: id)
    }
  }

  func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    peripheral.discoverServices([CBUUID(string: kServiceUUID)])
    mutate { s in s.status = "connected"; s.isConnected = true; s.error = nil }
  }

  func centralManager(
    _ central: CBCentralManager,
    didFailToConnect peripheral: CBPeripheral,
    error: Error?
  ) {
    emitError(error?.localizedDescription ?? "Failed to connect")
  }

  func centralManager(
    _ central: CBCentralManager,
    didDisconnectPeripheral peripheral: CBPeripheral,
    error: Error?
  ) {
    guard peripheral.identifier == self.peripheral?.identifier else { return }
    stopPoll(); clearBatch()
    self.peripheral = nil; writeChar = nil; readChar = nil
    mutate { s in
      s.status = "idle"; s.isConnected = false; s.connectedDevice = nil
      s.liveData = LiveData(); s.packetCount = 0
    }
  }
}

// MARK: - CBPeripheralDelegate

extension WitMotionBleManager: CBPeripheralDelegate {
  func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    if let e = error { emitError("Service discovery failed: \(e.localizedDescription)"); return }
    guard let services = peripheral.services,
          let svc = services.first(where: {
            $0.uuid.uuidString.uppercased() == kServiceUUID
          })
    else { emitError("WIT service not found on device"); return }
    peripheral.discoverCharacteristics(nil, for: svc)
  }

  func peripheral(
    _ peripheral: CBPeripheral,
    didDiscoverCharacteristicsFor service: CBService,
    error: Error?
  ) {
    guard error == nil, let chars = service.characteristics else { return }
    for c in chars {
      switch c.uuid.uuidString.uppercased() {
      case kReadUUID:
        readChar = c
        // iOS manages the CCCD automatically — no manual descriptor write needed.
        peripheral.setNotifyValue(true, for: c)
      case kWriteUUID:
        writeChar = c
      default: break
      }
    }
    if writeChar != nil { startPoll() }
  }

  func peripheral(
    _ peripheral: CBPeripheral,
    didUpdateValueFor characteristic: CBCharacteristic,
    error: Error?
  ) {
    guard error == nil,
          characteristic.uuid.uuidString.uppercased() == kReadUUID,
          let data = characteristic.value else { return }
    handleData(data)
  }

  func peripheral(
    _ peripheral: CBPeripheral,
    didUpdateNotificationStateFor characteristic: CBCharacteristic,
    error: Error?
  ) {
    if let e = error { emitError("Notification setup failed: \(e.localizedDescription)") }
  }
}

// MARK: - Expo Module

public class WitMotionBleModule: Module {
  private var bleManager: WitMotionBleManager?

  public func definition() -> ModuleDefinition {
    Name("WitMotionBle")

    Events("onStateChanged", "onDataBatch", "onDeviceFound", "onError")

    OnCreate {
      let mgr = WitMotionBleManager()
      mgr.onStateChanged = { [weak self] p in self?.sendEvent("onStateChanged", p) }
      mgr.onDataBatch    = { [weak self] p in self?.sendEvent("onDataBatch", p) }
      mgr.onDeviceFound  = { [weak self] p in self?.sendEvent("onDeviceFound", p) }
      mgr.onError        = { [weak self] p in self?.sendEvent("onError", p) }
      self.bleManager = mgr
    }

    OnDestroy {
      self.bleManager?.destroy()
      self.bleManager = nil
    }

    Function("requestPermissions") {
      // BLE permission on iOS is granted implicitly via the system prompt that
      // CBCentralManager shows on first init.  No runtime request is needed here.
      return true
    }

    AsyncFunction("startScan") { (options: [String: Any?]?) -> Bool in
      return self.bleManager?.startScan(options: options) ?? false
    }

    Function("stopScan") {
      self.bleManager?.stopScan()
    }

    AsyncFunction("connect") { (deviceId: String) -> [String: Any?] in
      guard let mgr = self.bleManager else {
        throw NSError(domain: "WitMotionBle", code: 0,
                      userInfo: [NSLocalizedDescriptionKey: "Module not initialised"])
      }
      return try mgr.connect(deviceId: deviceId)
    }

    AsyncFunction("disconnect") {
      self.bleManager?.disconnect()
      return true
    }

    Function("reset") {
      self.bleManager?.sendCommand(bytes: [0xFF, 0xAA, 0x00, 0x01, 0x00], save: false)
    }

    Function("setOutputRate") { (value: Int) in
      let code: UInt8
      switch value {
      case 1:   code = 3
      case 5:   code = 5
      case 10:  code = 6
      case 50:  code = 8
      case 100: code = 9
      case 200: code = 11
      default: return
      }
      self.bleManager?.sendCommand(bytes: [0xFF, 0xAA, 0x03, code, 0x00], save: true)
    }

    Function("setBandwidth") { (value: Int) in
      let code: UInt8
      switch value {
      case 5:   code = 7
      case 10:  code = 6
      case 20:  code = 5
      case 42:  code = 4
      case 98:  code = 3
      case 188: code = 2
      default: return
      }
      self.bleManager?.sendCommand(bytes: [0xFF, 0xAA, 0x1F, code, 0x00], save: true)
    }

    Function("setAngleZero") {
      self.bleManager?.sendCommand(bytes: [0xFF, 0xAA, 0x01, 0x08, 0x00], save: false)
    }

    Function("startMagCalibration") {
      self.bleManager?.sendCommand(bytes: [0xFF, 0xAA, 0x01, 0x07, 0x00], save: false)
    }

    Function("stopMagCalibration") {
      self.bleManager?.sendCommand(bytes: [0xFF, 0xAA, 0x01, 0x00, 0x00], save: true)
    }

    Function("requestMagneticField") {
      self.bleManager?.sendCommand(bytes: [0xFF, 0xAA, 0x27, 0x3A, 0x00], save: false)
    }

    Function("requestBattery") {
      self.bleManager?.sendCommand(bytes: [0xFF, 0xAA, 0x27, 0x64, 0x00], save: false)
    }

    Function("sendRawCommand") { (bytes: [Int], persist: Bool?) in
      let ubytes = bytes.map { UInt8($0 & 0xFF) }
      self.bleManager?.sendCommand(bytes: ubytes, save: persist ?? false)
    }

    AsyncFunction("getState") { () -> [String: Any?] in
      return self.bleManager?.getStateDict() ?? [:]
    }
  }
}
