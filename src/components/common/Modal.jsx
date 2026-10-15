import React, { useRef, useEffect } from "react";
import { X } from "lucide-react";
export default function Modal({
  title,
  children,
  onClose,
  wide
}) {
  const dialog = useRef(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector('input, select, textarea, button')?.focus();
    const handle = e => {
      if (e.key === 'Escape') close.current();
      if (e.key === 'Tab') {
        const focusable = [...dialog.current.querySelectorAll('button, input, select, textarea, [tabindex="0"]')].filter(el => !el.disabled);
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handle);
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handle);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return <div className="modal-backdrop" onClick={onClose}>
    <section 
      ref={dialog} 
      className={`modal ${wide ? 'wide' : ''}`} 
      role="dialog" 
      aria-modal="true" 
      aria-label={title} 
      onClick={e => e.stopPropagation()}
    >
      <header>
        <div>
          <span className="eyebrow">CARELINE CLINIC</span>
          <h2>
            {title}
          </h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </header>
      {children}
    </section>
  </div>;
}
