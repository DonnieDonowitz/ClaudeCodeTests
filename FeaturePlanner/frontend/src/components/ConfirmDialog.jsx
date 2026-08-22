import Modal from './Modal.jsx';

export default function ConfirmDialog({ title, message, confirmLabel = 'Conferma', danger, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="modal-form">
        <p className="confirm-message">{message}</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Annulla</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
