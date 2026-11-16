/**
 * Los textos de la interfaz, en un solo lugar.
 *
 * Reglas, que salen de design-reference/sistema/voz-y-textos.md:
 *  - Castellano rioplatense con voseo. "Elegí", "armá", "entrás".
 *  - Como un colega, no como un sistema. Decí qué pasó, no qué falló.
 *  - Botones: un verbo y un objeto. Nunca "Aceptar", nunca "Enviar" solo.
 *  - Sin signos de exclamación salvo para confirmar que algo salió bien.
 *  - Nunca emojis.
 *
 * El vocabulario de abajo es la tabla de equivalencias de ese documento. Las
 * pantallas usan estas palabras y no las del modelo de datos: en la base un
 * grupo se llama `classroom` y una tarea `classroom_assignment`, y eso no tiene
 * por qué llegar a la pantalla. Más adelante el vocabulario puede variar según
 * el tipo de cuenta sin tocar un componente.
 *
 * Los bloques del rediseño van sumando secciones acá a medida que rehacen cada
 * pantalla. Las pantallas todavía no rediseñadas conservan sus textos viejos.
 */

export const VOCABULARIO = {
  /** No "programa de materia". */
  temario: 'temario',
  /** No "aula": suena institucional, y además se crea solo. */
  grupo: 'grupo',
  /** No "asignación". */
  tarea: 'tarea',
  /** No "ventana de disponibilidad". */
  desde: 'Desde',
  hasta: 'Hasta',
  /** No "diseño curricular". La jurisdicción no se muestra nunca. */
  planOficial: 'plan oficial de la provincia',
  /** No "perfil pedagógico". */
  comoDasLaMateria: 'cómo das la materia',
} as const

export const MARCA = {
  nombre: 'MaestrIA',
  /** Qué es, en una frase que entiende alguien que nunca la usó. */
  queEs:
    'El docente arma el temario y manda tareas. La IA le muestra a cada alumno en qué se equivoca antes de darle la respuesta.',
} as const

export const NAVEGACION = {
  etiquetaNav: 'Principal',
  alumno: { tareas: 'Mis tareas', practicar: 'Practicar', progreso: 'Mi progreso' },
  docente: { alumnos: 'Mis alumnos', materias: 'Mis materias', tareas: 'Mis tareas' },
  /** Sub-entradas de "Mi progreso" mientras historial y tips sigan en dos pantallas (bloque 6 las funde). */
  progreso: { historial: 'Historial', tips: 'Tips' },
  ingresar: 'Ingresar',
} as const

export const MODO = {
  aOscuro: 'Cambiar a modo oscuro',
  aClaro: 'Cambiar a modo claro',
} as const

export const ENTRADA = {
  titulo: '¿Cómo entrás?',
  bajada: 'Elegí una vez. Después lo podés cambiar desde tu perfil.',
  docente: { titulo: 'Soy docente', detalle: 'Armo temarios y mando tareas' },
  alumno: { titulo: 'Soy alumno', detalle: 'Practico y rindo mis tareas' },
  separador: 'o',
  codigo: {
    etiqueta: 'Tu profe te pasó un código',
    ejemplo: '7K4P2M',
    ir: 'Ir',
    irAccesible: 'Ir al grupo',
    incompleto: (largo: number) => `El código tiene ${largo} caracteres. Fijate si te falta alguno.`,
  },
} as const

export const INGRESO = {
  docente: {
    titulo: 'Entrá como docente',
    bajada: 'Con tu cuenta guardamos tus materias, tus alumnos y sus tareas.',
    volver: 'No soy docente: volver',
  },
  alumno: {
    titulo: 'Entrá como alumno',
    bajada: 'Con tu cuenta guardamos tus tareas y tu progreso.',
    volver: 'No soy alumno: volver',
    tengoCodigo: 'Tengo un código de mi profe: entrar sin cuenta',
  },
  /** Quien llega a /sign-in sin haber pasado por la entrada (un link viejo, el rebote del proxy). */
  sinRol: {
    titulo: 'Entrá a MaestrIA',
    bajada: 'Usá tu cuenta de Google. Si es tu primera vez, la cuenta se crea sola.',
    volver: 'Volver al inicio',
  },
  /** El rebote desde /practicar: decir por qué se pide la cuenta. */
  paraPracticar: 'Para practicar por tu cuenta necesitás una cuenta. Es gratis.',
  conGoogle: 'Continuar con Google',
  abriendoGoogle: 'Abriendo Google…',
} as const

export const BIENVENIDA = {
  guardando: 'Preparando tu cuenta…',
  noSeGuardo: 'No pudimos guardar tu elección. Probá de nuevo.',
  nivel: {
    titulo: '¿Qué estás cursando?',
    bajada: 'Así te mostramos tus materias de entrada.',
  },
  grado: {
    tituloPrimario: '¿En qué grado estás?',
    titulo: '¿En qué año estás?',
    sinContenido:
      'Todavía no hay contenidos cargados para este nivel. Podés elegir tu materia más adelante, desde Practicar.',
    queCargamos: 'los años de tu nivel',
  },
  volver: 'Volver',
  saltar: 'Elegir más tarde',
} as const

export const GRUPO = {
  buscando: 'Buscando el grupo…',
  teInvito: (docente: string) => `Te invitó ${docente}`,
  bajadaInvitado: 'Entrás con tu nombre. No necesitás cuenta.',
  nombre: { etiqueta: '¿Cómo te llamás?', ejemplo: 'Nombre y apellido' },
  entrar: 'Entrar al grupo',
  entrarComo: (nombre: string) => `Entrar como ${nombre}`,
  entrando: 'Entrando…',
  yaTengoCuenta: 'Ya tengo cuenta: entrar con Google',
  codigoInvalido: 'Ese código no parece correcto. Tiene que tener 6 caracteres.',
  noEncontrado: 'No encontramos ningún grupo con ese código.',
  sinConexion: 'No pudimos conectarnos. Probá de nuevo en un momento.',
  noPudimosSumarte: 'No pudimos sumarte al grupo. Probá de nuevo.',
  volverAlInicio: 'Volver al inicio',
} as const

export const INVITADO = {
  aviso: 'Estás entrando como invitado. Creá tu cuenta para no perder tu progreso.',
  conCuenta: 'Con tu cuenta también vas a poder practicar por tu cuenta y ver cómo te va en cada tema.',
  crearCuenta: 'Crear mi cuenta',
} as const

export const CUENTA = {
  abrirMenu: 'Abrir el menú de tu cuenta',
  estasComo: { DOCENTE: 'Estás como docente', ALUMNO: 'Estás como alumno' },
  cerrarSesion: 'Cerrar sesión',
  /** Docente: mirar la app como la ve un alumno, sin dejar de ser docente. */
  verComoAlumno: 'Ver la vista de alumno',
  verComoAlumnoDetalle: 'Se abre en otra pestaña',
  vistaAlumno: {
    aviso: 'Estás viendo la vista de alumno. Tu cuenta sigue siendo de docente.',
    volver: 'Volver a mi panel',
  },
  cambiar: {
    aAlumno: {
      item: 'Cambiar mi cuenta a alumno',
      titulo: '¿Cambiar a la vista de alumno?',
      detalle: 'Vas a cambiar a la vista de alumno. Tus materias y alumnos siguen donde están.',
    },
    aDocente: {
      item: 'Cambiar mi cuenta a docente',
      titulo: '¿Cambiar a la vista de docente?',
      detalle: 'Vas a cambiar a la vista de docente. Tus tareas y tu progreso siguen donde están.',
    },
    confirmar: 'Cambiar de vista',
    cancelar: 'Quedarme acá',
    cambiando: 'Cambiando…',
    fallo: 'No pudimos cambiar tu cuenta. Probá de nuevo.',
  },
} as const

export const LEGALES = {
  terminos: 'Términos y condiciones',
  privacidad: 'Política de privacidad',
  /** `accion` completa "Al ___ aceptás…": "ingresar", "entrar al grupo". */
  aviso: (accion: string) => ({ antes: `Al ${accion} aceptás los `, medio: ' y la ', despues: '.' }),
} as const

export const PANEL_DOCENTE = {
  /** Sub-entradas de "Mis tareas" hasta que el bloque 3 parta el panel. */
  tareas: { guardadas: 'Tareas guardadas', armar: 'Armar tarea' },
} as const

export const ONBOARDING_DOCENTE = {
  etiqueta: 'Primeros pasos',
  progreso: (hechos: number, total: number) => `${hechos} de ${total} pasos`,
  hitos: {
    materia: 'Tu materia',
    temario: 'Tu temario',
    alumno: 'Tu primer alumno',
    tarea: 'Tu primera tarea',
  },
  hecho: 'Hecho',
  pendiente: 'Pendiente',
  materia: {
    titulo: 'Empecemos por tu materia',
    detalle: 'Decinos qué materia das y cargá el temario. Podés subir el archivo que ya tenés.',
    boton: 'Crear mi materia',
  },
  temario: {
    titulo: (materia: string) => `Cargá el temario de ${materia}`,
    detalle: 'Con el temario, MaestrIA sabe sobre qué preguntar. Podés subir el archivo o escribirlo.',
    boton: 'Cargar el temario',
  },
  alumno: {
    titulo: 'Sumá a tu primer alumno',
    detalle: 'Le pasás un link y entra con su nombre, sin crear una cuenta.',
    boton: 'Invitar a mi primer alumno',
    esperando: {
      titulo: 'Esperando a tu primer alumno',
      detalle: 'Cuando entre con el link, lo vas a ver en Mis alumnos.',
      boton: 'Ver el link de nuevo',
    },
    mientrasTanto: 'Mientras tanto, armar la tarea',
  },
  tarea: {
    titulo: 'Armá tu primera tarea',
    detalle: 'Elegís los temas y MaestrIA arma las preguntas. Las revisás antes de mandarlas.',
    boton: 'Armar la primera tarea',
    mandar: {
      titulo: 'Mandale la tarea a tu grupo',
      detalle: 'Ya la tenés armada. Elegila en tus tareas guardadas y mandásela.',
      boton: 'Mandar la tarea',
    },
  },
  listo: {
    titulo: '¡Listo! Ya mandaste tu primera tarea.',
    detalle: 'Cuando tus alumnos la resuelvan, acá vas a ver en qué se equivoca cada uno.',
    boton: 'Cerrar este aviso',
  },
  link: {
    titulo: 'El link para tu alumno',
    detalle: (materia: string) => `Con este link entra al grupo de ${materia}. Sirve para todos tus alumnos de esa materia.`,
    preparando: 'Preparando el link…',
    etiquetaLink: 'Link del grupo',
    copiar: 'Copiar el link',
    copiado: 'Link copiado',
    recordatorio: 'Entra con su nombre. No necesita cuenta.',
    codigo: (codigo: string) => `También puede escribir el código ${codigo} en la pantalla de inicio.`,
    fallo: 'No pudimos preparar el link. Probá de nuevo.',
    reintentar: 'Probar de nuevo',
    noSeCopio: 'No pudimos copiarlo. Seleccioná el link y copialo a mano.',
  },
  queCargamos: 'tu progreso',
} as const

export const CAMINOS_TEMARIO = {
  titulo: '¿Cómo querés armar tu temario?',
  detalle: 'Elegí el camino que te quede más cómodo. Después lo podés editar.',
  queSigue: 'Qué pasa después',
  import: {
    titulo: 'Subir el archivo que ya tengo',
    para: 'Tenés el temario en PDF, Word o una foto.',
    despues: 'MaestrIA lo lee y arma las unidades por vos.',
    boton: 'Subir un archivo',
  },
  curriculum: {
    titulo: 'Usar el plan oficial de la provincia',
    para: 'Preferís partir de los contenidos oficiales.',
    despues: 'Cargamos los ejes y temas de tu nivel y año.',
    boton: 'Ver el plan oficial',
  },
  manual: {
    titulo: 'Escribirlo yo',
    para: 'Tenés tu propio recorte y lo querés a tu manera.',
    despues: 'Escribís las unidades a mano.',
    boton: 'Empezar en blanco',
  },
  masTarde: 'Decidir más tarde',
} as const
