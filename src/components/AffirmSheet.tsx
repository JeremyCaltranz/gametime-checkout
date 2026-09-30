import { useRef } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { formatUsd } from "../eligibility";

export function AffirmSheet({
  amountCents,
  onApprove,
  onCancel,
}: {
  amountCents: number;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const settled = useRef(false);
  const insets = useSafeAreaInsets();

  function finish(action: "approve" | "cancel") {
    if (settled.current) return;
    settled.current = true;
    if (action === "approve") onApprove();
    else onCancel();
  }

  function onMessage(event: WebViewMessageEvent) {
    if (event.nativeEvent.data === "approve") finish("approve");
    if (event.nativeEvent.data === "cancel") finish("cancel");
  }

  return (
    <Modal
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      visible
      onRequestClose={() => finish("cancel")}
    >
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.bar}>
          <Text style={styles.barTitle}>Affirm</Text>
          <Text style={styles.barCopy}>Simulated hosted page. Leave and come back, then approve.</Text>
        </View>
        <WebView
          originWhitelist={["*"]}
          source={{ html: affirmHtml(formatUsd(amountCents)) }}
          onMessage={onMessage}
          setSupportMultipleWindows={false}
          style={styles.web}
        />
      </View>
    </Modal>
  );
}

function affirmHtml(amount: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 24px; color: #161513; }
      h1 { font-size: 22px; margin: 0 0 8px; }
      p { color: #5c564e; line-height: 1.45; }
      button { display: block; width: 100%; margin-top: 12px; padding: 14px 16px; font-size: 16px; border-radius: 12px; }
      .approve { background: #161513; color: white; border: 0; }
      .cancel { background: white; color: #161513; border: 1px solid #d9d3c7; }
    </style>
  </head>
  <body>
    <h1>Pay ${amount} over time</h1>
    <p>This stands in for Affirm's hosted page. Approving completes the purchase. Canceling charges nothing.</p>
    <button class="approve" onclick="window.ReactNativeWebView.postMessage('approve')">Approve</button>
    <button class="cancel" onclick="window.ReactNativeWebView.postMessage('cancel')">Cancel</button>
  </body>
</html>`;
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
  bar: {
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  barTitle: {
    color: "#161513",
    fontSize: 18,
    fontWeight: "700",
  },
  barCopy: {
    color: "#6B655C",
    fontSize: 14,
  },
  web: {
    flex: 1,
  },
});
