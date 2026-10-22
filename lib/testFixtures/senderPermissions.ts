// Shared synthetic From-header matrix for reader/standalone permission parity.
export const senderPermissionCases = [
  { name: "comment containing an allowed address", from: "Actual (trusted@example.test) <actual@example.test>", key: "actual@example.test" },
  { name: "trailing comment", from: "actual@example.test (trusted@example.test)", key: "actual@example.test" },
  { name: "group", from: "Synthetic: actual@example.test, trusted@example.test;", key: "actual@example.test" },
  { name: "multiple mailboxes", from: "Actual <actual@example.test>, Trusted <trusted@example.test>", key: "actual@example.test" },
  { name: "encoded display name", from: "=?UTF-8?Q?Trusted_=3Ctrusted=40example.test=3E?= <actual@example.test>", key: "actual@example.test" },
  { name: "case and surrounding whitespace", from: " \t Actual <ACTUAL@EXAMPLE.TEST> \t ", key: "actual@example.test" },
  { name: "missing closing bracket", from: "Actual <actual@example.test", key: "actual@example.test" },
  { name: "missing opening bracket", from: "Actual actual@example.test>", key: "actual@example.test" },
  { name: "empty From", from: "", key: "" },
  { name: "comment without a mailbox", from: "(trusted@example.test)", key: "" },
  { name: "quoted display name without a mailbox", from: '"trusted@example.test"', key: "" },
  { name: "quoted display name containing an allowed address", from: '"Trusted <trusted@example.test>" <ACTUAL@EXAMPLE.TEST>', key: "actual@example.test" },
  { name: "quoted local part containing whitespace", from: '"attacker trusted"@example.test', key: '"attacker trusted"@example.test' },
  { name: "quoted local part with a trailing comment", from: '"attacker trusted"@example.test (trusted@example.test)', key: '"attacker trusted"@example.test' },
  { name: "quoted local part containing an angle-bracket address", from: '"attacker <trusted@example.test>"@example.test', key: '"attacker <trusted@example.test>"@example.test' },
  { name: "named quoted local part containing an angle-bracket address", from: 'Actual <"attacker <trusted@example.test>"@example.test>', key: '"attacker <trusted@example.test>"@example.test' },
  { name: "unicode IDN", from: "Actual <actual@bücher.example>", key: "actual@xn--bcher-kva.example" },
  { name: "A-label IDN", from: "Actual <ACTUAL@XN--BCHER-KVA.EXAMPLE>", key: "actual@xn--bcher-kva.example" },
  { name: "quoted local part retaining internal whitespace", from: '" a  b "@example.test', key: '" a  b "@example.test' },
  { name: "quoted local part retaining escaped characters", from: '"a\\\"b\\\\c"@example.test', key: '"a\\\"b\\\\c"@example.test' }
] as const;
