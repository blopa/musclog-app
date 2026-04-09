# Musclog Security & Bug Audit Report
**Date:** May 2024
**Auditor:** Jules (AI Senior Software Engineer)

---

## Executive Summary

This report documents the findings of a comprehensive security and bug audit of the Musclog codebase. The audit identified several critical and high-severity security vulnerabilities, primarily related to insecure data storage and sensitive information handling. While the application employs encryption for some user data, the implementation has significant gaps that undermine its effectiveness.

---

## 1. Critical Vulnerabilities

### 1.1 Plaintext API Keys in Local Database
- **Severity:** Critical
- **Description:** The application allows users to configure Google Gemini and OpenAI API keys. These keys are stored in the `settings` table of the WatermelonDB (SQLite) database.
- **Vulnerability:** The values are stored as plaintext strings.
- **Impact:** Any attacker or malicious application with access to the device's file system can read the SQLite database file and extract the user's private API keys. This could lead to unauthorized use of the user's AI quotas and potential financial costs.
- **Location:** `context/SettingsContext.tsx`, `database/services/SettingsService.ts`
- **Recommendation:** Encrypt API keys before storing them in the database, similar to how nutrition logs are handled.

---

## 2. High-Severity Vulnerabilities

### 2.1 Insecure Storage of Encryption Keys
- **Severity:** High
- **Description:** The app uses a master encryption key to secure "sensitive" database fields (AES encryption).
- **Vulnerability:** This master key is generated and then stored in `AsyncStorage`.
- **Impact:** On both Android and iOS, `AsyncStorage` is not a secure storage mechanism. It is essentially a plaintext file on the device. An attacker who gains access to the device can retrieve the encryption key and then decrypt all "secure" data in the database.
- **Location:** `utils/encryption.ts`
- **Recommendation:** Use `expo-secure-store` or a similar keychain/keystore-backed library to store encryption keys and other sensitive tokens.

### 2.2 Insecure Data Export (Decrypted Backup)
- **Severity:** High
- **Description:** The `dumpDatabase` function creates a full backup of the database in JSON format.
- **Vulnerability:** By default, it decrypts all sensitive fields (nutrition logs, user metrics) so the backup is "device-independent." While it offers an optional encryption phrase, if the user doesn't provide one, the exported file contains their entire health and nutrition history in plaintext.
- **Impact:** Users often share or store backups in insecure locations (cloud storage, email). A plaintext backup exposes highly sensitive personal health data.
- **Location:** `database/exportImport.ts`
- **Recommendation:** Force encryption of backups or provide a much stronger warning to the user. Additionally, ensure that if an encryption phrase is used, the key derivation is robust (e.g., using PBKDF2).

---

## 3. Moderate & Low-Severity Findings

### 3.1 Vulnerable Dependencies
- **Severity:** Moderate
- **Description:** `npm audit` identified 14 vulnerabilities, including 7 high-severity issues.
- **Key Vulnerabilities:**
    - `xlsx`: Prototype Pollution (High)
    - `@xmldom/xmldom`: XML Injection (High)
    - `node-forge`: ASN.1 Unbounded Recursion (High)
- **Impact:** Depending on how these libraries are used, they could be exploited to cause Denial of Service or execute arbitrary code in specific contexts.
- **Recommendation:** Update dependencies, specifically `eas-cli` and `xlsx`. Consider replacing `xlsx` if its export features are not strictly required or if a more secure alternative exists.

### 3.2 Non-Atomic Database Restore
- **Severity:** Moderate (Bug/Data Integrity)
- **Description:** The `restoreDatabase` function performs a full replace by destroying records in each table one by one and then recreating them.
- **Vulnerability:** This process is not wrapped in a single global transaction (though individual table operations are in write blocks).
- **Impact:** If the app crashes or the device loses power during a restore, the database will be in an inconsistent, partially populated state, leading to data loss or app instability.
- **Location:** `database/exportImport.ts`
- **Recommendation:** Use a single transaction for the entire restore process if the database engine supports it, or implement a "staging" approach where data is verified before the old data is deleted.

---

## 4. Conclusion & Remediation Roadmap

The Musclog app takes a good first step by implementing local-first storage and some encryption. However, the "security by obscurity" approach to key storage and plaintext storage of API keys must be addressed immediately.

**Immediate Actions:**
1. Migrate sensitive settings (API keys) to an encrypted storage model.
2. Replace `AsyncStorage` for the master encryption key with `expo-secure-store`.
3. Update critical dependencies identified by `npm audit`.

**Future Improvements:**
1. Implement more robust backup encryption.
2. Add a privacy lock (PIN/Biometrics) for the app itself to protect the local database from physical access.
