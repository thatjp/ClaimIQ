export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-700',
    pending: 'bg-yellow-100 text-yellow-800',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] || styles.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
