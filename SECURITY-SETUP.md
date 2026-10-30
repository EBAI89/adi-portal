# ADI portal — security set-up (Render)

## Two-step verification (authenticator app)
* Required in production for the roles in `MFA_ROLES` (default `super_admin,admin`, which covers the registry).
  At the next sign-in these users are taken to **Account security** and must enrol before anything else opens.
* Set `MFA_ENFORCE=false` only as a temporary escape; set `MFA_ROLES=super_admin,admin,accountant` to widen it.
* Lost phone and lost recovery codes: the super administrator resets a colleague under **Account security**.
  If the super administrator is locked out, add `SUPER_ADMIN_MFA_RESET=true` in Render > Environment, restart, sign in,
  enrol again, then **delete the variable**.

## Passwords of the super administrator
* On every start the portal sets the super administrator's password from `SUPER_ADMIN_PASSWORD`.
  Rotate it by changing the variable in Render > Environment (never in the repository), then restart.

## Secrets
* Keep `SESSION_SECRET`, `SUPER_ADMIN_PASSWORD`, `DATABASE_URL`, payment (MoMo), e-mail, SMS and AI keys only in Render > Environment.
* Changing `SESSION_SECRET` signs everyone out and makes enrolled authenticator secrets unreadable (they are sealed with it): do not change it unless you also reset two-step verification.

## Database
* Render > adi-portal-db > Access Control: remove `0.0.0.0/0` so only Render services in the same region can connect.
* Render > adi-portal-db > Recovery: confirm backups are enabled and test a restore into a new database.

## Two-step verification by phone number (v2.60.0)

Staff may now choose **"By SMS to my phone"** on *Account security*. At every sign-in a 6-digit code (valid 5 minutes) is sent to the verified number and, as a safeguard, to the account e-mail. The authenticator app remains available as an alternative.

* SMS delivery needs provider keys in Render (Africa's Talking: `SMS_PROVIDER=africastalking`, `AT_USERNAME`, `AT_API_KEY`; or the Twilio variables). Until they are set, codes are sent by e-mail only.
* Recovery codes are issued at activation and work for both methods.

## Two-step verification by e-mail (v2.61.0)

*Account security* also offers **"By e-mail (free)"**: at each sign-in a 6-digit code (valid 5 minutes) is e-mailed to the account address. It needs only the e-mail provider (Brevo), no SMS credentials. Recovery codes are issued at activation.

**Update (v2.61.1):** the SMS option is no longer offered on the set-up screen; choose e-mail or the authenticator app. SMS support stays dormant in the server and can be re-enabled later.

## Verification: holder identity cross-check (v2.151.0)
The public verification page (`#/verify/<serial>?c=<code>`) now shows the genuine holder of the document as held by the University: name, matricule, date and place of birth, sex, nationality, programme, faculty/school, department/specialty and the passport photograph. An **Identity cross-check** compares the particulars printed on the document presented (or stated by the person presenting it) with the register, field by field. Any mismatch is reported as a possible impersonation or copied serial number, recorded in the audit log, and the super administrators are alerted (at most once an hour per document). Set `DOCREG_PHOTO=0` in Render to hide the photograph on the public page.

## Verification: one synchronised verdict (v2.152.0)
The verification page now validates the serial number, the code and the holder identity together with one button. A document is declared AUTHENTIC only when all three agree. A wrong serial number or code gives NOT VERIFIED and the identity check is marked not applicable; a matching serial number with a different identity gives NOT AUTHENTIC FOR THIS HOLDER, and the registered holder particulars are withheld (a masked name only). Receipts are compared on the payer name and the amount. Editing any field withdraws the previous verdict.
