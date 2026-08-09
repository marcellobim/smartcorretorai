import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import VirtualStaging from '../../src/pages/VirtualStaging.jsx'

createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={['/virtual-staging']}>
    <VirtualStaging />
  </MemoryRouter>,
)
