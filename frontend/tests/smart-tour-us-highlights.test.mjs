import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import enUS from '../src/i18n/messages/en-US.js'
import ptBR from '../src/i18n/messages/pt-BR.js'
import {
  getSmartTourHighlights,
  getSmartTourHighlightGroups,
  SMART_TOUR_HIGHLIGHT_CATALOG_BY_MARKET,
  SMART_TOUR_HIGHLIGHT_GROUPS,
  SMART_TOUR_US_HIGHLIGHT_GROUPS,
} from '../src/config/smartTourForm.js'

const EXPECTED_US_VALUES = [
  'us_near_downtown', 'us_near_schools', 'us_near_parks', 'us_near_shopping', 'us_easy_highway_access', 'us_quiet_street',
  'us_community_pool', 'us_fitness_center', 'us_clubhouse', 'us_gated_community',
  'us_updated', 'us_new_construction', 'us_move_in_ready', 'us_open_floor_plan', 'us_home_office', 'us_walk_in_closet', 'us_gourmet_kitchen', 'us_covered_patio', 'us_fenced_yard', 'us_high_ceilings', 'us_natural_light', 'us_fireplace',
  'us_garage', 'us_covered_parking', 'us_assigned_parking',
  'us_solar_panels', 'us_energy_efficient', 'us_smart_home_features',
  'us_high_visibility', 'us_storefront', 'us_ready_to_occupy', 'us_customer_parking', 'us_loading_access',
  'us_corner_lot', 'us_cleared_lot', 'us_utilities_available', 'us_residential_zoning', 'us_paved_road',
]

const SECOND_PHASE_VALUES = [
  'us_near_public_transit', 'us_near_beach', 'us_playground', 'us_dog_park', 'us_tennis_courts', 'us_pickleball_courts', 'us_24_7_security',
  'us_private_pool', 'us_waterfront', 'us_water_view', 'us_city_view', 'us_guest_parking', 'us_ev_charger', 'us_impact_windows',
  'us_office_space', 'us_warehouse_space', 'us_conference_room', 'us_high_speed_internet', 'us_commercial_zoning', 'us_waterfront_lot', 'us_investment_opportunity',
]

const US_ITEMS = SMART_TOUR_US_HIGHLIGHT_GROUPS.flatMap(group => group.items)
const smartTourPage = readFileSync(new URL('../src/pages/SmartTourAI.jsx', import.meta.url), 'utf8')

function messageFor(messages, key) {
  return key.split('.').reduce((value, segment) => value?.[segment], messages)
}

test('keeps the BR highlight catalog as the default and uses a separate US catalog', () => {
  assert.equal(SMART_TOUR_HIGHLIGHT_CATALOG_BY_MARKET.BR, SMART_TOUR_HIGHLIGHT_GROUPS)
  assert.equal(SMART_TOUR_HIGHLIGHT_CATALOG_BY_MARKET.US, SMART_TOUR_US_HIGHLIGHT_GROUPS)
  assert.equal(getSmartTourHighlightGroups('Casa'), SMART_TOUR_HIGHLIGHT_GROUPS.house)
  assert.equal(getSmartTourHighlightGroups('us_single_family_home', { market: 'CA' }), SMART_TOUR_HIGHLIGHT_GROUPS.house)
})

test('contains exactly the 38 approved initial US highlights and no second-phase item', () => {
  assert.equal(US_ITEMS.length, 38)
  assert.deepEqual(US_ITEMS.map(item => item.value), EXPECTED_US_VALUES)
  assert.ok(US_ITEMS.every(item => item.value.startsWith('us_') && item.labelKey && item.types.length > 0))
  assert.ok(SECOND_PHASE_VALUES.every(value => !US_ITEMS.some(item => item.value === value)))
})

test('provides localized US group and item labels', () => {
  assert.deepEqual(
    SMART_TOUR_US_HIGHLIGHT_GROUPS.map(group => messageFor(enUS, group.labelKey)),
    ['Location', 'Community / HOA', 'Property Features', 'Parking', 'Efficiency / Smart Home', 'Commercial', 'Land / Lot'],
  )
  assert.deepEqual(
    SMART_TOUR_US_HIGHLIGHT_GROUPS.map(group => messageFor(ptBR, group.labelKey)),
    ['Localização', 'Comunidade / HOA', 'Características do imóvel', 'Estacionamento', 'Eficiência / Casa inteligente', 'Comercial', 'Terreno / Lote'],
  )
  assert.ok(US_ITEMS.every(item => messageFor(enUS, item.labelKey) && messageFor(ptBR, item.labelKey)))
  assert.equal(messageFor(enUS, 'smartTour.highlights.us.storefront'), 'Storefront')
  assert.equal(messageFor(ptBR, 'smartTour.highlights.us.storefront'), 'Fachada comercial')
})

test('filters the US catalog by compatible property type', () => {
  const land = getSmartTourHighlightGroups('us_land_lot', { market: 'US' })
  const commercial = getSmartTourHighlightGroups('us_commercial', { market: 'US' })
  const landValues = land.flatMap(group => group.items.map(item => item.value))
  const commercialValues = commercial.flatMap(group => group.items.map(item => item.value))

  assert.deepEqual(landValues, ['us_near_schools', 'us_near_parks', 'us_easy_highway_access', 'us_quiet_street', 'us_corner_lot', 'us_cleared_lot', 'us_utilities_available', 'us_residential_zoning', 'us_paved_road'])
  assert.deepEqual(commercialValues, ['us_near_downtown', 'us_near_shopping', 'us_easy_highway_access', 'us_updated', 'us_new_construction', 'us_move_in_ready', 'us_open_floor_plan', 'us_high_ceilings', 'us_natural_light', 'us_garage', 'us_covered_parking', 'us_solar_panels', 'us_energy_efficient', 'us_high_visibility', 'us_storefront', 'us_ready_to_occupy', 'us_customer_parking', 'us_loading_access'])
  assert.ok(land.every(group => group.items.every(item => item.types.includes('us_land_lot'))))
  assert.ok(commercial.every(group => group.items.every(item => item.types.includes('us_commercial'))))
  assert.ok(getSmartTourHighlights('us_commercial', { market: 'US' }).every(value => value.startsWith('us_')))
})

test('Smart Tour renders localized labels and stores the stable highlight value', () => {
  assert.match(smartTourPage, /getSmartTourHighlightGroups\(property\.type, \{ market \}\)/)
  assert.match(smartTourPage, /group\.labelKey \? t\(group\.labelKey\) : group\.title/)
  assert.match(smartTourPage, /toggleHighlight\(item\.value\)/)
})
