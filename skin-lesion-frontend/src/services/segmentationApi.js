const DEFAULT_API_BASE_URL = 'https://negation-confider-scribble.ngrok-free.dev'

export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL
  const rawBaseUrl = (configured || DEFAULT_API_BASE_URL).trim()
  return rawBaseUrl.replace(/\/+$/, '')
}

export function buildApiUrl(path) {
  const baseUrl = getApiBaseUrl()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${normalizedPath}`
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function checkBackendHealth() {
  const url = buildApiUrl('/')

  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    }, 15000)

    if (!response.ok) {
      throw new Error(
        `Backend returned HTTP ${response.status} ${response.statusText}. The Colab server may be offline or the ngrok URL may have changed.`,
      )
    }

    const contentType = response.headers.get('content-type') || ''

    if (!contentType.includes('application/json') && !contentType.includes('+json')) {
      throw new Error(
        'The backend responded with an unexpected content type. Check whether the API is still serving JSON.',
      )
    }

    let payload
    try {
      payload = await response.json()
    } catch {
      throw new Error(
        'The backend responded, but the health check did not return valid JSON. Check that the FastAPI server is running and serving JSON.',
      )
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error(
        'The backend is reachable, but it did not return the expected health response format.',
      )
    }

    const healthStatus = typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : ''

    if (healthStatus !== 'running') {
      throw new Error(
        'The backend is reachable, but it did not report the expected running status. Confirm the API is healthy.',
      )
    }

    return {
      status: payload.status,
      message: payload.message || 'Backend is responding.',
      endpoint: payload.endpoint || '/segment',
      response_format: payload.response_format || 'JSON',
      raw: payload,
    }
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error('The backend health check timed out. The Colab runtime may be asleep or unreachable.')
    }

    if (error instanceof TypeError) {
      throw new Error('A network error occurred while checking the backend. Verify the ngrok URL and internet connection.')
    }

    throw error instanceof Error ? error : new Error('Unknown backend health error.')
  }
}

export async function segmentImage(file) {
  if (!file) {
    throw new Error('Please select a valid skin-lesion image before running analysis.')
  }

  const formData = new FormData()
  formData.append('file', file)
  const url = buildApiUrl('/segment')

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      },
      30000,
    )

    const contentType = response.headers.get('content-type') || ''
    const responseText = await response.text()

    if (!response.ok) {
      let backendMessage = 'The backend rejected the segmentation request.'

      if (responseText) {
        try {
          const payload = JSON.parse(responseText)
          backendMessage = payload.detail || payload.message || payload.error || backendMessage
        } catch {
          backendMessage = responseText
        }
      }

      throw new Error(backendMessage)
    }

    if (contentType.includes('image/png') || (!contentType && responseText.startsWith('\u0089PNG'))) {
      throw new Error(
        'The backend appears to still be serving the older PNG-only API. Please confirm the Colab server is running the updated JSON-based /segment endpoint.',
      )
    }

    if (!responseText.trim()) {
      throw new Error('The segmentation API returned an empty response. Check the backend logs and the ngrok URL.')
    }

    let payload
    try {
      payload = JSON.parse(responseText)
    } catch {
      throw new Error(
        'The segmentation endpoint did not return valid JSON. Confirm the backend is using the expected FastAPI response format.',
      )
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error('The segmentation API returned an unexpected response type.')
    }

    const requiredImageFields = ['overlay', 'cropped_patch', 'isolated_lesion']
    const missingFields = requiredImageFields.filter(
      (field) => typeof payload[field] !== 'string' || !payload[field].startsWith('data:image/png;base64,'),
    )

    if (missingFields.length > 0) {
      throw new Error(
        `The segmentation response is missing valid image data for: ${missingFields.join(', ')}. Check the backend JSON contract.`,
      )
    }

    if (!payload.metrics || typeof payload.metrics !== 'object') {
      throw new Error('The segmentation response is missing the metrics object.')
    }

    if (typeof payload.empty_mask !== 'boolean') {
      throw new Error('The segmentation response is missing the empty_mask boolean flag.')
    }

    if (typeof payload.input_resolution !== 'string' && payload.input_resolution !== null) {
      throw new Error('The segmentation response is missing a valid input_resolution string.')
    }

    return payload
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error('The segmentation request timed out. Check that the Colab runtime is still active and the model is responding.')
    }

    if (error instanceof TypeError) {
      throw new Error('A network error occurred while calling the segmentation endpoint. Check the backend URL and your internet connection.')
    }

    throw error instanceof Error ? error : new Error('An unexpected error occurred while segmenting the image.')
  }
}

export const apiConfig = {
  maxFileSizeMb: 10,
  acceptedImageTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
}

export function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function isValidImageType(fileType) {
  return apiConfig.acceptedImageTypes.includes(fileType.toLowerCase())
}
