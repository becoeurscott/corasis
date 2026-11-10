import WidgetKit
import SwiftUI

@main
struct TogetherWidgetBundle: WidgetBundle {
    var body: some Widget {
        FlameWidget()
        MessageWidget()
        ComboWidget()
    }
}
