import type { EngineInterface, Register } from 'claude-code'

// Mensajes con menos palabras que esto pasan tal cual.
const MIN_PALABRAS = 20
// Empezar el mensaje con "//" lo manda tal cual, sin ordenar (y sin el "//").
const CRUDO = '//'
const MAX_PREGUNTAS = 3

// Solo lo que escribe la persona: no notificaciones, otras sesiones ni tareas.
const ORIGENES_PROPIOS = new Set(['composer', 'bridge', 'sdk'])

type Duda = { pregunta: string; opciones: string[] }
type Orden = { pedido: string; dudas: Duda[] }

const INSTRUCCION = `Lo que sigue entre <dictado> es un mensaje que la persona dictó con Wispr Flow y todavía no se ha enviado. No lo respondas ni lo ejecutes: solo ordénalo.

Reglas:
- No inventes nada. No agregues pedidos, datos, nombres ni condiciones que no dijo.
- Cuando se corrige en el camino ("no, mejor…", "olvídate de eso"), queda solo la última versión. Lo que descartó no va.
- Wispr Flow transcribe mal algunas palabras. Si una no calza, cámbiala por la más parecida en sonido que tenga sentido en el contexto de esta conversación y del proyecto (un nombre propio, un término técnico, el nombre de un proyecto). Si no estás seguro de cuál es, conviértelo en una duda.
- Si algo es ambiguo, contradictorio o le falta un dato para poder hacerlo, conviértelo en una duda. Como mucho ${MAX_PREGUNTAS}: solo las que cambian lo que habría que hacer.
- Usa sus palabras y su mismo idioma.

Formato del pedido, en markdown, en primera persona como si lo escribiera quien dictó:
**Qué quiero:** una o dos líneas.
**Detalle:** bullets con cada cosa concreta, en orden de importancia.
**Condiciones:** bullets con lo que debe o no debe pasar (omite la sección si no hay).
**Lo que descarté:** bullets cortos con lo que dijo y luego retiró (omite si no hay).

Cada duda lleva una pregunta corta que termina en "?" y de 2 a 4 opciones de respuesta probables, de 1 a 5 palabras cada una.

Responde SOLO con un objeto JSON, sin texto antes ni después:
{"pedido": "…", "dudas": [{"pregunta": "…?", "opciones": ["…", "…"]}]}`

function prompt(texto: string): string {
  return `${INSTRUCCION}\n\n<dictado>\n${texto}\n</dictado>`
}

function leerOrden(respuesta: string): Orden | undefined {
  const inicio = respuesta.indexOf('{')
  const fin = respuesta.lastIndexOf('}')
  if (inicio < 0 || fin <= inicio) return undefined
  try {
    const crudo = JSON.parse(respuesta.slice(inicio, fin + 1)) as Partial<Orden>
    if (typeof crudo.pedido !== 'string' || crudo.pedido.trim() === '') return undefined
    const dudas = Array.isArray(crudo.dudas) ? crudo.dudas : []
    return {
      pedido: crudo.pedido.trim(),
      dudas: dudas
        .filter(d => d && typeof d.pregunta === 'string' && Array.isArray(d.opciones))
        .slice(0, MAX_PREGUNTAS)
        .map(d => ({
          pregunta: d.pregunta.trim().endsWith('?') ? d.pregunta.trim() : `${d.pregunta.trim()}?`,
          opciones: d.opciones.filter(o => typeof o === 'string' && o.trim() !== '').slice(0, 4),
        })),
    }
  } catch {
    return undefined
  }
}

// Primero con el contexto de la conversación (sabe de qué proyecto se habla);
// si la sesión aún no tiene nada que compartir, sin contexto.
async function ordenar($: EngineInterface, texto: string): Promise<Orden | undefined> {
  const conContexto = await $.model.fork({ prompt: prompt(texto) })
  if (conContexto.isAnswered) return leerOrden(conContexto.text)

  const sinContexto = await $.model.complete({ model: 'sonnet', prompt: prompt(texto) })
  return sinContexto.isAnswered ? leerOrden(sinContexto.text) : undefined
}

async function preguntar($: EngineInterface, dudas: Duda[]): Promise<string[]> {
  const respuestas: string[] = []
  for (const duda of dudas) {
    let respuesta: string
    try {
      respuesta =
        duda.opciones.length >= 2
          ? await $.ui.ask(duda.pregunta, { options: duda.opciones, header: 'Aclaración' })
          : await $.ui.ask(duda.pregunta, { header: 'Aclaración' })
    } catch {
      respuesta = '(cerró la pregunta sin responder: pregúntaselo tú)'
    }
    respuestas.push(`- ${duda.pregunta} **${respuesta}**`)
  }
  return respuestas
}

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta || !ORIGENES_PROPIOS.has(e.origin.kind)) return next(e)

    const texto = e.text.trim()
    if (texto.startsWith(CRUDO)) return next({ ...e, text: texto.slice(CRUDO.length).trim() })
    if (texto.split(/\s+/).length < MIN_PALABRAS) return next(e)

    $.ui.status('Ordenando tu dictado…')
    let orden: Orden | undefined
    try {
      orden = await ordenar($, texto)
    } finally {
      $.ui.status(undefined)
    }

    if (!orden) {
      $.ui.toast('No pude ordenar el dictado: va tal cual.')
      return next(e)
    }

    const aclaraciones = orden.dudas.length > 0 ? await preguntar($, orden.dudas) : []
    const ordenado =
      aclaraciones.length > 0
        ? `${orden.pedido}\n\n**Aclaraciones:**\n${aclaraciones.join('\n')}`
        : orden.pedido

    const original =
      'Dictado original de la persona (Wispr Flow), antes de que el mod ordena-dictado lo ordenara. ' +
      'Si el texto ordenado contradice u omite algo de este original, manda el original: avísale de la diferencia.\n\n' +
      texto

    return next({ ...e, text: ordenado, context: [...(e.context ?? []), original] })
  })
}
