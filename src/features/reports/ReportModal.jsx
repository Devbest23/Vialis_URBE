import { uiStore } from '../../store/uiStore.js'
import { Modal } from '../../components/ui.jsx'
import { ReportForm } from './ReportForm.jsx'

export function ReportModal() {
  const open = uiStore((s) => s.reportOpen)
  const close = () => uiStore.getState().setReportOpen(false)

  return (
    <Modal open={open} onClose={close} title="Reportar incidencia ciudadana" wide>
      {open ? <ReportForm variant="modal" onCancel={close} onCreated={close} /> : null}
    </Modal>
  )
}
