import Foundation
import CryptoKit
import AuthenticationServices

/// InsForge backend (https://insforge.dev): accounts, the `profiles` table and
/// profile photos in the public `avatars` bucket (`avatars/<userId>/…`, owner-only writes).
/// Same project and rules as the React Native app (src/services/backend/remote.ts).
/// Configure with the `InsForgeURL` and `InsForgeAnonKey` Info.plist keys (public anon key only).
struct RemoteUser: Decodable { var id: String; var email: String; var emailVerified: Bool? }
struct RemoteCouple: Decodable { struct Partner: Decodable { var id: String; var first_name: String; var timezone: String; var avatar_url: String? }; var couple_id: String; var timezone: String; var partner: Partner }
struct RemoteLive: Decodable { var user_id: String; var share_location: Bool; var share_battery: Bool; var lat: Double?; var lon: Double?; var country: String?; var country_code: String?; var location_at: String?; var battery: Int? }
struct RemoteInvite: Decodable { var code: String; var expires_at: String }
struct RemoteProfile: Codable { var id: String; var first_name: String; var pronouns: String?; var timezone: String; var avatar_url: String?; var avatar_key: String? }

actor InsForge {
    static let shared = InsForge()
    nonisolated static let baseURL: URL? = (Bundle.main.object(forInfoDictionaryKey: "InsForgeURL") as? String).flatMap { $0.isEmpty ? nil : URL(string: $0) }
    nonisolated static let anonKey: String? = (Bundle.main.object(forInfoDictionaryKey: "InsForgeAnonKey") as? String).flatMap { $0.isEmpty ? nil : $0 }
    nonisolated static var configured: Bool { baseURL != nil && anonKey != nil }

    private var accessToken: String?
    private let refreshKey = "insforge-refresh-token"

    private struct Session: Decodable { var user: RemoteUser?; var accessToken: String?; var refreshToken: String?; var requireEmailVerification: Bool? }
    private struct ErrorBody: Decodable { var message: String? }
    private struct StoredObject: Decodable { var key: String; var url: String }

    // MARK: HTTP
    private func request(_ method: String, _ path: String, json: Any? = nil, auth: Bool = false, headers: [String: String] = [:], body: Data? = nil) async throws -> Data {
        guard let base = Self.baseURL, let anon = Self.anonKey, let url = URL(string: path, relativeTo: base) else { throw AppError(message: "The server is not configured.") }
        var req = URLRequest(url: url); req.httpMethod = method; req.timeoutInterval = 60
        req.setValue("Bearer \(auth ? (accessToken ?? anon) : anon)", forHTTPHeaderField: "Authorization")
        if let json { req.httpBody = try JSONSerialization.data(withJSONObject: json); req.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if let body { req.httpBody = body }
        headers.forEach { req.setValue($1, forHTTPHeaderField: $0) }
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let message = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.message
            throw AppError(message: message ?? "The server returned an error (\(status)).")
        }
        return data
    }
    private func adopt(_ s: Session) {
        if let token = s.accessToken { accessToken = token }
        if let refresh = s.refreshToken { try? Secure.put(refresh, key: refreshKey) }
    }
    /// Restores an access token from the Keychain refresh token after a relaunch.
    private func ensureSession() async throws {
        if accessToken != nil { return }
        guard let refresh = Secure.get(refreshKey) else { throw AppError(message: "Your session expired. Sign in again to sync your profile.") }
        let data = try await request("POST", "/api/auth/refresh?client_type=mobile", json: ["refreshToken": refresh])
        adopt(try JSONDecoder().decode(Session.self, from: data))
    }

    // MARK: Auth
    /// Returns the user when a session started immediately; `nil` when an emailed code must be verified first.
    func signUp(email: String, password: String, name: String) async throws -> (user: RemoteUser?, needsVerification: Bool) {
        let data = try await request("POST", "/api/auth/users?client_type=mobile", json: ["email": email, "password": password, "name": name])
        let s = try JSONDecoder().decode(Session.self, from: data); adopt(s)
        return (s.user, s.requireEmailVerification == true && s.accessToken == nil)
    }
    func verifyEmail(email: String, code: String) async throws -> RemoteUser {
        let data = try await request("POST", "/api/auth/email/verify?client_type=mobile", json: ["email": email, "otp": code])
        let s = try JSONDecoder().decode(Session.self, from: data); adopt(s)
        guard let user = s.user else { throw AppError(message: "That code does not match.") }
        return user
    }
    func resendVerification(email: String) async throws { _ = try await request("POST", "/api/auth/email/send-verification", json: ["email": email]) }
    func signIn(email: String, password: String) async throws -> RemoteUser {
        let data = try await request("POST", "/api/auth/sessions?client_type=mobile", json: ["email": email, "password": password])
        let s = try JSONDecoder().decode(Session.self, from: data); adopt(s)
        guard let user = s.user else { throw AppError(message: "Email or password is incorrect.") }
        return user
    }
    // MARK: Partner connection (server functions in migrations/*partner-invitations.sql)
    private func rpc(_ name: String, _ args: [String: Any] = [:]) async throws -> Data {
        try await ensureSession()
        return try await request("POST", "/api/database/rpc/\(name)", json: args, auth: true)
    }
    func createInvitation() async throws -> RemoteInvite { try JSONDecoder().decode(RemoteInvite.self, from: try await rpc("create_invitation")) }
    func acceptInvitation(code: String) async throws -> RemoteCouple { try JSONDecoder().decode(RemoteCouple.self, from: try await rpc("accept_invitation", ["p_code": code])) }
    func myCouple() async throws -> RemoteCouple? {
        let data = try await rpc("my_couple")
        if let text = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines), text.isEmpty || text == "null" { return nil }
        return try JSONDecoder().decode(RemoteCouple.self, from: data)
    }
    func unlinkCouple() async throws { _ = try await rpc("unlink_couple") }

    // MARK: Live status (location + battery, migrations/*live-status.sql)
    func updateLive(shareLocation: Bool, shareBattery: Bool, lat: Double?, lon: Double?, country: String?, countryCode: String?, battery: Int?) async throws {
        var args: [String: Any] = ["p_share_location": shareLocation, "p_share_battery": shareBattery]
        if let lat { args["p_lat"] = lat }; if let lon { args["p_lon"] = lon }
        if let country { args["p_country"] = country }; if let countryCode { args["p_country_code"] = countryCode }
        if let battery { args["p_battery"] = battery }
        _ = try await rpc("update_live_status", args)
    }
    func partnerLive() async throws -> RemoteLive? {
        let data = try await rpc("partner_live_status")
        if let text = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines), text.isEmpty || text == "null" { return nil }
        return try JSONDecoder().decode(RemoteLive.self, from: data)
    }

    // MARK: Couple sync (docs/SYNC.md)
    /// Sends changed items, returns the server's answer as raw JSON (items keep free-form `data`).
    func syncItems(_ items: [[String: Any]], since: String?) async throws -> [String: Any] {
        var args: [String: Any] = ["p_items": items]
        args["p_since"] = since ?? NSNull()
        let data = try await rpc("sync_couple_items", args)
        return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }
    private func objectPath(_ key: String) -> String {
        "/api/storage/buckets/couple-media/objects/" + (key.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-._~"))) ?? key)
    }
    /// Uploads a photo/video/voice note to the couple's private folder; returns its key.
    func uploadCoupleMedia(coupleID: String, file: URL) async throws -> String {
        try await ensureSession()
        let ext = file.pathExtension.isEmpty ? "bin" : file.pathExtension.lowercased()
        let key = "\(coupleID)/\(UUID().uuidString.lowercased()).\(ext)"
        let mime = ["jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "heic": "image/heic", "mov": "video/quicktime", "mp4": "video/mp4", "m4a": "audio/mp4", "caf": "audio/x-caf"][ext] ?? "application/octet-stream"
        let boundary = "Boundary-\(UUID().uuidString)"
        var body = Data()
        body.append("--\(boundary)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"media.\(ext)\"\r\nContent-Type: \(mime)\r\n\r\n".data(using: .utf8)!)
        body.append(try Data(contentsOf: file)); body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        let data = try await request("PUT", objectPath(key), auth: true, headers: ["Content-Type": "multipart/form-data; boundary=\(boundary)"], body: body)
        return (try? JSONDecoder().decode(StoredObject.self, from: data).key) ?? key
    }
    func downloadCoupleMedia(key: String) async throws -> Data {
        try await ensureSession()
        return try await request("GET", objectPath(key), auth: true)
    }

    // MARK: Affection
    struct ReceivedAffection: Decodable { var id: String; var emoji: String; var created_at: String }
    private struct SentAffection: Decodable { var id: String }
    func sendAffection(emoji: String) async throws -> String { try JSONDecoder().decode(SentAffection.self, from: try await rpc("send_affection", ["p_emoji": emoji])).id }
    func receivedAffections(since: String) async throws -> [ReceivedAffection] { try JSONDecoder().decode([ReceivedAffection].self, from: try await rpc("received_affections", ["p_since": since])) }
    func savePushToken(_ token: String, environment: String) async throws { _ = try await rpc("save_push_token", ["p_token": token, "p_platform": "ios", "p_environment": environment]) }
    func removePushToken(_ token: String) async { _ = try? await rpc("remove_push_token", ["p_token": token]) }
    /// Asks the affection-push function to notify the partner's phones (best effort).
    func pushAffection(id: String) async {
        _ = try? await request("POST", "/functions/affection-push", json: ["affection_id": id], auth: true)
    }

    // MARK: Email code (passwordless) — a new email becomes a verified account on first code
    func sendCode(email: String) async throws { _ = try await request("POST", "/api/auth/email/send-otp", json: ["email": email]) }
    func verifyCode(email: String, code: String, name: String) async throws -> RemoteUser {
        var body: [String: Any] = ["email": email, "otp": code, "method": "otp"]; if !name.isEmpty { body["name"] = name }
        let data = try await request("POST", "/api/auth/sessions?client_type=mobile", json: body)
        let s = try JSONDecoder().decode(Session.self, from: data); adopt(s)
        guard let user = s.user else { throw AppError(message: "That code does not match.") }
        return user
    }

    // MARK: OAuth (Google / Apple) — PKCE through InsForge
    static let oauthScheme = "together-swift"
    private struct PublicConfig: Decodable { var oAuthProviders: [String]? }
    private struct AuthURL: Decodable { var authUrl: String }
    func oauthProviders() async -> [String] {
        guard let data = try? await request("GET", "/api/auth/public-config") else { return [] }
        return (try? JSONDecoder().decode(PublicConfig.self, from: data))?.oAuthProviders ?? []
    }
    private static func b64url(_ d: Data) -> String { d.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") }
    /// Returns the provider's sign-in URL and the PKCE verifier to exchange the code with.
    func startOAuth(provider: String) async throws -> (url: URL, verifier: String) {
        var bytes = [UInt8](repeating: 0, count: 32); _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        let verifier = Self.b64url(Data(bytes))
        let challenge = Self.b64url(Data(SHA256.hash(data: Data(verifier.utf8))))
        let redirect = "\(Self.oauthScheme)://auth".addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? ""
        let data = try await request("GET", "/api/auth/oauth/\(provider)?redirect_uri=\(redirect)&code_challenge=\(challenge)")
        guard let url = URL(string: try JSONDecoder().decode(AuthURL.self, from: data).authUrl) else { throw AppError(message: "Could not start sign-in.") }
        return (url, verifier)
    }
    func exchangeOAuth(code: String, verifier: String) async throws -> RemoteUser {
        let data = try await request("POST", "/api/auth/oauth/exchange?client_type=mobile", json: ["code": code, "code_verifier": verifier])
        let s = try JSONDecoder().decode(Session.self, from: data); adopt(s)
        guard let user = s.user else { throw AppError(message: "Could not finish sign-in.") }
        return user
    }

    func signOut() async {
        if accessToken != nil { _ = try? await request("POST", "/api/auth/logout?client_type=mobile", auth: true) }
        accessToken = nil; Secure.delete(refreshKey)
    }

    struct ConnectionRow: Codable {
        var user_id: String
        var schema_version: Int
        var answers: [String:String]
        var completed: Bool
        var updated_at: String?
    }
    func saveConnectionPreferences(userID: String, value: ConnectionPreferences) async throws {
        try await ensureSession()
        let row = ConnectionRow(user_id: userID, schema_version: value.version, answers: value.answers, completed: value.completed)
        let json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(row))
        _ = try await request("POST", "/api/database/records/connection_preferences", json: [json], auth: true, headers: ["Prefer": "resolution=merge-duplicates,return=minimal"])
    }
    func fetchConnectionPreferences(userID: String) async throws -> ConnectionPreferences? {
        try await ensureSession()
        let data = try await request("GET", "/api/database/records/connection_preferences?user_id=eq.\(userID)&select=user_id,schema_version,answers,completed,updated_at&limit=1", auth: true)
        return try JSONDecoder().decode([ConnectionRow].self, from: data).first.map { ConnectionPreferences(version: $0.schema_version, answers: $0.answers, completed: $0.completed, updatedAt: $0.updated_at ?? "") }
    }

    // MARK: Profile + photo
    func uploadAvatar(userID: String, file: URL) async throws -> (url: String, key: String) {
        try await ensureSession()
        let image = try Data(contentsOf: file)
        let ext = file.pathExtension.isEmpty ? "jpg" : file.pathExtension.lowercased()
        let mime = ext == "png" ? "image/png" : ext == "heic" ? "image/heic" : "image/jpeg"
        let key = "\(userID)/avatar-\(Int(Date().timeIntervalSince1970 * 1000)).\(ext)"
        let boundary = "Boundary-\(UUID().uuidString)"
        var body = Data()
        body.append("--\(boundary)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"avatar.\(ext)\"\r\nContent-Type: \(mime)\r\n\r\n".data(using: .utf8)!)
        body.append(image); body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        let encoded = key.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-._~"))) ?? key
        let data = try await request("PUT", "/api/storage/buckets/avatars/objects/\(encoded)", auth: true, headers: ["Content-Type": "multipart/form-data; boundary=\(boundary)"], body: body)
        let stored = try JSONDecoder().decode(StoredObject.self, from: data)
        return (stored.url, stored.key)
    }
    func removeAvatar(key: String) async {
        let encoded = key.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-._~"))) ?? key
        _ = try? await request("DELETE", "/api/storage/buckets/avatars/objects/\(encoded)", auth: true)
    }
    func fetchProfile(id: String) async throws -> RemoteProfile? {
        try await ensureSession()
        let data = try await request("GET", "/api/database/records/profiles?id=eq.\(id)&select=id,first_name,pronouns,timezone,avatar_url,avatar_key", auth: true)
        return try JSONDecoder().decode([RemoteProfile].self, from: data).first
    }
    /// Insert-or-update the caller's own row (RLS allows only `id = auth.uid()`).
    func upsertProfile(_ profile: RemoteProfile) async throws {
        try await ensureSession()
        var row = try JSONSerialization.jsonObject(with: JSONEncoder().encode(profile)) as! [String: Any]
        row["updated_at"] = ISO8601DateFormatter().string(from: Date())
        if profile.avatar_url == nil { row["avatar_url"] = NSNull(); row["avatar_key"] = NSNull() }
        _ = try await request("POST", "/api/database/records/profiles", json: [row], auth: true, headers: ["Prefer": "resolution=merge-duplicates,return=minimal"])
    }
}

/// Presents the system's secure sign-in sheet and returns the callback URL (nil if the person cancels).
@MainActor final class OAuthSheet: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = OAuthSheet()
    private var session: ASWebAuthenticationSession?
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? ASPresentationAnchor()
    }
    func open(_ url: URL) async throws -> URL? {
        try await withCheckedThrowingContinuation { cont in
            let s = ASWebAuthenticationSession(url: url, callbackURLScheme: InsForge.oauthScheme) { callback, error in
                if let e = error as? ASWebAuthenticationSessionError, e.code == .canceledLogin { cont.resume(returning: nil); return }
                if let error { cont.resume(throwing: error); return }
                cont.resume(returning: callback)
            }
            s.presentationContextProvider = self
            session = s
            s.start()
        }
    }
}
