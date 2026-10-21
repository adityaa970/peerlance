# Changelog

All notable changes to the Peerlance mobile project will be documented in this file.

## [1.1.0] - 2026-04-18

### Added
- **Interactive Role-Aware Feature Tours**: A robust multi-step guided tour system that adapts based onWhether you are a Writer or a Poster.
- **Precision Spotlight Highlighting**: Upgraded the `CoachMark` engine to use `measureInWindow` and `forwardRef` for pixel-perfect targeting of UI elements.
- **Smart Onboarding Transitions**: Implemented auto-scrolling for long forms (Post Assignment) to ensure guided highlights are always in view.
- **Writer Activation Guide**: Added a dedicated settings highlight to help new writers activate their public profile and start earning.
- **Tab-Focus Guarding**: Integrated `useIsFocused` to prevent feature tours from inactive background tabs from interfering with the active screen.

### Fixed
- **Registration Role Loss**: Resolved a critical bug where a user's role choice was being overwritten during the ID verification stage of signup.
- **Background Triggering**: Fixed an issue where the Home screen would show highlights intended for Other tabs (Post/Settings).
- **Measurement Precision**: Fixed `AssignmentCard` and `TaskCard` to correctly propagate refs, enabling accurate coordinate calculation.
- **Sync Reliability**: Refined the frontend and backend sync logic to ensure user profiles are correctly initialized on the first app load after registration.

### Changed
- **CoachMark Upgrade**: Refactored the internal tour engine to support `onStepChange` callbacks for complex screen-specific logic.
- **Store Defaults**: Improved the initialization of the `userStore` to prevent premature role defaulting.

---
*Next Steps: Finalizing the remaining tour steps for the complete end-to-end user journey.*
