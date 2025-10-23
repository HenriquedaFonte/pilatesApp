/**
 * Error tracking utility for logging and monitoring application errors
 */

export const logError = (error, context = {}) => {
  const errorData = {
    message: error.message || 'Unknown error',
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    userId: context.userId || 'anonymous'
  }

  // Log to console in development
  if (import.meta.env.DEV) {
    console.error('Application Error:', errorData)
  }

  // In production, you could send to error tracking service
  // Example: Sentry, LogRocket, Bugsnag, etc.
  if (import.meta.env.PROD) {
    // sendToErrorTrackingService(errorData)
    console.error('Production Error:', errorData)
  }

  return errorData
}

export const logApiError = (error, endpoint, params = {}) => {
  return logError(error, {
    type: 'API_ERROR',
    endpoint,
    params,
    status: error.status || error.code
  })
}

export const logAuthError = (error, action) => {
  return logError(error, {
    type: 'AUTH_ERROR',
    action
  })
}

export const logPerformanceError = (error, operation) => {
  return logError(error, {
    type: 'PERFORMANCE_ERROR',
    operation
  })
}