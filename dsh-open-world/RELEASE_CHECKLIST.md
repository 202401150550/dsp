# Release checklist — development candidate

This is not a stable-release sign-off. Planning documents describe intended capabilities;
this checklist takes precedence when describing what has actually been verified.

## Implemented and checked

- [x] Core tests no longer require adjacent RRA or `_scratch/dsh-550c-boot` code.
- [x] Optional integration assertions retained as separate, fail-closed commands.
- [x] Client build fingerprint uses relative paths and normalized line endings.
- [x] Standalone relocated source passes freshness and core checks.
- [x] Missing optional RRA checkout causes its integration command to fail explicitly.
- [x] Package file list includes test directory, launcher and referenced developer docs.
- [x] License and portable development instructions included.
- [x] Compiled footer component fits 320/390/768px in an isolated Edge browser fixture.
- [ ] Add the supplied standalone Node 22/24 Windows/Linux CI template to `.github/workflows/ci.yml`; the workspace file tool refused that target, so it was not installed and remote CI has not run.

## Required before stable release

- [ ] Verify the final candidate inside the real Desktop host without interrupting an active session.
- [ ] Validate the packed artifact and a clean host/profile install.
- [ ] Complete sidebar/native-terminal acceptance, including upstream ConPTY helper diagnostics.
- [ ] Recheck the exact commit/file list and dependency locks immediately before submission.
- [ ] Run the newly supplied CI on the chosen GitHub repository.

## Explicitly not promised

Real rewind/file restoration, verified task-plugin execution, historical workspace-file
version archives, and embedded Office/PDF viewing are not finished features. Current
workspace links read current bytes; document downloads are a fallback, not inline viewing.
The optional RRA prototype is not a production neural implementation. Startup-animation
static assertions do not validate actual playback timing.

Do not upload parent-workspace history, session/profile data, MCP connection files,
`node_modules`, `_scratch`, browser recordings, raw PTY logs, or API keys.
