import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
import {
  DIFFICULTIES,
  ReactionEngine,
  browserScheduler,
  secondsLabel,
} from "./game/engine";
import type { DifficultyId } from "./game/engine";
import { SpaceScene } from "./scene/SpaceScene";
import { Icon } from "./components/Icon";
import { VictoryEffects } from "./components/VictoryEffects";
import { RankingDialog, RecordNameDialog } from "./components/RankingDialog";
import {
  addRankingEntry,
  qualifiesForRanking,
  readRanking,
  RANKING_STORAGE_KEY,
  resetRanking,
  writeRanking,
} from "./game/ranking";
import type { RankingEntry } from "./game/ranking";
import { GameAudio } from "./game/audio";
import type { Phase } from "./game/engine";

const difficultyIds: DifficultyId[] = ["moon", "sun", "astro"];

export function App() {
  const [engine] = useState(() => new ReactionEngine(browserScheduler));
  const [gameAudio] = useState(() => new GameAudio());
  const subscribe = useCallback(
    (listener: () => void) => engine.subscribe(() => flushSync(listener)),
    [engine],
  );
  const { phase, milliseconds, reason, attempt, outcome } =
    useSyncExternalStore(subscribe, engine.snapshot);
  const [pendingPreview, setPendingPreview] = useState(false);
  const displayedPhase = pendingPreview ? "REACTION" : phase;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [full, setFull] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [difficulty, setDifficulty] = useState<DifficultyId>("sun");
  const [ranking, setRanking] = useState<RankingEntry[]>(readRanking);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [pendingRecord, setPendingRecord] = useState<{
    milliseconds: number;
    difficulty: DifficultyId;
    position: number;
    visible: boolean;
  } | null>(null);
  const [savedPosition, setSavedPosition] = useState<number | null>(null);
  const handledWin = useRef<string | null>(null);
  const previousPhase = useRef<Phase>("IDLE");
  const recordPromptTimer = useRef<number | null>(null);
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback(() => {
    setFailed(true);
    setReady(false);
    engine.interrupt();
  }, [engine]);
  const active = ["WAITING", "REACTION", "FEEDBACK"].includes(phase);
  const closeRanking = useCallback(() => setRankingOpen(false), []);
  const closeNameEntry = useCallback(() => {
    if (recordPromptTimer.current !== null)
      window.clearTimeout(recordPromptTimer.current);
    recordPromptTimer.current = null;
    setPendingRecord(null);
  }, []);
  const saveName = useCallback(
    (name: string) => {
      if (!pendingRecord) return;
      const current = readRanking();
      const result = addRankingEntry(
        current,
        name,
        pendingRecord.milliseconds,
        pendingRecord.difficulty,
      );
      if (result.position === null) {
        setRanking(current);
        closeNameEntry();
        return;
      }
      setRanking(writeRanking(result.entries));
      setSavedPosition(result.position);
      closeNameEntry();
    },
    [pendingRecord, closeNameEntry],
  );
  const resetLocalRanking = useCallback((password: string) => {
    const result = resetRanking(password);
    if (!result) return false;
    setRanking(result);
    setSavedPosition(null);
    closeNameEntry();
    return true;
  }, [closeNameEntry]);
  const advance = useCallback(() => {
    if (pendingPreview) {
      setPendingPreview(false);
      return;
    }
    if (!ready || failed) return;
    gameAudio.unlock();
    const current = engine.snapshot().phase;
    if (current === "IDLE")
      engine.start(DIFFICULTIES[difficulty].thresholdMs);
    else if (current === "RESULT" || current === "INTERRUPTED") {
      if (pendingRecord) return;
      engine.reset();
      if (recordPromptTimer.current !== null)
        window.clearTimeout(recordPromptTimer.current);
      recordPromptTimer.current = null;
      setPendingRecord(null);
      setSavedPosition(null);
    }
    else engine.tap(performance.now());
  }, [engine, gameAudio, ready, failed, difficulty, pendingRecord, pendingPreview]);
  useEffect(() => {
    const pointer = (event: PointerEvent) => {
      if (
        !event.isPrimary ||
        event.button !== 0 ||
        (event.target as Element).closest("[data-control]")
      )
        return;
      event.preventDefault();
      advance();
    };
    const key = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea, select, [contenteditable='true']")
      )
        return;
      if (rankingOpen || pendingRecord) {
        event.preventDefault();
        return;
      }
      if (event.target instanceof HTMLElement) {
        const control = event.target.closest("[data-control]");
        if (control) {
          if (control.matches(".fullscreen")) {
            event.preventDefault();
            if (!event.repeat) advance();
          }
          return;
        }
      }
      event.preventDefault();
      if (!event.repeat) advance();
    };
    const interrupt = () => {
      setPendingPreview(false);
      engine.interrupt();
    };
    const visibility = () => {
      if (document.hidden) engine.interrupt();
    };
    const fullscreen = () => setFull(!!document.fullscreenElement);
    window.addEventListener("pointerdown", pointer, { passive: false });
    window.addEventListener("keydown", key);
    window.addEventListener("blur", interrupt);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("fullscreenchange", fullscreen);
    return () => {
      window.removeEventListener("pointerdown", pointer);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", interrupt);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("fullscreenchange", fullscreen);
    };
  }, [engine, advance, rankingOpen, pendingRecord]);
  useEffect(() => () => engine.dispose(), [engine]);
  useEffect(() => {
    gameAudio.setEnabled(soundEnabled);
  }, [gameAudio, soundEnabled]);
  useEffect(() => () => gameAudio.dispose(), [gameAudio]);
  useEffect(() => {
    const previous = previousPhase.current;
    if (phase === "WAITING") {
      gameAudio.unlock();
      if (previous === "IDLE") gameAudio.startMatch();
      gameAudio.startFocus();
    } else if (phase === "REACTION") {
      gameAudio.cue();
    } else if (phase === "FEEDBACK") {
      if (reason === "early") gameAudio.early();
      else gameAudio.slow();
    } else if (phase === "RESULT") {
      if (outcome === "won") gameAudio.win();
      else if (outcome === "lost") gameAudio.lose();
    } else if (phase === "INTERRUPTED") {
      gameAudio.interrupt();
    } else if (phase === "IDLE" && previous !== "IDLE") {
      gameAudio.stopFocus();
    }
    previousPhase.current = phase;
  }, [phase, reason, outcome, gameAudio, soundEnabled]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === RANKING_STORAGE_KEY)
        setRanking(readRanking());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(
    () => () => {
      if (recordPromptTimer.current !== null)
        window.clearTimeout(recordPromptTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (phase === "IDLE") {
      handledWin.current = null;
      if (recordPromptTimer.current !== null)
        window.clearTimeout(recordPromptTimer.current);
      recordPromptTimer.current = null;
      setPendingRecord(null);
      return;
    }
    if (phase !== "RESULT" || outcome !== "won" || milliseconds === null)
      return;
    const winKey = `${attempt}:${difficulty}:${milliseconds}`;
    if (handledWin.current === winKey) return;
    handledWin.current = winKey;
    if (qualifiesForRanking(milliseconds, ranking)) {
      setRankingOpen(false);
      const position =
        ranking.filter((entry) => entry.milliseconds <= milliseconds).length + 1;
      setPendingRecord({ milliseconds, difficulty, position, visible: false });
      recordPromptTimer.current = window.setTimeout(() => {
        recordPromptTimer.current = null;
        setPendingRecord((current) =>
          current ? { ...current, visible: true } : null,
        );
      }, 3000);
    }
  }, [phase, outcome, milliseconds, attempt, difficulty, ranking]);
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setFullscreenError("");
    } catch {
      setFullscreenError("Use F11 para ampliar a tela.");
    }
  }
  return (
    <main
      className={`app phase-${displayedPhase.toLowerCase()}`}
      onClickCapture={(event) => {
        if ((event.target as Element).closest("button")) {
          gameAudio.unlock();
          gameAudio.ui();
        }
      }}
      data-phase={phase}
      data-preview={pendingPreview}
      data-ready={ready && !failed}
      data-attempt={attempt}
      data-outcome={outcome ?? ""}
      data-difficulty={difficulty}
      data-win-threshold={DIFFICULTIES[difficulty].thresholdMs}
    >
      <div className="star-field" aria-hidden="true" />
      {phase === "RESULT" && outcome === "won" && <VictoryEffects />}
      <header className="topbar">
        <img
          className="brand"
          src="/assets/astro-planet-icon.png"
          alt="Ícone do planeta Astro"
          width="48"
          height="40"
        />
        <div className="topbar-actions">
          <button
            className="sound-toggle"
            data-control
            type="button"
            aria-label={soundEnabled ? "Desativar sons" : "Ativar sons"}
            aria-pressed={soundEnabled}
            onClick={() => setSoundEnabled((enabled) => !enabled)}
          >
            <Icon name={soundEnabled ? "volume" : "muted"} />
          </button>
          <button
            className="ranking-open"
            data-control
            disabled={active}
            onClick={() => setRankingOpen(true)}
          >
            <Icon name="trophy" />
            Ranking
          </button>
          {document.fullscreenEnabled && (
            <button
              className="fullscreen"
              data-control
              disabled={active}
              onClick={toggleFullscreen}
              aria-label={full ? "Sair da tela cheia" : "Tela cheia"}
            >
              <Icon name="expand" />
            </button>
          )}
        </div>
      </header>
      <section className="mission" aria-labelledby="game-title">
        <div className="intro">
          <div
            className="difficulty-picker"
            role="group"
            aria-label="Nível de dificuldade"
          >
            {difficultyIds.map((id) => {
              const option = DIFFICULTIES[id];
              return (
                <button
                  key={id}
                  className="difficulty-option"
                  type="button"
                  data-control
                  aria-pressed={difficulty === id}
                  disabled={phase !== "IDLE"}
                  onClick={(event) => {
                    setDifficulty(id);
                    event.currentTarget.blur();
                  }}
                >
                  <span>{option.name}</span>
                  <small>{option.label}</small>
                </button>
              );
            })}
          </div>
          <h1 id="game-title">
            Reflexo em <em>Órbita</em>
          </h1>
          <p className="rules">
            Quando uma pendência for identificada, o Astrinho e a tela ficarão
            vermelhos. Aperte Espaço ou toque/clique na tela o mais rápido possível
            para resolver: em menos de{" "}
            <strong>{DIFFICULTIES[difficulty].thresholdMs} ms</strong> para ganhar!
          </p>
          <span className="chance-count">
            {attempt === 0 ? "Você tem 3 chances" : `Chance ${attempt} de 3`}
          </span>
        </div>
        <div className="arena">
          <div className="orbital-glow" aria-hidden="true" />
          <div className="orbit orbit-outer" aria-hidden="true">
            <i />
          </div>
          <div className="orbit orbit-inner" aria-hidden="true" />
          <SpaceScene
            phase={displayedPhase}
            outcome={outcome}
            onReady={onReady}
            onError={onError}
          />
          <div className="scan-line" aria-hidden="true" />
        </div>
        <div className="interaction" aria-live="polite" aria-atomic="true">
          {failed ? (
            <div className="message">
              <h2>3D indisponível</h2>
              <p>Ative a aceleração gráfica e recarregue.</p>
            </div>
          ) : !ready ? (
            <div className="message">
              <p>Preparando o Astrinho...</p>
            </div>
          ) : (
            <>
              {phase === "WAITING" && (
                <div className="message">
                  <h2>Foco no Astrinho...</h2>
                </div>
              )}
              {displayedPhase === "REACTION" && (
                <div className="message reaction-message">
                  <h2>ESPAÇO OU TOQUE/CLIQUE AGORA!</h2>
                </div>
              )}
              {phase === "RESULT" && (
                <div className="message result-message">
                  <p className="result-label">
                    {outcome === "won"
                      ? "Você ganhou!"
                      : "As 3 chances acabaram."}
                  </p>
                  {milliseconds !== null && (
                    <>
                      <h2 className="result-value">
                        <span data-testid="result-ms">{milliseconds}</span>
                        <small>ms</small>
                      </h2>
                      <span className="seconds">
                        {secondsLabel(milliseconds!)}
                      </span>
                      {outcome === "won" && savedPosition !== null && (
                        <p className="record-saved" role="status">
                          Recorde salvo em {savedPosition}º lugar!
                        </p>
                      )}
                      {outcome === "won" && pendingRecord && (
                        <p className="record-saved" role="status">
                          Seu nome poderá ser registrado em instantes.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
              {phase === "FEEDBACK" && (
                <div className="message">
                  <h2>
                    {reason === "early" ? "Cedo demais!" : `${milliseconds} ms`}
                  </h2>
                  <p>
                    {attempt < 3
                      ? "Vamos focar de novo..."
                      : "Não foi dessa vez."}
                  </p>
                </div>
              )}
              {phase === "INTERRUPTED" && (
                <div className="message">
                  <h2>Rodada interrompida.</h2>
                  <p>A tela perdeu o foco.</p>
                </div>
              )}
              {!active && !pendingRecord && !pendingPreview && (
                <p className="continue-hint" data-testid="continue-hint">
                  Aperte <kbd>Espaço</kbd> ou toque/clique na tela para{" "}
                  {phase === "IDLE" ? "começar" : "prosseguir"}
                </p>
              )}
              {phase === "IDLE" && !pendingRecord && (
                <button
                  className="pending-preview-button"
                  type="button"
                  data-control
                  aria-label={pendingPreview ? "Prévia da pendência ativa" : "Segure para ver o estado de pendência"}
                  aria-pressed={pendingPreview}
                  title="Segure para ver como ficará a tela quando surgir uma pendência"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setPendingPreview(true);
                  }}
                  onPointerUp={() => setPendingPreview(false)}
                  onPointerCancel={() => setPendingPreview(false)}
                  onLostPointerCapture={() => setPendingPreview(false)}
                  onKeyDown={(event) => {
                    if (event.code === "Space" || event.code === "Enter") {
                      event.preventDefault();
                      setPendingPreview(true);
                    }
                  }}
                  onKeyUp={(event) => {
                    if (event.code === "Space" || event.code === "Enter")
                      setPendingPreview(false);
                  }}
                  onBlur={() => setPendingPreview(false)}
                >
                  {pendingPreview ? "Estado de pendência" : "Segure para ver o estado de pendência"}
                </button>
              )}
            </>
          )}
        </div>
      </section>
      {fullscreenError && (
        <div className="fullscreen-notice" role="status">
          {fullscreenError}
        </div>
      )}
      {rankingOpen && (
        <RankingDialog
          entries={ranking}
          onClose={closeRanking}
          onReset={resetLocalRanking}
        />
      )}
      {pendingRecord?.visible && (
        <RecordNameDialog
          milliseconds={pendingRecord.milliseconds}
          difficulty={pendingRecord.difficulty}
          position={pendingRecord.position}
          onSave={saveName}
          onClose={closeNameEntry}
        />
      )}
    </main>
  );
}
