import { Navigate } from 'react-router-dom'
import { isProductAvailable } from '../../config/productAvailability'

// Do not mount the product (or its analytics/effects) while commercial entry is paused.
export default function AvailableProductRoute({ product, children }) {
  return isProductAvailable(product) ? children : <Navigate to="/dashboard" replace />
}
