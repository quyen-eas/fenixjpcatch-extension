# FenixJpCatch API Specification

> **Version:** 1.0.0 (Phase 3)  
> **Status:** Active  
> **Visibility:** Shared between `fenixjpcatch-platform` (private implementation) and `fenixjpcatch-extension` (public client).

---

## 1. Overview & Architecture

FenixJpCatch Extension communicates with the backend via **Firebase Cloud Functions (Callable API)**.

### 1.1 Guiding Principles

1. **Offline-First for Lookups:** Dictionary searches and lookups remain 100% local inside the browser. No network requests are made until the user explicitly saves a word (clicks the ☆ Star button) or accesses the "Từ đã lưu" (Saved Words) dashboard.
2. **Deterministic Document IDs:** The server alone computes document IDs. The client never chooses or assumes an ID:
   - If `jmdictSeq` exists: `wordId = "${jmdictSeq}_${reading}"`
   - If `jmdictSeq` is null/empty: `wordId = "x_" + sha256(NFC(trim(expression)) + "|" + NFC(trim(reading))).slice(0, 16)`
3. **Data Normalization:** All text inputs are normalized to Unicode NFC and trimmed before hashing or storage.
4. **Idempotent Saves:** Calling `saveWord` multiple times for the same word updates the timestamp and appends a new context sentence without creating duplicate words.
5. **Strict Authorization:** Firestore Security Rules ensure that a user (`request.auth.uid`) can only read and write their own documents under `/users/{uid}/...`.

---

## 2. Authentication

- **Provider:** Google Sign-In via `chrome.identity.launchWebAuthFlow` on Chrome Extension.
- **Protocol:** Standard Firebase Authentication token (`context.auth.uid`).
- **Unauthenticated Calls:** All Callable functions require authentication. Unauthenticated requests receive code `unauthenticated`.

---

## 3. Endpoints (Callable Functions)

### 3.1 `saveWord`

Saves or updates a Japanese word in the user's notebook, appending the contextual sentence where it was found.

#### Request Parameters

| Field             | Type             | Required | Description                                                    |
| ----------------- | ---------------- | -------- | -------------------------------------------------------------- |
| `expression`      | `string`         | **Yes**  | Word headword (e.g. `食べる`). Max 100 chars.                  |
| `reading`         | `string`         | **Yes**  | Kana reading (e.g. `たべる`). Max 100 chars.                   |
| `jmdictSeq`       | `number \| null` | No       | JMdict entry sequence integer from `FenixJpCatch JA-VI`.       |
| `contextSentence` | `string`         | No       | Surrounding sentence extracted by the scanner. Max 1000 chars. |
| `sourceUrl`       | `string`         | No       | Web page URL where the word was encountered. Max 2048 chars.   |
| `sourceTitle`     | `string`         | No       | Web page title. Max 500 chars.                                 |

#### Response Format

```json
{
  "success": true,
  "wordId": "1358280_たべる",
  "created": true,
  "status": "new",
  "updatedAt": "2026-10-19T12:00:00.000Z"
}
```

---

### 3.2 `listSavedWords`

Retrieves a paginated list of saved words for the authenticated user, ordered by `updatedAt` descending.

#### Request Parameters

| Field        | Type             | Required | Default | Description                                 |
| ------------ | ---------------- | -------- | ------- | ------------------------------------------- |
| `limit`      | `number`         | No       | `50`    | Maximum items to return (1 - 100).          |
| `startAfter` | `string \| null` | No       | `null`  | Pagination cursor (`updatedAt` ISO string). |
| `status`     | `string \| null` | No       | `null`  | Filter by status: `"new"` or `"checked"`.   |

#### Response Format

```json
{
  "words": [
    {
      "id": "1358280_たべる",
      "expression": "食べる",
      "reading": "たべる",
      "jmdictSeq": 1358280,
      "sourceLang": "ja",
      "targetLang": "vi",
      "status": "new",
      "createdAt": "2026-10-19T10:00:00.000Z",
      "updatedAt": "2026-10-19T12:00:00.000Z",
      "contexts": [
        {
          "id": "ctx_abcdef123456",
          "sentence": "毎日朝ご飯を食べる...",
          "sourceUrl": "https://www3.nhk.or.jp/news/...",
          "sourceTitle": "NHK News Web",
          "createdAt": "2026-10-19T12:00:00.000Z"
        }
      ]
    }
  ],
  "nextCursor": "2026-10-19T10:00:00.000Z"
}
```

---

### 3.3 `deleteSavedWord`

Soft-deletes a saved word by setting `deleted: true`.

#### Request Parameters

| Field    | Type     | Required | Description                            |
| -------- | -------- | -------- | -------------------------------------- |
| `wordId` | `string` | **Yes**  | The document ID of the word to delete. |

#### Response Format

```json
{
  "success": true,
  "wordId": "1358280_たべる",
  "deleted": true
}
```

---

## 4. Firestore Data Model

```
users/{uid}/
  profile: { displayName, email, photoURL, createdAt }
  words/{wordId}/
    sourceLang: "ja"
    targetLang: "vi"
    jmdictSeq: number | null
    expression: string
    reading: string
    status: "new" | "checked"
    deleted: boolean
    createdAt: timestamp
    updatedAt: timestamp
    contexts/{contextId}/
      sentence: string
      sourceUrl: string
      sourceTitle: string
      createdAt: timestamp
```

### 4.1 Security Rules Summary

- `users/{uid}` and any subcollection: Read & Write allowed **only** if `request.auth != null && request.auth.uid == uid`.
- Any access to other users' collections is blocked.
