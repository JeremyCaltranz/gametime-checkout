import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Overrides } from "./overrides";
import type { CheckoutPhase } from "../machine";

export function DevMenu({
  visible,
  phase,
  overrides,
  pendingKey,
  ledgerCount,
  onClose,
  onChange,
  onClearPending,
  onClearLedger,
}: {
  visible: boolean;
  phase: CheckoutPhase;
  overrides: Overrides;
  pendingKey: string | null;
  ledgerCount: number;
  onClose: () => void;
  onChange: (next: Overrides) => void;
  onClearPending: () => void;
  onClearLedger: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.screen,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Review tools</Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.note}>
            Overrides sit on top of real detection. Auto uses this device. Wallet Auto means a
            card is provisioned on the effective platform. The stub cannot call the real wallet.
          </Text>
          <Choices
            label="Platform"
            value={overrides.platform}
            options={[
              ["auto", "Auto"],
              ["ios", "iOS"],
              ["android", "Android"],
            ]}
            onChange={(platform) => onChange({ ...overrides, platform })}
          />
          <Choices
            label="Wallet"
            value={overrides.wallet}
            options={[
              ["auto", "Auto"],
              ["yes", "Yes"],
              ["no", "No"],
            ]}
            onChange={(wallet) => onChange({ ...overrides, wallet })}
          />
          <Choices
            label="Next payment"
            value={overrides.nextPayment}
            options={[
              ["normal", "Normal"],
              ["decline", "Decline"],
              ["drop", "Commit and drop"],
            ]}
            onChange={(nextPayment) => onChange({ ...overrides, nextPayment })}
          />
          <Text style={styles.meta}>Phase: {phase}</Text>
          <Text style={styles.meta}>Charges recorded: {ledgerCount}</Text>
          <Text style={styles.meta}>Pending key: {pendingKey ?? "none"}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClearPending}
            style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
          >
            <Text style={styles.actionText}>Clear pending intent</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onClearLedger}
            style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
          >
            <Text style={styles.actionText}>Clear ledger</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Choices<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choices}>
        {options.map(([option, title]) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option)}
              style={[styles.choice, selected ? styles.choiceOn : null]}
            >
              <Text style={[styles.choiceText, selected ? styles.choiceTextOn : null]}>{title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#F3F0E8",
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: {
    color: "#161513",
    fontSize: 22,
    fontWeight: "700",
  },
  done: {
    color: "#161513",
    fontSize: 17,
    fontWeight: "600",
  },
  body: {
    gap: 16,
    padding: 20,
  },
  note: {
    color: "#5C564E",
    fontSize: 14,
    lineHeight: 20,
  },
  group: {
    gap: 8,
  },
  label: {
    color: "#161513",
    fontSize: 15,
    fontWeight: "600",
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choice: {
    borderColor: "#D9D3C7",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  choiceOn: {
    backgroundColor: "#161513",
    borderColor: "#161513",
  },
  choiceText: {
    color: "#161513",
    fontSize: 15,
  },
  choiceTextOn: {
    color: "#FFFFFF",
  },
  meta: {
    color: "#161513",
    fontSize: 14,
  },
  action: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D9D3C7",
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center",
  },
  actionText: {
    color: "#161513",
    fontSize: 16,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.8,
  },
});
