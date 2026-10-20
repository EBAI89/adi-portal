# ADI Portal — Notification Channels (v2.45.0)

The portal delivers each important notice through up to four channels: the in-portal notification centre, **email (Brevo)**, **SMS (Africa's Talking)** and **WhatsApp (Twilio)**. The missing-screenshot notice to a payer uses all four automatically.

## 1. Provider switches (already set in `render.yaml`)

| Variable | Value |
|---|---|
| `EMAIL_PROVIDER` | `brevo` |
| `SMS_PROVIDER` | `africastalking` |
| `WHATSAPP_PROVIDER` | `twilio` |

## 2. Credentials to enter in Render → adi-portal → Environment

Secrets are entered only in Render, never in GitHub or in chat.

| Channel | Variable | Where to obtain it |
|---|---|---|
| Email | `BREVO_API_KEY` | Brevo → SMTP & API → API keys (verify the sender domain `adiuniversity.com`) |
| Email | `EMAIL_FROM` | Pre-set to `ADI University <no-reply@adiuniversity.com>` |
| SMS | `AT_USERNAME`, `AT_API_KEY` | Africa's Talking dashboard (use `sandbox` only for tests) |
| SMS | `AT_SENDER_ID` | Optional approved alphanumeric sender (e.g. `ADI`) |
| WhatsApp | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Twilio Console → Account info |
| WhatsApp | `TWILIO_WA_FROM` | Your approved WhatsApp sender number, e.g. `+237…` |
| WhatsApp | `TWILIO_WA_CONTENT_SID_PROOF` | SID (`HX…`) of the approved template in section 3 |

After saving the variables, Render restarts the service. The start-up log then reports each channel as `ready` or lists exactly what is still missing (look for lines beginning `[channels]`).

## 3. WhatsApp template (required by WhatsApp for business-initiated messages)

A business may open a conversation only with a template approved by WhatsApp. In Twilio → Content Template Builder, create a **WhatsApp / Text** template of category *Utility* with two variables, then submit it for approval:

> ADI University — Payment {{1}} (transaction ID {{2}}) cannot be validated because no screenshot of the MoMo payment has been uploaded. Please open Fees & Payments > Upload proof and attach a clear screenshot. / Le paiement {{1}} (identifiant {{2}}) ne peut pas être validé car aucune capture du paiement MoMo n’a été téléversée. Ouvrez Frais & Paiements > Téléverser la preuve et joignez une capture nette.

The portal fills `{{1}}` with the fee item and amount and `{{2}}` with the transaction ID. Copy the approved template's SID into `TWILIO_WA_CONTENT_SID_PROOF`.

## 4. Behaviour and safeguards

- A payer is messaged only on the phone number registered on their account (Cameroon numbers are normalised to `+237…`).
- A channel failure (wrong key, no credit) is logged and never prevents the notice from being saved or the other channels from sending.
- A verifier cannot resend the notice within one hour, and no notice can be sent once a screenshot exists.
- Until every credential for a channel is present, that channel does not deliver. Use `log` as the provider value to switch a channel off.

## Official notices (v2.63.0)

*Send a notice* (administration menu; super administrator and any role granted "Send official notices by e-mail") e-mails a formal bilingual letter to applicants, students, staff, MINESUP applicants or transcript requesters: admission decisions, fee confirmations and reminders, results published, transcript status, MINESUP status, or a custom message. Choose ADI addresses, personal addresses, or both; a portal notification is added unless switched off. Always preview before sending (maximum 250 people at once, 12 notices per hour per sender).

## Notice board (v2.64.0)
A notice posted on **Notices** (`#/notices`) is now delivered automatically as an official letter to the **personal and ADI e-mail addresses** of every active member of the chosen audience, and appears as an in-portal notification. The board shows, under each notice, how many recipients and addresses were reached and the delivery result. Posting requires the `manage_notices` permission; each posting is recorded in the audit log.

## Status letters for MINESUP and transcript applicants (v2.65.0)
- **MINESUP** (`#/minesup-admin/<application>`) and **Transcript requests** (review dialog): the button **Send a status letter** lets an authorised administrator (permission `send_notices`, `manage_students` or `manage_transcripts`) pick *being processed*, *status update* or *ready for collection*, fill the expected date / collection point, preview the letter and send it to the applicant's ADI and personal addresses, with a portal notification.
- Changing a transcript request to *Submitted*, *Processing* or *Ready* now sends the formal status letter automatically.
- Every letter is bilingual, courteous, and recorded in the audit log.

## Letterhead and proofreading (v2.66.0)
Every e-mail now carries the ADI logo in its header and the round ADI seal beside the signature (served publicly from `/mail-assets/`). Notices typed on the board, and custom notices, are proofread automatically: common typing slips, spacing, capital letters, month names and closing punctuation are corrected before sending.
