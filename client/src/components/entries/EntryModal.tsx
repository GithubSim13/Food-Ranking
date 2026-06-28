import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../common/Modal'
import EntryDetail from './EntryDetail'

export default function EntryModal() {
  const navigate = useNavigate()
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  return (
    <Modal onClose={() => navigate(-1)} maxWidth={isPanelOpen ? 1200 : 960}>
      <EntryDetail onPanelChange={setIsPanelOpen} />
    </Modal>
  )
}
