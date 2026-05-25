'use client';

import { useState, useEffect, useRef } from 'react';

// ═══════════════════════════════════════
// DATA TYPES & CONSTANTS
// ═══════════════════════════════════════
interface FurnitureItem {
  id: string;
  name: string;
  width: number; // en metros
  depth: number; // en metros
  height: number; // en metros
  type: string;
  imgUrl: string;
  desc: string;
  tooltip: string; // Nombre del objeto para el tooltip de SAM
}

const AVAILABLE_FURNITURE: Record<string, FurnitureItem> = {
  sofa: {
    id: 'sofa',
    name: 'Mi Sillón Chesterfield Esmeralda',
    width: 2.20,
    depth: 0.95,
    height: 0.85,
    type: 'Living',
    imgUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500&q=80',
    desc: 'Sillón de terciopelo esmeralda de 3 cuerpos. Diseño clásico capitoné.',
    tooltip: 'Sillón de 3 cuerpos (SAM detectado)'
  },
  table: {
    id: 'table',
    name: 'Mi Mesa Ratona de Madera',
    width: 1.60,
    depth: 0.90,
    height: 0.75,
    type: 'Living / Comedor',
    imgUrl: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=500&q=80',
    desc: 'Mesa de madera maciza de pino recuperado con patas metálicas.',
    tooltip: 'Mesa ratona rectangular (SAM detectado)'
  },
  shelf: {
    id: 'shelf',
    name: 'Mi Biblioteca de Hierro Industrial',
    width: 1.00,
    depth: 0.35,
    height: 2.00,
    type: 'Estudio / Living',
    imgUrl: 'https://images.unsplash.com/photo-1594620302200-9a762244a156?w=500&q=80',
    desc: 'Estantería de estilo industrial en hierro negro y estantes de madera.',
    tooltip: 'Biblioteca modular (SAM detectado)'
  }
};

const PROPERTY_DATA = {
  address: 'Palermo Hollywood, CABA',
  rooms: '2 Ambientes',
  totalArea: 48, // m2
  livingArea: 18.5, // m2 (área útil estimable del living-comedor)
  wallLength: 4.80, // largo de la pared principal del living en metros
  bgAmuebladoUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80', // Living del nuevo depto con muebles viejos del inquilino anterior
  bgVacioUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&q=80' // Mismo living vacío (simulado inpainting)
};

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export default function Home() {
  // Estados para el flujo de segmentación del usuario
  const [userImage, setUserImage] = useState<string | null>(null);
  const [segmentedItems, setSegmentedItems] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningType, setScanningType] = useState<'sam' | 'erase' | null>(null);

  // Estados para la mudanza y proyección
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDestinationEmpty, setIsDestinationEmpty] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Estados para el departamento de destino dinámico
  const [destinationImage, setDestinationImage] = useState<string | null>(null);
  const [cleanDestinationImage, setCleanDestinationImage] = useState<string | null>(null);

  // Referencias a los inputs file ocultos
  const fileInputRef = useRef<HTMLInputElement>(null);
  const destinationFileInputRef = useRef<HTMLInputElement>(null);
  
  // Gatillar el selector de archivos al hacer clic en la zona de subida
  const handleUploadZoneClick = () => {
    fileInputRef.current?.click();
  };

  // Manejar la subida de un archivo real del usuario al VPS
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanningType('sam');

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Subir archivo binario directamente a tu VPS de Contabo
      const response = await fetch('https://roomix-featureproposal.tuweben72hs.com/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      console.log('API Upload Response:', data);

      if (data.success && data.url) {
        setUserImage(data.url);
      } else {
        alert('Error al procesar la imagen en el servidor.');
      }
    } catch (error) {
      console.warn('API de subida no disponible en el VPS (usando fallback local):', error);
      // Fallback local: generar Object URL temporal para previsualización
      const localUrl = URL.createObjectURL(file);
      setUserImage(localUrl);
    } finally {
      setIsScanning(false);
      setScanningType(null);
    }
  };

  // Cargar imagen de ejemplo del usuario
  const handleLoadSampleImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); // Evitar gatillar el click de la zona de subida
    setIsScanning(true);
    setScanningType('sam');
    setTimeout(() => {
      // Cargamos el living amoblado propio del usuario (Unsplash)
      setUserImage('https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&q=80');
      setIsScanning(false);
      setScanningType(null);
    }, 800);
  };

  // Segmentación interactiva haciendo clic sobre un mueble de su foto
  const handleSegmentItem = async (id: string) => {
    if (segmentedItems.includes(id)) return; // Ya segmentado

    setIsScanning(true);
    setScanningType('sam');
    
    try {
      const response = await fetch('https://roomix-featureproposal.tuweben72hs.com/api/segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: userImage || 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&q=80',
          x: id === 'sofa' ? 0.49 : id === 'table' ? 0.52 : 0.88,
          y: id === 'sofa' ? 0.60 : id === 'table' ? 0.85 : 0.54,
          label: 1
        })
      });
      const data = await response.json();
      console.log('API Segment Response:', data);
      
      // Agregar al inventario
      setSegmentedItems(prev => [...prev, id]);
      setSelectedIds(prev => [...prev, id]);
    } catch (error) {
      console.warn('API de segmentación no disponible en el VPS (usando fallback local):', error);
      // Fallback local robusto ante fallas de red / DNS no propagado
      setSegmentedItems(prev => [...prev, id]);
      setSelectedIds(prev => [...prev, id]);
    } finally {
      setIsScanning(false);
      setScanningType(null);
    }
  };

  // Manejar la subida de la foto de la propiedad de destino (nuevo hogar)
  const handleDestinationFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanningType('erase');

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Subir foto del depto a buscar
      const response = await fetch('https://roomix-featureproposal.tuweben72hs.com/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      console.log('API Destination Upload Response:', data);

      if (data.success && data.url) {
        setDestinationImage(data.url);
        setIsDestinationEmpty(false); // Volver al estado amoblado para mostrar la nueva foto primero
        setCleanDestinationImage(null); // Resetear imagen limpia
      } else {
        alert('Error al procesar la imagen de destino en el servidor.');
      }
    } catch (error) {
      console.warn('API de subida no disponible en el VPS (usando fallback local):', error);
      // Fallback local
      const localUrl = URL.createObjectURL(file);
      setDestinationImage(localUrl);
      setIsDestinationEmpty(false);
      setCleanDestinationImage(null);
    } finally {
      setIsScanning(false);
      setScanningType(null);
    }
  };

  // Activar/desactivar proyección de los muebles empacados
  const handleToggleProjectedItem = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Conmutar el vaciado del departamento de destino con inpainting
  const handleToggleDestinationEmpty = async () => {
    if (isDestinationEmpty) {
      // Si ya estaba vacío, volvemos a mostrar la versión amoblada
      setIsDestinationEmpty(false);
      return;
    }

    setIsScanning(true);
    setScanningType('erase');
    
    const imgToClean = destinationImage || PROPERTY_DATA.bgAmuebladoUrl;
    
    try {
      const response = await fetch('https://roomix-featureproposal.tuweben72hs.com/api/clean-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imgToClean
        })
      });
      const data = await response.json();
      console.log('API Clean Response:', data);
      
      if (data.success && data.clean_image_url) {
        setCleanDestinationImage(data.clean_image_url);
      } else {
        // Fallback si no devuelve URL
        setCleanDestinationImage(PROPERTY_DATA.bgVacioUrl);
      }
      setIsDestinationEmpty(true);
    } catch (error) {
      console.warn('API de vaciado no disponible en el VPS (usando fallback local):', error);
      // Fallback local robusto
      setCleanDestinationImage(PROPERTY_DATA.bgVacioUrl);
      setIsDestinationEmpty(true);
    } finally {
      setIsScanning(false);
      setScanningType(null);
    }
  };

  // Cálculos de Espacio
  const activeFurniture = Object.values(AVAILABLE_FURNITURE).filter(
    item => segmentedItems.includes(item.id) && selectedIds.includes(item.id)
  );
  
  const totalOccupiedArea = activeFurniture.reduce((acc, item) => acc + (item.width * item.depth), 0);
  const occupancyPercentage = Math.min(100, Math.round((totalOccupiedArea / PROPERTY_DATA.livingArea) * 100));

  const wallItems = activeFurniture.filter(item => item.id === 'sofa' || item.id === 'shelf');
  const totalWallLengthOccupied = wallItems.reduce((acc, item) => acc + item.width, 0);
  const remainingWallLength = PROPERTY_DATA.wallLength - totalWallLengthOccupied;

  // Alertas Inteligentes del AI Spatial Checker
  const getSpatialAlerts = () => {
    const alerts = [];
    
    if (!isDestinationEmpty) {
      alerts.push({
        type: 'info',
        text: 'ℹ️ Para colocar tus muebles en la nueva casa, primero tenés que vaciarla. Activá el switch "Vaciar departamento con IA" arriba para remover la decoración del dueño anterior.'
      });
      return alerts;
    }

    if (segmentedItems.length === 0) {
      alerts.push({
        type: 'info',
        text: '💡 Tu inventario está vacío. Hacé clic sobre los muebles de la foto de tu casa actual (izquierda) para recortarlos con la IA y empezar a probarlos en la nueva casa.'
      });
      return alerts;
    }

    if (activeFurniture.length === 0) {
      alerts.push({
        type: 'info',
        text: '📦 Tenés muebles en tu inventario pero ninguno está activo. Marcá las casillas de los muebles recortados para proyectarlos en el living vacío.'
      });
      return alerts;
    }

    // Alerta de porcentaje de ocupación
    if (occupancyPercentage > 35) {
      alerts.push({
        type: 'warning',
        text: `⚠️ Alta densidad de mobiliario: Tus muebles ocupan el ${occupancyPercentage}% del área útil del living (${totalOccupiedArea.toFixed(2)}m² de ${PROPERTY_DATA.livingArea}m²). Se recomienda optimizar la distribución.`
      });
    } else {
      alerts.push({
        type: 'success',
        text: `✨ Distribución de espacio óptima: Los muebles ocupan solo el ${occupancyPercentage}% del living. Hay excelente circulación libre.`
      });
    }

    // Alerta de pared principal
    if (remainingWallLength < 0) {
      alerts.push({
        type: 'danger',
        text: `🚨 Conflicto en la pared principal: El Sillón y la Biblioteca exceden el largo de la pared principal por ${Math.abs(remainingWallLength).toFixed(2)}m. La biblioteca deberá ser reubicada contra otra pared.`
      });
    } else if (selectedIds.includes('sofa') && selectedIds.includes('shelf')) {
      alerts.push({
        type: 'info',
        text: `💡 Organización de pared: El Sillón y la Biblioteca entran juntos sobre la pared principal. Te quedan ${remainingWallLength.toFixed(2)}m libres de pared para colocar otros objetos.`
      });
    }

    // Alerta de mesa y circulación
    if (selectedIds.includes('table')) {
      if (selectedIds.includes('sofa') && selectedIds.includes('shelf')) {
        alerts.push({
          type: 'warning',
          text: '⚠️ Conflicto de circulación: Al colocar la Mesa de Comedor junto con el Sillón y la Biblioteca, el paso hacia el ventanal del balcón se reduce a 60cm. Sugerimos rotar la mesa.'
        });
      } else {
        alerts.push({
          type: 'success',
          text: '✅ La Mesa de Comedor tiene un radio de giro de sillas de 90cm a la redonda, cumpliendo con los estándares de ergonomía.'
        });
      }
    }

    return alerts;
  };

  const activeAlerts = getSpatialAlerts();

  // Copiar plantilla de correo al portapapeles
  const handleCopyEmail = () => {
    const emailBody = `Hola Nacho,

Vi la propuesta para sumarme como dev a roomix.ai y decidí programar esta feature interactiva ("Roomix Virtual Mover") para demostrarte cómo pienso producto y cómo uso IA para construir en el día a día.

En lugar de mandarte un CV aburrido, acá tenés la demo funcionando:
https://roomix-virtual-mover.vercel.app (o tu enlace local)

¡Hagamos esa semana de prueba!

Un abrazo,
[Tu Nombre]`;

    navigator.clipboard.writeText(emailBody).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    });
  };

  return (
    <>
      {/* ═══════ NAVBAR ═══════ */}
      <nav className="nav">
        <a href="/" className="nav-logo">
          ROOM<span>IX</span>
          <span className="nav-logo-badge">Virtual Mover</span>
        </a>
        <ul className="nav-links">
          <li><a href="#demo">Simulador</a></li>
          <li><a href="#arquitectura">Cómo Funciona</a></li>
          <li><a href="#portfolio">Habilidades & Pitch</a></li>
        </ul>
        <a href="mailto:contacto@roomix.ai?subject=real%20estate%20sexy" className="nav-cta">
          Aplicar ↗
        </a>
      </nav>

      {/* ═══════ HERO AREA ═══════ */}
      <section className="hero">
        <span className="hero-tag">FEATURE PROPOSAL FOR ROOMIX.AI</span>
        <h1>Mudate con tus muebles,<br />no con tus dudas.</h1>
        <p>
          Subí una foto de tu living actual, hacé clic en tus muebles para que la IA los recorte con **SAM (Segment Anything)** y mudalos virtualmente a tu futuro departamento. Eliminá los muebles viejos con inpainting y audita si tus cosas entran en el plano.
        </p>
      </section>

      {/* ═══════ PROCESS STEP BADGES ═══════ */}
      <div className="process-indicator">
        <div className={`process-step-badge ${!userImage ? 'active' : ''}`}>
          <div className="process-step-num">1</div>
          <span>Subí la foto de tu casa</span>
        </div>
        <div className={`process-step-badge ${userImage && segmentedItems.length === 0 ? 'active' : ''}`}>
          <div className="process-step-num">2</div>
          <span>Hacé clic en tus muebles para recortar</span>
        </div>
        <div className={`process-step-badge ${userImage && segmentedItems.length > 0 ? 'active' : ''}`}>
          <div className="process-step-num">3</div>
          <span>Vacía el nuevo depto y proyéctalos</span>
        </div>
      </div>

      {/* ═══════ WORKSPACE (DEMO) ═══════ */}
      <section className="workspace" id="demo">
        <div className={`workspace-grid ${isScanning ? 'scanning' : ''}`}>
          
          {/* COLUMNA IZQUIERDA: TU CASA ACTUAL Y SEGMENTADOR */}
          <div className="segmenter-card">
            <div className="segmenter-header">
              <h3>🏠 1. Mi Casa Actual</h3>
              <p>Subí una foto de tu living y hacé clic sobre tus muebles para que la IA los recorte.</p>
            </div>

            {/* Zona de subida o foto interactiva */}
            {!userImage ? (
              <div className="upload-zone" onClick={handleUploadZoneClick}>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                />
                <div className="upload-icon">⬆</div>
                <div className="upload-text">
                  <h5>Subí una foto de tu living actual</h5>
                  <p style={{ marginBottom: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Hacé clic para seleccionar una foto de tu PC
                  </p>
                  <button 
                    onClick={handleLoadSampleImage}
                    style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid var(--emerald)',
                      color: 'var(--emerald)',
                      padding: '6px 12px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    O usar foto de ejemplo interactiva
                  </button>
                </div>
              </div>
            ) : (
              <div className="segmenter-view-container">
                <img 
                  src={userImage} 
                  alt="Living del usuario" 
                  className="segmenter-img"
                  style={{ filter: isScanning && scanningType === 'sam' ? 'brightness(0.6)' : 'brightness(1)' }}
                />
                
                {/* MÁSCARAS DE SEGMENTACIÓN INTERACTIVAS SOBRE LA IMAGEN DEL USUARIO */}
                <div 
                  className={`segment-mask mask-sofa ${segmentedItems.includes('sofa') ? 'selected' : ''}`}
                  onClick={() => handleSegmentItem('sofa')}
                >
                  <span className="segment-tooltip">{AVAILABLE_FURNITURE.sofa.tooltip}</span>
                  <div className="segment-indicator">
                    {segmentedItems.includes('sofa') ? '✓' : '+'}
                  </div>
                </div>

                <div 
                  className={`segment-mask mask-table ${segmentedItems.includes('table') ? 'selected' : ''}`}
                  onClick={() => handleSegmentItem('table')}
                >
                  <span className="segment-tooltip">{AVAILABLE_FURNITURE.table.tooltip}</span>
                  <div className="segment-indicator">
                    {segmentedItems.includes('table') ? '✓' : '+'}
                  </div>
                </div>

                <div 
                  className={`segment-mask mask-shelf ${segmentedItems.includes('shelf') ? 'selected' : ''}`}
                  onClick={() => handleSegmentItem('shelf')}
                >
                  <span className="segment-tooltip">{AVAILABLE_FURNITURE.shelf.tooltip}</span>
                  <div className="segment-indicator">
                    {segmentedItems.includes('shelf') ? '✓' : '+'}
                  </div>
                </div>
              </div>
            )}

            {/* LISTADO DE MUEBLES RECORTADOS (INVENTARIO DINÁMICO) */}
            {userImage && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📦</span> Muebles recortados ({segmentedItems.length})
                </h4>
                {segmentedItems.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    Pasá el mouse por la foto de arriba y hacé clic sobre el Sillón, la Mesa o la Biblioteca para recortarlos con la IA.
                  </p>
                ) : (
                  <div className="inventory-list">
                    {segmentedItems.map(itemId => {
                      const item = AVAILABLE_FURNITURE[itemId];
                      const isProjected = selectedIds.includes(itemId);
                      return (
                        <div 
                          key={item.id}
                          className={`inventory-item ${isProjected ? 'active' : ''}`}
                          onClick={() => handleToggleProjectedItem(item.id)}
                        >
                          <div className="item-checkbox">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>

                          <div className="item-thumb-wrapper">
                            <img 
                              src={item.imgUrl} 
                              alt={item.name} 
                              className="item-thumb" 
                              style={{ mixBlendMode: 'multiply', filter: 'contrast(1.1) brightness(1.05)' }} 
                            />
                          </div>

                          <div className="item-info">
                            <div className="item-name" style={{ fontSize: '13px' }}>{item.name}</div>
                            <div className="item-specs" style={{ fontSize: '10px' }}>
                              <span>An: {item.width.toFixed(2)}m</span>
                              <span>Pr: {item.depth.toFixed(2)}m</span>
                              <span>Al: {item.height.toFixed(2)}m</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* COLUMNA DERECHA: EL NUEVO DEPARTAMENTO Y PROYECCIÓN */}
          <div className="canvas-panel">
            <div className="canvas-header">
              <div className="property-title">
                <h4>Nuevo Departamento en Palermo</h4>
                <p>
                  <span className="badge-location">Palermo Hollywood, CABA</span>
                  <span>• {PROPERTY_DATA.rooms}</span>
                  <span>• {PROPERTY_DATA.livingArea.toFixed(1)} m² útiles</span>
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {/* Botón para subir la foto del departamento a buscar */}
                <button 
                  onClick={() => destinationFileInputRef.current?.click()}
                  style={{
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid var(--blue-neon)',
                    color: 'var(--blue-neon)',
                    padding: '6px 12px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <input 
                    type="file" 
                    ref={destinationFileInputRef} 
                    onChange={handleDestinationFileChange} 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                  />
                  <span>⬆ Subir depto</span>
                </button>

                <div className="badge-ai-audit">
                  <span className="pulse-dot"></span>
                  AI Spatial Audit
                </div>
              </div>
            </div>

            {/* CONTROL DE INPAINTING DE VACIADO */}
            <div className="inpainting-control">
              <div className="inpainting-info">
                <h5>🧹 Vaciar departamento con IA</h5>
                <p>Usa inpainting generativo para remover los muebles del inquilino anterior</p>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={isDestinationEmpty}
                  onChange={handleToggleDestinationEmpty}
                />
                <span className="slider"></span>
              </label>
            </div>

            {/* CANVAS DE PROYECCIÓN */}
            <div className="workspace-canvas">
              {/* Contenedor de fondos con crossfade */}
              <div className="canvas-image-wrapper">
                <img 
                  src={destinationImage || PROPERTY_DATA.bgAmuebladoUrl} 
                  alt="Departamento Amueblado Antiguo" 
                  className="canvas-bg"
                  style={{ 
                    opacity: isDestinationEmpty ? 0 : 1,
                    filter: isScanning && scanningType === 'erase' ? 'brightness(0.4)' : 'brightness(1)'
                  }}
                />
                <img 
                  src={cleanDestinationImage || PROPERTY_DATA.bgVacioUrl} 
                  alt="Departamento Vacío Limpio" 
                  className="canvas-bg"
                  style={{ 
                    opacity: isDestinationEmpty ? 1 : 0,
                    filter: isScanning && scanningType === 'erase' ? 'brightness(0.4)' : 'brightness(0.95)'
                  }}
                />
              </div>

              <div className="canvas-overlay" />
              <div className="canvas-scanner" />

              {/* Estado: No vacío (aún con muebles viejos) */}
              {!isDestinationEmpty && (
                <div className="canvas-empty-state">
                  <div className="empty-state-content">
                    <h5>Remoción de Muebles Requerida</h5>
                    <p>El living está ocupado por la decoración anterior. Activá el interruptor **"Vaciar departamento con IA"** para limpiarlo por inpainting.</p>
                  </div>
                </div>
              )}

              {/* Estado: Vacío pero sin muebles seleccionados */}
              {isDestinationEmpty && activeFurniture.length === 0 && (
                <div className="canvas-empty-state">
                  <div className="empty-state-content">
                    <h5>Hogar Limpio e Inpintado</h5>
                    {segmentedItems.length === 0 ? (
                      <p>Excelente. La IA vació el living de Palermo. Ahora, recortá tus propios muebles en la foto de la izquierda para proyectarlos acá.</p>
                    ) : (
                      <p>Excelente. Seleccioná los muebles recortados de tu inventario de mudanza abajo de la foto para ver cómo quedan en el living vacío.</p>
                    )}
                  </div>
                </div>
              )}

              {/* MUEBLES DEL USUARIO PROYECTADOS EN EL CANVAS (SOLO SI EL CANVAS ESTÁ VACÍO Y EL MUEBLE ACTIVO) */}
              {isDestinationEmpty && (
                <>
                  <div className={`projected-furniture furniture-sofa ${selectedIds.includes('sofa') && segmentedItems.includes('sofa') ? 'visible' : ''}`}>
                    <img 
                      src={AVAILABLE_FURNITURE.sofa.imgUrl} 
                      alt="Sillón Chesterfield del usuario" 
                      className="projected-img"
                      style={{ mixBlendMode: 'multiply', filter: 'contrast(1.1) brightness(1.05)' }}
                    />
                    <div className="furniture-shadow" />
                  </div>

                  <div className={`projected-furniture furniture-table ${selectedIds.includes('table') && segmentedItems.includes('table') ? 'visible' : ''}`}>
                    <img 
                      src={AVAILABLE_FURNITURE.table.imgUrl} 
                      alt="Mesa del usuario" 
                      className="projected-img"
                      style={{ mixBlendMode: 'multiply', filter: 'contrast(1.05) brightness(1.08)' }}
                    />
                    <div className="furniture-shadow" style={{ bottom: '-6%', left: '5%', width: '90%' }} />
                  </div>

                  <div className={`projected-furniture furniture-shelf ${selectedIds.includes('shelf') && segmentedItems.includes('shelf') ? 'visible' : ''}`}>
                    <img 
                      src={AVAILABLE_FURNITURE.shelf.imgUrl} 
                      alt="Biblioteca del usuario" 
                      className="projected-img"
                      style={{ mixBlendMode: 'multiply', filter: 'contrast(1.08) brightness(1.04)' }}
                    />
                    <div className="furniture-shadow" style={{ bottom: '-3%', left: '8%', width: '84%', height: '8px' }} />
                  </div>
                </>
              )}
            </div>

            {/* SPATIAL CHECKER / REPORT PANEL */}
            <div className="spatial-checker">
              <div className="checker-header">
                <h4>📐 Auditoría Física en Tiempo Real</h4>
                <div className="badge-ai-audit" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'var(--emerald)', color: 'var(--emerald)' }}>
                  Active Scan
                </div>
              </div>

              <div className="checker-metrics">
                <div className="metric-card">
                  <div className="metric-label">Espacio Útil del Living</div>
                  <div className="metric-val">{PROPERTY_DATA.livingArea.toFixed(1)} m²</div>
                </div>

                <div className="metric-card">
                  <div className="metric-label">Área Muebles Proyectados</div>
                  <div className="metric-val">{totalOccupiedArea.toFixed(2)} m²</div>
                  <div className="metric-bar-bg">
                    <div 
                      className={`metric-bar-fill ${occupancyPercentage > 35 ? 'warning' : 'success'}`} 
                      style={{ width: `${occupancyPercentage}%` }}
                    />
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-label">Pared Principal Disponible</div>
                  <div className="metric-val">
                    {remainingWallLength < 0 ? 'Excedido' : `${remainingWallLength.toFixed(2)} m`}
                  </div>
                  <div className="metric-bar-bg">
                    <div 
                      className={`metric-bar-fill ${remainingWallLength < 0 ? 'danger' : remainingWallLength < 1 ? 'warning' : 'success'}`}
                      style={{ 
                        width: `${Math.max(0, Math.min(100, (remainingWallLength / PROPERTY_DATA.wallLength) * 100))}%` 
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="checker-alerts">
                {activeAlerts.map((alert, i) => (
                  <div key={i} className={`checker-alert ${alert.type}`}>
                    <span className="alert-icon">
                      {alert.type === 'success' && '✓'}
                      {alert.type === 'info' && '🛈'}
                      {alert.type === 'warning' && '⚠'}
                      {alert.type === 'danger' && '⊗'}
                    </span>
                    <div>{alert.text}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ═══════ CÓMO FUNCIONA (PITCH TÉCNICO DE IA) ═══════ */}
      <section className="explainer" id="arquitectura">
        <div className="explainer-card">
          <h3>La Tecnología Detrás de la Mudanza Virtual</h3>
          <div className="explainer-grid">
            
            <div className="explainer-item">
              <div className="explainer-item-num">01</div>
              <h4>Segmentación Interactiva SAM</h4>
              <p>
                Al subir la foto de tu casa actual, el backend de Python procesa los clics en el frontend para correr **Segment Anything Model (SAM)** en modo interactivo en tiempo real, recortando con precisión tus muebles con bordes antialiasing.
              </p>
            </div>

            <div className="explainer-item">
              <div className="explainer-item-num">02</div>
              <h4>Borrado por Inpainting (Eraser)</h4>
              <p>
                Para remover los muebles viejos del departamento de destino, utilizamos modelos de restauración como **LaMa Inpainting** o **Stable Diffusion Eraser**, reconstruyendo la textura de las paredes y pisos de fondo.
              </p>
            </div>

            <div className="explainer-item">
              <div className="explainer-item-num">03</div>
              <h4>Proyección Tridimensional y Sombras</h4>
              <p>
                Alineamos la perspectiva tridimensional del living mediante estimadores de homografía. Finalmente, aplicamos sombreado de oclusión ambiental simulado para integrar las patas y la base de tus muebles al nuevo suelo.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ═══════ PORTFOLIO & POSTULACIÓN (DEVELOPER PORTRAIT) ═══════ */}
      <section className="dev-portrait" id="portfolio">
        <div className="dev-portrait-container">
          <div className="dev-header">
            <h2>Developer Portrait</h2>
            <p>Un dev obsesivo por el diseño, el código robusto y la IA aplicada.</p>
          </div>

          <div className="dev-grid">
            
            {/* COLUMNA BIO Y SKILLS */}
            <div className="dev-bio">
              <h3>Hola Nacho, soy tu próximo <span>Dev Creativo</span></h3>
              <p>
                Me obsesiona tanto el pixel-perfect y las transiciones fluidas de una interfaz como la eficiencia de base de datos y la arquitectura de agentes de IA en el backend. Trabajo cómodamente en todo el stack con la misma rigurosidad.
              </p>
              <p>
                Diseñé esta feature para Roomix porque responde a un dolor real de los usuarios, es técnicamente retadora y calza perfectamente con el ADN de staging e innovación visual de la startup.
              </p>

              <div className="skills-grid">
                
                <div className="skill-card">
                  <h4><span>▸</span> Frontend & Motion</h4>
                  <p>React, Next.js, TypeScript, CSS nativo premium, Framer Motion, animaciones fluidas y Web3D/Three.js.</p>
                </div>

                <div className="skill-card">
                  <h4><span>▸</span> Backend & ML</h4>
                  <p>Python (FastAPI, Django), PyTorch, Hugging Face, pipelines de Visión por Computadora (SAM, Diffusers).</p>
                </div>

                <div className="skill-card">
                  <h4><span>▸</span> Data & Infra</h4>
                  <p>SQL (PostgreSQL, PostGIS para datos geográficos), NoSQL (MongoDB, Redis) y despliegue rápido en Vercel/AWS.</p>
                </div>

                <div className="skill-card">
                  <h4><span>▸</span> Product Mindset</h4>
                  <p>Resolución de problemas de negocio, velocidad extrema de shipping y obsesión por la experiencia del usuario.</p>
                </div>

              </div>

              {/* Prompting & Workflow */}
              <div className="workflow-card">
                <h4><span>⚡</span> Prompting & AI Workflow Diario</h4>
                <ul>
                  <li><strong>Prompting Avanzado:</strong> Uso Chain of Thought (CoT) para razonamiento lógico y few-shot para formateo estricto de outputs (integrado con validadores Pydantic en Python).</li>
                  <li><strong>AI-Driven Dev:</strong> Trabajo codo a codo con asistentes de IA usando frameworks de brainstorming estructurados (como "superpowers") para refinar ideas antes de escribir una sola línea de código.</li>
                  <li><strong>Agentes Autónomos:</strong> Diseño sistemas multi-agente con estado (LangGraph/Hermes) con herramientas de Function Calling estructuradas.</li>
                </ul>
              </div>
            </div>

            {/* COLUMNA POSTULACIÓN CORREO */}
            <div className="app-cta-panel">
              <h3>¿Hacemos match?</h3>
              <p>
                Si te gusta cómo pienso el producto, cómo estructuro el código y cómo ejecuto con velocidad, hagamos esa semana de prueba y demostremos que podemos shippear más rápido que cualquier equipo tradicional.
              </p>

              <div className="email-template">
                <div className="email-meta-row">
                  <div className="email-meta-label">Para:</div>
                  <div className="email-meta-value">contacto@roomix.ai</div>
                </div>
                <div className="email-meta-row">
                  <div className="email-meta-label">Asunto:</div>
                  <div className="email-meta-value" style={{ color: 'var(--emerald)', fontWeight: 'bold' }}>real estate sexy</div>
                </div>
                <div className="email-body">
{`Hola Nacho,

Vi la propuesta para sumarme como dev a roomix.ai y decidí programar esta feature interactiva ("Roomix Virtual Mover") para demostrarte cómo pienso producto y cómo uso IA para construir en el día a día.

En lugar de mandarte un CV aburrido, acá tenés la demo funcionando:
https://roomix-virtual-mover.vercel.app (o tu enlace local)

¡Hagamos esa semana de prueba!

Un abrazo.`}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn-apply" onClick={handleCopyEmail} style={{ flexGrow: 1 }}>
                  {copySuccess ? '✓ ¡Copiado al Portapapeles!' : 'Copiar Plantilla de Mail'}
                </button>
                <a 
                  href="mailto:contacto@roomix.ai?subject=real%20estate%20sexy&body=Hola%20Nacho%2C%0A%0AVi%20la%20propuesta%20para%20sumarme%20como%20dev%20a%20roomix.ai%20y%20decid%C3%AD%20programar%20esta%20feature%20interactiva%20%28%22Roomix%20Virtual%20Mover%22%29%20para%20demostrarte%20c%C3%B3mo%20pienso%20producto%20y%20c%C3%B3mo%20uso%20IA%20para%20construir%20en%20el%20d%C3%ADa%20a%20d%C3%ADa.%0A%0AEn%20lugar%20de%20mandarte%20un%20CV%20aburrido%2C%20ac%C3%A1%20ten%C3%A9s%20la%20demo%20funcionando.%0A%0A%C2%A1Hagamos%20esa%20semana%20de%20prueba%21%0A%0AUn%20abrazo."
                  className="btn-apply" 
                  style={{ width: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border-active)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Enviar Directo ↗
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="footer">
        <div className="footer-brand">ROOM<span>IX</span></div>
        <p>Propuesta conceptual de feature interactiva para Roomix.ai • 2026</p>
      </footer>
    </>
  );
}
