import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { Link } from "react-router-dom";
import RzAmbientStage from "../components/RzAmbientStage";
import OutbreakStatus from "../components/OutbreakStatus";
import {
  getDefaultOverlay,
  getOverlayUrl,
  isAcceptedImageType,
  loadFileImage,
  loadInfectionOverlays,
  type InfectionOverlay,
} from "../lib/infectionOverlays";
import {
  downloadBlob,
  infectedFilename,
  isMobileDevice,
  mergeInfectionImage,
  shareInfectedToX,
  X_INFECTION_SHARE_TEXT,
} from "../lib/mergeInfectionImage";
import { incrementInfectionCount } from "../lib/infectionStats";

type InfectionPhase =
  | "idle"
  | "warning"
  | "progress"
  | "burst"
  | "complete";

const PROGRESS_STEPS = [
  { value: 0, message: "Scanning host..." },
  { value: 10, message: "Scanning host..." },
  { value: 25, message: "Mutating DNA..." },
  { value: 50, message: "Corrupting metadata..." },
  { value: 75, message: "Spreading infection..." },
  { value: 100, message: "Host compromised..." },
];

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function InfectionStation() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nftPreviewRef = useRef<HTMLImageElement>(null);
  const [previewStackWidth, setPreviewStackWidth] = useState<number | null>(
    null,
  );
  const [overlays, setOverlays] = useState<InfectionOverlay[]>([]);
  const [activeOverlay, setActiveOverlay] = useState<InfectionOverlay | null>(
    null,
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [infectedUrl, setInfectedUrl] = useState<string | null>(null);
  const [infectedBlob, setInfectedBlob] = useState<Blob | null>(null);
  const [infectionLevel, setInfectionLevel] = useState(0);
  const [phase, setPhase] = useState<InfectionPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharingToX, setSharingToX] = useState(false);
  const [pfpDownloaded, setPfpDownloaded] = useState(false);

  const controlsLocked =
    phase !== "idle" && phase !== "complete" ? true : phase === "complete";

  const uploadDisabled = controlsLocked || phase === "complete";
  const canInfect = Boolean(uploadedFile && previewUrl && phase === "idle");

  const syncPreviewWidth = useCallback(() => {
    const img = nftPreviewRef.current;
    if (!img) return;
    const width = img.getBoundingClientRect().width;
    if (width > 0) setPreviewStackWidth(Math.round(width));
  }, []);

  useEffect(() => {
    loadInfectionOverlays()
      .then((items) => {
        setOverlays(items);
        setActiveOverlay(getDefaultOverlay(items));
      })
      .catch(() => {
        setError("Unable to load infection overlays.");
      });
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (infectedUrl) URL.revokeObjectURL(infectedUrl);
    };
  }, [previewUrl, infectedUrl]);

  useEffect(() => {
    if (!previewUrl) {
      setPreviewStackWidth(null);
      return;
    }

    syncPreviewWidth();
    const img = nftPreviewRef.current;
    if (!img) return;

    const observer = new ResizeObserver(syncPreviewWidth);
    observer.observe(img);
    window.addEventListener("resize", syncPreviewWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncPreviewWidth);
    };
  }, [previewUrl, syncPreviewWidth]);

  const resetUpload = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (infectedUrl) URL.revokeObjectURL(infectedUrl);
    setUploadedFile(null);
    setPreviewUrl(null);
    setInfectedUrl(null);
    setInfectedBlob(null);
    setInfectionLevel(0);
    setPhase("idle");
    setProgress(0);
    setStatusMessage("");
    setError(null);
    setShareNotice(null);
    setShareModalOpen(false);
    setPfpDownloaded(false);
    setPreviewStackWidth(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [previewUrl, infectedUrl]);

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file || uploadDisabled) return;
      if (!isAcceptedImageType(file)) {
        setError("Upload PNG, JPG, or WEBP only.");
        return;
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (infectedUrl) URL.revokeObjectURL(infectedUrl);

      setError(null);
      setShareNotice(null);
      setUploadedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setInfectedUrl(null);
      setInfectedBlob(null);
      setInfectionLevel(0);
      setPhase("idle");
      setProgress(0);
      setStatusMessage("");
      setPreviewStackWidth(null);
    },
    [previewUrl, infectedUrl, uploadDisabled],
  );

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0] ?? null);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    handleFile(event.dataTransfer.files[0] ?? null);
  };

  const runInfectionSequence = async () => {
    if (!uploadedFile || !previewUrl || !activeOverlay) return;

    setError(null);
    setShareNotice(null);
    if (activeOverlay) {
      const preload = new Image();
      preload.src = getOverlayUrl(activeOverlay.filename);
    }

    setPhase("warning");
    setStatusMessage("UNKNOWN PATHOGEN DETECTED");
    await wait(800);

    setPhase("progress");
    for (const step of PROGRESS_STEPS) {
      setProgress(step.value);
      setInfectionLevel(step.value);
      setStatusMessage(step.message);
      await wait(step.value === 100 ? 500 : 380);
    }

    setPhase("burst");
    setStatusMessage("Host compromised...");

    const mergePromise = (async () => {
      const nftImage = await loadFileImage(uploadedFile);
      return mergeInfectionImage(
        nftImage,
        activeOverlay.filename,
        activeOverlay.underlay,
      );
    })();

    await wait(650);

    try {
      const blob = await mergePromise;
      const url = URL.createObjectURL(blob);
      setInfectedBlob(blob);
      setInfectedUrl(url);
      setInfectionLevel(100);
      setPhase("complete");

      // Global counter — fire-and-forget; image generation never depends on this.
      void incrementInfectionCount().catch((err) => {
        console.error("[ratzilla] failed to increment infection counter:", err);
      });
    } catch {
      setError("Infection failed. Try another image.");
      setPhase("idle");
      setProgress(0);
      setInfectionLevel(0);
    }
  };

  const onDownloadPfp = () => {
    if (!infectedBlob || !uploadedFile) return;
    downloadBlob(infectedBlob, infectedFilename(uploadedFile.name));
    setPfpDownloaded(true);
    setShareNotice("Downloaded — now tap REPORT TO X and attach the image in your post.");
  };

  const onReportToX = () => {
    if (!infectedBlob || sharingToX) return;
    setShareNotice(null);
    setSharingToX(true);
    try {
      shareInfectedToX(X_INFECTION_SHARE_TEXT);
      setShareNotice(
        isMobileDevice()
          ? pfpDownloaded
            ? "Opening X — attach your downloaded infected image, then post."
            : "Opening X — download your infected image first, then attach it in your post."
          : pfpDownloaded
            ? "X opened — click the image icon, attach your downloaded infected image, then post."
            : "X opened — download your infected image first, then attach it using the image button.",
      );
    } finally {
      setSharingToX(false);
    }
  };

  useEffect(() => {
    if (!shareModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShareModalOpen(false);
        setShareNotice(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [shareModalOpen]);

  const displayImage = infectedUrl ?? previewUrl;
  const stageClass = useMemo(() => {
    const classes = ["rz-infection"];
    if (phase === "warning" || phase === "progress") classes.push("is-alarm");
    if (phase === "burst") classes.push("is-burst");
    if (phase === "complete") classes.push("is-infected");
    return classes.join(" ");
  }, [phase]);

  return (
    <RzAmbientStage className={stageClass}>
      <Link to="/" className="rz-infection__sewer-btn">
        ← BACK TO SEWER
      </Link>

      <OutbreakStatus className="rz-outbreak--dock" />

      <div className={`rz-infection__shell ${phase === "warning" || phase === "progress" ? "is-shaking" : ""}`}>
        <header className="rz-infection__header">
          <h1 className="rz-infection__title">INFECTION STATION</h1>
          <p className="rz-infection__subtitle">
            Upload your NFT and allow the infection to spread.
          </p>
          <p className="rz-infection__tagline">Once infected, there is no cure.</p>
        </header>

        {phase === "warning" && (
          <div className="rz-infection__warning-banner" role="alert">
            <span className="rz-infection__warning-label">WARNING:</span>
            <span>{statusMessage}</span>
          </div>
        )}

        <section className="rz-infection__step rz-infection__step--upload">
          <h2 className="rz-infection__step-title">STEP 1 — UPLOAD NFT</h2>
          <div
            className={`rz-infection__dropzone ${dragActive ? "is-drag" : ""} ${uploadDisabled ? "is-disabled" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              if (!uploadDisabled) setDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (!uploadDisabled) setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => {
              if (!uploadDisabled) fileInputRef.current?.click();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (!uploadDisabled) fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={uploadDisabled ? -1 : 0}
            aria-disabled={uploadDisabled}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="rz-infection__file-input"
              onChange={onInputChange}
              disabled={uploadDisabled}
            />
            <p className="rz-infection__dropzone-title">☣ UPLOAD NFT</p>
            <p className="rz-infection__dropzone-hint">PNG · JPG · WEBP</p>
          </div>
          {error && <p className="rz-infection__error">{error}</p>}
        </section>

        {displayImage && (
          <section className="rz-infection__step">
            <h2 className="rz-infection__step-title">STEP 2 — INFECTION PREVIEW</h2>
            <div className="rz-infection__chamber">
              <div className="rz-infection__hazard" aria-hidden="true" />
              <div className="rz-infection__chamber-inner">
                {infectedUrl ? (
                  <img
                    src={displayImage}
                    alt="NFT infection preview"
                    className="rz-infection__preview"
                  />
                ) : (
                  <div
                    className="rz-infection__preview-stack"
                    style={
                      previewStackWidth
                        ? { width: `${previewStackWidth}px` }
                        : undefined
                    }
                  >
                    <div className="rz-infection__preview-frame">
                      <img
                        ref={nftPreviewRef}
                        src={previewUrl ?? ""}
                        alt="NFT infection preview"
                        className="rz-infection__preview-top"
                        onLoad={syncPreviewWidth}
                      />
                      {phase === "burst" && activeOverlay && (
                        <img
                          src={getOverlayUrl(activeOverlay.filename)}
                          alt=""
                          className="rz-infection__overlay-slap"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    {activeOverlay?.underlay && previewStackWidth !== null && (
                      <img
                        src={getOverlayUrl(activeOverlay.underlay)}
                        alt=""
                        className="rz-infection__underlay-strip"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                )}
                <div className="rz-infection__level">
                  INFECTION LEVEL: {infectionLevel}%
                </div>
              </div>
            </div>

            {phase === "progress" && (
              <div className="rz-infection__progress-wrap">
                <div className="rz-infection__progress-bar">
                  <div
                    className="rz-infection__progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="rz-infection__progress-msg">{statusMessage}</p>
              </div>
            )}

            {canInfect && (
              <button
                type="button"
                className="rz-infection__infect-btn"
                onClick={() => {
                  void runInfectionSequence();
                }}
              >
                ☣️ INFECT ME ☣️
              </button>
            )}

            {phase === "complete" && (
              <div className="rz-infection__complete">
                <p className="rz-infection__complete-title">☣️ HOST INFECTED ☣️</p>
                <p className="rz-infection__complete-copy">
                  You are now part of the outbreak.
                </p>

                <div className="rz-infection__complete-actions">
                  <button
                    type="button"
                    className="rz-infection__download-btn"
                    onClick={() => setShareModalOpen(true)}
                  >
                    SHARE INFECTED NFT
                  </button>

                  <button
                    type="button"
                    className="rz-infection__reset"
                    onClick={resetUpload}
                  >
                    Infect another host
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {overlays.length > 1 && phase === "idle" && (
          <div className="rz-infection__variants">
            {overlays.map((overlay) => (
              <button
                key={overlay.id}
                type="button"
                className={`rz-infection__variant ${activeOverlay?.id === overlay.id ? "is-active" : ""}`}
                onClick={() => setActiveOverlay(overlay)}
              >
                {overlay.name}
              </button>
            ))}
          </div>
        )}

        <footer className="rz-infection__footer">
          <p className="rz-infection__powered">
            Powered by Little Ollie Labs for BlackWater Labs
          </p>
        </footer>

        <div className="rz-infection__alarm-flash" aria-hidden="true" />
        <div className="rz-infection__burst" aria-hidden="true" />
        <div className="rz-infection__flash-white" aria-hidden="true" />
        <div className="rz-infection__glitch-lines" aria-hidden="true" />
      </div>

      {shareModalOpen && phase === "complete" && (
        <div
          className="rz-infection-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rz-infection-modal-title"
        >
          <button
            type="button"
            className="rz-infection-modal__backdrop"
            aria-label="Close"
            onClick={() => {
              setShareModalOpen(false);
              setShareNotice(null);
            }}
          />
          <div className="rz-infection-modal__panel">
            <button
              type="button"
              className="rz-infection-modal__close"
              aria-label="Close"
              onClick={() => {
                setShareModalOpen(false);
                setShareNotice(null);
              }}
            >
              ×
            </button>

            <p
              id="rz-infection-modal-title"
              className="rz-infection-modal__headline"
            >
              ⚠️ INFECTION CONFIRMED ⚠️
            </p>

            <div className="rz-infection-modal__body">
              <p>You have been registered as a Blackwater Subject.</p>
              <p>The outbreak continues to spread.</p>
              <p>Help us identify additional subjects.</p>
            </div>

            {infectedUrl && (
              <img
                src={infectedUrl}
                alt="Your infected PFP"
                className="rz-infection-modal__preview"
              />
            )}

            <ol className="rz-infection-modal__steps">
              <li>Download your infected image</li>
              <li>Open X and attach it to your post</li>
            </ol>

            <div className="rz-infection-modal__actions">
              <button
                type="button"
                className="rz-infection-modal__btn rz-infection-modal__btn--download"
                onClick={onDownloadPfp}
              >
                DOWNLOAD INFECTED IMAGE
              </button>
              <button
                type="button"
                className="rz-infection-modal__btn rz-infection-modal__btn--x"
                disabled={sharingToX}
                onClick={onReportToX}
              >
                {sharingToX ? "OPENING X…" : "REPORT TO X"}
              </button>
            </div>

            {shareNotice && (
              <p className="rz-infection-modal__note">{shareNotice}</p>
            )}
          </div>
        </div>
      )}
    </RzAmbientStage>
  );
}
