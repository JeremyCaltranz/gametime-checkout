import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  brandLabel,
  cvcError,
  cvcLength,
  detectBrand,
  digitsOnly,
  expiryError,
  formatCvc,
  formatExpiry,
  formatPan,
  isCardValid,
  panError,
  panLength,
  tokenizeCard,
} from "../card";

export function CardForm({
  disabled,
  payLabel,
  onPay,
  onFieldFocus,
}: {
  disabled: boolean;
  payLabel: string;
  onPay: (token: string) => void;
  onFieldFocus?: (field: TextInput, form: View) => void;
}) {
  const [pan, setPan] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [touched, setTouched] = useState({ pan: false, expiry: false, cvc: false });
  const formRef = useRef<View>(null);
  const panRef = useRef<TextInput>(null);
  const expiryRef = useRef<TextInput>(null);
  const cvcRef = useRef<TextInput>(null);
  const now = new Date();
  const brand = detectBrand(pan);
  const valid = isCardValid(pan, expiry, cvc, now);
  const panMessage = touched.pan ? panError(pan) : null;
  const expiryMessage = touched.expiry ? expiryError(expiry, now) : null;
  const cvcMessage = touched.cvc ? cvcError(cvc, brand) : null;
  const label = brandLabel(brand);

  function touch(field: keyof typeof touched) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function reportFocus(field: TextInput | null) {
    if (field && formRef.current) onFieldFocus?.(field, formRef.current);
  }

  return (
    <View ref={formRef} collapsable={false} style={styles.form}>
      <View style={styles.labelRow}>
        <Text style={styles.section}>Pay with card</Text>
        {label ? <Text style={styles.brand}>{label}</Text> : null}
      </View>
      <TextInput
        ref={panRef}
        value={pan}
        onFocus={() => reportFocus(panRef.current)}
        onChangeText={(text) => {
          const next = formatPan(text);
          const nextBrand = detectBrand(next);
          const previousLength = digitsOnly(pan).length;
          setPan(next);
          setCvc((current) => formatCvc(current, nextBrand));
          if (
            digitsOnly(next).length === panLength(nextBrand) &&
            digitsOnly(next).length > previousLength
          ) {
            expiryRef.current?.focus();
          }
        }}
        onBlur={() => touch("pan")}
        editable={!disabled}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="creditCardNumber"
        autoComplete="cc-number"
        importantForAutofill="yes"
        autoCorrect={false}
        spellCheck={false}
        placeholder="Card number"
        placeholderTextColor="#8A8378"
        maxLength={brand === "amex" ? 17 : 19}
        accessibilityLabel="Card number"
        style={[styles.input, panMessage ? styles.inputError : null]}
      />
      {panMessage ? <Text style={styles.error}>{panMessage}</Text> : null}
      <View style={styles.row}>
        <View style={styles.half}>
          <TextInput
            ref={expiryRef}
            value={expiry}
            onFocus={() => reportFocus(expiryRef.current)}
            onChangeText={(text) => {
              const next = formatExpiry(text);
              const previous = expiry.length;
              setExpiry(next);
              if (next.length === 5 && next.length > previous) cvcRef.current?.focus();
            }}
            onBlur={() => touch("expiry")}
            editable={!disabled}
            keyboardType="number-pad"
            inputMode="numeric"
            textContentType="creditCardExpiration"
            autoComplete="cc-exp"
            importantForAutofill="yes"
            autoCorrect={false}
            placeholder="MM/YY"
            placeholderTextColor="#8A8378"
            maxLength={5}
            accessibilityLabel="Expiration date"
            style={[styles.input, expiryMessage ? styles.inputError : null]}
          />
          {expiryMessage ? <Text style={styles.error}>{expiryMessage}</Text> : null}
        </View>
        <View style={styles.half}>
          <TextInput
            ref={cvcRef}
            value={cvc}
            onFocus={() => reportFocus(cvcRef.current)}
            onChangeText={(text) => {
              const next = formatCvc(text, brand);
              setCvc(next);
              if (next.length === cvcLength(brand)) cvcRef.current?.blur();
            }}
            onBlur={() => touch("cvc")}
            editable={!disabled}
            keyboardType="number-pad"
            inputMode="numeric"
            textContentType="creditCardSecurityCode"
            autoComplete="cc-csc"
            importantForAutofill="yes"
            autoCorrect={false}
            placeholder={brand === "amex" ? "1234" : "123"}
            placeholderTextColor="#8A8378"
            maxLength={cvcLength(brand)}
            accessibilityLabel="Security code"
            style={[styles.input, cvcMessage ? styles.inputError : null]}
          />
          {cvcMessage ? <Text style={styles.error}>{cvcMessage}</Text> : null}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || !valid }}
        disabled={disabled || !valid}
        onPress={() => {
          if (disabled || !isCardValid(pan, expiry, cvc, new Date())) return;
          onPay(tokenizeCard(pan));
        }}
        style={({ pressed }) => [
          styles.pay,
          disabled || !valid ? styles.payDisabled : null,
          pressed && !disabled && valid ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.payText, disabled || !valid ? styles.payTextDisabled : null]}>
          {payLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 4,
  },
  section: {
    color: "#161513",
    fontSize: 16,
    fontWeight: "600",
  },
  brand: {
    color: "#6B655C",
    fontSize: 14,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D9D3C7",
    borderRadius: 12,
    borderWidth: 1,
    color: "#161513",
    fontSize: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  inputError: {
    borderColor: "#8C2F2F",
  },
  error: {
    color: "#8C2F2F",
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  half: {
    flex: 1,
    gap: 8,
  },
  pay: {
    alignItems: "center",
    backgroundColor: "#161513",
    borderRadius: 12,
    marginTop: 8,
    minHeight: 52,
    justifyContent: "center",
  },
  payDisabled: {
    backgroundColor: "#D9D3C7",
  },
  payText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  payTextDisabled: {
    color: "#6B655C",
  },
  pressed: {
    opacity: 0.85,
  },
});
