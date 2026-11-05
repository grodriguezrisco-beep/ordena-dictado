# ordena-dictado

Mod para Claude Code que ordena los mensajes dictados por voz (por ejemplo con Wispr Flow) antes de que lleguen a Claude.

Cuando envías un mensaje largo, el mod lo pasa por una consulta a Claude que lo reescribe en un formato claro (Qué quiero, Detalle, Para qué, Listo cuando, Condiciones, Lo que descarté; Para qué y Listo cuando solo si los dijiste). Deja solo la última versión de cada idea cuando te corriges al hablar, corrige palabras mal transcritas según el contexto de la conversación y, si algo no se entiende, te hace hasta tres preguntas en la ventana de opciones antes de enviar. El dictado original viaja escondido junto al texto ordenado para que Claude pueda contrastarlo.

- Los mensajes de menos de 20 palabras pasan tal cual.
- Un mensaje que empieza con `//` se envía tal cual, sin ordenar.
- Si el ordenado falla, el mensaje se envía tal cual con un aviso.
- Cada mensaje largo hace una consulta extra a Claude sobre la conversación, así que gasta tokens.

## Reglas propias

Puedes darle reglas tuyas (palabras que tu dictado confunde, cómo escribes) en un archivo `ORDENA_DICTADO.md`. El mod lo busca como Claude busca el `CLAUDE.md`: en la carpeta donde abres la sesión y en todas las de arriba. Si no encuentra ninguno, usa `~/.claude/ORDENA_DICTADO.md`. Si lo guardas en una carpeta sincronizada, tus reglas son las mismas en todas tus computadoras.

## Instalación

En una terminal, en el prompt de Claude Code:

```
/plugin install ordena-dictado --marketplace grodriguezrisco-beep/ordena-dictado
```

Responde `y` para agregar el marketplace y elige el alcance de usuario.

Desde la terminal del sistema:

```bash
claude plugin install ordena-dictado --marketplace grodriguezrisco-beep/ordena-dictado
```

En la app de escritorio: haz clic en + junto a la caja de texto, luego Plugins, Add marketplace con `grodriguezrisco-beep/ordena-dictado`, y luego Add plugin.
