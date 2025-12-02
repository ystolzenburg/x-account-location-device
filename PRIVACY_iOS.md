# Privacy Policy for X-Posed iOS

**Effective Date:** December 2, 2024  
**Last Updated:** December 2, 2024

---

## Overview

X-Posed is a profile viewer app for X (formerly Twitter) that displays publicly available account information. This privacy policy explains what data the app accesses, how it's stored, and your rights as a user.

**Key Points:**
- We do **not** collect your personal data
- We do **not** use analytics or tracking
- We do **not** share data with third parties for advertising
- All data stays on your device unless you enable optional cloud features

---

## 1. Information We Access

### 1.1 Your X Account (Authentication)

When you sign in to X through the app:

| What We Access | Purpose | Storage |
|----------------|---------|---------|
| Session tokens | Authenticate API requests | Device only (AsyncStorage) |
| Your username | Display in app header | Device only |

**We do NOT access:**
- Your X password (entered directly on x.com)
- Your email address
- Your phone number
- Your direct messages
- Your private/protected tweets

### 1.2 Public Profile Information

When you look up an X account, we request publicly available information from X's API:

| Data Field | Description | Source |
|------------|-------------|--------|
| Account country | Geographic region indicator | X API (public) |
| Account creation date | When the account was created | X API (public) |
| Account ID | Numeric identifier | X API (public) |
| Profile image | Public avatar | X API (public) |

**This information is:**
- Already visible to any X user who views the profile
- Retrieved using your authenticated session
- Not modified or enhanced by our app

---

## 2. Data Storage

### 2.1 On-Device Storage

All data is stored locally on your device:

| Data Type | Storage Method | Duration |
|-----------|----------------|----------|
| Authentication tokens | iOS AsyncStorage (encrypted) | Until logout |
| Lookup cache | iOS AsyncStorage | 24 hours |
| Profile images | App cache directory | Until cleared |
| Lookup history | iOS AsyncStorage | Until cleared |

**Security measures:**
- Data is sandboxed within the app
- Not accessible to other apps
- Not backed up to iCloud (sensitive data)
- Cleared when app is uninstalled

### 2.2 Community Cloud Cache (Optional)

The app includes an **optional** Community Cloud Cache feature that is **disabled by default**.

#### When Enabled

If you choose to enable this feature:

| Data Shared | Description | NOT Shared |
|-------------|-------------|------------|
| Public username | The @handle looked up | Your identity |
| Country code | Public account country | IP address |
| Timestamp | When cached | Device info |

#### Privacy Protections

- Your IP is not logged (routed through Cloudflare Workers)
- No account linking between your identity and lookups
- Data expires after 14 days
- You can disable at any time in Settings

---

## 3. Information We Do NOT Collect

X-Posed does **not** collect, access, or transmit:

| Category | Examples |
|----------|----------|
| **Device identifiers** | IDFA, IDFV, serial number |
| **Location data** | GPS, Wi-Fi, cell tower |
| **Contacts** | Address book, phone numbers |
| **Photos/Media** | Camera roll, files |
| **Health data** | HealthKit, fitness data |
| **Financial data** | Payment info, purchases |
| **Browsing data** | Safari history, other apps |
| **Biometrics** | Face ID data, fingerprints |
| **Analytics** | Usage patterns, crash reports |
| **Advertising IDs** | IDFA, ad tracking |

---

## 4. Third-Party Services

### 4.1 X (Twitter) API

The app communicates with X's servers to retrieve public profile information using your authenticated session. X's own privacy policy governs data on their servers.

**Data flow:**
```
Your Device → X.com API → Public Profile Data → Your Device
```

No data is routed through our servers in default mode.

### 4.2 Cloudflare Workers (Cloud Cache Only)

If you enable Community Cloud Cache:

**Data flow:**
```
Your Device → Cloudflare Worker → Anonymous cache → Response
```

- Cloudflare's infrastructure privacy policy applies
- No personal data transmitted
- No request logging

### 4.3 No Other Third Parties

We do **not** use:
- Analytics services (Google Analytics, Firebase, etc.)
- Advertising networks
- Crash reporting services
- Social SDKs
- Attribution platforms

---

## 5. Data Retention

| Data Type | Retention Period | Deletion Method |
|-----------|------------------|-----------------|
| Session tokens | Until logout or 30 days | Logout or uninstall |
| Lookup cache | 24 hours | Automatic expiration |
| Profile image cache | 7 days | Settings → Clear Cache |
| Lookup history | Indefinite | Settings → Clear History |
| Cloud cache entries | 14 days | Automatic expiration |

---

## 6. Your Rights and Controls

### 6.1 Access Your Data

All stored data is visible within the app:
- View lookup history in the History screen
- View cached data size in Settings

### 6.2 Delete Your Data

You can delete data at any time:
- **Clear cache:** Settings → Clear Cache
- **Clear history:** Settings → Clear History
- **Delete all data:** Uninstall the app
- **Logout:** Removes authentication tokens

### 6.3 Control Features

- **Disable Cloud Cache:** Settings → Toggle off
- **Private mode:** Don't contribute new lookups to cloud
- **Offline mode:** Works with cached data only

### 6.4 Data Portability

Your lookup history can be exported in JSON format via Settings.

---

## 7. Children's Privacy

X-Posed is not intended for users under 17 years of age. We do not knowingly collect data from children. X's own age requirements (13+) also apply.

---

## 8. Security

We implement security measures to protect your data:

| Measure | Implementation |
|---------|----------------|
| Encrypted storage | iOS Keychain for sensitive tokens |
| Secure transport | HTTPS/TLS for all API requests |
| App sandboxing | iOS isolation between apps |
| No remote code | No dynamic code loading |
| Session security | Tokens never logged or transmitted |

---

## 9. International Users

### 9.1 GDPR (European Union)

If you are in the EU, you have rights under GDPR:

- **Access:** View all stored data in-app
- **Rectification:** N/A (we don't modify X data)
- **Erasure:** Delete via Settings or uninstall
- **Portability:** Export history feature
- **Objection:** Disable cloud features

**Legal basis:** Legitimate interest in providing the service you requested.

### 9.2 CCPA (California)

California residents have rights under CCPA:

- We do **not** sell personal information
- We do **not** share data for advertising
- You can request deletion via app Settings

---

## 10. Changes to This Policy

We may update this policy to reflect:
- New app features
- Legal requirements
- Improved clarity

Material changes will be noted with:
- Updated "Last Updated" date
- In-app notification for significant changes
- Changelog documentation

---

## 11. Contact

For privacy questions or concerns:

**Alexander Hagenah**
- X: [@xaitax](https://x.com/xaitax)
- LinkedIn: [alexhagenah](https://linkedin.com/in/alexhagenah)
- Website: [primepage.de](https://primepage.de)
- Email: privacy@primepage.de

---

## 12. Apple App Store Privacy Labels

Based on this policy, the App Store privacy labels are:

### Data Not Collected
X-Posed does not collect data that is linked to your identity.

### Data Not Linked to You
- **Usage Data:** Lookup history (stored locally only)

### Data Used to Track You
- None

### Data Linked to You
- None

---

## Summary

| Question | Answer |
|----------|--------|
| Do you collect personal data? | No |
| Do you track users? | No |
| Do you share data with advertisers? | No |
| Do you use analytics? | No |
| Where is data stored? | On your device only |
| Can I delete my data? | Yes, anytime |
| Is cloud cache required? | No, opt-in only |
| Is source code available? | Yes, open source |

---

*This privacy policy complies with Apple's App Store Review Guidelines, GDPR, and CCPA requirements.*