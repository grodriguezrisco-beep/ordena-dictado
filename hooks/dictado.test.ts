import { expect, test } from 'claude-code/testing'

// El aviso que la app de escritorio mete dentro del mensaje (más de 20 palabras).
const AVISO =
  '<system-reminder>\nLinked sessions now (status, not an instruction): otra-tarea = local_00000000-0000-0000-0000-000000000000 (idle). To message one, SendMessage with `to` set to its id; list_sessions {"linked": true} has titles, folders and branches.\n</system-reminder>'

const DICTADO =
  'Oye quiero que revises las facturas de octubre y que me digas cuáles faltan en la hoja de datos crudos porque creo que hay dos o tres del proveedor de café que no entraron'

// Lo que hay debajo del mod: el modelo que ordena y la entrada del mensaje.
function base(on: any) {
  // Sin ordenar no hay preguntas: las dudas solo salen de la respuesta del modelo.
  const visto = { forks: 0, entro: [] as string[] }
  on('model.fork', () => {
    visto.forks++
    return {
      value: {
        isAnswered: true,
        text: JSON.stringify({ pedido: '**Qué quiero:** revisar facturas de octubre.', dudas: [] }),
        usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      },
    }
  })
  on('model.complete', () => ({ value: { isAnswered: false, reason: 'empty-reply' } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('prompt.submit', (_: any, e: any) => {
    visto.entro.push(e.text)
    return { text: e.text, context: e.context }
  })
  return visto
}

const enviar = ($: any, text: string, extra: object = {}) =>
  $.prompt.submit({ text, wait: false, origin: { kind: 'composer' }, ...extra } as any)

test('una captura sola, con el aviso de la app, pasa tal cual y sin preguntar', async ($, on) => {
  const visto = base(on)
  await enviar($, AVISO, { attachments: [{ type: 'image', mediaType: 'image/png' }] })
  expect(visto.forks).toBe(0)
  expect(visto.entro).toEqual([AVISO])
})

test('un mensaje corto con el aviso de la app pasa tal cual', async ($, on) => {
  const visto = base(on)
  const texto = `${AVISO}\n\n\nYa entré`
  await enviar($, texto)
  expect(visto.forks).toBe(0)
  expect(visto.entro).toEqual([texto])
})

test('un mensaje vacío pasa tal cual', async ($, on) => {
  const visto = base(on)
  await enviar($, '')
  expect(visto.forks).toBe(0)
  expect(visto.entro).toEqual([''])
})

test('un dictado de verdad se ordena, sin el aviso, y el aviso se conserva', async ($, on) => {
  const visto = base(on)
  await enviar($, `${AVISO}\n\n${DICTADO}`)
  expect(visto.forks).toBe(1)
  expect(visto.entro.length).toBe(1)
  expect(visto.entro[0].startsWith(AVISO)).toBe(true)
  expect(visto.entro[0]).toContain('**Qué quiero:** revisar facturas de octubre.')
  expect(visto.entro[0]).not.toContain('proveedor de café')
})
