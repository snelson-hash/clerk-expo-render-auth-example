import React, { useState } from "react";
import { Button, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ClerkProvider, useAuth, useClerk, useSignIn } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardProvider } from "react-native-keyboard-controller";
import { requestProtected } from "./request";

function Repro() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const { signIn } = useSignIn();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const trust = signIn?.status === "needs_client_trust";

  async function perform(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await operation(); }
    catch { setStatus("Operation failed"); }
    finally { setBusy(false); }
  }
  async function finish() {
    if (signIn?.status === "complete") {
      await signIn.finalize({ navigate: () => {} });
      setPassword(""); setEmail(""); setCode(""); setStatus("Signed in");
    } else if (signIn?.status === "needs_client_trust") {
      setStatus("Email verification required");
    } else {
      setStatus("Another sign-in step is required; see reproduction limitations");
    }
  }
  return (
    <KeyboardAwareScrollView
      bottomOffset={24} keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, {
        paddingTop: Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top + 20,
        paddingBottom: Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom + 20,
      }]}
    >
      <Text accessibilityRole="header" style={styles.heading}>Clerk Bearer reproduction</Text>
      {!isLoaded ? <Text>Loading session</Text> : !isSignedIn ? (
        <View style={styles.group}>
          <TextInput testID="email" accessibilityLabel="Email" placeholder="Email"
            autoCapitalize="none" keyboardType="email-address" autoComplete="email"
            value={email} onChangeText={setEmail} style={styles.input} />
          <TextInput testID="password" accessibilityLabel="Password" placeholder="Password"
            secureTextEntry autoComplete="current-password"
            value={password} onChangeText={setPassword} style={styles.input} />
          <Button title="Sign in" disabled={busy || !signIn}
            onPress={() => void perform(async () => {
              const result = await signIn!.password({ emailAddress: email.trim(), password });
              if (result.error) { setStatus("Sign-in failed"); return; }
              await finish();
            })} />
          {trust ? <>
            <Button title="Send verification email" disabled={busy}
              onPress={() => void perform(async () => {
                const result = await signIn!.mfa.sendEmailCode();
                setStatus(result.error ? "Code send failed" : "Code sent");
              })} />
            <TextInput accessibilityLabel="Verification code" value={code} onChangeText={setCode}
              keyboardType="number-pad" style={styles.input} />
            <Button title="Verify code" disabled={busy}
              onPress={() => void perform(async () => {
                const result = await signIn!.mfa.verifyEmailCode({ code: code.trim() });
                if (result.error) { setStatus("Verification failed"); return; }
                await finish();
              })} />
          </> : null}
        </View>
      ) : (
        <View style={styles.group}>
          <Text>Signed in. No identity is displayed.</Text>
          <Button title="Call protected API" disabled={busy}
            onPress={() => void perform(async () => {
              setStatus(await requestProtected(() => getToken(), process.env.EXPO_PUBLIC_DOMAIN!));
            })} />
          <Button title="Sign out" disabled={busy}
            onPress={() => void perform(async () => {
              await signOut(); setEmail(""); setPassword(""); setCode(""); setStatus("Signed out");
            })} />
        </View>
      )}
      <Text accessibilityLiveRegion="polite">{status}</Text>
    </KeyboardAwareScrollView>
  );
}
export default function App() {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!key || !domain) return <ScrollView><Text>Configure the two mobile environment variables first.</Text></ScrollView>;
  return (
    <ClerkProvider publishableKey={key} tokenCache={tokenCache}>
      <SafeAreaProvider><KeyboardProvider><Repro /></KeyboardProvider></SafeAreaProvider>
    </ClerkProvider>
  );
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 20 },
  heading: { fontSize: 24, fontWeight: "600" },
  group: { gap: 16 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, padding: 12 },
});
