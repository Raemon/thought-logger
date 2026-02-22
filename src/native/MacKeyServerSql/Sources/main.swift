import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

struct KeyEvent: Codable {
    let timestamp: Int64
    let applicationName: String
    let windowTitle: String
    let rawKey: String
    let state: String
}

func getMillis() -> Int64 {
    return Int64(NSDate().timeIntervalSince1970 * 1000)
}

func getActiveAppName() -> String {
    if let app = NSWorkspace.shared.frontmostApplication {
        return app.localizedName ?? "Unknown"
    }
    return "Unknown"
}

func getActiveWindowTitle() -> String {
    guard let frontApp = NSWorkspace.shared.frontmostApplication else { return "" }
    let pid = frontApp.processIdentifier
    let appElement = AXUIElementCreateApplication(pid)
    var windowValue: AnyObject?
    let windowResult = AXUIElementCopyAttributeValue(appElement, kAXFocusedWindowAttribute as CFString, &windowValue)
    if windowResult != .success { return "" }
    guard let windowElement = windowValue else { return "" }
    var titleValue: AnyObject?
    let titleResult = AXUIElementCopyAttributeValue(windowElement as! AXUIElement, kAXTitleAttribute as CFString, &titleValue)
    if titleResult != .success { return "" }
    return titleValue as? String ?? ""
}

func getModifierString(flags: CGEventFlags) -> String {
    var modifiers = ""
    if flags.contains(.maskControl) { modifiers += "⌃" }
    if flags.contains(.maskCommand) { modifiers += "⌘" }
    if flags.contains(.maskAlternate) { modifiers += "⌥" }
    return modifiers
}

func getUnicodeString(event: CGEvent) -> String {
    var length: Int = 0
    var buffer: [UniChar] = Array(repeating: 0, count: 8)
    event.keyboardGetUnicodeString(maxStringLength: buffer.count, actualStringLength: &length, unicodeString: &buffer)
    if length <= 0 { return "" }
    return String(utf16CodeUnits: buffer, count: length)
}

func rawKeyForEvent(event: CGEvent, keyCode: Int64) -> String {
    let modifiers = getModifierString(flags: event.flags)
    switch keyCode {
    case 49:
        return modifiers + " "
    case 51:
        return modifiers + "⌫"
    case 36:
        return modifiers + "⏎"
    case 48:
        return modifiers + "↹"
    case 53:
        return modifiers + "⎋"
    case 123:
        return modifiers + "←"
    case 124:
        return modifiers + "→"
    case 125:
        return modifiers + "↓"
    case 126:
        return modifiers + "↑"
    default:
        let str = getUnicodeString(event: event)
        if str.isEmpty { return modifiers }
        return modifiers + str
    }
}

let printQueue = DispatchQueue(label: "MacKeyServerSql.printQueue")
let encoder = JSONEncoder()

func emitEvent(event: KeyEvent) {
    printQueue.async {
        if let data = try? encoder.encode(event), let text = String(data: data, encoding: .utf8) {
            print(text)
            fflush(stdout)
        }
    }
}

func myCGEventTapCallback(proxy: CGEventTapProxy, type: CGEventType, event: CGEvent, refcon: UnsafeMutableRawPointer?) -> Unmanaged<CGEvent>? {
    if type == .keyDown || type == .keyUp {
        let keyCode = event.getIntegerValueField(.keyboardEventKeycode)
        let rawKey = rawKeyForEvent(event: event, keyCode: keyCode)
        let appName = getActiveAppName()
        let windowTitle = getActiveWindowTitle()
        let keyEvent = KeyEvent(
            timestamp: getMillis(),
            applicationName: appName,
            windowTitle: windowTitle,
            rawKey: rawKey,
            state: type == .keyDown ? "DOWN" : "UP"
        )
        emitEvent(event: keyEvent)
    }
    return Unmanaged.passUnretained(event)
}

let eventMask = (1 << CGEventType.keyDown.rawValue) | (1 << CGEventType.keyUp.rawValue)

guard let eventTap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .listenOnly,
    eventsOfInterest: CGEventMask(eventMask),
    callback: myCGEventTapCallback,
    userInfo: nil
) else {
    fputs("Failed to create event tap\n", stderr)
    fflush(stderr)
    exit(1)
}

let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
CGEvent.tapEnable(tap: eventTap, enable: true)
CFRunLoopRun()

