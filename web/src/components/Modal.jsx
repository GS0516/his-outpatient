export default function Modal({ title, onClose, children, footer, width = 760 }) {
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ width, maxWidth: '100%' }}>
        <div className="modal-hd">
          <h3 style={{ fontSize: 15 }}>{title}</h3>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-bd">{children}</div>
        {footer && <div className="modal-ft">{footer}</div>}
      </div>
    </div>
  )
}
