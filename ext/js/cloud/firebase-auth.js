/*
 * Copyright (C) 2023-2026  Yomitan Authors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import {readResponseJson} from '../core/json.js';

export const CLOUD_CONFIG_STORAGE_KEY = 'fenix_cloud_config';

/**
 * @typedef {{
 *   firebaseApiKey: string,
 *   firebaseProjectId: string,
 *   functionsRegion: string,
 *   functionsBaseUrl: string,
 *   googleOAuthClientId: string,
 * }} CloudConfig
 */

/** @type {CloudConfig} */
const DEFAULT_CLOUD_CONFIG = {
    firebaseApiKey: '',
    firebaseProjectId: 'fenixjpcatch',
    functionsRegion: 'asia-northeast1',
    functionsBaseUrl: '',
    googleOAuthClientId: '',
};

/**
 * Normalizes a partial cloud config object.
 * @param {?import('core').UnknownObject} raw
 * @param {CloudConfig} [fallback]
 * @returns {CloudConfig}
 */
export function normalizeCloudConfig(raw, fallback = DEFAULT_CLOUD_CONFIG) {
    if (raw === null || typeof raw !== 'object') {
        return {...fallback};
    }
    return {
        firebaseApiKey: typeof raw.firebaseApiKey === 'string' && raw.firebaseApiKey.trim() !== '' ? raw.firebaseApiKey.trim() : fallback.firebaseApiKey,
        firebaseProjectId: typeof raw.firebaseProjectId === 'string' && raw.firebaseProjectId.trim() !== '' ? raw.firebaseProjectId.trim() : fallback.firebaseProjectId,
        functionsRegion: typeof raw.functionsRegion === 'string' && raw.functionsRegion.trim() !== '' ? raw.functionsRegion.trim() : fallback.functionsRegion,
        functionsBaseUrl: typeof raw.functionsBaseUrl === 'string' && raw.functionsBaseUrl.trim() !== '' ? raw.functionsBaseUrl.trim() : fallback.functionsBaseUrl,
        googleOAuthClientId: typeof raw.googleOAuthClientId === 'string' && raw.googleOAuthClientId.trim() !== '' ? raw.googleOAuthClientId.trim() : fallback.googleOAuthClientId,
    };
}

/**
 * Loads the cloud configuration by merging build-time `/lib/fenix-cloud-env.json` with runtime overrides in `chrome.storage.local`.
 * @returns {Promise<CloudConfig>}
 */
export async function loadCloudConfig() {
    let config = {...DEFAULT_CLOUD_CONFIG};

    try {
        const envUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL ?
            chrome.runtime.getURL('/lib/fenix-cloud-env.json') :
            '/lib/fenix-cloud-env.json';
        const response = await fetch(envUrl);
        if (response.ok) {
            const rawBuild = /** @type {?import('core').UnknownObject} */ (await readResponseJson(response));
            config = normalizeCloudConfig(rawBuild, config);
        }
    } catch {
        // Build-time env file is optional
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        try {
            const stored = await chrome.storage.local.get(CLOUD_CONFIG_STORAGE_KEY);
            const rawStored = /** @type {?import('core').UnknownObject} */ (
                typeof stored[CLOUD_CONFIG_STORAGE_KEY] === 'object' ? stored[CLOUD_CONFIG_STORAGE_KEY] : null
            );
            config = normalizeCloudConfig(rawStored, config);
        } catch {
            // Storage read error ignored
        }
    }

    return config;
}

/**
 * Saves runtime cloud configuration overrides to `chrome.storage.local`.
 * @param {Partial<CloudConfig>} overrides
 * @returns {Promise<CloudConfig>}
 */
export async function saveCloudConfig(overrides) {
    const current = await loadCloudConfig();
    const merged = normalizeCloudConfig(/** @type {import('core').UnknownObject} */ (overrides), current);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({[CLOUD_CONFIG_STORAGE_KEY]: merged});
    }
    return merged;
}

/**
 * Checks whether both Firebase Web API Key and Google OAuth Client ID are configured.
 * @param {CloudConfig} config
 * @returns {boolean}
 */
export function isCloudConfigReady(config) {
    return config.firebaseApiKey.trim() !== '' && config.googleOAuthClientId.trim() !== '';
}

/**
 * Computes the Cloud Functions base URL from a `CloudConfig`.
 * @param {CloudConfig} config
 * @returns {string}
 */
export function getFunctionsBaseUrl(config) {
    const explicit = config.functionsBaseUrl.trim();
    if (explicit !== '') {
        return explicit.replace(/\/+$/, '');
    }
    const region = config.functionsRegion.trim() || 'asia-northeast1';
    const projectId = config.firebaseProjectId.trim() || 'fenixjpcatch';
    return `https://${region}-${projectId}.cloudfunctions.net`;
}

/**
 * Returns the extension's OAuth redirect URI (`https://<extension-id>.chromiumapp.org/`).
 * @returns {string}
 */
export function getExtensionRedirectUri() {
    if (typeof chrome !== 'undefined' && typeof chrome.identity?.getRedirectURL === 'function') {
        return chrome.identity.getRedirectURL();
    }
    if (typeof chrome !== 'undefined' && typeof chrome.runtime?.id === 'string' && chrome.runtime.id !== '') {
        return `https://${chrome.runtime.id}.chromiumapp.org/`;
    }
    return 'https://<extension-id>.chromiumapp.org/';
}

/**
 * Builds the Google OAuth 2.0 implicit `id_token` authorization URL.
 * @param {string} clientId
 * @param {string} redirectUri
 * @param {string} nonce
 * @returns {string}
 */
export function buildGoogleOAuthUrl(clientId, redirectUri, nonce) {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'id_token');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('prompt', 'select_account');
    return url.toString();
}

/**
 * Extracts `id_token` from the OAuth redirect response URL.
 * @param {string} redirectResponseUrl
 * @returns {?string}
 */
export function extractIdTokenFromRedirectUrl(redirectResponseUrl) {
    try {
        const parsed = new URL(redirectResponseUrl);
        const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
        const hashParams = new URLSearchParams(hash);
        const tokenFromHash = hashParams.get('id_token');
        if (typeof tokenFromHash === 'string' && tokenFromHash !== '') {
            return tokenFromHash;
        }
        const tokenFromQuery = parsed.searchParams.get('id_token');
        if (typeof tokenFromQuery === 'string' && tokenFromQuery !== '') {
            return tokenFromQuery;
        }
    } catch {
        // Invalid URL
    }
    return null;
}

/**
 * Launches `chrome.identity.launchWebAuthFlow` to obtain a Google OAuth `id_token`.
 * @param {string} clientId
 * @returns {Promise<{googleIdToken: string, redirectUri: string}>}
 */
export async function launchGoogleWebAuthFlow(clientId) {
    if (typeof chrome === 'undefined' || typeof chrome.identity?.launchWebAuthFlow !== 'function') {
        throw new Error('Trình duyệt hiện tại không hỗ trợ chrome.identity.launchWebAuthFlow.');
    }
    const redirectUri = getExtensionRedirectUri();
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const nonce = [...randomBytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    const authUrl = buildGoogleOAuthUrl(clientId, redirectUri, nonce);

    const responseUrl = await /** @type {Promise<string>} */ (new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({url: authUrl, interactive: true}, (redirectUrl) => {
            const lastError = chrome.runtime?.lastError;
            if (lastError) {
                reject(new Error(lastError.message || 'Người dùng đã hủy hoặc đăng nhập Google thất bại.'));
                return;
            }
            if (typeof redirectUrl !== 'string' || redirectUrl === '') {
                reject(new Error('Không nhận được phản hồi từ Google OAuth.'));
                return;
            }
            resolve(redirectUrl);
        });
    }));

    const googleIdToken = extractIdTokenFromRedirectUrl(responseUrl);
    if (googleIdToken === null) {
        throw new Error('Không tìm thấy id_token trong phản hồi OAuth từ Google.');
    }

    return {googleIdToken, redirectUri};
}

/**
 * Exchanges a Google OAuth `id_token` for a Firebase Authentication session via Identity Toolkit REST API.
 * @param {string} googleIdToken
 * @param {string} redirectUri
 * @param {string} firebaseApiKey
 * @returns {Promise<{
 *   token: string,
 *   refreshToken: string,
 *   expiresAt: number,
 *   user: {
 *     uid: string,
 *     email?: string,
 *     displayName?: string,
 *     photoUrl?: string,
 *   },
 * }>}
 */
export async function exchangeGoogleTokenForFirebaseAuth(googleIdToken, redirectUri, firebaseApiKey) {
    const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(firebaseApiKey)}`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            postBody: `id_token=${encodeURIComponent(googleIdToken)}&providerId=google.com`,
            requestUri: redirectUri,
            returnIdpCredential: true,
            returnSecureToken: true,
        }),
    });

    const raw = /** @type {?import('core').UnknownObject} */ (await readResponseJson(response));
    if (!response.ok || raw === null || typeof raw.idToken !== 'string') {
        const errObj = /** @type {?import('core').UnknownObject} */ (
            typeof raw?.error === 'object' && raw?.error !== null ? raw.error : null
        );
        const message = typeof errObj?.message === 'string' ? errObj.message : `Lỗi xác thực Firebase (${response.status})`;
        throw new Error(message);
    }

    const expiresInSec = typeof raw.expiresIn === 'string' ? Number.parseInt(raw.expiresIn, 10) : 3600;
    const expiresAt = Date.now() + (Number.isFinite(expiresInSec) && expiresInSec > 0 ? expiresInSec : 3600) * 1000;

    return {
        token: raw.idToken,
        refreshToken: typeof raw.refreshToken === 'string' ? raw.refreshToken : '',
        expiresAt,
        user: {
            uid: typeof raw.localId === 'string' ? raw.localId : '',
            email: typeof raw.email === 'string' ? raw.email : void 0,
            displayName: typeof raw.displayName === 'string' ? raw.displayName : void 0,
            photoUrl: typeof raw.photoUrl === 'string' ? raw.photoUrl : void 0,
        },
    };
}

/**
 * Refreshes an expired Firebase ID token using the Secure Token REST API.
 * @param {string} refreshToken
 * @param {string} firebaseApiKey
 * @returns {Promise<{token: string, refreshToken: string, expiresAt: number}>}
 */
export async function refreshFirebaseIdToken(refreshToken, firebaseApiKey) {
    const endpoint = `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(firebaseApiKey)}`;
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    });
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    });

    const raw = /** @type {?import('core').UnknownObject} */ (await readResponseJson(response));
    if (!response.ok || raw === null || typeof raw.id_token !== 'string') {
        throw new Error(`Không thể làm mới phiên đăng nhập Firebase (${response.status})`);
    }

    const expiresInSec = typeof raw.expires_in === 'string' ? Number.parseInt(raw.expires_in, 10) : 3600;
    const expiresAt = Date.now() + (Number.isFinite(expiresInSec) && expiresInSec > 0 ? expiresInSec : 3600) * 1000;

    return {
        token: raw.id_token,
        refreshToken: typeof raw.refresh_token === 'string' ? raw.refresh_token : refreshToken,
        expiresAt,
    };
}

/**
 * Computes deterministic Firestore document ID for a saved word:
 * - `${jmdictSeq}_${reading}` when `jmdictSeq` is a positive integer
 * - `x_${sha256_first_16_hex}` otherwise
 * @param {string} expression
 * @param {string} reading
 * @param {?number} [jmdictSeq]
 * @returns {Promise<string>}
 */
export async function computeWordId(expression, reading, jmdictSeq = null) {
    const normExpr = expression.trim().normalize('NFC');
    const normReading = reading.trim().normalize('NFC');
    if (typeof jmdictSeq === 'number' && Number.isInteger(jmdictSeq) && jmdictSeq > 0) {
        return `${jmdictSeq}_${normReading}`;
    }
    const bytes = new TextEncoder().encode(`${normExpr}|${normReading}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
    return `x_${hex}`;
}

/**
 * Extracts a string value from a Firestore REST field object.
 * @param {unknown} field
 * @param {string} [fallback]
 * @returns {string}
 */
function readFirestoreString(field, fallback = '') {
    if (typeof field === 'object' && field !== null) {
        const obj = /** @type {import('core').UnknownObject} */ (field);
        if (typeof obj.stringValue === 'string') { return obj.stringValue; }
        if (typeof obj.timestampValue === 'string') { return obj.timestampValue; }
    }
    return fallback;
}

/**
 * Saves a word and its context sentence directly to Cloud Firestore via REST API (`users/{uid}/words/{wordId}`).
 * Works on the free Firebase Spark plan without requiring Cloud Functions deployment.
 * @param {{
 *   expression: string,
 *   reading: string,
 *   jmdictSeq?: number | null,
 *   contextSentence?: string | null,
 *   sourceUrl?: string | null,
 *   sourceTitle?: string | null,
 * }} params
 * @param {string} projectId
 * @param {string} uid
 * @param {string} authToken
 * @returns {Promise<{success: boolean, wordId: string, created: boolean, status: string, updatedAt: string}>}
 */
export async function saveWordToFirestore(params, projectId, uid, authToken) {
    const normExpr = params.expression.trim().normalize('NFC');
    const normReading = params.reading.trim().normalize('NFC');
    const wordId = await computeWordId(normExpr, normReading, params.jmdictSeq);
    const nowIso = new Date().toISOString();
    const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
    const wordUrl = `${base}/users/${encodeURIComponent(uid)}/words/${encodeURIComponent(wordId)}`;

    /** @type {Record<string, unknown>} */
    const fields = {
        sourceLang: {stringValue: 'ja'},
        targetLang: {stringValue: 'vi'},
        jmdictSeq: typeof params.jmdictSeq === 'number' && params.jmdictSeq > 0 ?
            {integerValue: String(params.jmdictSeq)} :
            {nullValue: null},
        expression: {stringValue: normExpr},
        reading: {stringValue: normReading},
        status: {stringValue: 'new'},
        deleted: {booleanValue: false},
        updatedAt: {timestampValue: nowIso},
    };

    if (typeof params.contextSentence === 'string' && params.contextSentence.trim() !== '') {
        fields.latestSentence = {stringValue: params.contextSentence.trim()};
        fields.latestSourceUrl = {stringValue: (params.sourceUrl || '').trim()};
        fields.latestSourceTitle = {stringValue: (params.sourceTitle || '').trim()};
    }

    const response = await fetch(wordUrl, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({fields}),
    });

    if (!response.ok) {
        const rawErr = /** @type {?import('core').UnknownObject} */ (await readResponseJson(response).catch(() => null));
        const errObj = /** @type {?import('core').UnknownObject} */ (
            typeof rawErr?.error === 'object' && rawErr?.error !== null ? rawErr.error : null
        );
        const message = typeof errObj?.message === 'string' ? errObj.message : `Lỗi ghi Firestore (${response.status})`;
        throw new Error(message);
    }

    if (typeof params.contextSentence === 'string' && params.contextSentence.trim() !== '') {
        const contextsUrl = `${wordUrl}/contexts`;
        await fetch(contextsUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
                fields: {
                    sentence: {stringValue: params.contextSentence.trim()},
                    sourceUrl: {stringValue: (params.sourceUrl || '').trim()},
                    sourceTitle: {stringValue: (params.sourceTitle || '').trim()},
                    createdAt: {timestampValue: nowIso},
                },
            }),
        }).catch(() => {});
    }

    return {
        success: true,
        wordId,
        created: true,
        status: 'new',
        updatedAt: nowIso,
    };
}

/**
 * Lists saved words directly from Cloud Firestore via REST API (`users/{uid}/words`).
 * @param {string} projectId
 * @param {string} uid
 * @param {string} authToken
 * @returns {Promise<{words: Array<Record<string, unknown>>, nextCursor: ?string}>}
 */
export async function listSavedWordsFromFirestore(projectId, uid, authToken) {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users/${encodeURIComponent(uid)}/words?pageSize=100`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${authToken}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Lỗi đọc Firestore (${response.status})`);
    }

    const raw = /** @type {?import('core').UnknownObject} */ (await readResponseJson(response));
    const docs = Array.isArray(raw?.documents) ? /** @type {Array<import('core').UnknownObject>} */ (raw.documents) : [];
    /** @type {Array<Record<string, unknown>>} */
    const words = [];

    for (const doc of docs) {
        const name = typeof doc.name === 'string' ? doc.name : '';
        const id = name.split('/').pop() || '';
        const fields = /** @type {?import('core').UnknownObject} */ (
            typeof doc.fields === 'object' && doc.fields !== null ? doc.fields : null
        );
        if (fields === null) { continue; }

        const deletedField = /** @type {?import('core').UnknownObject} */ (
            typeof fields.deleted === 'object' && fields.deleted !== null ? fields.deleted : null
        );
        if (deletedField?.booleanValue === true) { continue; }

        const expression = readFirestoreString(fields.expression);
        const reading = readFirestoreString(fields.reading);
        if (expression === '' || reading === '') { continue; }

        const status = readFirestoreString(fields.status, 'new');
        const updatedAt = readFirestoreString(fields.updatedAt, typeof doc.updateTime === 'string' ? doc.updateTime : new Date().toISOString());
        const createdAt = readFirestoreString(fields.createdAt, typeof doc.createTime === 'string' ? doc.createTime : updatedAt);
        const latestSentence = readFirestoreString(fields.latestSentence);
        const latestSourceUrl = readFirestoreString(fields.latestSourceUrl);
        const latestSourceTitle = readFirestoreString(fields.latestSourceTitle);

        const seqObj = /** @type {?import('core').UnknownObject} */ (
            typeof fields.jmdictSeq === 'object' && fields.jmdictSeq !== null ? fields.jmdictSeq : null
        );
        const jmdictSeq = typeof seqObj?.integerValue === 'string' ? Number.parseInt(seqObj.integerValue, 10) : null;

        const contexts = latestSentence !== '' ?
            [{
                id: 'latest',
                sentence: latestSentence,
                sourceUrl: latestSourceUrl,
                sourceTitle: latestSourceTitle,
                createdAt: updatedAt,
            }] :
            [];

        words.push({
            id,
            expression,
            reading,
            jmdictSeq,
            sourceLang: readFirestoreString(fields.sourceLang, 'ja'),
            targetLang: readFirestoreString(fields.targetLang, 'vi'),
            status,
            createdAt,
            updatedAt,
            contexts,
        });
    }

    words.sort((a, b) => {
        const bTime = typeof b.updatedAt === 'string' ? b.updatedAt : '';
        const aTime = typeof a.updatedAt === 'string' ? a.updatedAt : '';
        return bTime.localeCompare(aTime);
    });
    return {words, nextCursor: null};
}

/**
 * Soft-deletes a saved word directly in Cloud Firestore via REST API (`users/{uid}/words/{wordId}`).
 * @param {string} wordId
 * @param {string} projectId
 * @param {string} uid
 * @param {string} authToken
 * @returns {Promise<{success: boolean, wordId: string, deleted: boolean}>}
 */
export async function deleteSavedWordFromFirestore(wordId, projectId, uid, authToken) {
    const nowIso = new Date().toISOString();
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users/${encodeURIComponent(uid)}/words/${encodeURIComponent(wordId)}?updateMask.fieldPaths=deleted&updateMask.fieldPaths=updatedAt`;
    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
            fields: {
                deleted: {booleanValue: true},
                updatedAt: {timestampValue: nowIso},
            },
        }),
    });

    if (!response.ok) {
        throw new Error(`Lỗi xoá từ trên Firestore (${response.status})`);
    }

    return {
        success: true,
        wordId,
        deleted: true,
    };
}
