import { useNavigate } from 'react-router-dom'
import Modal from '../common/Modal'
import EntryDetail from './EntryDetail'

export default function EntryModal() {
  const navigate = useNavigate()
  return (
    <Modal onClose={() => navigate(-1)}>
      <EntryDetail />
    </Modal>
  )
}
