import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  interval?: number; // 0 for toggle, > 0 for autohide seconds
}

export default function PasswordInput({ interval = 5, style, ...props }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const togglePassword = () => {
    if (showPassword) {
      setShowPassword(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    } else {
      setShowPassword(true);
      if (interval > 0) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setShowPassword(false);
        }, interval * 1000);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        {...props}
        type={showPassword ? "text" : "password"}
        style={{ ...style, paddingRight: '2.5rem' }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={togglePassword}
        style={{
          position: 'absolute',
          right: '1rem',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0
        }}
        title={interval > 0 ? `Reveal for ${interval} seconds` : "Toggle reveal"}
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
