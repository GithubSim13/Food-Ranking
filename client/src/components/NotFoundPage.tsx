import { useNavigate } from 'react-router-dom'
import { smallPrimaryBtnStyle } from './common/pageStyles'
import styles from './NotFoundPage.module.css'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className={styles.wrapper}>
      <span className={styles.backdrop404}>404</span>

      <div className={styles.toast}>
        <span className={styles.toastIcon}>🍽️</span>
        <div className={styles.toastText}>
          <span className={styles.toastLabel}>Achievement Unlocked</span>
          <span className={styles.toastTitle}>How did we get here?</span>
        </div>
      </div>

      <div className={styles.copy}>
        <p className={styles.copyText}>This page has no rating. We've checked.</p>
        <button
          style={{ ...smallPrimaryBtnStyle, ...{ padding: '0.55rem 1.4rem', fontSize: '0.88rem' } }}
          onClick={() => navigate('/')}
        >
          Go Home
        </button>
      </div>
    </div>
  )
}
