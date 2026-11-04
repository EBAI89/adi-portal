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

## Receipts carry the programme; the verification form follows the document (v2.153.0)
A payment receipt registered in the authenticity register now records the payment (receipt number, amount, purpose, academic year, status) and the programme the payer is registered for or has been admitted to (programme, faculty/school, specialty, level, matricule), read from the portal records. Open a receipt again and download it once to bring an older receipt up to date. The verification page asks only for the particulars that apply to the document: a receipt asks for the payer, programme and amount; a transcript or statement for the student bio data; a timetable or other general document for none (its serial number and code alone authenticate it). The particulars are never pre-filled from the register, since the check would then prove nothing.

## Verification page: the button always leads somewhere (v2.154.0)
Tapping "Verify and compare with the register" now consults the register, brings the verdict to the top of the screen, and, when no particulars have been entered, explains what to enter and places the cursor in the first field. The result tables fit a phone screen.

## Course catalogue: Management, HRM and Project Management (v2.155.0)
The six programmes of the Departments of Management (MGT), Human Resource Management (HRM) and Project Management (PJM) now follow the Departments' curriculum reference: B.Sc. Management (180 credits), the B.Sc. HRM and B.Sc. Project Management Top-Ups (70 credits each) and the three M.Sc. programmes (108 credits each). Codes, levels, semesters and credits are applied once at start-up (`migCur26`). A course that already has registrations, results, timetable or exam entries, or a lecturer, is never removed. The catalogue page shows a course-code guide (prefix, level digit, semester parity, 306 / 498 / 698). The reference differs from the 2025 Handbook on four points, applied as in the reference for these six programmes only: French is coded FRN (Handbook: FRE), SPT 100 carries 2 credits (Handbook: 1), LOG 100, LAW 100 and ENT 200 are not listed, and MGT 204 is Organisational Behaviour (in the Accounting and Banking programmes MGT 204 remains Business Law I).

## Dark theme and blocked alerts (v2.156.0)
The mailbox address, the kicker lines and the studio figures use the readable theme colours in the dark theme (they were dark blue and crimson on a dark card). When the browser blocks notifications, the alerts card now gives three steps (including the Android Chrome setting) and a "check again" button.

## Payments: confirm and reject are always in view (v2.157.0)
The Payments page opens with an "Awaiting your decision" card listing every pending payment with its proof and the Confirm / Reject buttons. In the table, the buttons now sit under the status (they were in a last column that a tablet screen hid).

## Payments: the "Awaiting confirmation" box is tappable (v2.157.1)
Tapping the Awaiting confirmation box filters the list to pending payments and moves to the decision card with the Confirm and Reject buttons.

## Idle sign-out: 15 minutes (v2.158.0)
A signed-in session that is left idle is closed after 15 minutes (it was 5). A reminder with a 60-second countdown appears at 14 minutes; any tap, key press or touch keeps the session open. The server-side session window is 16 minutes (15 plus one minute of grace). The 8-hour absolute limit is unchanged.

## Assign courses to lecturers (v2.159.0)
Courses > "Assign courses to a lecturer" (`#/courses/assign`): the super administrator, or an administrator holding the `course_assign` permission, chooses a lecturer and ticks the courses he or she can teach (filter by programme, specialty or keyword). The first lecturer assigned to a course is its lecturer in charge; later ones are co-lecturers (class lists, course plans and the virtual classroom already honour both). Withdrawing a course promotes the first co-lecturer. Every change is logged on the course record and in the audit log, and the lecturer receives an official letter at the ADI and personal addresses.

## Notifications open the exact application (v2.160.0)
A "New application" notification now opens that application straight away (the file opens on the Applications page, then the address returns to the list). New notifications carry a direct link; notifications sent earlier are matched to the application by the applicant name. The notification link is also kept when a notification is sent to every holder of a permission.

## Virtual classes: timetable, automatic attendance and e-mail notices (v2.161.0)
- **Follows the timetable.** A virtual class is scheduled by choosing one of the course's upcoming timetable sessions (day and hours come from the timetable, in Cameroon time). The same timetable session cannot be scheduled twice; a free date can no longer be typed (only the super administrator or a classroom manager can add an extra session).
- **Students are notified by e-mail** (official letter, ADI and personal addresses, in the student's language) as well as in the portal when a class is scheduled, rescheduled or cancelled.
- **Attendance is automatic.** Students who join the live class are marked present (no code or fingerprint). The lecturer's teaching hours are credited automatically when the class ends, and only if at least one student was present; otherwise the record is flagged NO_QUORUM and no hours are credited. A class left open is closed by the system 20 minutes after its scheduled end. The physical-class opening of the same timetable session is blocked, so hours are never counted twice. The records join the tamper-evident attendance log and pass the integrity check.
