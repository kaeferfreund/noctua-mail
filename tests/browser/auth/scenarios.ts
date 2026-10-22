export const SCENARIOS = {
  registration:"registration, assertion, replay and rotated-session UV grant binding",
  uv:"UV=false registration and assertion are rejected by the server",
  mismatch:"RP/origin mismatch and wrong challenge/grant fail",
  reset:"anonymous options are invalidated by reset",
  management:"real UV removal and password plus UV security purposes",
  registrationFault:"registration finalizer fault quarantines the committed credential",
  uvFault:"UV reauth finalizer fault removes the rotated session and grant",
  revoke:"anonymous options are invalidated by revoke"
} as const;
