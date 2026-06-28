# admin-state Specification

## Purpose
Keep the application's notion of whether the current user is an admin correct across authentication
changes, so that admin-gated UI reflects the actually-signed-in user without requiring a page reload.
## Requirements
### Requirement: Admin status tracks the current user
The system SHALL keep the reported admin status in sync with the currently authenticated user. When the user signs out or a different user signs in within the same session, the admin status MUST be re-evaluated and any cached value invalidated without requiring a manual page reload.

#### Scenario: User switch in the same tab

- **WHEN** an admin user signs out and a non-admin user signs in within the same browser tab
- **THEN** components reading admin status see `isAdmin = false` without a page reload
- **AND** any module-level cache of the previous user's admin status is invalidated

