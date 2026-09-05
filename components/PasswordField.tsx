'use client';

import { useId, useState } from 'react';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  minLength?: number;
  hint?: string;
};

export default function PasswordField({ label, value, onChange, autoComplete, minLength, hint }: Props) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <div className="passwordControl">
      <input id={id} type={visible ? 'text' : 'password'} required
        minLength={minLength} maxLength={128} autoComplete={autoComplete}
        autoCapitalize="none" spellCheck={false}
        aria-describedby={hint ? `${id}-hint` : undefined}
        value={value} onChange={event => onChange(event.target.value)} />
      <button type="button" className="passwordToggle" aria-controls={id}
        aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        onClick={() => setVisible(current => !current)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
          strokeLinejoin="round" aria-hidden="true" focusable="false">
          {visible ? <>
            <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path d="M9.9 5.2A10 10 0 0 1 12 5c7 0 10 7 10 7a16 16 0 0 1-3.1 4.2M6.1 6.1A17 17 0 0 0 2 12s3 7 10 7a10 10 0 0 0 5-1.3" />
          </> : <>
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </>}
        </svg>
      </button>
    </div>
    {hint && <small id={`${id}-hint`}>{hint}</small>}
  </div>;
}
