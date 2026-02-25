import Foundation

// MARK: - Speechless BFF Client for visionOS

/// Usage:
///   let client = SpeechlessClient(baseURL: "https://speechless-tau.vercel.app")
///   let result = try await client.processContext(image: screenshotData, text: "これを英語に翻訳して")
///   print(result) // → translated text

struct SpeechlessClient {
    let baseURL: String

    struct Request: Encodable {
        let image: String  // Base64-encoded screenshot
        let text: String   // Voice input text
    }

    struct Response: Decodable {
        let result: String?
        let error: String?
    }

    /// Send a screenshot + voice text to the BFF and get the generated text back.
    /// - Parameters:
    ///   - image: Raw image data (PNG/JPEG) from the screenshot capture
    ///   - text: Transcribed speech text from the user
    /// - Returns: The generated text result from OpenAI
    func processContext(image: Data, text: String) async throws -> String {
        let base64Image = image.base64EncodedString()

        guard let url = URL(string: "\(baseURL)/api/process-context") else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30

        let body = Request(image: base64Image, text: text)
        request.httpBody = try JSONEncoder().encode(body)

        let (data, httpResponse) = try await URLSession.shared.data(for: request)

        guard let statusCode = (httpResponse as? HTTPURLResponse)?.statusCode else {
            throw URLError(.badServerResponse)
        }

        let decoded = try JSONDecoder().decode(Response.self, from: data)

        if statusCode != 200 {
            throw NSError(
                domain: "SpeechlessClient",
                code: statusCode,
                userInfo: [NSLocalizedDescriptionKey: decoded.error ?? "Unknown error"]
            )
        }

        guard let result = decoded.result else {
            throw NSError(
                domain: "SpeechlessClient",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "Empty result from server"]
            )
        }

        return result
    }
}

// MARK: - Example: Capture screenshot on visionOS and call BFF
//
// import ARKit
// import RealityKit
//
// @MainActor
// func handleVoiceCommand(text: String) async {
//     // 1. Capture the user's current view as an image
//     guard let window = UIApplication.shared.connectedScenes
//         .compactMap({ $0 as? UIWindowScene }).first?.windows.first,
//         let screenshot = window.captureScreenshot() else { return }
//
//     guard let pngData = screenshot.pngData() else { return }
//
//     // 2. Send to Speechless BFF
//     let client = SpeechlessClient(baseURL: "https://speechless-tau.vercel.app")
//     do {
//         let result = try await client.processContext(image: pngData, text: text)
//         // 3. Use the result (paste into text field, show in UI, etc.)
//         print("Speechless result: \(result)")
//     } catch {
//         print("Speechless error: \(error)")
//     }
// }
