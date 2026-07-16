import './TypingIndicator.css'

interface Props {
  model: string
}

export function TypingIndicator({ model }: Props) {
  const modelName = model.split('/').pop() ?? model
  return (
    <div className="typing-row" aria-live="polite" aria-label="Assistant is typing">
      <div className="typing-avatar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5z" fill="var(--accent)" />
        </svg>
      </div>
      <div className="typing-bubble">
        <span className="typing-label">{modelName} is thinking</span>
        <div className="typing-dots">
          <span className="dot" style={{ animationDelay: '0ms' }} />
          <span className="dot" style={{ animationDelay: '160ms' }} />
          <span className="dot" style={{ animationDelay: '320ms' }} />
        </div>
      </div>
    </div>
  )
}
