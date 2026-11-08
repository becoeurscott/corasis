import SwiftUI

struct CalendarView: View {
    @EnvironmentObject var store: Store
    @State private var create = false
    @State private var date = Date()
    @State private var filterDay = false
    var body: some View { Page {
        if let next = store.nextEvent { Card { Text("NEXT TIME, TOGETHER").font(.caption.bold()).foregroundStyle(.tint); Text("\(Day.distance(store.today, next.day)) days").font(.largeTitle.bold()); Text(next.destination.isEmpty ? next.title : next.destination).font(.title3) } }
        Button { create = true } label: { Label("Add an event", systemImage: "calendar.badge.plus") }.buttonStyle(.borderedProminent)
        DatePicker("Calendar", selection: $date, displayedComponents: .date).datePickerStyle(.graphical).onChange(of: date) { _, _ in filterDay = true }
        Toggle("Only selected date", isOn: $filterDay)
        if store.events.isEmpty { ContentUnavailableView("Something to look forward to", systemImage: "calendar", description: Text("Plan a visit, a birthday, or an anniversary.")) }
        ForEach(store.events.filter { !filterDay || $0.day == Day.key(date, zone: store.couple?.timezone ?? "UTC") }) { event in NavigationLink { EventDetail(id: event.id) } label: { Card { Text(event.title).font(.headline); Text("\(Day.label(event.day))\(event.destination.isEmpty ? "" : " · " + event.destination)").font(.subheadline).foregroundStyle(.secondary) } }.buttonStyle(.smooth) }
    }.navigationTitle("Meetings & calendar").navigationBarTitleDisplayMode(.inline).sheet(isPresented: $create) { NavigationStack { EventEditor() } } }
}
struct EventDetail: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    var id: String
    @State private var edit = false
    @State private var delete = false
    var event: Event? { store.events.first { $0.id == id } }
    var body: some View { Page { if let event {
        Text(event.title).font(.largeTitle.bold()); Text(Day.label(event.day)).font(.title3); if !event.allDay { Text("\(event.time) · \(store.couple?.timezone ?? "UTC")").foregroundStyle(.secondary) }; if event.day >= store.today { Card { Text("\(Day.distance(store.today, event.day)) days to go").font(.title.bold()) } }; if !event.destination.isEmpty { Label(event.destination, systemImage: "mappin.and.ellipse") }; if !event.notes.isEmpty { Card { Text(event.notes) } }; if event.annual { InfoBanner(text: "This is an annual event. The calendar shows its next occurrence.") }; PrimaryButton(title: "Edit event") { edit = true }; Button("Delete event", role: .destructive) { delete = true }
    } }.navigationTitle("Event").navigationBarTitleDisplayMode(.inline).sheet(isPresented: $edit) { NavigationStack { EventEditor(existing: event) } }.confirmationDialog("Delete this event?", isPresented: $delete) { Button("Delete event", role: .destructive) { store.deleteEvent(id); dismiss() } } }
}
struct EventEditor: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    var existing: Event?
    @State private var title = ""
    @State private var date = Date()
    @State private var kind = "meeting"
    @State private var destination = ""
    @State private var notes = ""
    @State private var annual = false
    @State private var allDay = true
    @State private var time = Date()
    @State private var reminder = 1
    var body: some View { Form {
        Section("The plan") { TextField("Title", text: $title); Picker("Kind", selection: $kind) { ForEach(["meeting", "anniversary", "birthday", "visit", "custom"], id: \.self) { Text($0.capitalized).tag($0) } }; DatePicker("Date", selection: $date, displayedComponents: .date); Toggle("All day", isOn: $allDay); if !allDay { DatePicker("Time", selection: $time, displayedComponents: .hourAndMinute) }; TextField("Destination", text: $destination); TextField("Notes", text: $notes, axis: .vertical); Toggle("Repeat annually", isOn: $annual) }
        Section("Reminder") { Picker("Remind me", selection: $reminder) { Text("No reminder").tag(-1); Text("On the day").tag(0); Text("1 day before").tag(1); Text("1 week before").tag(7) }; Text("Local reminders need notification permission. Your couple time zone is \(store.couple?.timezone ?? "UTC").").font(.caption).foregroundStyle(.secondary) }
        Button("Save event") { store.perform { let c = try store.requireCouple(); var event = existing ?? Event(coupleID: c.id, title: "", day: store.today); event.title = title; event.day = Day.key(date, zone: c.timezone); event.kind = kind; event.destination = destination; event.notes = notes; event.annual = annual; event.allDay = allDay; event.reminderDays = reminder; let f = DateFormatter(); f.dateFormat = "HH:mm"; event.time = f.string(from: time); try store.saveEvent(event); Task { do { try await Reminders.schedule(event: event, zone: c.timezone, prefs: store.db.prefs) } catch { store.error = "Event saved. \(error.localizedDescription)" } }; dismiss() } }
    }.navigationTitle(existing == nil ? "New event" : "Edit event").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }.onAppear { if let e = existing { title = e.title; date = Day.date(e.day, zone: store.couple?.timezone ?? "UTC"); kind = e.kind; destination = e.destination; notes = e.notes; annual = e.annual; allDay = e.allDay; reminder = e.reminderDays; let f = DateFormatter(); f.dateFormat = "HH:mm"; time = f.date(from: e.time) ?? Date() } } }
}
