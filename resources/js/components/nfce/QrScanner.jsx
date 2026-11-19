import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBolt, faCameraRotate, faImage, faTriangleExclamation, faVideoSlash, faCircleCheck,
} from "@fortawesome/free-solid-svg-icons";
import { Button } from "../ui/Button.jsx";
import { parseNfceInput, INPUT_ERRORS } from "../../utils/nfce.js";

const HINT_AFTER_MS = 15000;

/**
 * Leitura do QR Code da NFC-e pela câmera (ao vivo) ou por uma foto.
 * A biblioteca só é carregada quando este componente aparece.
 * A câmera é desligada ao desmontar (trocar de aba, fechar o modal, concluir a leitura).
 */
export function QrScanner({ onResult, onUseLink }) {
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const libRef = useRef(null);
  const fileRef = useRef(null);
  const doneRef = useRef(false);
  const lastInvalidRef = useRef("");
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const [status, setStatus] = useState("starting"); // starting | scanning | found | denied | unavailable
  const [warning, setWarning] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [cameraIdx, setCameraIdx] = useState(0);
  const [readingPhoto, setReadingPhoto] = useState(false);

  /** Trata um conteúdo lido. Retorna true se era uma NFC-e válida. */
  const handleText = (text) => {
    if (doneRef.current) return true;
    const { key, reason } = parseNfceInput(text);
    if (!key) {
      if (lastInvalidRef.current !== text) {
        lastInvalidRef.current = text;
        setWarning(reason === "state" || reason === "model"
          ? INPUT_ERRORS[reason]
          : "Este QR Code não é de uma nota fiscal. Aponte para o QR Code do rodapé do cupom.");
        setTimeout(() => setWarning(""), 3500);
      }
      return false;
    }
    doneRef.current = true;
    setStatus("found");
    try { navigator.vibrate?.(80); } catch { /* sem vibração */ }
    scannerRef.current?.stop();
    setTimeout(() => onResultRef.current(text), 350);
    return true;
  };

  useEffect(() => {
    let cancelled = false;
    const hintTimer = setTimeout(() => !doneRef.current && setShowHint(true), HINT_AFTER_MS);

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus("unavailable");
        return;
      }
      const { default: QrScanner } = await import("qr-scanner");
      if (cancelled) return;
      libRef.current = QrScanner;

      const scanner = new QrScanner(videoRef.current, (r) => handleText(r.data), {
        preferredCamera: "environment",
        returnDetailedScanResult: true,
        maxScansPerSecond: 12,
      });
      scannerRef.current = scanner;

      try {
        await scanner.start();
        if (cancelled) return;
        setStatus("scanning");
        setHasFlash(await scanner.hasFlash());
        const list = await QrScanner.listCameras(true);
        if (!cancelled) setCameras(list);
      } catch (err) {
        if (cancelled) return;
        const name = err?.name ?? "";
        setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(hintTimer);
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFlash = async () => {
    const s = scannerRef.current;
    if (!s) return;
    await s.toggleFlash();
    setFlashOn(s.isFlashOn());
  };

  const switchCamera = async () => {
    if (cameras.length < 2 || !scannerRef.current) return;
    const next = (cameraIdx + 1) % cameras.length;
    setCameraIdx(next);
    await scannerRef.current.setCamera(cameras[next].id);
    setHasFlash(await scannerRef.current.hasFlash());
    setFlashOn(false);
  };

  const readPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setReadingPhoto(true);
    setWarning("");
    try {
      const QrScanner = libRef.current ?? (await import("qr-scanner")).default;
      const r = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      handleText(r.data);
    } catch {
      setWarning("Não encontramos um QR Code legível nesta foto. Tente outra foto, mais próxima e com boa luz, ou cole o link da nota.");
    } finally {
      setReadingPhoto(false);
    }
  };

  const cameraBlocked = status === "denied" || status === "unavailable";

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-stone-900">
        <video ref={videoRef} className={`h-full w-full object-cover ${cameraBlocked ? "hidden" : ""}`} muted playsInline />

        {!cameraBlocked && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className={`h-3/5 aspect-square rounded-2xl border-4 transition-colors ${status === "found" ? "border-emerald-400" : "border-white/80"}`} />
          </div>
        )}

        {status === "starting" && (
          <p className="absolute inset-x-0 bottom-3 text-center text-xs text-white/80">Abrindo a câmera…</p>
        )}
        {status === "scanning" && (
          <p className="absolute inset-x-0 bottom-3 px-4 text-center text-xs text-white/90">Aponte para o QR Code no rodapé do cupom</p>
        )}
        {status === "found" && (
          <p className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5 text-sm font-medium text-emerald-300">
            <FontAwesomeIcon icon={faCircleCheck} style={{ height: "1rem" }} /> QR Code lido
          </p>
        )}

        {cameraBlocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white">
            <FontAwesomeIcon icon={faVideoSlash} style={{ height: "1.5rem" }} className="text-white/70" />
            <p className="text-sm font-medium">
              {status === "denied" ? "Sem permissão para usar a câmera" : "Câmera indisponível neste aparelho"}
            </p>
            <p className="text-xs text-white/70">
              {status === "denied"
                ? "Libere a câmera nas configurações do navegador (ícone ao lado do endereço) e abra novamente. Você também pode usar uma foto ou colar o link."
                : "Use uma foto do QR Code ou cole o link da nota."}
            </p>
          </div>
        )}
      </div>

      {warning && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ height: "0.875rem" }} className="mt-0.5" /> {warning}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {hasFlash && (
          <Button variant={flashOn ? "primary" : "subtle"} size="sm" onClick={toggleFlash} aria-pressed={flashOn}>
            <FontAwesomeIcon icon={faBolt} style={{ height: "0.875rem" }} /> Lanterna
          </Button>
        )}
        {cameras.length > 1 && (
          <Button variant="subtle" size="sm" onClick={switchCamera}>
            <FontAwesomeIcon icon={faCameraRotate} style={{ height: "0.875rem" }} /> Trocar câmera
          </Button>
        )}
        <Button variant="subtle" size="sm" onClick={() => fileRef.current?.click()} disabled={readingPhoto}>
          <FontAwesomeIcon icon={faImage} style={{ height: "0.875rem" }} /> {readingPhoto ? "Lendo foto…" : "Ler de uma foto"}
        </Button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={readPhoto} />
      </div>

      {showHint && status === "scanning" && (
        <p className="rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-500">
          Não está lendo? Aproxime o celular, melhore a luz ou{" "}
          <button type="button" onClick={onUseLink} className="font-medium text-stone-800 underline">cole o link da nota</button>.
        </p>
      )}

      <p className="text-center text-xs text-stone-400">
        QR Code ilegível?{" "}
        <button type="button" onClick={onUseLink} className="font-medium text-stone-700 underline hover:text-stone-900">
          Cole o link da nota →
        </button>
      </p>
    </div>
  );
}
