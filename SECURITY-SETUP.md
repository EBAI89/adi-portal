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
