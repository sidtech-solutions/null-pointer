import Foundation
import SwiftUI

/// What the app wrote for the widget, as `lib/widgets.ts` writes it into the app group: the streak,
/// the last seven days, the rank, and what is waiting. Missing fields fall back, so an older app
/// never breaks a newer widget.
struct StreakDay: Decodable {
  var weekday: String
  var count: Int
  var level: Int
}

struct LatestCommit: Decodable, Identifiable {
  var id: String
  var username: String
  var line: String
  var ago: String
}

struct StreakData: Decodable {
  var username: String
  var laneColor: String?
  var current: Int
  var longest: Int
  var days: [StreakDay]
  var total: Int
  var commits: Int
  var followers: Int
  var following: Int
  var level: Int
  var rank: String
  var progress: Double?
  var badges: Int
  var badgesTotal: Int
  var notifications: Int
  var remotes: Int
  var pasteisLeft: Int?
  var latest: [LatestCommit]

  static let appGroup = "group.com.siddarthkay.nullpointer"
  static let key = "streak"

  static func load() -> StreakData? {
    guard let defaults = UserDefaults(suiteName: appGroup), let raw = defaults.string(forKey: key), let json = raw.data(using: .utf8) else {
      return nil
    }

    return try? JSONDecoder().decode(StreakData.self, from: json)
  }

  static let sample = StreakData(
    username: "siddarthkay", laneColor: "#d9480f", current: 4, longest: 9, days: [
      StreakDay(weekday: "S", count: 0, level: 0), StreakDay(weekday: "S", count: 0, level: 0), StreakDay(weekday: "M", count: 0, level: 0),
      StreakDay(weekday: "T", count: 3, level: 1), StreakDay(weekday: "W", count: 5, level: 2), StreakDay(weekday: "T", count: 9, level: 3), StreakDay(weekday: "F", count: 12, level: 4),
    ],
    total: 29, commits: 93, followers: 16, following: 31, level: 5, rank: "wheel", progress: 0.61, badges: 8, badgesTotal: 14,
    notifications: 3, remotes: 1, pasteisLeft: 6, latest: [
      LatestCommit(id: "1", username: "nunomaduro", line: "you are all nullers", ago: "1h"),
      LatestCommit(id: "2", username: "simonhamp", line: "Guys it turns out that bridgeless is fine", ago: "2h"),
    ])

  var lane: Color {
    Color(hex: laneColor ?? "#3b6fe0")
  }

  var waiting: String {
    var parts: [String] = []
    if notifications > 0 { parts.append("\(notifications) new") }
    if remotes > 0 { parts.append("\(remotes) \(remotes == 1 ? "push" : "pushes")") }
    if let pasteis = pasteisLeft, pasteis > 0 { parts.append("\(pasteis) pastéis left") }
    return parts.isEmpty ? "all caught up" : parts.joined(separator: " · ")
  }
}

extension Color {
  /// A `#rrggbb` as the app sends lane colours.
  init(hex: String) {
    var value: UInt64 = 0
    let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    Scanner(string: cleaned).scanHexInt64(&value)
    let r = Double((value >> 16) & 0xff) / 255
    let g = Double((value >> 8) & 0xff) / 255
    let b = Double(value & 0xff) / 255
    self.init(red: r, green: g, blue: b)
  }
}
