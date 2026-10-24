import SwiftUI
import WidgetKit

/// The home screen widget: the current streak, the last seven days in the lane colour and what is
/// waiting; the medium size adds the Unix rank and the counts, the large one the newest commits
/// from the people you follow. The app writes the numbers into the app group and reloads the
/// timeline; the widget never talks to devnull itself.
struct StreakEntry: TimelineEntry {
  let date: Date
  let data: StreakData?
}

struct StreakProvider: TimelineProvider {
  func placeholder(in context: Context) -> StreakEntry {
    StreakEntry(date: Date(), data: StreakData.sample)
  }

  func getSnapshot(in context: Context, completion: @escaping (StreakEntry) -> Void) {
    completion(StreakEntry(date: Date(), data: context.isPreview ? StreakData.sample : StreakData.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<StreakEntry>) -> Void) {
    // The app refreshes the data and reloads the timeline; a timeline of one entry is enough.
    completion(Timeline(entries: [StreakEntry(date: Date(), data: StreakData.load())], policy: .after(Date().addingTimeInterval(30 * 60))))
  }
}

private let mono = Font.system(.caption, design: .monospaced)
private let monoSmall = Font.system(size: 10, design: .monospaced)

struct DayCells: View {
  let days: [StreakDay]
  let lane: Color
  var size: CGFloat = 16

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      HStack(spacing: 3) {
        ForEach(Array(days.enumerated()), id: \.offset) { _, day in
          RoundedRectangle(cornerRadius: 4)
            .fill(day.level == 0 ? Color.secondary.opacity(0.15) : lane.opacity([0, 0.32, 0.56, 0.8, 1][min(max(day.level, 0), 4)]))
            .frame(width: size, height: size)
        }
      }
      HStack(spacing: 3) {
        ForEach(Array(days.enumerated()), id: \.offset) { _, day in
          Text(day.weekday).font(monoSmall).foregroundStyle(.secondary).frame(width: size)
        }
      }
    }
  }
}

struct Wordmark: View {
  var body: some View {
    HStack(spacing: 0) {
      Text("/dev").font(.system(size: 12, weight: .semibold))
      Text("/").font(.system(size: 12, weight: .semibold)).foregroundStyle(Color(hex: "#d9480f"))
      Text("null").font(.system(size: 12, weight: .semibold))
    }
  }
}

struct StreakWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: StreakEntry

  var body: some View {
    if let data = entry.data {
      content(data)
    } else {
      VStack(spacing: 4) {
        Wordmark()
        Text("Sign in to null-pointer to see your streak.").font(monoSmall).foregroundStyle(.secondary).multilineTextAlignment(.center)
      }
    }
  }

  @ViewBuilder
  private func content(_ data: StreakData) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 2) {
          HStack(alignment: .lastTextBaseline, spacing: 4) {
            Text("\(data.current)").font(.system(size: family == .systemSmall ? 30 : 36, weight: .semibold)).foregroundStyle(data.lane)
            Text("day streak").font(mono).foregroundStyle(.secondary)
          }
          Text("longest \(data.longest) · \(data.total) this week").font(monoSmall).foregroundStyle(.secondary)
        }
        if family != .systemSmall {
          Spacer()
          DayCells(days: data.days, lane: data.lane)
        }
      }

      if family == .systemSmall {
        DayCells(days: data.days, lane: data.lane, size: 14)
      }

      if family == .systemMedium || family == .systemLarge {
        VStack(alignment: .leading, spacing: 4) {
          HStack {
            Text(data.rank.isEmpty ? "Lv. \(data.level)" : "Lv. \(data.level) · \(data.rank)").font(monoSmall).foregroundStyle(data.lane)
            Spacer()
            if data.badgesTotal > 0 {
              Text("\(data.badges) / \(data.badgesTotal) badges").font(monoSmall).foregroundStyle(.secondary)
            }
          }
          GeometryReader { geometry in
            ZStack(alignment: .leading) {
              Capsule().fill(Color.secondary.opacity(0.15))
              Capsule().fill(data.lane).frame(width: max(4, geometry.size.width * (data.progress ?? 1)))
            }
          }
          .frame(height: 5)
          Text("\(data.commits) commits · \(data.following) following · \(data.followers) followers").font(monoSmall).foregroundStyle(.secondary).lineLimit(1)
        }
      }

      if family == .systemLarge, !data.latest.isEmpty {
        Divider()
        VStack(alignment: .leading, spacing: 5) {
          Text("$ git log --following").font(monoSmall).foregroundStyle(.secondary)
          ForEach(data.latest.prefix(3)) { commit in
            Link(destination: URL(string: "devnull://commits/\(commit.id)")!) {
              HStack(spacing: 6) {
                Text("@\(commit.username)").font(monoSmall)
                Text(commit.line).font(monoSmall).foregroundStyle(.secondary).lineLimit(1)
                Spacer(minLength: 0)
                Text(commit.ago).font(monoSmall).foregroundStyle(.secondary)
              }
            }
          }
        }
      }

      Spacer(minLength: 0)

      HStack {
        Text(data.waiting).font(monoSmall).foregroundStyle(data.waiting == "all caught up" ? Color.secondary : Color.primary).lineLimit(1)
        Spacer()
        if family != .systemSmall {
          Text("@\(data.username) · ").font(monoSmall).foregroundStyle(.secondary)
        }
        Wordmark()
      }
    }
  }
}

struct StreakWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "streak", provider: StreakProvider()) { entry in
      StreakWidgetView(entry: entry)
        .containerBackground(.background, for: .widget)
        .widgetURL(URL(string: "devnull://")!)
    }
    .configurationDisplayName("Commit streak")
    .description("Your streak, the last seven days and what is new on /dev/null.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

@main
struct StreakBundle: WidgetBundle {
  var body: some Widget {
    StreakWidget()
  }
}

#Preview(as: .systemMedium) {
  StreakWidget()
} timeline: {
  StreakEntry(date: .now, data: StreakData.sample)
}
