# Health Sync Integrity Report: Nutrition and Fitness Data Loss

## 1. Executive Summary
On [2025-03-03], a critical data loss issue was identified in the Musclog health synchronization layer. Users reported that nutrition logs recorded directly in the app would "vanish" the next day.

Investigation revealed that the synchronization logic for Health Connect (Android) and Apple Health (iOS) followed a **destructive reconciliation pattern**. This pattern erroneously deleted local data whenever the external health store's response was incomplete (e.g., due to paging limits or indexing latency).

## 2. Root Cause Analysis

### 2.1. Destructive Reconciliation (Primary Cause)
The synchronization logic in `services/healthConnectNutrition.ts` and `services/healthConnectFitness.ts` functioned by fetching all local records with an `external_id` and comparing them to the response from the system health store.
*   **The Bug**: If a local record existed with an `external_id` but was **not** found in the single API response returned by the platform, Musclog would immediately soft-delete the record locally.
*   **The Flaw**: It assumed the platform API response was an absolute, complete source of truth.

### 2.2. Android Paging Trap
The Android implementation of `readRecords` for Health Connect did not implement pagination.
*   **Mechanism**: Health Connect typically returns a maximum of 1,000 records per call.
*   **Impact**: For active users with more than 1,000 nutrition entries in the sync window (e.g., a 7 or 30-day window), any record on "Page 2" was missing from the response. Musclog interpreted these missing records as user-initiated deletions and wiped the local data.

### 2.3. Record "Promotion" Vulnerability
A unique characteristic of Musclog's sync logic is that it "promotes" its own app-originated data:
1.  User logs a food in Musclog (local data, no `external_id`).
2.  App uploads it to Health Connect.
3.  Upon success, Musclog updates the local record with the Health Connect ID (`external_id`).
*   **Impact**: Once an app-originated record was assigned an ID, it became subject to the destructive reconciliation logic described in 2.1. If it was missed by the API due to paging or indexing delays, Musclog deleted its own record.

### 2.4. Macro Doubling (Corruption Bug)
During the investigation, a secondary data corruption bug was found:
*   When updating a local record from a health store change, the app updated macro snapshots but failed to reset the `amount` field.
*   If a user originally logged 200g of food (amount=200), and a sync update occurred, the app would continue to multiply the updated snapshot by 2.0 (200/100), effectively doubling the nutritional values.

## 3. Resolution and Safeguards

The following fixes have been implemented to restore data integrity and prevent future loss:

1.  **Data Retention Priority**: The auto-deletion loop has been removed from all sync services. Musclog now favors data retention over absolute parity. If a record is missing from a sync response, it is ignored rather than deleted.
2.  **Full Paging Implementation**: Both nutrition and fitness sync on Android now utilize a `do...while` loop with `pageToken` to ensure 100% of records are retrieved from Health Connect.
3.  **Amount Normalization**: Synced updates now force the `amount` field to 100g, ensuring that snapshots containing absolute values are correctly interpreted without double-scaling.
4.  **Sync Window Alignment**: Sync windows are now strictly aligned to local midnight (`localDayStartMs` to `localDayClosedRangeMaxMs`) to prevent record slippage caused by timezone offsets during the sync calculation.

## 4. Conclusion
The "vanishing data" was not caused by database corruption, but by an overly aggressive synchronization algorithm that interpreted API limitations as deletion signals. The implemented changes pivot the app to a "Local First" integrity model, where Musclog remains the definitive owner of its data unless a user explicitly deletes it within the app.
