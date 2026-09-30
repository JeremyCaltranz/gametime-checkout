# Gametime checkout

A React Native checkout screen. The fan already has seats. This screen decides which ways they can pay, takes a card or an express payment, and keeps a single charge if the app is backgrounded or killed mid-request.

Apple Pay, Google Pay, and Affirm. They mimic a capability check, a wallet sheet, or a hosted page.

## Run it

```bash
git clone <repo-url>
cd <repo>
npm install
npm test
npm start
```
Node must be 20.19.4+, 22.13+, 24.3+, or 25+. React Native 0.86 does not support Node 23. This repo pins Node 22 in `.nvmrc`.

`npm test` needs no simulator. `npm start` opens Expo. Press `i` for the iOS Simulator, `a` for an Android emulator, or scan the QR code with Expo Go. `npm run ios` and `npm run android` are the same shortcuts.

Tested on the iOS Simulator with Expo Go. Android physical device was also tested.

## Eligibility

`getEligibleMethods` is a pure function. Card is always included.

- Apple Pay when the effective platform is iOS and a wallet card is provisioned
- Google Pay when the effective platform is Android and Google Pay is ready
- Affirm when the total is greater than `$100.00`
  
Open **Review tools** (dev builds only). Overrides are saved and layered on top of detection:

- Platform: Auto, iOS, or Android
- Wallet: Auto, Yes, or No. Auto means provisioned on the effective platform. Forcing Android on an iOS simulator shows Google Pay, not Apple Pay
- Next payment: Normal, Decline, or Commit and drop. Decline and drop apply to one charge, then clear
- The menu shows the phase, the pending idempotency key, and how many charges are in the ledger

A "Simulated environment" line appears whenever platform or wallet is not Auto.

The `$100.00` boundary is covered by `npm test`. The running app crosses it with the quantity stepper.

## Mock API

The screen talks to `src/payments/client.ts`. That module only sends a method, a path, headers, and a JSON body, and it gets a status code back. `src/payments/mockServer.ts` is the only implementation. It does not import React Native or AsyncStorage. Tests inject a `Map`. The app injects AsyncStorage. The ledger is read from that store on every request, so a force-quit does not forget a charge that was already saved.

`POST /v1/payments`

- Header `Idempotency-Key`
- Body `{ amountCents, currency: "usd", method, token }`
- `200` `{ id, status: "succeeded", amountCents, method }`
- `402` `{ status: "declined", code: "card_declined", message }` when the token was declined, or when the one-shot decline flag is set
- The same key and the same body return the stored status and the same `id`, including a stored decline
- The same key and a different body return `422` `{ code: "idempotency_key_reused" }`

`GET /v1/payments?idempotencyKey=`

- `200` with the stored charge
- `404` `{ code: "not_found" }` when nothing was committed

The idempotency key is a header because that matches how a real charge API treats retries: the key is not part of the purchase, and reusing it with a different purchase is a client bug, not a second charge.

A `402` is a finished result and is stored. A dropped response is not a result the client can see. The client does not `POST` again. It calls `GET`. Launch with a pending key also calls `GET` only.

The card number never reaches the API. The form turns it into `tok_visa_4242_ok` or `tok_visa_0002_declined` first. `4242 4242 4242 4242` succeeds. `4000 0000 0000 0002` is a valid card that the mock declines. Express approvals use `tok_apple_pay`, `tok_google_pay`, or `tok_affirm`.

The total is whatever the screen displayed. A production charge would be priced by the server. "Commit and drop" stores a success and then withholds the response, so the kill-and-relaunch demo does not depend on which card was typed.

## From tap to confirmed

Express methods have no second submit. Tapping Apple Pay, Google Pay, or Affirm opens that flow immediately.

1. Mint an idempotency key and save `{ key, amountCents, method }` before any request. The card number and the token are not saved.
2. Apple Pay and Google Pay open a sheet. Affirm opens an in-memory WebView that stands in for the hosted page. Cancel closes it and charges nothing.
3. Approval moves to "Processing payment" and `POST`s the token.
4. Card is the other path. Pay stays disabled until the number, expiry, and CVC are valid. Formatting happens on each change, including paste and autofill. Errors show on blur, so a valid autofill does not flash red. Pay checks validity again, tokenizes, then uses the same `POST`.
5. `200` shows the confirmation and clears the pending key. `402` shows "Payment was declined." Try again mints a new key.

Backgrounding the sheet or the Affirm page leaves the phase on `authorizing`. Coming back shows the same sheet, because it is mounted from that phase. `AppState` `inactive` is ignored. That is the transition iOS uses for a biometric prompt.

If the response is dropped, or the app is killed after the server stored the charge, the next launch shows "Checking your payment", `GET`s the saved key, and shows the stored success or decline. It does not `POST`. If the server never stored a charge, the screen returns to checkout with "No charge was made."

A `GET` that misses while the original request is still in flight stays on "Processing payment". A miss after the request has failed means nothing was charged.

The ledger count in Review tools is the check that a replay or a relaunch did not create a second row.

## Try this

1. `npm test`, then launch. Apple Pay is visible. Affirm is not.
2. Increase quantity. Affirm appears. Decrease it. Affirm goes away.
3. Pay with `4242 4242 4242 4242`. Confirmation. Ledger count is 1.
4. New order. Pay with `4000 0000 0000 0002`. Decline. Try again. The next attempt uses a new key.
5. Open Apple Pay. Cancel. No error, and the ledger is unchanged. Open it again and pay. One new ledger row.
6. Set quantity to 2. Open Affirm. Background the app. Come back. Approve. One charge.
7. In Review tools, set Next payment to "Commit and drop", then pay. The screen goes to "Checking your payment" and lands on success. The ledger grew by one. To do it the other way, force-quit while it says "Processing payment" and reopen. The app confirms the same charge and does not create another.

Force-quitting during the short processing state of a normal payment can show "No charge was made." That is the request dying before the server committed. Use "Commit and drop" for the case where the charge landed and the response did not.

## Tradeoffs

- The mock is in-process so a reviewer runs one command. The boundary is still the client: the UI cannot see the ledger except through `POST` and `GET`.
- The order total is computed on the device. The server trusts `amountCents`.
- The wallet stub defaults to provisioned. Overrides cover the empty-wallet case, because Expo Go cannot ask the real wallet.
- Affirm is a WebView with local HTML, not a browser redirect and a custom URL scheme. That scheme is unreliable in Expo Go, and the brief allows a WebView.
- Field errors wait for blur. The Pay button uses live validity, so autofill can enable it without a red flash.
- `react-native-safe-area-context` is included because React Native 0.86 deprecates its own `SafeAreaView`.

## With more time

Move `mockServer` behind real HTTP without changing `client.ts`. Price the order on the server. Call real `canMakePayments` from a dev build. Add 3-D Secure as another status the same reconcile path already knows how to wait on.
