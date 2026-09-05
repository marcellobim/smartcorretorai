export function createMetaRegistrationDispatcher({ isMarketingGranted, isReady, send }) {
  let status = 'idle'

  const sendOnce = () => {
    if (status === 'sent' || !send()) return false
    status = 'sent'
    return true
  }

  return {
    request() {
      if (!isMarketingGranted() || status === 'sent') return false
      if (!isReady()) {
        status = 'pending'
        return true
      }
      return sendOnce()
    },
    flush() {
      if (!isMarketingGranted()) {
        if (status === 'pending') status = 'idle'
        return false
      }
      if (status !== 'pending' || !isReady()) return false
      return sendOnce()
    },
    revoke() {
      if (status === 'pending') status = 'idle'
    },
  }
}
