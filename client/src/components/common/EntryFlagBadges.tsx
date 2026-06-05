const dotStyle = (color: string): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  display: 'inline-block',
  background: color,
})

export default function EntryFlagBadges({
  tryAgain,
  neverAgain,
  uncertainRating,
}: {
  tryAgain: boolean
  neverAgain: boolean
  uncertainRating: boolean
}) {
  return (
    <>
      {tryAgain && <span style={dotStyle('var(--badge-try-again)')} />}
      {neverAgain && <span style={dotStyle('var(--badge-never-again)')} />}
      {uncertainRating && <span style={dotStyle('var(--badge-uncertain)')} />}
    </>
  )
}
