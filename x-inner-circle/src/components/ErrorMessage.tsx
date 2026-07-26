interface ErrorMessageProps {
  message: string;
  retryable?: boolean;
  onRetry?: () => void;
}

export function ErrorMessage({ message, retryable, onRetry }: ErrorMessageProps) {
  return (
    <div className="card border border-rose-500/40 p-4 text-rose-100" role="alert">
      <p>{message}</p>
      {retryable && onRetry ? (
        <button type="button" className="btn-secondary mt-3" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
