import SwiftUI
import StoreKit

@MainActor final class PlusStore: ObservableObject {
    static let shared = PlusStore()
    static let ids = ["com.ebenezer.corasis.plus.yearly", "com.ebenezer.corasis.plus.monthly"]
    @Published var products: [StoreKit.Product] = []
    @Published var busy = false
    private weak var store: Store?
    private var updates: Task<Void, Never>?

    func start(_ store: Store) async {
        self.store = store
        if updates == nil { updates = Task { for await result in Transaction.updates { if case .verified(let t) = result { await t.finish() }; await self.refresh() } } }
        if products.isEmpty { products = ((try? await StoreKit.Product.products(for: Self.ids)) ?? []).sorted { $0.price > $1.price } }
        await refresh()
    }

    func refresh() async {
        var active = false
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result, Self.ids.contains(t.productID), t.revocationDate == nil { active = true }
        }
        if store?.db.prefs.premium != active { store?.db.prefs.premium = active }
    }

    /// Returns true when the purchase completed.
    func buy(_ product: StoreKit.Product) async throws -> Bool {
        busy = true; defer { busy = false }
        switch try await product.purchase() {
        case .success(.verified(let t)): await t.finish(); await refresh(); return true
        case .success(.unverified): throw AppError(message: "The App Store could not verify this purchase.")
        default: return false
        }
    }

    func restore() async throws {
        busy = true; defer { busy = false }
        try await AppStore.sync(); await refresh()
        if store?.db.prefs.premium != true { throw AppError(message: "No active Together Plus subscription was found for this Apple ID.") }
    }
}

struct PaywallView: View {
    @EnvironmentObject var store: Store
    @StateObject private var plus = PlusStore.shared
    @Environment(\.appPalette) private var p
    @Environment(\.dismiss) private var dismiss
    @State private var selected: String?
    @State private var notice = ""
    var body: some View {
        Page {
            Text("A little more, together.").font(.largeTitle.bold())
            Card {
                Label("Restore a lost flame", systemImage: "flame.fill")
                Label("Future plans and repair decks", systemImage: "sparkles")
                Label("All four themes and your shared album", systemImage: "heart")
            }
            if store.db.prefs.premium {
                InfoBanner(text: tr("Together Plus is active. Thank you 💕"))
                Button("Manage subscription") { Task { if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene { try? await AppStore.showManageSubscriptions(in: scene) } } }.frame(maxWidth: .infinity, minHeight: 44)
            } else if plus.products.isEmpty {
                ProgressView().frame(maxWidth: .infinity)
            } else {
                ForEach(plus.products, id: \.id) { product in
                    let on = (selected ?? plus.products.first?.id) == product.id
                    Button { selected = product.id } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(product.displayName).font(.headline)
                                Text(detail(product)).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(product.displayPrice).font(.headline)
                        }.padding(16).background(p.surface, in: RoundedRectangle(cornerRadius: 18))
                            .overlay(RoundedRectangle(cornerRadius: 18).stroke(on ? p.primary : p.color("border"), lineWidth: on ? 2 : 1))
                    }.buttonStyle(.smooth)
                }
                if !notice.isEmpty { Text(notice).font(.caption).foregroundStyle(p.color("danger")) }
                PrimaryButton(title: plus.busy ? "Please wait…" : cta) { purchase() }.disabled(plus.busy)
                Button("Restore purchases") { Task { do { try await plus.restore() } catch { notice = error.localizedDescription } } }.frame(maxWidth: .infinity, minHeight: 44).disabled(plus.busy)
                Text("Subscriptions renew automatically until cancelled in your Apple ID settings. Payment is charged to your Apple ID.").font(.caption2).foregroundStyle(.secondary)
            }
        }.navigationTitle("Together Plus").task { await plus.start(store) }
    }
    var chosen: StoreKit.Product? { plus.products.first { $0.id == (selected ?? plus.products.first?.id) } }
    var cta: String { chosen?.subscription?.introductoryOffer?.paymentMode == .freeTrial ? tr("Start free trial") : tr("Subscribe") }
    func detail(_ product: StoreKit.Product) -> String {
        var parts = [product.subscription?.subscriptionPeriod.unit == .year ? tr("Billed yearly") : tr("Billed monthly")]
        if let intro = product.subscription?.introductoryOffer, intro.paymentMode == .freeTrial { parts.insert(intro.period.unit == .day ? tr("\(intro.period.value)-day free trial") : tr("\(intro.period.value)-week free trial"), at: 0) }
        return parts.joined(separator: " · ")
    }
    func purchase() {
        guard let chosen else { return }; notice = ""
        Task { do { if try await plus.buy(chosen) { dismiss() } } catch { notice = error.localizedDescription } }
    }
}
