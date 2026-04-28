# App Encryption Documentation

## Important Note

This document is a technical summary of the app's encryption behavior for App Store Connect and internal compliance review.

It may help support an App Store Connect upload, but Apple may still require a specific French encryption declaration form or other jurisdiction-specific documentation rather than a generic technical memo.

## App Information

- App name: Musclog - Lift, Log, Repeat
- Bundle identifier: `com.werules.logger`
- Platform: iOS

## Summary

The app implements industry-standard symmetric encryption in application code in addition to using Apple platform security features.

Specifically:

- The app uses AES encryption through the `crypto-js` library.
- The app stores encryption keys using `expo-secure-store`.
- The encrypted data is used for local protection of sensitive user data at rest.
- The app does not implement proprietary or non-standard cryptographic algorithms.

## Encryption Used

- Algorithm family: AES
- Implementation: `crypto-js`
- Key generation: random key material generated in app code
- Key storage: `expo-secure-store`
- Encryption purpose: local encryption of sensitive app data at rest and optional encrypted database export

## What Is Encrypted

The app encrypts sensitive local data, including:

- Nutrition log snapshots
- User metric values
- Selected string and JSON payloads associated with sensitive records
- Optional exported database backups when the user supplies an encryption phrase
- Stored API keys and similar sensitive settings

## How It Is Implemented

### AES encryption and decryption

Application-level AES encryption is implemented in:

- `utils/encryption.ts`

Relevant behaviors:

- imports `crypto-js`
- generates random key material
- encrypts values with `CryptoJS.AES.encrypt(...)`
- decrypts values with `CryptoJS.AES.decrypt(...)`

### Key storage

Secure storage of encryption keys is implemented in:

- `utils/encryptionKeyStorage.ts`

Relevant behaviors:

- reads keys from `expo-secure-store`
- writes keys with `SecureStore.setItemAsync(...)`
- migrates legacy values from AsyncStorage to SecureStore

### Database field encryption helpers

Helpers for encrypting sensitive database fields are implemented in:

- `database/encryptionHelpers.ts`

Relevant behaviors:

- encrypts strings, numbers, dates, and JSON payloads
- encrypts nutrition log snapshot fields
- encrypts user metric fields

## Third-Party Libraries Involved

The project includes the following relevant packages:

- `crypto-js`
- `expo-secure-store`

These are declared in:

- `package.json`

## Compliance Characterization

Based on the current implementation, the app:

- does use standard encryption algorithms
- does not use proprietary or unpublished cryptographic algorithms
- does use encryption in addition to Apple operating system security features

For the App Store Connect questionnaire, this corresponds to:

- `Standard encryption algorithms instead of, or in addition to, using or accessing the encryption within Apple's operating system`

## Code References

Primary code references reviewed for this summary:

- `utils/encryption.ts`
- `utils/encryptionKeyStorage.ts`
- `database/encryptionHelpers.ts`
- `package.json`
- `app.json`
- `ios/MusclogLiftLogRepeat/Info.plist`
