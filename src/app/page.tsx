'use client';

import { useState, useRef, useCallback } from 'react';

// ═══════════════════════════════════════
// API CONFIG
// ═══════════════════════════════════════
const API_BASE = 'https://roomix-featureproposal.tuweben72hs.com';

// ═══════════════════════════════════════
// DATA TYPES
// ═══════════════════════════════════════
interface SegmentedFurniture {
  id: string;
  imageUrl: string;       // URL del PNG recortado transparente (del VPS)
  label: string;          // "Mueble 1", "Mueble 2", etc.
  selected: boolean;      // Si está seleccionado para la composición
  clickCoords: { x: number; y: number };
}

interface ClickPin {
  x: number;
  y: number;
  id: string;
  status: 'pending' | 'done' | 'error';
}

type AppStep = 'upload-source' | 'segment' | 'upload-dest' | 'compose' | 'result';

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export default function Home() {
  // Flujo principal
  const [currentStep, setCurrentStep] = useState<AppStep>('upload-source');

  // Imagen origen (casa del usuario)
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceImageFile, setSourceImageFile] = useState<string | null>(null); // URL pública en VPS

  // Muebles segmentados
  const [segmentedFurniture, setSegmentedFurniture] = useState<SegmentedFurniture[]>([]);
  const [clickPins, setClickPins] = useState<ClickPin[]>([]);

  // Imagen destino (nueva casa)
  const [destinationImage, setDestinationImage] = useState<string | null>(null);
  const [destinationImageUrl, setDestinationImageUrl] = useState<string | null>(null); // URL pública en VPS
  const [cleanDestinationImage, setCleanDestinationImage] = useState<string | null>(null);

  // Resultado final
  const [compositeResult, setCompositeResult] = useState<string | null>(null);

  // Estados de carga
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Refs
  const sourceFileRef = useRef<HTMLInputElement>(null);
  const destFileRef = useRef<HTMLInputElement>(null);

  // ═══════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════

  // 1. Subir foto de la casa del usuario
  const handleSourceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview local inmediato
    const localUrl = URL.createObjectURL(file);
    setSourceImage(localUrl);
    setCurrentStep('segment');
    setSegmentedFurniture([]);
    setClickPins([]);
    setStatusMessage('Subiendo imagen al servidor...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (data.success && data.url) {
        setSourceImageFile(data.url);
        setStatusMessage('✅ Imagen subida. Hacé clic sobre tus muebles para recortarlos.');
      } else {
        setStatusMessage('⚠️ Error al subir. Podés seguir con preview local.');
        setSourceImageFile(localUrl);
      }
    } catch {
      setStatusMessage('⚠️ Servidor no disponible. Usando preview local.');
      setSourceImageFile(localUrl);
    }
  };

  // 2. Clic en la imagen para segmentar un mueble
  const handleSourceImageClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!sourceImageFile || isSegmenting) return;
    if (segmentedFurniture.length >= 5) {
      setStatusMessage('⚠️ Máximo 5 muebles. Eliminá uno para agregar otro.');
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    const pinId = `pin-${Date.now()}`;
    const newPin: ClickPin = { x: xPct, y: yPct, id: pinId, status: 'pending' };
    setClickPins(prev => [...prev, newPin]);

    setIsSegmenting(true);
    setStatusMessage('🤖 SAM 2 está recortando tu mueble...');

    try {
      const response = await fetch(`${API_BASE}/api/segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: sourceImageFile,
          x: xPct / 100,
          y: yPct / 100,
          label: 1
        })
      });
      const data = await response.json();

      if (data.success && data.furniture_url) {
        const furnitureId = `furniture-${Date.now()}`;
        const newItem: SegmentedFurniture = {
          id: furnitureId,
          imageUrl: data.furniture_url,
          label: `Mueble ${segmentedFurniture.length + 1}`,
          selected: true,
          clickCoords: { x: xPct, y: yPct }
        };
        setSegmentedFurniture(prev => [...prev, newItem]);
        setClickPins(prev => prev.map(p => p.id === pinId ? { ...p, status: 'done' } : p));
        setStatusMessage(`✅ ¡Mueble ${segmentedFurniture.length + 1} recortado! Seguí clickeando o pasá al siguiente paso.`);
      } else if (data.mode === 'demo_fallback') {
        // Demo mode — simular con placeholder
        const furnitureId = `furniture-${Date.now()}`;
        const newItem: SegmentedFurniture = {
          id: furnitureId,
          imageUrl: data.masked_image_url || sourceImageFile,
          label: `Mueble ${segmentedFurniture.length + 1} (demo)`,
          selected: true,
          clickCoords: { x: xPct, y: yPct }
        };
        setSegmentedFurniture(prev => [...prev, newItem]);
        setClickPins(prev => prev.map(p => p.id === pinId ? { ...p, status: 'done' } : p));
        setStatusMessage(`✅ Mueble detectado (modo demo). Configurá REPLICATE_API_TOKEN en el VPS para recorte real.`);
      } else {
        setClickPins(prev => prev.map(p => p.id === pinId ? { ...p, status: 'error' } : p));
        setStatusMessage('❌ No se pudo recortar el mueble. Intentá en otra zona.');
      }
    } catch {
      setClickPins(prev => prev.map(p => p.id === pinId ? { ...p, status: 'error' } : p));
      setStatusMessage('❌ Error de conexión con el servidor. Verificá que el backend esté corriendo.');
    } finally {
      setIsSegmenting(false);
    }
  }, [sourceImageFile, isSegmenting, segmentedFurniture.length]);

  // 3. Toggle selección de un mueble
  const toggleFurnitureSelection = (id: string) => {
    setSegmentedFurniture(prev =>
      prev.map(f => f.id === id ? { ...f, selected: !f.selected } : f)
    );
  };

  // 4. Eliminar un mueble del inventario
  const removeFurniture = (id: string) => {
    setSegmentedFurniture(prev => prev.filter(f => f.id !== id));
  };

  // 5. Subir foto de la casa destino
  const handleDestinationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    setDestinationImage(localUrl);
    setCleanDestinationImage(null);
    setCompositeResult(null);
    setCurrentStep('compose');
    setStatusMessage('Subiendo imagen destino al servidor...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (data.success && data.url) {
        setDestinationImageUrl(data.url);
        setStatusMessage('✅ Imagen destino subida. Presioná "Vaciar y Amueblar con IA" para continuar.');
      } else {
        setStatusMessage('⚠️ Error al subir imagen destino.');
      }
    } catch {
      setStatusMessage('⚠️ Servidor no disponible para subir destino.');
    }
  };

  // 6. FLUJO COMPLETO: Vaciar destino + componer muebles
  const handleComposeWithAI = async () => {
    if (!destinationImageUrl) {
      setStatusMessage('⚠️ Primero subí la foto de la casa destino.');
      return;
    }

    const selectedFurniture = segmentedFurniture.filter(f => f.selected);
    if (selectedFurniture.length === 0) {
      setStatusMessage('⚠️ Seleccioná al menos un mueble del inventario.');
      return;
    }

    setIsComposing(true);
    setCompositeResult(null);

    // PASO 1: Vaciar la casa destino con LaMa
    setStatusMessage('🧹 Paso 1/2: Vaciando la casa destino con IA (LaMa Inpainting)...');
    setIsCleaning(true);

    try {
      const cleanResponse = await fetch(`${API_BASE}/api/clean-property`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: destinationImageUrl })
      });
      const cleanData = await cleanResponse.json();

      let cleanUrl = destinationImageUrl;
      if (cleanData.success && cleanData.clean_image_url) {
        cleanUrl = cleanData.clean_image_url;
        setCleanDestinationImage(cleanUrl);
      }
      setIsCleaning(false);

      // PASO 2: Componer muebles en la casa vacía con FLUX Fill
      setStatusMessage('🎨 Paso 2/2: La IA está colocando tus muebles en la nueva casa (15-30 seg)...');

      const composeResponse = await fetch(`${API_BASE}/api/compose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clean_room_url: cleanUrl,
          furniture_urls: selectedFurniture.map(f => f.imageUrl),
          room_description: 'living room'
        })
      });
      const composeData = await composeResponse.json();

      if (composeData.success && composeData.composed_image_url) {
        setCompositeResult(composeData.composed_image_url);
        setCurrentStep('result');
        setStatusMessage('🎉 ¡Listo! Así quedaría tu nueva casa con tus muebles.');
      } else {
        setStatusMessage('❌ Error al componer la imagen. Intentá de nuevo.');
      }
    } catch (error) {
      console.error('Compose error:', error);
      setStatusMessage('❌ Error de conexión. Verificá que el backend esté corriendo.');
    } finally {
      setIsCleaning(false);
      setIsComposing(false);
    }
  };

  // 7. Resetear todo
  const handleReset = () => {
    setSourceImage(null);
    setSourceImageFile(null);
    setSegmentedFurniture([]);
    setClickPins([]);
    setDestinationImage(null);
    setDestinationImageUrl(null);
    setCleanDestinationImage(null);
    setCompositeResult(null);
    setCurrentStep('upload-source');
    setStatusMessage(null);
  };

  // Helpers
  const selectedCount = segmentedFurniture.filter(f => f.selected).length;
  const hasSelectedFurniture = selectedCount > 0;

  return (
    <>
      {/* ═══════ NAVBAR ═══════ */}
      <nav className="nav">
        <a href="/" className="nav-logo" onClick={(e) => { e.preventDefault(); handleReset(); }}>
          ROOM<span>IX</span>
          <span className="nav-logo-badge">Virtual Mover</span>
        </a>
        <ul className="nav-links">
          <li><a href="#demo">Simulador</a></li>
          <li><a href="#arquitectura">Cómo Funciona</a></li>
        </ul>
        <button onClick={handleReset} className="nav-cta">
          Nueva Sesión ↻
        </button>
      </nav>

      {/* ═══════ HERO AREA ═══════ */}
      <section className="hero">
        <span className="hero-tag">ROOMIX VIRTUAL MOVER — IA REAL</span>
        <h1>Mudate con tus muebles,<br />no con tus dudas.</h1>
        <p>
          Subí una foto de tu living actual, hacé clic en tus muebles para que la IA los recorte con <strong>SAM 2</strong>, 
          subí la foto de tu nueva casa, y dejá que la IA vacíe los muebles viejos y coloque los tuyos automáticamente.
        </p>
      </section>

      {/* ═══════ PROGRESS STEPS ═══════ */}
      <div className="process-indicator">
        <div className={`process-step-badge ${currentStep === 'upload-source' ? 'active' : ''} ${sourceImage ? 'completed' : ''}`}>
          <div className="process-step-num">{sourceImage ? '✓' : '1'}</div>
          <span>Subí tu foto</span>
        </div>
        <div className={`process-step-badge ${currentStep === 'segment' ? 'active' : ''} ${segmentedFurniture.length > 0 ? 'completed' : ''}`}>
          <div className="process-step-num">{segmentedFurniture.length > 0 ? '✓' : '2'}</div>
          <span>Recortá muebles</span>
        </div>
        <div className={`process-step-badge ${currentStep === 'upload-dest' || currentStep === 'compose' ? 'active' : ''} ${destinationImage ? 'completed' : ''}`}>
          <div className="process-step-num">{destinationImage ? '✓' : '3'}</div>
          <span>Casa destino</span>
        </div>
        <div className={`process-step-badge ${currentStep === 'result' ? 'active' : ''}`}>
          <div className="process-step-num">{compositeResult ? '✓' : '4'}</div>
          <span>Resultado IA</span>
        </div>
      </div>

      {/* ═══════ STATUS BAR ═══════ */}
      {statusMessage && (
        <div className="status-bar">
          <div className="status-content">
            {(isSegmenting || isCleaning || isComposing) && <span className="status-spinner" />}
            <span>{statusMessage}</span>
          </div>
        </div>
      )}

      {/* ═══════ WORKSPACE ═══════ */}
      <section className="workspace" id="demo">
        <div className="workspace-grid">

          {/* ═══════ COLUMNA IZQUIERDA: CASA ORIGEN + INVENTARIO ═══════ */}
          <div className="segmenter-card">
            <div className="segmenter-header">
              <h3>🏠 Tu Casa Actual</h3>
              <p>Subí una foto y hacé clic sobre cada mueble que quieras llevar a tu nueva casa.</p>
            </div>

            {/* Zona de subida o foto interactiva */}
            {!sourceImage ? (
              <div className="upload-zone" onClick={() => sourceFileRef.current?.click()}>
                <input
                  type="file"
                  ref={sourceFileRef}
                  onChange={handleSourceUpload}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                <div className="upload-icon">📸</div>
                <div className="upload-text">
                  <h5>Subí una foto de tu living actual</h5>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Hacé clic para seleccionar una foto de tu PC
                  </p>
                </div>
              </div>
            ) : (
              <div className="segmenter-view-container" onClick={handleSourceImageClick}>
                <img
                  src={sourceImage || undefined}
                  alt="Tu casa actual"
                  className="segmenter-img"
                  style={{ filter: isSegmenting ? 'brightness(0.6)' : 'brightness(1)' }}
                />

                {/* Scan overlay */}
                {isSegmenting && <div className="segmenter-scan-overlay active" />}

                {/* Click pins */}
                {clickPins.map(pin => (
                  <div
                    key={pin.id}
                    className={`sam-click-pin ${pin.status}`}
                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  />
                ))}

                {/* Crosshair hint */}
                {!isSegmenting && segmentedFurniture.length === 0 && (
                  <div className="click-hint">
                    <span>👆 Hacé clic en un mueble para recortarlo</span>
                  </div>
                )}
              </div>
            )}

            {/* Botón para cambiar la foto */}
            {sourceImage && (
              <button
                onClick={() => sourceFileRef.current?.click()}
                className="btn-change-photo"
              >
                <input
                  type="file"
                  ref={sourceFileRef}
                  onChange={handleSourceUpload}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                📷 Cambiar foto
              </button>
            )}

            {/* INVENTARIO DE MUEBLES RECORTADOS */}
            {sourceImage && (
              <div className="inventory-section">
                <h4 className="inventory-title">
                  <span>📦</span> Muebles recortados ({segmentedFurniture.length}/5)
                </h4>

                {segmentedFurniture.length === 0 ? (
                  <p className="inventory-empty">
                    Hacé clic sobre los muebles de tu foto para que la IA los recorte automáticamente.
                  </p>
                ) : (
                  <div className="inventory-list">
                    {segmentedFurniture.map(item => (
                      <div
                        key={item.id}
                        className={`inventory-item ${item.selected ? 'active' : ''}`}
                      >
                        <div
                          className="item-checkbox"
                          onClick={() => toggleFurnitureSelection(item.id)}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>

                        <div className="item-thumb-wrapper" onClick={() => toggleFurnitureSelection(item.id)}>
                          <img
                            src={item.imageUrl}
                            alt={item.label}
                            className="item-thumb"
                          />
                        </div>

                        <div className="item-info" onClick={() => toggleFurnitureSelection(item.id)}>
                          <div className="item-name">{item.label}</div>
                          <div className="item-specs">
                            <span>Recortado con SAM 2</span>
                          </div>
                        </div>

                        <button
                          className="item-remove"
                          onClick={(e) => { e.stopPropagation(); removeFurniture(item.id); }}
                          title="Eliminar mueble"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Botón para avanzar al siguiente paso */}
                {hasSelectedFurniture && !destinationImage && (
                  <button
                    className="btn-next-step"
                    onClick={() => { setCurrentStep('upload-dest'); destFileRef.current?.click(); }}
                  >
                    Siguiente: Subir foto de la nueva casa →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ═══════ COLUMNA DERECHA: CASA DESTINO + RESULTADO ═══════ */}
          <div className="canvas-panel">
            <div className="canvas-header">
              <div className="property-title">
                <h4>🏗️ Tu Nueva Casa</h4>
                <p>
                  <span>Subí la foto de tu futuro hogar</span>
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => destFileRef.current?.click()}
                  className="btn-upload-dest"
                >
                  <input
                    type="file"
                    ref={destFileRef}
                    onChange={handleDestinationUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                  ⬆ Subir foto destino
                </button>
                <div className="badge-ai-audit">
                  <span className="pulse-dot" />
                  AI Powered
                </div>
              </div>
            </div>

            {/* CANVAS DE VISUALIZACIÓN */}
            <div className="workspace-canvas">
              {!destinationImage && !compositeResult ? (
                /* Estado vacío — pedir que suba foto destino */
                <div className="canvas-empty-state">
                  <div className="empty-state-content">
                    {!hasSelectedFurniture ? (
                      <>
                        <h5>Primero recortá tus muebles</h5>
                        <p>Usá el panel izquierdo para subir la foto de tu casa y recortar los muebles que querés mudar.</p>
                      </>
                    ) : (
                      <>
                        <h5>Ahora subí la foto de tu nueva casa</h5>
                        <p>Tenés {selectedCount} mueble{selectedCount > 1 ? 's' : ''} listo{selectedCount > 1 ? 's' : ''}. Subí la foto del departamento destino para que la IA los coloque.</p>
                        <button
                          className="btn-upload-inline"
                          onClick={() => destFileRef.current?.click()}
                        >
                          📸 Subir foto de la nueva casa
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : compositeResult ? (
                /* RESULTADO FINAL */
                <div className="result-container">
                  <img
                    src={compositeResult || undefined}
                    alt="Tu nueva casa con tus muebles"
                    className="result-img"
                  />
                  <div className="result-badge">✨ Resultado IA</div>
                </div>
              ) : (
                /* Foto del destino subida pero no procesada */
                <div className="canvas-image-wrapper">
                  <img
                    src={cleanDestinationImage || destinationImage || undefined}
                    alt="Casa destino"
                    className="canvas-bg"
                    style={{
                      opacity: 1,
                      filter: (isCleaning || isComposing) ? 'brightness(0.4)' : 'brightness(1)'
                    }}
                  />

                  {/* Scanner effect while processing */}
                  {(isCleaning || isComposing) && (
                    <div className="canvas-scanner active" />
                  )}

                  {/* Processing overlay */}
                  {(isCleaning || isComposing) && (
                    <div className="processing-overlay">
                      <div className="processing-content">
                        <div className="processing-spinner" />
                        <h5>{isCleaning ? 'Vaciando la casa...' : 'Colocando tus muebles...'}</h5>
                        <p>{isCleaning ? 'LaMa Inpainting está eliminando los muebles existentes' : 'FLUX Fill está componiendo tus muebles con perspectiva y sombras reales'}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* BOTÓN DE ACCIÓN PRINCIPAL */}
            {destinationImage && !compositeResult && (
              <button
                className="btn-compose"
                onClick={handleComposeWithAI}
                disabled={isComposing || !hasSelectedFurniture}
              >
                {isComposing ? (
                  <>
                    <span className="btn-spinner" />
                    Procesando con IA...
                  </>
                ) : (
                  <>🧹🎨 Vaciar Casa + Colocar Mis Muebles con IA</>
                )}
              </button>
            )}

            {/* Botón reiniciar después del resultado */}
            {compositeResult && (
              <div className="result-actions">
                <button className="btn-compose" onClick={handleReset}>
                  🔄 Nueva mudanza virtual
                </button>
                <a
                  href={compositeResult}
                  download="roomix-resultado.png"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-download"
                >
                  ⬇ Descargar resultado
                </a>
              </div>
            )}

            {/* BEFORE/AFTER COMPARISON (only when we have result) */}
            {compositeResult && cleanDestinationImage && (
              <div className="comparison-section">
                <h4>📊 Comparación Antes / Después</h4>
                <div className="comparison-grid">
                  <div className="comparison-card">
                    <span className="comparison-label">Casa destino original</span>
                    <img src={destinationImage!} alt="Antes" />
                  </div>
                  <div className="comparison-card">
                    <span className="comparison-label">Vaciada con LaMa</span>
                    <img src={cleanDestinationImage || undefined} alt="Vaciada" />
                  </div>
                  <div className="comparison-card highlight">
                    <span className="comparison-label">Con tus muebles (FLUX)</span>
                    <img src={compositeResult || undefined} alt="Resultado" />
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ═══════ CÓMO FUNCIONA ═══════ */}
      <section className="explainer" id="arquitectura">
        <div className="explainer-card">
          <h3>La Tecnología Detrás de la Mudanza Virtual</h3>
          <div className="explainer-grid">

            <div className="explainer-item">
              <div className="explainer-item-num">01</div>
              <h4>Recorte con SAM 2</h4>
              <p>
                Al hacer clic sobre un mueble, enviamos las coordenadas a <strong>Meta SAM 2</strong> (Segment Anything Model), 
                que genera una máscara precisa. Luego recortamos el mueble como PNG transparente con Pillow.
              </p>
            </div>

            <div className="explainer-item">
              <div className="explainer-item-num">02</div>
              <h4>Vaciado con LaMa</h4>
              <p>
                La casa destino se vacía usando <strong>LaMa Inpainting</strong>, un modelo de restauración que 
                rellena las zonas de muebles con la textura del piso y las paredes de fondo.
              </p>
            </div>

            <div className="explainer-item">
              <div className="explainer-item-num">03</div>
              <h4>Composición con FLUX Fill</h4>
              <p>
                Finalmente, <strong>FLUX Fill Dev</strong> de Black Forest Labs compone tus muebles reales en la 
                habitación vacía, respetando perspectiva, iluminación y sombras.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="footer">
        <div className="footer-brand">ROOM<span>IX</span></div>
        <p>Virtual Mover — Powered by SAM 2, LaMa & FLUX Fill • 2026</p>
      </footer>
    </>
  );
}
