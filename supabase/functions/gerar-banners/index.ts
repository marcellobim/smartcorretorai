import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Max-Age': '86400',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const CREATOMATE_API_KEY = Deno.env.get('CREATOMATE_API_KEY') ?? ''

type TemplateMeta = {
  id: string
  nome: string
  categoria: 'banner' | 'story' | 'reels' | 'video' | 'carousel' | 'card' | 'social' | 'detailed'
  perfil: string[]
  formato: string
  family?: string
  variant?: string
  objective?: string
  placement?: string[]
  active?: boolean
  legacyCategory?: string
}

const TEMPLATES: TemplateMeta[] = [
  { id: '74097a36-5b5d-434a-8db7-4038e4c76f55', nome: 'SC_Banner_Luxo_01',         categoria: 'banner',   perfil: ['alto_padrao', 'lancamento'],                                  formato: 'banner-quadrado',      family: 'creatomate-stock', variant: 'luxo',       objective: 'lead_generation',    placement: ['instagram_feed', 'facebook_feed', 'portal'], active: false, legacyCategory: 'legacy' },
  { id: 'a637acac-6a7b-42f8-b7d8-e25361eff207', nome: 'SC_Banner_Popular_01',      categoria: 'banner',   perfil: ['popular_mcmv', 'medio_padrao'],                               formato: 'banner-quadrado',      family: 'creatomate-stock', variant: 'popular',    objective: 'lead_generation',    placement: ['instagram_feed', 'facebook_feed', 'portal'], active: false, legacyCategory: 'legacy' },
  { id: '9962f7dc-6cca-491f-bffe-3184a2314f21', nome: 'Reels Moderno 1x1',         categoria: 'reels',    perfil: ['todos'],                                                      formato: 'quadrado-1x1',         family: 'reels-moderno',    variant: '1x1',        objective: 'property_showcase',  placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: 'dfdcea18-0f3d-4c84-baa9-463c182644b7', nome: 'Reels Moderno 4x5 Tipo 2',  categoria: 'reels',    perfil: ['todos'],                                                      formato: 'vertical-4x5-tipo-2',  family: 'reels-moderno',    variant: '4x5-tipo-2', objective: 'property_showcase', placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '7f7f420d-da91-48c6-b701-0f0fb540b1aa', nome: 'Reels Moderno 4x5',         categoria: 'reels',    perfil: ['todos'],                                                      formato: 'vertical-4x5',         family: 'reels-moderno',    variant: '4x5',        objective: 'property_showcase',  placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: 'a36c300c-6a64-4161-86fb-ee892e7720d2', nome: 'Reels Moderno 16x9',        categoria: 'reels',    perfil: ['todos'],                                                      formato: 'horizontal-16x9',      family: 'reels-moderno',    variant: '16x9',       objective: 'property_showcase',  placement: ['youtube', 'site'], active: true },
  { id: 'd8310f54-5c9d-4606-ae6a-dacb8c4455ae', nome: 'Reels Moderno 9x16',        categoria: 'reels',    perfil: ['todos'],                                                      formato: 'vertical-9x16',        family: 'reels-moderno',    variant: '9x16',       objective: 'property_showcase',  placement: ['reels', 'instagram_story', 'whatsapp_status'], active: true },
  { id: '1ae7e1f4-ada4-4b03-a032-737a025b88c6', nome: 'Imovel Detalhes 1x1',       categoria: 'detailed', perfil: ['todos'],                                                      formato: 'quadrado-1x1',         family: 'imovel-detalhes', variant: '1x1',        objective: 'property_details',   placement: ['instagram_feed', 'facebook_feed', 'portal'], active: true },
  { id: '4dd468f4-a439-4a31-b6f3-29be17a1d51d', nome: 'Imovel Detalhes 4x5',       categoria: 'detailed', perfil: ['todos'],                                                      formato: 'vertical-4x5',         family: 'imovel-detalhes', variant: '4x5',        objective: 'property_details',   placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '4ba4698c-3b6e-4548-b73d-814d71bc7f66', nome: 'Imovel Detalhes 4x5 Tipo 2', categoria: 'detailed', perfil: ['todos'],                                                      formato: 'vertical-4x5-tipo-2',  family: 'imovel-detalhes', variant: '4x5-tipo-2', objective: 'property_details',  placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '451b3422-f222-414e-b105-44b896f8277e', nome: 'Imovel Detalhes 9x16',      categoria: 'detailed', perfil: ['todos'],                                                      formato: 'vertical-9x16',        family: 'imovel-detalhes', variant: '9x16',       objective: 'property_details',   placement: ['instagram_story', 'whatsapp_status'], active: true },
  { id: '71aa0276-bc5f-4245-bb37-62a78fa7cf64', nome: 'Imovel Detalhes 16x9',      categoria: 'detailed', perfil: ['todos'],                                                      formato: 'horizontal-16x9',      family: 'imovel-detalhes', variant: '16x9',       objective: 'property_details',   placement: ['youtube', 'site'], active: true },
  { id: '2ecd48d3-146c-467b-8a0d-908152101378', nome: 'Triple Slide Carousel 1x1', categoria: 'carousel', perfil: ['todos'],                                                      formato: 'quadrado-1x1',         family: 'triple-slide-carousel', variant: '1x1', objective: 'property_showcase', placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '16682dcd-eb89-404c-94dc-bb9f01317bf4', nome: 'Triple Slide Carousel 4x5', categoria: 'carousel', perfil: ['todos'],                                                      formato: 'vertical-4x5',         family: 'triple-slide-carousel', variant: '4x5', objective: 'property_showcase', placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '5635ee72-d0da-4906-9a84-6e0b5f587196', nome: 'Triple Slide Carousel 4x5 Tipo 2', categoria: 'carousel', perfil: ['todos'],                                               formato: 'vertical-4x5-tipo-2',  family: 'triple-slide-carousel', variant: '4x5-tipo-2', objective: 'property_showcase', placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '21c3ff4b-f632-405f-8ebf-369c1f7d4b10', nome: 'Triple Slide Carousel 9x16', categoria: 'carousel', perfil: ['todos'],                                                     formato: 'vertical-9x16',        family: 'triple-slide-carousel', variant: '9x16', objective: 'property_showcase', placement: ['instagram_story', 'whatsapp_status'], active: true },
  { id: 'fa82c49d-39af-46e8-bc31-3649fff10cae', nome: 'Triple Slide Carousel 16x9', categoria: 'carousel', perfil: ['todos'],                                                     formato: 'horizontal-16x9',      family: 'triple-slide-carousel', variant: '16x9', objective: 'property_showcase', placement: ['youtube', 'site'], active: true },
  { id: '9ebd1bda-e650-4d88-b8aa-ff555a419082', nome: 'Video Tour 1x1',            categoria: 'video',    perfil: ['todos'],                                                      formato: 'quadrado-1x1',         family: 'video-tour',      variant: '1x1',        objective: 'property_showcase',  placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '89071652-69ab-4edc-897b-9e7985c95f59', nome: 'Video Tour 4x5',            categoria: 'video',    perfil: ['todos'],                                                      formato: 'vertical-4x5',         family: 'video-tour',      variant: '4x5',        objective: 'property_showcase',  placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '9c831fd6-5412-4afe-9e29-dd8c4984e55c', nome: 'Video Tour 4x5 Tipo 2',     categoria: 'video',    perfil: ['todos'],                                                      formato: 'vertical-4x5-tipo-2',  family: 'video-tour',      variant: '4x5-tipo-2', objective: 'property_showcase', placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: 'cd6c0ed3-1dde-4fc0-a604-d728e5cbb73b', nome: 'Video Tour 9x16',           categoria: 'video',    perfil: ['todos'],                                                      formato: 'vertical-9x16',        family: 'video-tour',      variant: '9x16',       objective: 'property_showcase',  placement: ['reels', 'instagram_story', 'whatsapp_status'], active: true },
  { id: 'd5171301-84e3-41d2-a6ca-ef3013f360a1', nome: 'Video Tour 16x9',           categoria: 'video',    perfil: ['todos'],                                                      formato: 'horizontal-16x9',      family: 'video-tour',      variant: '16x9',       objective: 'property_showcase',  placement: ['youtube', 'site'], active: true },
  { id: '0e8a9ffd-36e3-493a-bf3b-9d83f3b6699d', nome: 'Card Imobiliario Premium 1x1', categoria: 'card',   perfil: ['todos'],                                                      formato: 'quadrado-1x1',         family: 'card-imobiliario-premium', variant: '1x1', objective: 'lead_generation', placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: 'f7df2c44-ea60-4c42-b862-2d335029acad', nome: 'Card Imobiliario Premium 4x5', categoria: 'card',   perfil: ['todos'],                                                      formato: 'vertical-4x5',         family: 'card-imobiliario-premium', variant: '4x5', objective: 'lead_generation', placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '2b4e6dff-ee96-42f0-97e1-7956bef9dfa9', nome: 'Card Imobiliario Premium 4x5 Tipo 2', categoria: 'card', perfil: ['todos'],                                               formato: 'vertical-4x5-tipo-2',  family: 'card-imobiliario-premium', variant: '4x5-tipo-2', objective: 'lead_generation', placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '755d1a44-acb9-4539-96b4-f1741b1651af', nome: 'Card Imobiliario Premium 9x16', categoria: 'card',  perfil: ['todos'],                                                      formato: 'vertical-9x16',        family: 'card-imobiliario-premium', variant: '9x16', objective: 'lead_generation', placement: ['instagram_story', 'whatsapp_status'], active: true },
  { id: '656ff3e1-325a-419c-9914-dfde82f911b6', nome: 'Card Imobiliario Premium 16x9', categoria: 'card',  perfil: ['todos'],                                                      formato: 'horizontal-16x9',      family: 'card-imobiliario-premium', variant: '16x9', objective: 'lead_generation', placement: ['youtube', 'site'], active: true },
  { id: '7a12a73e-ace7-4ab4-9739-95741b82232a', nome: 'Galeria Imobiliaria 1x1',   categoria: 'carousel', perfil: ['todos'],                                                      formato: 'quadrado-1x1',         family: 'galeria-imobiliaria', variant: '1x1',   objective: 'property_showcase',  placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '8e399960-3ade-453a-b868-e7059f30c6a9', nome: 'Galeria Imobiliaria 4x5',   categoria: 'carousel', perfil: ['todos'],                                                      formato: 'vertical-4x5',         family: 'galeria-imobiliaria', variant: '4x5',   objective: 'property_showcase',  placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '660ca820-3d7d-4d9f-8c45-3d6da832588b', nome: 'Galeria Imobiliaria 4x5 Tipo 2', categoria: 'carousel', perfil: ['todos'],                                                 formato: 'vertical-4x5-tipo-2',  family: 'galeria-imobiliaria', variant: '4x5-tipo-2', objective: 'property_showcase', placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '6de8026b-6cd2-4a19-8491-554079827932', nome: 'Galeria Imobiliaria 9x16',  categoria: 'carousel', perfil: ['todos'],                                                      formato: 'vertical-9x16',        family: 'galeria-imobiliaria', variant: '9x16',  objective: 'property_showcase',  placement: ['instagram_story', 'whatsapp_status'], active: true },
  { id: 'f2f15dab-77c2-429e-9b62-f8d6694399ed', nome: 'Galeria Imobiliaria 16x9',  categoria: 'carousel', perfil: ['todos'],                                                      formato: 'horizontal-16x9',      family: 'galeria-imobiliaria', variant: '16x9',  objective: 'property_showcase',  placement: ['youtube', 'site'], active: true },
  { id: '9c7e271b-a9c2-475a-b742-8f949e788abf', nome: 'Slides Premium 1x1',        categoria: 'carousel', perfil: ['todos'],                                                      formato: 'quadrado-1x1',         family: 'slides-premium',  variant: '1x1',        objective: 'property_showcase',  placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '4a7830c5-ff23-446b-8664-2bc8fe86b2c0', nome: 'Slides Premium 4x5',        categoria: 'carousel', perfil: ['todos'],                                                      formato: 'vertical-4x5',         family: 'slides-premium',  variant: '4x5',        objective: 'property_showcase',  placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '13008c2d-9e7e-4515-a2ac-649c9ea18409', nome: 'Slides Premium 4x5 Tipo 2', categoria: 'carousel', perfil: ['todos'],                                                      formato: 'vertical-4x5-tipo-2',  family: 'slides-premium',  variant: '4x5-tipo-2', objective: 'property_showcase', placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: 'eb6ae228-a08f-4747-a761-e4d4f716019', nome: 'Slides Premium 9x16',        categoria: 'carousel', perfil: ['todos'],                                                      formato: 'vertical-9x16',        family: 'slides-premium',  variant: '9x16',       objective: 'property_showcase',  placement: ['instagram_story', 'whatsapp_status'], active: true },
  { id: '2d79f2a0-1143-422c-bdef-7d02c5bb72e9', nome: 'Slides Premium 16x9',       categoria: 'carousel', perfil: ['todos'],                                                      formato: 'horizontal-16x9',      family: 'slides-premium',  variant: '16x9',       objective: 'property_showcase',  placement: ['youtube', 'site'], active: true },
  { id: 'f0a463cc-261f-4b51-ab7e-77fcea67476e', nome: 'Momentos do Imovel 4x5',    categoria: 'social',   perfil: ['todos'],                                                      formato: 'vertical-4x5',         family: 'momentos-do-imovel', variant: '4x5',    objective: 'social_engagement',  placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '3d72b111-76a7-4c7d-a594-1f75f70be2d2', nome: 'Momentos do Imovel 4x5 Tipo 2', categoria: 'social', perfil: ['todos'],                                                    formato: 'vertical-4x5-tipo-2',  family: 'momentos-do-imovel', variant: '4x5-tipo-2', objective: 'social_engagement', placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '62d46ee6-6347-4335-af89-2b65f2794882', nome: 'Momentos do Imovel 16x9',   categoria: 'social',   perfil: ['todos'],                                                      formato: 'horizontal-16x9',      family: 'momentos-do-imovel', variant: '16x9',   objective: 'social_engagement',  placement: ['youtube', 'site'], active: true },
  { id: 'a83a2008-8a6a-4a40-8b6f-d87190a1d306', nome: 'Avaliacao do Cliente 4x5',  categoria: 'social',   perfil: ['todos'],                                                      formato: 'vertical-4x5',         family: 'avaliacao-do-cliente', variant: '4x5',  objective: 'social_proof',       placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: 'cfded0ba-1eb9-4396-ab63-b259cb817a1e', nome: 'Avaliacao do Cliente 4x5 Tipo 2', categoria: 'social', perfil: ['todos'],                                                  formato: 'vertical-4x5-tipo-2',  family: 'avaliacao-do-cliente', variant: '4x5-tipo-2', objective: 'social_proof', placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '52a1e65f-ca92-4c6c-af7e-9f0100c886cb', nome: 'Avaliacao do Cliente 9x16', categoria: 'social',   perfil: ['todos'],                                                      formato: 'vertical-9x16',        family: 'avaliacao-do-cliente', variant: '9x16', objective: 'social_proof',       placement: ['instagram_story', 'whatsapp_status'], active: true },
  { id: 'e8314ba2-cd0f-44e3-afd1-de41083c0846', nome: 'Story Premium 1x1',         categoria: 'story',    perfil: ['todos'],                                                      formato: 'quadrado-1x1',         family: 'story-premium',   variant: '1x1',        objective: 'lead_generation',    placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '5461c940-4309-4c3f-bba1-d90e83e62a9a', nome: 'Story Premium 4x5',         categoria: 'story',    perfil: ['todos'],                                                      formato: 'vertical-4x5',         family: 'story-premium',   variant: '4x5',        objective: 'lead_generation',    placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: 'e15d93e5-dbb0-45c9-b475-2d9e2d6a1d0c', nome: 'Story Premium 4x5 Tipo 2',  categoria: 'story',    perfil: ['todos'],                                                      formato: 'vertical-4x5-tipo-2',  family: 'story-premium',   variant: '4x5-tipo-2', objective: 'lead_generation', placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '1de0a863-2376-4336-8a0a-4750c2429cf7', nome: 'Story Premium 9x16',        categoria: 'story',    perfil: ['todos'],                                                      formato: 'vertical-9x16',        family: 'story-premium',   variant: '9x16',       objective: 'lead_generation',    placement: ['instagram_story', 'whatsapp_status'], active: true },
  { id: 'c9cf1d8c-4f01-4f65-baf8-ca20c56ad76e', nome: 'Story Premium 16x9',        categoria: 'story',    perfil: ['todos'],                                                      formato: 'horizontal-16x9',      family: 'story-premium',   variant: '16x9',       objective: 'lead_generation',    placement: ['youtube', 'site'], active: true },
  { id: '8aab78ac-60cd-4e83-9f4c-51259c4751c6', nome: 'Frase Elegante 1x1',        categoria: 'social',   perfil: ['todos'],                                                      formato: 'quadrado-1x1',         family: 'frase-elegante',  variant: '1x1',        objective: 'brand_awareness',    placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '164eef00-abf4-429a-9334-c9e4c1319998', nome: 'Frase Elegante 4x5',        categoria: 'social',   perfil: ['todos'],                                                      formato: 'vertical-4x5',         family: 'frase-elegante',  variant: '4x5',        objective: 'brand_awareness',    placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '9a9c663c-0348-462b-a470-c40a86092a81', nome: 'Frase Elegante 4x5 Tipo 2', categoria: 'social',   perfil: ['todos'],                                                      formato: 'vertical-4x5-tipo-2',  family: 'frase-elegante',  variant: '4x5-tipo-2', objective: 'brand_awareness', placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '697a514d-4bab-4062-9c9e-3c208688c0e9', nome: 'Frase Elegante 9x16',       categoria: 'social',   perfil: ['todos'],                                                      formato: 'vertical-9x16',        family: 'frase-elegante',  variant: '9x16',       objective: 'brand_awareness',    placement: ['instagram_story', 'whatsapp_status'], active: true },
  { id: 'e74922ee-5882-4917-9051-9ae2e4021767', nome: 'Frase Elegante 16x9',       categoria: 'social',   perfil: ['todos'],                                                      formato: 'horizontal-16x9',      family: 'frase-elegante',  variant: '16x9',       objective: 'brand_awareness',    placement: ['youtube', 'site'], active: true },
  { id: '329b6afb-c749-4bda-a319-38ad42639034', nome: 'Chat Imobiliario 1x1',      categoria: 'social',   perfil: ['todos'],                                                      formato: 'quadrado-1x1',         family: 'chat-imobiliario', variant: '1x1',      objective: 'social_engagement',  placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '1db7b057-81e0-4db3-af4e-98a7c987cdfa', nome: 'Chat Imobiliario 4x5',      categoria: 'social',   perfil: ['todos'],                                                      formato: 'vertical-4x5',         family: 'chat-imobiliario', variant: '4x5',      objective: 'social_engagement',  placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: '71ae86ec-d08e-4f32-9d61-d7ddcb829f9e', nome: 'Chat Imobiliario 4x5 Tipo 2', categoria: 'social', perfil: ['todos'],                                                      formato: 'vertical-4x5-tipo-2',  family: 'chat-imobiliario', variant: '4x5-tipo-2', objective: 'social_engagement', placement: ['instagram_feed', 'facebook_feed'], active: true },
  { id: 'f4b5c0e9-80fe-408a-b139-f7db7dfbbc89', nome: 'Chat Imobiliario 9x16',     categoria: 'social',   perfil: ['todos'],                                                      formato: 'vertical-9x16',        family: 'chat-imobiliario', variant: '9x16',     objective: 'social_engagement',  placement: ['instagram_story', 'reels', 'whatsapp_status'], active: true },
  { id: '172938f9-c868-47ef-890b-bf2593b92565', nome: 'Chat Imobiliario 16x9',     categoria: 'social',   perfil: ['todos'],                                                      formato: 'horizontal-16x9',      family: 'chat-imobiliario', variant: '16x9',     objective: 'social_engagement',  placement: ['youtube', 'site'], active: true },
  { id: '13696443-a295-4019-802b-d504e9d3c2ac', nome: 'SC_Video_Cinematic_01',     categoria: 'video',    perfil: ['alto_padrao', 'lancamento'],                                  formato: 'horizontal-16x9',      family: 'creatomate-stock', variant: 'cinematic',  objective: 'property_showcase',  placement: ['youtube', 'site'], active: false, legacyCategory: 'legacy' },
  { id: '7ab695ae-e12b-4322-87dc-eb085760dd01', nome: 'Real Estate Banner',        categoria: 'banner',   perfil: ['todos'],                                                      formato: 'banner-quadrado',      family: 'creatomate-stock', variant: 'generic',    objective: 'lead_generation',    placement: ['instagram_feed', 'facebook_feed', 'portal'], active: false, legacyCategory: 'legacy' },
  { id: 'b0438295-5282-4a5e-b4eb-4fcd3d8d287b', nome: 'Real Estate Card',          categoria: 'card',     perfil: ['todos'],                                                      formato: 'card-quadrado',        family: 'creatomate-stock', variant: 'generic',    objective: 'lead_generation',    placement: ['instagram_feed', 'facebook_feed'], active: false, legacyCategory: 'legacy' },
  { id: 'f6054e9d-0d28-40b2-81a9-21d291a9897b', nome: 'Real Estate Detailed',      categoria: 'detailed', perfil: ['todos'],                                                      formato: 'detalhado-quadrado',   family: 'creatomate-stock', variant: 'detailed',   objective: 'property_showcase',  placement: ['portal', 'instagram_feed', 'facebook_feed'], active: false, legacyCategory: 'legacy' },
  { id: 'c5338ec4-1f93-476a-a81c-ff0e7f2e91cf', nome: 'Real Estate Video Montage', categoria: 'video',    perfil: ['todos'],                                                      formato: 'video-horizontal',     family: 'creatomate-stock', variant: 'montage',    objective: 'property_showcase',  placement: ['youtube', 'site'], active: false, legacyCategory: 'legacy' },
  { id: '96a25196-5a64-4f65-9b3e-c9c8b0d871f2', nome: 'Triple Slide Carousel',     categoria: 'carousel', perfil: ['todos'],                                                      formato: 'carrossel-quadrado',   family: 'creatomate-stock', variant: 'carousel',   objective: 'property_showcase',  placement: ['instagram_feed', 'facebook_feed'], active: false, legacyCategory: 'legacy' },
  { id: 'ad9f8382-ea38-4ef6-84cc-049f1b289345', nome: 'New Listing Story',         categoria: 'story',    perfil: ['lancamento', 'em_construcao'],                                formato: 'vertical-9x16',        family: 'creatomate-stock', variant: 'new_listing', objective: 'new_listing',        placement: ['instagram_story', 'whatsapp_status'], active: false, legacyCategory: 'legacy' },
  { id: '7fc36174-64a6-4dbb-bb92-bb957471577e', nome: 'Photo Montage',             categoria: 'video',    perfil: ['todos'],                                                      formato: 'video-quadrado',       family: 'creatomate-stock', variant: 'montage',    objective: 'property_showcase',  placement: ['instagram_feed', 'facebook_feed'], active: false, legacyCategory: 'legacy' },
  { id: '792ad84a-0ab8-4e6c-bda1-400fe9c040cc', nome: 'Animated Review',           categoria: 'social',   perfil: ['todos'],                                                      formato: 'vertical-9x16',        family: 'creatomate-stock', variant: 'review',     objective: 'social_engagement',  placement: ['instagram_story', 'reels', 'whatsapp_status'], active: false, legacyCategory: 'legacy' },
  { id: 'a03e7b27-0747-497c-ae84-5b048fa31915', nome: 'Searchlight Reveal',        categoria: 'social',   perfil: ['todos'],                                                      formato: 'criativo-vertical',    family: 'creatomate-stock', variant: 'creative',   objective: 'social_engagement',  placement: ['instagram_story', 'reels', 'whatsapp_status'], active: false, legacyCategory: 'legacy' },
  { id: '57c55de1-e116-4cad-8470-54c68f023f6b', nome: 'Image Slideshow',           categoria: 'video',    perfil: ['todos'],                                                      formato: 'slideshow-horizontal', family: 'creatomate-stock', variant: 'slideshow',  objective: 'property_showcase',  placement: ['youtube', 'site'], active: false, legacyCategory: 'legacy' },
  { id: 'ba3afcf4-01cc-48e3-919a-8bc6d2dd4ca4', nome: 'Video Compilation',         categoria: 'video',    perfil: ['todos'],                                                      formato: 'video-horizontal',     family: 'creatomate-stock', variant: 'generic',    objective: 'property_showcase',  placement: ['youtube', 'site'], active: false, legacyCategory: 'legacy' },
]

const FILL_SYSTEM_PROMPT = `Você produz objetos "modifications" do Creatomate para uma lista de templates já selecionados. Para cada template, você recebe o NOME REAL (ou um rótulo virtual numerado, quando há slots duplicados) de cada elemento modificável e seu TIPO (text, image, video, audio).

Responda APENAS com um objeto JSON válido (sem markdown), no formato:
{
  "selecoes": [
    {
      "template_id": "uuid",
      "modifications": {
        "<rótulo do elemento>.text": "texto",
        "<rótulo do elemento>.source": "https://url-da-imagem-ou-video"
      }
    }
  ]
}

REGRAS GERAIS:
- Use SOMENTE chaves no formato "<rótulo>.text" (para elementos type=text) ou "<rótulo>.source" (para image/video/audio).
- O <rótulo> deve ser EXATAMENTE um dos listados em "elementos reais". Não invente nomes.
- Quando o template tem MÚLTIPLOS slots com o mesmo nome (carrosséis, montagens, slideshows), a lista os apresenta com sufixos numerados — ex.: "Photo" para o primeiro, "Photo-2" para o segundo, "Photo-3" para o terceiro. Cada sufixo é um SLOT DISTINTO e DEVE ser preenchido individualmente.

DISTRIBUIÇÃO DE FOTOS DO IMÓVEL (regra crítica):
- A PRIMEIRA URL em fotos_urls é a FOTO PRINCIPAL e DEVE ocupar o PRIMEIRO slot de imagem do imóvel do template (o primeiro slot listado cujo rótulo NÃO seja de logo nem de avatar).
- As URLs seguintes em fotos_urls são fotos secundárias e devem preencher, EM ORDEM, todos os demais slots de imagem do imóvel ("Photo-2", "Photo-3", "Image-2", etc.).
- TODOS os slots de imagem do imóvel disponíveis devem ser preenchidos com .source. Se houver mais slots que fotos, repita a última foto disponível para os slots restantes. NUNCA deixe um slot de imagem do imóvel sem .source.
- Para elementos do tipo video que representem cenas do imóvel: use uma foto como source se não houver vídeos; o Creatomate aceita imagens em slots de vídeo na maioria dos casos.

CLASSIFICAÇÃO DE SLOTS DE IMAGEM:
- LOGO (rótulo contém "logo" ou "brand"): use a URL do logo da imobiliária se disponível; senão, valor "" + .track: false.
- AVATAR/AGENT (rótulo contém "avatar", "agent", "broker", "realtor", "person", "headshot", "profile"): use a URL da foto do corretor se disponível; senão, valor "" + .track: false.
- Demais slots de imagem/vídeo: pertencem ao IMÓVEL e seguem a regra de distribuição acima.

TEXTOS:
- Combine título, preço, endereço, descrição curta, marca, nome do corretor conforme o significado do rótulo e seu valor padrão. Se o rótulo contém "price"/"valor", coloque o preço. Se contém "address"/"location", o endereço. Se contém "title"/"headline"/"head", o título. Se contém "agent"/"broker"/"realtor", o nome do corretor. Se contém "brand"/"company"/"agency" (text), a Imobiliária/Marca. Se contém "phone"/"tel"/"whatsapp", o WhatsApp/Telefone. Se contém "email"/"mail", o email. Se contém "creci", "CRECI <número>". Se contém "site"/"url"/"website", o site. Se contém "instagram"/"insta"/"social", o @ do Instagram. NUNCA use dados fictícios em inglês como "John Doe", "(123) 555-1234", "info@example.com", "mybrand.com", "New York, NY".

TRADUÇÃO OBRIGATÓRIA DE FRASES FIXAS EM INGLÊS (regra GLOBAL, sem exceções):
- Templates stock do Creatomate possuem caixas de texto travadas com frases em inglês americano. NUNCA preserve o valor original em inglês — substitua por equivalente em português adequado ao contexto do imóvel brasileiro, ou deixe a string vazia (''+ track:false) quando não houver equivalente útil. Mapeamento obrigatório:
  • "NEW ON SALE" → "Novo à Venda" (ou, conforme o perfil: "Lançamento", "Oportunidade")
  • "NEW YORK, NY" → endereço real do imóvel (bairro, cidade, estado)
  • "NEW YORK" → cidade do imóvel
  • "NY" (estado isolado) → estado do imóvel (UF brasileiro) ou ''
  • "Please join us for an Open House" → "Agende sua visita" (ou '' se não houver contexto)
  • "Open House" → "Visitação"
  • "FOR SALE" / "FOR RENT" → "À Venda" / "Para Alugar"
  • "JUST LISTED" → "Recém-Anunciado"
  • "CONTACT US" / "CALL TODAY" → respeite a regra de CTA (apenas "Saiba Mais" / "Me Ligue" / "Descrição abaixo")
- Qualquer outro texto fixo em inglês americano (endereços tipo "123 Main St", ZIP codes, "MLS#", "BR/BA", etc.) deve ser traduzido para o contexto brasileiro ou retornar string vazia.

CTA (regra ESTRITA, sem exceções):
- Para QUALQUER elemento de texto cujo rótulo contenha "cta", "button" ou "action", o valor DEVE ser EXATAMENTE uma destas três variações profissionais, escolhida conforme a intenção do criativo:
  • "Saiba Mais" — curiosidade / direcionar para mais detalhes (banners, cards de portal, posts informativos).
  • "Me Ligue" — incentivar contato telefônico direto (Stories, Reels com áudio, banners com telefone visível).
  • "Descrição abaixo" — feeds/posts onde a legenda complementa o criativo (Instagram Feed, Facebook Feed).
- É PROIBIDO usar qualquer outra variação ("Compre Agora", "Veja Mais", "Confira", "Clique Aqui", "Saiba+", "Agende uma Visita", "Entre em Contato", "Fale Conosco", etc.). APENAS as três acima são aceitas.

TOM E DEMAIS REGRAS:
- Tom: alto_padrao = sofisticado e exclusivo; popular_mcmv/medio_padrao = acolhedor e acessível; lancamento = urgência e novidade; em_construcao = transparência e valorização.
- Não invente dados. Se uma informação não foi fornecida, omita a chave correspondente.
- Quando um campo tiver valor REMOVER_ELEMENTO, defina o valor do elemento como string vazia '' e adicione a propriedade 'track': false se disponível. NUNCA use placeholders fictícios.
- Mantenha textos curtos para caber no template (Headline ≤ 40 chars, Subhead ≤ 60 chars, Description ≤ 120 chars, CTA ≤ 20 chars).`

// ═══════════════════════════════════════════════════════════════
// SANITIZER — garante PT-BR e remove placeholders fictícios
// ═══════════════════════════════════════════════════════════════

type SanitizeContext = {
  preco?: string
  endereco?: string
  bairro?: string
  cidade?: string
  estado?: string
  corretor_nome?: string
  corretor_email?: string
  corretor_creci?: string
  marca_imovel?: string
  telefone_contato?: string
  whatsapp?: string
  site?: string
  instagram?: string
  titulo?: string
}

const PLACEHOLDER_EMAIL_DOMAINS = [
  'example.com', 'example.org', 'example.net',
  'mybrand.com', 'yourbrand.com', 'brand.com',
  'company.com', 'yourcompany.com',
  'realestate.com', 'realtors.com', 'realty.com',
  'website.com', 'yourwebsite.com',
  'sample.com', 'test.com', 'placeholder.com', 'domain.com', 'mail.com',
]

const PLACEHOLDER_EMAIL_USERS = new Set([
  'john', 'jane', 'doe', 'johndoe', 'janedoe',
  'elisabeth', 'elizabeth', 'michael', 'sarah', 'jessica', 'david', 'mary', 'james', 'patricia',
  'info', 'contact', 'support', 'hello', 'hi', 'admin', 'office',
  'noreply', 'no-reply', 'test', 'user', 'sample', 'placeholder', 'demo', 'example',
])

const PLACEHOLDER_DOMAINS = [
  'mybrand.com', 'yourbrand.com', 'brand.com',
  'example.com', 'example.org', 'example.net',
  'realestate.com', 'realtors.com', 'realty.com',
  'company.com', 'yourcompany.com',
  'website.com', 'yoursite.com', 'yourwebsite.com',
  'sample.com', 'test.com', 'placeholder.com', 'domain.com',
]

const ENGLISH_CITIES = [
  'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
  'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville',
  'fort worth', 'columbus', 'indianapolis', 'charlotte', 'san francisco',
  'seattle', 'denver', 'washington', 'boston', 'el paso', 'detroit',
  'nashville', 'memphis', 'portland', 'oklahoma city', 'las vegas',
  'louisville', 'baltimore', 'milwaukee', 'albuquerque', 'tucson', 'fresno',
  'sacramento', 'mesa', 'kansas city', 'atlanta', 'long beach', 'miami',
  'beverly hills', 'hollywood', 'malibu', 'manhattan', 'brooklyn', 'queens',
  'london', 'manchester', 'liverpool', 'birmingham', 'leeds',
  'sydney', 'melbourne', 'toronto', 'vancouver', 'montreal', 'paris', 'berlin',
]

const US_STATE_CODE_RE = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/

const ENGLISH_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'your', 'our', 'this', 'that', 'these', 'those',
  'is', 'are', 'was', 'were', 'be', 'been', 'will', 'would', 'could', 'should',
  'have', 'has', 'had', 'about', 'into', 'from',
  'home', 'house', 'price', 'beautiful', 'modern', 'luxury', 'family',
  'bedroom', 'bathroom', 'living', 'kitchen', 'available', 'now',
  'call', 'today', 'contact', 'experience', 'discover', 'welcome', 'feature',
  'features', 'sale', 'rent', 'rental', 'best', 'new', 'amazing', 'stunning',
  'gorgeous', 'spacious', 'cozy', 'dream', 'perfect',
])

const PORTUGUESE_STOPWORDS = new Set([
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'por', 'pelo', 'pela', 'para', 'com', 'sem', 'sob', 'sobre',
  'que', 'qual', 'quais',
  'é', 'são', 'foi', 'foram', 'ser', 'estar', 'está', 'estão',
  'tem', 'têm', 'ter', 'há',
  'casa', 'apartamento', 'imóvel', 'imovel', 'imóveis',
  'venda', 'aluguel', 'preço', 'preco',
  'belo', 'bonito', 'moderno', 'luxo', 'família', 'familia',
  'quarto', 'quartos', 'banheiro', 'banheiros', 'sala', 'cozinha',
  'sua', 'seu', 'nosso', 'nossa',
])

function detectLanguage(s: string): 'pt' | 'en' | 'unknown' {
  // Acento ou cedilha → quase certamente PT
  if (/[áàâãéêíóôõúüç]/i.test(s)) return 'pt'
  const tokens = s.toLowerCase().split(/[\s,.;:!?()'"\-/]+/).filter((t) => t.length > 0)
  if (tokens.length < 2) return 'unknown'
  let pt = 0
  let en = 0
  for (const t of tokens) {
    if (PORTUGUESE_STOPWORDS.has(t)) pt++
    if (ENGLISH_STOPWORDS.has(t)) en++
  }
  if (pt > 0) return 'pt'
  if (en >= 3) return 'en'
  if (en >= 2 && tokens.length <= 5) return 'en'
  return 'unknown'
}

// ═══════════════════════════════════════════════════════════════
// Frases fixas em inglês — substituição GLOBAL e obrigatória.
// Templates stock vêm com caixas de texto travadas em frases
// americanas ("NEW ON SALE", "NEW YORK, NY", "Please join us for
// an Open House", etc.). A IA tende a preservar esses valores
// quando não vê um equivalente PT-BR explícito. Esta lista força
// a tradução / contextualização antes de qualquer outra etapa do
// sanitizer. A ordem importa: frases mais específicas primeiro.
// ═══════════════════════════════════════════════════════════════

type FixedPhraseRule = {
  pattern: RegExp
  resolve: (ctx: SanitizeContext, enderecoFinal: string) => string
}

const FIXED_ENGLISH_PHRASES: FixedPhraseRule[] = [
  // Endereço composto americano → endereço real do imóvel
  {
    pattern: /\bNEW\s+YORK\s*,\s*NY\b/gi,
    resolve: (_ctx, enderecoFinal) => enderecoFinal,
  },
  // Convite para visitação
  {
    pattern: /\bplease\s+join\s+us\s+for\s+(?:an?\s+)?open\s+house\b/gi,
    resolve: () => 'Agende sua visita',
  },
  // Selo "novidade"
  { pattern: /\bNEW\s+ON\s+SALE\b/gi, resolve: () => 'Novo à Venda' },
  { pattern: /\bJUST\s+LISTED\b/gi,    resolve: () => 'Recém-Anunciado' },
  // Finalidade
  { pattern: /\bFOR\s+SALE\b/gi, resolve: () => 'À Venda' },
  { pattern: /\bFOR\s+RENT\b/gi, resolve: () => 'Para Alugar' },
  // Eventos
  { pattern: /\bOpen\s+House\b/gi, resolve: () => 'Visitação' },
  // Cidade isolada
  {
    pattern: /\bNEW\s+YORK\b/gi,
    resolve: (ctx) => ctx.cidade || '',
  },
  // Estado abreviado isolado (também coberto por US_STATE_CODE_RE,
  // mas explicitar garante substituição em qualquer comprimento de texto)
  {
    pattern: /\bNY\b/g,
    resolve: (ctx) => ctx.estado || '',
  },
]

function applyFixedEnglishPhrases(text: string, ctx: SanitizeContext, enderecoFinal: string): string {
  let out = text
  for (const rule of FIXED_ENGLISH_PHRASES) {
    out = out.replace(rule.pattern, rule.resolve(ctx, enderecoFinal))
  }
  return out
}

function sanitizeTemplateText(input: unknown, ctx: SanitizeContext): string {
  if (typeof input !== 'string') return ''
  let s = input.trim()
  if (!s) return ''

  const enderecoFinal = (ctx.endereco
    || [ctx.bairro, ctx.cidade, ctx.estado].filter(Boolean).join(', ')
  ).trim()

  // 0. Frases fixas em inglês (NEW ON SALE, NEW YORK NY, Open House, ...).
  //    Aplicado ANTES das demais etapas para que o restante do pipeline
  //    veja já o texto em PT-BR / com o dado real do imóvel.
  s = applyFixedEnglishPhrases(s, ctx, enderecoFinal)

  // 1. Substituir cidades em inglês (com ou sem código de estado US: "New York, NY")
  for (const c of ENGLISH_CITIES) {
    const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\b${escaped}(?:\\s*,?\\s*[A-Z]{2})?\\b`, 'gi')
    if (re.test(s)) {
      s = s.replace(re, enderecoFinal)
    }
  }
  // Estado US isolado ("CA", "NY") em texto curto → endereço real
  if (US_STATE_CODE_RE.test(s) && s.length <= 30 && !PORTUGUESE_STOPWORDS.has(s.toLowerCase())) {
    s = s.replace(US_STATE_CODE_RE, enderecoFinal ? ctx.estado || '' : '')
  }

  // 2. Emails placeholder (info@example.com, elisabeth@..., john@mybrand.com, etc.)
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => {
    const lower = m.toLowerCase()
    const [user, domain] = lower.split('@')
    const userBase = user.split(/[+.]/)[0]
    if (PLACEHOLDER_EMAIL_DOMAINS.some((d) => domain.endsWith(d))) return ''
    if (PLACEHOLDER_EMAIL_USERS.has(userBase)) return ''
    return m
  })

  // 3. Domínios placeholder (mybrand.com, example.com, etc.)
  for (const d of PLACEHOLDER_DOMAINS) {
    const escaped = d.replace(/\./g, '\\.')
    const re = new RegExp(`(?:https?://)?(?:www\\.)?${escaped}(?:/\\S*)?`, 'gi')
    if (re.test(s)) {
      s = s.replace(re, ctx.marca_imovel || '')
    }
  }

  // 4. Telefones fake estilo americano: "(123) 555-1234", "+1 555-...", padrão "555-xxxx"
  const phoneReal = ctx.telefone_contato || ''
  // Telefone com bloco "555" claramente placeholder
  s = s.replace(/\+?1?[\s.()-]*\d{3}[\s.()-]*555[\s.()-]*\d{4}/g, phoneReal)
  // String inteira sendo um número US-style (10 dígitos, com opcional "+1")
  if (/^\+?1[\s.()-]*\(?\d{3}\)?[\s.()-]*\d{3}[\s.()-]*\d{4}$/.test(s)) {
    s = phoneReal
  }

  // 5. Limpar resíduos (vírgulas duplas, hifens órfãos, espaços extras)
  s = s
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/\(\s*\)/g, '')
    .replace(/^[\s,;:\-|]+|[\s,;:\-|]+$/g, '')
    .trim()

  if (!s) return ''

  // 6. Se o que sobrou estiver em inglês, tentar substituição semântica pelo dado real;
  //    se não houver, retornar string vazia.
  const lang = detectLanguage(s)
  if (lang === 'en') {
    const lower = s.toLowerCase()
    if (/\b(price|cost|value|valor|amount)\b/.test(lower) && ctx.preco) return String(ctx.preco)
    if (/\b(address|location|street|neighborhood|area|local)\b/.test(lower) && enderecoFinal) return enderecoFinal
    if (/\b(agent|broker|realtor|representative|seller|sales)\b/.test(lower) && ctx.corretor_nome) return ctx.corretor_nome
    if (/\b(brand|company|agency|office|realty|estate)\b/.test(lower) && ctx.marca_imovel) return ctx.marca_imovel
    if (/\b(headline|title|home|house|property)\b/.test(lower) && ctx.titulo) return ctx.titulo
    if (/\b(phone|tel|whatsapp|call)\b/.test(lower) && (ctx.whatsapp || ctx.telefone_contato)) return ctx.whatsapp || ctx.telefone_contato || ''
    if (/\b(email|e-mail|mail)\b/.test(lower) && ctx.corretor_email) return ctx.corretor_email
    if (/\b(creci)\b/.test(lower) && ctx.corretor_creci) return `CRECI ${ctx.corretor_creci}`
    if (/\b(website|site|url|web)\b/.test(lower) && ctx.site) return ctx.site
    if (/\b(instagram|insta|social|follow)\b/.test(lower) && ctx.instagram) return ctx.instagram.startsWith('@') ? ctx.instagram : `@${ctx.instagram}`
    return ''
  }

  return s
}

// ═══════════════════════════════════════════════════════════════
// CTAs aprovados — apenas estas três variações profissionais podem
// aparecer em slots de CTA. Qualquer outra coisa que a IA retornar
// é mapeada (snapCta) para uma destas três opções.
// ═══════════════════════════════════════════════════════════════

const APPROVED_CTAS = ['Saiba Mais', 'Me Ligue', 'Descrição abaixo'] as const

function isCtaElement(elementName: string): boolean {
  return /cta|button|action/i.test(elementName)
}

function snapCta(value: string): string {
  const lower = value.trim().toLowerCase()
  if (!lower) return 'Saiba Mais'
  for (const cta of APPROVED_CTAS) {
    if (lower === cta.toLowerCase()) return cta
  }
  if (/(ligu|liga|call|telefon|phone|whats|fal[ea])/.test(lower)) return 'Me Ligue'
  if (/(descri[çc][aã]o|abaixo|below|swipe|deslize|arraste|bio|legenda)/.test(lower)) return 'Descrição abaixo'
  return 'Saiba Mais'
}

// Slot de imagem do IMÓVEL = qualquer image/video que não seja logo nem avatar.
function isPropertyPhotoSlot(name: string): boolean {
  const lower = name.toLowerCase()
  if (/logo|brand/.test(lower)) return false
  if (/avatar|agent|broker|realtor|person|headshot|profile/.test(lower)) return false
  return true
}

type ElementInfo = { name: string; type: string; id?: string; virtualLabel?: string; defaultValue?: string }

function extractElements(node: unknown, out: ElementInfo[] = []): ElementInfo[] {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const item of node) extractElements(item, out)
    return out
  }
  const n = node as Record<string, unknown>
  if (typeof n.name === 'string' && typeof n.type === 'string') {
    if (['text', 'image', 'video', 'audio'].includes(n.type)) {
      const defaultValue =
        typeof n.text === 'string' ? n.text :
        typeof n.source === 'string' ? n.source :
        undefined
      const id = typeof n.id === 'string' ? n.id : undefined
      out.push({ name: n.name, type: n.type, id, defaultValue })
    }
  }
  if (Array.isArray(n.elements)) extractElements(n.elements, out)
  return out
}

async function fetchTemplateElements(reqId: string, templateId: string): Promise<{ id: string; name: string; elements: ElementInfo[]; erro?: string }> {
  try {
    const res = await fetch(`https://api.creatomate.com/v1/templates/${templateId}`, {
      headers: { Authorization: `Bearer ${CREATOMATE_API_KEY}` },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`[${reqId}] GET template ${templateId} ${res.status}:`, body.slice(0, 200))
      return { id: templateId, name: '', elements: [], erro: `GET ${res.status}` }
    }
    const body = await res.json()
    const elements = extractElements(body?.source)
    // Sufixa rótulos virtuais para nomes duplicados (Photo, Photo-2, Photo-3, ...)
    // em vez de descartá-los. Slots de mesmo nome são comuns em templates de
    // carrossel/montagem e precisam ser endereçados individualmente. A chave
    // final enviada ao Creatomate usa o ID do elemento (não o virtualLabel)
    // para evitar ambiguidade quando os nomes colidem.
    const counts = new Map<string, number>()
    for (const e of elements) {
      const key = `${e.name}|${e.type}`
      const idx = (counts.get(key) || 0) + 1
      counts.set(key, idx)
      e.virtualLabel = idx === 1 ? e.name : `${e.name}-${idx}`
    }
    return { id: templateId, name: String(body?.name || ''), elements }
  } catch (err) {
    console.error(`[${reqId}] GET template ${templateId} erro:`, err)
    return { id: templateId, name: '', elements: [], erro: err instanceof Error ? err.message : String(err) }
  }
}

serve(async (req) => {
  const reqId = crypto.randomUUID().slice(0, 8)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes' }, 500)
    }
    if (!OPENAI_API_KEY) {
      return jsonResponse({ error: 'OPENAI_API_KEY não configurada' }, 500)
    }
    if (!CREATOMATE_API_KEY) {
      return jsonResponse({ error: 'CREATOMATE_API_KEY não configurada' }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // === Auth: validar JWT inbound e derivar user_id da identidade autenticada ===
    // NUNCA aceitar user_id do body — cliente roda com service_role e RLS bypass.
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
      return jsonResponse({ error: 'Authorization header ausente ou invalido' }, 401)
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !authUser) {
      console.warn(`[${reqId}] JWT invalido:`, authErr?.message)
      return jsonResponse({ error: 'Token invalido ou expirado' }, 401)
    }
    const authenticatedUserId = authUser.id

    const payload = await req.json().catch(() => ({}))
    const {
      campaign_id,
      fotos_urls = [],
      foto_principal,
      titulo,
      descricao,
      preco,
      endereco,
      tipo_imovel,
      corretor_nome,
      corretor_avatar_url,
      marca_imovel,
      selectedTemplates,
    } = payload as Record<string, unknown>

    // fotos_urls é a fonte de verdade, EM ORDEM (a primeira é a principal).
    // Se vier foto_principal explícita e ela não estiver na lista, prependa.
    const fotosRaw = Array.isArray(fotos_urls) ? (fotos_urls as string[]).filter(Boolean) : []
    const fotosArr = (() => {
      const principal = typeof foto_principal === 'string' && foto_principal.length > 0 ? foto_principal : ''
      if (!principal) return fotosRaw
      if (fotosRaw[0] === principal) return fotosRaw
      return [principal, ...fotosRaw.filter((u) => u !== principal)]
    })()
    const hasCampaignId = typeof campaign_id === 'string' && campaign_id.length > 0

    // Templates escolhidos pelo usuário (frontend manda em selectedTemplates).
    // Fonte única de verdade: backend NUNCA escolhe sozinho.
    const selectedArrRaw = Array.isArray(selectedTemplates)
      ? (selectedTemplates as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
      : []

    console.log(`[${reqId}] gerar-banners | campaign=${hasCampaignId ? campaign_id : '(sem id)'} | user=${authenticatedUserId} | fotos=${fotosArr.length} | selectedTemplates=${selectedArrRaw.length}`)

    // Buscar dados da campanha (opcional — se foi passado um campaign_id, enriquecemos)
    let campaignRow: { titulo?: string; dados_imovel?: Record<string, unknown>; textos_gerados?: Record<string, unknown>; user_id?: string } | null = null
    if (hasCampaignId) {
      const { data } = await supabase
        .from('campaigns')
        .select('id, titulo, dados_imovel, textos_gerados, user_id')
        .eq('id', campaign_id)
        .maybeSingle()
      campaignRow = data as typeof campaignRow

      // Ownership: campanha tem que pertencer ao usuario autenticado
      if (campaignRow && campaignRow.user_id && campaignRow.user_id !== authenticatedUserId) {
        console.warn(`[${reqId}] usuario ${authenticatedUserId} tentou acessar campanha ${campaign_id} de outro usuario`)
        return jsonResponse({ error: 'Campanha nao pertence ao usuario autenticado' }, 403)
      }
    }

    // user_id agora SEMPRE vem do JWT — body.user_id e campaignRow.user_id sao ignorados como fontes
    const profileId: string = authenticatedUserId

    type ProfileRow = {
      nome?: string
      email?: string
      creci?: string
      telefone?: string
      whatsapp?: string
      imobiliaria?: string
      site?: string
      instagram?: string
      avatar_url?: string
      logo_url?: string
    }
    let profileRow: ProfileRow | null = null
    if (profileId) {
      const { data, error: profileErr } = await supabase
        .from('profiles')
        .select('nome, email, creci, telefone, whatsapp, imobiliaria, site, instagram, avatar_url, logo_url')
        .eq('id', profileId)
        .maybeSingle()
      if (profileErr) console.warn(`[${reqId}] profile fetch erro:`, profileErr.message)
      profileRow = (data as ProfileRow) || null
    }

    const dadosImovel = (campaignRow?.dados_imovel as Record<string, unknown>) || {}
    const categoria = String(dadosImovel.categoria || tipo_imovel || 'medio_padrao')

    // Merge: profile do banco tem prioridade sobre payload (fonte de verdade)
    const corretorNomeFinal  = profileRow?.nome        || (typeof corretor_nome === 'string' ? corretor_nome : '') || ''
    const corretorEmail      = profileRow?.email       || ''
    const corretorCRECI      = profileRow?.creci       || ''
    const corretorTelefone   = profileRow?.telefone    || String(dadosImovel.telefone_contato || '')
    const corretorWhatsApp   = profileRow?.whatsapp    || corretorTelefone
    const marcaFinal         = profileRow?.imobiliaria || (typeof marca_imovel === 'string' ? marca_imovel : '') || ''
    const siteFinal          = profileRow?.site        || ''
    const instagramFinal     = profileRow?.instagram   || ''
    const logoUrl            = profileRow?.logo_url    || ''

    // Avatar do corretor:
    // - Se o profile do banco tem avatar_url, é a fonte de verdade.
    // - Se o profile NÃO tem, mas o payload mandou 'REMOVER_ELEMENTO' explícito,
    //   honra isso (frontend já validou que não há foto cadastrada).
    // - Caso contrário, segue REMOVER_ELEMENTO padrão (string vazia abaixo vira REMOVER_ELEMENTO no prompt).
    const avatarFromPayload = typeof corretor_avatar_url === 'string' ? corretor_avatar_url : ''
    const avatarUrl =
      profileRow?.avatar_url
        ? profileRow.avatar_url
        : (avatarFromPayload && avatarFromPayload !== 'REMOVER_ELEMENTO' ? avatarFromPayload : '')

    // Bloco compartilhado com os dois prompts
    const dadosImovelBloco = `DADOS DO IMÓVEL:
- Título: ${titulo || campaignRow?.titulo || 'Imóvel'}
- Categoria/Perfil: ${categoria}
- Tipo de imóvel: ${tipo_imovel || dadosImovel.tipo || 'não informado'}
- Descrição: ${descricao || ''}
- Preço: ${preco || dadosImovel.preco || ''}
- Endereço: ${endereco || `${dadosImovel.bairro || ''}${dadosImovel.cidade ? ', ' + dadosImovel.cidade : ''}${dadosImovel.estado ? ' - ' + dadosImovel.estado : ''}`}
- Fotos do imóvel (${fotosArr.length}): ${JSON.stringify(fotosArr)}

DADOS DO CORRETOR (use exatamente esses; NÃO invente nem use nomes/emails/telefones fictícios em inglês):
- Nome: ${corretorNomeFinal || '(não informado)'}
- CRECI: ${corretorCRECI || 'REMOVER_ELEMENTO'}
- Telefone: ${corretorTelefone || '(não informado)'}
- WhatsApp: ${corretorWhatsApp || 'REMOVER_ELEMENTO'}
- Email: ${corretorEmail || 'REMOVER_ELEMENTO'}
- Imobiliária/Marca: ${marcaFinal || 'REMOVER_ELEMENTO'}
- Site: ${siteFinal || 'REMOVER_ELEMENTO'}
- Instagram: ${instagramFinal || 'REMOVER_ELEMENTO'}
- Foto do corretor: ${avatarUrl || 'REMOVER_ELEMENTO'}
- Logo da imobiliária: ${logoUrl || 'REMOVER_ELEMENTO'}`

    // === ESTÁGIO 1: seleção de templates ==================================
    // ESTRITAMENTE os IDs marcados pelo corretor (frontend → selectedTemplates).
    // SEM fallback de IA, SEM cap. Lista vazia => 400.
    const validIds = new Map(TEMPLATES.map((t) => [t.id, t]))
    let pickedIds: string[] = []

    // SEM fallback de IA. SEM cap. A lista marcada pelo corretor é a fonte
    // única de verdade. Se o frontend não enviar selectedTemplates (ou
    // enviar lista vazia / só IDs inválidos), retornamos erro — NUNCA o
    // backend escolhe sozinho.
    if (selectedArrRaw.length === 0) {
      return jsonResponse({
        error: 'selectedTemplates é obrigatório. O backend não escolhe templates autonomamente: envie a lista completa marcada pelo corretor.',
      }, 400)
    }

    const filtrados = selectedArrRaw.filter((id) => validIds.has(id))
    const invalidos = selectedArrRaw.filter((id) => !validIds.has(id))
    if (invalidos.length > 0) {
      console.warn(`[${reqId}] selectedTemplates contém IDs inválidos (ignorados):`, invalidos)
    }
    // Lote completo: 1, 10, 15 ou todos os 18+ templates passam direto.
    // Apenas deduplica IDs repetidos; NENHUM teto (nem 6, nem 7, nem outro)
    // é aplicado aqui ou em qualquer ponto subsequente do pipeline.
    pickedIds = Array.from(new Set(filtrados))
    if (pickedIds.length === 0) {
      return jsonResponse({
        error: 'Nenhum template válido em selectedTemplates',
        invalid_ids: invalidos,
      }, 400)
    }
    console.log(`[${reqId}] estágio 1 (user-only, sem cap): ${pickedIds.length} templates em lote`)

    // === ESTÁGIO 2: GET de cada template para descobrir elementos reais ===
    const schemas = await Promise.all(pickedIds.map((id) => fetchTemplateElements(reqId, id)))
    const schemasComElementos = schemas.filter((s) => s.elements.length > 0)

    if (schemasComElementos.length === 0) {
      return jsonResponse({ error: 'Não foi possível obter elementos de nenhum template' }, 502)
    }

    console.log(`[${reqId}] estágio 2: ${schemasComElementos.length} templates com elementos reais`)

    // === ESTÁGIO 3: IA produz modifications usando elementos REAIS ========
    const elementosBloco = schemasComElementos.map((s) => {
      const meta = validIds.get(s.id)
      const lista = s.elements
        .map((e) => `  - "${e.virtualLabel || e.name}" (${e.type})${e.defaultValue ? ` [default: ${JSON.stringify(e.defaultValue.slice(0, 80))}]` : ''}`)
        .join('\n')
      return `TEMPLATE id="${s.id}" nome="${s.name || meta?.nome || ''}" formato="${meta?.formato || ''}"
Elementos reais:
${lista}`
    }).join('\n\n')

    const fillUserPrompt = `${dadosImovelBloco}

TEMPLATES SELECIONADOS COM ELEMENTOS REAIS:
${elementosBloco}

Para cada template, gere um objeto "modifications" usando APENAS os nomes de elementos listados acima.`

    const fillRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: FILL_SYSTEM_PROMPT },
          { role: 'user', content: fillUserPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 3500,
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (!fillRes.ok) {
      const errBody = await fillRes.text()
      console.error(`[${reqId}] fill OpenAI ${fillRes.status}:`, errBody.slice(0, 300))
      return jsonResponse({ error: `OpenAI (fill) ${fillRes.status}: ${errBody.slice(0, 300)}` }, 502)
    }

    let plano: { selecoes?: Array<{ template_id: string; modifications?: Record<string, unknown> }> }
    try {
      const fillData = await fillRes.json()
      const raw = fillData?.choices?.[0]?.message?.content
      plano = JSON.parse(raw)
    } catch (e) {
      console.error(`[${reqId}] fill parse:`, e)
      return jsonResponse({ error: 'OpenAI (fill) retornou JSON inválido' }, 502)
    }

    const aprovadas = (Array.isArray(plano.selecoes) ? plano.selecoes : [])
      .filter((s) => s.template_id && validIds.has(s.template_id))

    if (aprovadas.length === 0) {
      return jsonResponse({ error: 'IA (fill) não produziu modifications para nenhum template' }, 502)
    }

    // Validar/filtrar as modifications para conter SOMENTE chaves de elementos reais.
    // Indexamos por virtualLabel (o rótulo que a IA viu), não por name — assim slots
    // duplicados (Photo, Photo-2, ...) são endereçáveis individualmente.
    const elementosPorTemplate = new Map<string, Map<string, ElementInfo>>()
    for (const s of schemasComElementos) {
      const m = new Map<string, ElementInfo>()
      for (const e of s.elements) m.set(e.virtualLabel || e.name, e)
      elementosPorTemplate.set(s.id, m)
    }

    // Contexto compartilhado para o sanitizer (PT-BR + dados reais do imóvel + do corretor)
    const sanitizeCtx: SanitizeContext = {
      preco: preco != null ? String(preco) : (dadosImovel.preco != null ? String(dadosImovel.preco) : ''),
      endereco: typeof endereco === 'string' && endereco.trim()
        ? endereco
        : [dadosImovel.bairro, dadosImovel.cidade, dadosImovel.estado].filter(Boolean).join(', '),
      bairro: String(dadosImovel.bairro || ''),
      cidade: String(dadosImovel.cidade || ''),
      estado: String(dadosImovel.estado || ''),
      corretor_nome: corretorNomeFinal,
      corretor_email: corretorEmail,
      corretor_creci: corretorCRECI,
      marca_imovel: marcaFinal,
      telefone_contato: corretorTelefone,
      whatsapp: corretorWhatsApp,
      site: siteFinal,
      instagram: instagramFinal,
      titulo: typeof titulo === 'string' && titulo
        ? titulo
        : (campaignRow?.titulo || ''),
    }

    const aprovadasLimpas = aprovadas.map((sel) => {
      const elementos = elementosPorTemplate.get(sel.template_id)
      const mods: Record<string, unknown> = {}
      if (elementos && sel.modifications && typeof sel.modifications === 'object') {
        for (const [k, v] of Object.entries(sel.modifications)) {
          // Chave da IA: "<rótulo>.text|source|track", onde <rótulo> é o virtualLabel
          // que a IA viu (ex.: "Photo", "Photo-2"). A chave final enviada ao Creatomate
          // usa o ID do elemento quando disponível, evitando ambiguidade entre slots
          // de mesmo nome.
          const dot = k.lastIndexOf('.')
          if (dot < 0) continue
          const label = k.slice(0, dot)
          const prop = k.slice(dot + 1)
          const elem = elementos.get(label)
          if (!elem) continue

          const keyBase = elem.id || elem.name
          const finalKey = `${keyBase}.${prop}`

          // .track: booleano, válido para qualquer tipo de elemento.
          // Usado pela IA para "desativar" elementos quando o dado real não
          // existe (instrução REMOVER_ELEMENTO no prompt).
          if (prop === 'track') {
            if (typeof v === 'boolean') {
              mods[finalKey] = v
            }
            continue
          }

          // .text só em elementos type=text; .source em image/video/audio.
          const expectedProp = elem.type === 'text' ? 'text' : 'source'
          if (prop !== expectedProp) continue
          if (typeof v !== 'string') continue

          // String vazia EXPLÍCITA: passa direto. É a outra metade da
          // remoção — apaga o texto/source default do template. Costuma
          // vir junto com .track: false.
          if (v === '') {
            mods[finalKey] = ''
            continue
          }

          // Apenas whitespace: descarta (não é remoção intencional, é lixo).
          if (!v.trim()) continue

          if (prop === 'text') {
            const limpo = sanitizeTemplateText(v, sanitizeCtx)
            if (!limpo) continue
            // CTA: força estritamente uma das variações profissionais aprovadas,
            // independente do que a IA tenha gerado.
            mods[finalKey] = isCtaElement(elem.name) ? snapCta(limpo) : limpo
          } else {
            mods[finalKey] = v
          }
        }
      }
      return { template_id: sel.template_id, modifications: mods }
    }).filter((s) => Object.keys(s.modifications).length > 0)

    if (aprovadasLimpas.length === 0) {
      return jsonResponse({
        error: 'Nenhuma modification válida sobrou após validação contra elementos reais',
      }, 502)
    }

    // === Rede de segurança: garante que TODOS os slots de imagem do imóvel
    // de cada template estejam preenchidos. A primeira foto (foto principal)
    // ocupa o primeiro slot; as demais ocupam, em ordem, os slots seguintes;
    // se houver mais slots que fotos, a última foto se repete. Slots já
    // preenchidos pela IA com uma URL http(s) válida são preservados. Slots
    // marcados com .track: false pela IA são respeitados (não preenche).
    if (fotosArr.length > 0) {
      const elementosArrPorTemplate = new Map<string, ElementInfo[]>()
      for (const s of schemasComElementos) elementosArrPorTemplate.set(s.id, s.elements)
      for (const sel of aprovadasLimpas) {
        const els = elementosArrPorTemplate.get(sel.template_id) || []
        const propertySlots = els.filter(
          (e) => (e.type === 'image' || e.type === 'video') && isPropertyPhotoSlot(e.name)
        )
        let fotoIdx = 0
        for (const slot of propertySlots) {
          const keyBase = slot.id || slot.name
          const sourceKey = `${keyBase}.source`
          const trackKey = `${keyBase}.track`
          if (sel.modifications[trackKey] === false) continue
          const existing = sel.modifications[sourceKey]
          if (typeof existing === 'string' && /^https?:\/\//i.test(existing.trim())) {
            fotoIdx++
            continue
          }
          sel.modifications[sourceKey] = fotosArr[Math.min(fotoIdx, fotosArr.length - 1)]
          fotoIdx++
        }
      }
    }

    console.log(`[${reqId}] estágio 3: ${aprovadasLimpas.length} templates prontos para render`)

    // === Disparar renders no Creatomate (paralelo) ========================
    const renders: Array<Record<string, unknown>> = []

    await Promise.all(aprovadasLimpas.map(async (sel) => {
      const meta = validIds.get(sel.template_id)!
      try {
        const createRes = await fetch('https://api.creatomate.com/v1/renders', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${CREATOMATE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            template_id: sel.template_id,
            modifications: sel.modifications,
          }),
          signal: AbortSignal.timeout(30000),
        })

        if (!createRes.ok) {
          const errBody = await createRes.text()
          console.error(`[${reqId}] Creatomate render ${createRes.status} em ${meta.nome}:`, errBody.slice(0, 200))
          renders.push({
            template_id: sel.template_id,
            template_nome: meta.nome,
            categoria: meta.categoria,
            erro: `Creatomate ${createRes.status}: ${errBody.slice(0, 200)}`,
          })
          return
        }

        const body = await createRes.json()
        const items = Array.isArray(body) ? body : [body]
        for (const item of items) {
          renders.push({
            render_id: item.id,
            template_id: sel.template_id,
            template_nome: meta.nome,
            categoria: meta.categoria,
            formato: meta.formato,
            status: item.status || 'planned',
            url: item.url || null,
            snapshot_url: item.snapshot_url || null,
          })
        }
      } catch (err) {
        console.error(`[${reqId}] erro ao chamar Creatomate para ${meta.nome}:`, err)
        renders.push({
          template_id: sel.template_id,
          template_nome: meta.nome,
          categoria: meta.categoria,
          erro: err instanceof Error ? err.message : String(err),
        })
      }
    }))

    // === Persistir em campaigns.banners (jsonb) — somente se campaign_id ==
    if (hasCampaignId) {
      const { error: updErr } = await supabase
        .from('campaigns')
        .update({ banners: renders })
        .eq('id', campaign_id)

      if (updErr) {
        console.error(`[${reqId}] falha ao salvar banners:`, updErr)
        return jsonResponse({
          warning: `Renders disparados, mas não foi possível salvar em campaigns.banners: ${updErr.message}`,
          renders,
          pick_source: 'user',
        }, 200)
      }
    }

    console.log(`[${reqId}] OK | ${renders.length} renders disparados | pick=user`)
    return jsonResponse({ success: true, renders, pick_source: 'user' }, 200)
  } catch (error) {
    console.error(`[${reqId}] unhandled`, error)
    const msg = error instanceof Error ? error.message : String(error)
    return jsonResponse({ error: msg }, 500)
  }
})
