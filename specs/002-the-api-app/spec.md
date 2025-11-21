# Feature Specification: Centralize Apex Omni Secrets in Google Secret Manager

**Feature Branch**: `002-the-api-app`  
**Created**: 2025-11-15  
**Status**: Draft  
**Input**: User description: "The api app should keep Apex Omni secrets with Google Secret Manager"

## Clarifications

### Session 2025-11-15
- Q: When the production API service starts and the Apex Omni secret entry is missing or deleted from Google Secret Manager, how should the service behave? → A: Start normally but mark Omni features unavailable until the secret returns.

## User Scenarios & Testing *(mandatory)*

### Primary User Story
A platform security owner needs all production Apex Omni integration secrets managed in a single, auditable location so the production API service can consume them without exposing credentials in source control or ad-hoc environment variables, while lower environments continue using scrubbed test values.

### Acceptance Scenarios
1. **Given** an authorized operator stores an Apex Omni credential in Google Secret Manager for production use, **When** the production API service requests the secret at runtime, **Then** the secret is retrieved from Google Secret Manager and used without exposing the value elsewhere.
2. **Given** an operator rotates a production Apex Omni secret (infrequently, per policy) within Google Secret Manager, **When** the production API service next requests the credential, **Then** it uses the updated value and any stale caches are invalidated within the defined propagation window.

### Edge Cases
- What happens when Google Secret Manager temporarily rejects read/write operations? System must fail gracefully and alert operators.
- If a production Apex Omni secret reference is missing or deleted when the production API service starts, Omni-specific endpoints must remain unavailable, emit clear error responses, and raise alerts until the secret is restored.
- What is the response when an unauthorized actor attempts to read or mutate the secret store?
- Since Google Secret Manager is production-only, how are non-production environments blocked from referencing production secrets?
- If a non-production deployment attempts to point at production GSM secrets, the service must refuse startup with an explicit error and log the violation.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST centralize all production Apex Omni credentials (API keys, client secrets, webhook secrets) within Google Secret Manager and prohibit storing them in code, local config files, or unencrypted env vars.
- **FR-002**: System MUST enforce that only authenticated, authorized service identities and designated operators can create, read, update, or delete Apex Omni secrets.
- **FR-003**: System MUST provide a documented workflow for operators to add or exceptionally rotate Apex Omni secrets (expected <=1 rotation per year unless a security event occurs), including validation that the new value works before it becomes active.
- **FR-004**: System MUST ensure the API service reads secrets directly from Google Secret Manager (or a secure cache backed by it) at startup and refreshes on rotation without requiring a redeploy for credential updates.
- **FR-005**: System MUST log every read/write attempt for Apex Omni secrets with timestamp, actor, action, and outcome to support audits and incident response.
- **FR-006**: System MUST emit alerts when secret retrieval fails or when Google Secret Manager is unreachable so on-call staff can remediate before the API loses Omni connectivity.
- **FR-007**: System MUST restrict Google Secret Manager usage to production mode while ensuring non-production environments rely on sanitized test credentials stored outside GSM and technically blocking them from referencing production secrets.
- **FR-008**: System MUST enforce an Apex Omni secret rotation policy of at least once every 12 months or immediately following any suspected credential compromise, even though the secret inventory is largely fixed, by detecting overdue entries and alerting operators before the window expires.
- **FR-009**: System MUST document a break-glass procedure that allows a designated operator to supply the last known valid secrets through an auditable manual channel within 30 minutes if Google Secret Manager access is lost, and requires restoration of GSM as the long-term source of truth.
- **FR-010**: System MUST guarantee >=99.9% monthly availability for production secret retrieval calls with a maximum p95 read latency of 1 second, ensuring the API service can meet its dependency budgets.
- **FR-011**: System MUST maintain a predefined catalog of Apex Omni secrets (types and values established during onboarding) and disallow new secret types without explicit governance approval.
- **FR-012**: System MUST allow the production API service to start when a secret is missing but automatically disable Omni-dependent features, respond with explicit unavailability errors, and continue alerting operators until Google Secret Manager is repopulated.

### Key Entities *(include if feature involves data)*
- **Apex Omni Secret Record**: Represents a single Omni credential from the predefined catalog with metadata such as environment (production only for GSM), secret type (API key, webhook secret), owner, last rotated date, and access permissions.
- **Secret Access Event**: Captures each attempt to read or modify Apex Omni secrets, noting the requesting identity, timestamp, operation, and result for compliance and anomaly detection.

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous  
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

### Constitution Alignment
- [x] Data integrity and risk management needs captured (if applicable)
- [x] Performance budgets and reliability targets specified
- [x] Security and secrets handling requirements included

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed
