export default function SendWarnings({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <div
      role="status"
      className="min-w-0 break-words rounded-md p-3 text-sm"
      style={{ background: "var(--amber-3)", color: "var(--amber-11)" }}
    >
      <strong>Email sent.</strong>
      {warnings.map((warning, i) => (
        <p key={i}>{warning}</p>
      ))}
      <p>Delivery succeeded. Do not send it again.</p>
    </div>
  );
}
