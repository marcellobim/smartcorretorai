/** Provider-facing labels. Persisted property values remain technical. */
const US_PROPERTY_TYPE_LABELS: Record<string, string> = {
  us_single_family_home: 'Single-Family Home', us_condo: 'Condo', us_townhouse: 'Townhouse',
  us_multi_family: 'Multi-Family Home', us_apartment: 'Apartment', us_studio: 'Studio',
  us_land_lot: 'Land / Lot', us_commercial: 'Commercial Property',
}

const US_HIGHLIGHT_LABELS: Record<string, string> = {
  us_near_downtown: 'Near Downtown', us_near_schools: 'Near Schools', us_near_parks: 'Near Parks', us_near_shopping: 'Near Shopping', us_easy_highway_access: 'Easy Highway Access', us_quiet_street: 'Quiet Street',
  us_community_pool: 'Community Pool', us_fitness_center: 'Fitness Center', us_clubhouse: 'Clubhouse', us_gated_community: 'Gated Community',
  us_updated: 'Updated', us_new_construction: 'New Construction', us_move_in_ready: 'Move-In Ready', us_open_floor_plan: 'Open Floor Plan', us_home_office: 'Home Office', us_walk_in_closet: 'Walk-In Closet', us_gourmet_kitchen: 'Gourmet Kitchen', us_covered_patio: 'Covered Patio', us_fenced_yard: 'Fenced Yard', us_high_ceilings: 'High Ceilings', us_natural_light: 'Natural Light', us_fireplace: 'Fireplace',
  us_garage: 'Garage', us_covered_parking: 'Covered Parking', us_assigned_parking: 'Assigned Parking',
  us_solar_panels: 'Solar Panels', us_energy_efficient: 'Energy Efficient', us_smart_home_features: 'Smart Home Features',
  us_high_visibility: 'High Visibility', us_storefront: 'Storefront', us_ready_to_occupy: 'Ready to Occupy', us_customer_parking: 'Customer Parking', us_loading_access: 'Loading Access',
  us_corner_lot: 'Corner Lot', us_cleared_lot: 'Cleared Lot', us_utilities_available: 'Utilities Available', us_residential_zoning: 'Residential Zoning', us_paved_road: 'Paved Road',
}

const value = (input: unknown) => String(input ?? '').trim()
const isTechnicalUsValue = (input: string) => input.startsWith('us_')

export const presentSmartTourPropertyType = (input: unknown) => {
  const technicalValue = value(input)
  return isTechnicalUsValue(technicalValue) ? US_PROPERTY_TYPE_LABELS[technicalValue] || '' : technicalValue
}

export const presentSmartTourHighlight = (input: unknown) => {
  const technicalValue = value(input)
  return isTechnicalUsValue(technicalValue) ? US_HIGHLIGHT_LABELS[technicalValue] || '' : technicalValue
}

export const presentSmartTourHighlights = (inputs: unknown) => Array.isArray(inputs)
  ? inputs.map(presentSmartTourHighlight).filter(Boolean)
  : []
