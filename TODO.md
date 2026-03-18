# Vibma Feedback TODO

## Priority 1: Fix CHANGE_TO hover (prototyping bug)
- [x] Skip top-level frame validation when `navigation === "CHANGE_TO"`
- [x] Validate destination is a variant (COMPONENT inside COMPONENT_SET)
- [x] Update schema notes and destination description
- [ ] ~Handle source being an instance~ — not needed: Figma resolves CHANGE_TO at runtime based on source's component set

## Priority 2: Contextual sizing for instances
- [x] Add `sizing:"contextual"` param to instances.create schema
- [x] Pass `autoDefault=true` to `appendAndApplySizing` when flag set
- [x] Codegen + build

## Deferred
- [ ] 4: Text sizing — verify no bug, improve docs
- [ ] 7: Component depth — document frames.get workaround, optionally add depth param
- [ ] 2: add_variant — new method to append variants to existing set
- [ ] 6: viewport-fit / scroll-container lint rules
- [ ] 5: Stress test preview — new tool
