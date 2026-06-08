interface ClaimItemApprovalCheckboxProps {
  checked: boolean
  disabled?: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
  className?: string
  title?: string
}

export function ClaimItemApprovalCheckbox({
  checked,
  disabled = false,
  indeterminate = false,
  onChange,
  className = '',
  title = 'Approve item',
}: ClaimItemApprovalCheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate
      }}
      onChange={(e) => onChange(e.target.checked)}
      className={`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed ${className}`}
      title={disabled ? 'Add price and source URL to approve' : title}
    />
  )
}
