# STAGE App - Login Flow PRD

## Overview
This document describes the login/authentication flow for the STAGE mobile application. The app supports phone number-based OTP authentication as the primary login method, with Google Sign-In as an alternative option.

## Feature: User Authentication

### 1. Login Screen

#### 1.1 Screen Elements
- **App Logo**: STAGE logo displayed at the top center
- **Welcome Message**: "राम राम जी" (greeting in Hindi)
- **Hero Image**: Brand ambassador/celebrity image
- **Title**: "अपना फ़ोन नंबर डालें" (Enter your phone number)
- **Subtitle**: "इस नंबर पर 4 अंकों का STAGE कोड भेजा जाएगा।" (A 4-digit STAGE code will be sent to this number)
- **Country Code Selector**: Dropdown showing +91 (India) as default
- **Phone Number Input Field**: Text field for entering 10-digit mobile number
  - Placeholder: "मोबाइल नंबर" (Mobile Number)
  - Keyboard type: Numeric
- **Login Button**: "लॉगिन करें" (Login) - Primary CTA button in green
- **Social Login Divider**: "या कनेक्ट करें" (Or connect with)
- **Google Sign-In Button**: Google icon for Google authentication
- **Custom URL Button**: "Add Custom URL" for development/testing purposes
- **Legal Links**: Terms & Conditions, Privacy Policy, Refund Policy

#### 1.2 User Actions
1. User can select country code from dropdown (default: +91)
2. User enters 10-digit mobile number in the input field
3. User taps "Login" button to proceed
4. User can alternatively tap Google icon for Google Sign-In
5. User can tap legal links to view respective documents

#### 1.3 Validation Rules
- Phone number must be exactly 10 digits
- Phone number field cannot be empty
- Only numeric input allowed
- Invalid phone number shows error message

#### 1.4 Expected Behavior
- On entering valid phone number and tapping Login:
  - Loading indicator appears
  - OTP is sent to the entered phone number via SMS
  - User is navigated to OTP Verification screen
- On invalid phone number:
  - Error message is displayed
  - User remains on Login screen

---

### 2. OTP Verification Screen

#### 2.1 Screen Elements
- **Back Button**: Arrow icon to go back to Login screen
- **App Logo**: STAGE logo at top center
- **Title**: "STAGE लॉगिन कोड डालें" (Enter STAGE login code)
- **Subtitle**: "हमने +91 XXXXXXXXXX पर 4 अंकों का STAGE कोड भेजा है।" (We have sent a 4-digit STAGE code to +91 XXXXXXXXXX)
- **OTP Input Fields**: 4 separate input boxes for 4-digit OTP
- **Resend Timer**: "कोड XX सेकंड में फिर से भेजा जाएगा।" (Code will be resent in XX seconds)
- **Resend OTP Link**: Appears after timer expires
- **Security Note**: "सिर्फ आपकी पहचान की पुष्टि के लिए है।" (Only for verifying your identity) with checkmark icon
- **Numeric Keypad**: System keyboard for entering OTP

#### 2.2 User Actions
1. User enters 4-digit OTP received via SMS
2. User can tap Back button to return to Login screen
3. User can tap Resend OTP after timer expires (typically 30 seconds)

#### 2.3 Validation Rules
- OTP must be exactly 4 digits
- OTP must match the code sent to phone
- OTP has expiry time (typically 10 minutes)
- Maximum retry attempts: 3 (before showing error)

#### 2.4 Expected Behavior
- On entering correct OTP:
  - Auto-verification on entering 4th digit
  - Loading indicator appears
  - User is logged in and navigated to Home screen
- On entering incorrect OTP:
  - Error message "Invalid OTP" is displayed
  - OTP fields are cleared
  - User can retry
- On OTP expiry:
  - Error message displayed
  - User prompted to request new OTP
- On maximum retries exceeded:
  - Account temporarily locked
  - User asked to try again later

---

### 3. Google Sign-In Flow (Alternative)

#### 3.1 User Actions
1. User taps Google icon on Login screen
2. Google Sign-In sheet/dialog appears
3. User selects Google account or enters credentials
4. Authorization completes

#### 3.2 Expected Behavior
- On successful Google authentication:
  - User is logged in
  - Navigated to Home screen
- On Google authentication failure:
  - Error message displayed
  - User remains on Login screen

---

## Test Scenarios

### Positive Test Cases

| TC ID | Title | Steps | Expected Result |
|-------|-------|-------|-----------------|
| TC001 | Valid phone login | Enter valid 10-digit phone, tap Login, enter correct OTP | User logged in successfully, redirected to Home |
| TC002 | OTP auto-fill | Enter phone, receive OTP, let auto-fill populate | OTP auto-filled and verified |
| TC003 | Resend OTP | Enter phone, wait for timer, tap Resend | New OTP received |
| TC004 | Google Sign-In | Tap Google icon, select account | User logged in via Google |
| TC005 | Back navigation from OTP | Go to OTP screen, tap back | Returns to Login screen with phone preserved |
| TC006 | Country code change | Tap country dropdown, select different country | Country code updated |

### Negative Test Cases

| TC ID | Title | Steps | Expected Result |
|-------|-------|-------|-----------------|
| TC007 | Empty phone number | Tap Login without entering phone | Error: "Please enter phone number" |
| TC008 | Invalid phone (less digits) | Enter 9 digits, tap Login | Error: "Invalid phone number" |
| TC009 | Invalid phone (more digits) | Enter 11 digits, tap Login | Error: "Invalid phone number" |
| TC010 | Wrong OTP | Enter incorrect 4-digit OTP | Error: "Invalid OTP" |
| TC011 | Expired OTP | Wait for OTP to expire, enter OTP | Error: "OTP expired" |
| TC012 | Google Sign-In cancel | Tap Google, cancel in dialog | Returns to Login screen |

### Edge Cases

| TC ID | Title | Steps | Expected Result |
|-------|-------|-------|-----------------|
| TC013 | Network error on login | Disable network, tap Login | Error: "No internet connection" |
| TC014 | Network error on OTP | Disable network, enter OTP | Error: "No internet connection" |
| TC015 | App background during OTP | Enter phone, background app, return | OTP screen maintained |
| TC016 | Multiple OTP requests | Request OTP multiple times rapidly | Rate limited, shows cooldown |

---

## UI/UX Requirements

### Visual Design
- Dark theme background (gradient black to dark red)
- Green primary action button
- White/light text for readability
- STAGE brand colors maintained

### Accessibility
- Screen reader support for all elements
- Sufficient color contrast (WCAG AA)
- Touch targets minimum 48x48 dp
- Clear error messages

### Performance
- OTP SMS delivery: < 30 seconds
- Screen transition: < 500ms
- API response time: < 3 seconds

---

## Technical Notes

- Package name: `in.stage.dev`
- Main Activity: `in.stage.MainActivity`
- OTP length: 4 digits
- OTP validity: 10 minutes
- Resend cooldown: 30 seconds
- Supported country codes: India (+91) primary
