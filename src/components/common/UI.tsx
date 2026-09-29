import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { ChevronDown, Search } from 'lucide-react'

export function Button({ children, variant = 'outline', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'outline' | 'primary' | 'yellow' | 'ghost' }) {
  return <button {...props} className={`btn btn-${variant} ${className}`}>{children}</button>
}

export function Surface({ children, className = '' }: { children: ReactNode, className?: string }) {
  return <section className={`surface ${className}`}>{children}</section>
}

export function Chip({ children, tone = 'blue' }: { children: ReactNode, tone?: 'blue' | 'mint' | 'purple' | 'green' | 'gray' | 'amber' }) {
  return <span className={`chip chip-${tone}`}>{children}</span>
}

export function SearchInput({ value, onChange, placeholder }: { value: string, onChange: (value: string) => void, placeholder: string }) {
  return <label className="search-input"><Search size={19} strokeWidth={1.9} /><input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></label>
}

export function FilterSelect({ children, className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return <label className={`select-wrap ${className}`}><select {...props}>{children}</select><ChevronDown size={16} /></label>
}

export function PageHeading({ title, subtitle, actions }: { title: string, subtitle?: string, actions?: ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>
}

export function InfoFooter({ children }: { children: ReactNode }) {
  return <div className="info-footer"><span className="info-circle">i</span>{children}</div>
}
