// The production create handler imports this pure builder.  It deliberately
// strips the other market's fields so a restored draft cannot leak BR facts
// into a US render (or the reverse).
export function buildSmartCarouselCreateBody({ jobId, uploaded, answers, cta, sharePhone, professionalIdentity, locale, market }) {
  const us = market === 'US'
  const location = us
    ? {
        state: answers.state || '', county: answers.county || '', city: answers.city || '',
        ...(answers.zip_code ? { zip_code: answers.zip_code } : {}),
        ...(answers.neighborhood_community ? { neighborhood_community: answers.neighborhood_community } : {}),
      }
    : { uf: answers.uf || '', city: answers.city || '', ...(answers.district ? { district: answers.district } : {}) }
  const facts = us
    ? { bedrooms: answers.bedrooms || '', bathrooms: answers.bathrooms || '', parking_spaces: answers.parking_spaces || '' }
    : { bedrooms: answers.bedrooms || '', suites: answers.suites || '', parking_spaces: answers.parking_spaces || '' }
  return {
    action: 'create', job_id: jobId, image_paths: uploaded.imagePaths, cta_path: uploaded.ctaPath,
    answers: { purpose: answers.purpose || '', property_stage: answers.property_stage || '', property_type: answers.property_type || '', ...facts, ...location, price_label: answers.price_label || '', area: answers.area || '', highlights: answers.highlights || [] },
    cta, share_phone: sharePhone === 'yes',
    professional_identity: professionalIdentity?.enabled === true && (professionalIdentity.credential_source === 'br_creci' || professionalIdentity.credential_source === 'us_license')
      ? { enabled: true, name_source: professionalIdentity.name_source, credential_source: professionalIdentity.credential_source }
      : { enabled: false },
    language: locale, market,
  }
}
