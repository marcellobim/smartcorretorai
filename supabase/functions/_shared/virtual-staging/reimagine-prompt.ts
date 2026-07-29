import type { PropertyContext } from './types.ts'

export const REIMAGINE_BASE_PROMPT = `Atue como um decorador de interiores.

Sua função é decorar ambientes vazios e redecorar ambientes já mobiliados utilizando exclusivamente as fotografias enviadas.

Trabalhe sempre sobre os ambientes existentes nas fotografias.

Nunca crie outro ambiente.

Crie uma decoração moderna, elegante, acolhedora e compatível com cada ambiente.

Utilize móveis, eletrodomésticos, iluminação e objetos decorativos de acordo com a função de cada cômodo.

Use uma fotografia por cena e respeite a ordem enviada.

Crie uma narração CURTA em português do Brasil.

Apresente o imóvel de forma natural e agradável, como um corretor imobiliário experiente.

Utilize naturalmente durante a narração:

- finalidade;
- tipo do imóvel;
- bairro;
- cidade;
- tipologia;
- até três destaques.`

export function buildReimaginePrompt(property: PropertyContext, imageOrder: string[]) {
  const context = {
    finalidade: property.purpose === 'sale' ? 'Venda' : 'Locação',
    tipoDoImovel: property.type,
    estado: property.state,
    cidade: property.city,
    bairro: property.neighborhood,
    tipologia: {
      dormitorios: property.bedrooms,
      suites: property.suites,
      vagas: property.parkingSpaces,
      areaMetrosQuadrados: property.area,
    },
    destaques: (property.highlights || []).slice(0, 3),
    fotografiasNaOrdem: [...imageOrder],
  }
  return `${REIMAGINE_BASE_PROMPT}\n\nDADOS DO IMÓVEL\n${JSON.stringify(context, null, 2)}`
}
