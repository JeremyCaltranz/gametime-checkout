import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  type KeyboardEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type TextInput,
  type View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FIELD_SCROLL_GAP, offsetToRevealForm } from "./focusedFieldScroll";

function keyboardTop(event: KeyboardEvent, bottomInset: number): number {
  const windowHeight = Dimensions.get("window").height;
  const reported = event.endCoordinates.screenY;
  const inferred =
    Platform.OS === "android"
      ? windowHeight - event.endCoordinates.height - bottomInset
      : windowHeight - event.endCoordinates.height;
  if (reported > 0 && reported < windowHeight) return Math.min(reported, inferred);
  return Math.max(0, inferred);
}

export function useFocusedFieldScroll() {
  const scrollRef = useRef<ScrollView>(null);
  const viewportRef = useRef<View>(null);
  const contentRef = useRef<View>(null);
  const fieldRef = useRef<TextInput | null>(null);
  const formRef = useRef<View | null>(null);
  const scrollOffset = useRef(0);
  const viewportHeight = useRef(0);
  const keyboardTopRef = useRef(0);
  const overlapRef = useRef(0);
  const scrollGeneration = useRef(0);
  const bottomInset = useSafeAreaInsets().bottom;
  const bottomInsetRef = useRef(bottomInset);
  bottomInsetRef.current = bottomInset;
  const [keyboardInset, setKeyboardInset] = useState(0);

  function scrollFocusedIntoView() {
    const field = fieldRef.current;
    const form = formRef.current;
    const content = contentRef.current;
    const overlap = overlapRef.current;
    const visibleHeight = viewportHeight.current - overlap;
    if (!field || !form || !content || keyboardTopRef.current <= 0 || visibleHeight <= 0) return;

    form.measureLayout(
      content,
      (_formX, formY, _formWidth, formHeight) => {
        field.measureLayout(
          content,
          (_fieldX, fieldY, _fieldWidth, fieldHeight) => {
            const target = offsetToRevealForm(
              scrollOffset.current,
              visibleHeight,
              fieldY,
              fieldHeight,
              formY,
              formHeight,
            );
            if (Math.abs(target - scrollOffset.current) <= 1) return;
            scrollRef.current?.scrollTo({ y: target, animated: true });
          },
          () => {},
        );
      },
      () => {},
    );
  }

  useEffect(() => {
    if (Platform.OS === "web") return;

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";

    const show = Keyboard.addListener(showEvent, (event) => {
      keyboardTopRef.current = keyboardTop(event, bottomInsetRef.current);
      viewportRef.current?.measureInWindow((_x, y, _width, height) => {
        viewportHeight.current = height;
        const overlap = Math.max(0, y + height - keyboardTopRef.current);
        overlapRef.current = overlap;
        setKeyboardInset(overlap > 0 ? Math.ceil(overlap + FIELD_SCROLL_GAP) : 0);
        scheduleScroll();
      });
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardTopRef.current = 0;
      overlapRef.current = 0;
      setKeyboardInset(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  function onViewportLayout(event: LayoutChangeEvent) {
    viewportHeight.current = event.nativeEvent.layout.height;
  }

  function scheduleScroll() {
    const generation = ++scrollGeneration.current;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (generation !== scrollGeneration.current) return;
        scrollFocusedIntoView();
      });
    });
  }

  function onContentLayout() {
    if (keyboardTopRef.current <= 0) return;
    scheduleScroll();
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
  }

  function onFieldFocus(field: TextInput, form: View) {
    fieldRef.current = field;
    formRef.current = form;
    if (keyboardTopRef.current > 0) scheduleScroll();
  }

  return {
    scrollRef,
    viewportRef,
    contentRef,
    keyboardInset,
    onViewportLayout,
    onContentLayout,
    onScroll,
    onFieldFocus,
  };
}
