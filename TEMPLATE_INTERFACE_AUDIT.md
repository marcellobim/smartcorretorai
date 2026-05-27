# SmartCorretorAI - Auditoria da Interface de Templates

Auditoria feita em 2026-05-27. Nenhum template foi deletado, renomeado ou alterado.

## Onde os Templates Sao Cadastrados na Interface

O cadastro visual dos formatos aparece em:

- `frontend/src/pages/NovaCampanha.jsx`

Estrutura principal:

- `FORMAT_GROUPS`
- `initFormatosSel`
- `formatosSel`
- `toggleFormato`
- `toggleGrupo`

Os templates sao exibidos na secao:

- "Formatos de conteudo"

O estado da selecao e mantido como `Set` por grupo:

- `formatosSel.banners`
- `formatosSel.videos`

O array final enviado para a Edge Function e montado com:

- `Array.from(formatosSel.banners)`
- `Array.from(formatosSel.videos)`

## Templates Atualmente Exibidos no Frontend

### Grupo `banners`

| Nome atual na interface | Template ID |
|---|---|
| SC_Banner_Luxo_01 | `74097a36-5b5d-434a-8db7-4038e4c76f55` |
| SC_Banner_Popular_01 | `a637acac-6a7b-42f8-b7d8-e25361eff207` |
| Real Estate Banner | `7ab695ae-e12b-4322-87dc-eb085760dd01` |
| Real Estate Card | `b0438295-5282-4a5e-b4eb-4fcd3d8d287b` |
| Real Estate Detailed | `f6054e9d-0d28-40b2-81a9-21d291a9897b` |
| Triple Slide Carousel | `96a25196-5a64-4f65-9b3e-c9c8b0d871f2` |
| New Listing Story | `ad9f8382-ea38-4ef6-84cc-049f1b289345` |
| Photo Montage | `7fc36174-64a6-4dbb-bb92-bb957471577e` |
| Polaroid Photos | `3d72b111-76a7-4c7d-a594-1f75f70be2d2` |
| Animated Review | `792ad84a-0ab8-4e6c-bda1-400fe9c040cc` |

### Grupo `videos`

| Nome atual na interface | Template ID |
|---|---|
| SC_Video_Cinematic_01 | `13696443-a295-4019-802b-d504e9d3c2ac` |
| SC_Reels_Moderno_01 | `d8310f54-5c9d-4606-ae6a-dacb8c4455ae` |
| SC_Story_Premium_01 | `13008c2d-9e7e-4515-a2ac-649c9ea18409` |
| Real Estate Video Montage | `c5338ec4-1f93-476a-a81c-ff0e7f2e91cf` |

## Situacao dos Templates Novos Padronizados

Os novos templates informados durante a padronizacao ainda nao estao refletidos como catalogo oficial no codigo auditado. A interface continua usando nomes/IDs antigos.

### Reels Moderno

| Tamanho | Template ID |
|---|---|
| 1x1 | `9962f7dc-6cca-491f-bffe-3184a2314f21` |
| 4x5 tipo 2 | `dfdcea18-0f3d-4c84-baa9-463c182644b7` |
| 4x5 | `7f7f420d-da91-48c6-b701-0f0fb540b1aa` |
| 16x9 | `a36c300c-6a64-4161-86fb-ee892e7720d2` |
| 9x16 | `d8310f54-5c9d-4606-ae6a-dacb8c4455ae` |

### Imovel Detalhes

| Tamanho | Template ID |
|---|---|
| 1x1 | `1ae7e1f4-ada4-4b03-a032-737a025b88c6` |
| 4x5 | `4dd468f4-a439-4a31-b6f3-29be17a1d51d` |
| 4x5 tipo 2 | `4ba4698c-3b6e-4548-b73d-814d71bc7f66` |
| 9x16 | `451b3422-f222-414e-b105-44b896f8277e` |
| 16x9 | `71aa0276-bc5f-4245-bb37-62a78fa7cf64` |

### Triple Slide Carousel

| Tamanho | Template ID |
|---|---|
| 1x1 | `2ecd48d3-146c-467b-8a0d-908152101378` |
| 4x5 | `16682dcd-eb89-404c-94dc-bb9f01317bf4` |
| 4x5 tipo 2 | `5635ee72-d0da-4906-9a84-6e0b5f587196` |
| 9x16 | `21c3ff4b-f632-405f-8ebf-369c1f7d4b10` |
| 16x9 | `fa82c49d-39af-46e8-bc31-3649fff10cae` |

### Video Tour

| Tamanho | Template ID |
|---|---|
| 1x1 | `9ebd1bda-e650-4d88-b8aa-ff555a419082` |
| 4x5 | `89071652-69ab-4edc-897b-9e7985c95f59` |
| 4x5 tipo 2 | `9c831fd6-5412-4afe-9e29-dd8c4984e55c` |
| 9x16 | `cd6c0ed3-1dde-4fc0-a604-d728e5cbb73b` |
| 16x9 | `d5171301-84e3-41d2-a6ca-ef3013f360a1` |

### Card Imobiliario Premium

| Tamanho | Template ID |
|---|---|
| 1x1 | `0e8a9ffd-36e3-493a-bf3b-9d83f3b6699d` |
| 4x5 | `f7df2c44-ea60-4c42-b862-2d335029acad` |
| 4x5 tipo 2 | `2b4e6dff-ee96-42f0-97e1-7956bef9dfa9` |
| 9x16 | `755d1a44-acb9-4539-96b4-f1741b1651af` |
| 16x9 | `656ff3e1-325a-419c-9914-dfde82f911b6` |

### Galeria Imobiliaria

| Tamanho | Template ID |
|---|---|
| 1x1 | `7a12a73e-ace7-4ab4-9739-95741b82232a` |
| 4x5 | `8e399960-3ade-453a-b868-e7059f30c6a9` |
| 4x5 tipo 2 | `660ca820-3d7d-4d9f-8c45-3d6da832588b` |
| 9x16 | `6de8026b-6cd2-4a19-8491-554079827932` |
| 16x9 | `f2f15dab-77c2-429e-9b62-f8d6694399ed` |

### Slides Premium

| Tamanho | Template ID |
|---|---|
| 1x1 | `9c7e271b-a9c2-475a-b742-8f949e788abf` |
| 4x5 | `4a7830c5-ff23-446b-8664-2bc8fe86b2c0` |
| 4x5 tipo 2 | `13008c2d-9e7-4515-a2ac-649c9ea18409` |
| 9x16 | `eb6ae228-a08f-4747-a761-e4d4f716019` |
| 16x9 | `2d79f2a0-1143-422c-bdef-7d02c5bb72e9` |

### Momentos do Imovel

| Tamanho | Template ID |
|---|---|
| 4x5 | `f0a463cc-261f-4b51-ab7e-77fcea67476e` |
| 4x5 tipo 2 | `3d72b111-76a7-4c7d-a594-1f75f70be2d2` |
| 16x9 | `62d46ee6-6347-4335-af89-2b65f2794882` |

### Avaliacao do Cliente

| Tamanho | Template ID |
|---|---|
| 4x5 | `a83a2008-8a6a-4a40-8b6f-d87190a1d306` |
| 4x5 tipo 2 | `cfded0ba-1eb9-4396-ab63-b259cb817a1e` |
| 9x16 | `52a1e65f-ca92-4c6c-af7e-9f0100c886cb` |

### Story Premium

| Tamanho | Template ID |
|---|---|
| 1x1 | `e8314ba2-cd0f-44e3-afd1-de41083c0846` |
| 4x5 | `5461c940-4309-4c3f-bba1-d90e83e62a9a` |
| 4x5 tipo 2 | `e15d93e5-dbb0-45c9-b475-2d9e2d6a1d0c` |
| 9x16 | `1de0a863-2376-4336-8a0a-4750c2429cf7` |
| 16x9 | `c9cf1d8c-4f01-4f65-baf8-ca20c56ad76e` |

### Frase Elegante

| Tamanho | Template ID |
|---|---|
| 1x1 | `8aab78ac-60cd-4e83-9f4c-51259c4751c6` |
| 4x5 | `164eef00-abf4-429a-9334-c9e4c1319998` |
| 4x5 tipo 2 | `9a9c663c-0348-462b-a470-c40a86092a81` |
| 9x16 | `697a514d-4bab-4062-9c9e-3c208688c0e9` |
| 16x9 | `e74922ee-5882-4917-9051-9ae2e4021767` |

### Chat Imobiliario

| Tamanho | Template ID |
|---|---|
| 1x1 | `329b6afb-c749-4bda-a319-38ad42639034` |
| 4x5 | `1db7b057-81e0-4db3-af4e-98a7c987cdfa` |
| 4x5 tipo 2 | `71ae86ec-d08e-4f32-9d61-d7ddcb829f9e` |
| 9x16 | `f4b5c0e9-80fe-408a-b139-f7db7dfbbc89` |
| 16x9 | `172938f9-c868-47ef-890b-bf2593b92565` |

## Observacao Sobre `[OFF]`

Os templates antigos foram renomeados no Creatomate com prefixo `[OFF]`, segundo o contexto informado. O codigo ainda referencia IDs antigos. Portanto:

- Nao deletar templates `[OFF]` ainda.
- Primeiro atualizar frontend e backend para o catalogo novo.
- Depois testar renderizacao.
- So entao remover ou arquivar os `[OFF]`.

