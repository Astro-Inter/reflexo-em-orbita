import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { DifficultyId } from "../game/engine";
import type { RankingEntry } from "../game/ranking";

type SharedProps = { onClose: () => void };

function DialogShell({
  children,
  onClose,
  title,
  subtitle,
}: SharedProps & {
  children: ReactNode;
  title: string;
  subtitle: string;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    if (document.activeElement === document.body) dialog.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("keydown", keydown);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      data-control
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <header className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button
            className="modal-close"
            type="button"
            data-control
            aria-label="Fechar"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function RankingDialog({
  entries,
  onClose,
  onReset,
}: SharedProps & {
  entries: RankingEntry[];
  onReset: (password: string) => boolean;
}) {
  const [resetOpen, setResetOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const submitReset = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submittedPassword = String(new FormData(event.currentTarget).get("password") ?? "");
    if (onReset(submittedPassword)) {
      setPassword("");
      setResetError("");
      setResetSuccess(true);
      setResetOpen(false);
    } else {
      setResetSuccess(false);
      setResetError("Senha incorreta. O ranking não foi alterado.");
    }
  };
  return (
    <DialogShell
      onClose={onClose}
      title="Ranking local"
      subtitle="Melhores tempos salvos neste navegador"
    >
      <ol className="ranking-list">
        {entries.length === 0 ? (
          <li className="ranking-empty">Ainda não há recordes. Seja o primeiro!</li>
        ) : entries.map((entry, index) => (
          <li key={entry.id}>
            <span className="ranking-place">{index + 1}º</span>
            <span className="ranking-player">
              <strong>{entry.name}</strong>
            </span>
            <span className="ranking-time">
              {entry.milliseconds}<small>ms</small>
            </span>
          </li>
        ))}
      </ol>
      {resetOpen ? (
        <form className="ranking-reset-form" onSubmit={submitReset}>
          <label htmlFor="ranking-reset-password">Senha para redefinir</label>
          <input
            id="ranking-reset-password"
            name="password"
            type="password"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            data-control
            autoFocus
          />
          {resetError && <p role="alert">{resetError}</p>}
          <div className="modal-actions">
            <button
              type="button"
              className="modal-secondary"
              data-control
              onClick={() => {
                setPassword("");
                setResetError("");
                setResetOpen(false);
              }}
            >
              Cancelar
            </button>
            <button className="modal-primary" data-control type="submit">
              Redefinir
            </button>
          </div>
        </form>
      ) : (
        <button
          className="modal-secondary ranking-reset-trigger"
          type="button"
          data-control
          onClick={() => {
            setResetOpen(true);
            setResetSuccess(false);
            setResetError("");
          }}
        >
          Redefinir ranking
        </button>
      )}
      {resetSuccess && (
        <p className="ranking-reset-success" role="status">
          Ranking restaurado com sucesso.
        </p>
      )}
    </DialogShell>
  );
}

export function RecordNameDialog({
  milliseconds,
  position,
  onSave,
  onClose,
}: SharedProps & {
  milliseconds: number;
  position: number;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim()) onSave(name);
  };
  return (
    <DialogShell
      onClose={onClose}
      title={`Você entrará em ${position}º lugar!`}
      subtitle={`Registre seu tempo de ${milliseconds} ms no ranking.`}
    >
      <form className="ranking-name-form" onSubmit={submit}>
        <label htmlFor="ranking-player-name">Nome para o ranking</label>
        <input
          id="ranking-player-name"
          type="text"
          autoComplete="nickname"
          maxLength={24}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Digite seu nome"
          data-control
          autoFocus
        />
        <div className="modal-actions">
          <button
            type="button"
            className="modal-secondary"
            data-control
            onClick={onClose}
          >
            Agora não
          </button>
          <button className="modal-primary" data-control type="submit">
            Salvar recorde
          </button>
        </div>
      </form>
    </DialogShell>
  );
}
