import { useEffect, useRef, useState } from 'react'
import './App.css'
import { checkBackendHealth, formatFileSize, isValidImageType, segmentImage } from './services/segmentationApi'

const maxFileSizeBytes = 10 * 1024 * 1024

const metricDefinitions = [
  {
    key: 'area_px',
    label: 'Segmented Area',
    unit: 'Square pixels',
    description: 'Area occupied by the predicted mask in pixels.',
  },
  {
    key: 'perimeter_px',
    label: 'Boundary Perimeter',
    unit: 'Pixels',
    description: 'Length of the predicted lesion boundary.',
  },
  {
    key: 'border_compactness',
    label: 'Border Compactness',
    unit: 'Dimensionless',
    description: 'Calculated from the mask area and perimeter.',
  },
  {
    key: 'asymmetry_score',
    label: 'Asymmetry Score',
    unit: 'Image-derived score',
    description: 'Comparison between the lesion shape and its reflections.',
  },
  {
    key: 'hue_variation',
    label: 'Hue Variation',
    unit: 'Standard deviation of HSV hue values',
    description: 'Variation in HSV hue values inside the predicted lesion mask.',
  },
  {
    key: 'iou_score',
    label: 'Segmentation IoU Score',
    unit: 'Model-predicted IoU',
    description: 'The model-predicted intersection-over-union value for the mask.',
  },
]

function formatMetricValue(value) {
  if (value === null || value === undefined || value === 'null') {
    return 'N/A'
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return 'N/A'
    }

    return Number(value).toLocaleString(undefined, {
      maximumFractionDigits: 3,
    })
  }

  return value
}

function downloadDataUrl(dataUrl, fileName) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  link.click()
}

function App() {
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [backendStatus, setBackendStatus] = useState('checking')
  const [backendMessage, setBackendMessage] = useState('Checking backend connection...')
  const [backendError, setBackendError] = useState('')
  const [isCheckingBackend, setIsCheckingBackend] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [apiError, setApiError] = useState('')
  const [result, setResult] = useState(null)
  const [emptyMaskWarning, setEmptyMaskWarning] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  async function checkBackendConnection() {
    setIsCheckingBackend(true)
    setBackendStatus('checking')
    setBackendError('')
    setBackendMessage('Checking backend connection...')

    try {
      const health = await checkBackendHealth()
      setBackendStatus('connected')
      setBackendMessage(health.message || 'Backend connected and ready.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The backend is disconnected or unavailable.'
      setBackendStatus('disconnected')
      setBackendError(message)
      setBackendMessage('Disconnected')
    } finally {
      setIsCheckingBackend(false)
    }
  }

  useEffect(() => {
    void checkBackendConnection()
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const clearResults = () => {
    setResult(null)
    setEmptyMaskWarning('')
    setApiError('')
  }

  const clearSelectedFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setPreviewUrl('')
    setSelectedFile(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSelectedFile = (file) => {
    if (!file) {
      return
    }

    const fileType = typeof file.type === 'string' ? file.type.toLowerCase() : ''

    if (!isValidImageType(fileType)) {
      setApiError('Unsupported file type. Please upload a PNG, JPG, JPEG, or WebP image.')
      return
    }

    if (file.size > maxFileSizeBytes) {
      setApiError('The selected image exceeds the 10 MB limit. Please choose a smaller file.')
      return
    }

    setApiError('')
    clearResults()

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    const nextPreviewUrl = URL.createObjectURL(file)
    setSelectedFile(file)
    setPreviewUrl(nextPreviewUrl)
  }

  const handleImageSelection = (event) => {
    const file = event.target.files?.[0]
    handleSelectedFile(file)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragOver(false)
    const file = event.dataTransfer.files?.[0]
    handleSelectedFile(file)
  }

  const handleRemoveImage = () => {
    clearSelectedFile()
    clearResults()
  }

  const handleAnalyze = async () => {
    if (!selectedFile || isAnalyzing || isCheckingBackend) {
      return
    }

    setIsAnalyzing(true)
    setApiError('')
    setEmptyMaskWarning('')

    try {
      const response = await segmentImage(selectedFile)
      setResult(response)

      if (response.empty_mask === true) {
        setEmptyMaskWarning(
          'No foreground pixels were segmented in the uploaded image. The mask is empty, so this result should not be interpreted as a lesion detection.',
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected segmentation error occurred.'
      setApiError(message)
      setResult(null)
      setEmptyMaskWarning('')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const hasSelectedImage = Boolean(selectedFile)
  const statusLabel = {
    checking: 'Checking',
    connected: 'Connected',
    disconnected: 'Disconnected',
  }[backendStatus]

  const resultCards = [
    {
      key: 'overlay',
      title: 'Predicted Segmentation Overlay',
      description: 'The red region represents the predicted mask overlaid on the resized input image.',
      filename: 'skin_lesion_segmentation.png',
      altText: 'Predicted segmentation overlay over the original image.',
    },
    {
      key: 'cropped_patch',
      title: 'Cropped Lesion Region',
      description: 'This crop surrounds the predicted mask bounding region.',
      filename: 'skin_lesion_cropped.png',
      altText: 'Cropped lesion region around the predicted segmentation.',
    },
    {
      key: 'isolated_lesion',
      title: 'Isolated Lesion',
      description: 'Pixels outside the predicted mask are set to black.',
      filename: 'skin_lesion_isolated.png',
      altText: 'Segmentation mask isolated on a black background.',
    },
  ]

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Research dashboard</p>
          <h1>DermaVision AI</h1>
          <p className="subtitle">EfficientSAM Skin Lesion Segmentation</p>
        </div>

        <div className="connection-panel">
          <div className={`status-badge ${backendStatus}`}>
            <span className="status-dot" aria-hidden="true" />
            {statusLabel}
          </div>
          <button
            type="button"
            className="retry-button"
            onClick={() => void checkBackendConnection()}
            disabled={isCheckingBackend}
          >
            {isCheckingBackend ? 'Checking...' : 'Retry Connection'}
          </button>
        </div>
      </header>

      <div className="status-bar" aria-live="polite">
        <span>{backendMessage}</span>
        {backendError ? <strong>{backendError}</strong> : null}
      </div>

      <main className="content-grid">
        <section className="panel upload-panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Input</p>
              <h2>Upload Skin Image</h2>
            </div>
          </div>

          <div
            className={`dropzone ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              id="image-upload"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              onChange={handleImageSelection}
              aria-label="Upload a skin lesion image"
            />

            <div className="upload-content">
              <div className="upload-icon" aria-hidden="true">⇪</div>
              <p>Drag and drop an image here</p>
              <label htmlFor="image-upload" className="browse-button">
                Browse Files
              </label>
            </div>
          </div>

          {selectedFile ? (
            <div className="selected-file-panel">
              <div className="preview-box">
                {previewUrl ? (
                  <img src={previewUrl} alt="Selected lesion preview" className="preview-image" />
                ) : null}
              </div>

              <div className="file-meta">
                <div>
                  <span className="meta-label">File</span>
                  <strong>{selectedFile.name}</strong>
                </div>
                <div>
                  <span className="meta-label">Size</span>
                  <strong>{formatFileSize(selectedFile.size)}</strong>
                </div>
              </div>

              <div className="button-row stacked-mobile">
                <label htmlFor="image-upload" className="secondary-button button-label">
                  Replace Image
                </label>
                <button type="button" className="secondary-button" onClick={handleRemoveImage}>
                  Remove Image
                </button>
              </div>
            </div>
          ) : null}

          <div className="button-row analysis-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleAnalyze()}
              disabled={!hasSelectedImage || isAnalyzing}
            >
              {isAnalyzing ? 'Analyzing image...' : 'Run Full Analysis'}
            </button>
          </div>

          {apiError ? <div className="message error-message">{apiError}</div> : null}
        </section>

        <aside className="panel info-panel">
          <div className="panel-header compact-header">
            <div>
              <p className="section-kicker">Model</p>
              <h2>Inference Details</h2>
            </div>
          </div>

          <div className="info-stack">
            <div className="info-item">
              <span>Model</span>
              <strong>EfficientSAM</strong>
            </div>
            <div className="info-item">
              <span>Inference location</span>
              <strong>Google Colab</strong>
            </div>
            <div className="info-item">
              <span>Input resolution</span>
              <strong>256 × 256 pixels</strong>
            </div>
            <div className="info-item">
              <span>Output</span>
              <strong>Overlay, crop, isolation, metrics</strong>
            </div>
            <div className="info-item">
              <span>Backend</span>
              <strong>FastAPI via ngrok</strong>
            </div>
          </div>

          <div className="disclaimer-box">
            “For research and educational use only. Not a medical diagnosis.”
          </div>
        </aside>
      </main>

      <section className="panel results-section">
        <div className="panel-header">
          <div>
            <p className="section-kicker">Outputs</p>
            <h2>Segmentation Results</h2>
          </div>
          {result ? (
            <button type="button" className="clear-button" onClick={clearResults}>
              Clear Results
            </button>
          ) : null}
        </div>

        {!selectedFile && !result ? (
          <div className="empty-state">
            <p>No image has been uploaded yet. Select an image to begin a segmentation analysis.</p>
          </div>
        ) : null}

        {isAnalyzing ? (
          <div className="analyzing-state" aria-live="polite">
            <div className="spinner" aria-hidden="true" />
            <p>Analyzing image…</p>
          </div>
        ) : null}

        {emptyMaskWarning ? (
          <div className="message warning-message" role="alert">
            {emptyMaskWarning}
          </div>
        ) : null}

        {result ? (
          <>
            <div className="results-grid">
              {resultCards.map((card) => (
                <article key={card.key} className="result-card">
                  <div className="result-image-wrap">
                    <img
                      src={result[card.key]}
                      alt={card.altText}
                      className="result-image"
                    />
                  </div>
                  <div className="result-copy">
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                  </div>
                  <button
                    type="button"
                    className="download-button"
                    onClick={() => downloadDataUrl(result[card.key], card.filename)}
                  >
                    Download image
                  </button>
                </article>
              ))}
            </div>

            <div className="metrics-panel">
              <div className="metrics-header">
                <div>
                  <p className="section-kicker">Metrics</p>
                  <h3>Image-derived measurements</h3>
                </div>
              </div>

              <div className="metrics-grid">
                {metricDefinitions.map((metric) => {
                  const value = result.metrics?.[metric.key]

                  return (
                    <div key={metric.key} className="metric-card">
                      <div className="metric-head">
                        <span>{metric.label}</span>
                        <strong>{formatMetricValue(value)}</strong>
                      </div>
                      <small>{metric.unit}</small>
                      <p>{metric.description}</p>
                    </div>
                  )
                })}
              </div>

              <div className="metrics-note">
                These metrics are image-derived measurements and do not constitute a diagnosis.
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  )
}

export default App
