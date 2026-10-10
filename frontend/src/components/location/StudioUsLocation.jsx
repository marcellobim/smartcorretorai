import { useEffect, useRef, useState } from 'react'
import { getCountiesByState, getStatesForMarket, getUsCitiesByCounty, isValidCountyForState, isValidUsZipCode, normalizeUsZipCode } from '../../config/locations'
import { ProductButton } from '../design-system'

// Kept outside React so the real request state machine can be exercised without a browser.
export function startStudioUsCityRequest({ state, county, loadCities, requestRef, onState }) {
  const request = ++requestRef.current
  if (!state || !isValidCountyForState(state, county)) {
    onState({ cities: [], status: 'idle', error: '' })
    return () => {}
  }
  const controller = new AbortController()
  onState({ cities: [], status: 'loading', error: '' })
  loadCities(state, county, { signal: controller.signal })
    .then(cities => {
      if (request !== requestRef.current) return
      onState({ cities, status: 'ready', error: '' })
    })
    .catch(reason => {
      if (request !== requestRef.current || reason?.name === 'AbortError') return
      onState({ cities: [], status: 'error', error: 'We could not load cities for this county.' })
    })
  return () => controller.abort()
}

export function selectStudioUsCounty(value, county) {
  return { ...value, county, city: '', zipCode: '', neighborhoodCommunity: '' }
}

export default function StudioUsLocation({ value, onChange, onContinue, loadCities = getUsCitiesByCounty }) {
  const [cities, setCities] = useState([]), [status, setStatus] = useState('idle'), [error, setError] = useState('')
  const requestRef = useRef(0)
  const load = () => startStudioUsCityRequest({
    state: value.state, county: value.county, loadCities, requestRef,
    onState: next => { setCities(next.cities); setStatus(next.status); setError(next.error) },
  })
  useEffect(() => load(), [value.state, value.county])
  const update = patch => onChange({ ...value, ...patch })
  const ready = value.state && value.county && cities.includes(value.city) && (!value.zipCode || isValidUsZipCode(value.zipCode))
  return <div className="space-y-4">
    <label className="block text-xs font-black">State<select aria-label="State" value={value.state || ''} onChange={e => update({ state: e.target.value, county: '', city: '', zipCode: '', neighborhoodCommunity: '' })} className="mt-1 w-full rounded-2xl border p-3"><option value="">Select state</option>{getStatesForMarket('US').map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
    <label className="block text-xs font-black">County<select aria-label="County" disabled={!value.state} value={value.county || ''} onChange={e => onChange(selectStudioUsCounty(value, e.target.value))} className="mt-1 w-full rounded-2xl border p-3"><option value="">{value.state ? 'Select county' : 'Select state first'}</option>{getCountiesByState(value.state).map(x => <option key={x.countyFips} value={x.value}>{x.label}</option>)}</select></label>
    <label className="block text-xs font-black">City<select aria-label="City" disabled={status !== 'ready'} value={value.city || ''} onChange={e => update({ city: e.target.value })} className="mt-1 w-full rounded-2xl border p-3"><option value="">{status === 'loading' ? 'Loading cities…' : 'Select city'}</option>{cities.map(x => <option key={x} value={x}>{x}</option>)}</select>{status === 'error' && <><p className="mt-1 text-xs text-rose-700">{error}</p><ProductButton type="button" variant="ghost" size="sm" onClick={load}>Try again</ProductButton></>}{status === 'ready' && !cities.length && <p className="mt-1 text-xs">No cities were found for this county.</p>}</label>
    <label className="block text-xs font-black">ZIP Code (optional)<input aria-label="ZIP Code (optional)" value={value.zipCode || ''} onChange={e => update({ zipCode: normalizeUsZipCode(e.target.value) })} className="mt-1 w-full rounded-2xl border p-3" />{value.zipCode && !isValidUsZipCode(value.zipCode) && <p className="mt-1 text-xs text-rose-700">Enter a valid ZIP Code.</p>}</label>
    <label className="block text-xs font-black">Neighborhood / Community (optional)<input aria-label="Neighborhood / Community (optional)" value={value.neighborhoodCommunity || ''} onChange={e => update({ neighborhoodCommunity: e.target.value })} className="mt-1 w-full rounded-2xl border p-3" /></label>
    <ProductButton type="button" disabled={!ready} onClick={onContinue}>Continue</ProductButton>
  </div>
}
